/**
 * Pro Mode davet kartının görünürlük kuralları (MONEY-1C). Saf mantık — React/RN yok.
 *
 * İki yüzey: `champion_card` (şampiyon ekranı, Spotlight kartının ALTINDA) ve
 * `spotlight_card` (Spotlight sonucu). Kart satır içidir (modal değil) ve ritüelin
 * hiçbir parçasını itmez: sığmıyorsa GİZLENİR.
 */
import { HERO_MIN_HEIGHT } from '../components/gauntlet/ChampionReveal/heroHeight';

export type MoodInviteSurface = 'champion_card' | 'spotlight_card';

/** Kart yüksekliği + üst boşluk (pt). `MoodInviteCard/styles.ts` aynı değerleri kullanır. */
export const MOOD_INVITE_CARD_HEIGHT = 64;
export const MOOD_INVITE_MARGIN = 16;
export const MOOD_INVITE_RESERVE_HEIGHT = MOOD_INVITE_CARD_HEIGHT + MOOD_INVITE_MARGIN;

/**
 * Şampiyon hero'sunun kart EKLENDİKTEN sonra bile korunması gereken alt sınırı.
 * `HERO_MIN_HEIGHT` (160) mutlak tabandır; davet hero'yu tabana sıkıştıracaksa
 * göstermeyiz — ritüel ekranı davetten önemli.
 */
export const CHAMPION_INVITE_MIN_HERO = HERO_MIN_HEIGHT + 20;

/**
 * Hero'nun üstündeki başlık + "Watch now" bloğunun tahmini yüksekliği. Gerçeği
 * `ChampionReveal` içinde ölçülür; kabuk bunu görmez → muhafazakâr tahmin.
 * ⚠️ Cihazda kalibre edilmedi (rapor: açık soru).
 */
export const CHAMPION_BODY_ESTIMATE = 260;

/**
 * Şampiyon ekranında kart sığar mı?
 * @param screenH            pencere yüksekliği
 * @param belowWithoutInvite `useBelowHeight.total` — kart HARİÇ (kart ve sayaç/arşiv dahil diğer parçalar)
 * @param tabInset           alttan örtülen pay (tab bar + güvenli alan)
 */
export function championInviteFits(input: {
  screenH: number;
  belowWithoutInvite: number;
  tabInset: number;
}): boolean {
  const heroLeft =
    input.screenH -
    CHAMPION_BODY_ESTIMATE -
    input.belowWithoutInvite -
    MOOD_INVITE_RESERVE_HEIGHT -
    input.tabInset;
  return heroLeft >= CHAMPION_INVITE_MIN_HERO;
}

/** Spotlight sonucunda kartın altındaki en küçük pencere yüksekliği / en büyük yazı ölçeği. */
export const SPOTLIGHT_INVITE_MIN_SCREEN_H = 700;
export const SPOTLIGHT_INVITE_MAX_FONT_SCALE = 1.3;

export function spotlightInviteFits(input: { screenH: number; fontScale: number }): boolean {
  return (
    input.screenH >= SPOTLIGHT_INVITE_MIN_SCREEN_H &&
    input.fontScale <= SPOTLIGHT_INVITE_MAX_FONT_SCALE
  );
}

export type MoodInviteAccess = 'free' | 'legacy';

/**
 * Kartı kimler görür? `useProModeAccess` çıktısından:
 *  - yükleniyor / okuma hatası → gizli (belirsizlikte davet gösterilmez)
 *  - premium (trial dahil: SubscriptionContext trial'ı premium sayar) → HİÇ gösterilmez
 *  - legacy_mood_access → gösterilir (sınırsız Pro Mode'a keşif); `access: 'legacy'` ile
 *    ayrışır ki dönüşüm hunisi ölçümü kirlenmesin
 *  - diğer (free) → gösterilir
 * `showToLegacy` politika kolu: CTO kararı "legacy'ye gösterme" ise tek satır.
 */
export function moodInviteAccess(
  input: { loading: boolean; error: boolean; reason: 'premium' | 'legacy' | 'none' },
  showToLegacy = true,
): MoodInviteAccess | null {
  if (input.loading || input.error) return null;
  if (input.reason === 'premium') return null;
  if (input.reason === 'legacy') return showToLegacy ? 'legacy' : null;
  return 'free';
}
