/**
 * Watch now hedefi (Faz 2-1b): sağlayıcı bağlantısı → JustWatch → /film/:id; provider_found olayı.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { pickActionEvent } from '../../utils/moodGauntletAnalytics.ts'
import { justWatchCountry, justWatchSearchUrl, resolveWatchTarget } from '../../utils/moodWatchTarget.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

const prov = (id: number, priority: number) => ({ provider_id: id, provider_name: `P${id}`, logo_path: '/x.png', display_priority: priority })
const base = { filmId: 'f1', title: 'Perfect Days', region: 'TR' as string | null }

Deno.test('flatrate saglayici + TMDB link: link acilir, provider_found true', () => {
  const r = resolveWatchTarget({
    ...base, providersReady: true,
    providers: { link: 'https://www.themoviedb.org/movie/1/watch?locale=TR', flatrate: [prov(8, 1)] },
  })
  assertEquals(r, { kind: 'provider_link', url: 'https://www.themoviedb.org/movie/1/watch?locale=TR', providerFound: true })
})

Deno.test('saglayici var ama link yok: JustWatch arama sayfasi (ulke + kodlanmis ad)', () => {
  const r = resolveWatchTarget({ ...base, title: 'Amélie & Co', providersReady: true, providers: { flatrate: [prov(8, 1)] } })
  assertEquals(r.kind, 'justwatch')
  assertEquals(r.url, 'https://www.justwatch.com/tr/search?q=Am%C3%A9lie%20%26%20Co')
  assertEquals(r.providerFound, true)
  assertEquals(justWatchCountry('GB'), 'uk')
  assertEquals(justWatchCountry(' us '), 'us')
  assertEquals(justWatchSearchUrl('US', 'A'), 'https://www.justwatch.com/us/search?q=A')
})

Deno.test('yalniz kirala/satin al saglayicisi da "saglayici var" sayilir (flatrate once siralanir)', () => {
  const r = resolveWatchTarget({ ...base, providersReady: true, providers: { link: 'https://t.me/x', rent: [prov(2, 1)] } })
  assertEquals(r.providerFound, true)
  assertEquals(r.kind, 'provider_link')
})

Deno.test('hic saglayici yok / bos kovalar / veri hazir degil: /film/:id, provider_found false', () => {
  const detail = { kind: 'detail', url: null, providerFound: false } as const
  assertEquals(resolveWatchTarget({ ...base, providersReady: true, providers: { link: 'https://a.b/c' } }), detail)
  assertEquals(resolveWatchTarget({ ...base, providersReady: true, providers: { link: 'https://a.b/c', flatrate: [] } }), detail)
  assertEquals(resolveWatchTarget({ ...base, providersReady: true, providers: null }), detail)
  assertEquals(resolveWatchTarget({ ...base, providersReady: false, providers: { flatrate: [prov(8, 1)] } }), detail)
})

Deno.test('guvenli olmayan link (http / bosluk / javascript:) kullanilmaz → JustWatch', () => {
  for (const link of ['http://x.y/z', 'javascript:alert(1)', 'https://a b', '']) {
    const r = resolveWatchTarget({ ...base, providersReady: true, providers: { link, flatrate: [prov(8, 1)] } })
    assertEquals(r.kind, 'justwatch', link)
  }
})

Deno.test('bolge yok + link yok: uydurma adres yok → detay (saglayici yine bulundu)', () => {
  const r = resolveWatchTarget({ ...base, region: null, providersReady: true, providers: { flatrate: [prov(8, 1)] } })
  assertEquals(r, { kind: 'detail', url: null, providerFound: true })
})

Deno.test('olay: watch_now provider_found tasir; diger eylemler eski bicimde', () => {
  assertEquals(pickActionEvent('watch_now', true), { name: 'mood_tonight_pick_action', props: { action: 'watch_now', provider_found: true } })
  assertEquals(pickActionEvent('watch_now', false).props, { action: 'watch_now', provider_found: false })
  assertEquals(pickActionEvent('share').props, { action: 'share' })
  assertEquals(pickActionEvent('where').props, { action: 'where' })
})

Deno.test('ResultStage baglantisi: hedef cozulur, uygulama ici tarayici, hata sessiz degil, yukleniyorken pasif', () => {
  const src = read('components/MoodGauntlet/ResultStage.tsx')
  assertMatch(src, /import \* as WebBrowser from 'expo-web-browser'/)
  assertMatch(src, /resolveWatchTarget\(\{/)
  assertMatch(src, /pickActionEvent\('watch_now', target\.providerFound\)/)
  assertMatch(src, /WebBrowser\.openBrowserAsync\(target\.url\)/)
  // tarayici acilamazsa kullaniciya detay ekrani + hata kaydi (sessiz fallback degil)
  assertMatch(src, /MOOD_GAUNTLET_WATCH_OPEN_FAILED/)
  assertMatch(src, /router\.push\(`\/film\/\$\{champion\.id\}`\)|openFilm\(champion\.id\)/)
  assertMatch(src, /disabled=\{providers\.state === 'loading'\}/)
  assert(!/track\('watch_now'\)/.test(src), 'eski provider_found\'suz olay kalmamali')
})
