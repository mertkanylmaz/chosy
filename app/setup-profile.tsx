/**
 * Setup Profile Screen — Kullanıcı adı ve avatar seçimi.
 *
 * Akış:
 *  1. Sosyal auth ile yeni kayıt olan kullanıcıyı karşılar (auth.tsx → isNewUser → buraya)
 *  2. Kullanıcı adı girer (2-20 alfanümerik karakter, validation anlık)
 *  3. 12 emoji avatar arasından birini seçer
 *  4. "Hadi Başlayalım" → authService.updateUserProfile → /(tabs)
 *
 * DB: users.username + users.avatar_url güncellenir (auth_id ile match)
 * Tasarım: auth.tsx ile aynı dil ve ton — Lumi YOK, basit ve odaklı
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { updateUserProfile } from '@/services/authService';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { logger } from '@/utils/logger';

// ─── Avatar Veri Tanımı ────────────────────────────────────────────────────────

/** Tek bir avatar seçeneğini tanımlar */
interface AvatarOption {
  id: string;
  emoji: string;
  /** Arka plan rengi — zinc scale veya tematik */
  color: string;
}

/**
 * 12 emoji avatar — film türleri ve kişilikler.
 * avatar_url olarak emoji string'in kendisi kaydedilir.
 */
const AVATARS: AvatarOption[] = [
  { id: '1',  emoji: '🎬', color: Colors.accentPrimary },  // Yönetmen — violet
  { id: '2',  emoji: '🌙', color: Colors.swipeDown },      // Gece kuşu — blue
  { id: '3',  emoji: '🔥', color: Colors.error },           // Aksiyon — red
  { id: '4',  emoji: '🌸', color: Colors.pink },            // Romantik — pink
  { id: '5',  emoji: '🏆', color: Colors.gold },            // Ödül avcısı — gold
  { id: '6',  emoji: '🚀', color: Colors.swipeDown },       // Sci-fi — blue
  { id: '7',  emoji: '👻', color: Colors.bgSubtle },        // Korku — zinc-700
  { id: '8',  emoji: '🌿', color: Colors.success },         // Drama — green
  { id: '9',  emoji: '⚡', color: Colors.warning },          // Gerilim — amber
  { id: '10', emoji: '🎭', color: Colors.accentHover },     // Tiyatro — violet-600
  { id: '11', emoji: '🐉', color: Colors.goldDark },        // Fantezi — amber-dark
  { id: '12', emoji: '❄️', color: Colors.swipeDown },       // Sakin — blue
];

/** Kullanıcı adı validation regex: 2-20 alfanümerik karakter */
const USERNAME_REGEX = /^[a-zA-Z0-9]{2,20}$/;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Profil kurulum ekranı.
 * Yeni kullanıcıdan kullanıcı adı ve avatar seçmesini ister.
 */
