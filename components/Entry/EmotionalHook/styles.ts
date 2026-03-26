import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  logo: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    color: Colors.gold,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    color: Colors.textWhite,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textGrey,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipText: {
    fontSize: 14,
    color: Colors.textWhite,
  },
  ctaContainer: {
    gap: 16,
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
  continueLink: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  continueLinkText: {
    fontSize: 13,
    color: Colors.gold,
  },
});
