import { Platform } from 'react-native';

let supabase: any;

if (Platform.OS === 'web') {
  supabase = require('./supabase.web').supabase;
} else {
  supabase = require('./supabase.native').supabase;
}

export { supabase };