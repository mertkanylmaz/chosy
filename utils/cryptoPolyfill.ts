/**
 * WebCrypto polyfill — React Native'de eksik olan crypto.subtle API'sini sağlar.
 *
 * Supabase PKCE flow, code challenge için SHA-256 kullanır.
 * React Native'de globalThis.crypto.subtle mevcut değil; bu polyfill
 * expo-crypto ile SHA-256 digest'i sağlar.
 *
 * Native module mevcut değilse (dev client rebuild öncesi) Math.random fallback
 * ile graceful degrade eder — uygulama çökmez.
 *
 * _layout.tsx'te her şeyden ÖNCE import edilmeli.
 */

// expo-crypto'yu güvenli şekilde yükle — native module yoksa null
// Top-level import kullanılmaz çünkü native module eksikse crash olur.
// eslint-disable-next-line @typescript-eslint/no-require-imports
let ExpoCrypto: typeof import('expo-crypto') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ExpoCrypto = require('expo-crypto') as typeof import('expo-crypto');
} catch {
  // Native module bulunamadı — dev client rebuild gerekli
  // Fallback mode ile devam et
}

// ── getRandomValues ────────────────────────────────────────────────────────────

if (typeof globalThis.crypto === 'undefined') {
  (globalThis as Record<string, unknown>).crypto = {};
}

if (!globalThis.crypto.getRandomValues) {
  (globalThis.crypto as unknown as Record<string, unknown>).getRandomValues = (
    array: ArrayBufferView,
  ): ArrayBufferView => {
    if (ExpoCrypto) {
      return ExpoCrypto.getRandomValues(
        array as Parameters<typeof ExpoCrypto.getRandomValues>[0],
      );
    }
    // Fallback: Math.random tabanlı (kriptografik olarak güvenli değil —
    // sadece dev/test ortamında kabul edilebilir)
    const typedArray = array as unknown as Uint8Array;
    for (let i = 0; i < typedArray.length; i++) {
      typedArray[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

// ── subtle.digest (SHA-256) ───────────────────────────────────────────────────

if (!globalThis.crypto.subtle && ExpoCrypto) {
  // @ts-expect-error — polyfill — sadece digest implementasyonu yeterli
  globalThis.crypto.subtle = {
    /**
     * SHA-256 / SHA-1 digest hesaplar.
     * Supabase PKCE code challenge için kullanılır.
     */
    digest: async (
      algorithm: AlgorithmIdentifier,
      data: BufferSource,
    ): Promise<ArrayBuffer> => {
      const algoName =
        typeof algorithm === 'string' ? algorithm : (algorithm as Algorithm).name;

      // expo-crypto algoritma adı: "SHA-256", "SHA-1" vb.
      const expoAlgo = algoName.replace('-', '') as import('expo-crypto').CryptoDigestAlgorithm;

      // BufferSource → Uint8Array → base64
      let bytes: Uint8Array;
      if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      } else {
        bytes = new Uint8Array((data as ArrayBufferView).buffer);
      }

      // expo-crypto digest (base64 encoding ile)
      const base64 = await ExpoCrypto!.digestStringAsync(
        expoAlgo,
        String.fromCharCode(...bytes),
        { encoding: ExpoCrypto!.CryptoEncoding.BASE64 },
      );

      // base64 → ArrayBuffer
      const binary = atob(base64);
      const buffer = new ArrayBuffer(binary.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
      }
      return buffer;
    },
  };
}
