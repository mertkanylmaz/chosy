/**
 * useSpotlightCardState — bonus kartının bugünkü Spotlight durumu (S-2).
 *
 * Kaynak `getDailyChallenge('spotlight', yerel gün)`: bulmaca (`backdrop_url`,
 * `max_attempts`) + kullanıcının sunucudaki ilerlemesi. App kill'e dayanıklı —
 * durum `game_scores`'ta, istemcide türetilen sayaç yok.
 *
 * Ekran her odak aldığında yeniden okunur (K-22): Spotlight'tan dönüşte kart
 * "Continue"/"Solved"/"Failed"a geçer, bitmiş oyun yeniden "Play" demez.
 *
 * Hata: `gameApi` Sentry'ye yazar. Önceki okuma varsa kart onu göstermeye
 * devam eder (breadcrumb ile iz); yoksa `error` — kart nötr çizilir (durum
 * fiili yok), dokunuş oyun ekranına gider ve hatayı o ekran gösterir.
 */
import { useCallback, useRef, useState } from 'react';

import * as Sentry from '@sentry/react-native';
import { useFocusEffect } from 'expo-router';

import { getDailyChallenge } from '@/services/gameApi';
import { localDayKey } from '@/utils/askDecision';

import { spotlightCardStateFrom, type SpotlightCardState } from './cardState';

export type SpotlightCardData =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      state: SpotlightCardState;
      /** Bugünün karesi — kart onu MAX_BLUR'da gösterir; boş olabilir. */
      backdropUrl: string;
      maxAttempts: number;
    };

export function useSpotlightCardState(): SpotlightCardData {
  const [data, setData] = useState<SpotlightCardData>({ status: 'loading' });
  const dataRef = useRef(data);
  dataRef.current = data;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const challenge = await getDailyChallenge('spotlight', localDayKey(new Date()));
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
    }, []),
  );

  return data;
}
