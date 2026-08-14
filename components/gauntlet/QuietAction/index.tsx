/**
 * QuietAction — ikincil eylemler için metin bağlantısı. DESIGN_OS §10.1, §13.
 *
 * Buton DEĞİL — "İkisi de değil" / "Bunu izledim" gibi düşük vurgulu
 * eylemler için. Haptik bu bileşenin sorumluluğu değil, çağıran yer
 * tetikler (§8).
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { styles } from './styles';

interface QuietActionProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function QuietAction({ label, onPress, disabled = false }: QuietActionProps): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, disabled && styles.disabled]}>{label}</Text>
    </TouchableOpacity>
  );
}
