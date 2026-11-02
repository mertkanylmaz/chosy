/**
 * Gauntlet: 4 film; 1v2, 3v4, final; "Hiçbiri". Swipe ve otomatik watchlist yazımı YOK — yalnız
 * dokunuş. Günlük gauntlet'in `PosterTile` ve `RoundIndicator` bileşenleri doğrudan kullanılır;
 * mood filmi `GauntletFilm`'e istemcide eşlenir (kilitli tipe dokunulmaz).
 *
 * Faz 2-3:
 *  - İlk turdan önce "Dörtlün": 4 poster ızgarada ~1 sn, sonra 1. eşleşmeye animasyonlu geçiş.
 *  - Soru posterlerin ÜSTÜNDE; gerekçe ≤3 satır, taşarsa kuyrukta "…" (ellipsizeMode=tail). İki
 *    kartın metin alanı eşit yükseklik; yüklenirken iki satırlık iskelet, boş gelirse alan boş.
 *  - Gerekçenin altında veriden çipler (tempo · yoğunluk · süre).
 *  - 1. turda ilk kullanım ipucu + ikincil "Sen seç" (rerank'ın 1. filmi şampiyon olur).
 *  - "Hiçbiri" ve "Sen seç" aynı boyda ikincil düğmeler (OutlineAction), altında tek satır açıklama.
 *  - Faz 2-4: turlar boyunca üstte 4 poster şeridi (kazanan vurgulu, elenen %35 opaklık).
 *  - Faz 2-9a: "Your four" KALICI durak (`FourIntro`): otomatik geçiş yok, Round 1 yalnız
 *    "Start choosing" dokunuşuyla açılır.
 *
 * Seçim tepkisi: dokunulan poster `remaining`, diğeri `eliminated`; geçişin bitiminde tur ilerler.
 */
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { OutlineAction } from '@/components/gauntlet/OutlineAction';
import { PosterTile, type PosterTileAnimationState } from '@/components/gauntlet/PosterTile';
import { RoundIndicator } from '@/components/gauntlet/RoundIndicator';
import { DISSOLVE_DURATION, MOOD_MOTION } from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { reasonFor, type MoodNotice, type MoodSet } from '@/services/moodGauntlet';
import { hapticSelection } from '@/utils/haptics';
import type { FilmDims } from '@/utils/moodFilmFacts';
import { toGauntletFilm } from '@/utils/moodGauntletFilm';
import { currentPair, stripItems, type MoodFlow } from '@/utils/moodGauntletFlow';
import { normalizePosterUrl } from '@/utils/posterUrl';

import { FilmChips } from './FilmChips';
import { FourIntro } from './FourIntro';
import { styles } from './styles';

interface GauntletStageProps {
  set: MoodSet;
  /** film id → gerekçe (arkadan dolar). */
  reasons: Record<string, string>;
  /** Gerekçe isteği uçuşta mı (iskelet çizilir). */
  reasonsLoading: boolean;
  /** film id → boyutlar (arkadan dolar; gelmezse çip çizilmez). */
  dims: Record<string, FilmDims>;
  flow: MoodFlow;
  notices: MoodNotice[];
  /** Hızlı mood adı ya da profile_name / kullanıcı metni; üstteki mood çipi. */
  moodLabel: string | null;
  /** İlk kullanım ipucu görünsün mü (yalnız 1. turda çizilir). */
  tapHint: boolean;
  onChoose: (filmId: string) => void;
  /** "Your four" gösterildi (set başına bir kez). */
  onFourViewed: () => void;
  /** "Start choosing" dokunuşu; `dwellMs` = Your four'un açık kaldığı süre. */
  onFourStart: (dwellMs: number) => void;
  onNone: () => void;
  onJustPick: () => void;
}

