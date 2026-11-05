/**
 * SpotlightBonusCard stilleri — C.9b-UI C4, S-2; Home-B1.2 (B+ Cinematic Spotlight).
 *
 * B+: film karesi kartın TAMAMINI kaplar; kart tüm durumlarda 72pt (`space.sm` × 2 + 56pt
 * içerik). Bitmiş durum artık kısalmaz. İçerik bloğu (eyebrow 16 + 2 + satır 18 + 2 + satır 18 = 56)
 * 72pt'ye sığar; Daha Büyük Metin'de blok büyürse `minHeight` aşılır, kesilmez.
 *
 * Katman sırası: kare → karartma → gradyan → içerik. Katman sabitleri `cardScrim.ts`'te.
 * Cam YOK (v4.1: cam yalnız navigasyon). Drop shadow YOK (§4.3).
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

import { TEXT_BLOCK_MAX_WIDTH } from './cardScrim';

/** İçerik yüksekliği: dokunma hedefi (44) üstü — kart yüksekliğini belirler. */
const CONTENT_HEIGHT = size.touchTarget + space.md;

/** Chevron'un koyu daire zemini: ikon + 2 × space.sm/… kenar. */
const CHEVRON_CIRCLE = size.iconInline + space.md;

export const styles = StyleSheet.create({
  /** Kart zemini = koyu düz zemin (görsel yüklenemezse / loading / error'da kalan). */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.base,
    marginHorizontal: space.base,
    borderRadius: radius.surface,
    backgroundColor: color.surface.raised,
    overflow: 'hidden',
  },
  /** Tüm durumlarda 72pt: 2 × space.sm + 56pt içerik. */
  cardTall: {
    minHeight: CONTENT_HEIGHT + space.sm * 2,
  },
  /** Tam kart kare (cover; dikey odak `FRAME_FOCUS_TOP`). */
  frameImage: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Karartma / gradyan katmanları görseli kaplar, dokunuşu yutmaz (`pointerEvents` bileşende). */
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Metin bloğu kartın yarısına kadar: gradyanın koyu bölgesinde kalır. */
  textBlock: {
    flex: 1,
    maxWidth: TEXT_BLOCK_MAX_WIDTH,
    gap: 2,
  },
  /** Eyebrow satırı: (✓) + metin. Sarılabilir (Daha Büyük Metin'de kesilmez): `numberOfLines` verilmez. */
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  kicker: {
    ...type['label-caps'],
    flexShrink: 1,
    color: color.text.primarySoft,
  },
  /** Bulundu: ✓ + FOUND IT altın (yalnız bu durumda). */
  kickerGold: {
    color: color.reward.primary,
  },
  /** Ana satır: 16 + 2 + 18 + 2 + 18 = 56 → içerik yüksekliğine sığar. */
  main: {
    ...type.caption,
    fontWeight: '600',
    color: color.text.primary,
  },
  secondary: {
    ...type.caption,
    color: color.text.primarySoft,
  },
  /** Loading: ikincil satır yerinde iskelet çubuğu (satırla aynı yükseklik). */
  skeletonLine: {
    height: type.caption.lineHeight,
    width: '60%',
    borderRadius: radius.poster,
    backgroundColor: color.surface.border,
  },
  /** Sağdaki öğe (hap ya da chevron dairesi) — ayrı dokunma hedefi DEĞİL, kartın parçası. */
  trailing: {
    marginLeft: 'auto',
  },
  /** PLAY / CONTINUE hapı: koyu zemin + altın kenar + altın metin (kartın TEK vurgusu). */
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.reward.primary,
    backgroundColor: color.surface.base,
  },
  verb: {
    ...type['meta-strong'],
    color: color.reward.primary,
  },
  /** Chevron parlak karede kaybolmasın: küçük koyu daire zemini (ayrı hedef değil). */
  chevronCircle: {
    width: CHEVRON_CIRCLE,
    height: CHEVRON_CIRCLE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.base,
  },
});
