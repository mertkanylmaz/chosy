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
 * - `error` — gerçek hata (`gameApi` Sentry'ye yazdı). Önceki okuma varsa kart
 *   onu göstermeye devam eder (breadcrumb ile iz); yoksa kart nötr çizilir,
 *   dokunuş oyun ekranına gider ve hatayı o ekran gösterir.
 */
import { useCallback, useRef, useState } from 'react';

import * as Sentry from '@sentry/react-native';
import { useFocusEffect } from 'expo-router';

import { getDailyChallenge } from '@/services/gameApi';
import { isPuzzleUnavailableError } from '@/utils/puzzleAvailability';

import { isSpotlightPlayable, spotlightCardStateFrom, type SpotlightCardState } from './cardState';

export type SpotlightCardData =
  | {
      status: 'loading';
      /** Yenileme sırasında aynı günün önceki karesi — çerçeve boş kalıp titremesin. */
      backdropUrl?: string;
    }
  | { status: 'error' }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      state: SpotlightCardState;
      /** Bugünün karesi — kart onu MAX_BLUR'da gösterir; boş olabilir. */
      backdropUrl: string;
      maxAttempts: number;
    };

export function useSpotlightCardState(enabled: boolean, cycleDate: string | undefined): SpotlightCardData {
  const [data, setData] = useState<SpotlightCardData>({ status: 'loading' });
  const dataRef = useRef(data);
  dataRef.current = data;
  /** Son başarılı okuma ve hangi gün (cycleDate) için olduğu. */
  const lastReadyRef = useRef<{ date: string; data: Extract<SpotlightCardData, { status: 'ready' }> } | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Tarih yoksa (gauntlet henüz yüklenmedi) ağa çıkılmaz; yerel tarihe düşülmez.
      if (!enabled || !cycleDate) return undefined;
      let cancelled = false;

      // Yenileme başlarken önceki `ready` bayat olabilir. Aynı gün + bitmiş durum
      // geri dönmez → korunur. Aksi halde nötr (aynı günse çerçeve görseliyle).
      const prev = dataRef.current;
      if (prev.status === 'ready') {
        const sameDay = lastReadyRef.current?.date === cycleDate;
        if (!(sameDay && !isSpotlightPlayable(prev.state))) {
          setData({ status: 'loading', backdropUrl: sameDay ? prev.backdropUrl : undefined });
        }
      }

      void (async () => {
        try {
          const challenge = await getDailyChallenge('spotlight', cycleDate);
          if (cancelled) return;
          const backdrop = challenge.puzzle.puzzle_data.backdrop_url;
          const ready: Extract<SpotlightCardData, { status: 'ready' }> = {
            status: 'ready',
            state: spotlightCardStateFrom(challenge.progress),
            backdropUrl: typeof backdrop === 'string' ? backdrop : '',
            maxAttempts: challenge.puzzle.max_attempts,
          };
          lastReadyRef.current = { date: cycleDate, data: ready };
          setData(ready);
        } catch (err) {
          if (cancelled) return;
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
          const lastReady = lastReadyRef.current?.date === cycleDate ? lastReadyRef.current.data : null;
          const keepPrevious = lastReady !== null;
          Sentry.addBreadcrumb({
            category: 'gauntlet.spotlight_card',
            message: keepPrevious
              ? 'spotlight durumu yenilenemedi — önceki durum gösteriliyor'
              : 'spotlight durumu okunamadı — kart nötr',
            level: 'warning',
            data: { error: err instanceof Error ? err.message : String(err) },
          });
          setData(lastReady ?? { status: 'error' });
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [enabled, cycleDate]),
  );

  return data;
}
