/**
 * Watch feedback → `watchlist.watched_at` köprüsü (K-29).
 *
 * `submit-watch-feedback/index.ts` `Deno.serve` içerdiği için import
 * edilemez; test edilebilir yüzey burada yaşar (`editorialCalendar.ts` ile
 * aynı gerekçe).
 *
 * ── K-29 atomiklik boşluğu (Karar 6b, 2 Eki 2026) ───────────────────────────
 * `watch_feedback` INSERT'i ile `markWatched` iki ayrı yazımdır. INSERT
 * başarılı olup `markWatched` hata verirse istemci 503 alır ve yeniden dener;
 * yeniden deneme `already_answered` dalına düşer ve eskiden `markWatched` HİÇ
 * çağrılmazdı — `loved`/`ok`/`abandoned` cevabı kalıcı olarak `watched_at`
 * yazmadan kalırdı. Artık her iki dal da bu fonksiyonu çağırır; `markWatched`
 * idempotent olduğu için (`watched_at` doluysa dokunmaz) tekrar çağrı
 * zararsızdır.
 */

import { markWatched } from './gauntletCore.ts'
import type { WatchFeedbackResponse } from '../../../types/gauntlet.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/** `watchlist.watched_at`'i dolduran response'lar (CTO kararı, C.4 / K-29). */
export const WATCHLIST_RESPONSES: ReadonlySet<WatchFeedbackResponse> = new Set([
  'loved',
  'ok',
  'disliked',
  'abandoned',
])

/**
 * Kayıtlı (ya da yeni yazılan) cevap izlemeyi ifade ediyorsa filmi izlenmiş
 * işaretler. `already_answered` dalında İSTEKTEKİ değil KAYITLI cevap
 * verilmelidir — gerçek olan odur.
 *
 * @returns `markWatched` çağrıldıysa true.
 */
export async function syncWatchedFromFeedback(
  service: SupabaseClient,
  appUserId: string,
  filmId: string,
  response: WatchFeedbackResponse,
): Promise<boolean> {
  if (!WATCHLIST_RESPONSES.has(response)) return false
  await markWatched(service, appUserId, filmId)
  return true
}
