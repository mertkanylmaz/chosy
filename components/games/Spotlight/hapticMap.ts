/**
 * Spotlight haptik haritası — olay → haptik türü. Saf modül (RN import YOK).
 *
 * Kural: her kullanıcı eylemi / sonucu EN FAZLA bir haptik üretir; kullanılmış
 * ya da kilitli tuş sessizdir. Çalma işi `playHaptic.ts`'te (utils/haptics).
 */

/** `null` = haptik yok */
export type SpotlightHaptic = 'light' | 'warning' | 'success' | 'medium' | null;

/** Tuşun basma anındaki durumu */
export type KeyPressState = 'available' | 'used' | 'locked';

export type SpotlightHapticEvent =
  /** Harf tuşuna basış — `locked`: istek yolda ya da oyun oynanmıyor */
  | { type: 'key_press'; state: KeyPressState }
  /** Sunucunun harf sonucu; `completed` = bu harfle haklar bitti */
  | { type: 'letter_result'; hit: boolean; completed: boolean }
  /** "FİLMİ BİLİYORUM" CTA'sına basış */
  | { type: 'cta_press' }
  /** Cevap sayfasında sonuç satırı seçimi — kendi haptiği YOK, sonuç belirler */
  | { type: 'result_row_select' }
  /** Sunucunun film tahmini sonucu */
  | { type: 'guess_result'; won: boolean; completed: boolean };

export function hapticForEvent(event: SpotlightHapticEvent): SpotlightHaptic {
  switch (event.type) {
    case 'key_press':
      return event.state === 'available' ? 'light' : null;
    case 'letter_result':
      // Doğru harf: ek haptik yok (başlığın güncellenmesi geri bildirim).
      if (event.hit) return null;
      // Haklar bu harfle bittiyse: mevcut oyun-sonu haptiği (tek).
      return event.completed ? 'medium' : 'warning';
    case 'cta_press':
      return 'light';
    case 'result_row_select':
      return null;
    case 'guess_result':
      if (event.won) return 'success';
      return event.completed ? 'medium' : 'warning';
  }
}

/** Tuşun basma durumu — kullanılmış > kilitli > uygun */
export function keyPressState(used: boolean, locked: boolean): KeyPressState {
  if (used) return 'used';
  return locked ? 'locked' : 'available';
}
