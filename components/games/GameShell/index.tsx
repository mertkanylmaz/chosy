/**
 * GameShell — Tüm oyunları saran ortak wrapper (Festival Layer).
 *
 * Header: geri butonu + (opsiyonel eyebrow) + serif oyun adı + opsiyonel sağ slot
 * Progress: altın segment çubuğu (harcanan deneme dolu)
 * Children: oyun içeriği
 * KeyboardAvoidingView: keyboard açıldığında içerik yukarı kayar
 *
 * ── YERLEŞİM SÖZLEŞMESİ ───────────────────────────────────────────────────
 * Yatay 16px padding'i BU bileşen verir (`styles.content`). Oyunlar kendi
 * içeriklerine `paddingHorizontal` EKLEMEZ ve genişlik hesabında
 * `gameContentWidth()` kullanır — ayrıntı: constants/gameLayout.ts.
 *
 * Alt boşluk `insets.bottom`'dan gelir. Eskiden sabit `paddingBottom: 83`
 * vardı (tab bar payı), ama oyun ekranları root Stack'te — tab bar yok.
 * O sabit 83px ölü alan yaratıp içeriği dikeyde sıkıştırıyordu.
 */
import React from 'react';
import { KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CaretLeft } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
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
  /**
   * İçerik alanının yatay padding'i. Varsayılan `true`.
   *
   * `false` verildiğinde içerik tam kanamalı (edge-to-edge) olur ve padding
   * sorumluluğu ekrana geçer — tam genişlik portre/poster ızgaraları için.
   */
  contentPadding?: boolean;
  /**
   * Header ve içeriğin ARKASINA çizilen ambiyans katmanı (gradyan, parıltı).
   * Mutlak konumlu, dokunma almaz.
   *
   * Verilmezse ekran düz `Colors.background` kalır — beş oyunun davranışı
   * değişmez. Şu an yalnız ImposterPilot kullanıyor (bkz. pilotTokens.ts).
   */
  background?: React.ReactNode;
  /**
   * Harcanan ilerleme segmentlerinin gradyanı. Verilmezse düz altın kullanılır
   * (Festival Layer varsayılanı).
   */
  progressGradient?: readonly [string, string];
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
  contentPadding = true,
  background,
  progressGradient,
}: GameShellProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          // Sabit 83 (tab bar payı) kaldırıldı — oyunlar tab bar'ın içinde değil.
          // Gesture bar'ı olmayan cihazlarda insets.bottom 0 gelir, o yüzden taban.
          paddingBottom: Math.max(insets.bottom, Theme.spacing.sm),
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // paddingBottom 83 iken klavye telafisi de 83 idi; padding gidince
      // offset de gitmeli, yoksa klavye açılınca içerik 83px fazla kayar.
      keyboardVerticalOffset={0}
    >
      {/*
        Ambiyans — her şeyin arkasında, dokunma almaz.
        Negatif inset'ler: mutlak konumlu çocuk ebeveynin PADDING kenarına göre
        yerleşir, yani safe-area padding'i kadar içeride başlar. Gradyanın
        durum çubuğunun ve gesture bar'ın altını da boyaması gerekiyor.
      */}
      {background ? (
        <View
          style={[
            styles.backdrop,
            { top: -insets.top, bottom: -Math.max(insets.bottom, Theme.spacing.sm) },
          ]}
          pointerEvents="none"
        >
          {background}
        </View>
      ) : null}

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
          {Array.from({ length: maxAttempts }).map((_, i) => {
            const used = i < currentAttempt;
            if (used && progressGradient) {
              return (
                <LinearGradient
                  key={i}
                  colors={progressGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.segment}
                />
              );
            }
            return (
              <View
                key={i}
                style={[styles.segment, used ? styles.segmentUsed : styles.segmentEmpty]}
              />
            );
          })}
        </View>
      )}

      {/* Content — padding sözleşmesi: yatay boşluğu burası verir */}
      <View style={contentPadding ? styles.content : styles.contentFlush}>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}
