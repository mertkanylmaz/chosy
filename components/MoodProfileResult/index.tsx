import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { EmotionIcons, TasteDNAIcons } from '@/constants/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  EmotionalState,
  PacePreference,
  TasteProfile,
} from '@/types';
import styles from './styles';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** EmotionalState içindeki en baskın duyguyu döndürür */
function dominantEmotionKey(state: EmotionalState): keyof EmotionalState {
  const entries = Object.entries(state) as [keyof EmotionalState, number][];
  return entries.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
}

/** EmotionIcons — constants/icons.ts'ten import edilen single source of truth */
const EMOTION_ICON = EmotionIcons;

// ─── Card sub-components ──────────────────────────────────────────────────────

interface CardProps {
  t: (key: string) => string;
}

/** Emotion boyutu kartı */
function EmotionCard({ emotionKey, t }: CardProps & { emotionKey: keyof EmotionalState }) {
  const emotionKeyMap: Record<keyof EmotionalState, string> = {
    joy: t('moodProfile.emotionJoyful'),
    sadness: t('moodProfile.emotionMelancholic'),
    anger: t('moodProfile.emotionIntense'),
    fear: t('moodProfile.emotionAnxious'),
    surprise: t('moodProfile.emotionCurious'),
    disgust: t('moodProfile.emotionCritical'),
    anticipation: t('moodProfile.emotionEager'),
    trust: t('moodProfile.emotionSerene'),
  };
  const emotionDescMap: Record<keyof EmotionalState, string> = {
    joy: t('moodProfile.descJoyful'),
    sadness: t('moodProfile.descMelancholic'),
    anger: t('moodProfile.descIntense'),
    fear: t('moodProfile.descAnxious'),
    surprise: t('moodProfile.descCurious'),
    disgust: t('moodProfile.descCritical'),
    anticipation: t('moodProfile.descEager'),
    trust: t('moodProfile.descSerene'),
  };
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconBg}>
          <Image source={EMOTION_ICON[emotionKey]} style={styles.cardIcon} resizeMode="contain" />
        </View>
      </View>
      <Text style={styles.cardLabel}>{t('moodProfile.labelEmotion')}</Text>
      <Text style={styles.cardValue}>{emotionKeyMap[emotionKey]}</Text>
      <Text style={styles.cardDesc}>{emotionDescMap[emotionKey]}</Text>
    </View>
  );
}

/** Energy Level boyutu kartı — progress bar ile */
function EnergyCard({ level, t }: CardProps & { level: number }) {
  const pct = `${Math.round(level * 100)}%`;

  function energyLabel(v: number): string {
    if (v < 0.2) return t('moodProfile.energyVeryLow');
    if (v < 0.4) return t('moodProfile.energyLow');
    if (v < 0.55) return t('moodProfile.energyMediumLow');
    if (v < 0.7) return t('moodProfile.energyMedium');
    if (v < 0.85) return t('moodProfile.energyMediumHigh');
    return t('moodProfile.energyHigh');
  }

  function energyDesc(v: number): string {
    if (v < 0.4) return t('moodProfile.descEnergyLow');
    if (v < 0.65) return t('moodProfile.descEnergyMedium');
    return t('moodProfile.descEnergyHigh');
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconBg}>
          <Image source={TasteDNAIcons.cardEnergy} style={styles.cardIcon} resizeMode="contain" />
        </View>
      </View>
      <Text style={styles.cardLabel}>{t('moodProfile.labelEnergy')}</Text>
      <Text style={styles.cardValue}>{energyLabel(level)}</Text>
      <Text style={styles.cardDesc}>{energyDesc(level)}</Text>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: pct as `${number}%` }]} />
      </View>
    </View>
  );
}

/** Pacing boyutu kartı */
function PacingCard({ pace, t }: CardProps & { pace: PacePreference }) {
  const paceValueMap: Record<PacePreference, string> = {
    slow: t('moodProfile.paceSlow'),
    medium: t('moodProfile.paceMedium'),
    fast: t('moodProfile.paceFast'),
  };
  const paceDescMap: Record<PacePreference, string> = {
    slow: t('moodProfile.descPaceSlow'),
    medium: t('moodProfile.descPaceMedium'),
    fast: t('moodProfile.descPaceFast'),
  };
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconBg}>
          <Image source={TasteDNAIcons.cardFilmTaste} style={styles.cardIcon} resizeMode="contain" />
        </View>
      </View>
      <Text style={styles.cardLabel}>{t('moodProfile.labelPacing')}</Text>
      <Text style={styles.cardValue}>{paceValueMap[pace]}</Text>
      <Text style={styles.cardDesc}>{paceDescMap[pace]}</Text>
    </View>
  );
}

