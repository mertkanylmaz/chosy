/**
 * WhyThisMovieCard — Ipucu-cozum iliski ogrenme karti.
 *
 * Oyun sonunda gosterilir: hangi ipucu neyi isaret ediyordu,
 * decoy filmlerle cozum filmi arasindaki ortak ozellikler.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Lightbulb } from 'phosphor-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';
import type { ClueExplanation, DecoyConnection } from '@/types/game';
import { formatClueLine } from './formatClue';
import { styles, ACCENT } from './styles';

interface WhyThisMovieCardProps {
  /** Ipucu aciklamalari — ham degerler, bicimlendirme burada yapilir */
  clueExplanations: ClueExplanation[];
  /** Decoy-cozum baglantilari */
  decoyConnections: DecoyConnection[];
}

/**
 * WhyThisMovieCard — "Neden Bu Film?" ogrenme karti.
 */
export function WhyThisMovieCard({
  clueExplanations,
  decoyConnections,
}: WhyThisMovieCardProps) {
  const { t } = useLanguage();

  if (clueExplanations.length === 0 && decoyConnections.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(600).duration(400)} style={styles.whyContainer}>
      {/* Header */}
      <View style={styles.whyTitleRow}>
        <View style={styles.whyIconWrap}>
          <Lightbulb size={16} color={ACCENT} weight="duotone" />
        </View>
        <Text style={styles.whyTitle}>{t('games.detective.why_title')}</Text>
      </View>

      <Text style={styles.whySubtitle}>{t('games.detective.why_subtitle')}</Text>

      {/* Clue explanations */}
      {clueExplanations.map((exp, idx) => (
        <View key={`clue-${idx}`} style={styles.whyBullet}>
          <View style={styles.whyBulletDot} />
          <Text style={styles.whyBulletText}>
            {formatClueLine(exp.clue_type, exp.clue_value, t)}
          </Text>
        </View>
      ))}

      {/* Decoy connections */}
      {decoyConnections.length > 0 && (
        <>
          <View style={styles.whyDivider} />
          {decoyConnections.map((dc, idx) => (
            <View key={`decoy-${idx}`} style={styles.whyBullet}>
              <View style={styles.whyBulletDot} />
              <Text style={styles.whyBulletText}>
                {t('games.detective.why_decoy', {
                  film: dc.decoy_title,
                  trait: dc.shared_traits.join(', '),
                })}
              </Text>
            </View>
          ))}
        </>
      )}
    </Animated.View>
  );
}
