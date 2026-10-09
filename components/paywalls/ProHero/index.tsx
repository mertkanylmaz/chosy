/**
 * ProHero — Chosy Pro paywall'ının Mood Search anlatımı (R-5 V2, madde 8-9).
 * Sıra: hero → örnek kart → (PaywallBase plan kartları) → `ProBenefits`.
 *
 * Hero KODLA çizilir, görsel dosyası yoktur: koyu zemin üzerinde `marquee`
 * token'ından türetilmiş, düşük opaklıkta iki radyal ışık ("projektör ışığı").
 * Yaklaşım SpotlightShareCard'ın radyal elipsiyle aynı (`react-native-svg`
 * RadialGradient); yeni paket yok.
 *
 *  - Dekoratif: VoiceOver'dan gizli, dokunma almaz.
 *  - Animasyon YOK — reduce motion için ayrı dal gerekmez.
 *  - Işığın tepe opaklığı `LIGHT_PEAK_OPACITY`; metinler bu opaklığın
 *    kompoziti üstünde ≥4.5:1 kalacak token'lardan seçildi (rapordaki
 *    kontrast tablosu).
 *  - ≤667pt yükseklikte ışık ve boşluklar küçülür; "Mood Search example"
 *    kartı ilk ekranda kalır.
 */
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { ChatCircleText, Waveform } from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';

import { PAYWALL_GUTTER, PAYWALL_TOP_INSET } from '../PaywallBase/styles';

/** Küçük ekran eşiği (iPhone SE/8 sınıfı). */
const COMPACT_HEIGHT = 667;

const LIGHT_HEIGHT_REGULAR = 300;
const LIGHT_HEIGHT_COMPACT = 210;
/** `styles.root.marginTop` ile aynı: kökün sheet üstünden uzaklığı. */
const ROOT_TOP_OFFSET = space.sm;

/** Işığın en parlak noktadaki opaklığı — "düşük opaklık", metin kontrastı bunun üstünden ölçülür. */
export const LIGHT_PEAK_OPACITY = 0.2;

const BENEFITS: { Icon: React.ComponentType<IconProps>; titleKey: string; bodyKey: string }[] = [
  { Icon: ChatCircleText, titleKey: 'paywallPro.benefit1Title', bodyKey: 'paywallPro.benefit1Body' },
  { Icon: Waveform, titleKey: 'paywallPro.benefit2Title', bodyKey: 'paywallPro.benefit2Body' },
];

interface ProHeroProps {
  /**
   * Alt metni gizle. YALNIZ deneme-uygun durumda true gelir: açıklama 3
   * satıra çıkıp iki plan kartını ilk ekrandan itiyordu (R-5 fit). Başka
   * kopya silinmez.
   */
  hideSubhead?: boolean;
}

