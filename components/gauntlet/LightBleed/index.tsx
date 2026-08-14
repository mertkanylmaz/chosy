/**
 * LightBleed — ışık sızması zemini. DESIGN_OS §5, §13.
 *
 * PLACEHOLDER — bu iş yalnızca statik `color.surface.base` (ink) zemin
 * döner. Gerçek uygulama (poster hâkim renginden ışıma) C.2b/c'nin işi;
 * `films.dominant_color` henüz istemciye bağlı değil (§5.4).
 *
 * Prop arayüzü gerçek şekliyle tanımlı — `dominantColor` şimdilik
 * kullanılmaz, böylece C.2b/c geldiğinde bu dosyanın DIŞINDAN hiçbir şey
 * değişmez. Geçiş süresi `DISSOLVE_DURATION.lightBleed` tanımlı dursun,
 * kullanılmasa bile — C.2b/c'nin bulacağı yer burası.
 */
import React from 'react';
import { View } from 'react-native';

import type { OklchColor } from '@/types/gauntlet';

import { styles } from './styles';

interface LightBleedProps {
  /** Poster hâkim rengi — C.2b/c bağlanana kadar kullanılmaz */
  dominantColor?: OklchColor;
}

export function LightBleed({ dominantColor: _dominantColor }: LightBleedProps): React.JSX.Element {
  return <View style={styles.base} />;
}
