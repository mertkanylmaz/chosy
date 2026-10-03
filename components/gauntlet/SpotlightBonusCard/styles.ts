/**
 * SpotlightBonusCard stilleri — C.9b-UI C4, S-2.
 *
 * S-2: görselli kart, yükseklik 72pt = `space.sm` × 2 + 56pt kare. Metin
 * bloğu (etiket 16 + 2 + alt başlık 2 × 18 = 54) karenin içine sığar, kart
 * yüksekliğini metin değil kare belirler — durum değişince düzen kaymaz.
 * Fold bütçesi bu 72pt ile hesaplandı (docs/investigations/
 * S2_CHAMPION_SPOTLIGHT_KESIF.md §5, `tests/gauntlet/championFold.test.ts`).
 *
 * Cam YOK (v4.1: cam yalnız navigasyon). Drop shadow YOK (§4.3).
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';
import { GAME_THEMES } from '@/constants/gameThemes';

/** Spotlight'ın kendi kimliği — tek kaynak `gameThemes`, hardcode yok. */
const SPOTLIGHT_ACCENT = GAME_THEMES.spotlight.accent;

/** Bulanık kare — dokunma hedefinin (44) üstünde, kart yüksekliğini belirler. */
const FRAME_SIZE = size.touchTarget + space.md;

export const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.base,
    marginHorizontal: space.base,
    borderRadius: radius.surface,
    backgroundColor: color.surface.raised,
  },
  /**
   * Morun TEK göründüğü yer: karenin kenarı. Karanlık Salon'da renk bilgi
   * taşır — mor burada "bu başka bir oyun" demek, "bu önemli" demek değil.
   */
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: radius.poster,
    borderWidth: size.hairline,
    borderColor: SPOTLIGHT_ACCENT,
    overflow: 'hidden',
    backgroundColor: color.surface.base,
  },
  frameImage: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    ...type['label-caps'],
    color: color.text.secondary,
  },
  subtitle: {
    ...type.caption,
    color: color.text.primary,
  },
  /** Eylem fiili (PLAY / CONTINUE) — yalnız oynanabilir durumda. */
  verb: {
    ...type['meta-strong'],
    color: color.text.primary,
  },
});
