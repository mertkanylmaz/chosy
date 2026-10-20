/**
 * Uygulama içi değerlendirme istemi kararı — SAF fonksiyon (birim testli).
 *
 * Kural (B-211): 3. ayrı cycle gününde şampiyon seçildikten hemen sonra, sürüm
 * başına en çok bir kez, ilk oturumda asla, görünür bir paywall varken asla.
 * `dayCount` sunucu doğrulu şampiyon günü sayısıdır (`getChampionDatesSince`,
 * cycle `date` anahtarı) — cihaz takvim günü DEĞİL. `===` bilinçlidir: 3.
 * günden sonra yeniden denemek, güncelleme sonrası mevcut kullanıcıların hepsini
 * ilk şampiyonda istemle karşılardı (Apple yıllık istem kotası düşük).
 */

export const REVIEW_PROMPT_DAY = 3;

export type ReviewSkipReason =
  | 'not_third_day'
  | 'already_prompted_this_version'
  | 'first_session'
  | 'paywall_visible'
  | 'app_inactive';

export interface ReviewInputs {
  /** Şampiyon seçilmiş ayrı cycle günü sayısı (bugün dahil). */
  dayCount: number;
  appVersion: string;
  /** Son istemin yapıldığı sürüm; hiç yapılmadıysa null. */
  lastPromptedVersion: string | null;
  /** Bu süreçte `first_open` çıktı → kurulumun ilk oturumu. */
  isFirstSession: boolean;
  paywallVisible: boolean;
  appActive: boolean;
}

/** `null` → iste; değilse atlama nedeni. */
export function reviewSkipReason(input: ReviewInputs): ReviewSkipReason | null {
  if (input.isFirstSession) return 'first_session';
  if (input.paywallVisible) return 'paywall_visible';
  if (!input.appActive) return 'app_inactive';
  if (input.lastPromptedVersion === input.appVersion) return 'already_prompted_this_version';
  if (input.dayCount !== REVIEW_PROMPT_DAY) return 'not_third_day';
  return null;
}
