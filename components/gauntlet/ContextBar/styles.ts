/**
 * ContextBar stilleri — DESIGN_OS §10.1 anatomisi: cam yüzey (elev-1,
 * `color.surface.raised`), tur göstergesinin ÜSTÜNDE, tam genişlik bar.
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'stretch',
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.base,
    borderRadius: radius.pill,
    backgroundColor: color.surface.raised,
  },
  label: {
    ...type.meta,
    color: color.text.secondary,
  },
  chevron: {
    ...type.meta,
    color: color.text.secondary,
  },
  editor: {
    marginTop: space.sm,
    padding: space.base,
    borderRadius: radius.surface,
    backgroundColor: color.surface.raised,
    gap: space.md,
  },
  editorTitle: {
    ...type.callout,
    color: color.text.primary,
    textAlign: 'center',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  segmentPill: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.surface.border,
  },
  segmentPillActive: {
    borderColor: color.accent.active,
    backgroundColor: color.accent.fill,
  },
  segmentText: {
    ...type.caption,
    color: color.text.secondary,
  },
  segmentTextActive: {
    color: color.text.primary,
  },
  honestNote: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    opacity: 0.8,
  },
  saveButton: {
    alignSelf: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: color.accent.active,
  },
  saveButtonText: {
    ...type.callout,
    color: color.surface.base,
  },
  savedNote: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.xs,
    opacity: 0.7,
  },
});
