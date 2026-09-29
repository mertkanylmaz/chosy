/**
 * WebCrypto → expo-crypto algoritma eşlemesi (REACT-NATIVE-8).
 * Run: npm run test:crypto
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { expoDigestAlgorithmFor } from '../../utils/webCryptoAlgorithm.ts'

// expo-crypto `CryptoDigestAlgorithm` enum değerleri (Crypto.types.d.ts).
// Buradaki beklenen değerler o enum'la birebir aynı olmalı.
Deno.test('SHA ailesi tireli enum değerine eşlenir', () => {
  assertEquals(expoDigestAlgorithmFor('SHA-256'), 'SHA-256')
  assertEquals(expoDigestAlgorithmFor('SHA-1'), 'SHA-1')
  assertEquals(expoDigestAlgorithmFor('SHA-384'), 'SHA-384')
  assertEquals(expoDigestAlgorithmFor('SHA-512'), 'SHA-512')
})

Deno.test('WebCrypto adı büyük/küçük harfe duyarsız', () => {
  assertEquals(expoDigestAlgorithmFor('sha-256'), 'SHA-256')
})

// Eski hata: tire silinmiş ad. Bu biçim artık TANINMAZ, sessizce geçmez.
Deno.test('tanınmayan ad null döner', () => {
  assertEquals(expoDigestAlgorithmFor('SHA256'), null)
  assertEquals(expoDigestAlgorithmFor('MD5'), null)
  assertEquals(expoDigestAlgorithmFor(''), null)
})
