/**
 * GameShell — Tüm oyunları saran ortak wrapper.
 *
 * Header: geri butonu + oyun adı
 * Progress: attempt göstergesi (dolu/boş noktalar)
 * Children: oyun içeriği
 * KeyboardAvoidingView: keyboard açıldığında içerik yukarı kayar
 * paddingBottom: 83 (tab bar clearance)
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { hapticLight } from '@/utils/haptics';

interface GameShellProps {
  /** Oyun başlığı */
  title: string;
  /** Mevcut deneme sayısı */
  currentAttempt: number;
  /** Maksimum deneme sayısı */
  maxAttempts: number;
  /** Oyun içeriği */
  children: React.ReactNode;
  /** Progress göstergesini gizle (opsiyonel) */
  hideProgress?: boolean;
}

export function GameShell({
  title,
  currentAttempt,
  maxAttempts,
  children,
  hideProgress = false,
}: GameShellProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 83 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            hapticLight();
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <CaretLeft size={24} color={Colors.textWhite} weight="duotone" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress */}
      {!hideProgress && maxAttempts > 1 && (
        <View style={styles.progressRow}>
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < currentAttempt ? styles.dotUsed : styles.dotEmpty,
              ]}
            />
          ))}
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingBottom: 83,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    height: 48,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Theme.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotUsed: {
    backgroundColor: Colors.accentPrimary,
  },
  dotEmpty: {
    backgroundColor: Colors.bgSubtle,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.md,
  },
});
