/**
 * Mood Gauntlet stilleri — token dosyaları tek kaynak (constants/design/semantic).
 * Günlük gauntlet dili: raised yüzey, vurgu rengi yok (ışık vurgudur).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
  },
  headerTitle: { ...type['label-caps'], color: color.text.secondary },
  headerSpacer: { width: 24 },
  scroll: { flexGrow: 1, paddingHorizontal: space.base, paddingBottom: space.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md },

  title: { ...type.title, color: color.text.primary, textAlign: 'center' },
  body: { ...type.body, color: color.text.secondary, textAlign: 'center' },
  caption: { ...type.caption, color: color.text.secondary },
  kicker: { ...type['label-caps'], color: color.text.secondary, textAlign: 'center' },

  // Giriş
  entryTitle: { ...type.title, color: color.text.primary, marginTop: space.md },
  entrySubtitle: { ...type.body, color: color.text.secondary, marginTop: space.xs, marginBottom: space.base },
  input: {
    ...type.body,
    minHeight: 56,
    maxHeight: 120,
    paddingVertical: space.sm,
    paddingHorizontal: space.base,
    borderRadius: radius.surface,
    backgroundColor: color.surface.raised,
    color: color.text.primary,
  },
  section: { marginTop: space.lg, gap: space.sm },
  consentBody: { ...type.caption, color: color.text.secondary, marginTop: space.sm },
  ctaSlot: { marginTop: space.base },

  // Gauntlet
  question: { ...type.title, color: color.text.primary, textAlign: 'center', marginTop: space.base },
  pairRow: { flexDirection: 'row', gap: space.base, marginTop: space.lg },
  pairCol: { flex: 1, gap: space.sm },
  reason: { ...type.caption, color: color.text.secondary },
  noneSlot: { alignItems: 'center', marginTop: space.lg },
  notice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.base,
  },

  // Sonuç
  hero: { width: '100%', aspectRatio: 2 / 3, maxHeight: 360, borderRadius: radius.surface, overflow: 'hidden', backgroundColor: color.surface.raised, alignSelf: 'center' },
  heroImage: { width: '100%', height: '100%' },
  resultTitle: { ...type.title, color: color.text.primary, textAlign: 'center', marginTop: space.base },
  resultMeta: { ...type.caption, color: color.text.secondary, textAlign: 'center', marginTop: space.xs },
  resultReason: { ...type.body, color: color.text.primary, textAlign: 'center', marginTop: space.sm },
  actions: { gap: space.sm, marginTop: space.base },
  actionRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  sectionTitle: { ...type['label-caps'], color: color.text.secondary, marginTop: space.lg, marginBottom: space.sm },
  backupRow: { flexDirection: 'row', gap: space.sm },
  backupItem: { flex: 1, gap: space.xs },
  backupPoster: { width: '100%', aspectRatio: 2 / 3, borderRadius: radius.surface, backgroundColor: color.surface.raised },
  backupTitle: { ...type.caption, color: color.text.primary },
  shareNotice: { ...type.caption, color: color.text.secondary, textAlign: 'center', marginTop: space.sm },
});
