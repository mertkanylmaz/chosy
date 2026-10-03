/**
 * Günlük bulmaca yokluğu — `NO_PUZZLE` (P-1c E, 3 Eki 2026).
 *
 * `get-daily-challenge` o gün için bulmaca yoksa `404 { error: 'NO_PUZZLE' }`
 * döner (`supabase/functions/get-daily-challenge/index.ts`). Bu bir AĞ
 * HATASI değil, bir VERİ DURUMUDUR: kuyruk bitmiş ya da üretim koşmamış.
 * İstemci ikisini ayırır:
 *   - NO_PUZZLE  → `PuzzleUnavailableError`, Sentry'ye tek `warning`, kart
 *                  çizilmez, oyun ekranı "hazırlanıyor" der, ask Spotlight'ı
 *                  beklemeden çalışır.
 *   - diğer her hata → eskisi gibi Sentry + throw (askCoordinator'da `fatal`).
 *
 * Saf: React Native / supabase bağımlılığı yok (Deno testli:
 * `tests/games/puzzleAvailability.test.ts`).
 */

export const NO_PUZZLE_CODE = 'NO_PUZZLE'

/** Bugün bu oyun için bulmaca yok (sunucu `404 NO_PUZZLE`). */
export class PuzzleUnavailableError extends Error {
  readonly gameId: string
  readonly puzzleDate: string

  constructor(gameId: string, puzzleDate: string) {
    super(`${gameId} bulmacası yok: ${puzzleDate}`)
    this.name = 'PuzzleUnavailableError'
    this.gameId = gameId
    this.puzzleDate = puzzleDate
  }
}

/**
 * Edge Function yanıtı NO_PUZZLE mı. YALNIZ 404 + gövdede `error:
 * 'NO_PUZZLE'` — başka bir 404 (yanlış route, eksik deploy) ya da gövdesi
 * okunamayan yanıt NO_PUZZLE SAYILMAZ, gerçek hata yoluna düşer.
 */
export function isNoPuzzleResponse(status: number | null | undefined, body: unknown): boolean {
  if (status !== 404) return false
  if (typeof body !== 'object' || body === null) return false
  return (body as { error?: unknown }).error === NO_PUZZLE_CODE
}

/**
 * `instanceof` + `name` birlikte: Babel'in `extends Error` dönüşümü bazı
 * ortamlarda prototip zincirini koparır, `instanceof` false döner.
 */
export function isPuzzleUnavailableError(err: unknown): err is PuzzleUnavailableError {
  return (
    err instanceof PuzzleUnavailableError ||
    (err instanceof Error && err.name === 'PuzzleUnavailableError')
  )
}
