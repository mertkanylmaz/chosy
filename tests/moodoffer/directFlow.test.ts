/**
 * PRO-0 F0-3: arama bitince doğrudan deste; ekranda etiket, LLM'e tam prompt.
 * Kaynak-okuma regresyonu. Run: npm run test:mood-offer
 */
import { assert, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('arama ekranı profil/paylaşım ekranına geçmez; sonuç aşaması yok', () => {
  const m = read('components/Home/MoodSearchScreen/index.tsx')
  assert(!/MoodProfileResult|MoodShareCard|useShareCapture|handleBrowseMovies/.test(m.replace(/\/\*[\s\S]*?\*\//g, '')))
  assertMatch(m, /type Phase = 'input' \| 'processing';/)
  // desteye geçiş applySearchResult içinde: bağlam yazılır, kota tazelenir, route açılır
  const apply = m.slice(m.indexOf('const applySearchResult'), m.indexOf('const runAiSearch'))
  assertMatch(apply, /setLastMoodText\(label\);\s*setMoodResult\(profile, filters\);[\s\S]{0,120}checkQuota\(\);/)
  assertMatch(apply, /router\.push\('\/discover'\)/)
  assertMatch(apply, /pathname: '\/discover', params: \{ onboarding: '1' \}/)
})

Deno.test('etiket ve tam prompt ayrı: LLM/rerank tam prompt, oturum ve ekran etiket', () => {
  const m = read('components/Home/MoodSearchScreen/index.tsx')
  const apply = m.slice(m.indexOf('const applySearchResult'), m.indexOf('const runAiSearch'))
  assertMatch(apply, /setPendingMoodText\(trimmed\);\s*(\/\/[^\n]*\n\s*)*setLastFullPrompt\(trimmed\);/)
  assertMatch(apply, /saveSession\(userId, label, profile\)/)
  // hızlı mood ve Recent aramayı doğrudan başlatır
  assertMatch(m, /void startPicked\(card \? t\(card\.titleKey\) : text, text\)/)
  assertMatch(m, /void startPicked\(label, prompt\)/)
  // eski robotik kayıtlar iki dilin başlık/prompt'larıyla eşleşir
  assertMatch(m, /\(\['en', 'tr'\] as const\)\.some/)
  // "Filtreleri kaldır" tam prompt'u okur
  assertMatch(read('app/discover.tsx'), /getLastFullPrompt\(\) \?\? lastMoodText/)
})

Deno.test('ms_since_submit: gönderim anı bağlamda taşınır, yalnız başlayan destede atılır', () => {
  assertMatch(read('services/moodSearchState.ts'), /submittedAt\?: number/)
  assertMatch(read('components/Home/MoodSearchScreen/index.tsx'), /setSearchAnalyticsContext\(\{ entryPoint, consent: true, submittedAt \}\)/)
  assertMatch(read('app/discover.tsx'), /ms_since_submit: Date\.now\(\) - submittedAt/)
})
