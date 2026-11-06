/**
 * Hızlı mood kartı + AI rızası (BUG: yeni hesapta ilk kart dokunuşu sessizce yok sayılıyordu).
 * Davranış kilidi (saf util, enjekte bağımlılıklar) + kaynak sözleşmesi.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch, assertNotMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  confirmPendingQuick,
  tapQuick,
  type ConsentReadState,
  type ConsentTrace,
  type PendingQuick,
  type QuickConsentDeps,
  type QuickStartInput,
} from '../../utils/moodQuickConsent.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CARD: PendingQuick = { cardId: 'mindbending', prompt: 'something mind-bending', label: 'Mind-bending' }

function harness(initial: ConsentReadState, recordOk = true) {
  let state = initial
  const started: QuickStartInput[] = []
  const traces: ConsentTrace[] = []
  let recordCalls = 0
  const deps: QuickConsentDeps = {
    readConsent: () => Promise.resolve(state),
    recordConsent: () => {
      recordCalls += 1
      if (recordOk) state = 'granted'
      return Promise.resolve({ ok: recordOk })
    },
    start: (i) => started.push(i),
    trace: (k) => traces.push(k),
  }
  return { deps, started, traces, calls: () => recordCalls }
}

Deno.test('rıza yok → kart: arama BAŞLAMAZ, rıza YAZILMAZ, görünür adım istenir, breadcrumb düşer', async () => {
  const h = harness('denied')
  const out = await tapQuick(h.deps, CARD)
  assertEquals(out, { kind: 'awaiting_consent', reason: 'denied' })
  assertEquals(h.started.length, 0)
  assertEquals(h.calls(), 0, 'kart dokunuşu rıza yazmaz (Apple 5.1.2(i))')
  assertEquals(h.traces, ['quick_blocked_no_consent'])
})

Deno.test('rıza yok → kart → CTA: recordConsent + onStart(quickMoodId) (hata senaryosunun tam akışı)', async () => {
  const h = harness('denied')
  await tapQuick(h.deps, CARD)
  const res = await confirmPendingQuick(h.deps, CARD)
  assertEquals(res, 'recorded_started')
  assertEquals(h.calls(), 1)
  assertEquals(h.started, [{ text: CARD.prompt, quickMoodId: 'mindbending', entry: 'quick', label: 'Mind-bending' }])
})

Deno.test('rıza kaydı başarısız → arama başlamaz, consent_save_failed izi, bekleyen kart korunur (yeniden denenebilir)', async () => {
  const h = harness('denied', false)
  const res = await confirmPendingQuick(h.deps, CARD)
  assertEquals(res, 'save_failed')
  assertEquals(h.started.length, 0)
  assertEquals(h.traces, ['consent_save_failed'])
})

Deno.test('rıza okunamadı (unknown) → sessiz dönüş YOK: görünür adım + consent_read_failed', async () => {
  const h = harness('unknown')
  const out = await tapQuick(h.deps, CARD)
  assertEquals(out, { kind: 'awaiting_consent', reason: 'read_failed' })
  assertEquals(h.started.length, 0)
  assertEquals(h.traces, ['consent_read_failed'])
})

Deno.test('rıza var → kart doğrudan başlatır (regresyon: 2–4 Kas hesabı akışı bozulmaz)', async () => {
  const h = harness('granted')
  const out = await tapQuick(h.deps, CARD)
  assertEquals(out, { kind: 'started' })
  assertEquals(h.started.length, 1)
  assertEquals(h.started[0].quickMoodId, 'mindbending')
  assertEquals(h.calls(), 0)
  assertEquals(h.traces, [])
})

Deno.test('rıza bu arada verilmişse CTA tekrar yazmaz ve granted olayı için recorded_started DÖNMEZ', async () => {
  const h = harness('granted')
  assertEquals(await confirmPendingQuick(h.deps, CARD), 'started')
  assertEquals(h.calls(), 0)
})

Deno.test('başka karta dokunmak: bekleyen kart ikinci kart olur ve CTA onunla başlar', async () => {
  const h = harness('denied')
  const other: PendingQuick = { cardId: 'cozy', prompt: 'cozy night', label: 'Cozy' }
  await tapQuick(h.deps, CARD)
  await tapQuick(h.deps, other)
  await confirmPendingQuick(h.deps, other)
  assertEquals(h.started.map((s) => s.quickMoodId), ['cozy'])
})

// ─── Kaynak sözleşmesi ──────────────────────────────────────────────────────

const entry = strip(read('components/MoodGauntlet/EntryStage.tsx'))
const service = strip(read('services/aiConsent.ts'))
const util = strip(read('utils/moodQuickConsent.ts'))

Deno.test('EntryStage: kart yolu util üzerinden; eski sessiz `setConsented(false); return` YOK', () => {
  assertMatch(entry, /tapQuick\(quickDeps, picked\)/)
  assertMatch(entry, /confirmPendingQuick\(quickDeps, current\)/)
  assertNotMatch(entry, /consented !== true && !\(await hasAiConsent\(\)\)/)
})

Deno.test('EntryStage: rıza adımı kaydırma alanının DIŞINDA (SE dahil görünür) ve mevcut anahtarları kullanır', () => {
  const scrollEnd = entry.indexOf('</ScrollView>')
  const dock = entry.indexOf('styles.consentDock')
  assert(scrollEnd > 0 && dock > scrollEnd, 'dock ScrollView kapandıktan sonra çizilir')
  assertMatch(entry, /pending !== null && \(\s*<View style=\{styles\.consentDock\}>/)
  assertMatch(entry, /t\('aiConsent\.inlineBody'\)/)
  assertMatch(entry, /t\('aiConsent\.inlineEnableAndFind'\)/)
})

Deno.test('EntryStage: seçili görünüm mevcut activeMoodText ile (yeni stil yok)', () => {
  assertMatch(entry, /activeMoodText=\{activeCard \? t\(activeCard\.titleKey\) : ''\}/)
})

Deno.test('EntryStage: her erken çıkış iz bırakır (breadcrumb; read/save failed ayrıca warning)', () => {
  assertMatch(entry, /Sentry\.addBreadcrumb\(\{ category: 'mood_gauntlet', level: 'info', message: kind/)
  assertMatch(entry, /kind === 'consent_read_failed' \|\| kind === 'consent_save_failed'/)
  assertMatch(entry, /level: 'warning'/)
  assertMatch(entry, /traceConsent\('free_text_not_submittable'\)/)
  assertMatch(entry, /traceConsent\('consent_save_failed', \{ source: 'free_text' \}\)/)
  assertMatch(util, /deps\.trace\('quick_blocked_no_consent'/)
  assertMatch(util, /deps\.trace\('consent_read_failed'/)
  assertMatch(util, /deps\.trace\('consent_save_failed'/)
})

Deno.test('analitik: yalnız MEVCUT consent olayları + source; yeni olay adı yok; mood_gauntlet_started dokunulmadı', () => {
  assertMatch(entry, /posthogAnalytics\.track\(event, \{ surface: 'mood_search', variant: 'inline', source \}\)/)
  assertMatch(entry, /type ConsentSource = 'quick' \| 'free_text'/)
  const names = [...entry.matchAll(/'(ai_consent_[a-z_]+)'/g)].map((m) => m[1])
  for (const n of names) assert(['ai_consent_shown', 'ai_consent_granted'].includes(n), `beklenmeyen olay: ${n}`)
  assertNotMatch(entry, /mood_gauntlet_started/)
})

Deno.test('servis: readAiConsentState unknown/denied ayırır; hasAiConsent fail-closed kalır', () => {
  assertMatch(service, /export async function readAiConsentState\(\): Promise<AiConsentReadState>/)
  assertMatch(service, /return \(await readAiConsentState\(\)\) === 'granted'/)
})

Deno.test('i18n: yeni anahtar açılmadı — kullanılan anahtarlar mevcut', () => {
  const en = JSON.parse(read('locales/en.json'))
  assert(en.aiConsent.inlineBody && en.aiConsent.inlineEnableAndFind && en.aiConsent.saveError)
})
