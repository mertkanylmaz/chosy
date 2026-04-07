/**
 * MoodShareCard — "Mood of the Day" paylasim template'i (1080x1350 PNG).
 *
 * Filmsiz, mood odakli kart. Gradient arka plan + dekoratif parcaciklar.
 * Mood metni + AI profil ozeti (opsiyonel).
 *
 * Spec: .claude/specs/SOCIAL_SHARE_SPEC.md — Component 2
 */
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@/constants/Colors';
import { i18n } from '@/constants/i18n';

import { styles } from './styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface MoodShareCardProps {
  /** Kullanicinin mood metni */
  moodText: string;
  /** AI profil ozeti (opsiyonel) */
  profile?: {
    energyLevel: number;       // 0-1
    thematicDepth: number;     // 0-1
    endingPreference: string;  // hopeful | bittersweet | open | tragic | triumphant
  } | null;
}

// ─── Yardimcilar ──────────────────────────────────────────────────────────────

/** Enerji seviyesine gore etiket */
function getEnergyLabel(level: number): string {
  if (level < 0.35) return `\u{1F60C} ${i18n.t('share.energyCalm')}`;
  if (level > 0.65) return `\u{26A1} ${i18n.t('share.energyEnergetic')}`;
  return `\u{1F60A} ${i18n.t('share.energyBalanced')}`;
}

/** Derinlige gore etiket */
function getDepthLabel(depth: number): string {
  if (depth > 0.65) return `\u{1F3AD} ${i18n.t('share.depthDeep')}`;
  if (depth < 0.35) return `\u{1F3AA} ${i18n.t('share.depthLight')}`;
  return `\u{1F4D6} ${i18n.t('share.depthModerate')}`;
}

/** Bitis tercihine gore etiket */
function getEndingLabel(pref: string): string {
  const map: Record<string, string> = {
    hopeful: `\u{1F3AC} ${i18n.t('share.endingHopeful')}`,
    bittersweet: `\u{1F3AC} ${i18n.t('share.endingBittersweet')}`,
    open: `\u{1F3AC} ${i18n.t('share.endingOpen')}`,
    tragic: `\u{1F3AC} ${i18n.t('share.endingTragic')}`,
    triumphant: `\u{1F3AC} ${i18n.t('share.endingTriumphant')}`,
  };
  return map[pref] ?? '\u{1F3AC} ' + pref;
}

/** Rastgele dekoratif parcaciklar */
const PARTICLES = ['\u2726', '\u2234', '\u2726', '\u2234', '\u2726', '\u2234', '\u2726'];

// ─── Component ────────────────────────────────────────────────────────────────

const MoodShareCard = React.forwardRef<View, MoodShareCardProps>(
  ({ moodText, profile }, ref) => {
    const summaryLines = useMemo(() => {
      if (!profile) return null;
      return [
        getEnergyLabel(profile.energyLevel),
        getDepthLabel(profile.thematicDepth),
        getEndingLabel(profile.endingPreference),
      ];
    }, [profile]);

    return (
      <View style={styles.offscreen}>
        <View ref={ref} style={styles.moodCard} collapsable={false}>
          {/* Gradient arka plan */}
          <LinearGradient
            colors={[Colors.background, Colors.cardSolid]}
            style={styles.moodCardGradient}
          />

          {/* Dekoratif parcaciklar */}
          <View style={styles.particles}>
            {PARTICLES.map((p, i) => (
              <Text key={i} style={styles.particle}>{p}</Text>
            ))}
          </View>

          {/* "Today I feel" */}
          <Text style={styles.todayLabel}>{i18n.t('share.todayIFeel')}</Text>

          {/* Mood metni */}
          <View style={styles.moodCardQuote}>
            <Text style={styles.moodQuoteOpen}>{'\u201C'}</Text>
            <Text style={styles.moodCardText} numberOfLines={5}>
              {moodText}
            </Text>
            <Text style={styles.moodQuoteClose}>{'\u201D'}</Text>
          </View>

          {/* Profil ozeti */}
          {summaryLines && (
            <View style={styles.profileSummary}>
              <Text style={styles.profileSummaryText}>
                {summaryLines.join('  \u00B7  ')}
              </Text>
            </View>
          )}

          {/* Branding */}
          <View style={styles.branding}>
            <Text style={styles.brandText}>{i18n.t('share.brand')}</Text>
            <Text style={styles.tagline}>{i18n.t('share.tagline')}</Text>
          </View>
        </View>
      </View>
    );
  },
);

MoodShareCard.displayName = 'MoodShareCard';

export default MoodShareCard;
