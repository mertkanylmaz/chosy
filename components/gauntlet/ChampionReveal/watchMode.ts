/**
 * Home izleme modu — saf modül (RN yok, Deno okur). Home-A1.
 * `ok` ama hiç sağlayıcı yoksa `unavailable`; kalan eşleme Result ile aynı `resultCtaMode`.
 */
import { resultCtaMode, type ResultCtaMode } from '../../../utils/moodResultCta';
import { watchOptionCount } from '../../../utils/watchOptionsSummary';
import type { ProviderBuckets, RankedProviderLike } from '../../../utils/watchProviderList';

export function championWatchMode(
  state: 'loading' | 'ok' | 'empty' | 'error' | 'noRegion',
  providers: ProviderBuckets<RankedProviderLike> | null,
): ResultCtaMode {
  const providerFound = state === 'ok' && providers !== null && watchOptionCount(providers) > 0;
  return resultCtaMode(state, { providerFound });
}
