/**
 * Mood Search teklifi (PaywallMoodOffer) giriş noktasına göre başlık kopyası (MONEY-1C).
 *
 * Kopyada "ücretsiz deneme" vaadi YOKTUR: deneme metni yalnız `buildOffer` +
 * `getTrialEligibility` ile, uygun kullanıcıya PaywallBase'in plan kartında çıkar.
 */
import type { MoodOfferEntry } from '../services/conversion/types';

export function moodOfferTitleKey(entry: MoodOfferEntry): string {
  switch (entry) {
    case 'quota_exhausted':
      return 'moodOffer.paywallTitleQuota';
    case 'lock_card':
    case 'champion_card':
    case 'spotlight_card':
      return 'moodOffer.paywallTitleDeck';
  }
}
