/**
 * Mood destesi kilidi (MONEY-1C). Saf mantık — React/RN yok.
 *
 * Ücretsiz kullanıcı destenin ilk `freeVisible` filmini görür; kalan filmler "kilit"
 * kartının arkasındadır. Kilit TÜRETİLMİŞ bir değerdir (dinleyici/olay yok): girdi
 * değişince (premiumStatus dahil) sonuç kendiliğinden değişir.
 *
 * Gizli filmlerin posteri hiçbir koşulda çizilmez/önceden yüklenmez: `buildDeckItems`
 * gizli filmleri listeye HİÇ koymaz, `hidesBeyondFree` ise prefetch katmanlarına
 * "burada dur" sınırını verir.
 */

export const DEFAULT_FREE_VISIBLE_COUNT = 3
export const MIN_FREE_VISIBLE_COUNT = 1
export const MAX_FREE_VISIBLE_COUNT = 8
/** Kilit kartı yalnız en az bu kadar film gizliyorsa gösterilir (1 film için kilit anlamsız). */
export const MIN_HIDDEN_FOR_LOCK = 2

/** `app_config.free_visible_count` ham değerini güvenli tam sayıya çevirir (sayı dışı → varsayılan). */
export function clampFreeVisibleCount(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_FREE_VISIBLE_COUNT
  return Math.min(MAX_FREE_VISIBLE_COUNT, Math.max(MIN_FREE_VISIBLE_COUNT, Math.floor(raw)))
}

export type LockState =
  /** Deste tamamen açık. */
  | { kind: 'open' }
  /** Yetki okunuyor: kilit değil, kilit yerinde iskelet. */
  | { kind: 'pending'; visible: number; total: number; hidden: number }
  | { kind: 'locked'; visible: number; total: number; hidden: number }

export function deriveLockState(input: {
  offerEnabled: boolean
  isOnboarding: boolean
  /** premiumStatus veya yetki okuması sürüyor. */
  accessLoading: boolean
  /** premium / trial / legacy — kilitten muaf. */
  entitled: boolean
  /** Kalite süzgecinden sonraki GERÇEK deste uzunluğu. */
  total: number
  freeVisible: number
}): LockState {
  const { offerEnabled, isOnboarding, accessLoading, entitled, total, freeVisible } = input
  if (!offerEnabled || isOnboarding) return { kind: 'open' }
  const hidden = total - freeVisible
  if (hidden < MIN_HIDDEN_FOR_LOCK) return { kind: 'open' }
  if (accessLoading) return { kind: 'pending', visible: freeVisible, total, hidden }
  if (entitled) return { kind: 'open' }
  return { kind: 'locked', visible: freeVisible, total, hidden }
}

/**
 * Yetkisiz kullanıcıda gizli film olabilir mi? Prefetch katmanları için SINIR kararı:
 * yetki OKUNURKEN de true (entitled henüz false) — gizli poster indirilmez.
 */
export function hidesBeyondFree(input: {
  offerEnabled: boolean
  isOnboarding: boolean
  entitled: boolean
}): boolean {
  return input.offerEnabled && !input.isOnboarding && !input.entitled
}

export type DeckItem<T> =
  | { kind: 'film'; film: T }
  | { kind: 'lock'; visible: number; total: number }
  | { kind: 'skeleton' }

export function buildDeckItems<T>(deck: readonly T[], lock: LockState): DeckItem<T>[] {
  if (lock.kind === 'open') return deck.map((film) => ({ kind: 'film', film }))
  const films: DeckItem<T>[] = deck.slice(0, lock.visible).map((film) => ({ kind: 'film', film }))
  films.push(lock.kind === 'locked' ? { kind: 'lock', visible: lock.visible, total: lock.total } : { kind: 'skeleton' })
  return films
}

/** Sayaç: kilitte donar (`visible / total`), açıkta kart sırası. */
export function progressCounter(input: { currentIndex: number; total: number; lock: LockState }): {
  current: number
  total: number
} {
  const { currentIndex, total, lock } = input
  const current = lock.kind === 'open' ? currentIndex + 1 : Math.min(currentIndex + 1, lock.visible)
  return { current: Math.min(current, total), total }
}
