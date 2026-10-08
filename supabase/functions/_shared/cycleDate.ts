/**
 * Cycle tarihi — günlük ritüelin sunucu otoriteli gün anahtarı (F1, CTO kararı).
 *
 * Cycle sınırı kullanıcının YEREL saatiyle 18:00'dir. `cycleDate` en son
 * geçilmiş yerel 18:00'in YEREL takvim tarihidir (YYYY-MM-DD):
 *   İstanbul 8 Eki 17:59 → 2026-10-07 · 18:00 → 2026-10-08 · 9 Eki 03:30 → 2026-10-08
 *
 * Bağımsız modül: yalnız `Intl` kullanır, import yok (Deno testi:
 * tests/gauntlet/cycleDate.test.ts). Sessiz fallback YOK — geçersiz tz'de
 * `RangeError` fırlatır; çağıran önce `isValidTimeZone` ile doğrular ve
 * `TZ_REQUIRED` döner.
 */

/** Ritüel kapısının yerel saati. İstemci `unlockClock.ts` `UNLOCK_HOUR` ile aynı. */
export const CYCLE_HOUR = 18

/** `users.timezone` kolonunun genişliği için makul üst sınır. */
const MAX_TIMEZONE_LENGTH = 64

const MS_PER_DAY = 86_400_000

/**
 * IANA saat dilimi adı doğrulaması.
 *
 * Sabit offset ("+03:00", "UTC+3") KASITLI OLARAK REDDEDİLİR: DST yalnızca
 * bölge adıyla çözülebilir. Regex tek başına yetmez (biçimi doğru, adı uydurma
 * değeri geçirir), `Intl` tek başına da yetmez ("UTC+3" gibi bazı offset
 * biçimlerini kabul eder) — ikisi birlikte.
 */
export function isValidTimeZone(v: unknown): v is string {
  if (typeof v !== 'string') return false
  if (v.length === 0 || v.length > MAX_TIMEZONE_LENGTH) return false
  // "Area/Location" (çok parçalı olabilir: "America/Argentina/Buenos_Aires").
  // "UTC" tek istisna — geçerli bir IANA adıdır.
  if (v !== 'UTC' && !/^[A-Za-z][A-Za-z0-9_-]*(\/[A-Za-z0-9_+-]+)+$/.test(v)) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: v })
    return true
  } catch {
    // RangeError = bölge adı bu runtime'ın IANA veritabanında yok; doğrulama
    // sonucu olarak false döner (boş catch değil).
    return false
  }
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
 * Dilim başına formatter. Kurulumu pahalıdır, çıktısı yalnız `tz`'ye bağlıdır
 * (config DEĞİL — saf hesap önbelleği).
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
  const out: Record<string, number> = {}
  for (const p of formatterFor(tz).formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    // Bazı ICU sürümleri gece yarısını "24" yazar; 0'a indirilir.
    hour: out.hour === 24 ? 0 : out.hour,
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

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

/** `YYYY-MM-DD` + n gün (takvim aritmetiği, UTC üzerinden — dilimden bağımsız). */
export function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new Error(`geçersiz tarih: ${date}`)
  return new Date(ms + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** `now`'ın `tz` dilimindeki YEREL takvim tarihi (YYYY-MM-DD). */
export function localDateString(tz: string, now: Date): string {
  const p = localParts(now, tz)
  return `${pad(p.year, 4)}-${pad(p.month, 2)}-${pad(p.day, 2)}`
}

/** `now` anında `tz` diliminde yerel saat `CYCLE_HOUR`'a ulaşıldı mı. */
export function isPastCycleHour(tz: string, now: Date): boolean {
  return localParts(now, tz).hour >= CYCLE_HOUR
}

/**
 * En son geçilmiş yerel 18:00'in yerel takvim tarihi.
 * Yerel saat ≥ 18 → bugünün yerel tarihi; < 18 → dünün yerel tarihi.
 */
export function cycleDate(tz: string, now: Date): string {
  const today = localDateString(tz, now)
  return isPastCycleHour(tz, now) ? today : addDays(today, -1)
}

/**
 * `tz` diliminde `YYYY-MM-DD` takvim gününün `hour`:00 duvar saatinin UTC anı (ms).
 * Duvar saatinden kurulur, milisaniye eklenerek DEĞİL: DST günlerinde iki yerel
 * 18:00 arası 23 ya da 25 saat olabilir. Offset o anın kendisinde ölçülür; geçiş
 * araya girerse ikinci iterasyon düzeltir.
 */
function zonedInstant(tz: string, date: string, hour: number): number {
  const [y, m, d] = date.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d, hour, 0, 0)
  const firstOffset = offsetMs(new Date(wall), tz)
  let instant = wall - firstOffset
  const secondOffset = offsetMs(new Date(instant), tz)
  if (secondOffset !== firstOffset) instant = wall - secondOffset
  return instant
}

/**
 * `now`'dan SONRAKİ ilk yerel 18:00, ISO 8601 UTC. Tam 18:00:00'da bir
 * sonraki günün 18:00'i döner (sınır dahil değil).
 */
export function nextCycleAt(tz: string, now: Date): string {
  const today = localDateString(tz, now)
  const targetDate = isPastCycleHour(tz, now) ? addDays(today, 1) : today
  return new Date(zonedInstant(tz, targetDate, CYCLE_HOUR)).toISOString()
}

/**
 * Bir cycle'ın BAŞLANGIÇ anı: `cycleDate`'in yerel 18:00'i, ISO 8601 UTC.
 * `cycleDate(tz, now)` yerel 18:00'i geçmiş en son günü verdiği için bu an her
 * zaman `now`'dan önce ya da ona eşittir.
 */
export function cycleStartAt(tz: string, cycleDateKey: string): string {
  return new Date(zonedInstant(tz, cycleDateKey, CYCLE_HOUR)).toISOString()
}

/**
 * "Dün izledin mi?" adayı için zaman kapısı: şampiyon, MEVCUT cycle başlamadan
 * ÖNCE seçilmiş olmalı (kesin küçük). Önceki cycle'ın oyunu 18:00'i geçip
 * 18:03'te bitmişse, 18:05'te gelen yüklemede o film "dün" sayılmaz — iki dakika
 * önce seçilen filmi sormak anlamsızdır. Okunamayan zaman `false` döner.
 */
export function chosenBeforeCycleStart(chosenAtIso: string, cycleStartIso: string): boolean {
  const chosen = Date.parse(chosenAtIso)
  const start = Date.parse(cycleStartIso)
  if (Number.isNaN(chosen) || Number.isNaN(start)) return false
  return chosen < start
}
