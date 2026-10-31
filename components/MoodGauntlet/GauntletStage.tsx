/**
 * Gauntlet: 4 film; 1v2, 3v4, final; "Hiçbiri". Swipe ve otomatik watchlist yazımı YOK — yalnız
 * dokunuş. Günlük gauntlet'in `PosterTile` (tam genişlik çift, aynı aralık) ve `RoundIndicator`
 * bileşenleri doğrudan kullanılır; mood filmi `GauntletFilm`'e istemcide eşlenir (kilitli tipe
 * dokunulmaz).
 *
 * Seçim tepkisi: dokunulan poster `remaining` (ölçek 1→1.06 spring), diğeri `eliminated`
 * (aşağı + sönme) — günlük gauntlet'in kazanan/elenen dili; geçişin bitiminde tur ilerler.
 * Gerekçe satırı gelince solarak girer; gelmezse (boş) satır hiç çizilmez.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { OutlineAction } from '@/components/gauntlet/OutlineAction';
import { PosterTile, type PosterTileAnimationState } from '@/components/gauntlet/PosterTile';
import { RoundIndicator } from '@/components/gauntlet/RoundIndicator';
import { DISSOLVE_DURATION } from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { reasonFor, type MoodNotice, type MoodSet } from '@/services/moodGauntlet';
import { hapticSelection } from '@/utils/haptics';
import { toGauntletFilm } from '@/utils/moodGauntletFilm';
import { currentPair, type MoodFlow } from '@/utils/moodGauntletFlow';
import { normalizePosterUrl } from '@/utils/posterUrl';

import { styles } from './styles';

/** Seçim animasyonunun süresi: kalan posterin yayı (token), sonra tur ilerler. */
const PICK_SETTLE_MS = DISSOLVE_DURATION.remainingPoster;

interface GauntletStageProps {
  set: MoodSet;
  /** film id → gerekçe (arkadan dolar). */
  reasons: Record<string, string>;
  flow: MoodFlow;
  notices: MoodNotice[];
  /** profile_name (yoksa hızlı mood başlığı / kullanıcı metni); üstteki mood çipi. */
  moodLabel: string | null;
  onChoose: (filmId: string) => void;
  onNone: () => void;
}

export function GauntletStage({
  set,
  reasons,
  flow,
  notices,
  moodLabel,
  onChoose,
  onNone,
}: GauntletStageProps): React.JSX.Element | null {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const pair = currentPair(flow);
  const [picked, setPicked] = useState<string | null>(null);
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

  const films = useMemo(() => {
    const map = new Map<string, ReturnType<typeof toGauntletFilm>>();
    for (const row of set.four) map.set(row.id, toGauntletFilm(row, (u) => normalizePosterUrl(u) ?? ''));
    return map;
  }, [set]);

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
  const sides = [pair.a, pair.b];
  const tileState = (id: string): PosterTileAnimationState =>
    picked === null ? 'idle' : id === picked ? 'remaining' : 'eliminated';

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.gTop}>
        {moodLabel !== null && moodLabel.length > 0 && (
          <View style={styles.moodChip} accessibilityLabel={t('moodGauntlet.moodChipLabel', { name: moodLabel })}>
            <Text style={styles.moodChipText} numberOfLines={1}>
              {moodLabel}
            </Text>
          </View>
        )}
        <RoundIndicator current={pair.round} />
      </View>

      <View style={styles.gMiddle}>
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
                />
                {reason !== null && (
                  <Animated.Text
                    style={styles.reason}
                    entering={reduced ? undefined : FadeIn.duration(DISSOLVE_DURATION.newContender)}
                  >
                    {reason}
                  </Animated.Text>
                )}
              </View>
            );
          })}
        </View>
        <Text style={styles.question} accessibilityRole="header">
          {t('moodGauntlet.question')}
        </Text>
      </View>

      <View style={styles.gBottom}>
        {notices.includes('max_runtime_dropped') && (
          <Text style={styles.notice}>{t('moodGauntlet.noticeRuntime')}</Text>
        )}
        <OutlineAction label={t('moodGauntlet.noneCta')} onPress={onNone} disabled={picked !== null} />
      </View>
    </ScrollView>
  );
}
