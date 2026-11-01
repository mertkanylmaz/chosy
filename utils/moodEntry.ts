/**
 * Mood Gauntlet giriş noktası (Pro Mode Faz 2-2) — saf mantık, React/RN yok.
 *
 * Yüzeyler: `champion` (Home, şampiyon ekranı: Spotlight kartı ile geri sayım satırı arası)
 * ve `profile` (Profil satırı). Kart satır içidir ve ritüelin hiçbir parçasını itmez:
 * sığmıyorsa GİZLENİR (`championInviteFits` deseni).
 */
import { CHAMPION_BODY_ESTIMATE, CHAMPION_INVITE_MIN_HERO } from './moodInvite';

export type MoodEntrySurface = 'champion' | 'profile';

/** Paywall orkestratörüne giden kaynak etiketi (`profile_upgrade` girişi). */
export const MOOD_GAUNTLET_ENTRY_SOURCE = 'mood_gauntlet_entry';

/** Kart yüksekliği + üst boşluk (pt). `MoodEntryCard/styles.ts` aynı değerleri kullanır. */
export const MOOD_ENTRY_CARD_HEIGHT = 72;
export const MOOD_ENTRY_MARGIN = 16;
export const MOOD_ENTRY_RESERVE_HEIGHT = MOOD_ENTRY_CARD_HEIGHT + MOOD_ENTRY_MARGIN;

/** Büyük yazı ölçeğinde başlık+alt metin 72 pt'ye sığmaz → kart gizlenir. */
export const MOOD_ENTRY_MAX_FONT_SCALE = 1.3;

/**
 * Şampiyon ekranında kart sığar mı?
 * @param belowWithoutEntry `useBelowHeight.total` — kart HARİÇ (Spotlight kartı, sayaç, arşiv dahil)
 */
export function moodEntryFits(input: {
  screenH: number;
  belowWithoutEntry: number;
  tabInset: number;
  fontScale: number;
}): boolean {
  if (input.fontScale > MOOD_ENTRY_MAX_FONT_SCALE) return false;
  const heroLeft =
    input.screenH -
    CHAMPION_BODY_ESTIMATE -
    input.belowWithoutEntry -
    MOOD_ENTRY_RESERVE_HEIGHT -
    input.tabInset;
  return heroLeft >= CHAMPION_INVITE_MIN_HERO;
}

/** Yerel saat `HH:MM` (iki haneli). */
export function formatEntryTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Türkçe belirtme (-i) eki, saat okunuşunun SON kelimesine göre ("18:00" → "sıfır" → "ı").
 * Dakika okunuşu: 00 sıfır(ı) · 10 on(u) · 20 yirmi(yi) · 30 otuz(u) · 40 kırk(ı) · 50 elli(yi);
 * diğerlerinde son rakam: 1 bir(i) 2 iki(yi) 3 üç(ü) 4 dört(ü) 5 beş(i) 6 altı(yı) 7 yedi(yi) 8 sekiz(i) 9 dokuz(u).
 */
export function trTimeAccusativeSuffix(hhmm: string): string {
  const m = /^\d{2}:(\d)(\d)$/.exec(hhmm);
  if (!m) throw new Error(`trTimeAccusativeSuffix: HH:MM bekleniyordu, gelen: ${hhmm}`);
  const tens = Number(m[1]);
  const ones = Number(m[2]);
  if (ones === 0) {
    return ['ı', 'u', 'yi', 'u', 'ı', 'yi'][tens] ?? 'ı';
  }
  return ['ı', 'i', 'yi', 'ü', 'ü', 'i', 'yı', 'yi', 'i', 'u'][ones];
}

/** `pro_entry_viewed` oturumda YÜZEY BAŞINA bir kez (remount'ta tekrarlanmaz). */
export interface EntryViewedTracker {
  claim: (surface: MoodEntrySurface) => boolean;
}

export function createEntryViewedTracker(): EntryViewedTracker {
  const seen = new Set<MoodEntrySurface>();
  return {
    claim(surface) {
      if (seen.has(surface)) return false;
      seen.add(surface);
      return true;
    },
  };
}

/** Dokunuş yönü: yetkili (Pro/legacy) → /pro-mode; ücretsiz → hard paywall. */
export function moodEntryTapTarget(allowed: boolean): 'pro_mode' | 'paywall' {
  return allowed ? 'pro_mode' : 'paywall';
}

/** Paywall varyantı Mood Gauntlet girişinden mi açıldı? (metin eşlemesi tek kaynağı) */
export function isMoodGauntletEntryTrigger(trigger: { type: string; entry?: string }): boolean {
  return trigger.type === 'profile_upgrade' && trigger.entry === MOOD_GAUNTLET_ENTRY_SOURCE;
}

/**
 * `paywall_viewed` ek özelliği: yalnız Mood Gauntlet girişinde `source`. Diğer kaynaklarda boş
 * nesne — mevcut olay şekli değişmez.
 */
export function paywallEntrySource(trigger: { type: string; entry?: string }): { source?: string } {
  return isMoodGauntletEntryTrigger(trigger) ? { source: MOOD_GAUNTLET_ENTRY_SOURCE } : {};
}
