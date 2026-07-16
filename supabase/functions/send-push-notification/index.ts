import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AppointmentEvent = 'created' | 'updated' | 'status_changed' | 'canceled';

type AppointmentPayload = {
  id?: string | null;
  service?: string | null;
  client_name?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  location?: string | null;
  status?: string | null;
};

const STAFF_ROLES = ['owner', 'manager', 'staff'];
const STAFF_ONLY_NOTIFICATION_TITLES = new Set([
  'Termin i ri',
  'Termin i anuluar',
  'Statusi i terminit ndryshoi',
  'Termini u ndryshua',
]);

function appointmentEventCopy(event: AppointmentEvent, appointment: AppointmentPayload) {
  const client = appointment.client_name || 'Klient';
  const service = appointment.service || 'termin';
  const date = appointment.appointment_date || '';
  const time = appointment.appointment_time ? String(appointment.appointment_time).substring(0, 5) : '';
  const when = [date, time].filter(Boolean).join(' ');
  const location = appointment.location ? ` · ${appointment.location}` : '';

  if (event === 'created') {
    return {
      title: 'Termin i ri',
      message: `${client} rezervoi ${service}${when ? ` për ${when}` : ''}${location}.`,
    };
  }

  if (event === 'canceled') {
    return {
      title: 'Termin i anuluar',
      message: `${client} anuloi ${service}${when ? ` për ${when}` : ''}${location}.`,
    };
  }

  if (event === 'status_changed') {
    return {
      title: 'Statusi i terminit ndryshoi',
      message: `${client} · ${service}${appointment.status ? ` · ${appointment.status}` : ''}${when ? ` · ${when}` : ''}${location}.`,
    };
  }

  return {
    title: 'Termini u ndryshua',
    message: `${client} ndryshoi ${service}${when ? ` për ${when}` : ''}${location}.`,
  };
}

