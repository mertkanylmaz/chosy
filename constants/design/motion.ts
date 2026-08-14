/**
 * Hareket tokenları — süre, easing, kara boşluk sekansı.
 * Kaynak: docs/os/3_CHOSY_DESIGN_OS.md §7
 *
 * `constants/animations.ts`'e dokunulmaz — bu dosya mevcut oyun ekranlarının
 * (Spotlight + dondurulmuş 6 oyun) sözleşmesidir. Gauntlet'in milisaniyeye
 * kadar kilitli süreleri (§7.2, §7.3) buraya izole edilir.
 */

import { Easing } from 'react-native-reanimated';

/** easeOutQuart — CSS standart eğrisi, "Geçiş" ilkesi (§7.2) için */
export const EASE_OUT_QUART = Easing.bezier(0.25, 1, 0.5, 1);

/** Geçiş (Dissolve) süreleri — §7.2, milisaniye */
export const DISSOLVE_DURATION = {
  /** Elenen poster: aşağı 12px + opaklık 1→0.25 */
  eliminatedPoster: 320,
  /** Kalan poster: ölçek 1→1.06 */
  remainingPoster: 280,
  /** Yeni rakip: opaklık 0→1 + aşağıdan 16px */
  newContender: 360,
  /** Işık sızması geçişi, lineer */
  lightBleed: 600,
} as const;

/**
 * Kalan poster spring parametreleri — §7.2 `spring(0.8, 0.9)` notasyonu.
 * Reanimated `withSpring` damping/stiffness'e çevrilmedi; bu ham spesifikasyon
 * değeridir, uygulayan bileşen kendi spring config'ini bu değerlere göre kurar.
 */
export const REMAINING_POSTER_SPRING_SPEC = {
  dampingRatio: 0.8,
  mass: 0.9,
} as const;

/** Kara boşluk — imza an (§7.3), milisaniye. Kısaltılmaz. */
export const BLACKOUT_SEQUENCE = {
  /** Tam siyah (KESME) */
  blackout: 120,
  /** Nefes, hiçbir şey yok */
  pause: 400,
  /** Şampiyon posteri belirdikten sonra başlığa kadar */
  titleDelay: 200,
  /** Başlıktan meta veriye kadar */
  metaDelay: 200,
} as const;

/** Reduce Motion — §7.5. Tüm Geçiş'ler cross-fade'e döner, Kesme aynı kalır. */
export const REDUCED_MOTION_DURATION = {
  crossFade: 100,
} as const;

/**
 * Şampiyon haptik çifti — §8: `notificationSuccess` + 300ms sonra
 * `impactHeavy`. Süre bileşene hardcode edilmez, buradan okunur.
 */
export const CHAMPION_HAPTIC_DELAY = 300;
