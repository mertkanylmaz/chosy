/**
 * Odak katmanı yükleme zaman aşımı — saf mantık (React/RN import YOK).
 *
 * FocusStill gelen katın `onLoad`'unu bekler. Gelmezse görsel eski bulanıklıkta
 * sıkışırdı; bu bekçi süre dolunca bir kez geri çağırır. Kurallar:
 *   - `arm` her çağrıda öncekini iptal eder (yeni düzeye yeniden hedefleme =
 *     taze süre, bayat zamanlayıcı terfi ettirmez)
 *   - `cancel` bekleyeni iptal eder (yükleme geldi / hata / unmount)
 *   - süre dolunca geri çağrı en fazla BİR kez çalışır
 *
 * Zamanlayıcı enjekte edilir → testte sahte saatle çalışır.
 */
export interface Scheduler<H> {
  set(callback: () => void, ms: number): H;
  clear(handle: H): void;
}

export interface LoadWatchdog {
  arm(onTimeout: () => void): void;
  cancel(): void;
  /** Bekleyen zamanlayıcı var mı */
  isArmed(): boolean;
}

/**
 * ── Kat durum makinesi ──────────────────────────────────────────────────────
 *
 * Değişmez: görünen önceki kat, gelen kat YÜKLENDİ (`loaded`) onaylanmadan asla
 * gizlenmez. Zaman aşımı ya da hata tek başına eski katı kaldırmaz.
 *
 * Her kat `pending | loaded | failed`. Her yeniden hedefleme o katın bilet
 * numarasını artırır; geri çağrı kendi biletini taşır, uyuşmayan (bayat) olay
 * yok sayılır. Makine saf: olay alır, yeni durum + uygulanacak etkiler döner.
 */
export type FocusLayer = 0 | 1;
export type LayerStatus = 'pending' | 'loaded' | 'failed';

export interface FocusState {
  /** Oturmuş, opak kat — durumu daima `loaded` */
  front: FocusLayer;
  /** Yeni düzeyi taşıyan kat (yükleniyor ya da belirmekte); yoksa null */
  incoming: FocusLayer | null;
  status: [LayerStatus, LayerStatus];
  ticket: [number, number];
  /** Gelen katın belirme animasyonu başlatıldı (yükleme ya da zaman aşımı) */
  promoted: boolean;
  /** Belirme animasyonu kesintisiz bitti */
  faded: boolean;
  disposed: boolean;
}

export type FocusEvent =
  | { type: 'retarget' }
  | { type: 'load'; layer: FocusLayer; ticket: number }
  | { type: 'error'; layer: FocusLayer; ticket: number }
  | { type: 'timeout' }
  | { type: 'fadeDone'; layer: FocusLayer }
  | { type: 'unmount' };

export type FocusLogCode = 'SPOTLIGHT_STILL_LOAD_TIMEOUT' | 'SPOTLIGHT_STILL_LOAD';

export type FocusEffect =
  /** Katın bulanıklığını güncel hedefe ayarla */
  | { type: 'assign'; layer: FocusLayer }
  | { type: 'armWatchdog' }
  | { type: 'cancelWatchdog' }
  /** Katı opaklığa doğru çapraz geçişle getir */
  | { type: 'startFade'; layer: FocusLayer }
  /** Katı gizle — 'settled': diğer kat yüklendi; 'failed': başarısız gelen kat */
  | { type: 'hide'; layer: FocusLayer; reason: 'settled' | 'failed' }
  | { type: 'log'; code: FocusLogCode; layer: FocusLayer };

export interface FocusStep {
  state: FocusState;
  effects: FocusEffect[];
}

export const otherLayer = (layer: FocusLayer): FocusLayer => (layer === 0 ? 1 : 0);

/** İlk kare yüklendikten sonraki başlangıç: kat 0 ön kat ve yüklü */
export function createFocusState(): FocusState {
  return {
    front: 0,
    incoming: null,
    status: ['loaded', 'pending'],
    ticket: [0, 0],
    promoted: false,
    faded: false,
    disposed: false,
  };
}

const noop = (state: FocusState): FocusStep => ({ state, effects: [] });

