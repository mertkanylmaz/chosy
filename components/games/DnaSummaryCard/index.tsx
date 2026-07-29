/**
 * DnaSummaryCard — Cinema DNA boyut cubuklari (Festival Layer).
 *
 * Rank ve skor artik HubHero'da gosteriliyor; bu kart yalnizca 6 boyutu
 * cizer. DNA sorgusu da hub'da bir kez yapiliyor (useCinemaDna) — kart
 * kendi cagrisini atmaz, veriyi prop olarak alir.
 */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';
import { DNA_DIMENSIONS, type CinemaDna } from '@/hooks/useCinemaDna';
import { trackHubDnaCardViewed } from '@/utils/gameAnalytics';

import { styles } from './styles';

interface DnaSummaryCardProps {
  /** null ise kart hic render edilmez (henuz oyun oynamamis kullanici) */
  dna: CinemaDna | null;
}

/**
 * Kullanicinin 6 DNA boyutunu yatay cubuklar halinde gosterir.
 * visual_sense henuz hicbir oyundan beslenmiyorsa "yakinda" olarak isaretlenir.
 */
export function DnaSummaryCard({ dna }: DnaSummaryCardProps): React.JSX.Element | null {
  const { t } = useLanguage();

  useEffect(() => {
    if (dna) trackHubDnaCardViewed();
  }, [dna]);

  if (!dna) return null;

  return (
    <Animated.View entering={FadeInUp.duration(300)} style={styles.card}>
      <Text style={styles.sectionLabel}>{t('games.dna.section_title')}</Text>

      <View style={styles.dimensionsContainer}>
        {DNA_DIMENSIONS.map((dim) => {
          const value = Math.round(dna[dim] ?? 0);
          // visual_sense su an yalnizca FadeIn/Detective'ten besleniyor;
          // hic sinyal yoksa bos cubuk yerine acik "yakinda" gosterilir.
          const isComingSoon = dim === 'visual_sense' && value === 0;

          return (
            <View key={dim} style={styles.dimensionRow}>
              <Text style={styles.dimensionLabel}>{t(`games.dna.${dim}`)}</Text>
              <View style={styles.barTrack}>
                {isComingSoon ? (
                  <View style={styles.comingSoonOverlay}>
                    <Text style={styles.comingSoonText}>{t('games.hub.coming_soon')}</Text>
                  </View>
                ) : (
                  <View style={[styles.barFill, { width: `${Math.min(value, 100)}%` }]} />
                )}
              </View>
              <Text style={styles.dimensionValue}>{isComingSoon ? '--' : value}</Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}