async function sendExpoPush(tokens: string[], title: string, body: string, data: Record<string, unknown>) {
  const uniqueTokens = [...new Set(tokens)].filter(Boolean);
  let sent = 0;

  for (let index = 0; index < uniqueTokens.length; index += 100) {
    const batch = uniqueTokens.slice(index, index + 100).map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) throw new Error(`Shërbimi Expo Push ktheu statusin ${response.status}`);
    sent += batch.length;
  }

  return sent;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Nuk jeni të kyçur');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Nuk jeni të kyçur');

    const { data: profile, error: profileLookupError } = await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileLookupError) throw profileLookupError;
    if (
      !profile ||
      profile.is_active === false ||
      ![...STAFF_ROLES, 'client'].includes(profile.role ?? '')
    ) {
      return Response.json({ error: 'Llogaria nuk është aktive' }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json();

    if (body.mode === 'list_history') {
      const isStaff = STAFF_ROLES.includes(profile?.role ?? '');
      let historyQuery = adminClient
        .from('push_notification_history')
        .select('id, title, message, audience, recipient_id, recipient_count, created_at')
        .order('created_at', { ascending: false })
        .limit(isStaff ? 80 : 60);

      if (!isStaff) {
        historyQuery = historyQuery.or(
          `audience.eq.all,recipient_id.eq.${userData.user.id}`
        );
      }

      const { data: history, error: historyError } = await historyQuery;
      if (historyError) throw historyError;

      const visibleHistory = (history ?? [])
        .filter((item) => isStaff || !STAFF_ONLY_NOTIFICATION_TITLES.has(item.title))
        .map((item) => ({
          ...item,
          audience:
            isStaff &&
            item.recipient_id == null &&
            STAFF_ONLY_NOTIFICATION_TITLES.has(item.title)
              ? 'staff'
              : item.audience,
        }));

      return Response.json({ history: visibleHistory }, { headers: corsHeaders });
    }

    if (body.mode === 'list_recipients') {
      if (!STAFF_ROLES.includes(profile?.role ?? '')) {
        return Response.json({ error: 'Nuk keni qasje për listën e përdoruesve' }, { status: 403, headers: corsHeaders });
      }

      const search = String(body.search ?? '').trim();
      if (search.length > 80) {
        return Response.json({ error: 'Kërkimi është shumë i gjatë' }, { status: 400, headers: corsHeaders });
      }
      let query = adminClient
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .or('is_active.is.null,is_active.eq.true')
        .order('full_name', { ascending: true, nullsFirst: false })
        .limit(80);

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data: recipients, error: recipientsError } = await query;
      if (recipientsError) throw recipientsError;

      return Response.json(
        {
          recipients: (recipients ?? []).map((item) => ({
            id: item.id,
            email: item.email,
            full_name: item.full_name,
            role: item.role,
          })),
        },
        { headers: corsHeaders }
      );
    }

    if (body.mode === 'points_earned') {
      if (!['owner', 'manager'].includes(profile?.role ?? '')) {
        return Response.json({ error: 'Nuk keni qasje për të shtuar Fresh Points' }, { status: 403, headers: corsHeaders });
      }

      const recipientId = String(body.recipient_id ?? '').trim();
      const pointsAdded = Number(body.points_added);
      const suppliedBalance = Number(body.new_balance);

      if (
        !recipientId ||
        !Number.isInteger(pointsAdded) ||
        pointsAdded <= 0 ||
        !Number.isFinite(suppliedBalance) ||
        pointsAdded > suppliedBalance
      ) {
        return Response.json({ error: 'Të dhënat e Fresh Points nuk janë valide' }, { status: 400, headers: corsHeaders });
      }

      const { data: recipient, error: recipientError } = await adminClient
        .from('profiles')
        .select('id, role, is_active, points')
        .eq('id', recipientId)
        .maybeSingle();
      if (recipientError) throw recipientError;
      if (!recipient || recipient.role !== 'client' || recipient.is_active === false) {
        return Response.json({ error: 'Perdoruesi nuk u gjet ose nuk eshte aktiv' }, { status: 404, headers: corsHeaders });
      }

      const newBalance = Number(recipient.points ?? 0);
      if (newBalance !== suppliedBalance) {
        return Response.json({ error: 'Balanca e Fresh Points ka ndryshuar' }, { status: 409, headers: corsHeaders });
      }

      const title = 'Fresh Points u shtuan';
      const message = `Keni fituar ${pointsAdded} Fresh Points. Balanca juaj e re është ${newBalance} pikë (${(newBalance / 10).toFixed(2)} €).`;
      const { data: tokenRows, error: tokenError } = await adminClient
        .from('push_tokens')
        .select('expo_push_token')
        .eq('user_id', recipientId);
      if (tokenError) throw tokenError;

      const sent = await sendExpoPush(
        (tokenRows ?? []).map((row) => row.expo_push_token),
        title,
        message,
        { type: 'points_earned', pointsAdded, newBalance }
      );

      const { error: historyError } = await adminClient.from('push_notification_history').insert({
        sent_by: userData.user.id,
        recipient_id: recipientId,
        audience: 'direct',
        title,
        message,
        recipient_count: sent,
      });
      if (historyError) throw historyError;

      return Response.json({ sent }, { headers: corsHeaders });
    }

    if (body.mode === 'direct_notification') {
      if (!STAFF_ROLES.includes(profile?.role ?? '')) {
        return Response.json({ error: 'Nuk keni qasje për të dërguar njoftime individuale' }, { status: 403, headers: corsHeaders });
      }

      const recipientId = String(body.recipient_id ?? '').trim();
      const title = String(body.title ?? '').trim();
      const message = String(body.message ?? '').trim();

      if (!recipientId) {
        return Response.json({ error: 'Zgjidhni përdoruesin' }, { status: 400, headers: corsHeaders });
      }

      if (!title || title.length > 80 || !message || message.length > 500) {
        return Response.json({ error: 'Përmbajtja e njoftimit nuk është valide' }, { status: 400, headers: corsHeaders });
      }

      const { data: recipient, error: recipientError } = await adminClient
        .from('profiles')
        .select('id, role, is_active')
        .eq('id', recipientId)
        .maybeSingle();

      if (recipientError) throw recipientError;
      if (
        !recipient ||
        recipient.is_active === false ||
        ![...STAFF_ROLES, 'client'].includes(recipient.role ?? '')
      ) {
        return Response.json({ error: 'Përdoruesi nuk u gjet ose nuk është aktiv' }, { status: 404, headers: corsHeaders });
      }

      const { data: tokenRows, error: tokenError } = await adminClient
        .from('push_tokens')
        .select('expo_push_token')
        .eq('user_id', recipientId);

      if (tokenError) throw tokenError;

      const sent = await sendExpoPush(
        (tokenRows ?? []).map((row) => row.expo_push_token),
        title,
        message,
        {
          type: 'direct_notification',
          recipientId,
          sentBy: userData.user.id,
        }
      );

      const { error: historyError } = await adminClient.from('push_notification_history').insert({
        sent_by: userData.user.id,
        recipient_id: recipientId,
        audience: 'direct',
        title,
        message,
        recipient_count: sent,
      });
      if (historyError) throw historyError;

      return Response.json({ sent }, { headers: corsHeaders });
    }

    if (body.mode === 'appointment_event') {
      const event = String(body.event ?? 'updated') as AppointmentEvent;
      if (!['created', 'updated', 'status_changed', 'canceled'].includes(event)) {
        return Response.json({ error: 'Lloji i njoftimit nuk është valid' }, { status: 400, headers: corsHeaders });
      }

      let appointment = (body.appointment ?? {}) as AppointmentPayload;
      const appointmentId = String(appointment.id ?? '').trim();
      if (!appointmentId) {
        return Response.json({ error: 'Mungon ID e terminit' }, { status: 400, headers: corsHeaders });
      }

      {
        const { data: row, error: appointmentError } = await adminClient
          .from('appointments')
          .select('id, user_id, created_by, client_name, service, appointment_date, appointment_time, location, status')
          .eq('id', appointmentId)
          .eq('archived', false)
          .maybeSingle();

        if (appointmentError) throw appointmentError;
        if (!row) {
          return Response.json({ error: 'Termini nuk u gjet' }, { status: 404, headers: corsHeaders });
        }

        if (row) {
          const isClientOwner = row.user_id === userData.user.id;
          const isStaff = STAFF_ROLES.includes(profile?.role ?? '');
          if (!isClientOwner && !isStaff) {
            return Response.json({ error: 'Nuk mund të dërgoni njoftim për këtë termin' }, { status: 403, headers: corsHeaders });
          }

          if (!isStaff) {
            const appointmentStatus = String(row.status ?? '');
            const eventMatchesState = event === 'canceled'
              ? ['canceled', 'cancelled'].includes(appointmentStatus)
              : ['created', 'updated'].includes(event) && appointmentStatus === 'upcoming';

            if (!eventMatchesState) {
              return Response.json(
                { error: 'Gjendja e terminit nuk përputhet me njoftimin' },
                { status: 409, headers: corsHeaders }
              );
            }

            const notificationCutoff = new Date(Date.now() - 30_000).toISOString();
            const { data: recentEvents, error: recentEventsError } = await adminClient
              .from('push_notification_history')
              .select('id')
              .eq('sent_by', userData.user.id)
              .gte('created_at', notificationCutoff)
              .limit(1);
            if (recentEventsError) throw recentEventsError;
            if ((recentEvents ?? []).length > 0) {
              return Response.json(
                { error: 'Prisni pak para se të dërgoni një njoftim tjetër' },
                { status: 429, headers: corsHeaders }
              );
            }
          }

          appointment = {
            id: row.id,
            client_name: row.client_name,
            service: row.service,
            appointment_date: row.appointment_date,
            appointment_time: row.appointment_time,
            location: row.location,
            status: row.status,
          };
        }
      }

      const { title, message } = appointmentEventCopy(event, appointment);
      const { data: staffProfiles, error: profileError } = await adminClient
        .from('profiles')
        .select('id, is_active')
        .in('role', STAFF_ROLES)
        .neq('role', 'client');

      if (profileError) throw profileError;
      const staffIds = (staffProfiles ?? [])
        .filter((item) => item.is_active !== false)
        .map((item) => item.id);
      if (!staffIds.length) return Response.json({ sent: 0 }, { headers: corsHeaders });

      const { data: tokenRows, error: tokenError } = await adminClient
        .from('push_tokens')
        .select('expo_push_token')
        .in('user_id', staffIds);

      if (tokenError) throw tokenError;
      const tokens = (tokenRows ?? []).map((row) => row.expo_push_token);
      const sent = await sendExpoPush(tokens, title, message, {
        type: 'appointment_event',
        event,
        appointmentId: appointment.id ?? null,
      });

      const { error: historyError } = await adminClient.from('push_notification_history').insert({
        sent_by: userData.user.id,
        // Direct with no recipient is intentionally invisible to clients under
        // the history policy, while staff can still inspect operational events.
        audience: 'direct',
        title,
        message,
        recipient_count: sent,
      });
      if (historyError) throw historyError;

      return Response.json({ sent }, { headers: corsHeaders });
    }

    if (profile?.role !== 'owner') {
      return Response.json({ error: 'Vetëm owner-i mund të dërgojë njoftime' }, { status: 403, headers: corsHeaders });
    }

    const title = String(body.title ?? '').trim();
    const message = String(body.message ?? '').trim();
    if (!title || title.length > 80 || !message || message.length > 500) {
      return Response.json({ error: 'Përmbajtja e njoftimit nuk është valide' }, { status: 400, headers: corsHeaders });
    }

    const { data: activeProfiles, error: activeProfilesError } = await adminClient
      .from('profiles')
      .select('id')
      .in('role', [...STAFF_ROLES, 'client'])
      .or('is_active.is.null,is_active.eq.true');
    if (activeProfilesError) throw activeProfilesError;

    const activeUserIds = (activeProfiles ?? []).map((item) => item.id);
    let broadcastTokens: string[] = [];
    if (activeUserIds.length) {
      const { data: rows, error: tokenError } = await adminClient
        .from('push_tokens')
        .select('expo_push_token')
        .in('user_id', activeUserIds);
      if (tokenError) throw tokenError;
      broadcastTokens = (rows ?? []).map((row) => row.expo_push_token);
    }

    const sent = await sendExpoPush(
      broadcastTokens,
      title,
      message,
      { type: 'owner_broadcast' }
    );

    const { error: historyError } = await adminClient.from('push_notification_history').insert({
      sent_by: userData.user.id,
      audience: 'all',
      title,
      message,
      recipient_count: sent,
    });
    if (historyError) throw historyError;

    return Response.json({ sent }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Njoftimi nuk u dërgua' },
      { status: 500, headers: corsHeaders }
    );
  }
});
