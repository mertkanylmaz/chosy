/**
 * InteractiveStart — power user giriş ekranı (Varyasyon 3).
 * 4 mood kartı + serbest metin giriş ile hızlı discovery başlatır.
 * 10+ session geçmiş kullanıcılar için tasarlanmıştır.
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { hapticMedium, hapticSelection } from '@/utils/haptics';

import styles from './styles';

/** Mood kart verisi */
interface MoodCardData {
  id: string;
  emoji: string;
  label: string;
  description: string;
  /** MoodContext'e set edilecek preset metin (AI'a gider, dil bağımsız) */
  preset: string;
}

/** 4 mood seçeneği — statik preset İngilizce kalır (AI input) */
const MOOD_PRESETS: ReadonlyArray<{ id: string; emoji: string; preset: string }> = [
  { id: 'calm',       emoji: '😌', preset: 'I feel calm and peaceful tonight, looking for something serene' },
  { id: 'reflective', emoji: '🧠', preset: 'I am in a reflective, thoughtful mood and want something deep' },
  { id: 'energetic',  emoji: '⚡', preset: 'I feel energetic and want something fast-paced and thrilling' },
  { id: 'melancholic',emoji: '🌧', preset: 'I am feeling melancholic and want something emotional and moving' },
];

/** Tek mood kartı bileşeni — kendi scale animasyonunu yönetir */
interface MoodCardProps {
  item: MoodCardData;
  selected: boolean;
  onPress: () => void;
}

function MoodCard({ item, selected, onPress }: MoodCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    hapticSelection();
    scale.value = withSpring(selected ? 1 : 1.05, {
      damping: 12,
      stiffness: 180,
    });
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={styles.cardTouchable}
    >
      <Animated.View
        style={[
          styles.card,
          selected && styles.cardSelected,
          animatedStyle,
        ]}
      >
        <Text style={styles.cardEmoji}>{item.emoji}</Text>
        <Text style={styles.cardLabel}>{item.label}</Text>
        <Text style={styles.cardDescription}>{item.description}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

/**
 * Power user giriş deneyimi.
 * Kart veya metin seçimi ile direkt feed'e yönlendirir.
 */
export default function InteractiveStart() {
  const router = useRouter();
  const { t } = useLanguage();
  const { setPresetMoodText } = useMood();

  /** Çevirili mood kartları — preset AI input olduğu için statik kalır */
  const MOOD_CARDS: ReadonlyArray<MoodCardData> = MOOD_PRESETS.map((p) => ({
    ...p,
    label: t(`entry.${p.id}`),
    description: t(`entry.${p.id}Desc`),
  }));

  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [moodText, setMoodText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  /** CTA aktif mi — kart veya metin dolu ise */
  const canStart = selectedCard !== null || moodText.trim().length > 0;

  const handleCardPress = (id: string) => {
    setSelectedCard((prev) => (prev === id ? null : id));
    // Kart seçilince text input temizle
    if (id !== selectedCard) {
      setMoodText('');
    }
  };

  const handleTextChange = (text: string) => {
    setMoodText(text);
    // Metin yazılınca kart seçimini temizle
    if (text.length > 0) {
      setSelectedCard(null);
    }
  };

  const handleStartDiscovery = () => {
    if (!canStart) return;
    hapticMedium();

    if (selectedCard) {
      const card = MOOD_CARDS.find((c) => c.id === selectedCard);
      if (card) {
        setPresetMoodText(card.preset);
      }
    } else if (moodText.trim().length > 0) {
      setPresetMoodText(moodText.trim());
    }

    router.replace('/(tabs)');
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <LinearGradient
      colors={[Colors.background, Colors.bgCard, Colors.bgCard]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo */}
            <Text style={styles.logo}>chosy.ai</Text>

            {/* Başlık */}
            <Text style={styles.title}>{t('entry.chooseVibe')}</Text>

            {/* 2x2 Mood kart grid */}
            <View style={styles.grid}>
              {MOOD_CARDS.map((item) => (
                <MoodCard
                  key={item.id}
                  item={item}
                  selected={selectedCard === item.id}
                  onPress={() => handleCardPress(item.id)}
                />
              ))}
            </View>

            {/* OR divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Serbest metin giriş */}
            <TextInput
              style={[
                styles.textInput,
                inputFocused && styles.textInputFocused,
              ]}
              placeholder={t('entry.typeHowYouFeel')}
              placeholderTextColor={Colors.textGrey}
              value={moodText}
              onChangeText={handleTextChange}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />

            {/* CTA butonu */}
            <TouchableOpacity
              style={[styles.ctaTouch, !canStart && styles.ctaDisabled]}
              onPress={handleStartDiscovery}
              activeOpacity={canStart ? 0.85 : 1}
              disabled={!canStart}
            >
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                style={styles.ctaButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.ctaText}>{t('entry.startDiscovery')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Skip linki */}
            <TouchableOpacity
              style={styles.skipLink}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>{t('entry.skipToFeed')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
