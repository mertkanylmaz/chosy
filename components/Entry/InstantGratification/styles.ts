import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

export default StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 420,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 16,
    color: Colors.gold,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textGrey,
  },
  filmInfo: {
    gap: 8,
  },
  matchLabel: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 14,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  filmTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    color: Colors.textWhite,
    lineHeight: 36,
  },
  matchScore: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gold,
  },
  aiDescription: {
    fontSize: 14,
    color: Colors.textLightGrey,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
  },
  primaryButtonTouch: {
    alignSelf: 'stretch',
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  secondaryButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.gold,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gold,
  },
});
