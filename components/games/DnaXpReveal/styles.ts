import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },

  // ── Chip fallback (legacy) ──
  dnaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(96,165,250,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
  },
  dnaSignalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dnaText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.info,
  },
  dnaDelta: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.greenSoft,
  },

  // ── Before/After Bars ──
  barsContainer: {
    alignSelf: 'stretch',
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  dimRow: {
    gap: 3,
  },
  dimLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dimValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  dimDelta: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.greenSoft,
  },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white10,
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.info,
  },
  barMarker: {
    position: 'absolute',
    top: -1,
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  // ── Rank Progress ──
  rankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white05,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.full,
    marginTop: 4,
  },
  rankChipCelebrate: {
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.goldDark,
  },
  rankText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  rankTextCelebrate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gold,
  },
});
