import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 4;
const WRAPPER_HEIGHT = 44;

export const styles = StyleSheet.create({
  // ── Kart ──
  card: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderTopWidth: 2,
    borderTopColor: Colors.gold,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    borderLeftWidth: 1,
    borderLeftColor: Colors.cardBorder,
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
    padding: Theme.spacing.md,
    gap: 20,
  },

  // ── Başlık satırı ──
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: Colors.gold,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: Colors.textGrey,
    fontSize: 13,
    marginTop: 2,
  },
  resetLink: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },

  // ── Slider grup ──
  sliderGroup: {
    gap: 6,
  },
  sliderName: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Custom slider içi ──
  sliderContainer: {
    gap: 8,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderSideLabel: {
    color: Colors.textGrey,
    fontSize: 12,
    flex: 1,
  },
  sliderValueLabel: {
    color: Colors.textLightGrey,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
  trackWrapper: {
    height: WRAPPER_HEIGHT,
    position: 'relative',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Colors.white10,
    top: (WRAPPER_HEIGHT - TRACK_HEIGHT) / 2,
  },
  filledTrack: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Colors.gold,
    top: (WRAPPER_HEIGHT - TRACK_HEIGHT) / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: Colors.gold,
    top: (WRAPPER_HEIGHT - THUMB_SIZE) / 2,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
});
