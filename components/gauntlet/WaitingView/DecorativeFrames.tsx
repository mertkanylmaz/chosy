/**
 * DecorativeFrames — "dört film" duyusunu veren dört DEKORATİF çerçeve.
 *
 * Veri isteği, poster, metin içeriği, ikon, `onPress`, buton rolü YOK. Statik:
 * animasyon yok (DESIGN_OS §7.4). Tüm grup erişilebilirlik ağacından gizli —
 * VoiceOver çerçeveleri okumaz. Işık: tek tonlu (`beam` düşük alfa) statik
 * `LinearGradient`, üstten aşağı solar (§5.3 "tek renk").
 *
 * Çerçeve numaraları (01–04) saf süstür; metin ölçeği 1.4x ile sınırlı.
 */
import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { color } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';

import { MONO_MAX_FONT_SCALE, isWaitingCompact } from './styles';
import { frameStyles } from './frameStyles';

const FRAME_NUMBERS = ['01', '02', '03', '04'] as const;

/** Işık: `beam@12%` (token) → tamamen saydam, aynı ton. */
const LIGHT_COLORS = [color.accent.fill, withAlpha(color.accent.active, 0)] as const;
const LIGHT_LOCATIONS = [0, 0.75] as const;

export function DecorativeFrames(): React.JSX.Element {
  const { height } = useWindowDimensions();
  const compact = isWaitingCompact(height);

  return (
    <View
      style={frameStyles.group}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {FRAME_NUMBERS.map((number) => (
        <View key={number} style={frameStyles.cell}>
          <View style={[frameStyles.frame, compact && frameStyles.frameCompact]}>
            <LinearGradient
              colors={LIGHT_COLORS}
              locations={LIGHT_LOCATIONS}
              style={frameStyles.light}
            />
          </View>
          <Text style={frameStyles.number} maxFontSizeMultiplier={MONO_MAX_FONT_SCALE}>
            {number}
          </Text>
        </View>
      ))}
    </View>
  );
}
