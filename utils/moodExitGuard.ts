/**
 * Desteden çıkış duraklatma koruyucusu (MONEY-1C). Saf mantık — React/RN yok.
 *
 * Teklif açılırken çıkış eylemi (`beforeRemove`) duraklatılır ve paywall kapanınca
 * sürdürülür. Bu nesne üç şeyi garanti eder:
 *   · duraklatma sürerken gelen İKİNCİ çıkış yok sayılır (`begin` false döner);
 *   · duraklatılan çıkış en fazla BİR kez sürdürülür (`release` idempotent);
 *   · ekran kaldırıldıktan sonra sürdürme çağrılmaz (çift pop / `dismissTo` yok).
 */
export interface ExitGuard {
  /** Duraklatılmış bir çıkış var mı. */
  isPending: () => boolean;
  /**
   * Çıkışı duraklatır. Zaten duraklatılmış bir çıkış varsa false döner ve YENİ
   * `resume` kaydedilmez (ikinci çıkış yok sayılır).
   */
  begin: (resume: () => void) => boolean;
  /**
   * Duraklatılmış çıkışı bırakır. Beklenen bir çıkış varsa true döner (tüketildi);
   * `resume` yalnız ekran hâlâ takılıysa çağrılır. Beklenen yoksa false, hiçbir şey olmaz.
   */
  release: () => boolean;
  /** Ekran takıldı (efekt kurulumu). */
  mount: () => void;
  /** Ekran kaldırıldı: bekleyen çıkış düşer, `release` artık `resume` çağırmaz. */
  unmount: () => void;
}

export function createExitGuard(): ExitGuard {
  let pending: (() => void) | null = null;
  let mounted = true;
  return {
    isPending: () => pending !== null,
    begin(resume) {
      if (pending) return false;
      pending = resume;
      return true;
    },
    release() {
      const resume = pending;
      pending = null;
      if (!resume) return false;
      if (mounted) resume();
      return true;
    },
    mount() {
      mounted = true;
    },
    unmount() {
      mounted = false;
      pending = null;
    },
  };
}

/**
 * Teklif yüzeyi (ContextualPaywall) bu render'da çizilebiliyor mu? `discover.tsx`
 * yalnız deste özeti ve ana deste dallarında paywall çizer; yükleniyor / hata / boş
 * dallarında çizmez. Orada çıkışta teklif harcanmamalı, çıkış normal geçmeli.
 */
export function isOfferSurfaceMounted(input: { deckComplete: boolean; deckLength: number }): boolean {
  return input.deckComplete || input.deckLength > 0;
}
