/**
 * Uygulama içi değerlendirme istemi kararı — SAF fonksiyon (birim testli).
 *
 * Kural (B-211): en az 3 ayrı cycle gününde şampiyon seçildikten hemen sonra,
 * sürüm başına en çok bir kez, ilk oturumda asla, görünür bir paywall varken
 * asla, aynı cycle gününde ask koordinatörü (auth/bildirim) istemi gösterildiyse
 * asla. `dayCount` sunucu doğrulu şampiyon günü sayısıdır (`getChampionDatesSince`,
 * cycle `date` anahtarı) — cihaz takvim günü DEĞİL. `>=`: atlanan gün (ask
 * çakışması, kullanılamaz API) sonraki şampiyon gününde yeniden denenir; bayrak
 * yalnız gerçekten gösterilince yazılır.
 */

export const REVIEW_PROMPT_DAY = 3;

export type ReviewSkipReason =
  | 'not_enough_days'
  | 'ask_shown_today'
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
  /** Bu cycle gününde ask koordinatörü bir istem gösterdi (salt okunur). */
  askShownToday: boolean;
  appActive: boolean;
}

/** `null` → iste; değilse atlama nedeni. */
export function reviewSkipReason(input: ReviewInputs): ReviewSkipReason | null {
  if (input.isFirstSession) return 'first_session';
  if (input.paywallVisible) return 'paywall_visible';
  if (!input.appActive) return 'app_inactive';
  if (input.lastPromptedVersion === input.appVersion) return 'already_prompted_this_version';
  if (input.askShownToday) return 'ask_shown_today';
  if (input.dayCount < REVIEW_PROMPT_DAY) return 'not_enough_days';
  return null;
}
