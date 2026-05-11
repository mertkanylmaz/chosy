/**
 * ArchetypeCard — Kullanıcının sinefil arketipini gösteren kart.
 *
 * archetypeId varsa → arketip ikonu + adı + kısa açıklaması
 * archetypeId yoksa → "kalibrasyonu tamamla" CTA'sı
 *
 * Arka plan rengi arketipin colorDim tokenından türetilir.
 * CDO polish: icon glow, kart shadow, badge border uygulandı.
 */

import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { getArchetype } from '@/constants/archetypes';
import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { styles } from './styles';

// ─── Prop Tipi ────────────────────────────────────────────────────────────────

export interface ArchetypeCardProps {
  /** Kalibrasyon sonucu arketip ID'si (1–12); null ise kalibre edilmemiş */
  archetypeId: number | null;
  /** Toplam kaydedilen film sayısı */
  filmCount: number;
  /** Kalibrasyona yönlendirmek için callback */
  onCalibrate?: () => void;
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────

/**
 * Sinefil arketip kartı.
 *
 * Kalibre edilmişse arketip gösterilir; değilse kullanıcıya
 * kalibrasyonu tamamlaması için CTA gösterilir.
 */
export default React.memo(function ArchetypeCard({
  archetypeId,
  filmCount,
  onCalibrate,
}: ArchetypeCardProps) {
  const { t } = useLanguage();
  const archetype = getArchetype(archetypeId);

  return (
    <Animated.View
      entering={FadeInDown.delay(150).duration(400).springify().damping(18)}
      style={styles.wrapper}
    >
      <View
        style={[
          styles.card,
          archetype
            ? {
                backgroundColor: archetype.colorDim,
                borderColor: archetype.colorPrimary + '40',
              }
            : undefined,
        ]}
      >
        {/* ── Başlık satırı ─────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionLabel}>{t('home.sinephileTitle')}</Text>
          {filmCount > 0 && (
            <View style={styles.filmCountBadge}>
              <Text style={styles.filmCountText}>
                {t('home.filmsSaved', { count: filmCount })}
              </Text>
            </View>
          )}
        </View>

        {/* ── Arketip bilgisi ───────────────────────────────────────────── */}
        {archetype ? (
          <View style={styles.archetypeRow}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: archetype.colorPrimary + '25',
                  shadowColor: archetype.colorPrimary,
                  ...(styles.iconGlow as Record<string, unknown>),
                },
              ]}
            >
              <Image source={archetype.image} style={styles.iconEmoji} resizeMode="contain" />
            </View>
            <View style={styles.archetypeInfo}>
              <Text
                style={[styles.archetypeName, { color: archetype.colorPrimary }]}
              >
                {t(archetype.nameKey)}
              </Text>
              <Text style={styles.archetypeDesc} numberOfLines={2}>
                {t(archetype.descKey)}
              </Text>
            </View>
          </View>
        ) : (
          /* ── Kalibrasyon CTA ──────────────────────────────────────────── */
          <TouchableOpacity
            style={styles.calibrateCTA}
            onPress={onCalibrate}
            activeOpacity={0.7}
          >
            <Ionicons
              name="sparkles-outline"
              size={20}
              color={Colors.accentPrimary}
            />
            <View style={styles.calibrateText}>
              <Text style={styles.calibrateTitle}>{t('home.noArchetype')}</Text>
              <Text style={styles.calibrateHint}>{t('home.noArchetypeHint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textGrey} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
})
