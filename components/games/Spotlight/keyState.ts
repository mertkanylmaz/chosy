/**
 * Harf tuşunun üç durumu — saf modül (RN import YOK).
 *
 * Renge bağımlı olmadan ayırt edilir (Design OS §2.7):
 *   available — kullanılabilir
 *   used_hit  — kullanıldı, başlıkta VAR: üstü çizilmez; altın harf + alt çubuk
 *   used_miss — kullanıldı, başlıkta YOK: sönük + üstü çizili
 */
export type KeyState = 'available' | 'used_hit' | 'used_miss';

export function keyStateFor(used: boolean, inTitle: boolean): KeyState {
  if (!used) return 'available';
  return inTitle ? 'used_hit' : 'used_miss';
}

/** i18n anahtarı (games.spotlight.* altında) — etiket bileşende `t` ile çözülür */
export const KEY_A11Y_KEY: Record<KeyState, string> = {
  available: 'key_a11y_available',
  used_hit: 'key_a11y_used_hit',
  used_miss: 'key_a11y_used_miss',
};

/** Yalnız `used_miss` üstü çizilir */
export function isStruck(state: KeyState): boolean {
  return state === 'used_miss';
}

/** Yalnız `used_hit` alt çubuk (şekil işareti) taşır */
export function hasHitBar(state: KeyState): boolean {
  return state === 'used_hit';
}
