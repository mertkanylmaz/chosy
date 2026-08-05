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

/**
 * Dokunma geri bildirimi — tuş, çip, buton basışı.
 * Apple 2026 motion standardı: damping oranı ~0.85, sabit ease-in-out değil.
 * Kaynak: .claude/apple-design-standard-2026.md §2 › Motion
 */
export const PRESS_SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 0.9,
} as const;

/**
 * İçerik açılışı — hücre flip, harf açılışı, reveal anı.
 * Festival Layer Kural 6 hâlâ geçerli: ekran başına en fazla BİR anlamlı
 * animasyon. Bu config o tek animasyonun kalitesini değiştirir, sayısını değil.
 */
export const REVEAL_SPRING = {
  damping: 16,
  stiffness: 140,
  mass: 1,
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