/** Thematic Depth boyutu kartı — progress bar ile */
function ThematicDepthCard({ depth, t }: CardProps & { depth: number }) {
  const pct = `${Math.round(depth * 100)}%`;

  function depthLabel(v: number): string {
    if (v < 0.3) return t('moodProfile.depthLight');
    if (v < 0.55) return t('moodProfile.depthModerate');
    if (v < 0.75) return t('moodProfile.depthDeep');
    return t('moodProfile.depthProfound');
  }

  function depthDesc(v: number): string {
    if (v < 0.3) return t('moodProfile.descDepthLight');
    if (v < 0.55) return t('moodProfile.descDepthModerate');
    return t('moodProfile.descDepthDeep');
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconBg}>
          <Image source={TasteDNAIcons.cardGenre} style={styles.cardIcon} resizeMode="contain" />
        </View>
      </View>
      <Text style={styles.cardLabel}>{t('moodProfile.labelColorTone')}</Text>
      <Text style={styles.cardValue}>{depthLabel(depth)}</Text>
      <Text style={styles.cardDesc}>{depthDesc(depth)}</Text>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: pct as `${number}%` }]} />
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  /** Ayrıştırılmış 12 boyutlu profil */
  profile: TasteProfile;
  /** "Browse Movies" butonuna basıldığında çağrılır */
  onBrowseMovies: () => void;
  /** Geri okuna basıldığında çağrılır; sağlanmazsa router.back() çalışır */
  onBack?: () => void;
  /** "Share Your Mood" butonuna basıldığında çağrılır (opsiyonel) */
  onShareMood?: () => void;
  /** Share capture devam ediyor mu */
  isShareCapturing?: boolean;
}

/**
 * Mood analizi sonucunu 2x2 boyut kartlarıyla gösteren ekran.
 * Kartlar staggered fade-in animasyonuyla açılır.
 * Tasarım referansı: design-reference/08-mood-profile-result.png
 */
export default function MoodProfileResult({ profile, onBrowseMovies, onBack, onShareMood, isShareCapturing }: Props) {
  const router = useRouter();
  const { t } = useLanguage();

  const cardAnims = useRef(
    [0, 1, 2, 3].map(() => new Animated.Value(0))
  ).current;

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Header giriş
    const headerAnim_ = Animated.timing(headerAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    });

    // Kartlar stagger
    const staggerAnim = Animated.stagger(
      90,
      cardAnims.map(anim =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        })
      )
    );

    headerAnim_.start();
    staggerAnim.start();

    // Cleanup: component unmount olursa animasyonlar durdurulur.
    // Aksi hâlde "onAnimatedValueUpdate with no listeners" WARN oluşur.
    return () => {
      headerAnim_.stop();
      staggerAnim.stop();
    };
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const emotionKey = dominantEmotionKey(profile.emotional_state);

  /** Dominant emotion → lokalize profil adı */
  const profileNameMap: Record<keyof EmotionalState, string> = {
    joy: t('moodProfile.emotionJoyful'),
    sadness: t('moodProfile.emotionMelancholic'),
    anger: t('moodProfile.emotionIntense'),
    fear: t('moodProfile.emotionAnxious'),
    surprise: t('moodProfile.emotionCurious'),
    disgust: t('moodProfile.emotionCritical'),
    anticipation: t('moodProfile.emotionEager'),
    trust: t('moodProfile.emotionCalm'),
  };
  const currentProfileName = profileNameMap[emotionKey];

  const cardNodes = [
    <EmotionCard emotionKey={emotionKey} t={t} />,
    <EnergyCard level={profile.energy_level} t={t} />,
    <PacingCard pace={profile.pace_preference} t={t} />,
    <ThematicDepthCard depth={profile.thematic_depth} t={t} />,
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundGradient]}
        style={styles.gradient}
      >
        {/* Header bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.trophyWrap}>
            <Ionicons name="trophy" size={20} color={Colors.gold} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: headerAnim,
                transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              },
            ]}
          >
            {t('moodProfile.title')}
          </Animated.Text>

          {/* Profile name badge */}
          <Animated.View
            style={[
              styles.profileBadge,
              { opacity: headerAnim },
            ]}
          >
            <Text style={styles.profileBadgeLabel}>{t('moodProfile.currentProfile')}</Text>
            <Text style={styles.profileBadgeName}>{currentProfileName}.</Text>
          </Animated.View>

          {/* Description */}
          <Animated.Text
            style={[styles.description, { opacity: headerAnim }]}
          >
            {t('moodProfile.description')}
          </Animated.Text>

          {/* 2x2 card grid */}
          <View style={styles.grid}>
            {cardNodes.map((node, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.animWrapper,
                  {
                    opacity: cardAnims[i],
                    transform: [
                      {
                        translateY: cardAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [24, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {node}
              </Animated.View>
            ))}
          </View>

          {/* Share Your Mood button */}
          {onShareMood && (
            <TouchableOpacity
              onPress={onShareMood}
              activeOpacity={0.85}
              style={styles.shareWrapper}
              disabled={isShareCapturing}
            >
              <View style={styles.shareBtn}>
                <Text style={styles.shareBtnText}>
                  {isShareCapturing ? t('share.sharing') : t('share.shareYourMood')}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Browse Movies button */}
          <TouchableOpacity
            onPress={onBrowseMovies}
            activeOpacity={0.85}
            style={styles.browseWrapper}
          >
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.browseBtn}
            >
              <Text style={styles.browseBtnText}>{t('moodProfile.browseMovies')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
