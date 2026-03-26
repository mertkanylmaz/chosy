import { Easing } from 'react-native-reanimated';

/** Standart spring — genel etkileşimler, kart geçişleri */
export const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
} as const;

/** Sert bounce spring — buton basma, ikon bounce */
export const BOUNCE_CONFIG = {
  damping: 12,
  stiffness: 200,
  mass: 0.8,
} as const;

/** Yumuşak spring — modal, overlay geçişleri */
export const SOFT_SPRING = {
  damping: 30,
  stiffness: 120,
} as const;

/** Standart timing — renk, opaklık animasyonları */
export const TIMING_CONFIG = {
  duration: 300,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
} as const;

/** Hızlı timing — anlık geri bildirimler */
export const FAST_TIMING = {
  duration: 150,
  easing: Easing.out(Easing.quad),
} as const;

/** Yavaş timing — zarif geçişler */
export const SLOW_TIMING = {
  duration: 500,
  easing: Easing.inOut(Easing.ease),
} as const;

/** Placeholder typing hızı (ms/karakter) */
export const TYPING_SPEED_MS = 35;

/** Stagger gecikmesi — liste giriş animasyonları */
export const STAGGER_DELAY_MS = 50;
