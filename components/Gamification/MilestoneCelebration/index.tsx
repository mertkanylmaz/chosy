/**
 * MilestoneCelebration — Full-screen overlay, milestone kazanıldığında gösterilir.
 *
 * Animasyon sekansi (CDO spec):
 *   t=0.0s — Overlay fade in
 *   t=0.1s — Konfeti başlar
 *   t=0.2s — Lumi girer (scale bounce)
 *   t=0.3s — Milestone icon bounce in
 *   t=0.4s — Title fade in down
 *   t=0.5s — Description fade in down
 *   t=0.6s — CTA button fade in down
 *   t=0.7s — Haptic heavy
 *
 * Kapatma: CTA veya arka plana basınca.
 * Otomatik kapatma YOK.
 *
 * Spec: .claude/specs/GAMIFICATION_UI_SPEC.md — Component 2
 */
import React, { useCallback, useEffect } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
} from 'react-native-reanimated';

import { BOUNCE_CONFIG, FAST_TIMING, TIMING_CONFIG } from '@/constants/animations';
import { hapticHeavy } from '@/utils/haptics';
import Lumi, { type LumiMood } from '@/components/Lumi';
import FilmSeridi from '@/components/FilmReelAnimation';
import ConfettiEffect from './ConfettiEffect';
import { useScalePress } from '@/hooks/useScalePress';

import { styles } from './styles';

// ─── Tipler ───────────────���──────────────────────────────────────────────────

export interface MilestoneCelebrationProps {
  /** Kutlanacak milestone bilgisi */
  milestone: {
    userMilestoneId: string;
    slug: string;
    title: string;
    description: string | null;
    icon: string | null;
    category: 'films' | 'streak' | 'watchlist' | 'mood';
    threshold: number;
  };
  /** Overlay görünür mü */
  visible: boolean;
  /** Kapatma callback'i — markMilestoneSeen çağrılır, sonraki milestone kontrol edilir */
  onDismiss: () => void;
}

// ─── Yardımcılar ────────────��───────────────────────���────────────────────────

/** Büyük milestone'lar → ekstra konfeti + farklı CTA */
const EPIC_SLUGS = new Set(['films_100', 'films_250', 'streak_30', 'curator_5']);

const EPIC_CTA: Record<string, string> = {
  films_100: 'Legendary! 🏆',
  films_250: 'Unstoppable! ⭐',
  streak_30: 'Incredible! 👑',
  curator_5: 'Go to My Watchlist →',
};

/** Milestone kategori/threshold'a göre Lumi mood */
function getLumiMood(slug: string): LumiMood {
  if (EPIC_SLUGS.has(slug)) return 'excited';
  return 'happy';
}

// ─── Component ────���───────────────────────────────────────────────────────────

const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = React.memo(({
  milestone,
  visible,
  onDismiss,
}) => {
  const { animatedStyle: ctaPressStyle, onPressIn, onPressOut } = useScalePress(0.95);
  const isEpic = EPIC_SLUGS.has(milestone.slug);
  const isCurator = milestone.slug === 'curator_5';
  const ctaText = EPIC_CTA[milestone.slug] ?? 'Keep Going!';
  const lumiMood = getLumiMood(milestone.slug);

  // Haptic feedback — overlay açıldıktan 0.7s sonra
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      hapticHeavy();
    }, 700);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={styles.overlay}
      entering={FadeIn.duration(TIMING_CONFIG.duration)}
      exiting={FadeOut.duration(FAST_TIMING.duration)}
    >
      {/* Arka plana basınca kapat */}
      <Pressable
        style={styles.overlay}
        onPress={handleDismiss}
      >
        {/* Konfeti */}
        <ConfettiEffect active={visible} intense={isEpic} />

        {/* İçerik — basınca propagation durmalı */}
        <Pressable style={styles.content} onPress={() => {}}>

          {/* Curator: FilmSeridi makarasi — diger milestone'lar: Lumi orb */}
          <Animated.View
            style={isCurator ? styles.mascotContainerCurator : styles.mascotContainer}
            entering={FadeInDown.springify()
              .damping(BOUNCE_CONFIG.damping)
              .stiffness(BOUNCE_CONFIG.stiffness)
              .delay(200)}
          >
            {isCurator ? (
              <FilmSeridi />
            ) : (
              <Lumi
                size="large"
                mood={lumiMood}
                showParticles
                showGlow
              />
            )}
          </Animated.View>

          {/* Milestone Icon */}
          {milestone.icon && (
            <Animated.Text
              style={styles.milestoneIcon}
              entering={FadeInDown.springify()
                .damping(BOUNCE_CONFIG.damping)
                .stiffness(BOUNCE_CONFIG.stiffness)
                .delay(300)}
            >
              {milestone.icon}
            </Animated.Text>
          )}

          {/* Title */}
          <Animated.Text
            style={styles.title}
            entering={FadeInDown.duration(300).delay(400)}
          >
            {milestone.title}
          </Animated.Text>

          {/* Description */}
          {milestone.description && (
            <Animated.Text
              style={styles.description}
              entering={FadeInDown.duration(300).delay(500)}
            >
              {milestone.description}
            </Animated.Text>
          )}

          {/* CTA Button */}
          <Animated.View
            entering={FadeInDown.duration(300).delay(600)}
            style={ctaPressStyle}
          >
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleDismiss}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              activeOpacity={1}
            >
              <Text style={styles.ctaText}>{ctaText}</Text>
            </TouchableOpacity>
          </Animated.View>

        </Pressable>
      </Pressable>
    </Animated.View>
  );
});

MilestoneCelebration.displayName = 'MilestoneCelebration';

export default MilestoneCelebration;
