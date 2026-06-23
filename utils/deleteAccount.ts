import { supabase } from '../context/supabase';

/** Permanently deletes the signed-in account through a server-side RPC. */
export async function deleteCurrentAccount() {
  const { error } = await supabase.rpc('delete_own_account');

  if (error) throw error;

  // The access token is no longer valid after deletion; clear the local session too.
  await supabase.auth.signOut({ scope: 'local' });
}
