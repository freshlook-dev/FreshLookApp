import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Nuk jeni të kyçur');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Nuk jeni të kyçur');

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== 'client' || profile.is_active === false) {
      return Response.json({ error: 'Llogaria nuk eshte aktive' }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json();
    const orderId = String(body.order_id ?? '').trim();
    const action = String(body.action ?? '').trim();
    if (!orderId || orderId.length > 128 || !['cancel', 'update_details'].includes(action)) {
      return Response.json({ error: 'Kërkesa nuk është valide' }, { status: 400, headers: corsHeaders });
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, user_id, created_at, status')
      .eq('id', orderId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return Response.json({ error: 'Porosia nuk u gjet' }, { status: 404, headers: corsHeaders });

    const now = Date.now();
    const deadline = new Date(order.created_at).getTime() + 3 * 60 * 60 * 1000;
    if (now > deadline) {
      return Response.json({ error: 'Afati prej 3 orësh për ndryshim ka përfunduar' }, { status: 403, headers: corsHeaders });
    }
    if (!['pending', 'processing'].includes(order.status)) {
      return Response.json({ error: 'Kjo porosi nuk mund të ndryshohet më' }, { status: 409, headers: corsHeaders });
    }

    if (action === 'cancel') {
      const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data: updatedOrder, error } = await adminClient
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)
        .eq('user_id', userData.user.id)
        .in('status', ['pending', 'processing'])
        .gte('created_at', cutoff)
        .select('id, status')
        .maybeSingle();
      if (error) throw error;
      if (!updatedOrder) {
        return Response.json({ error: 'Kjo porosi nuk mund te ndryshohet me' }, { status: 409, headers: corsHeaders });
      }
      return Response.json({ success: true, status: 'cancelled' }, { headers: corsHeaders });
    }

    const fullName = String(body.full_name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const address = String(body.address ?? '').trim();
    const instructions = String(body.instructions ?? '').trim();
    if (!fullName || !phone || !address) {
      return Response.json({ error: 'Emri, telefoni dhe adresa janë të detyrueshme' }, { status: 400, headers: corsHeaders });
    }

    if (
      fullName.length > 160 ||
      phone.length > 50 ||
      address.length > 500 ||
      instructions.length > 1000
    ) {
      return Response.json({ error: 'Te dhenat e porosise jane shume te gjata' }, { status: 400, headers: corsHeaders });
    }

    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data: updatedOrder, error } = await adminClient
      .from('orders')
      .update({ full_name: fullName, phone, address, instructions })
      .eq('id', order.id)
      .eq('user_id', userData.user.id)
      .in('status', ['pending', 'processing'])
      .gte('created_at', cutoff)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!updatedOrder) {
      return Response.json({ error: 'Kjo porosi nuk mund te ndryshohet me' }, { status: 409, headers: corsHeaders });
    }
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Porosia nuk u përditësua' },
      { status: 500, headers: corsHeaders }
    );
  }
});
