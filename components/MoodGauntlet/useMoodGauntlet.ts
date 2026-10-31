/**
 * useMoodGauntlet — Mood Gauntlet ekran durumu (Faz 2-1 / 2-1b). Servis (`services/moodGauntlet`) +
 * turnuva mantığı (`utils/moodGauntletFlow`) + analitik arasındaki yapıştırıcı.
 *
 * Durumlar: entry → loading → gauntlet → result (+ error / exhausted).
 * X her durumdan Giriş'e döner (`reset`); Giriş'te router.back() kabuğun işidir.
 * Ham mood metni hiçbir olaya girmez (utils/moodGauntletAnalytics).
 *
 * HIZ (2-1b): dörtlü gerekçesiz gelir ve HEMEN gösterilir; gerekçeler ayrı çağrıyla arkadan
 * dolar (`reasons`). Dörtlü gelince 4 filmin "nerede izlenir" verisi ön-çekilir.
 * YOĞUNLUK (2-1b): Daha hafif / Daha yoğun parse'ı tekrarlamaz (kota düşmez).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { prefetchWatchProviders } from '@/components/gauntlet/WatchProviders/useWatchProviders';
import { useLanguage } from '@/contexts/LanguageContext';
import { recordMoodChoice } from '@/services/moodChoiceApi';
import {
  canShiftIntensity,
  fetchReasons,
  intensifyMoodGauntlet,
  nextFour,
  noteBackupsShown,
  startMoodGauntlet,
  type IntensityDirection,
  type MoodGauntletDeps,
  type MoodNotice,
  type MoodSession,
  type MoodSet,
  type PipelineStageName,
  type StageEvent,
} from '@/services/moodGauntlet';
import { createMoodGauntletDeps } from '@/services/moodGauntletDeps';
import { posthogAnalytics } from '@/services/posthog';
import { MoodParseError } from '@/services/tasteParser';
import { logger } from '@/utils/logger';
import {
  anotherFourEvent,
  assertNoFreeText,
  completedEvent,
  firstFourVisibleEvent,
  intensityEvent,
  matchChosenEvent,
  noneOfTheseEvent,
  pipelineTimingEvent,
  startedEvent,
  type MoodEvent,
  type MoodEntryKind,
} from '@/utils/moodGauntletAnalytics';
import { choose, currentPair, elapsedMs, initFlow, isComplete, type MoodFlow } from '@/utils/moodGauntletFlow';
import { classifyMoodSearchError } from '@/utils/moodSearchRetry';

export type MoodStage = 'entry' | 'loading' | 'gauntlet' | 'result' | 'error' | 'exhausted';
export type MoodErrorKind = 'quota' | 'busy' | 'unavailable' | 'network' | 'insufficient' | 'generic';
/** Yükleme ekranındaki üç aşama: Reading → Matching → Picking. */
export type MoodLoadingPhase = 'reading' | 'matching' | 'picking';

export interface StartInput {
  text: string;
  quickMoodId?: string;
  entry: MoodEntryKind;
  /** Yükleme ekranında gösterilen ad: hızlı mood başlığı ya da kullanıcının kendi metni (ekranda kalır, olaya girmez). */
  label?: string;
}

function errorKindOf(err: unknown): MoodErrorKind {
  if (err instanceof MoodParseError) {
    if (err.code === 'NETWORK_ERROR') return 'network';
    const cls = classifyMoodSearchError(err.code);
    if (cls === 'paywall') return 'quota';
    if (cls === 'rate_limited' || cls === 'retry_same_id') return 'busy';
    if (cls === 'unavailable') return 'unavailable';
    return 'generic';
  }
  if (err instanceof TypeError) return 'network'; // fetch / RPC ağ hatası
  return 'generic';
}

export function trackMoodEvent(ev: MoodEvent): void {
  try {
    assertNoFreeText(ev);
  } catch (err) {
    // Serbest metin sızıntısı kodlama hatasıdır: olay ATILMAZ, Sentry'ye gider.
    logger.error('[moodGauntlet] analitik olayi serbest metin tasiyor', err, { code: 'MOOD_EVENT_FREE_TEXT' });
    return;
  }
  posthogAnalytics.track(ev.name, ev.props);
}

