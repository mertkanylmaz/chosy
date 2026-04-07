/**
 * PersonaBadge stilleri — arketip rengine gore dinamik olusturulur.
 */

import { StyleSheet } from 'react-native';

import { Theme } from '@/constants/theme';
import { Colors } from '@/constants/Colors';

/**
 * Arketip rengini alarak stil nesnesi olusturur.
 * Her render'da yeni nesne uretmemek icin useMemo ile sarilabilir,
 * ancak renk nadiren degistigi icin profil seviyesinde tutmak yeterli.
 *
 * @param colorPrimary - Arketip ana rengi (hex)
 * @param colorDim - Arketip soluk arka plan rengi (rgba)
 */
export function createStyles(colorPrimary: string, colorDim: string) {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: Theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: colorPrimary + '55', // ~33% opacity border
      backgroundColor: colorDim,
      marginTop: 8,
    },
    icon: {
      fontSize: 14,
    },
    label: {
      color: colorPrimary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      maxWidth: 200,
    },
    // Placeholder durumunda gri ton
    labelPlaceholder: {
      color: Colors.textGrey,
    },
  });
}
