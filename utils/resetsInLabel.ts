/**
 * "3h 20m" / "20m" etiketi — hakkın yenilenmesine kalan süre (MONEY-1C).
 * `resetsAt` yoksa / geçmişse null: çağıran süresiz metni (`offerBody`) gösterir.
 */
import { resetsIn } from '@/utils/searchQuota';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function resetsInLabel(t: Translate, resetsAt: string | null, now: Date = new Date()): string | null {
  const left = resetsIn(resetsAt, now);
  if (!left) return null;
  return left.hours > 0
    ? t('moodOffer.timeHoursMinutes', { hours: left.hours, minutes: left.minutes })
    : t('moodOffer.timeMinutes', { minutes: left.minutes });
}
