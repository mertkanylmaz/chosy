/**
 * OutlineAction — gauntlet turunun ikincil eylemleri için kenarlıklı buton.
 * V-3 Tur G1 (G6): "İkisi de değil" / "İzledim" metin bağlantısıydı
 * (QuietAction); artık iki eşit genişlikte, en az 44pt yüksekliğinde buton.
 *
 * QuietAction SİLİNMEDİ — bekleme, hata ve tükeniş dallarında metin
 * bağlantısı olarak kalır.
 *
 * Haptik bu bileşenin sorumluluğu değil, çağıran yer tetikler (§8) —
 * QuietAction ile aynı sözleşme. Gauntlet'in ret ve "İzledim" işleyicileri
 * zaten `hapticSelection` çalıyor; burada ikinci bir titreşim eklenmez.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { styles } from './styles';

interface OutlineActionProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function OutlineAction({ label, onPress, disabled = false }: OutlineActionProps): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.button, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
