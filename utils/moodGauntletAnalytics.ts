/**
 * Mood Gauntlet PostHog olayları (Faz 2-1) — saf yapıcılar, RN/PostHog yok.
 *
 * KURAL: ham mood metni ve ondan türeyen serbest metin (profil adı, gerekçe, film başlığı)
 * ASLA bir olaya girmez. Yalnız kimlikler, sayılar ve sabit etiketler. Gönderim anında
 * `assertNoFreeText` ile de savunulur (tests/moodgauntlet/analyticsPrivacy.test.ts).
 *
 * NOT: `gauntlet_completed` (North Star, günlük ritüel) ile KARIŞMAMAK için mood olayları
 * `mood_` önekini taşır.
 */

export type MoodEntryKind = 'quick' | 'free_text';
export type MoodPickAction = 'watch_now' | 'where' | 'later' | 'share';
export type MoodIntensity = 'lighter' | 'stronger';

type Props = Record<string, string | number | boolean | null>;

export interface MoodEvent {
  name: string;
  props: Props;
}

export const MOOD_GAUNTLET_EVENT_NAMES = [
  'mood_gauntlet_started',
  'mood_first_four_visible',
  'mood_match_chosen',
  'mood_none_of_these_tapped',
  'mood_gauntlet_completed',
  'mood_tonight_pick_action',
  'mood_another_four_tapped',
  'mood_intensity_tapped',
  'mood_pipeline_fallback',
  'mood_pipeline_timing',
  'mood_just_pick_tapped',
  'trailer_clicked',
  'app_returned_after_trailer',
] as const;

export function startedEvent(entry: MoodEntryKind, quickMoodId?: string | null): MoodEvent {
  return {
    name: 'mood_gauntlet_started',
    props: { entry, ...(entry === 'quick' && quickMoodId ? { quick_mood_id: quickMoodId } : {}) },
  };
}

/** Dörtlü hangi yoldan geldi: tek istek (`mood-four`) ya da eski 2 çağrılı yol. */
export type MoodFourPath = 'combined' | 'legacy';

/** Faz 2-3: `entry` (quick | free_text) ve `path` ayrımı eklendi; ms/cache_hit aynen. */
export function firstFourVisibleEvent(
  ms: number,
  cacheHit: boolean,
  entry: MoodEntryKind,
  path: MoodFourPath,
): MoodEvent {
  return { name: 'mood_first_four_visible', props: { ms: Math.max(0, Math.round(ms)), cache_hit: cacheHit, entry, path } };
}

export function justPickEvent(round: 1 | 2 | 3): MoodEvent {
  return { name: 'mood_just_pick_tapped', props: { round } };
}

export function matchChosenEvent(round: 1 | 2 | 3): MoodEvent {
  return { name: 'mood_match_chosen', props: { round } };
}

export function noneOfTheseEvent(round: 1 | 2 | 3): MoodEvent {
  return { name: 'mood_none_of_these_tapped', props: { round } };
}

export function completedEvent(msTotal: number): MoodEvent {
  return { name: 'mood_gauntlet_completed', props: { ms_total: Math.max(0, Math.round(msTotal)) } };
}

export type WatchOfferType = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';
export type WatchLinkKindProp = 'justwatch' | 'tmdb_watch' | 'provider_direct' | 'detail';

/** Yalnız watch_now: seçilen sağlayıcı, teklif türü ve bağlantı türü. */
export interface WatchNowProps {
  providerId: number | null;
  offerType: WatchOfferType | null;
  linkKind: WatchLinkKindProp;
}

/** `providerFound` yalnız watch_now için verilir: bölgede sağlayıcı bulundu mu. */
export function pickActionEvent(action: MoodPickAction, providerFound?: boolean, watch?: WatchNowProps): MoodEvent {
  return {
    name: 'mood_tonight_pick_action',
    props: {
      action,
      ...(providerFound === undefined ? {} : { provider_found: providerFound }),
      ...(watch === undefined
        ? {}
        : { provider_id: watch.providerId, offer_type: watch.offerType, link_kind: watch.linkKind }),
    },
  };
}

export function anotherFourEvent(): MoodEvent {
  return { name: 'mood_another_four_tapped', props: {} };
}