export function ProHero({ hideSubhead = false }: ProHeroProps): React.JSX.Element {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();
  const compact = height <= COMPACT_HEIGHT;
  const lightHeight = compact ? LIGHT_HEIGHT_COMPACT : LIGHT_HEIGHT_REGULAR;
  // Üst şerit (PAYWALL_TOP_INSET) ışığın tepesini örter; tepe noktası şeridin
  // hemen altına denk gelsin diye elips merkezi aşağı alınır (viewBox birimi).
  const lightPeakY = ((PAYWALL_TOP_INSET - ROOT_TOP_OFFSET) / lightHeight) * 100;

  return (
    <View style={styles.root}>
      {/* Dekoratif ışık — tutamaç/✕ bandının altına da uzanır */}
      <View
        pointerEvents="none"
        style={[styles.light, compact ? styles.lightCompact : styles.lightRegular]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="proLightWide" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={color.reward.primary} stopOpacity={LIGHT_PEAK_OPACITY} />
              <Stop offset="0.4" stopColor={color.reward.primary} stopOpacity={LIGHT_PEAK_OPACITY * 0.4} />
              <Stop offset="0.75" stopColor={color.reward.primary} stopOpacity={LIGHT_PEAK_OPACITY * 0.1} />
              <Stop offset="1" stopColor={color.reward.primary} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="proLightSide" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={color.reward.primary} stopOpacity={LIGHT_PEAK_OPACITY * 0.5} />
              <Stop offset="1" stopColor={color.reward.primary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={50} cy={lightPeakY} rx={75} ry={80} fill="url(#proLightWide)" />
          <Ellipse cx={88} cy={lightPeakY + 18} rx={30} ry={45} fill="url(#proLightSide)" />
        </Svg>
      </View>

      <Text style={styles.brand} accessibilityRole="header" accessibilityLabel={t('paywallPro.title')}>
        {t('paywallPro.titleLead')} <Text style={styles.brandAccent}>{t('paywallPro.titleAccent')}</Text>
      </Text>

      <Text style={styles.eyebrow}>{t('paywallPro.eyebrow')}</Text>
      <Text style={styles.headline}>{t('paywallPro.headline')}</Text>
      {!hideSubhead && <Text style={styles.subhead}>{t('paywallPro.subhead')}</Text>}

      <View style={[styles.example, compact && styles.exampleCompact]}>
        <Text style={styles.exampleLabel}>{t('paywallPro.exampleLabel')}</Text>
        <Text style={styles.exampleText}>{t('paywallPro.exampleText')}</Text>
      </View>
    </View>
  );
}

/**
 * İki fayda satırı — plan kartlarının ALTINDA gösterilir (`renderBelowPlans`).
 * Kartlar ilk ekranda tam görünsün diye hero'dan ayrıldı (R-5 fit).
 */
export function ProBenefits(): React.JSX.Element {
  const { t } = useLanguage();

  return (
    <View style={styles.benefits}>
      {BENEFITS.map(({ Icon, titleKey, bodyKey }) => (
        <View key={titleKey} style={styles.benefitRow}>
          <Icon size={size.iconAction} color={color.reward.primary} weight="duotone" />
          <View style={styles.benefitText}>
            <Text style={styles.benefitTitle}>{t(titleKey)}</Text>
            <Text style={styles.benefitBody}>{t(bodyKey)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    // Üst bandın (tutamaç + ✕) altına uzanan ışık için; metin akışı aynı kalır.
    marginTop: -PAYWALL_TOP_INSET + space.sm,
    paddingTop: PAYWALL_TOP_INSET,
    // Plan kartları ilk ekranda görünsün diye sıkı (R-5 polish).
    paddingBottom: space.xs,
  },
  light: {
    position: 'absolute',
    top: 0,
    left: -PAYWALL_GUTTER,
    right: -PAYWALL_GUTTER,
  },
  lightRegular: { height: LIGHT_HEIGHT_REGULAR },
  lightCompact: { height: LIGHT_HEIGHT_COMPACT },
  brand: {
    ...type['display-l'],
    color: color.text.primary,
  },
  brandAccent: {
    color: color.reward.primary,
  },
  eyebrow: {
    ...type['label-caps'],
    textTransform: 'uppercase',
    color: color.text.primarySoft,
    marginTop: space.xs,
  },
  headline: {
    ...type['display-m'],
    color: color.text.primary,
    marginTop: space.xs,
  },
  subhead: {
    ...type.callout,
    color: color.text.primarySoft,
    marginTop: space.xs,
  },
  example: {
    marginTop: space.md,
    backgroundColor: color.surface.base,
    borderRadius: radius.surface,
    borderLeftWidth: 2,
    borderLeftColor: color.reward.primary,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.base,
  },
  exampleCompact: {
    marginTop: space.sm,
    paddingVertical: space.sm,
  },
  exampleLabel: {
    ...type.caption,
    color: color.text.secondary,
  },
  exampleText: {
    ...type.body,
    color: color.text.primary,
    marginTop: space.xs,
  },
  benefits: {
    marginTop: space.base,
    gap: space.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    ...type.callout,
    fontWeight: '600',
    color: color.text.primary,
  },
  benefitBody: {
    ...type.caption,
    color: color.text.secondary,
    marginTop: 2,
  },
});
