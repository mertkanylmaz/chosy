/**
 * Koşum:  npm run test:rc-webhook
 */
import { assertEquals } from 'jsr:@std/assert@1'

import { isRcTestEvent, parseRcEnvironment } from './rcEnvironment.ts'

Deno.test('parseRcEnvironment: iki geçerli değer aynen döner', () => {
  assertEquals(parseRcEnvironment('SANDBOX'), 'SANDBOX')
  assertEquals(parseRcEnvironment('PRODUCTION'), 'PRODUCTION')
})

Deno.test('parseRcEnvironment: eksik/tanınmayan değer null — varsayılan YOK', () => {
  for (const v of [undefined, null, '', 'sandbox', 'production', 'STAGING', ' SANDBOX', 1, {}]) {
    assertEquals(parseRcEnvironment(v), null, `değer: ${JSON.stringify(v)}`)
  }
})

Deno.test('isRcTestEvent: yalnız TEST', () => {
  assertEquals(isRcTestEvent('TEST'), true)
  for (const t of ['INITIAL_PURCHASE', 'TRANSFER', 'test', undefined]) {
    assertEquals(isRcTestEvent(t), false)
  }
})
