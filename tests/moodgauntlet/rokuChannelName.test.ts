/**
 * "The Roku Channel" adı kırpılmaz (Faz 2-10a). Kök neden: kanal eklentisi soneki
 * "Roku Channel" ("The" önüne bırakarak) bağımsız servisin adından da atılıyordu.
 * Saf fonksiyon; ağ/cihaz gerektirmez.
 */
import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import fixture from '../fixtures/tmdbWatchProviders.beforeSunrise76.json' with { type: 'json' }
import { brandOf, channelAddonBase, isChannelAddonName } from '../../utils/watchProviderBrands.ts'
import { dedupeChannelVariants } from '../../utils/watchProviderList.ts'

interface Fx { provider_id: number; provider_name: string }
const ARTICLES = new Set(['the', 'a', 'an'])

// deno-lint-ignore no-explicit-any
const allProviders: Fx[] = Object.values((fixture as any).results).flatMap((r: any) =>
  ['flatrate', 'free', 'ads', 'rent', 'buy'].flatMap((k) => (r[k] ?? []) as Fx[]),
)

Deno.test('fixture: "The Roku Channel" görünen adda tam çıkar', () => {
  const roku = allProviders.find((x) => x.provider_name === 'The Roku Channel')
  assert(roku, 'fixture The Roku Channel içermeli')
  assertEquals(brandOf(roku).name, 'The Roku Channel')
  assertEquals(isChannelAddonName('The Roku Channel'), false)
})

Deno.test('gerçek kanal eklentisi hâlâ tabana iner', () => {
  assertEquals(channelAddonBase('Lionsgate+ Roku Premium Channel'), 'Lionsgate+')
  assertEquals(brandOf({ provider_id: 99991, provider_name: 'Lionsgate+ Roku Premium Channel' }).name, 'Lionsgate+')
  assertEquals(channelAddonBase('MGM+ Amazon Channel'), 'MGM+')
})

Deno.test('artikel ya da boş taban sonek atmaz', () => {
  assertEquals(channelAddonBase('The Roku Channel'), null)
  assertEquals(channelAddonBase('A Amazon Channel'), null)
  assertEquals(channelAddonBase('an Apple TV channel'), null)
  assertEquals(channelAddonBase('Roku Channel'), null)
})

Deno.test('dedupeChannelVariants: The Roku Channel kanal varyantı sayılmaz (brandOf ile aynı karar)', () => {
  const list = [{ provider_id: 207, provider_name: 'The Roku Channel' }, { provider_id: 1, provider_name: 'The' }]
  assertEquals(dedupeChannelVariants(list).length, 2)
})

Deno.test('fixture: hiçbir sağlayıcının marka adı bir artikele eşit değil', () => {
  assert(allProviders.length > 0)
  for (const p of allProviders) {
    assert(!ARTICLES.has(brandOf(p).name.trim().toLowerCase()), `${p.provider_name} -> ${brandOf(p).name}`)
    assertNotEquals(brandOf(p).name.trim(), '')
  }
})

Deno.test('fixture: "name:the" anahtarı hiçbir sağlayıcıya düşmez', () => {
  const hits = allProviders.filter((p) => brandOf(p).key === 'name:the')
  assertEquals(hits.map((p) => p.provider_name), [])
})
