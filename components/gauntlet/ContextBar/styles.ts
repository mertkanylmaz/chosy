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

import { color, radius, size, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';

/**
 * V-4 Tur B: pill'in metin DIŞI genişliği — iki yatay dolgu, iki kenar
 * çizgisi, iki ikon (sol ikon + chevron), iki `gap`. Sığma hesabı
 * `container genişliği − PILL_CHROME_WIDTH` üzerinden yapılır; stil
 * değerleri değişirse burası da değişir (aynı token'lardan türetildi).
 */
export const PILL_CHROME_WIDTH =
  space.base * 2 + size.hairline * 2 + size.iconInline * 2 + space.sm * 2;

/** Ölçüm katmanının genişliği — aday metin hiçbir zaman sarmasın diye geniş. */
const MEASURE_LAYER_WIDTH = 4000;

export const styles = StyleSheet.create({
  /** V-4 Tur B: pill içerik genişliğinde ve ortalı (eskiden tam genişlik). */
  container: {
    width: '100%',
    alignItems: 'center',
  },
  /**
   * V-3 Tur G1 (G1), karar V3-D2: kenar `graphite` — altın DEĞİL (altın
   * yalnız ödül katmanında). Yükseklik `size.touchTarget`: pill tek satır ve
   * dokunma hedefi 44pt; yükleme iskeleti aynı yüksekliği ayırır.
   */
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    gap: space.sm,
    minHeight: size.touchTarget,
    paddingHorizontal: space.base,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    backgroundColor: color.surface.raised,
  },
  /**
   * C.9b-UI G2 notu geçerli: mono DEĞİL — bağlam cümlesi mono'da taşıyordu.
   * V-3: `caption` → `label-caps` (büyük harf, harf aralıklı SF Pro).
   * V-4 Tur B: tek metin — sığmayan segment düşer, `flexShrink` YOK
   * (kısalma ellipsis ile değil segment düşürerek yapılır).
   */
  summaryText: {
    ...type['label-caps'],
    color: color.text.secondary,
  },
  /** Ölçüm katmanı — görünmez; yalnız aday metinlerin genişliği okunur. */
  measureLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MEASURE_LAYER_WIDTH,
    opacity: 0,
  },
  /** Metin kendi doğal genişliğinde ölçülsün (kapsayıcıya yayılmasın). */
  measureText: {
    alignSelf: 'flex-start',
  },
  /** İlk ölçüm gelene dek (tek kare) pill görünmez — taşan metin çizilmez. */
  pendingMeasure: {
    opacity: 0,
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
