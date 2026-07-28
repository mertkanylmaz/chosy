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
import { styles, TEAL } from './styles';

interface WhyThisMovieCardProps {
  /** Ipucu aciklamalari */
  clueExplanations: Array<{
    clue_type: string;
    clue_value: string;
    connection: string;
  }>;
  /** Decoy-cozum baglantilari */
  decoyConnections: Array<{
    decoy_title: string;
    shared_trait: string;
  }>;
  /** Opsiyonel eglenceli bilgi */
  funFact?: string;
}

/**
 * WhyThisMovieCard — "Neden Bu Film?" ogrenme karti.
 */
export function WhyThisMovieCard({
  clueExplanations,
  decoyConnections,
  funFact,
}: WhyThisMovieCardProps) {
  const { t } = useLanguage();

  if (clueExplanations.length === 0 && decoyConnections.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(600).duration(400)} style={styles.whyContainer}>
      {/* Header */}
      <View style={styles.whyTitleRow}>
        <View style={styles.whyIconWrap}>
          <Lightbulb size={16} color={TEAL} weight="duotone" />
        </View>
        <Text style={styles.whyTitle}>{t('games.detective.why_title')}</Text>
      </View>

      <Text style={styles.whySubtitle}>{t('games.detective.why_subtitle')}</Text>

      {/* Clue explanations */}
      {clueExplanations.map((exp, idx) => (
        <View key={`clue-${idx}`} style={styles.whyBullet}>
          <View style={styles.whyBulletDot} />
          <Text style={styles.whyBulletText}>{exp.connection}</Text>
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
                  trait: dc.shared_trait,
                })}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Fun fact */}
      {funFact && (
        <>
          <View style={styles.whyDivider} />
          <Text style={styles.whyFunFact}>{funFact}</Text>
        </>
      )}
    </Animated.View>
  );
}
