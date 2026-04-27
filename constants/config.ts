/**
 * Uygulama genelinde kullanılan konfigürasyon sabitleri.
 * Değerler .env dosyasından (EXPO_PUBLIC_ prefix'li) okunur.
 * ANTHROPIC_API_KEY yalnızca backend/scripts tarafında kullanılır,
 * asla EXPO_PUBLIC_ prefix'i eklenmemeli.
 */

/** Supabase proje URL'i */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/** Supabase anonim (public) API anahtarı */
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * TMDb API anahtarı — sadece Supabase Edge Functions'da kullanılır.
 * Client kodu bu değişkeni KULLANMAMALI.
 * @deprecated Client-side TMDb çağrıları Edge Function'a taşınacak.
 */
export const TMDB_API_KEY = '';

/** RevenueCat iOS API anahtarı */
export const RC_IOS_API_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';

/** RevenueCat Android API anahtarı */
export const RC_ANDROID_API_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';
