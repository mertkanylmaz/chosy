/**
 * SpotlightBonusCard stilleri — C.9b-UI C4.
 *
 * KOMPAKT olmak zorunda: Champion'ın birincil eylemi ("Nerede izlenir") Small
 * iPhone'da (375×667) ilk ekranda kalmalı. Kart ne kadar büyürse
 * `ChampionReveal`'ın merkezlenmiş bloğuna o kadar az yer kalır.
 * Ölçüm ve pay hesabı commit mesajında.
 *
 * Cam YOK (v4.1: cam yalnız navigasyon). Drop shadow YOK (§4.3).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';
import { GAME_THEMES } from '@/constants/gameThemes';

/** Spotlight'ın kendi kimliği — tek kaynak `gameThemes`, hardcode yok. */
const SPOTLIGHT_ACCENT = GAME_THEMES.spotlight.accent;

export const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    // Dokunma hedefi ≥44pt (K-54) — içerik daha kısa olsa da kart yüksekliği
    // buradan gelir.
    minHeight: 44,
    paddingVertical: space.sm,
    paddingHorizontal: space.base,
    marginHorizontal: space.base,
    borderRadius: radius.surface,
    backgroundColor: color.surface.raised,
  },
  /**
   * Morun TEK göründüğü yer. Metni renklendirmek yerine ince bir kenar
   * kullanılıyor: Karanlık Salon'da renk bilgi taşır, dekorasyon değildir —
   * mor burada "bu başka bir oyun" demek, "bu önemli" demek değil.
   */
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    minHeight: 28,
    borderRadius: 2,
    backgroundColor: SPOTLIGHT_ACCENT,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...type.meta,
    color: color.text.secondary,
  },
  title: {
    ...type['body-strong'],
    color: color.text.primary,
  },
});
