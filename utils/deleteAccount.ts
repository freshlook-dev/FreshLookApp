import { supabase } from '../context/supabase';

/** Permanently deletes the signed-in account and its avatar through a protected Edge Function. */
export async function deleteCurrentAccount() {
  const { data, error } = await supabase.functions.invoke('delete-own-account', {
    body: {},
  });

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || 'Llogaria nuk u fshi');
  }

  // The access token is no longer valid after deletion; clear the local session too.
  await supabase.auth.signOut({ scope: 'local' });
}
