/**
 * Bekleyiş ekranı Spotlight teaser'ının gösterim kuralları — P-5 (K-62).
 * Saf modül: React/RN import YOK (Deno testli: `tests/gauntlet/spotlightTeaser.test.ts`).
 *
 * İki aşama:
 *   1. `isTeaserSlotActive` — teaser'ın yeri var mı. Bu true değilse Spotlight
 *      durumu için AĞA ÇIKILMAZ (`useSpotlightCardState(enabled)`).
 *   2. `isTeaserVisible`    — okunan durumla birlikte çizilir mi.
 *
 * Gizlendiği her koşul:
 *   - ekran `before_18` değil (gauntlet sırası, champion, tükeniş, yükleme)
 *   - "Dün izledin mi?" kartı ekranda (bayrak değil, kartın GERÇEKTEN çizilme
 *     koşulu — `closePreviousCycle` bayrağı true bırakabiliyor)
 *   - Spotlight `games_enabled.games` listesinde yok ya da liste okunamadı
 *     (`null` → fail-closed; okuma hatası `remoteConfig`'te Sentry'ye yazıldı)
 *   - bugün bulmaca yok (`unavailable`), durum okunamadı (`error`) ya da
 *     henüz yükleniyor — teaser dokunulamaz, hatayı gösterebileceği yer yok
 *   - bugünün Spotlight'ı zaten başlamış ya da bitmiş: E-21 önceki döngü
 *     champion'ı 18:00'den önce açtırabiliyor, "dörtlünden sonra açılır"
 *     o durumda yanlış olurdu
 *   - kare yok (`backdropUrl` boş) — teaser'ın tek içeriği kare
 */
import type { SpotlightCardState } from '../SpotlightBonusCard/cardState';

export interface TeaserSlotInput {
  /** GauntletShell'in ShellState'i. */
  shellState: string;
  /** PendingWatchFeedbackCard şu an çiziliyor mu. */
  pendingFeedbackShown: boolean;
  /** `games_enabled.games` içinde `spotlight` var mı; `null` = henüz/okunamadı. */
  spotlightEnabled: boolean | null;
}

/** `useSpotlightCardState` dönüşünün teaser'ın baktığı kısmı (yapısal). */
export type TeaserSpotlightData =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'unavailable' }
  | { status: 'ready'; state: SpotlightCardState; backdropUrl: string };

export function isTeaserSlotActive(input: TeaserSlotInput): boolean {
  return (
    input.shellState === 'before_18' &&
    !input.pendingFeedbackShown &&
    input.spotlightEnabled === true
  );
}

export function isTeaserVisible(slot: TeaserSlotInput, data: TeaserSpotlightData): boolean {
  if (!isTeaserSlotActive(slot)) return false;
  if (data.status !== 'ready') return false;
  return data.state === 'not_started' && data.backdropUrl !== '';
}

/**
 * `spotlight_teaser_viewed` günde bir kez (yerel gün anahtarı). Kayıtlı gün
 * bugünden farklıysa (ya da hiç yoksa) ateşlenir.
 */
export function shouldTrackTeaserView(storedDay: string | null, today: string): boolean {
  return storedDay !== today;
}
