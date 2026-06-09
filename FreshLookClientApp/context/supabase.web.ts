import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isServer = typeof window === 'undefined';

const webStorage = {
  getItem: (key: string) => {
    if (isServer) return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (isServer) return;
    window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (isServer) return;
    window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServer ? undefined : webStorage,
    persistSession: !isServer,
    autoRefreshToken: !isServer,
    detectSessionInUrl: true,
  },
});
