import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
console.log("SUPABASE URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log("SUPABASE KEY:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // web support
  },
});
