/**
 * PROTOTİP laboratuvarı — Cinematic Discovery Loading. YALNIZ `app/dev-cinematic-loading.tsx`
 * (__DEV__) yükler; production bundle'a girmez. Ağ/DB/analitik YOK: veri zamanlaması burada
 * simüle edilir (simülasyon YALNIZ bu ekranda).
 *
 * Gerçek akışla aynı kurallar: `loadingMinVisible` (400 ms) dışında bekleme eklenmez; veri hazır
 * olduğu an sahneye verilir. Hata yolunda mevcut ErrorStage kullanılır.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorStage } from '@/components/MoodGauntlet/StatusStage';
import type { MoodLoadingKind } from '@/components/MoodGauntlet/useMoodGauntlet';
import { MOOD_MOTION } from '@/constants/design/motion';
import { color, radius, size, space, type } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GauntletFilm } from '@/types/gauntlet';
import { remainingLoadingHold } from '@/utils/moodLoadingHold';

import { CinematicLoading } from './CinematicLoading';

type Speed = 'fast' | 'normal' | 'slow' | 'hang';
type Outcome = 'ok' | 'error';
type PosterFail = 'none' | 'one' | 'all';
type MotionMode = 'system' | 'on' | 'off';

/** Simülasyon: veri hazır olana kadarki süre (ms). UI süresi DEĞİL — test verisi. */
const SIM_DELAY_MS: Record<Exclude<Speed, 'hang'>, number> = { fast: 300, normal: 3000, slow: 9000 };

