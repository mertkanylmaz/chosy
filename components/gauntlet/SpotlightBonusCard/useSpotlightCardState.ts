/**
 * useSpotlightCardState — bonus kartının bugünkü Spotlight durumu (S-2).
 *
 * Kaynak `getDailyChallenge('spotlight', cycle tarihi)` — tarih aktif gauntlet'in
 * `date` alanıdır (sunucu hesaplar, F2); yerel takvim gününden TÜRETİLMEZ
 * (chosy-conventions §9.4'ün "cihaz yerel tarihi" kuralı eskidir, F3'te güncellenir): bulmaca (`backdrop_url`,
 * `max_attempts`) + kullanıcının sunucudaki ilerlemesi. App kill'e dayanıklı —
 * durum `game_scores`'ta, istemcide türetilen sayaç yok.
 *
 * Ekran her odak aldığında yeniden okunur (K-22): Spotlight'tan dönüşte kart
 * "Continue"/"Solved"/"Failed"a geçer, bitmiş oyun yeniden "Play" demez.
 *
 * P-1c E: hook GauntletShell'de çağrılır (kartın içinde değil) — kartın
 * mount edilip edilmeyeceği bu durumdan karar verilir. `enabled` yalnız
 * champion dalında true; oyun sırasında ağa çıkılmaz.
 *
 * Durumlar:
 * - `unavailable` — bugün bulmaca yok (NO_PUZZLE). Kart çizilmez. Sentry
 *   uyarısını `gameApi` (oyun, gün) başına bir kez yazdı; burada çift kayıt yok.
 * - `loading` — okuma sürüyor. Odakta yenileme sırasında önceki `ready` bayat olabilir
 *   (oyundan dönüşte "Play" görünürdü): bitmiş (solved/failed) durum geri dönmez,
 *   o yüzden aynı gün için korunur; oynanabilir durum (Play/Continue) yenileme
 *   bitene kadar nötr çizilir (çerçeve görseli kalır).
 * - `error` — gerçek hata (`gameApi` Sentry'ye yazdı) ya da bulmaca DOĞRULANAMADI
 *   (`spotlightPuzzleVerified`, `logger.error` + kod). Önceki okuma varsa kart onu
 *   göstermeye devam eder (breadcrumb ile iz; yalnız ağ hatasında); yoksa kart
 *   "yüklenemedi" çizer ve dokunuş YALNIZ yeniden okur — oyuna gitmez.
 *
 * Home-B1: oynanabilir/devam/bitmiş durum yalnız doğrulanmış bulmacayla üretilir.
 * `refresh()` (kartın "tekrar dene"si) ile odak yenilemesi TEK uçuşta birleşir: aynı
 * gün için okuma sürerken ikinci istek atılmaz.
 */
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import * as Sentry from '@sentry/react-native';
import { useFocusEffect } from 'expo-router';

import { getDailyChallenge } from '@/services/gameApi';
import { logger } from '@/utils/logger';
import { isPuzzleUnavailableError } from '@/utils/puzzleAvailability';

import { spotlightPuzzleVerified, type SpotlightCardData } from './cardPresentation';
import { isSpotlightPlayable } from './cardState';

export type { SpotlightCardData };

export interface SpotlightCardHook {
  data: SpotlightCardData;
  /** Kartın "tekrar dene"si: aynı gün için okuma sürmüyorsa yeniden okur. */
  refresh: () => void;
}

