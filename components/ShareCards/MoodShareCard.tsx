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
  if (level < 0.35) return '\u{1F60C} Calm';
  if (level > 0.65) return '\u{26A1} Energetic';
  return '\u{1F60A} Balanced';
}

/** Derinlige gore etiket */
function getDepthLabel(depth: number): string {
  if (depth > 0.65) return '\u{1F3AD} Deep';
  if (depth < 0.35) return '\u{1F3AA} Light';
  return '\u{1F4D6} Moderate';
}

/** Bitis tercihine gore etiket */
function getEndingLabel(pref: string): string {
  const map: Record<string, string> = {
    hopeful: '\u{1F3AC} Hopeful ending',
    bittersweet: '\u{1F3AC} Bittersweet ending',
    open: '\u{1F3AC} Open ending',
    tragic: '\u{1F3AC} Tragic ending',
    triumphant: '\u{1F3AC} Triumphant ending',
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
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 24,
            }}
          />

          {/* Dekoratif parcaciklar */}
          <View style={styles.particles}>
            {PARTICLES.map((p, i) => (
              <Text key={i} style={styles.particle}>{p}</Text>
            ))}
          </View>

          {/* "Today I feel" */}
          <Text style={styles.todayLabel}>Today I feel</Text>

          {/* Mood metni */}
          <View style={styles.moodCardQuote}>
            <Text style={styles.quoteOpen}>{'\u201C'}</Text>
            <Text style={styles.moodCardText} numberOfLines={5}>
              {moodText}
            </Text>
            <Text style={styles.quoteClose}>{'\u201D'}</Text>
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
            <Text style={styles.brandText}>Chosy.ai</Text>
            <Text style={styles.tagline}>Discover movies by your mood</Text>
          </View>
        </View>
      </View>
    );
  },
);

MoodShareCard.displayName = 'MoodShareCard';

export default MoodShareCard;
