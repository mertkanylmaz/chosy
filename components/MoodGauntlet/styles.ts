/**
 * Mood Gauntlet stilleri — token dosyaları tek kaynak (constants/design/semantic).
 * Günlük gauntlet dili: ink zemin, raised yüzey, altın (marquee) yalnız birincil eylem / aktif aşama.
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

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
  actions: { gap: space.sm, marginTop: space.base },

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
  /**
   * MoodCardGrid kendi 20pt yan dolgusunu taşır ve kart genişliğini ekran genişliğinden hesaplar
   * (ekran − 40 − aralık)/2. Kaydırma alanının 16pt dolgusu içinde kalırsa iki kart sığmaz → tek
   * sütun. Bu yüzden ızgara kaydırma dolgusunun dışına taşırılır (−16): eski ekranla aynı geometri.
   */
  gridBleed: { marginHorizontal: -space.base },
  gridCaption: { ...type.caption, color: color.text.secondary, paddingHorizontal: space.xs },
  consentBody: { ...type.caption, color: color.text.secondary, marginTop: space.sm },
  ctaSlot: { marginTop: space.base },

  // Yükleme
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.xl },
  loadingName: { ...type['display-l'], color: color.text.primary, textAlign: 'center' },
  loadingKicker: { ...type['label-caps'], color: color.text.secondary, textAlign: 'center' },
  loadingPosters: { flexDirection: 'row', gap: space.sm, width: '100%' },
  loadingPoster: { flex: 1, aspectRatio: 2 / 3, borderRadius: radius.poster, backgroundColor: color.surface.raised },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  phaseItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  phaseDot: { width: 6, height: 6, borderRadius: 3 },
  phaseDotDone: { backgroundColor: color.text.primary },
  phaseDotActive: { backgroundColor: color.reward.primary },
  phaseDotPending: { backgroundColor: color.surface.border },
  phaseText: { ...type.caption },
  phaseTextDone: { color: color.text.primary },
  phaseTextActive: { color: color.reward.primary, fontWeight: '600' },
  phaseTextPending: { color: color.text.secondary },
  phaseSep: { width: space.sm, height: size.hairline, backgroundColor: color.surface.border },

  // Gauntlet
  gTop: { alignItems: 'center', gap: space.sm, marginTop: space.xs },
  moodChip: {
    maxWidth: '100%',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.accent.edge,
  },
  moodChipText: { ...type['label-caps'], color: color.text.primary },
  gMiddle: { marginTop: space.lg, gap: space.base },
  question: { ...type.title, color: color.text.primary, textAlign: 'center' },
  pairRow: { flexDirection: 'row', gap: space.md, width: '100%' },
  pairCol: { flex: 1, gap: space.sm },
  reason: { ...type.caption, color: color.text.secondary },
  gBottom: { marginTop: 'auto', paddingTop: space.lg, gap: space.sm },
  notice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },

  // Sonuç
  hero: { width: '100%', aspectRatio: 2 / 3, maxHeight: 360, borderRadius: radius.surface, overflow: 'hidden', backgroundColor: color.surface.raised, alignSelf: 'center' },
  heroImage: { width: '100%', height: '100%' },
  resultTitle: { ...type.title, color: color.text.primary, textAlign: 'center', marginTop: space.base },
  resultMeta: { ...type.caption, color: color.text.secondary, textAlign: 'center', marginTop: space.xs },
  resultReason: { ...type.body, color: color.text.primary, textAlign: 'center', marginTop: space.sm },
  /** "Nerede izlenir" satırı: yükleme / boş / hata arasında yükseklik değişmesin (zıplama yok). */
  providersSlot: { minHeight: 56, justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  adjustTitle: { ...type['label-caps'], color: color.text.secondary, textAlign: 'center', marginTop: space.lg },
  chipRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  chip: {
    flex: 1,
    minHeight: size.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.accent.edge,
    backgroundColor: color.surface.raised,
  },
  chipDisabled: { opacity: 0.35 },
  chipText: { ...type.callout, color: color.text.primary },
  sectionTitle: { ...type['label-caps'], color: color.text.secondary, marginTop: space.lg, marginBottom: space.sm },
  backupRow: { flexDirection: 'row', gap: space.sm },
  backupItem: { flex: 1, gap: space.xs },
  backupPoster: { width: '100%', aspectRatio: 2 / 3, borderRadius: radius.surface, backgroundColor: color.surface.raised },
  backupTitle: { ...type.caption, color: color.text.primary },
  shareNotice: { ...type.caption, color: color.text.secondary, textAlign: 'center', marginTop: space.sm },
});
