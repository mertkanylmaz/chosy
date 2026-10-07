/**
 * Spotlight cevap sayfasi stilleri — Sprint 1: islevsel, minimum stil.
 * Gorsel is Sprint 2'de; yeni renk/token tanimlanmaz.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const answerSheetStyles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrim,
  },
  /** Yuzde yukseklik KAV'a gore: klavye acilinca sayfa kisalir, liste kayar */
  sheet: {
    height: '85%',
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  /** Suruklenebilir ust bant: tutamac + baslik + kapat */
  header: {
    gap: Theme.spacing.xs,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Colors.textTertiary,
    marginTop: Theme.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  title: {
    ...Theme.typography.h2,
    flex: 1,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
});
