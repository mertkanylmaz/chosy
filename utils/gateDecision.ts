/**
 * Gate karar mantığı — saf (RN, ağ ve Sentry bağımlılığı YOK).
 *
 * `services/gateState.ts` "gate tamam" bayrağının modül düzeyi tek örneğini
 * tutar. Burada yalnız fabrika durur ki davranış cihaz gerektirmeden test
 * edilsin (`tests/navigation/gateDecision.test.ts`).
 *
 * Bayrak yalnız bellekte yaşar: JS bağlamı yeniden başlayınca (cold start)
 * kendiliğinden sıfırlanır. AppState geçişleri (arka plan → ön plan) JS
 * bağlamını yaşatır, bayrağı değiştirmez — gate yalnız cold start'ta koşar.
 * Bu bir özellik bayrağı DEĞİL (app_config'ten okunmaz); kural 5'in kapsamı dışı.
 */

export interface GateDoneFlag {
  /** Gate bir yönlendirme kararı verdi; (tabs) artık mount edilebilir. */
  markDone(): void;
  isDone(): boolean;
}

export function createGateDoneFlag(): GateDoneFlag {
  let done = false;
  return {
    markDone() {
      done = true;
    },
    isDone() {
      return done;
    },
  };
}

export interface GateReadiness {
  /** Yönlendirme kararı (hedef rota) verildi mi. */
  decisionReady: boolean;
  /** MIN_SPLASH_MS doldu mu. */
  minTimePassed: boolean;
  /**
   * Karar "onboarded=true" ile (tabs)'e vardıysa true: dönen kullanıcı splash
   * için bekletilmez. Yeni kullanıcı (onboarding) ve hata düşüşü false —
   * minimum bekleme aynen kalır.
   */
  skipMinSplash: boolean;
}

/** Fade-out'u (dolayısıyla yönlendirmeyi) başlatma zamanı geldi mi. */
export function isGateReadyToNavigate(r: GateReadiness): boolean {
  return r.decisionReady && (r.minTimePassed || r.skipMinSplash);
}
