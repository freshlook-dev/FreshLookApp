import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Not authenticated');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Not authenticated');

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .single();

    if (profile?.role !== 'owner' || profile.is_active === false) {
      return Response.json({ error: 'Only the owner can send notifications' }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json();
    const title = String(body.title ?? '').trim();
    const message = String(body.message ?? '').trim();
    if (!title || title.length > 80 || !message || message.length > 500) {
      return Response.json({ error: 'Invalid notification content' }, { status: 400, headers: corsHeaders });
    }

    const { data: rows, error: tokenError } = await adminClient
      .from('push_tokens')
      .select('expo_push_token');
    if (tokenError) throw tokenError;

    const tokens = [...new Set((rows ?? []).map((row) => row.expo_push_token))];
    let sent = 0;

    for (let index = 0; index < tokens.length; index += 100) {
      const batch = tokens.slice(index, index + 100).map((to) => ({
        to,
        sound: 'default',
        title,
        body: message,
        data: { type: 'owner_broadcast' },
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

      if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
      sent += batch.length;
    }

    await adminClient.from('push_notification_history').insert({
      sent_by: userData.user.id,
      title,
      message,
      recipient_count: sent,
    });

    return Response.json({ sent }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to send notification' },
      { status: 500, headers: corsHeaders }
    );
  }
});
