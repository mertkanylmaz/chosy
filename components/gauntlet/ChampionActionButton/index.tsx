/**
 * ChampionActionButton — şampiyon ekranının tam genişlik eylemleri.
 * V-3 Tur G2 (C6): Watch Now / Save for later / Share, alt alta, ≥ 48pt.
 *
 * Üç görünüm:
 *   marquee → düz `marquee` dolgu, `ink` metin (V3-D2: gradient YOK).
 *             `marquee` bu ekranda YALNIZ Watch Now'da.
 *   filled  → `bone` dolgu, `ink` metin — Watch Now yokken Save for later.
 *   outline → dolgusuz, `graphite` kenar, `bone` metin.
 *
 * Haptik ve iş mantığı çağıran yerde (§8, OutlineAction sözleşmesi).
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

import type { Icon as PhosphorIcon } from 'phosphor-react-native';

import { color, size } from '@/constants/design/semantic';

import { styles } from './styles';

export type ChampionActionVariant = 'marquee' | 'filled' | 'outline';

interface ChampionActionButtonProps {
  label: string;
  icon: PhosphorIcon;
  variant: ChampionActionVariant;
  onPress: () => void;
  disabled?: boolean;
  /** VoiceOver'a "meşgul" — görsel durumla aynı şey değil (PrimaryAction ile aynı). */
  busy?: boolean;
}

export function ChampionActionButton({
  label,
  icon: IconComponent,
  variant,
  onPress,
  disabled = false,
  busy = false,
}: ChampionActionButtonProps): React.JSX.Element {
  const onDark = variant === 'outline';
  const contentColor = onDark ? color.text.primary : color.surface.base;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.button, styles[variant], disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
    >
      <IconComponent
        size={size.iconAction}
        color={contentColor}
        weight={variant === 'outline' ? 'regular' : 'fill'}
      />
      <Text style={[styles.text, onDark ? styles.textOnDark : styles.textOnFill]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