/** Gelen kat yüklü ve opak: eski katı gizle, gelen kat ön kat olur */
function settle(state: FocusState): FocusStep {
  const incoming = state.incoming;
  if (incoming === null || state.status[incoming] !== 'loaded') return noop(state);
  return {
    state: { ...state, front: incoming, incoming: null, promoted: false, faded: false },
    effects: [{ type: 'hide', layer: state.front, reason: 'settled' }],
  };
}

export function focusReduce(state: FocusState, event: FocusEvent): FocusStep {
  if (event.type === 'unmount') {
    return { state: { ...state, disposed: true }, effects: [{ type: 'cancelWatchdog' }] };
  }
  if (state.disposed) return noop(state);

  switch (event.type) {
    case 'retarget': {
      // Belirmekte/bekleyen kat varsa onu, yoksa arkadaki katı yeniden hedefle
      const incoming = state.incoming ?? otherLayer(state.front);
      const ticket: [number, number] = [state.ticket[0], state.ticket[1]];
      ticket[incoming] += 1;
      const status: [LayerStatus, LayerStatus] = [state.status[0], state.status[1]];
      status[incoming] = 'pending';
      return {
        state: { ...state, incoming, ticket, status, promoted: false, faded: false },
        effects: [{ type: 'assign', layer: incoming }, { type: 'armWatchdog' }],
      };
    }

    case 'load': {
      if (event.ticket !== state.ticket[event.layer]) return noop(state); // bayat kat
      const status: [LayerStatus, LayerStatus] = [state.status[0], state.status[1]];
      status[event.layer] = 'loaded';
      const next = { ...state, status };
      if (event.layer !== state.incoming) return noop(next);

      if (!next.promoted) {
        return {
          state: { ...next, promoted: true },
          effects: [{ type: 'cancelWatchdog' }, { type: 'startFade', layer: event.layer }],
        };
      }
      // Zaman aşımıyla öne alınmıştı, yükleme GEÇ geldi: opaksa şimdi yerleş,
      // belirme sürüyorsa `fadeDone` yerleştirir
      const cancel: FocusEffect = { type: 'cancelWatchdog' };
      if (next.faded) {
        const settled = settle(next);
        return { state: settled.state, effects: [cancel, ...settled.effects] };
      }
      return { state: next, effects: [cancel] };
    }

    case 'error': {
      if (event.ticket !== state.ticket[event.layer]) return noop(state);
      // Yalnız gelen katın hatası: ön katın hata davranışı değişmez
      if (event.layer !== state.incoming) return noop(state);
      const status: [LayerStatus, LayerStatus] = [state.status[0], state.status[1]];
      status[event.layer] = 'failed';
      return {
        state: { ...state, status, incoming: null, promoted: false, faded: false },
        effects: [
          { type: 'cancelWatchdog' },
          { type: 'log', code: 'SPOTLIGHT_STILL_LOAD', layer: event.layer },
          { type: 'hide', layer: event.layer, reason: 'failed' },
        ],
      };
    }

    case 'timeout': {
      const incoming = state.incoming;
      if (incoming === null || state.promoted || state.status[incoming] !== 'pending') {
        return noop(state);
      }
      // Gelen kat öne alınır; ön kat opak kalır — yükleme olmadıysa eski görsel görünür
      return {
        state: { ...state, promoted: true },
        effects: [
          { type: 'log', code: 'SPOTLIGHT_STILL_LOAD_TIMEOUT', layer: incoming },
          { type: 'startFade', layer: incoming },
        ],
      };
    }

    case 'fadeDone': {
      if (event.layer !== state.incoming || !state.promoted || state.faded) return noop(state);
      const faded = { ...state, faded: true };
      // Yüklenmediyse (zaman aşımı yolu) ön kat opak kalır; geç `load` yerleştirir
      return state.status[event.layer] === 'loaded' ? settle(faded) : noop(faded);
    }
  }
}

export function createLoadWatchdog<H>(scheduler: Scheduler<H>, ms: number): LoadWatchdog {
  let handle: H | null = null;
  let armed = false;

  const cancel = (): void => {
    if (handle !== null) scheduler.clear(handle);
    handle = null;
    armed = false;
  };

  return {
    arm(onTimeout) {
      cancel();
      armed = true;
      handle = scheduler.set(() => {
        handle = null;
        armed = false;
        onTimeout();
      }, ms);
    },
    cancel,
    isArmed: () => armed,
  };
}
