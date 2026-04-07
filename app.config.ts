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
      projectId: '5c6d10a4-12a2-42cc-946b-3baecbe3bc5e',
    },
  },
});
