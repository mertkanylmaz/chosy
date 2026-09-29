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

import { expoDigestAlgorithmFor } from './webCryptoAlgorithm';

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
     * SHA-1 / SHA-256 / SHA-384 / SHA-512 digest hesaplar.
     * Supabase PKCE code challenge için kullanılır (`flowType: 'pkce'`).
     *
     * REACT-NATIVE-8 düzeltmesi (29 Eyl 2026): algoritma adı expo-crypto'nun
     * tireli enum DEĞERİNE açık listeyle eşlenir (`webCryptoAlgorithm.ts`);
     * tanınmayan ad fırlatır. Baytlar `ExpoCrypto.digest` ile DOĞRUDAN
     * hash'lenir: eski yol baytları string'e çevirip `digestStringAsync`'e
     * veriyordu, o da UTF-8 kodluyordu (ASCII dışı baytta yanlış hash), ve
     * view'ın `byteOffset`/`byteLength`'ini yok sayıyordu.
     */
    digest: async (
      algorithm: AlgorithmIdentifier,
      data: BufferSource,
    ): Promise<ArrayBuffer> => {
      const algoName =
        typeof algorithm === 'string' ? algorithm : (algorithm as Algorithm).name;

      const expoAlgo = expoDigestAlgorithmFor(algoName);
      if (expoAlgo === null) {
        // WebCrypto'nun kendi davranışı: desteklenmeyen algoritma reddedilir.
        throw new Error(`crypto.subtle.digest: desteklenmeyen algoritma "${algoName}"`);
      }

      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

      return ExpoCrypto!.digest(expoAlgo as import('expo-crypto').CryptoDigestAlgorithm, bytes);
    },
  };
}
