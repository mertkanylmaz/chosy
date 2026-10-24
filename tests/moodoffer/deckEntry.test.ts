/**
 * Desteye giriş yolları (MONEY-1C B-4, B-5). Kaynak-okuma regresyonu: `/discover`
 * yalnız MoodSearchScreen'den açılır ve orada her zaman `lastSearchId` yazılır; böylece
 * teklif defteri anahtarı (`search_id`) hiçbir giriş yolunda bayat kalmaz.
 * Run: npm run test:mood-offer
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const root = new URL('../../', import.meta.url)
const read = (p: string) => Deno.readTextFileSync(new URL(p, root)).replaceAll('\r\n', '\n')

function* walk(dir: string): Generator<string> {
  for (const e of Deno.readDirSync(new URL(dir, root))) {
    const rel = `${dir}${e.name}`
    if (e.isDirectory) yield* walk(`${rel}/`)
    else if (/\.(ts|tsx)$/.test(e.name)) yield rel
  }
}

Deno.test('/discover yalnız MoodSearchScreen içinden açılır (başka giriş yolu yok)', () => {
  const hits: string[] = []
  for (const dir of ['app/', 'components/', 'hooks/', 'services/', 'contexts/', 'utils/']) {
    for (const f of walk(dir)) {
      if (f.startsWith('components/Discover/')) continue
      if (/['"`]\/discover['"`]|pathname:\s*['"]\/discover['"]/.test(read(f))) hits.push(f)
    }
  }
  assertEquals(hits, ['components/Home/MoodSearchScreen/index.tsx'])
})

Deno.test('her arama applySearchResult üzerinden lastSearchId yazar (null dahil)', () => {
  const m = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(m, /setLastSearchId\(searchId\);/)
  // desteye tek geçiş noktası: arama sonucu uygulandıktan sonra
  assert((m.match(/applySearchResult\(/g) ?? []).length >= 1)
})

Deno.test('handleNewMood: clearMood sonrası useFeedManager yeni istek açmaz (deste dolu / bağımlılık değişmez)', () => {
  const feed = read('hooks/useFeedManager.ts')
  // soğuk başlangıç yalnız films.length === 0 iken; ilk yükleme yalnız yeni sessionId + profil != null
  assertMatch(feed, /!coldStartLoadedRef\.current &&[\s\S]*?state\.films\.length === 0/)
  assertMatch(feed, /state\.sessionId !== loadedSessionRef\.current &&\s*profileRef\.current !== null/)
  // clearMood lastSearchId'yi sıfırlamaz: defter anahtarı sabit, yeniden gönderimde çift teklif yok
  const ctx = read('contexts/MoodContext.tsx')
  const clear = ctx.slice(ctx.indexOf('const clearMood'), ctx.indexOf('const setPresetMoodText'))
  assert(!clear.includes('setLastSearchId') && !clear.includes('LastSearchId'))
})
