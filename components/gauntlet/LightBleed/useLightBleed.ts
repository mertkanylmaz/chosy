/**
 * useLightBleed — ışık sızmasının KARAR katmanı. DESIGN_OS §5.2, §5.3, §7.2.
 *
 * `LightBleed` yalnızca çizer; "sızma olacak mı, hangi renkte, ne kadar sürede"
 * sorusu burada yanıtlanır. Ayrılma sebebi: erişilebilirlik okuması ve WCAG
 * hesabı test edilebilir saf bir birim olmalı, sunumun içine gömülmemeli.
 *
 * Sızmayı KAPATAN üç sebep (hepsi §5.3):
 *   1. Reduce Transparency açık            → "Sistem tercihine saygı"
 *   2. Increase Contrast açık              → aynı gerekçe
 *   3. Kompozit kontrast 4.5:1 altına düşer → "Erişilebilirlik önce gelir"
 * Dördüncü bir durum sızmayı yok eder ama bir KAPATMA değildir: filmin
 * `dominantColor`'ı yok (`poster_quality_ok = false` ya da henüz
 * hesaplanmamış) → §5.2 `fallback: 'ink'`.
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import * as Sentry from '@sentry/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { DISSOLVE_DURATION, REDUCED_MOTION_DURATION } from '@/constants/design/motion';
import { BLEED_ALPHA, color } from '@/constants/design/semantic';
import type { OklchColor } from '@/types/gauntlet';
import { compositeOver, contrastRatio, oklchToHex } from '@/utils/oklch';

/** WCAG AA normal metin eşiği (§5.3 "kontrast 4.5:1 altına düşerse iptal"). */
const MIN_CONTRAST_RATIO = 4.5;

export interface LightBleedState {
  /** Sızma katmanının rengi (`#rrggbb`). `null` → sızma yok, saf ink. */
  bleedColor: string | null;
  /** Geçiş süresi (ms) — Reduce Motion açıkken cross-fade'e düşer (§7.5). */
  durationMs: number;
}

/**
 * iOS'ta "Kontrastı Artır" = `UIAccessibilityDarkerSystemColorsEnabled`.
 * RN'de doğrudan karşılığı var (`isDarkerSystemColorsEnabled`), NativeModule
 * yazmaya gerek yok. Android'de bu ayar yoktur; oradaki kavramsal karşılık
 * `isHighTextContrastEnabled`.
 */
function readIncreaseContrast(): Promise<boolean> {
  return Platform.OS === 'ios'
    ? AccessibilityInfo.isDarkerSystemColorsEnabled()
    : AccessibilityInfo.isHighTextContrastEnabled();
}

const INCREASE_CONTRAST_EVENT = Platform.OS === 'ios'
  ? 'darkerSystemColorsChanged'
  : 'highTextContrastChanged';

/**
 * Okuma başarısız olursa sessizce geçilmez: Sentry'ye uyarı düşer ve GÜVENLİ
 * tarafa, yani sızma KAPALI'ya düşülür. Gerekçe: erişilebilirlik tercihini
 * okuyamadığımızda imza öğeyi kapatmak, tercihi çiğnemekten az zararlıdır.
 * (RN kaynağı: native modül yoksa promise `reject(null)` yapar — yakalanmazsa
 * unhandled rejection olurdu.)
 */
function readFlag(
  read: () => Promise<boolean>,
  label: string,
  apply: (value: boolean) => void,
): void {
  read()
    .then(apply)
    .catch((err: unknown) => {
      Sentry.captureMessage(`LightBleed: ${label} okunamadı — sızma kapatıldı`, {
        level: 'warning',
        tags: { component: 'LightBleed' },
        extra: { error: err instanceof Error ? err.message : String(err) },
      });
      apply(true);
    });
}

export function useLightBleed(dominantColor?: OklchColor): LightBleedState {
  const isReducedMotion = useReducedMotion();

  // Okuma bitene kadar KAPALI kabul edilir — açıkken kapanan bir sızma,
  // kapalıyken açılan bir sızmadan daha rahatsız edici olurdu.
  const [reduceTransparency, setReduceTransparency] = useState(true);
  const [increaseContrast, setIncreaseContrast] = useState(true);

  useEffect(() => {
    let active = true;
    const guard = (set: (v: boolean) => void) => (value: boolean) => {
      if (active) set(value);
    };

    readFlag(
      () => AccessibilityInfo.isReduceTransparencyEnabled(),
      'Reduce Transparency',
      guard(setReduceTransparency),
    );
    readFlag(readIncreaseContrast, 'Increase Contrast', guard(setIncreaseContrast));

    const transparencySub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      guard(setReduceTransparency),
    );
    const contrastSub = AccessibilityInfo.addEventListener(
      INCREASE_CONTRAST_EVENT,
      guard(setIncreaseContrast),
    );

    return () => {
      active = false;
      transparencySub.remove();
      contrastSub.remove();
    };
  }, []);

  /**
   * Renk ve kontrast kararı. Bağımlılıklar SKALER — `dominantColor` nesnesi
   * her `getTodayGauntlet` çağrısında yeniden kurulur, referansa bağlanmak
   * hesabı boşuna tekrarlatırdı. Hesap frame başına değil, renk ya da
   * erişilebilirlik durumu değiştiğinde bir kez çalışır.
   */
  const decision = useMemo(() => {
    if (dominantColor === undefined) {
      // §5.2 fallback: 'ink'. Hata değil, beklenen ürün durumu.
      return { bleedColor: null, cancelledForContrast: false, ratio: 0 };
    }
    if (reduceTransparency || increaseContrast) {
      return { bleedColor: null, cancelledForContrast: false, ratio: 0 };
    }

    const hex = oklchToHex(dominantColor);
    const composite = compositeOver(color.surface.base, hex, BLEED_ALPHA);
    const ratio = contrastRatio(composite, color.text.primary);
    if (ratio < MIN_CONTRAST_RATIO) {
      return { bleedColor: null, cancelledForContrast: true, ratio };
    }
    return { bleedColor: hex, cancelledForContrast: false, ratio };
  }, [
    dominantColor?.l,
    dominantColor?.c,
    dominantColor?.h,
    reduceTransparency,
    increaseContrast,
  ]);

  /**
   * Otomatik iptal sessizce geçilmez. §5.2 tavanlarıyla bunun gerçekleşmemesi
   * gerekir; olduysa backend kısıtlarıyla tasarım hedefi ayrışmıştır ve
   * görünmesi gerekir. Yan etki `useMemo` içinde DEĞİL — memo saf kalır.
   */
  useEffect(() => {
    if (!decision.cancelledForContrast) return;
    Sentry.captureMessage('LightBleed: kontrast 4.5:1 altına düştü — sızma iptal', {
      level: 'warning',
      tags: { component: 'LightBleed' },
      extra: { ratio: decision.ratio, dominantColor },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision.cancelledForContrast, decision.ratio]);

  return {
    bleedColor: decision.bleedColor,
    durationMs: isReducedMotion
      ? REDUCED_MOTION_DURATION.crossFade
      : DISSOLVE_DURATION.lightBleed,
  };
}