export default function SetupProfileScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [username, setUsername] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('1');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Kullanıcı adını anlık validate eder.
   * Boşken hata göstermez (henüz dokunulmamış sayılır).
   *
   * @param value - Input'taki anlık değer
   * @returns Geçerliyse true
   */
  function validateUsername(value: string): boolean {
    if (value.length === 0) {
      setUsernameError(null);
      return false;
    }
    if (!USERNAME_REGEX.test(value)) {
      setUsernameError(t('setup.usernameError'));
      return false;
    }
    setUsernameError(null);
    return true;
  }

  /**
   * Input onChange handler — state günceller + validation çalıştırır.
   *
   * @param value - TextInput'tan gelen yeni değer
   */
  function handleUsernameChange(value: string): void {
    setUsername(value);
    validateUsername(value);
  }

  /**
   * Avatar seçim handler'ı.
   *
   * @param id - Seçilen avatar'ın id'si
   */
  function handleAvatarSelect(id: string): void {
    void hapticLight();
    setSelectedAvatarId(id);
  }

  /**
   * "Hadi Başlayalım" butonu — profili kaydeder ve feed'e yönlendirir.
   * Username boşsa veya geçersizse kaydetmez, hata gösterir.
   */
  async function handleContinue(): Promise<void> {
    if (saving) return;

    // Son validation — boş bırakmışsa hata göster
    if (!validateUsername(username) || username.length === 0) {
      setUsernameError(t('setup.usernameError'));
      return;
    }

    const selectedAvatar = AVATARS.find(av => av.id === selectedAvatarId);
    const avatarUrl = selectedAvatar?.emoji ?? '🎬';

    void hapticLight();
    setSaving(true);

    try {
      const result = await updateUserProfile(username.trim(), avatarUrl);

      if (result.success) {
        void hapticSuccess();
        router.replace('/(tabs)');
      } else {
        logger.error('[setup-profile] updateUserProfile hatası:', result.error);
        // Kritik değil — devam ettir (non-blocking graceful)
        void hapticSuccess();
        router.replace('/(tabs)');
      }
    } catch (err) {
      logger.error('[setup-profile] beklenmedik hata:', err);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  }

  /**
   * "Atla" link handler'ı — profil kurulumunu atlayıp feed'e geçer.
   */
  function handleSkip(): void {
    void hapticLight();
    router.replace('/(tabs)');
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const isUsernameValid = USERNAME_REGEX.test(username);
  const canSubmit = isUsernameValid && !saving;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Başlık Alanı ─────────────────────────────────────────────────── */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>{t('setup.usernameTitle')}</Text>
            <Text style={styles.subtitle}>{t('setup.usernameSubtitle')}</Text>
          </View>

          {/* Kullanıcı Adı Input ─────────────────────────────────────────── */}
          <View style={styles.inputSection}>
            <View style={[
              styles.inputWrapper,
              usernameError !== null && styles.inputWrapperError,
              isUsernameValid && styles.inputWrapperValid,
            ]}>
              <Ionicons
                name="person-outline"
                size={18}
                color={usernameError !== null ? Colors.error : Colors.textTertiary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('setup.usernamePlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={() => void handleContinue()}
              />
              {isUsernameValid && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={Colors.success}
                  style={styles.inputTrailingIcon}
                />
              )}
            </View>

            {/* Validation Hatası */}
            {usernameError !== null && (
              <Text style={styles.errorText}>{usernameError}</Text>
            )}
          </View>

          {/* Avatar Seçici ───────────────────────────────────────────────── */}
          <View style={styles.avatarSection}>
            <Text style={styles.avatarTitle}>{t('setup.avatarTitle')}</Text>
            <Text style={styles.avatarSubtitle}>{t('setup.avatarSubtitle')}</Text>

            {/* 4 sütunlu grid */}
            <View style={styles.avatarGrid}>
              {AVATARS.map(avatar => {
                const isSelected = avatar.id === selectedAvatarId;
                return (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[
                      styles.avatarItem,
                      { backgroundColor: avatar.color + '33' },   // 20% opacity bg
                      isSelected && {
                        backgroundColor: avatar.color + '55',      // 33% opacity bg seçili
                        borderColor: avatar.color,
                      },
                    ]}
                    onPress={() => handleAvatarSelect(avatar.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                    {isSelected && (
                      <View style={[styles.selectedBadge, { backgroundColor: avatar.color }]}>
                        <Ionicons name="checkmark" size={9} color={Colors.textOnAccent} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* "İstediğin zaman değiştirebilirsin" notu */}
            <Text style={styles.changeLaterText}>{t('setup.changeLater')}</Text>
          </View>

        </ScrollView>

        {/* Alt CTA Alanı ────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, !canSubmit && styles.continueButtonDisabled]}
            onPress={() => void handleContinue()}
            activeOpacity={0.85}
            disabled={!canSubmit}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textOnAccent} size="small" />
            ) : (
              <Text style={styles.continueButtonText}>{t('setup.continue')}</Text>
            )}
          </TouchableOpacity>

          {/* Atla linki */}
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
          >
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  keyboardView: {
    flex: 1,
  },

  // ─── Scroll ─────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.xxl,
    paddingBottom: Theme.spacing.lg,
  },

  // ─── Başlık ──────────────────────────────────────────────────────────────
  headerSection: {
    marginBottom: Theme.spacing.xl,
  },
  title: {
    ...Theme.typography.h1,          // Inter Bold 24
    fontSize: 28,                     // override
    color: Colors.textWhite,
    marginBottom: Theme.spacing.sm,
    lineHeight: 36,
  },
  subtitle: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // ─── Input ───────────────────────────────────────────────────────────────
  inputSection: {
    marginBottom: Theme.spacing.xl,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Theme.spacing.md,
    height: 56,
  },
  inputWrapperError: {
    borderColor: Colors.error,
  },
  inputWrapperValid: {
    borderColor: Colors.success + '80',  // 50% opacity — success token, dim varyantı yok
  },
  inputIcon: {
    marginRight: Theme.spacing.sm,
  },
  inputTrailingIcon: {
    marginLeft: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    ...Theme.typography.body,
    color: Colors.textWhite,
    paddingVertical: 0,   // Android'de extra padding önle
  },
  errorText: {
    ...Theme.typography.caption,
    color: Colors.error,
    marginTop: Theme.spacing.xs,
    marginLeft: Theme.spacing.xs,
  },

  // ─── Avatar ──────────────────────────────────────────────────────────────
  avatarSection: {
    marginBottom: Theme.spacing.lg,
  },
  avatarTitle: {
    ...Theme.typography.h2,
    color: Colors.textWhite,
    marginBottom: Theme.spacing.xs,
  },
  avatarSubtitle: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    marginBottom: Theme.spacing.lg,
  },

  /** 4 sütunlu grid — flexWrap ile satır otomatik kırılır */
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },

  /** Her bir avatar hücre — 4 sütun için ~23% genişlik */
  avatarItem: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarEmoji: {
    fontSize: 28,
    lineHeight: 36,
  },

  /** Seçili avatarın köşe onay rozeti */
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: Theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  changeLaterText: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // ─── Footer CTA ──────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.white05,
  },
  continueButton: {
    width: '100%',
    height: 54,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    ...Theme.typography.h3,
    color: Colors.textOnAccent,
    // fontWeight kaldırıldı — h3 zaten SemiBold
  },
  skipText: {
    ...Theme.typography.body,
    color: Colors.textTertiary,
  },
});
