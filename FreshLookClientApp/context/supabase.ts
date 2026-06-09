let supabase: typeof import('./supabase.native').supabase;

if (typeof window !== 'undefined') {
  supabase = require('./supabase.web').supabase;
} else {
  supabase = require('./supabase.native').supabase;
}

export { supabase };
