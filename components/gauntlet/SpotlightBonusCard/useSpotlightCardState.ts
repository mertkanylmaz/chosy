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
 * - `error` — gerçek hata (`gameApi` Sentry'ye yazdı). Önceki okuma varsa kart
 *   onu göstermeye devam eder (breadcrumb ile iz); yoksa kart nötr çizilir,
 *   dokunuş oyun ekranına gider ve hatayı o ekran gösterir.
 */
import { useCallback, useRef, useState } from 'react';

import * as Sentry from '@sentry/react-native';
import { useFocusEffect } from 'expo-router';

import { getDailyChallenge } from '@/services/gameApi';
import { isPuzzleUnavailableError } from '@/utils/puzzleAvailability';

import { spotlightCardStateFrom, type SpotlightCardState } from './cardState';

export type SpotlightCardData =
  | { status: 'loading' }
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

  useFocusEffect(
    useCallback(() => {
      // Tarih yoksa (gauntlet henüz yüklenmedi) ağa çıkılmaz; yerel tarihe düşülmez.
      if (!enabled || !cycleDate) return undefined;
      let cancelled = false;
      void (async () => {
        try {
          const challenge = await getDailyChallenge('spotlight', cycleDate);
          if (cancelled) return;
          const backdrop = challenge.puzzle.puzzle_data.backdrop_url;
          setData({
            status: 'ready',
            state: spotlightCardStateFrom(challenge.progress),
            backdropUrl: typeof backdrop === 'string' ? backdrop : '',
            maxAttempts: challenge.puzzle.max_attempts,
          });
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
          const keepPrevious = dataRef.current.status === 'ready';
          Sentry.addBreadcrumb({
            category: 'gauntlet.spotlight_card',
            message: keepPrevious
              ? 'spotlight durumu yenilenemedi — önceki durum gösteriliyor'
              : 'spotlight durumu okunamadı — kart nötr',
            level: 'warning',
            data: { error: err instanceof Error ? err.message : String(err) },
          });
          if (!keepPrevious) setData({ status: 'error' });
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [enabled, cycleDate]),
  );

  return data;
}
