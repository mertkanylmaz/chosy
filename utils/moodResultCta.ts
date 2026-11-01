/**
 * Mood Gauntlet sonuç ekranı: izleme bölümü modu (Faz 2-6 → Faz 2-8). Saf, RN yok.
 *
 *  loading     → sağlayıcı verisi yükleniyor (sarı CTA yer tutucu, pasif)
 *  watch       → sarı "Where to watch" CTA; uygulama içi sheet açar. Veri `error` ise de görünür:
 *                sheet "yüklenemedi + tekrar dene" gösterir (asla "yayında değil" demez)
 *  unavailable → seçili bölgede sağlayıcı yok (veri GELDİ, liste boş): sarı CTA YOK,
 *                "Not streaming in {Country}" + Change, ana aksiyon beyaz "Save for later"
 *  hidden      → bölge okunamadı: CTA yok (sorulacak katalog yok)
 */
export type ResultCtaMode = 'loading' | 'watch' | 'unavailable' | 'hidden';

export function resultCtaMode(
  state: 'loading' | 'ok' | 'empty' | 'error' | 'noRegion',
  target: { providerFound: boolean },
): ResultCtaMode {
  if (state === 'loading') return 'loading';
  if (state === 'empty' || (state === 'ok' && !target.providerFound)) return 'unavailable';
  if (state === 'noRegion') return 'hidden';
  return 'watch';
}
