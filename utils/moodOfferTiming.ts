/**
 * Mood Search teklifinin yardımcı kararları (MONEY-1C). Saf mantık — React/RN yok.
 *
 * Deste sonu / çıkış teklifi KALDIRILDI (defter, çıkış koruyucusu yok): teklif artık
 * yalnız desteyi kilitleyen kart ve diğer giriş noktalarından açılır.
 */

/**
 * Teklife uygunluk: bayrak açık, onboarding dışı, yetki okunmuş ve kullanıcı Pro Mode'a
 * zaten yetkili DEĞİL (premium/trial/legacy teklif görmez).
 */
export function isOfferEligible(input: {
  offerEnabled: boolean;
  isOnboarding: boolean;
  accessLoading: boolean;
  entitled: boolean;
}): boolean {
  return input.offerEnabled && !input.isOnboarding && !input.accessLoading && !input.entitled;
}

/**
 * Ücretsiz arama destesinde slot kotası MUAF (C8): kullanıcı ücretsiz hakla bir deste
 * açtıysa kaydetme, istemci slot sayacıyla kesilmez. Onboarding akışı etkilenmez.
 */
export function isFreeSearchDeckSlotExempt(input: { offerEnabled: boolean; isOnboarding: boolean }): boolean {
  return input.offerEnabled && !input.isOnboarding;
}
