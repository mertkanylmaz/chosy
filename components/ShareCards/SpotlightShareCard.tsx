/**
 * SpotlightShareCard — Spotlight kazanç paylaşım kartı (360×450 → 1080×1350 PNG).
 *
 * SPOILER-SAFE (bible §7.5, risk #6): karttaki hiçbir piksel filmden türemez.
 * Props yalnız {puzzleNo, chancesLeft, total, variant, maskWords}. Film görseli,
 * başlığı veya açılmış harf alanı YOKTUR — props tipi kapalıdır: JSX'te fazladan
 * bir alan geçirmek derleme hatasıdır. `maskWords` yalnız kelime başına boş
 * slot sayısıdır (`spotlightShareMask.ts`).
 *
 * Yukarıdan aşağı: wordmark → "SPOTLIGHT · FILM NNN" → soyut huzme (statik,
 * her kartta aynı kompozisyon) → başlık maskesi → hak göstergesi → durum →
 * davet → marka. URL / caption / link YOK.
 *
 * Yalnız react-native-svg + expo-linear-gradient; yeni font/asset yok.
 * Ortak `ShareCards/styles.ts` değiştirilmez; biçim tanımları bu dosyada yaşar.
 */
import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Polygon, Stop } from 'react-native-svg';

import { color, radius, size, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { useLanguage } from '@/contexts/LanguageContext';

import { CARD_HEIGHT, CARD_WIDTH } from './styles';

export type SpotlightShareCardProps = {
  /** Sunucunun `puzzle_no`'su; 0 / geçersiz → numara basılmaz */
  puzzleNo: number;
  chancesLeft: number;
  total: number;
  variant: 'found' | 'flawless';
  /** Kelime başına boş slot sayısı — `buildShareMask` çıktısı, harf içermez */
  maskWords: readonly number[];
};

// ─── Sabitler ────────────────────────────────────────────────────────────────

const SLOT_W = 12;
const SLOT_H = 3;
const SLOT_GAP = 3;
const WORD_GAP = 14;
const DOT_R = 6;
const DOT_GAP = 10;
const DOT_STROKE = 1.5;

/** Huzme: tepe noktası kartın üstünde, tabanı mask bölgesinde — veri girdisi yok */
const BEAM_APEX_HALF = 10;
const BEAM_BASE_Y = 330;
const BEAM_BASE_HALF = 130;

function SpotlightShareCardImpl(
  { puzzleNo, chancesLeft, total, variant, maskWords }: SpotlightShareCardProps,
  ref: React.ForwardedRef<View>,
): React.JSX.Element {
  const { t } = useLanguage();

  const hasNumber = Number.isInteger(puzzleNo) && puzzleNo > 0;
  const titleText = hasNumber
    ? t('games.spotlight.share_card_title', { n: String(puzzleNo).padStart(3, '0') })
    : t('games.spotlight.share_card_title_no_n');
  const statusText = t(
    variant === 'flawless'
      ? 'games.spotlight.share_card_flawless'
      : 'games.spotlight.share_card_found',
    { left: chancesLeft, total },
  );

  const dotsWidth = total * DOT_R * 2 + Math.max(total - 1, 0) * DOT_GAP;
  const dots = useMemo(
    () => Array.from({ length: total }, (_unused, i) => i < chancesLeft),
    [total, chancesLeft],
  );

  const cx = CARD_WIDTH / 2;

  return (
    <View ref={ref} style={cardStyles.card} collapsable={false}>
      {/* Soyut sinema huzmesi — statik */}
      <Svg
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
        style={cardStyles.beam}
      >
        <Defs>
          <SvgGradient id="spotlightBeamFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.accent.active} stopOpacity={0.34} />
            <Stop offset="0.6" stopColor={color.accent.active} stopOpacity={0.1} />
            <Stop offset="1" stopColor={color.accent.active} stopOpacity={0} />
          </SvgGradient>
          <SvgGradient id="spotlightBeamCore" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.accent.active} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color.accent.active} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <Polygon
          points={`${cx - BEAM_APEX_HALF},0 ${cx + BEAM_APEX_HALF},0 ${cx + BEAM_BASE_HALF},${BEAM_BASE_Y} ${cx - BEAM_BASE_HALF},${BEAM_BASE_Y}`}
          fill="url(#spotlightBeamFill)"
        />
        <Polygon
          points={`${cx - 4},0 ${cx + 4},0 ${cx + 52},${BEAM_BASE_Y} ${cx - 52},${BEAM_BASE_Y}`}
          fill="url(#spotlightBeamCore)"
        />
      </Svg>

      {/* Alt kısım okunurluğu için zemine doğru kararma */}
      <LinearGradient
        colors={[withAlpha(color.surface.base, 0), color.surface.base]}
        locations={[0.35, 1]}
        style={cardStyles.fade}
      />

      <View style={cardStyles.content}>
        <View style={cardStyles.head}>
          <Text style={cardStyles.wordmark}>CHOSY</Text>
          <Text style={cardStyles.title}>{titleText}</Text>
        </View>

        <View style={cardStyles.maskArea}>
          <View style={cardStyles.maskRow}>
            {maskWords.map((slotCount, wordIndex) => (
              <View key={wordIndex} style={cardStyles.word}>
                {Array.from({ length: slotCount }, (_unused, slotIndex) => (
                  <View key={slotIndex} style={cardStyles.slot} />
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={cardStyles.foot}>
          <Svg width={dotsWidth} height={DOT_R * 2 + DOT_STROKE * 2}>
            {dots.map((filled, i) => (
              <Circle
                key={i}
                cx={DOT_R + i * (DOT_R * 2 + DOT_GAP)}
                cy={DOT_R + DOT_STROKE}
                r={DOT_R - (filled ? 0 : DOT_STROKE / 2)}
                fill={filled ? color.reward.primary : 'none'}
                stroke={filled ? 'none' : color.text.secondary}
                strokeWidth={filled ? 0 : DOT_STROKE}
              />
            ))}
          </Svg>
          <Text style={cardStyles.status} numberOfLines={1} adjustsFontSizeToFit>
            {statusText}
          </Text>
          <Text style={cardStyles.invite}>{t('games.spotlight.share_card_invite')}</Text>
          <Text style={cardStyles.brand}>{t('games.spotlight.share_card_brand')}</Text>
        </View>
      </View>
    </View>
  );
}

export const SpotlightShareCard = forwardRef<View, SpotlightShareCardProps>(SpotlightShareCardImpl);

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: color.surface.base,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    overflow: 'hidden',
  },
  beam: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    justifyContent: 'space-between',
  },
  head: {
    alignItems: 'center',
    gap: space.sm,
  },
  wordmark: {
    ...type['display-m'],
    color: color.text.primary,
    letterSpacing: 4,
  },
  title: {
    ...type['meta-strong'],
    color: color.text.secondary,
  },
  maskArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: WORD_GAP,
    rowGap: WORD_GAP,
  },
  word: {
    flexDirection: 'row',
    columnGap: SLOT_GAP,
  },
  slot: {
    width: SLOT_W,
    height: SLOT_H,
    borderRadius: SLOT_H / 2,
    backgroundColor: withAlpha(color.text.primary, 0.7),
  },
  foot: {
    alignItems: 'center',
    gap: space.md,
  },
  status: {
    ...type['label-caps'],
    color: color.text.primary,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  invite: {
    ...type.callout,
    color: color.text.primarySoft,
    textAlign: 'center',
  },
  brand: {
    ...type.meta,
    color: color.text.secondary,
    marginTop: space.xs,
  },
});