/** Sabit dörtlü — TMDB poster CDN'i (06.11.2026'da 200 döndüğü doğrulandı). Canlı DB yok. */
const FIXTURE: Omit<GauntletFilm, 'id'>[] = [
  { title: 'The Shawshank Redemption', year: 1994, runtime: 142, posterUrl: 'https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg' },
  { title: 'The Godfather', year: 1972, runtime: 175, posterUrl: 'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg' },
  { title: 'Pulp Fiction', year: 1994, runtime: 154, posterUrl: 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg' },
  { title: 'Inception', year: 2010, runtime: 148, posterUrl: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg' },
];
/** Var olmayan yol → 404 → PosterTile retry (500, 1500 ms) → kalıcı placeholder. */
const MISSING_POSTER = 'https://image.tmdb.org/t/p/w500/chosy-proto-missing-poster.jpg';

function makeFilms(run: number, fail: PosterFail): GauntletFilm[] {
  // Another four'da sıra döner: aynı dört poster farklı yerlere oturur.
  const shift = run % FIXTURE.length;
  return FIXTURE.map((_, i) => {
    const f = FIXTURE[(i + shift) % FIXTURE.length];
    const broken = fail === 'all' || (fail === 'one' && i === 2);
    return { ...f, id: `proto-${run}-${i}`, posterUrl: broken ? MISSING_POSTER : f.posterUrl };
  });
}

interface Metrics {
  dataMs: number | null;
  sceneMs: number | null;
  imageMs: number | null;
  loaded: number;
  failed: number;
}
const EMPTY_METRICS: Metrics = { dataMs: null, sceneMs: null, imageMs: null, loaded: 0, failed: 0 };

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[lab.chip, active && lab.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[lab.chipText, active && lab.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={lab.row}>
      <Text style={lab.rowLabel}>{label}</Text>
      <View style={lab.rowChips}>{children}</View>
    </View>
  );
}

export function CinematicLoadingLab(): React.JSX.Element {
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [panelOpen, setPanelOpen] = useState(true);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [outcome, setOutcome] = useState<Outcome>('ok');
  const [posterFail, setPosterFail] = useState<PosterFail>('none');
  const [motion, setMotion] = useState<MotionMode>('system');
  const [blur, setBlur] = useState(true);

  const [active, setActive] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [kind, setKind] = useState<MoodLoadingKind>('search');
  const [films, setFilms] = useState<GauntletFilm[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [notice, setNotice] = useState<string | null>(null);

  const runRef = useRef(0);
  const shownAt = useRef(0);
  const dataAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(
    (nextKind: MoodLoadingKind) => {
      clearTimers();
      runRef.current += 1;
      const run = runRef.current;
      if (nextKind === 'search') setSceneKey((k) => k + 1); // yeni arama = yeni sahne (production'da da entry → loading)
      setActive(true);
      setKind(nextKind);
      setFilms(null);
      setFailed(false);
      setNotice(null);
      setMetrics(EMPTY_METRICS);
      shownAt.current = Date.now();
      dataAt.current = 0;
      if (speed === 'hang') return; // veri hiç gelmez: döngü testi

      timers.current.push(
        setTimeout(() => {
          // Gerçek akıştaki tek bekleme kuralı: iskelet en az loadingMinVisible görünür.
          const hold = remainingLoadingHold(shownAt.current, Date.now(), MOOD_MOTION.loadingMinVisible);
          timers.current.push(
            setTimeout(() => {
              if (run !== runRef.current) return; // eski koşunun sonucu
              const now = Date.now();
              if (outcome === 'error') {
                setFailed(true);
                return;
              }
              dataAt.current = now;
              setMetrics((m) => ({ ...m, dataMs: now - shownAt.current }));
              setFilms(makeFilms(run, posterFail));
            }, hold),
          );
        }, SIM_DELAY_MS[speed]),
      );
    },
    [clearTimers, speed, outcome, posterFail],
  );

  const onRevealSettled = useCallback(() => {
    if (dataAt.current === 0) return;
    const ms = Date.now() - dataAt.current;
    setMetrics((m) => ({ ...m, sceneMs: ms }));
  }, []);
  const onImageLoad = useCallback(() => {
    if (dataAt.current === 0) return;
    const ms = Date.now() - dataAt.current;
    setMetrics((m) => ({ ...m, loaded: m.loaded + 1, imageMs: Math.max(m.imageMs ?? 0, ms) }));
  }, []);
  const onImageError = useCallback(() => {
    setMetrics((m) => ({ ...m, failed: m.failed + 1 }));
  }, []);

  const clearCache = useCallback(() => {
    Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()])
      .then(() => setNotice(t('devProto.cinematic.cacheCleared')))
      .catch((e: unknown) => setNotice(t('devProto.cinematic.cacheError', { message: String(e) })));
  }, [t]);

  const dash = t('devProto.cinematic.pending');
  const fmt = (v: number | null): string => (v === null ? dash : String(v));
  const reducedOverride = motion === 'system' ? null : motion === 'on';

  return (
    <View style={[lab.root, { paddingTop: insets.top }]}>
      <View style={lab.bar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={space.sm}>
          <Text style={lab.barAction}>{t('devProto.cinematic.close')}</Text>
        </Pressable>
        <Text style={lab.barTitle} numberOfLines={1}>
          {t('devProto.cinematic.title')}
        </Text>
        <Pressable onPress={() => setPanelOpen((o) => !o)} accessibilityRole="button" hitSlop={space.sm}>
          <Text style={lab.barAction}>{t(panelOpen ? 'devProto.cinematic.hidePanel' : 'devProto.cinematic.showPanel')}</Text>
        </Pressable>
      </View>

      {panelOpen && (
        <View style={lab.panel}>
          <Row label={t('devProto.cinematic.speed')}>
            {(['fast', 'normal', 'slow', 'hang'] as const).map((s) => (
              <Chip key={s} label={t(`devProto.cinematic.speed_${s}`)} active={speed === s} onPress={() => setSpeed(s)} />
            ))}
          </Row>
          <Row label={t('devProto.cinematic.outcome')}>
            {(['ok', 'error'] as const).map((o) => (
              <Chip key={o} label={t(`devProto.cinematic.outcome_${o}`)} active={outcome === o} onPress={() => setOutcome(o)} />
            ))}
          </Row>
          <Row label={t('devProto.cinematic.posters')}>
            {(['none', 'one', 'all'] as const).map((p) => (
              <Chip key={p} label={t(`devProto.cinematic.posters_${p}`)} active={posterFail === p} onPress={() => setPosterFail(p)} />
            ))}
          </Row>
          <Row label={t('devProto.cinematic.motion')}>
            {(['system', 'on', 'off'] as const).map((m) => (
              <Chip key={m} label={t(`devProto.cinematic.motion_${m}`)} active={motion === m} onPress={() => setMotion(m)} />
            ))}
          </Row>
          <Row label={t('devProto.cinematic.blur')}>
            <Chip label={t('devProto.cinematic.on')} active={blur} onPress={() => setBlur(true)} />
            <Chip label={t('devProto.cinematic.off')} active={!blur} onPress={() => setBlur(false)} />
          </Row>
          <View style={lab.rowChips}>
            <Chip label={t('devProto.cinematic.start')} active={false} onPress={() => start('search')} />
            <Chip label={t('devProto.cinematic.another')} active={false} onPress={() => start('another')} />
            <Chip label={t('devProto.cinematic.clearCache')} active={false} onPress={clearCache} />
          </View>
        </View>
      )}

      <Text style={lab.metrics} numberOfLines={2}>
        {t('devProto.cinematic.metrics', {
          data: fmt(metrics.dataMs),
          scene: fmt(metrics.sceneMs),
          image: fmt(metrics.imageMs),
          loaded: metrics.loaded,
          failed: metrics.failed,
        })}
      </Text>
      {notice !== null && <Text style={lab.metrics}>{notice}</Text>}

      <View style={lab.stage}>
        {!active ? (
          <Text style={lab.hint}>{t('devProto.cinematic.hint')}</Text>
        ) : failed ? (
          <ErrorStage kind="network" onRetry={() => start('search')} onNewSearch={() => setActive(false)} />
        ) : (
          <CinematicLoading
            key={sceneKey}
            films={films}
            kind={kind}
            moodLabel={t('devProto.cinematic.moodLabel')}
            reducedOverride={reducedOverride}
            blur={blur}
            onStart={() => setNotice(t('devProto.cinematic.started'))}
            onRevealSettled={onRevealSettled}
            onImageLoad={onImageLoad}
            onImageError={onImageError}
          />
        )}
      </View>
    </View>
  );
}

const lab = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface.base },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  barTitle: { ...type['label-caps'], color: color.text.secondary, flexShrink: 1 },
  barAction: { ...type.callout, color: color.text.primary },
  panel: { paddingHorizontal: space.base, gap: space.xs, paddingBottom: space.sm },
  row: { gap: space.xs },
  rowLabel: { ...type.caption, color: color.text.secondary },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.accent.edge,
    backgroundColor: color.surface.raised,
  },
  chipActive: { borderColor: color.accent.focus, backgroundColor: color.accent.fill },
  chipText: { ...type.caption, color: color.text.secondary },
  chipTextActive: { color: color.text.primary },
  metrics: { ...type.meta, color: color.text.secondary, paddingHorizontal: space.base },
  stage: { flex: 1 },
  hint: { ...type.body, color: color.text.secondary, textAlign: 'center', marginTop: space.xxl },
});
