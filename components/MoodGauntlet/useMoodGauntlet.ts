/**
 * useMoodGauntlet — Mood Gauntlet ekran durumu (Faz 2-1). Servis (`services/moodGauntlet`) +
 * turnuva mantığı (`utils/moodGauntletFlow`) + analitik arasındaki yapıştırıcı.
 *
 * Durumlar: entry → loading → gauntlet → result (+ error / exhausted).
 * X her durumdan Giriş'e döner (`reset`); Giriş'te router.back() kabuğun işidir.
 * Ham mood metni hiçbir olaya girmez (utils/moodGauntletAnalytics).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import { recordMoodChoice } from '@/services/moodChoiceApi';
import {
  nextFour,
  noteBackupsShown,
  startMoodGauntlet,
  withModifier,
  type MoodGauntletDeps,
  type MoodNotice,
  type MoodSession,
  type MoodSet,
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
  startedEvent,
  type MoodEvent,
  type MoodEntryKind,
  type MoodIntensity,
} from '@/utils/moodGauntletAnalytics';
import { choose, currentPair, elapsedMs, initFlow, isComplete, type MoodFlow } from '@/utils/moodGauntletFlow';
import { classifyMoodSearchError } from '@/utils/moodSearchRetry';

export type MoodStage = 'entry' | 'loading' | 'gauntlet' | 'result' | 'error' | 'exhausted';
export type MoodErrorKind = 'quota' | 'busy' | 'unavailable' | 'network' | 'insufficient' | 'generic';

export interface StartInput {
  text: string;
  quickMoodId?: string;
  entry: MoodEntryKind;
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
  const { t } = useLanguage();
  const depsRef = useRef<MoodGauntletDeps | null>(null);
  if (depsRef.current === null) depsRef.current = createMoodGauntletDeps();
  const deps = depsRef.current;

  const [stage, setStage] = useState<MoodStage>('entry');
  const [errorKind, setErrorKind] = useState<MoodErrorKind>('generic');
  const [loadingText, setLoadingText] = useState<string>('');
  const [session, setSession] = useState<MoodSession | null>(null);
  const [set, setSet] = useState<MoodSet | null>(null);
  const [flow, setFlow] = useState<MoodFlow | null>(null);
  const [notices, setNotices] = useState<MoodNotice[]>([]);

  const runId = useRef(0);
  const mounted = useRef(true);
  /** Özgün mood metni — "Daha hafif/yoğun" her seferinde ÖZGÜNE tek modifier ekler. */
  const baseText = useRef('');
  const lastStart = useRef<StartInput | null>(null);
  const startedAt = useRef(0);
  const gauntletStartedAt = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      runId.current += 1;
    };
  }, []);

  const applySet = useCallback((sess: MoodSession, nextSet: MoodSet) => {
    setSession(sess);
    setSet(nextSet);
    setFlow(initFlow(nextSet.four.map((f) => f.id)));
    setNotices(sess.notices);
    setStage('gauntlet');
  }, []);

  const start = useCallback(
    async (input: StartInput, carryShown: readonly string[] = []) => {
      const id = ++runId.current;
      lastStart.current = input;
      startedAt.current = Date.now();
      setLoadingText(t('moodGauntlet.loadingDefault'));
      setStage('loading');
      trackMoodEvent(startedEvent(input.entry, input.quickMoodId));
      try {
        const res = await startMoodGauntlet(deps, {
          text: input.text,
          quickMoodId: input.quickMoodId,
          carryShown,
          onStage: (e) => {
            if (id !== runId.current || !mounted.current) return;
            if (e.stage === 'parsed' && e.profileName) {
              setLoadingText(t('moodGauntlet.loadingNamed', { name: e.profileName }));
            } else if (e.stage === 'picking') {
              setLoadingText(t('moodGauntlet.loadingPicking'));
            }
          },
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
        const kind = errorKindOf(err);
        // Beklenen kullanıcı durumları (kota, hız sınırı, ağ) Sentry gürültüsü değildir; gerisi hatadır.
        if (kind === 'generic' || kind === 'unavailable') {
          logger.error('[moodGauntlet] baslatma basarisiz', err, { code: 'MOOD_GAUNTLET_START_FAILED' });
        }
        setErrorKind(kind);
        setStage('error');
      }
    },
    [deps, t, applySet],
  );

  const startFromEntry = useCallback(
    (input: StartInput) => {
      baseText.current = input.text;
      return start(input, []);
    },
    [start],
  );

  const loadAnother = useCallback(async () => {
    if (!session) return;
    const id = ++runId.current;
    setLoadingText(t('moodGauntlet.loadingPicking'));
    setStage('loading');
    try {
      const res = await nextFour(deps, session);
      if (id !== runId.current || !mounted.current) return;
      if (res.status === 'exhausted') {
        setSession(res.session);
        setStage('exhausted');
        return;
      }
      applySet(res.session, res.set);
    } catch (err) {
      if (id !== runId.current || !mounted.current) return;
      logger.error('[moodGauntlet] yeni dortlu basarisiz', err, { code: 'MOOD_GAUNTLET_NEXT_FAILED' });
      setErrorKind(errorKindOf(err));
      setStage('error');
    }
  }, [deps, session, t, applySet]);

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

  const intensify = useCallback(
    (direction: MoodIntensity) => {
      trackMoodEvent(intensityEvent(direction));
      const modifier = t(direction === 'lighter' ? 'moodGauntlet.modLighter' : 'moodGauntlet.modStronger');
      void start(
        { text: withModifier(baseText.current, modifier), entry: 'free_text' },
        session?.shown ?? [],
      );
    },
    [session, start, t],
  );

  const retry = useCallback(() => {
    if (lastStart.current) void start(lastStart.current, session?.shown ?? []);
    else setStage('entry');
  }, [start, session]);

  /** X / yeni arama: uçuştaki isteği bırakır ve Giriş'e döner. */
  const reset = useCallback(() => {
    runId.current += 1;
    setSession(null);
    setSet(null);
    setFlow(null);
    setNotices([]);
    setStage('entry');
  }, []);

  return {
    stage,
    errorKind,
    loadingText,
    session,
    set,
    flow,
    notices,
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
