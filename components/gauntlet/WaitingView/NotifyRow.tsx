/**
 * NotifyRow — bildirim satırı: solda Bell, metin `body`. Chevron YOK.
 * Basılı durumda `graphite` zemin. Koşul (izin + ≥1 şampiyon) ve haptik
 * (`hapticLight`) GauntletShell'de — burada yalnız görünüm.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Bell } from 'phosphor-react-native';

import { color, size } from '@/constants/design/semantic';

import { styles } from './styles';

export interface NotifyRowProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function NotifyRow({ label, onPress, disabled = false }: NotifyRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}
    >
      <View style={styles.rowIcon}>
        <Bell size={size.iconAction} color={color.text.primary} weight="regular" />
      </View>
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}
