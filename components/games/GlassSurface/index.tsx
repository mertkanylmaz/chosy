import React, { useEffect, useRef } from 'react';
import {
  Platform,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { BlurView } from 'expo-blur';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { logger } from '@/utils/logger';

import { styles } from './styles';

/**
 * Cam yüzeyin render moduzu.
 * - `blur`  — gerçek BlurView, arkasındaki içerik görünür
 * - `solid` — opak `chromeGlassFallback` zemini
 */
export type GlassMode = 'blur' | 'solid';

/**
 * Platform gerçekten canlı bulanıklık destekliyor mu?
 *
 * Android'de `expo-blur` `experimentalBlurMethod` gerektirir, düşük seviye
 * cihazlarda kare düşürür ve tint davranışı iOS'la eşleşmez. Bu yüzden
 * Android varsayılanı `solid`'dir — bu bir hata değil, bilinçli bir platform
 * kararıdır ve `__DEV__` altında bir kez loglanır (sessiz değil).
 */
export const GLASS_SUPPORTED = Platform.OS === 'ios';

/** `GLASS_SUPPORTED`'a göre çözülen varsayılan mod. */
export const DEFAULT_GLASS_MODE: GlassMode = GLASS_SUPPORTED ? 'blur' : 'solid';

interface GlassSurfaceProps {
  /** Camın üstünde duran içerik */
  children: React.ReactNode;
  /**
   * Render modu. Verilmezse `DEFAULT_GLASS_MODE` kullanılır.
   * `solid` vermek fallback'i **açıkça** seçmek demektir — QA sırasında
   * opak zeminin okunurluğunu doğrulamak için bu prop'u kullan.
   */
  mode?: GlassMode;
  /** Dış köşe yarıçapı. İç node `Theme.concentric(radius, 1)` alır. */
  radius?: number;
  /** BlurView yoğunluğu (yalnız `blur` modunda) */
  intensity?: number;
  /** Dış node stili — konumlandırma, boyut, gölge override'ları */
  style?: StyleProp<ViewStyle>;
  /** İç node stili — padding, hizalama */
  contentStyle?: StyleProp<ViewStyle>;
  /** Gölgeyi kapat (ör. ekranın kenarına yapışan header'da) */
  noShadow?: boolean;
  /** Kenarlığı kapat (ör. üst kenarı ekran dışına taşan yüzeylerde) */
  noBorder?: boolean;
  /**
   * Dış node'un ölçüm callback'i. Yüzen chrome'da içeriğin üst boşluğunu
   * hesaplamak için gerekli — cam katmanın gerçek yüksekliğini verir.
   */
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * Chrome cam yüzeyi — Liquid Glass'ın RN'deki gerçekçi karşılığı.
 *
 * **Nerede kullanılır:** yalnız kontrol/navigasyon katmanı — GameShell header,
 * progress barı, submit/aksiyon barı, yüzen rozetler.
 * **Nerede kullanılmaz:** içerik yüzeyleri (kart, poster, still, liste). Onlar
 * düz `bgCard` + `goldHairline` kalır — DESIGN_SYSTEM.md Festival Layer Kural 5.
 *
 * Sağlama sorusu: *bu yüzeyin altında gerçekten kayan bir içerik var mı?*
 * Hayırsa cam anlamsızdır, düz `View` kullan.
 *
 * İki node zorunlu: `overflow:'hidden'` ile gölge aynı düğümde çalışmadığı için
 * dış node radius + kenarlık + gölge taşır, iç node bulanıklığı kırpar.
 * İç radius concentric kuralla türetilir (`iç = dış − kenarlık`).
 *
 * Kaynak karar: `.claude/apple-design-standard-2026.md` §6.2
 */
export function GlassSurface({
  children,
  mode,
  radius = Theme.borderRadius.lg,
  intensity = 24,
  style,
  contentStyle,
  noShadow = false,
  noBorder = false,
  onLayout,
}: GlassSurfaceProps): React.JSX.Element {
  const resolvedMode: GlassMode = mode ?? DEFAULT_GLASS_MODE;
  const hasLoggedFallback = useRef(false);

  useEffect(() => {
    if (resolvedMode === 'solid' && mode === undefined && !hasLoggedFallback.current) {
      hasLoggedFallback.current = true;
      logger.warn(
        `[GlassSurface] Platform "${Platform.OS}" canlı bulanıklık desteklemiyor — ` +
          'opak chromeGlassFallback zeminine düşüldü. Bu beklenen davranış; ' +
          'okunurluk kontrolü için mode="solid" ile manuel test et.',
      );
    }
  }, [resolvedMode, mode]);

  const borderWidth = noBorder ? 0 : 1;

  const outerStyle: StyleProp<ViewStyle> = [
    styles.outer,
    {
      borderRadius: radius,
      borderWidth,
      borderColor: noBorder ? 'transparent' : Colors.chromeGlassBorder,
    },
    !noShadow && styles.shadow,
    style,
  ];

  const innerRadius = Theme.concentric(radius, borderWidth);

  if (resolvedMode === 'solid') {
    return (
      <View style={outerStyle} onLayout={onLayout}>
        <View
          style={[
            styles.inner,
            styles.innerSolid,
            { borderRadius: innerRadius },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={outerStyle} onLayout={onLayout}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[styles.inner, { borderRadius: innerRadius }, contentStyle]}
      >
        {children}
      </BlurView>
    </View>
  );
}