export function useSpotlightCardState(enabled: boolean, cycleDate: string | undefined): SpotlightCardHook {
  const [data, setData] = useState<SpotlightCardData>({ status: 'loading' });
  const dataRef = useRef(data);
  dataRef.current = data;
  /** Son başarılı okuma ve hangi gün (cycleDate) için olduğu. */
  const lastReadyRef = useRef<{ date: string; data: Extract<SpotlightCardData, { status: 'ready' }> } | null>(null);
  /** Tek uçuş: şu an okunan gün; token odak/gün değişiminde eski sonucu geçersiz kılar. */
  const inFlightRef = useRef<string | null>(null);
  const tokenRef = useRef(0);
  /** `refresh()` için son girdiler. */
  const inputsRef = useRef({ enabled, cycleDate });
  inputsRef.current = { enabled, cycleDate };

  const load = useCallback((date: string) => {
    if (inFlightRef.current === date) return; // aynı gün için okuma sürüyor
    const token = ++tokenRef.current;
    inFlightRef.current = date;

    // Yenileme başlarken önceki `ready` bayat olabilir. Aynı gün + bitmiş durum
    // geri dönmez → korunur. Aksi halde nötr (aynı günse çerçeve görseliyle).
    // `error`'dan yeniden okumada kart "loading"e döner (dokunma kilitlenir, çift istek yok).
    const prev = dataRef.current;
    if (prev.status === 'ready') {
      const sameDay = lastReadyRef.current?.date === date;
      if (!(sameDay && !isSpotlightPlayable(prev.state))) {
        setData({ status: 'loading', backdropUrl: sameDay ? prev.backdropUrl : undefined });
      }
    } else if (prev.status === 'error') {
      setData({ status: 'loading' });
    }

    const stale = (): boolean => tokenRef.current !== token;

    void (async () => {
      try {
        const challenge = await getDailyChallenge('spotlight', date);
        if (stale()) return;
        const verified = spotlightPuzzleVerified(challenge);
        if (!verified.ok) {
          // Doğrulanamayan bulmaca oyuna/sonuca GİTMEZ: kart "yüklenemedi". Sessiz değil.
          logger.error(
            `[spotlight_card] bulmaca doğrulanamadı: ${verified.detail}`,
            new Error(verified.code),
            { code: verified.code, extra: { detail: verified.detail, puzzle_id: challenge.puzzle.id } },
          );
          setData({ status: 'error' });
          return;
        }
        const ready: Extract<SpotlightCardData, { status: 'ready' }> = {
          status: 'ready',
          state: verified.state,
          backdropUrl: verified.backdropUrl,
          maxAttempts: verified.maxAttempts,
          title: verified.title,
        };
        // Bitmiş oyunda film adı gelmediyse kart B1 metnine düşer — sessiz değil (Kural 1).
        if (!isSpotlightPlayable(verified.state) && verified.title === null) {
          Sentry.captureMessage('spotlight kartı: bitmiş oyunda revealed_solution.title yok', {
            level: 'warning',
            tags: { component: 'SpotlightBonusCard', state: verified.state },
            extra: { puzzle_id: challenge.puzzle.id },
          });
        }
        lastReadyRef.current = { date, data: ready };
        setData(ready);
      } catch (err) {
        if (stale()) return;
        if (isPuzzleUnavailableError(err)) {
          // Veri durumu: bugün bulmaca yok. Önceki `ready` de geçersizdir
          // (gün değişti ya da bulmaca kalktı) — tutulmaz.
          setData({ status: 'unavailable' });
          return;
        }
        // gameApi.getDailyChallenge hatayı Sentry'ye yazdı; burada çift
        // capture yok, yalnız kartın hangi dala düştüğünün izi.
        // Yenileme başarısızsa aynı günün son başarılı okuması (bayat olabilir) geri
        // konur — eski davranış; hata servis katmanında Sentry'ye yazıldı.
        const lastReady = lastReadyRef.current?.date === date ? lastReadyRef.current.data : null;
        const keepPrevious = lastReady !== null;
        Sentry.addBreadcrumb({
          category: 'gauntlet.spotlight_card',
          message: keepPrevious
            ? 'spotlight durumu yenilenemedi — önceki durum gösteriliyor'
            : 'spotlight durumu okunamadı — kart "yüklenemedi"',
          level: 'warning',
          data: { error: err instanceof Error ? err.message : String(err) },
        });
        setData(lastReady ?? { status: 'error' });
      } finally {
        if (!stale()) inFlightRef.current = null;
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Tarih yoksa (gauntlet henüz yüklenmedi) ağa çıkılmaz; yerel tarihe düşülmez.
      if (!enabled || !cycleDate) return undefined;
      load(cycleDate);
      // Arka plandan dönüş: ekran odakta kaldıysa odak yenilemesi tetiklenmez → bayat durum
      // (başka cihazda biten oyun, gün sınırı) kalırdı. Aynı tek-uçuş korumasından geçer:
      // odak yenilemesi sürerken ikinci istek atılmaz. Yalnız odaktayken dinlenir.
      const appStateSub = AppState.addEventListener('change', (next) => {
        if (next === 'active') load(cycleDate);
      });
      return () => {
        appStateSub.remove();
        // Odak kaybı / gün değişimi: sürmekte olan okumanın sonucu uygulanmaz.
        tokenRef.current += 1;
        inFlightRef.current = null;
      };
    }, [enabled, cycleDate, load]),
  );

  const refresh = useCallback(() => {
    const { enabled: on, cycleDate: date } = inputsRef.current;
    if (!on || !date) return;
    load(date);
  }, [load]);

  return { data, refresh };
}
