/**
 * Mood Gauntlet sonuç ekranı: izleme bölümü modu (Faz 2-6). Saf, RN yok.
 *
 *  loading     → sağlayıcı verisi yükleniyor (sarı CTA yer tutucu, pasif)
 *  watch       → sarı "Where to watch" CTA (link_kind: provider_direct | justwatch | tmdb_watch)
 *  unavailable → seçili bölgede sağlayıcı yok: sarı CTA YOK, "Not streaming in {Country}" + Change,
 *                ana aksiyon beyaz "Save for later"
 *  hidden      → CTA yok, başka metin yok (hata / bölge yok / sağlayıcı var ama güvenilir adres yok);
 *                'detail' link_kind'ı CTA'dan KALDIRILDI — uygulama içi film sayfasına sessiz yönlendirme yok
 */
import type { WatchLinkKind } from './moodWatchTarget';

export type ResultCtaMode = 'loading' | 'watch' | 'unavailable' | 'hidden';

export function resultCtaMode(
  state: 'loading' | 'ok' | 'empty' | 'error' | 'noRegion',
  target: { kind: WatchLinkKind; providerFound: boolean },
): ResultCtaMode {
  if (state === 'loading') return 'loading';
  if (state === 'empty' || (state === 'ok' && !target.providerFound)) return 'unavailable';
  if (target.kind === 'provider_direct' || target.kind === 'justwatch' || target.kind === 'tmdb_watch') return 'watch';
  return 'hidden';
}

/** CTA altındaki varış satırı (i18n anahtarı); provider_direct → satır yok. */
export function destinationCaptionKey(kind: WatchLinkKind): 'moodGauntlet.opensJustWatch' | 'moodGauntlet.opensTmdb' | null {
  if (kind === 'justwatch') return 'moodGauntlet.opensJustWatch';
  if (kind === 'tmdb_watch') return 'moodGauntlet.opensTmdb';
  return null;
}
