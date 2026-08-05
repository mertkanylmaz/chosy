import React from 'react';
import { View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import type { GameTheme } from '@/constants/gameThemes';

import { styles } from './styles';

interface GameBackdropProps {
  /** Çizilecek tema — `GameShell` `gameType`'tan çözer */
  theme: GameTheme;
}

/**
 * Oyun ambiyansı — ekranın en arkasındaki renk katmanı.
 *
 * `GameShell` tarafından otomatik render edilir; oyun ekranı bundan haberdar
 * değildir. Zifiri siyah yerine temaya göre renklenen bir gece tabanı, üstüne
 * iki yumuşak parıltı.
 *
 * **Teknik seçim:** parıltılar radyal gradyan değil, yuvarlatılmış kutu +
 * şeffafa inen `LinearGradient`. Ek bağımlılık gerektirmiyor ve cam yüzeylerin
 * arkasında renk oynaması yaratmaya yetiyor. Şekiller kasıtlı olarak ekran
 * dışına taşar — kenarları görünmesin diye.
 *
 * İki geometri var (`theme.ambientVariant`):
 * - `orbs` — iki köşeye yerleşmiş küre. Beş oyunun varsayılanı.
 * - `beam` — üst köşeden aşağı açılan projektör huzmesi + yere düşen ışık
 *   havuzu. Yalnız Spotlight: accent'i base'in kendisi (amber) olduğu için
 *   ayrışma renkten değil ışıktan gelmek zorunda.
 *
 * Kaynak: `constants/gameThemes.ts` · doktrin `DESIGN_SYSTEM.md` › Oyun Temaları
 */
export function GameBackdrop({ theme }: GameBackdropProps): React.JSX.Element {
  const isBeam = theme.ambientVariant === 'beam';

  return (
    <View style={styles.backdrop}>
      <LinearGradient colors={theme.ambientBase} style={styles.base} />

      {isBeam ? (
        <>
          {/* Huzme — üst sağdan sola aşağı açılan koni izlenimi */}
          <LinearGradient
            colors={theme.ambientGlowA}
            start={{ x: 0.85, y: 0 }}
            end={{ x: 0.1, y: 1 }}
            style={styles.beamShaft}
          />
          {/* Yere düşen ışık havuzu — huzmenin bittiği yer */}
          <LinearGradient
            colors={theme.ambientGlowB}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.beamPool}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={theme.ambientGlowA}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.orbTop}
          />
          <LinearGradient
            colors={theme.ambientGlowB}
            start={{ x: 0.7, y: 1 }}
            end={{ x: 0.1, y: 0 }}
            style={styles.orbBottom}
          />
        </>
      )}
    </View>
  );
}
