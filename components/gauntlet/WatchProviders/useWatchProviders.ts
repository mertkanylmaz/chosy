/**
 * "Nerede izlenir" veri katmanı — C.9b-UI C2e.
 *
 * Champion'da satır içi bilgi bloğu (TestFlight 2.1.0'dan beri birincil eylem
 * DEĞİL — birincil eylem "Sonraya bırak"). Dört ayrı durum vardır ve üçü
 * birbirine karıştırılamaz:
 *
 *   loading → satır YERİNİ tutar (pop-in yok; düzen zıplamaz)
 *   ok      → dokunulmaz logo satırı + atıf
 *   empty   → istek BAŞARILI, bölgede sağlayıcı yok. Dürüst tek satır
 *   error   → istek başarısız. Boştan AYRI mesaj + yeniden dene
 *   noRegion→ cihaz bölgesi okunamadı (V-2 Tur D). İstek ATILMAZ; başka
 *             bir bölgeye (eskiden 'US') düşülmez, bu açıkça söylenir
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
import {
  resolveLookup,
  startLoad,
  type LoadDeps,
  type TmdbIdLookup,
} from '@/utils/watchProvidersLoad';

export type WatchProvidersState = 'loading' | 'ok' | 'empty' | 'error' | 'noRegion';

/**
 * Oturum içi bellek — `filmId|region` → sonuç.
 *
 * Amacı önbellek değil **prefetch**: son tur başlarken iki finalistin verisi
 * çekilir, şampiyon belli olduğunda sonuç zaten hazırdır ve logo satırı
 * `loading`'de takılmaz. Kalıcı depo DEĞİL (AsyncStorage yok) — uygulama
 * kapanınca gider; bu bilinçli, sağlayıcı katalogu değişken bir veri.
 *
 * `app_config` lazy-okuma kuralıyla (CLAUDE.md 6) karıştırılmaz: o bir ÜRÜN
 * yapılandırmasıdır, bu bir ağ yanıtı.
 */
const memo = new Map<string, WatchProvidersResult>();

const key = (filmId: string, region: string): string => `${filmId}|${region}`;

const RESULTS: LoadDeps<WatchProvidersResult>['results'] = {
  empty: { status: 'empty' },
  error: { status: 'error' },
};

/**
 * `films.tmdb_id` okur. Hata sessizce yutulmaz — bu bizim tablomuz.
 * `none` (filmin tmdb_id'si gerçekten yok) ile `error` (okuma başarısız) AYRIdır.
 */
async function readTmdbId(filmId: string): Promise<TmdbIdLookup> {
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
    return { kind: 'error' };
  }
  const tmdbId = (data as { tmdb_id: number | null } | null)?.tmdb_id ?? null;
  // Okuma başarılı ama kimlik yok: "sorulacak bir şey yok", hata değil.
  return tmdbId === null ? { kind: 'none' } : { kind: 'ok', tmdbId };
}

async function load(filmId: string, region: string): Promise<WatchProvidersResult> {
  return resolveLookup(await readTmdbId(filmId), RESULTS, (tmdbId) =>
    fetchWatchProvidersResult(tmdbId, region),
  );
}

/**
 * Son tur başlarken çağrılır (C2e). Sonucu saklar, hata fırlatmaz —
 * prefetch başarısız olursa `useWatchProviders` normal yolundan tekrar dener.
 */
export async function prefetchWatchProviders(
  filmId: string,
  region: string | null,
): Promise<void> {
  if (region === null) return;
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
  retry: () => void;
}

export function useWatchProviders(
  filmId: string,
  region: string | null,
): UseWatchProvidersValue {
  // Bölgesiz anahtar üretilmez — memo her zaman bölgeyle anahtarlanır.
  const k = region === null ? null : key(filmId, region);
  const cached = k === null ? undefined : memo.get(k);
  const [result, setResult] = useState<WatchProvidersResult | null>(cached ?? null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Bölge yok → sorulacak katalog yok. Sentry kaydı LanguageContext'te.
    if (region === null || k === null) return;
    let cancelled = false;
    const hit = memo.get(k);
    if (hit && attempt === 0) {
      setResult(hit);
      return;
    }
    setResult(null);
    const started = startLoad<WatchProvidersResult>({
      readTmdbId: () => readTmdbId(filmId),
      fetchProviders: (tmdbId) => fetchWatchProvidersResult(tmdbId, region),
      results: RESULTS,
    });
    void started.promise.then((outcome) => {
      // Temizlenmiş (film/bölge/yeniden dene değişti) efekt state'i ezmez;
      // 12 sn sonrası gelen geç sonuç da ilk çözümü değiştiremez (startLoad).
      if (cancelled) return;
      if (outcome.kind === 'rejected') {
        Sentry.captureException(outcome.error, {
          tags: {
            component: 'useWatchProviders',
            flow: 'load',
            error_code: 'WATCH_PROVIDERS_LOAD_REJECTED',
          },
          extra: { film_id: filmId },
        });
        setResult(RESULTS.error);
        return;
      }
      if (outcome.kind === 'timeout') {
        Sentry.captureMessage('watch providers yüklemesi zaman aşımına uğradı', {
          level: 'warning',
          tags: {
            component: 'useWatchProviders',
            flow: 'load',
            error_code: 'WATCH_PROVIDERS_TIMEOUT',
            step: outcome.step,
          },
          extra: { film_id: filmId, timeout_ms: outcome.timeoutMs },
        });
        setResult(RESULTS.error);
        return;
      }
      const r = outcome.result;
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
      started.cancel();
    };
  }, [filmId, region, k, attempt]);

  const retry = useCallback(() => {
    if (k !== null) memo.delete(k);
    setAttempt((n) => n + 1);
  }, [k]);

  if (region === null) {
    return { state: 'noRegion', providers: null, retry };
  }
  if (result === null) {
    return { state: 'loading', providers: null, retry };
  }
  if (result.status === 'ok') {
    return { state: 'ok', providers: result.providers, retry };
  }
  return { state: result.status, providers: null, retry };
}
