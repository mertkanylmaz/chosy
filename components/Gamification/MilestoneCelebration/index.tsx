/**
 * MilestoneCelebration — Full-screen overlay, milestone kazanıldığında gösterilir.
 *
 * Animasyon sekansi (CDO spec):
 *   t=0.0s — Overlay fade in
 *   t=0.1s — Konfeti başlar
 *   t=0.2s — FilmSeridi makara animasyonu girer (scale bounce)
 *   t=0.3s — Milestone özel ikonu (Image) bounce in
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
import { Image, ImageSourcePropType, Pressable, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
} from 'react-native-reanimated';

import { BOUNCE_CONFIG, FAST_TIMING, TIMING_CONFIG } from '@/constants/animations';
import { hapticHeavy } from '@/utils/haptics';
import { GamificationIcons } from '@/constants/icons';
import FilmSeridi from '@/components/FilmReelAnimation';
import ConfettiEffect from './ConfettiEffect';
import { useScalePress } from '@/hooks/useScalePress';

import { styles } from './styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

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

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

/** Büyük milestone'lar → ekstra konfeti */
const EPIC_SLUGS = new Set(['films_100', 'films_250', 'streak_30', 'curator_5']);

/** CTA metinleri — emoji kaldırıldı, custom ikonlar kullanılıyor */
const EPIC_CTA: Record<string, string> = {
  films_100: 'Legendary!',
  films_250: 'Unstoppable!',
  streak_30: 'Incredible!',
  curator_5: 'Go to My Watchlist',
};

/** Slug'a göre özel milestone ikonu — tanımlı değilse null (FilmSeridi görünür) */
function getMilestoneImage(slug: string): ImageSourcePropType | null {
  switch (slug) {
    case 'films_100':
    case 'films_250':
      return GamificationIcons.milestone100;
    case 'streak_30':
      return GamificationIcons.streakPeak;
    case 'curator_5':
      return GamificationIcons.curator;
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = React.memo(({
  milestone,
  visible,
  onDismiss,
}) => {
  const { animatedStyle: ctaPressStyle, onPressIn, onPressOut } = useScalePress(0.95);
  const isEpic = EPIC_SLUGS.has(milestone.slug);
  const ctaText = EPIC_CTA[milestone.slug] ?? 'Keep Going!';
  const milestoneImage = getMilestoneImage(milestone.slug);

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

          {/* FilmSeridi makara animasyonu — tüm milestone'larda standart arka plan */}
          <Animated.View
            style={styles.mascotContainer}
            entering={FadeInDown.springify()
              .damping(BOUNCE_CONFIG.damping)
              .stiffness(BOUNCE_CONFIG.stiffness)
              .delay(200)}
          >
            <FilmSeridi />
          </Animated.View>

          {/* Milestone özel ikonu — slug'a özel PNG, yoksa gösterilmez */}
          {milestoneImage && (
            <Animated.View
              style={styles.milestoneImageWrap}
              entering={FadeInDown.springify()
                .damping(BOUNCE_CONFIG.damping)
                .stiffness(BOUNCE_CONFIG.stiffness)
                .delay(300)}
            >
              <Image
                source={milestoneImage}
                style={styles.milestoneImage}
                resizeMode="contain"
              />
            </Animated.View>
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
