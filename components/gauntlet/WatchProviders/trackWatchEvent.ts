/**
 * Sağlayıcı sheet olayları için tek gönderim noktası. `trackMoodEvent` ile aynı kural:
 * serbest metin taşıyan olay ATILMAZ, Sentry'ye gider (kodlama hatası).
 * Günlük gauntlet ve film detayı Mood Gauntlet hook'unu import etmesin diye ayrı dosya.
 */
import { posthogAnalytics } from '@/services/posthog';
import { logger } from '@/utils/logger';
import { assertNoFreeText, type MoodEvent } from '@/utils/moodGauntletAnalytics';

export function trackWatchEvent(ev: MoodEvent): void {
  try {
    assertNoFreeText(ev);
  } catch (err) {
    logger.error('[watchProviders] analitik olayi serbest metin tasiyor', err, { code: 'WATCH_EVENT_FREE_TEXT' });
    return;
  }
  posthogAnalytics.track(ev.name, ev.props);
}
