/**
 * "Nerede izlenir" veri katmanı — C.9b-UI C2e.
 *
 * Champion'da bu eylem BİRİNCİL (K-20 activation bridge). Birincil bir eylemin
 * dört ayrı durumu vardır ve üçü birbirine karıştırılamaz:
 *
 *   loading → buton YERİNDE durur (pop-in yok; düzen zıplaması birincil
 *             eylemde en pahalı hatadır)
 *   ok      → butona basınca sheet açılır
 *   empty   → istek BAŞARILI, bölgede sağlayıcı yok. Dürüst tek satır
 *             gösterilir; "Sonraya bırak" birincil eyleme yükselir
 *   error   → istek başarısız. Boştan AYRI mesaj + yeniden dene.
 *             "Sonraya bırak" YÜKSELMEZ — geçici bir arıza kalıcı bir
 *             hiyerarşi değişikliğine yol açmamalı
 *
 * ── Kimlik ──────────────────────────────────────────────────────────────────
 * `getAppUserId()` YOK, INSERT YOK. `films` tablosundan yalnız `tmdb_id`
 * OKUNUR — gauntlet ekranlarının kimlik kuralı korunur.
 */
import { useCallback, useEffect, useState } from 'react';

import * as Sentry from '@sentry/react-native';

import { supabase } from '@/services/supabase';
import {
  fetchWatchProvidersResult,
  type TmdbWatchProviders,
  type WatchProvidersResult,
} from '@/services/tmdb';
import { logger } from '@/utils/logger';

export type WatchProvidersState = 'loading' | 'ok' | 'empty' | 'error';

/**
 * Oturum içi bellek — `filmId|region` → sonuç.
 *
 * Amacı önbellek değil **prefetch**: son tur başlarken iki finalistin verisi
 * çekilir, şampiyon belli olduğunda sonuç zaten hazırdır ve birincil eylem
 * `loading`'de takılmaz. Kalıcı depo DEĞİL (AsyncStorage yok) — uygulama
 * kapanınca gider; bu bilinçli, sağlayıcı katalogu değişken bir veri.
 *
 * `app_config` lazy-okuma kuralıyla (CLAUDE.md 6) karıştırılmaz: o bir ÜRÜN
 * yapılandırmasıdır, bu bir ağ yanıtı.
 */
const memo = new Map<string, WatchProvidersResult>();

const key = (filmId: string, region: string): string => `${filmId}|${region}`;

/** `films.tmdb_id` okur. Hata sessizce yutulmaz — bu bizim tablomuz. */
async function readTmdbId(filmId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('films')
    .select('tmdb_id')
    .eq('id', filmId)
    .maybeSingle();

  if (error) {
    Sentry.captureException(error, {
      tags: { component: 'useWatchProviders', flow: 'tmdb_id_lookup' },
      extra: { film_id: filmId },
    });
    logger.error('[useWatchProviders] tmdb_id okunamadı:', error.message, {
      skipBridge: true,
      code: 'WATCH_PROVIDERS_TMDB_ID_FAILED',
      sampleRate: 0.5,
    });
    return null;
  }
  return (data as { tmdb_id: number | null } | null)?.tmdb_id ?? null;
}

async function load(filmId: string, region: string): Promise<WatchProvidersResult> {
  const tmdbId = await readTmdbId(filmId);
  if (tmdbId === null) {
    // Kimlik okunamadı VEYA filmde tmdb_id yok. İkisi de "sorulacak bir şey
    // yok" demek — kullanıcıya hata göstermek yanlış olurdu.
    return { status: 'empty' };
  }
  return fetchWatchProvidersResult(tmdbId, region);
}

/**
 * Son tur başlarken çağrılır (C2e). Sonucu saklar, hata fırlatmaz —
 * prefetch başarısız olursa `useWatchProviders` normal yolundan tekrar dener.
 */
export async function prefetchWatchProviders(
  filmId: string,
  region: string,
): Promise<void> {
  const k = key(filmId, region);
  if (memo.has(k)) return;
  try {
    const result = await load(filmId, region);
    // Hatalı sonucu SAKLAMA: geçici bir ağ arızası şampiyon ekranına
    // kalıcı bir "error" olarak taşınmamalı, orada yeniden denenir.
    if (result.status !== 'error') memo.set(k, result);
  } catch {
    // Prefetch en iyi çaba — sessiz değil, asıl yol zaten Sentry'ye yazıyor.
  }
}

export interface UseWatchProvidersValue {
  state: WatchProvidersState;
  providers: TmdbWatchProviders | null;
  /** TMDB'nin toplu "nerede izlenir" sayfası. Yoksa dokunma hedefi kurulmaz. */
  link: string | null;
  retry: () => void;
}

export function useWatchProviders(
  filmId: string,
  region: string,
): UseWatchProvidersValue {
  const k = key(filmId, region);
  const cached = memo.get(k);
  const [result, setResult] = useState<WatchProvidersResult | null>(cached ?? null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const hit = memo.get(k);
    if (hit && attempt === 0) {
      setResult(hit);
      return;
    }
    setResult(null);
    void load(filmId, region).then((r) => {
      if (cancelled) return;
      if (r.status !== 'error') memo.set(k, r);
      setResult(r);
      if (r.status === 'empty') {
        // Veri durumu, hata değil — ama "hangi bölgede boş dönüyor"
        // sorusunun izi kalmalı (M1 borcu: sağlayıcı yok oranı).
        Sentry.addBreadcrumb({
          category: 'gauntlet.providers',
          message: 'watch providers boş döndü',
          level: 'info',
          data: { film_id: filmId, region },
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filmId, region, k, attempt]);

  const retry = useCallback(() => {
    memo.delete(k);
    setAttempt((n) => n + 1);
  }, [k]);

  if (result === null) {
    return { state: 'loading', providers: null, link: null, retry };
  }
  if (result.status === 'ok') {
    return {
      state: 'ok',
      providers: result.providers,
      link: result.providers.link ?? null,
      retry,
    };
  }
  return { state: result.status, providers: null, link: null, retry };
}