export function GauntletStage({
  set,
  reasons,
  reasonsLoading,
  dims,
  flow,
  notices,
  moodLabel,
  tapHint,
  onChoose,
  onFourViewed,
  onFourStart,
  onNone,
  onJustPick,
}: GauntletStageProps): React.JSX.Element | null {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const pair = currentPair(flow);
  const [picked, setPicked] = useState<string | null>(null);
  const [introDoneFor, setIntroDoneFor] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Senkron kilit: `picked` state'i bir sonraki render'a kadar eski kalır, aynı karedeki ikinci
   * dokunuş onu `null` görürdü. Ref anında değişir → hızlı / çift dokunuşta tek seçim, tek zamanlayıcı.
   */
  const pickLock = useRef(false);

  // Yeni tur / yeni dörtlü: seçim durumu sıfırlanır.
  const roundKey = pair ? `${set.setId}:${pair.round}` : set.setId;
  // Turdan tura aynı ScrollView örneği yaşar: önceki turun kaydırması taşınmasın (Faz 2-9a).
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    pickLock.current = false;
    setPicked(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [roundKey]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Your four: Round 1 YALNIZ CTA ile açılır — zamanlayıcı / effect ile kapanmaz.
  const showIntro = pair !== null && pair.round === 1 && introDoneFor !== set.setId;
  const handleFourStart = useCallback(
    (dwellMs: number) => {
      onFourStart(dwellMs);
      setIntroDoneFor(set.setId);
    },
    [onFourStart, set.setId],
  );

  const films = useMemo(() => {
    const map = new Map<string, ReturnType<typeof toGauntletFilm>>();
    for (const row of set.four) map.set(row.id, toGauntletFilm(row, (u) => normalizePosterUrl(u) ?? ''));
    return map;
  }, [set]);
  const runtimes = useMemo(() => new Map(set.four.map((r) => [r.id, r.runtime])), [set]);

  const handlePick = useCallback(
    (id: string) => {
      if (pickLock.current) return; // geçiş sürerken gelen dokunuşlar yok sayılır
      pickLock.current = true;
      hapticSelection();
      setPicked(id);
      // Seçilen posterin görülme süresi (token); sonra tur ilerler. Reduce Motion'da bekleme yok.
      timer.current = setTimeout(() => onChoose(id), reduced ? 0 : MOOD_MOTION.pickSettle);
    },
    [onChoose, reduced],
  );

  if (!pair) return null;

  if (showIntro) {
    return (
      <FourIntro
        key={set.setId}
        films={set.four.map((row) => films.get(row.id)).filter((f): f is NonNullable<typeof f> => f !== undefined)}
        moodLabel={moodLabel}
        onStart={handleFourStart}
        onViewed={onFourViewed}
      />
    );
  }

  const sides = [pair.a, pair.b];
  const tileState = (id: string): PosterTileAnimationState =>
    picked === null ? 'idle' : id === picked ? 'remaining' : 'eliminated';
  const isFirstRound = pair.round === 1;

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View
        style={styles.gStage}
        entering={reduced ? undefined : FadeIn.duration(DISSOLVE_DURATION.newContender)}
      >
        <View style={styles.gTop}>
          {moodLabel !== null && moodLabel.length > 0 && (
            <View style={styles.moodChip} accessibilityLabel={t('moodGauntlet.moodChipLabel', { name: moodLabel })}>
              <Text style={styles.moodChipText} numberOfLines={1}>
                {moodLabel}
              </Text>
            </View>
          )}
          <RoundIndicator current={pair.round} />
          <View style={styles.strip} accessibilityLabel={t('moodGauntlet.stripA11y')}>
            {stripItems(flow).map((item) => {
              const row = set.four.find((f) => f.id === item.id);
              const uri = row ? normalizePosterUrl(row.poster_url) : null;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.stripCell,
                    item.status === 'advanced' && styles.stripCellAdvanced,
                    item.status === 'eliminated' && styles.stripCellEliminated,
                  ]}
                >
                  {uri !== null && <Image source={{ uri }} style={styles.heroImage} contentFit="cover" />}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.gQuestionBlock}>
          <Text style={styles.question} accessibilityRole="header">
            {t('moodGauntlet.question')}
          </Text>
          {isFirstRound && tapHint && <Text style={styles.tapHint}>{t('moodGauntlet.tapHint')}</Text>}
        </View>

        <View style={styles.pairRow}>
          {sides.map((id) => {
            const film = films.get(id);
            if (!film) return null;
            const reason = reasonFor(reasons, id);
            return (
              <View key={id} style={styles.pairCol}>
                <PosterTile
                  film={film}
                  disabled={picked !== null}
                  selected={id === picked}
                  animationState={tileState(id)}
                  onPress={() => handlePick(id)}
                  metaMode="yearOnly"
                  titleLines={2}
                />
                {/* Faz 2-9c: başlık bloğu iki satırlık sabit yükseklik (`titleLines={2}`, en fazla 2 satır + "…"); uzun başlık yıl/gerekçe/çipleri kaydırmaz. */}
                {/* Sabit yükseklikli alan: iki kartın metin bölgesi eşit, gerekçe gelince düzen zıplamaz. */}
                <View style={styles.reasonSlot}>
                  {reason !== null ? (
                    <Animated.Text
                      style={styles.reason}
                      numberOfLines={4}
                      ellipsizeMode="tail"
                      entering={reduced ? undefined : FadeIn.duration(DISSOLVE_DURATION.newContender)}
                    >
                      {reason}
                    </Animated.Text>
                  ) : reasonsLoading ? (
                    <View style={styles.reasonSkeleton} accessibilityElementsHidden importantForAccessibility="no">
                      <View style={styles.skeletonLine} />
                      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
                    </View>
                  ) : null}
                </View>
                <FilmChips dims={dims[id]} runtimeMinutes={runtimes.get(id)} />
              </View>
            );
          })}
        </View>

        <View style={styles.gBottom}>
          {notices.includes('max_runtime_dropped') && (
            <Text style={styles.notice}>{t('moodGauntlet.noticeRuntime')}</Text>
          )}
          {/* 1. sıradakini şampiyon yapar, sonraki turlarda elenen film olur */}
          {isFirstRound && (
            <OutlineAction label={t('moodGauntlet.justPick')} onPress={onJustPick} disabled={picked !== null} />
          )}
          <OutlineAction label={t('moodGauntlet.noneCta')} onPress={onNone} disabled={picked !== null} />
          <Text style={styles.noneSub}>{t('moodGauntlet.noneSub')}</Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}
