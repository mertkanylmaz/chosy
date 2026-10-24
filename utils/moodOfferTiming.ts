/**
 * Pro Mode teklifinin ZAMANLAMASI (MONEY-1C). Saf mantık — React/RN yok.
 *
 * Kural: bir arama (`search_id`) için teklif EN FAZLA BİR KEZ gösterilir ve iki
 * andan hangisi ÖNCE gelirse o tetikler:
 *   · `deck_end`  — son kart kaydırıldı, özet açıldı
 *   · `exit`      — desteden çıkış (× / özet kapat / yeni mood / sistem geri); teklif
 *                   olarak `deck_exit` kaydedilir
 * İlk gelen deftere yazılır; ikincisi bastırılır. Kaydetme/izleme hiçbir zaman
 * bu karara bağlı değildir — çağıran yalnız KAPATMA/ÇIKIŞ anında teklif açar.
 */
import type { MoodOfferEntry } from '../services/conversion/types';

export type OfferMoment = 'deck_end' | 'exit';

export interface OfferLedger {
  /**
   * Teklif bu an için gösterilecekse giriş noktasını döndürür ve `key`'i deftere yazar;
   * gösterilmeyecekse (uygun değil / bu arama için zaten gösterildi) null.
   */
  claim: (input: { eligible: boolean; moment: OfferMoment; key: string }) => MoodOfferEntry | null;
  has: (key: string) => boolean;
}

export function createOfferLedger(): OfferLedger {
  const shown = new Set<string>();
  return {
    claim({ eligible, moment, key }) {
      if (!eligible || shown.has(key)) return null;
      shown.add(key);
      return moment === 'deck_end' ? 'deck_end' : 'deck_exit';
    },
    has: (key) => shown.has(key),
  };
}

/**
 * Defter anahtarı. `search_id` yoksa (sunucu `mood_searches` INSERT'i başarısız → null)
 * ekran örneğine özgü yedek anahtar kullanılır: o ekranda yine bir kez.
 */
export function offerKey(searchId: string | null, instanceId: string): string {
  return searchId ?? `deck-${instanceId}`;
}

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
