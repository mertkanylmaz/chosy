/**
 * E-21 — Yeni kullanıcıya önceki döngü (27 Eyl 2026).
 *
 * Sıfır kişisel `daily_gauntlets` satırı olan kullanıcı 18:00 öncesi açarsa
 * ETKİN döngünün (son yerel 18:00'de açılmışın) gauntlet'ini alır. Bu modül
 * kararın SAF kısmıdır — DB'ye ve saate kendisi bakmaz; `generate-gauntlet`
 * ve `get-archive-status` `Deno.serve` içerdiği için import edilemez, test
 * edilebilir yüzey burada yaşar (`editorialCalendar.ts` ile aynı gerekçe).
 *
 * ── Anahtar tanımı ─────────────────────────────────────────────────────────
 * "DÜN yerel 18:00 anının UTC tarihi". Kapı kapalıyken (yerel < 18:00) bu,
 * etkin döngünün anahtarıdır. Kapı açıkken aynı anahtar, sabah başlamış önceki
 * döngü oyununun sürdürülmesine (E-21 "oyun bitmesine izin verilir") hizmet
 * eder; yeni üretim YAPILMAZ.
 * Kaynak isteğin `timezone` alanı, `users.timezone` kolonu DEĞİL (12/270).
 * "Önceki UTC günü" tanımı YANLIŞTIR: İstanbul'da 00:00–03:00 iki gün geri
 * düşer, UTC− bölgelerde anahtar yerel tarihin önündedir.
 *
 * ── Çakışma ────────────────────────────────────────────────────────────────
 * Normal akışın anahtarı hâlâ `utcDateString()` (M2 Faz 2b ertelendi). İki
 * yerel 18:00 arası 23 saate indiğinde (yaz saatine geçiş günü) ikisi AYNI UTC
 * gününe düşebilir — ölçüldü: America/Chicago 2027-03-14. O gün önceki döngü
 * satırı açılırsa 18:00'de idempotency onu döner ve kullanıcı o akşamki
 * gauntlet'i alamaz. Bu yüzden çakışma AÇIKÇA reddedilir (`collides`).
 */

import type { PreviousCycleRejectCode } from '../../../types/gauntlet.ts'

/**
 * Ritüel kapısının yerel saati. İstemcideki `UNLOCK_HOUR`
 * (`components/gauntlet/GauntletShell/index.tsx`) ile aynı değer — ikisi de
 * `app_config`'e taşınmayı bekleyen aynı teknik borç.
 */
export const UNLOCK_HOUR = 18

const MS_PER_DAY = 86_400_000

export interface PreviousCycleResolution {
  /** Dün yerel 18:00'in UTC tarihi. */
  key: string
  /** Bugün yerel 18:00'in UTC tarihi — bu akşamın (normal akış) döngüsü. */
  nextKey: string
  /** Yerel saat ≥ 18:00 — kapı açık, yeni önceki döngü üretilmez. */
  afterUnlock: boolean
  /** `key === nextKey` (DST günü) — önceki döngü bu akşamı gölgelerdi. */
  collides: boolean
}

export type PreviousCycleDecision =
  | { kind: 'generate' }
  | { kind: 'serve'; rowId: string }
  | { kind: 'reject'; code: PreviousCycleRejectCode; reason: RejectReason }

export type RejectReason =
  | 'has_rows'
  | 'dst_collision'
  | 'gate_open'
  | 'before_launch'

/** Kullanıcının kişisel satırlarından karar için gereken asgari alanlar. */
export interface PersonalRowRef {
  id: string
  date: string
  cycle: string
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/**
 * Dilim başına formatter. Kurulumu pahalıdır ve çıktısı yalnız `tz`'ye
 * bağlıdır (config DEĞİL — CLAUDE.md #6 kapsamı dışında, saf hesap önbelleği).
 */
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(tz: string): Intl.DateTimeFormat {
  let fmt = formatters.get(tz)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(tz, fmt)
  }
  return fmt
}

/** `instant` anının `tz` dilimindeki duvar saati. Geçersiz tz → RangeError. */
function localParts(instant: Date, tz: string): LocalParts {
  const fmt = formatterFor(tz)
  const out: Record<string, number> = {}
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    second: out.second,
  }
}

/** `tz`'nin `instant` anındaki UTC farkı (ms): yerel duvar saati − UTC. */
function offsetMs(instant: Date, tz: string): number {
  const p = localParts(instant, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * Yerel (yıl, ay, gün + dayOffset, saat:00) anının UTC tarihi. Offset o anın
 * kendisinde ölçülür; DST geçişi araya girerse ikinci iterasyon düzeltir.
 */
function utcDateOfLocal(
  local: LocalParts,
  dayOffset: number,
  hour: number,
  tz: string,
): string {
  const wall = Date.UTC(local.year, local.month - 1, local.day + dayOffset, hour, 0, 0)
  const firstOffset = offsetMs(new Date(wall), tz)
  let instant = wall - firstOffset
  const secondOffset = offsetMs(new Date(instant), tz)
  if (secondOffset !== firstOffset) instant = wall - secondOffset
  return new Date(instant).toISOString().slice(0, 10)
}

export function resolvePreviousCycle(
  now: Date,
  tz: string,
  unlockHour: number = UNLOCK_HOUR,
): PreviousCycleResolution {
  const local = localParts(now, tz)
  const key = utcDateOfLocal(local, -1, unlockHour, tz)
  const nextKey = utcDateOfLocal(local, 0, unlockHour, tz)
  return {
    key,
    nextKey,
    afterUnlock: local.hour >= unlockHour,
    collides: key === nextKey,
  }
}

/**
 * Uygunluk kararı (E-21). Sıra önemlidir:
 *
 * 1. DST çakışması → OUT_OF_WINDOW (satır açılırsa bu akşam kaybolurdu).
 * 2. Tam bir satır, kendi önceki döngü satırı, aynı anahtar → sürdür
 *    (idempotent; yarım oyun kaldığı yerden — kapı açılmış olsa bile).
 * 3. Başka herhangi bir satır → NOT_ELIGIBLE (ikinci önceki döngü yok; mevcut
 *    kullanıcı dünkü yarım oyununu sabah sürdüremez).
 * 4. Kapı açık → OUT_OF_WINDOW: etkin döngü bugünkü, normal akış geçerli.
 *    Sunucu previous isteğine ASLA current gauntlet döndürmez — istemci
 *    hangi döngünün geldiğini yanıt şeklinden ayıramaz.
 * 5. Anahtar `launch_date`'ten önce → OUT_OF_WINDOW (`editorialDayNumber < 1`;
 *    o fonksiyon `<1` ve `>100`'ü aynı `null`'a indirdiği için ayrı bakılır).
 * 6. Aksi → üret.
 *
 * `rows` en fazla 2 satırla sınırlı sorgudan gelir; 2+ satır her zaman ret.
 */
export function decidePreviousCycle(
  rows: PersonalRowRef[],
  resolution: PreviousCycleResolution,
  launchDate: string,
): PreviousCycleDecision {
  const { key } = resolution
  if (resolution.collides) {
    return { kind: 'reject', code: 'PREVIOUS_CYCLE_OUT_OF_WINDOW', reason: 'dst_collision' }
  }
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

/** `YYYY-MM-DD` + n gün (UTC takvimi). */
export function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new Error(`geçersiz tarih: ${date}`)
  return new Date(ms + days * MS_PER_DAY).toISOString().slice(0, 10)
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
