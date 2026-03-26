import { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dinamik Expo konfigürasyonu.
 * app.json'daki statik değerleri temel alır,
 * environment variable'ları extra alanına enjekte eder.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Chosy.ai',
  slug: config.slug ?? 'chosy-ai',
  plugins: ['expo-font'],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    tmdbApiKey: process.env.EXPO_PUBLIC_TMDB_API_KEY,
    claudeApiKey: process.env.EXPO_PUBLIC_CLAUDE_API_KEY,
    appEnv: process.env.APP_ENV ?? 'development',
    eas: {
      projectId: 'b45f6a58-18a9-4910-a5c0-1f4efce27a90',
    },
  },
});
