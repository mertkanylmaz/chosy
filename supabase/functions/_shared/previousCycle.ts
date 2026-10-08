/**
 * E-21 — Yeni kullanıcıya önceki döngü (27 Eyl 2026).
 *
 * Sıfır kişisel `daily_gauntlets` satırı olan kullanıcı 18:00 öncesi açarsa
 * ETKİN döngünün (son yerel 18:00'de açılmışın) gauntlet'ini alır. Bu modül
 * kararın SAF kısmıdır — DB'ye ve saate kendisi bakmaz; `generate-gauntlet`
 * ve `get-archive-status` `Deno.serve` içerdiği için import edilemez, test
 * edilebilir yüzey burada yaşar (`editorialCalendar.ts` ile aynı gerekçe).
 *
 * ── Anahtar tanımı (F1: cycle tarihi) ───────────────────────────────────────
 * Anahtar `_shared/cycleDate.ts` `cycleDate` ile AYNI tanımdır: en son
 * geçilmiş yerel 18:00'in YEREL takvim tarihi. Kapı kapalıyken (yerel < 18:00)
 * bu, dünün yerel tarihidir ve etkin döngünün anahtarıdır. Kapı açıkken
 * `key` yine "dün"dür (sabah başlamış önceki döngü oyununun sürdürülmesine
 * hizmet eder; yeni üretim YAPILMAZ) — `cycleDate` ise bugündür.
 * Kaynak isteğin `timezone` alanı, `users.timezone` kolonu DEĞİL.
 *
 * Normal akışın anahtarı da artık `cycleDate`'tir; ikisi aynı takvimde
 * yaşadığı için eski UTC döneminin "yaz saati günü çakışması" (iki yerel 18:00
 * aynı UTC gününe düşebiliyordu) artık oluşamaz: `key` her zaman bu akşamın
 * anahtarından (`nextKey`) bir gün öncedir.
 */

import { addDays, isPastCycleHour, localDateString } from './cycleDate.ts'
import type { PreviousCycleRejectCode } from '../../../types/gauntlet.ts'

export { addDays }

/**
 * Ritüel kapısının yerel saati. İstemcideki `UNLOCK_HOUR`
 * (`components/gauntlet/GauntletShell/unlockClock.ts`) ile aynı değer — ikisi de
 * `app_config`'e taşınmayı bekleyen aynı teknik borç.
 */
export const UNLOCK_HOUR = 18

export interface PreviousCycleResolution {
  /** Dünün yerel takvim tarihi — önceki döngünün anahtarı. */
  key: string
  /** Bugünün yerel takvim tarihi — bu akşamın (normal akış) döngüsü. */
  nextKey: string
  /** Yerel saat ≥ 18:00 — kapı açık, yeni önceki döngü üretilmez. */
  afterUnlock: boolean
}

export type PreviousCycleDecision =
  | { kind: 'generate' }
  | { kind: 'serve'; rowId: string }
  | { kind: 'reject'; code: PreviousCycleRejectCode; reason: RejectReason }

export type RejectReason =
  | 'has_rows'
  | 'gate_open'
  | 'before_launch'

/** Kullanıcının kişisel satırlarından karar için gereken asgari alanlar. */
export interface PersonalRowRef {
  id: string
  date: string
  cycle: string
}

export function resolvePreviousCycle(now: Date, tz: string): PreviousCycleResolution {
  const today = localDateString(tz, now)
  return {
    key: addDays(today, -1),
    nextKey: today,
    afterUnlock: isPastCycleHour(tz, now),
  }
}

/**
 * Uygunluk kararı (E-21). Sıra önemlidir:
 *
 * 1. Tam bir satır, kendi önceki döngü satırı, aynı anahtar → sürdür
 *    (idempotent; yarım oyun kaldığı yerden — kapı açılmış olsa bile).
 * 2. Başka herhangi bir satır → NOT_ELIGIBLE (ikinci önceki döngü yok; mevcut
 *    kullanıcı dünkü yarım oyununu sabah sürdüremez).
 * 3. Kapı açık → OUT_OF_WINDOW: etkin döngü bugünkü, normal akış geçerli.
 *    Sunucu previous isteğine ASLA current gauntlet döndürmez — istemci
 *    hangi döngünün geldiğini yanıt şeklinden ayıramaz.
 * 4. Anahtar `launch_date`'ten önce → OUT_OF_WINDOW (`editorialDayNumber < 1`;
 *    o fonksiyon `<1` ve `>100`'ü aynı `null`'a indirdiği için ayrı bakılır).
 * 5. Aksi → üret.
 *
 * `rows` en fazla 2 satırla sınırlı sorgudan gelir; 2+ satır her zaman ret.
 */
export function decidePreviousCycle(
  rows: PersonalRowRef[],
  resolution: PreviousCycleResolution,
  launchDate: string,
): PreviousCycleDecision {
  const { key } = resolution
  if (rows.length === 1 && rows[0].cycle === 'previous' && rows[0].date === key) {
    return { kind: 'serve', rowId: rows[0].id }
  }
  if (rows.length > 0) {
    return { kind: 'reject', code: 'PREVIOUS_CYCLE_NOT_ELIGIBLE', reason: 'has_rows' }
  }
  if (resolution.afterUnlock) {
    return { kind: 'reject', code: 'PREVIOUS_CYCLE_OUT_OF_WINDOW', reason: 'gate_open' }
  }
  if (key < launchDate) {
    return { kind: 'reject', code: 'PREVIOUS_CYCLE_OUT_OF_WINDOW', reason: 'before_launch' }
  }
  return { kind: 'generate' }
}

/**
 * Arşiv anchor'ı (K-46). Önceki döngü satırı ne kaçırma ne tamamlama sayılır:
 * kullanıcının ilk GERÇEK döngüsü o satırın ertesi günüdür. Satır yoksa null.
 */
export function effectiveArchiveAnchor(
  rows: { date: string; cycle: string }[],
): string | null {
  let anchor: string | null = null
  for (const row of rows) {
    const candidate = row.cycle === 'previous' ? addDays(row.date, 1) : row.date
    if (anchor === null || candidate < anchor) anchor = candidate
  }
  return anchor
}
