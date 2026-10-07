/**
 * FilmSearchInput stilleri — Festival Layer.
 *
 * Tek arama bileseni (Hard Rule): kopyalanmaz, genisletilir.
 * Kenarlik amber tint yerine altin sac teli.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { withAlpha, type GameTheme } from '@/constants/gameThemes';
import { Theme } from '@/constants/theme';

import { DROPDOWN_GAP, SEARCH_CLOSE_ROW_H, SEARCH_INPUT_H } from './dropdownHeight';

export const createStyles = (theme: GameTheme) => {
  /** Accent'in hairline hali — %22 alfa */
  const accentHairline = withAlpha(theme.accent, 0.22);

  return StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: accentHairline,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    height: SEARCH_INPUT_H,
    gap: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  dropdown: {
    position: 'absolute',
    bottom: SEARCH_INPUT_H + DROPDOWN_GAP,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.md,
    // maxHeight runtime'da: input üstünde kalan alana göre (dropdownHeight.ts)
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: accentHairline,
    elevation: 10,
    shadowColor: Colors.shadowBlack,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  resultPoster: {
    width: 36,
    height: 54,
    borderRadius: 4,
  },
  noPoster: {
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  resultYear: {
    ...Theme.typography.caption,
  },
  /**
   * Daha once tahmin edilmis film — Spotlight klavyesindeki `keyMiss` ile ayni
   * sonukluk: "denendi, tekrar denenemez" sinyali iki yerde ayni dilde.
   */
  resultRowTried: {
    opacity: 0.35,
  },
  triedText: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },
  /** P-6a yalnizca-artikel ipucu — sonuc satiri yerine, dokunulamaz */
  hintRow: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  hintText: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // ─── 'sheet' yerlesimi (Spotlight cevap sayfasi) — yalniz layout="sheet" ──
  sheetContainer: {
    flex: 1,
    gap: Theme.spacing.sm,
  },
  sheetNote: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  /** Ağ hatası: not satırından ayrı — çerçeveli, simgeli, kırmızı/sarsıntı yok */
  sheetError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sheetErrorText: {
    flexShrink: 1,
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
  sheetList: {
    flex: 1,
  },
  sheetRow: {
    minHeight: 56,
  },
  sheetStatus: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.md,
  },
  sheetStatusText: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  sheetRetry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  sheetRetryText: {
    ...Theme.typography.caption,
    color: Colors.textPrimary,
    textDecorationLine: 'underline',
  },
  /** P-3 "Kapat" satiri — listenin input'a bakan kenari, sabit yukseklik */
  closeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    height: SEARCH_CLOSE_ROW_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  closeText: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },
  });
};
