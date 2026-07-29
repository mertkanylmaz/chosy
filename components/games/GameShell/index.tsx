/**
 * GameShell — Tüm oyunları saran ortak wrapper (Festival Layer).
 *
 * Header: geri butonu + (opsiyonel eyebrow) + serif oyun adı + opsiyonel sağ slot
 * Progress: altın segment çubuğu (harcanan deneme dolu)
 * Children: oyun içeriği
 * KeyboardAvoidingView: keyboard açıldığında içerik yukarı kayar
 * paddingBottom: 83 (tab bar clearance)
 */
import React from 'react';
import { KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';

import { styles } from './styles';

interface GameShellProps {
  /** Oyun başlığı — serif, header ortası */
  title: string;
  /**
   * Başlığın üstündeki mikro etiket — "CASE #041", "LOG #128".
   * Büyük harfe stil katmanında çevrilir, çağıran tarafta uppercase yazmaya gerek yok.
   */
  subtitle?: string;
  /** Header sağ slotu — paylaş, bilgi vb. Verilmezse boş bırakılır (başlık ortalı kalsın diye) */
  headerRight?: React.ReactNode;
  /** Mevcut deneme sayısı */
  currentAttempt: number;
  /** Maksimum deneme sayısı */
  maxAttempts: number;
  /** Oyun içeriği */
  children: React.ReactNode;
  /** Progress göstergesini gizle (opsiyonel) */
  hideProgress?: boolean;
}

/**
 * Oyun ekranlarının ortak kabuğu. Header, ilerleme çubuğu ve klavye davranışını
 * tek yerde toplar — oyunlar yalnız kendi içeriklerini render eder.
 */
export function GameShell({
  title,
  subtitle,
  headerRight,
  currentAttempt,
  maxAttempts,
  children,
  hideProgress = false,
}: GameShellProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 83 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSlot}
          accessibilityRole="button"
          accessibilityLabel={t('games.common.back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => {
            hapticLight();
            router.back();
          }}
        >
          <CaretLeft size={24} color={Colors.textWhite} weight="duotone" />
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          {subtitle ? (
            <Text style={styles.eyebrow} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        </View>

        <View style={styles.headerSlot}>{headerRight}</View>
      </View>

      {/* Progress — harcanan deneme altın, kalan sönük */}
      {!hideProgress && maxAttempts > 1 && (
        <View
          style={styles.progressRow}
          accessibilityRole="progressbar"
          accessibilityLabel={t('games.common.progress_label', {
            current: currentAttempt,
            total: maxAttempts,
          })}
        >
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <View
              key={i}
              style={[styles.segment, i < currentAttempt ? styles.segmentUsed : styles.segmentEmpty]}
            />
          ))}
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </KeyboardAvoidingView>
  );
}
