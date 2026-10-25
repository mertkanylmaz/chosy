/**
 * Bugünkü deste kurtarma anlık görüntüsü (MONEY-1C P0). Saf mantık — RN/AsyncStorage yok.
 *
 * YALNIZ CİHAZDA tutulur (AsyncStorage); sunucuya gitmez. Mood metni de yalnız burada kalır.
 * Anlık görüntü o ana kadar görünen sıralı desteyi (≤8 film) taşır; kilit durumu
 * premiumStatus'tan yeniden TÜRETİLİR (burada saklanmaz).
 */
import type { Film } from '../types/film'
import type { FilmFilters, TasteProfile } from '../types'

export const TODAY_DECK_MAX_FILMS = 8
export const TODAY_DECK_VERSION = 1

export interface TodayDeckSnapshot {
  v: typeof TODAY_DECK_VERSION
  /** Cihazın yerel takvim günü (YYYY-MM-DD). */
  localDate: string
  /** Hesap sahibi (public.users.id): hesap değişince başkasının destesi görünmesin. */
  ownerId: string
  searchId: string
  /** İstemci arama kimliği (idempotency, madde g); henüz yoksa null. */
  clientSearchId: string | null
  /** Yalnız cihazda; kart ve "son aramalar" eşlemesi için. */
  moodText: string
  profile: TasteProfile
  filters: FilmFilters
  /** Sıralı deste (≤8); sıra ve içerik gösterilenin aynısı. */
  films: Film[]
}

export function localDateKey(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function createTodayDeckSnapshot(input: {
  now: Date
  ownerId: string
  searchId: string
  clientSearchId?: string | null
  moodText: string
  profile: TasteProfile
  filters: FilmFilters
  films: readonly Film[]
}): TodayDeckSnapshot {
  return {
    v: TODAY_DECK_VERSION,
    localDate: localDateKey(input.now),
    ownerId: input.ownerId,
    searchId: input.searchId,
    clientSearchId: input.clientSearchId ?? null,
    moodText: input.moodText,
    profile: input.profile,
    filters: input.filters,
    films: input.films.slice(0, TODAY_DECK_MAX_FILMS),
  }
}

/**
 * Ham depolama değerini doğrular. Bugün olmayan, başka hesaba ait, bozuk ya da boş
 * deste `null` döner (çağıran bayatı siler). Şekil kontrolü kasıtlı dar: film kimlikleri
 * string, deste 1..8.
 */
export function parseTodayDeck(raw: string | null, today: string, ownerId: string): TodayDeckSnapshot | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const s = value as Partial<TodayDeckSnapshot>
  if (s.v !== TODAY_DECK_VERSION) return null
  if (s.localDate !== today || s.ownerId !== ownerId) return null
  if (typeof s.searchId !== 'string' || s.searchId.length === 0) return null
  if (typeof s.moodText !== 'string' || !s.profile || !s.filters) return null
  if (!Array.isArray(s.films) || s.films.length === 0 || s.films.length > TODAY_DECK_MAX_FILMS) return null
  if (!s.films.every((f) => f && typeof f.id === 'string' && typeof f.title === 'string')) return null
  return s as TodayDeckSnapshot
}

/** "Son aramalar" satırı bugünkü aramayla aynı mı (metin eşlemesi; ayrıca tarih bugün olmalı). */
export function isSameSearchText(snapshot: TodayDeckSnapshot, recentMoodText: string): boolean {
  return snapshot.moodText.trim() === recentMoodText.trim()
}
