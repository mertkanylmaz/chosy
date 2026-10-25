/**
 * Mood Search analitiği için ORTAK ÇEKİRDEK (MONEY-1C). Saf mantık — RN/PostHog yok.
 *
 * Çekirdek: search_id, entry_point, is_pro, consent. Kullanıcının yazdığı metin ve ondan
 * türeyen serbest metin ASLA taşınmaz (bkz. tests/moodoffer/analyticsPrivacy.test.ts).
 *
 * entry_point anlamı olaya göre: deste olaylarında aramanın girildiği yüzey
 * (`direct` | `champion_card` | `spotlight_card` | …); kilit/paywall olaylarında teklifin
 * giriş noktası (`lock_card` | `quota_exhausted` | …).
 */

export interface MoodEventCore {
  search_id: string | null
  entry_point: string | null
  is_pro: boolean
  /** AI rızası; arama bağlamı henüz kurulmadıysa null (tahmin edilmez). */
  consent: boolean | null
}

export function moodEventCore(input: {
  searchId: string | null | undefined
  entryPoint: string | null | undefined
  isPro: boolean
  consent: boolean | null
}): MoodEventCore {
  return {
    search_id: input.searchId ?? null,
    entry_point: input.entryPoint ?? null,
    is_pro: input.isPro,
    consent: input.consent,
  }
}

/** Deste gorunumu olayi: kurtarilan deste yeni arama sayilmaz (`mood_deck_started` sisirilmez). */
export function deckViewEventName(resumed: boolean): 'mood_deck_started' | 'mood_deck_resumed' {
  return resumed ? 'mood_deck_resumed' : 'mood_deck_started'
}

/** mood_deck_started'a giren sıralı film kimlikleri üst sınırı. */
export const DECK_STARTED_ID_LIMIT = 8

/** `film_ids`: sıra korunarak virgülle birleştirilmiş (PostHog `track` skaler değer ister). */
export function deckStartedProps(films: readonly { id: string }[]): {
  film_ids: string
  deck_size: number
} {
  return { film_ids: films.slice(0, DECK_STARTED_ID_LIMIT).map((f) => f.id).join(','), deck_size: films.length }
}

/**
 * Paywall olaylarına (paywall_viewed / paywall_plan_selected) çekirdek yalnız `mood_offer`
 * varyantında eklenir; diğer varyantlarda boş nesne (olay şekli değişmez).
 */
export function paywallMoodCore(
  trigger: { type: string; entry?: string; searchId?: string | null },
  ctx: { isPro: boolean; consent: boolean | null },
): Partial<MoodEventCore> {
  if (trigger.type !== 'mood_offer') return {}
  return moodEventCore({
    searchId: trigger.searchId,
    entryPoint: trigger.entry,
    isPro: ctx.isPro,
    consent: ctx.consent,
  })
}

/**
 * `paywall_plan_selected.source`: paywall'ın GERÇEK girişi. `mood_offer` → `entry`
 * (ortak çekirdekteki `entry_point` ile aynı değer); `profile_upgrade` → çağıranın verdiği
 * giriş (`profile_tab` | `pro_mode_locked`), yoksa varyant adı; diğerleri varyant adı.
 */
export function paywallSource(
  trigger: { type: string; entry?: string },
  variantName: string,
): string {
  if ((trigger.type === 'mood_offer' || trigger.type === 'profile_upgrade') && trigger.entry) {
    return trigger.entry
  }
  return variantName
}

/**
 * `mood_deck_unlocked` kararı: yalnız GERÇEKTEN kilitli bir deste, yetki geçişiyle açıldığında
 * ve bu `key` (search_id ya da yedek anahtar) için daha önce yayınlanmadıysa.
 */
export function shouldEmitDeckUnlocked(input: {
  prevKind: 'open' | 'pending' | 'locked' | null
  kind: 'open' | 'pending' | 'locked'
  entitled: boolean
  key: string
  emitted: ReadonlySet<string>
}): boolean {
  return (
    input.prevKind === 'locked' && input.kind === 'open' && input.entitled && !input.emitted.has(input.key)
  )
}
