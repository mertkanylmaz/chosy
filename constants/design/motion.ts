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

/**
 * Spotlight bonus kartının şampiyon ekranına girişi — S-2 (K-19: kesme değil,
 * Geçiş). Yalnız CANLI reveal yolunda: kara boşluk sekansının görsel
 * bitişinden `delay` sonra kart mount edilir ve `duration` boyunca opaklıkla
 * belirir. Resume yolunda ve Reduce Motion'da gecikme de geçiş de YOK.
 */
export const BONUS_CARD_ENTRY = {
  /** Reveal'ın görsel bitişi → kartın mount anı */
  delay: 1000,
  /** Opaklık 0→1 — yeni rakibin süresi yeniden kullanılır (§7.2) */
  duration: DISSOLVE_DURATION.newContender,
} as const;

/**
 * Spotlight sonuç karesi — bulanık kat → net kat çapraz geçişi (P-2). Işık
 * sızması süresi yeniden kullanılır (§7.2): kare "aydınlanır". Yalnız oturum
 * içi bitişte; bitmiş oyunun yeniden açılışında ve Reduce Motion'da anında net.
 */
export const SPOTLIGHT_STILL_REVEAL = {
  duration: DISSOLVE_DURATION.lightBleed,
} as const;

/**
 * Dokunma onayı — seçim sunucuya giderken SEÇİLMEYEN posterin opaklığı.
 * §7.1 "seçim onayı" bir Kesme'dir: 0ms, animasyonsuz uygulanır (Reduce
 * Motion'da da aynı). Elenme opaklığından (0.25) bilinçli olarak AYRI —
 * sunucu yanıtı gelmeden poster "elendi" gibi görünmemeli.
 * CTO kararı 29.09.2026 (TestFlight 906 "yavaş tepki" bulgusu).
 */
export const PENDING_DIM_OPACITY = 0.5;

/** Reduce Motion — §7.5. Tüm Geçiş'ler cross-fade'e döner, Kesme aynı kalır. */
export const REDUCED_MOTION_DURATION = {
  crossFade: 100,
} as const;

/**
 * Şampiyon haptik çifti — §8: `notificationSuccess` + 300ms sonra
 * `impactHeavy`. Süre bileşene hardcode edilmez, buradan okunur.
 */
export const CHAMPION_HAPTIC_DELAY = 300;
