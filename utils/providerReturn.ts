/**
 * Sağlayıcıya geçiş → uygulamaya dönüş süresi (Faz 2-4). Saf: AppState / zaman dışarıdan gelir.
 *
 * CTA dış bağlantıyı açınca `markOpened(now)`; uygulama tekrar aktif olunca `consume(now)`:
 *   - bekleyen geçiş yok            → null
 *   - 30 dk penceresi aşıldı        → null (kayıt temizlenir; "döndü" sayılmaz)
 *   - aksi halde                    → saniye cinsinden süre (kayıt temizlenir; olay bir kez)
 */
export const PROVIDER_RETURN_WINDOW_MS = 30 * 60 * 1000;

export interface ProviderReturnTracker {
  markOpened: (nowMs: number) => void;
  consume: (nowMs: number) => number | null;
}

export function createProviderReturnTracker(windowMs: number = PROVIDER_RETURN_WINDOW_MS): ProviderReturnTracker {
  let openedAt: number | null = null;
  return {
    markOpened(nowMs) {
      openedAt = nowMs;
    },
    consume(nowMs) {
      if (openedAt === null) return null;
      const elapsed = nowMs - openedAt;
      openedAt = null;
      if (elapsed < 0 || elapsed > windowMs) return null;
      return Math.round(elapsed / 1000);
    },
  };
}

/** Süreç genelinde tek izleyici — ekran yeniden kurulsa da bekleyen geçiş kaybolmaz. */
export const providerReturn = createProviderReturnTracker();
