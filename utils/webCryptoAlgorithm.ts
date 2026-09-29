/**
 * WebCrypto algoritma adı → expo-crypto `CryptoDigestAlgorithm` DEĞERİ.
 *
 * REACT-NATIVE-8 (26 Eyl 2026, build 902): polyfill eskiden tireyi siliyordu
 * (`'SHA-256'.replace('-', '')` → `'SHA256'`). Ama expo-crypto'nun enum
 * DEĞERLERİ tirelidir (`CryptoDigestAlgorithm.SHA256 === 'SHA-256'`), yani
 * doğrulama her çağrıda "Invalid algorithm" fırlatıyordu. `flowType: 'pkce'`
 * altında signInWithOtp, updateUser(email) ve Google OAuth bu yoldan geçer.
 *
 * Eşleme açık liste: WebCrypto adı büyük/küçük harfe duyarsızdır, tanınmayan
 * ad `null` döner ve çağıran taraf fırlatır. Sessiz yanlış hash yok.
 *
 * Saf modül: import yok. Deno testi doğrudan okur
 * (`tests/identity/webCryptoAlgorithm.test.ts`).
 */

const WEB_TO_EXPO: Readonly<Record<string, string>> = {
  'SHA-1': 'SHA-1',
  'SHA-256': 'SHA-256',
  'SHA-384': 'SHA-384',
  'SHA-512': 'SHA-512',
};

export function expoDigestAlgorithmFor(webName: string): string | null {
  return WEB_TO_EXPO[webName.toUpperCase()] ?? null;
}
