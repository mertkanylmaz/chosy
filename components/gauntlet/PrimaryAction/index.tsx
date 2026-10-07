/**
 * PrimaryAction — birincil eylem butonu. DESIGN_OS v4.1 §17.1, C.9b-UI L-2.
 *
 * "Primary eylem = `beam@12%` dolgu + `@40%` kenar, **içerik katmanında**."
 * Cam DEĞİL — v4.1'de cam yalnız navigasyon ve sistem sheet'lerinde.
 *
 * `QuietAction`'ın karşıtı: o sessiz bir metin bağlantısıdır (ikincil), bu
 * ekranın tek yüksek vurgulu eylemidir. Bir ekranda BİRDEN FAZLA olmamalı —
 * iki birincil eylem hiç birincil eylem olmaması demektir.
 *
 * Haptik bu bileşenin sorumluluğu değil, çağıran yer tetikler (§8).
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { styles } from './styles';

interface PrimaryActionProps {
  label: string;
  onPress: () => void;
  /**
   * Eylem hazır değil (ör. sağlayıcı verisi yükleniyor). Buton YERİNDE
   * kalır, yalnız sönükleşir — birincil eylemi sonradan "pop-in" ettirmek
   * düzen zıplatır ve en pahalı yerde yapar (C2e).
   */
  disabled?: boolean;
  /** VoiceOver'a "şu an meşgul" demek için — görsel durumla aynı şey değil. */
  busy?: boolean;
  /**
   * `gold` — Spotlight oynanış CTA'sı (DESIGN_OS 07.10.2026): düz marquee dolgu,
   * ink metin, kenar/parıltı yok. Varsayılan `default` aynen kalır (gauntlet).
   */
  variant?: 'default' | 'gold';
  /**
   * Düğümün ref'i — çağıran VoiceOver odağını programatik taşıyabilsin diye
   * (ör. sayfa kapanınca CTA'ya dön). Verilmezse hiçbir şey değişmez.
   */
  buttonRef?: React.Ref<React.ElementRef<typeof TouchableOpacity>>;
}

export function PrimaryAction({
  label,
  onPress,
  disabled = false,
  busy = false,
  variant = 'default',
  buttonRef,
}: PrimaryActionProps): React.JSX.Element {
  return (
    <TouchableOpacity
      ref={buttonRef}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.button,
        variant === 'gold' && styles.buttonGold,
        disabled && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
    >
      <Text style={[styles.label, variant === 'gold' && styles.labelGold]}>{label}</Text>
    </TouchableOpacity>
  );
}
