import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Metoda nuk lejohet' },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return Response.json(
        { error: 'Duhet të jeni të kyçur për të fshirë llogarinë' },
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return Response.json(
        { error: 'Sesioni nuk është më i vlefshëm' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Storage objects must be removed through the Storage API, never by
    // deleting rows from storage.objects directly.
    const { error: avatarError } = await adminClient.storage
      .from('avatars')
      .remove([`${userData.user.id}.jpg`]);
    if (avatarError) throw avatarError;

    // The database function performs profile and Auth cleanup atomically and
    // can only delete the account identified by the caller's verified JWT.
    const { error: deletionError } = await userClient.rpc('delete_own_account');
    if (deletionError) throw deletionError;

    return Response.json({ deleted: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Llogaria nuk u fshi' },
      { status: 500, headers: corsHeaders }
    );
  }
});
