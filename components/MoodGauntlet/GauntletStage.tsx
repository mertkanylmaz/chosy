/**
 * Gauntlet: 4 film + tek cümle gerekçe; 1v2, 3v4, final; "Hiçbiri". Swipe ve otomatik
 * watchlist yazımı YOK — yalnız dokunuş. Günlük `PosterTile` / `RoundIndicator` doğrudan
 * kullanılır; mood filmi `GauntletFilm`'e istemcide eşlenir (kilitli tipe dokunulmaz).
 */
import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PosterTile } from '@/components/gauntlet/PosterTile';
import { QuietAction } from '@/components/gauntlet/QuietAction';
import { RoundIndicator } from '@/components/gauntlet/RoundIndicator';
import { useLanguage } from '@/contexts/LanguageContext';
import { reasonFor, type MoodNotice, type MoodSet } from '@/services/moodGauntlet';
import { hapticSelection } from '@/utils/haptics';
import { toGauntletFilm } from '@/utils/moodGauntletFilm';
import { currentPair, type MoodFlow } from '@/utils/moodGauntletFlow';
import { normalizePosterUrl } from '@/utils/posterUrl';

import { styles } from './styles';

interface GauntletStageProps {
  set: MoodSet;
  flow: MoodFlow;
  notices: MoodNotice[];
  onChoose: (filmId: string) => void;
  onNone: () => void;
}

export function GauntletStage({ set, flow, notices, onChoose, onNone }: GauntletStageProps): React.JSX.Element | null {
  const { t } = useLanguage();
  const pair = currentPair(flow);

  const films = useMemo(() => {
    const map = new Map<string, ReturnType<typeof toGauntletFilm>>();
    for (const row of set.four) map.set(row.id, toGauntletFilm(row, (u) => normalizePosterUrl(u) ?? ''));
    return map;
  }, [set]);

  if (!pair) return null;
  const sides = [pair.a, pair.b];

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.center}>
        <RoundIndicator current={pair.round} />
      </View>
      <Text style={styles.question} accessibilityRole="header">
        {t('moodGauntlet.question')}
      </Text>

      <View style={styles.pairRow}>
        {sides.map((id) => {
          const film = films.get(id);
          if (!film) return null;
          const reason = reasonFor(set.reasons, id);
          return (
            <View key={id} style={styles.pairCol}>
              <PosterTile
                film={film}
                onPress={() => {
                  hapticSelection();
                  onChoose(id);
                }}
              />
              {reason !== null && <Text style={styles.reason}>{reason}</Text>}
            </View>
          );
        })}
      </View>

      {notices.includes('max_runtime_dropped') && (
        <Text style={styles.notice}>{t('moodGauntlet.noticeRuntime')}</Text>
      )}

      <View style={styles.noneSlot}>
        <QuietAction label={t('moodGauntlet.noneCta')} onPress={onNone} />
      </View>
    </ScrollView>
  );
}
