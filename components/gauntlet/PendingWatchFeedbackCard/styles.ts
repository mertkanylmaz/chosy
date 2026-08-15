/**
 * PendingWatchFeedbackCard stilleri — GauntletShell'in centerContent
 * anatomisiyle aynı aile (radius/color/space/type tokenları).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  card: {
    alignItems: 'center',
    gap: space.md,
  },
  poster: {
    width: 96,
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
  },
  question: {
    ...type.callout,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.sm,
  },
  responses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.md,
    marginTop: space.md,
    paddingHorizontal: space.sm,
  },
  skipRow: {
    marginTop: space.lg,
    opacity: 0.6,
  },
});