export function useMoodGauntlet() {
  const { region } = useLanguage();
  const depsRef = useRef<MoodGauntletDeps | null>(null);
  if (depsRef.current === null) depsRef.current = createMoodGauntletDeps();
  const deps = depsRef.current;

  const [stage, setStage] = useState<MoodStage>('entry');
  const [errorKind, setErrorKind] = useState<MoodErrorKind>('generic');
  const [loadingPhase, setLoadingPhase] = useState<MoodLoadingPhase>('reading');
  const [moodLabel, setMoodLabel] = useState<string | null>(null);
  const [session, setSession] = useState<MoodSession | null>(null);
  const [set, setSet] = useState<MoodSet | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [flow, setFlow] = useState<MoodFlow | null>(null);
  const [notices, setNotices] = useState<MoodNotice[]>([]);

  const runId = useRef(0);
  const reasonsRun = useRef(0);
  const mounted = useRef(true);
  const lastStart = useRef<StartInput | null>(null);
  const startedAt = useRef(0);
  const gauntletStartedAt = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      runId.current += 1;
      reasonsRun.current += 1;
    };
  }, []);

  const onTiming = useCallback((s: PipelineStageName, ms: number) => {
    trackMoodEvent(pipelineTimingEvent(s, ms));
  }, []);

  /** Gerekçeler: dörtlü ekrandayken arkadan; gelmezse (boş) satır çizilmez. Hata servis içinde Sentry'ye gider. */
  const loadReasons = useCallback(
    (sess: MoodSession, nextSet: MoodSet) => {
      const rid = ++reasonsRun.current;
      const t0 = Date.now();
      void fetchReasons(deps, sess, nextSet).then((r) => {
        if (rid !== reasonsRun.current || !mounted.current) return;
        trackMoodEvent(pipelineTimingEvent('reasons', Date.now() - t0));
        setReasons(r);
      });
    },
    [deps],
  );

  const applySet = useCallback(
    (sess: MoodSession, nextSet: MoodSet) => {
      setSession(sess);
      setSet(nextSet);
      setReasons({});
      setFlow(initFlow(nextSet.four.map((f) => f.id)));
      setNotices(sess.notices);
      setStage('gauntlet');
      // Gauntlet sürerken 4 filmin sağlayıcı verisi hazır olsun (sonuç ekranında yer tutucu beklemesin).
      for (const f of nextSet.four) void prefetchWatchProviders(f.id, region);
      loadReasons(sess, nextSet);
    },
    [loadReasons, region],
  );

  const onStage = useCallback(
    (id: number) => (e: StageEvent) => {
      if (id !== runId.current || !mounted.current) return;
      if (e.stage === 'parsed') {
        setLoadingPhase('matching');
        if (e.profileName) setMoodLabel(e.profileName);
      } else {
        setLoadingPhase('picking');
      }
    },
    [],
  );

  const fail = useCallback((err: unknown, code: string) => {
    const kind = errorKindOf(err);
    // Beklenen kullanıcı durumları (kota, hız sınırı, ağ) Sentry gürültüsü değildir; gerisi hatadır.
    if (kind === 'generic' || kind === 'unavailable') {
      logger.error('[moodGauntlet] islem basarisiz', err, { code });
    }
    setErrorKind(kind);
    setStage('error');
  }, []);

  const start = useCallback(
    async (input: StartInput, carryShown: readonly string[] = []) => {
      const id = ++runId.current;
      lastStart.current = input;
      startedAt.current = Date.now();
      setLoadingPhase('reading');
      setMoodLabel(input.label ?? null);
      setStage('loading');
      trackMoodEvent(startedEvent(input.entry, input.quickMoodId));
      try {
        const res = await startMoodGauntlet(deps, {
          text: input.text,
          quickMoodId: input.quickMoodId,
          carryShown,
          onStage: onStage(id),
          onTiming,
        });
        if (id !== runId.current || !mounted.current) return;
        if (res.status === 'insufficient') {
          setSession(res.session);
          setErrorKind('insufficient');
          setStage('error');
          return;
        }
        gauntletStartedAt.current = Date.now();
        trackMoodEvent(firstFourVisibleEvent(elapsedMs(startedAt.current, Date.now()), res.session.parsed.cacheHit));
        applySet(res.session, res.set);
      } catch (err) {
        if (id !== runId.current || !mounted.current) return;
        fail(err, 'MOOD_GAUNTLET_START_FAILED');
      }
    },
    [deps, applySet, onStage, onTiming, fail],
  );

  const startFromEntry = useCallback((input: StartInput) => start(input, []), [start]);

  const loadAnother = useCallback(async () => {
    if (!session) return;
    const id = ++runId.current;
    setLoadingPhase('picking');
    setStage('loading');
    try {
      const res = await nextFour(deps, session);
      if (id !== runId.current || !mounted.current) return;
      if (res.status === 'exhausted') {
        setSession(res.session);
        setStage('exhausted');
        return;
      }
      gauntletStartedAt.current = Date.now();
      applySet(res.session, res.set);
    } catch (err) {
      if (id !== runId.current || !mounted.current) return;
      fail(err, 'MOOD_GAUNTLET_NEXT_FAILED');
    }
  }, [deps, session, applySet, fail]);

  const record = useCallback(
    (round: 1 | 2 | 3, a: string, b: string, winner: string | null, outcome: 'choice' | 'neither') => {
      const searchId = session?.parsed.searchId;
      if (!searchId || !set) return; // arama kimliği yoksa seçim kaydı yapılamaz (kullanıcıya hata gösterilmez)
      void recordMoodChoice({
        moodSearchId: searchId,
        setId: set.setId,
        setIndex: set.setIndex,
        round,
        filmA: a,
        filmB: b,
        winner,
        outcome,
      });
    },
    [session, set],
  );

  const chooseFilm = useCallback(
    (filmId: string) => {
      if (!flow) return;
      const pair = currentPair(flow);
      if (!pair) return;
      const next = choose(flow, filmId);
      record(pair.round, pair.a, pair.b, filmId, 'choice');
      trackMoodEvent(matchChosenEvent(pair.round));
      setFlow(next);
      if (isComplete(next) && session && set) {
        trackMoodEvent(completedEvent(elapsedMs(gauntletStartedAt.current, Date.now())));
        setSession(noteBackupsShown(session, set.backups));
        setStage('result');
      }
    },
    [flow, session, set, record],
  );

  const noneOfThese = useCallback(() => {
    if (!flow) return;
    const pair = currentPair(flow);
    if (!pair) return;
    record(pair.round, pair.a, pair.b, null, 'neither');
    trackMoodEvent(noneOfTheseEvent(pair.round));
    void loadAnother();
  }, [flow, record, loadAnother]);

  const anotherFour = useCallback(() => {
    trackMoodEvent(anotherFourEvent());
    void loadAnother();
  }, [loadAnother]);

  /**
   * Daha hafif / Daha yoğun: parse YOK, kota düşmez. Profilin yoğunluk boyutları kaydırılır,
   * v4 + rerank yeniden. Kullanıcının genres_exclude / max_runtime kısıtları korunur.
   */
  const intensify = useCallback(
    async (direction: IntensityDirection) => {
      if (!session || !canShiftIntensity(session.intensityStep, direction)) return;
      trackMoodEvent(intensityEvent(direction));
      const id = ++runId.current;
      startedAt.current = Date.now();
      setLoadingPhase('matching');
      setStage('loading');
      try {
        const res = await intensifyMoodGauntlet(deps, session, direction, {
          onStage: onStage(id),
          onTiming,
        });
        if (id !== runId.current || !mounted.current) return;
        if (res.status === 'insufficient') {
          setSession(res.session);
          setStage('exhausted');
          return;
        }
        gauntletStartedAt.current = Date.now();
        applySet(res.session, res.set);
      } catch (err) {
        if (id !== runId.current || !mounted.current) return;
        fail(err, 'MOOD_GAUNTLET_INTENSITY_FAILED');
      }
    },
    [deps, session, applySet, onStage, onTiming, fail],
  );

  const retry = useCallback(() => {
    if (lastStart.current) void start(lastStart.current, session?.shown ?? []);
    else setStage('entry');
  }, [start, session]);

  /** X / yeni arama: uçuştaki isteği bırakır ve Giriş'e döner. */
  const reset = useCallback(() => {
    runId.current += 1;
    reasonsRun.current += 1;
    setSession(null);
    setSet(null);
    setReasons({});
    setFlow(null);
    setNotices([]);
    setMoodLabel(null);
    setStage('entry');
  }, []);

  return {
    stage,
    errorKind,
    loadingPhase,
    moodLabel,
    session,
    set,
    reasons,
    flow,
    notices,
    canLighter: session ? canShiftIntensity(session.intensityStep, 'lighter') : false,
    canStronger: session ? canShiftIntensity(session.intensityStep, 'stronger') : false,
    champion: flow?.champion ? set?.four.find((f) => f.id === flow.champion) ?? null : null,
    startFromEntry,
    chooseFilm,
    noneOfThese,
    anotherFour,
    intensify,
    retry,
    reset,
  };
}
