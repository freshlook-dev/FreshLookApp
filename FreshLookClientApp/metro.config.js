const { getDefaultConfig } = require('expo/metro-config');
const { parseProjectEnv } = require('@expo/env');
const path = require('node:path');

// This app lives one directory below the shared repository environment file.
// EAS/CI-provided variables keep priority; the parent file is only a local fallback.
if (
  !process.env.EXPO_PUBLIC_SUPABASE_URL ||
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
) {
  const { env } = parseProjectEnv(path.resolve(__dirname, '..'), {
    silent: true,
  });
  process.env.EXPO_PUBLIC_SUPABASE_URL ||= env.EXPO_PUBLIC_SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||=
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}

module.exports = getDefaultConfig(__dirname);