export function intensityEvent(direction: MoodIntensity): MoodEvent {
  return { name: 'mood_intensity_tapped', props: { direction } };
}

export function pipelineFallbackEvent(stage: string): MoodEvent {
  return { name: 'mood_pipeline_fallback', props: { stage } };
}

/** Aşama süresi (parse | v4 | pick | reasons) — yalnız sabit etiket + ms, metin yok. */
export type MoodTimingStage = 'parse' | 'exclusions' | 'v4' | 'pick' | 'four' | 'reasons';
export function pipelineTimingEvent(stage: MoodTimingStage, ms: number): MoodEvent {
  return { name: 'mood_pipeline_timing', props: { stage, ms: Math.max(0, Math.round(ms)) } };
}

/**
 * Faz 2-4: CTA dış bağlantıyı açtığında. Yalnız kimlik / sabit etiket / ülke kodu — başlık YOK.
 * `region` ISO alpha-2 (ya da bölge yoksa null).
 */
export const PROVIDER_EVENT_NAMES = ['provider_clicked', 'app_returned_after_provider'] as const;

export function providerClickedEvent(p: {
  providerId: number;
  offerType: WatchOfferType | null;
  region: string | null;
  linkKind: WatchLinkKindProp;
}): MoodEvent {
  return {
    name: 'provider_clicked',
    props: { provider_id: p.providerId, offer_type: p.offerType, region: p.region, link_kind: p.linkKind },
  };
}

/** Dış uygulamadan dönüş (30 dk penceresi içinde). */
export function appReturnedAfterProviderEvent(secondsAway: number): MoodEvent {
  return { name: 'app_returned_after_provider', props: { seconds_away: Math.max(0, Math.round(secondsAway)) } };
}

/** Fragman düğmesi (Faz 2-4d). film_id UUID'dir (serbest metin değil); başlık ASLA girmez. */
export function trailerClickedEvent(a: {
  filmId: string;
  setIndex: number;
  hasProviderCta: boolean;
  lang: string;
}): MoodEvent {
  return {
    name: 'trailer_clicked',
    props: {
      film_id: a.filmId,
      surface: 'mood_result',
      set_index: a.setIndex,
      has_provider_cta: a.hasProviderCta,
      lang: a.lang,
    },
  };
}

export function returnedAfterTrailerEvent(secondsAway: number): MoodEvent {
  return { name: 'app_returned_after_trailer', props: { seconds_away: Math.max(0, Math.round(secondsAway)) } };
}

/** İzin verilen string değerler (serbest metin değil, sabit etiketler). */
const ALLOWED_STRINGS = new Set<string>([
  'quick', 'free_text', 'watch_now', 'where', 'later', 'share', 'lighter', 'stronger',
  'rerank', 'genres_relaxed', 'similarity_relaxed', 'max_runtime_dropped', 'record_ids', 'reasons', 'mood_four',
  'parse', 'v4', 'pick', 'exclusions', 'four',
  'combined', 'legacy',
  'mood_result', 'en', 'tr',
  // watch_now: offer_type + link_kind
  'flatrate', 'free', 'ads', 'rent', 'buy', 'justwatch', 'tmdb_watch', 'provider_direct', 'detail',
  // quick_mood_id'ler (QUICK_MOOD_IDS)
  'rainy', 'mindbending', 'datenight', 'adrenaline', 'laugh', 'nostalgia', 'cozy', 'emotional',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gönderim öncesi savunma: serbest metin taşıyan string prop varsa hata (olay atılmaz). */
export function assertNoFreeText(ev: MoodEvent): void {
  for (const [k, v] of Object.entries(ev.props)) {
    // Ülke kodu: tam iki büyük harf (TR, US…). Başlık / metin bu kalıba giremez.
    if (k === 'region' && typeof v === 'string' && /^[A-Z]{2}$/.test(v)) continue;
    if (k === 'film_id' && typeof v === 'string' && UUID_RE.test(v)) continue;
    if (typeof v === 'string' && !ALLOWED_STRINGS.has(v)) {
      throw new Error(`mood olayi ${ev.name}.${k} serbest metin tasiyor`);
    }
  }
}
