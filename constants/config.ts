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

/**
 * Cinema DNA (Profile kartı + okuması) v1'de KAPALI — CTO kararı, 30 Eyl 2026.
 * Kart `cinema_dna` değil mood-search dönemi `sessions` tablosunu okuyor ve
 * `recompute-taste-vector` hiçbir yerden tetiklenmiyor; açık bırakmak var
 * olmayan bir özelliği vaat etmek olurdu. Boru hattı v1.1 — ön koşullar
 * `docs/TEKNIK_BORC.md`. Bileşen ve servis SİLİNMEDİ.
 *
 * Getter biçimi CLAUDE.md kural 5 gereği: v1.1'de `app_config`'e
 * taşındığında çağıran taraf değişmez.
 */
export const isCinemaDnaEnabled = (): boolean => false;
