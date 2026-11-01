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
 *  - Faz 2-4: turlar boyunca üstte 4 poster şeridi (kazanan vurgulu, elenen %35 opaklık);
 *    "Dörtlün" girişi en az 1,5 sn (dokunarak geçilebilir).
 *
 * Seçim tepkisi: dokunulan poster `remaining`, diğeri `eliminated`; geçişin bitiminde tur ilerler.
 */
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { OutlineAction } from '@/components/gauntlet/OutlineAction';
import { PosterTile, type PosterTileAnimationState } from '@/components/gauntlet/PosterTile';
import { RoundIndicator } from '@/components/gauntlet/RoundIndicator';
import { DISSOLVE_DURATION } from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { reasonFor, type MoodNotice, type MoodSet } from '@/services/moodGauntlet';
import { hapticSelection } from '@/utils/haptics';
import type { FilmDims } from '@/utils/moodFilmFacts';
import { toGauntletFilm } from '@/utils/moodGauntletFilm';
import { currentPair, stripItems, type MoodFlow } from '@/utils/moodGauntletFlow';
import { normalizePosterUrl } from '@/utils/posterUrl';

import { FilmChips } from './FilmChips';
import { styles } from './styles';

/** Seçim animasyonunun süresi: kalan posterin yayı (token), sonra tur ilerler. */
const PICK_SETTLE_MS = DISSOLVE_DURATION.remainingPoster;
/** "Dörtlün" ızgarasının ekranda kalma süresi: en az 1,5 sn (dokunuşla atlanabilir). */
export const FOUR_INTRO_MS = 1500;
export const FOUR_INTRO_REDUCED_MS = 1500;

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
  onNone,
  onJustPick,
}: GauntletStageProps): React.JSX.Element | null {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const pair = currentPair(flow);
  const [picked, setPicked] = useState<string | null>(null);
  const [introDoneFor, setIntroDoneFor] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Yeni tur / yeni dörtlü: seçim durumu sıfırlanır.
  const roundKey = pair ? `${set.setId}:${pair.round}` : set.setId;
  useEffect(() => {
    setPicked(null);
  }, [roundKey]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const showIntro = pair !== null && pair.round === 1 && introDoneFor !== set.setId;
  useEffect(() => {
    if (!showIntro) return;
    const id = setTimeout(() => setIntroDoneFor(set.setId), reduced ? FOUR_INTRO_REDUCED_MS : FOUR_INTRO_MS);
    return () => clearTimeout(id);
  }, [showIntro, set.setId, reduced]);

  const films = useMemo(() => {
    const map = new Map<string, ReturnType<typeof toGauntletFilm>>();
    for (const row of set.four) map.set(row.id, toGauntletFilm(row, (u) => normalizePosterUrl(u) ?? ''));
    return map;
  }, [set]);
  const runtimes = useMemo(() => new Map(set.four.map((r) => [r.id, r.runtime])), [set]);

  const handlePick = useCallback(
    (id: string) => {
      if (picked !== null) return;
      hapticSelection();
      setPicked(id);
      timer.current = setTimeout(() => onChoose(id), reduced ? 0 : PICK_SETTLE_MS);
    },
    [picked, onChoose, reduced],
  );

  if (!pair) return null;

  if (showIntro) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.introRoot}
        onPress={() => setIntroDoneFor(set.setId)}
        accessibilityRole="button"
        accessibilityLabel={t('moodGauntlet.yourFourA11y')}
      >
        <Animated.View
          style={styles.introInner}
          entering={reduced ? undefined : FadeIn.duration(DISSOLVE_DURATION.newContender)}
          exiting={reduced ? undefined : FadeOut.duration(DISSOLVE_DURATION.newContender)}
        >
          {moodLabel !== null && moodLabel.length > 0 && (
            <Text style={styles.introMood} numberOfLines={1}>
              {moodLabel}
            </Text>
          )}
          <Text style={styles.introTitle} accessibilityRole="header">
            {t('moodGauntlet.yourFour')}
          </Text>
          <View style={styles.introGrid}>
            {set.four.map((row) => {
              const uri = normalizePosterUrl(row.poster_url);
              return (
                <View key={row.id} style={styles.introCell}>
                  {uri !== null && <Image source={{ uri }} style={styles.heroImage} contentFit="cover" />}
                </View>
              );
            })}
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  const sides = [pair.a, pair.b];
  const tileState = (id: string): PosterTileAnimationState =>
    picked === null ? 'idle' : id === picked ? 'remaining' : 'eliminated';
  const isFirstRound = pair.round === 1;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
                  animationState={tileState(id)}
                  onPress={() => handlePick(id)}
                  metaMode="yearOnly"
                />
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
