/**
 * ContextBar stilleri — DESIGN_OS v4.1 §10.1: **opak** yüzey (elev-1,
 * `color.surface.raised`), tur göstergesinin ÜSTÜNDE, tam genişlik bar.
 *
 * ⚠️ Eski başlık burada "cam yüzey" diyordu ve YANILTICIYDI: bu bar hiçbir
 * zaman cam olmadı, `BlurView` kullanmıyor. v4.1 kaydı camı yalnız
 * navigasyona bıraktı; bar opak `charcoal` olarak KALIR — `ink` zemin
 * üstünde `ink` bir bar görünmez olurdu (CTO onaylı sapma, C.9b-UI L-1).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';

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
  /**
   * C.9b-UI G2: `type.meta` (Martian Mono) → `type.caption` (SF Pro).
   * Mono yalnız yıl·süre ve tur sayacında kalır (§10.1). Bağlam cümlesi
   * mono olduğu için cihazda İKİ SATIRA taşıyordu — mono'nun 2pt harf
   * aralığı bu uzunlukta cümleyi taşırıyor.
   */
  label: {
    ...type.caption,
    color: color.text.secondary,
  },
  chevron: {
    ...type.caption,
    color: color.text.secondary,
  },
  /**
   * V-2 Tur B: düzenleyici bottom sheet — repo sheet deseni
   * (`AuthPromptSheet`/`NotificationPromptSheet`): alta yaslı overlay,
   * dokunulabilir backdrop, üst köşeleri yuvarlak yüzey + tutamaç.
   * Renkler Karanlık Salon token'larından (eski sheet'lerin `Colors.*`'ı değil).
   */
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(color.surface.base, 0.6),
  },
  /** Alt dolgu inline: home indicator + `space.lg`. */
  sheet: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    backgroundColor: color.surface.raised,
    gap: space.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.surface.border,
    marginBottom: space.xs,
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
