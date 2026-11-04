/**
 * Mood Gauntlet stilleri — token dosyaları tek kaynak (constants/design/semantic).
 * Günlük gauntlet dili: ink zemin, raised yüzey, altın (marquee) yalnız birincil eylem / aktif aşama.
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

/** Sonuç posteri yüksekliği (pt). 375×667'de kartın ilk ekrana girmesi için 360'tan indirildi. */
const RESULT_POSTER_HEIGHT = 280;

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
  /** Sonuç üst satırı: "YOUR PICK · <mood>" tek satır; poster ile arası sm. */
  kicker: { ...type['label-caps'], color: color.text.secondary, textAlign: 'center', marginBottom: space.sm },
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
  loadingAnother: { ...type.body, color: color.text.secondary, textAlign: 'center' },

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
  /** Faz 2-3: sahne ekranı doldurur (boş alt alan yok); alt eylemler en altta. */
  gStage: { flexGrow: 1 },
  gQuestionBlock: { marginTop: space.base, gap: space.xs, alignItems: 'center' },
  question: { ...type.title, color: color.text.primary, textAlign: 'center' },
  tapHint: { ...type.callout, color: color.text.secondary, textAlign: 'center' },
  pairRow: { flexDirection: 'row', gap: space.md, width: '100%', marginTop: space.base },
  pairCol: { flex: 1, gap: space.sm },
  roundText: { ...type['label-caps'], color: color.text.secondary },
  /** Gerekçe: 14pt/19, ≤4 satır, taşarsa kuyrukta "…". */
  reason: { fontFamily: type.callout.fontFamily, fontSize: 14, lineHeight: 19, color: color.text.primarySoft },
  /** 4 satır × 19pt taban; Dynamic Type büyüyünce slot da büyür (sabit height metni çipin üstüne taşırırdı). */
  reasonSlot: { minHeight: 76 },
  reasonSkeleton: { gap: space.xs, paddingTop: 3 },
  skeletonLine: { height: 12, borderRadius: radius.pill, backgroundColor: color.surface.raised },
  skeletonLineShort: { width: '60%' },
  /** Dört film şeridi (turlar boyunca üstte): kazanan altın kenarlı, elenen %35 opaklık. */
  strip: { flexDirection: 'row', gap: space.xs, alignItems: 'center', justifyContent: 'center' },
  stripCell: {
    width: 36,
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    overflow: 'hidden',
    backgroundColor: color.surface.raised,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  stripCellAdvanced: { borderWidth: 2, borderColor: color.reward.primary },
  stripCellEliminated: { opacity: 0.35 },
  /** CTA altı teklif türü (Subscription / Rent / Buy). */
  offerHint: { ...type.caption, color: color.text.secondary, textAlign: 'center' },
  changeLink: { ...type.caption, color: color.text.primary, textDecorationLine: 'underline' },
  gBottom: { marginTop: 'auto', paddingTop: space.lg, gap: space.sm },
  noneSub: { ...type.caption, color: color.text.secondary, textAlign: 'center' },

  // Your four (kalıcı durak): üst metin · ölçülen ızgara kutusu · alta sabit CTA
  introRoot: { flex: 1, paddingHorizontal: space.base },
  introHead: { alignItems: 'center', gap: space.xs, paddingTop: space.sm },
  introMood: { ...type['label-caps'], color: color.text.secondary },
  introKicker: { ...type['label-caps'], color: color.text.secondary },
  introTitle: { ...type.title, color: color.text.primary, textAlign: 'center' },
  introGridBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: space.md },
  introGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md },
  introFooter: { paddingTop: space.sm },

  // Film çipleri (tempo · yoğunluk · süre)
  filmChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  filmChipsCentered: { justifyContent: 'center' },
  filmChip: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.accent.edge,
    backgroundColor: color.surface.raised,
  },
  filmChipText: { ...type.caption, color: color.text.primarySoft },
  notice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },

  // Sonuç
  /** Gerçek 2:3 poster: sabit yükseklik, genişlik orandan (280 → ~187), yatayda ortalı; kırpma yok. */
  hero: { height: RESULT_POSTER_HEIGHT, aspectRatio: 2 / 3, borderRadius: radius.surface, overflow: 'hidden', backgroundColor: color.surface.raised, alignSelf: 'center' },
  heroImage: { width: '100%', height: '100%' },
  resultTitle: { ...type.title, color: color.text.primary, textAlign: 'center', marginTop: space.base },
  resultMeta: { ...type.caption, color: color.text.secondary, textAlign: 'center', marginTop: space.xs },
  /** Gerekçe bölümü: başlık + metin (ya da iskelet). Yalnız gerekçe varken / yüklenirken çizilir. */
  resultWhy: { marginTop: space.sm },
  resultWhyTitle: { ...type['label-caps'], color: color.text.secondary, textAlign: 'center' },
  resultReasonSkeleton: { gap: space.xs, paddingTop: space.xs, alignItems: 'center' },
  skeletonLineFull: { width: '100%' },
  resultReason: { ...type.body, color: color.text.primary, textAlign: 'center', marginTop: space.xs },
  resultChips: { marginTop: space.sm },
  /** "Why this fits you": gerekçe + çiplerin altında tek satır; veri yoksa hiç çizilmez. */
  insight: { ...type.callout, color: color.text.secondary, textAlign: 'center', marginTop: space.sm },
  /** Birincil CTA bloğu: tek CTA, altında nerede-izlenir satırı. */
  ctaBlock: { gap: space.sm, marginTop: space.base },
  /** İkincil satır: Kaydet (durum düğmede) + Paylaş (ikon). Durum değişince yükseklik/konum sabit. */
  secondaryRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  saveBtn: {
    flex: 1,
    minHeight: size.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.accent.edge,
    backgroundColor: color.surface.raised,
  },
  saveBtnText: { ...type.callout, color: color.text.primary },
  shareBtn: {
    width: size.touchTarget,
    minHeight: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.accent.edge,
    backgroundColor: color.surface.raised,
  },
  /** Hata satırı için SABİT yer: görününce düzen kaymaz. */
  noticeSlot: { minHeight: 18, marginTop: space.xs, justifyContent: 'center' },
  chipLabel: { ...type.callout, color: color.text.primary, textAlign: 'center' },
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
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.accent.edge,
    backgroundColor: color.surface.raised,
  },
  chipDisabled: { opacity: 0.35 },
  chipText: { ...type.callout, color: color.text.primary, textAlign: 'center', flexShrink: 1 },
  sectionTitle: { ...type['label-caps'], color: color.text.secondary, marginTop: space.lg, marginBottom: space.sm },
  backupRow: { flexDirection: 'row', gap: space.sm },
  backupItem: { flex: 1, gap: space.xs },
  backupPoster: { width: '100%', aspectRatio: 2 / 3, borderRadius: radius.surface, backgroundColor: color.surface.raised },
  backupTitle: { ...type.caption, color: color.text.primary },
  shareNotice: { ...type.caption, color: color.text.secondary, textAlign: 'center', marginTop: space.sm },
});
