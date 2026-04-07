/**
 * PersonaBadge — Kullanicinin sinefil arketipini gosteren kompakt rozet.
 *
 * Profile Header'da avatar altinda gosterilir.
 * Arketip rengiyle renklendirilmis arka plan + ikon + isim.
 *
 * Prop `archetypeId` null ise "Discover your type" placeholder gosterir.
 */

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';
import { getArchetype } from '@/constants/archetypes';

import { createStyles } from './styles';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PersonaBadgeProps {
  /** Kullanicinin arketip ID'si (1-12) — null ise placeholder gosterilir */
  archetypeId: number | null;
  /**
   * Rozete basilinca cagrilir (orn. Retake Test ekranina yonlendirme).
   * Verilmezse dokunulabilir olmaz.
   */
  onPress?: () => void;
}

// ─── Bilesen ──────────────────────────────────────────────────────────────────

/**
 * Sinefil arketip rozeti.
 * Arketip biliniyorsa: [icon] [name]
 * Bilinmiyorsa: [sparkle] "Discover your type"
 */
export default function PersonaBadge({ archetypeId, onPress }: PersonaBadgeProps) {
  const { t } = useLanguage();
  const archetype = getArchetype(archetypeId);

  const styles = createStyles(
    archetype?.colorPrimary ?? '#8B5CF6',
    archetype?.colorDim ?? 'rgba(139,92,246,0.14)',
  );

  const content = (
    <View style={styles.badge}>
      <Text style={styles.icon}>
        {archetype ? archetype.icon : '✨'}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {archetype
          ? t(archetype.nameKey)
          : t('profile.personaPlaceholder')}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
