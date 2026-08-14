/**
 * Gauntlet Service — istemci ↔ backend gauntlet çağrılarının TEK KAYNAĞI.
 *
 * B.2 iskeleti: yalnızca imzalar. İş mantığı YOK.
 * Gerçek implementasyon B.3 (generate-gauntlet) ve B.4 (submit-choice)
 * Edge Function'ları yazıldıktan sonra buraya gelir.
 *
 * Sözleşme `types/gauntlet.ts` içinde KİLİTLİDİR — bu dosyanın imzaları
 * o şekle uyar, şekli değiştirmez.
 */

import type { ChoiceSubmission, DailyGauntlet } from '@/types/gauntlet';

/**
 * Günün gauntlet'ını getirir. Yoksa sunucu üretir.
 * Client "neden bu 4 film" bilgisini ASLA almaz.
 *
 * Dönüş `progress?` taşır (C.2-0, CTO onayı 14.08.2026): sunucu "nerede
 * kaldın"ı `choice_events` + güncel `film_ids`'ten türetir. İstemci
 * `progress` doluysa oradan devam eder; `undefined` ise Tur 1'den başlar
 * (eski istemci yolu). İstemci turu ASLA kendisi saymaz.
 */
export async function getTodayGauntlet(): Promise<DailyGauntlet> {
  throw new Error('not implemented: getTodayGauntlet (B.3)');
}

/**
 * Bir turun seçimini kaydeder.
 *
 * `latencyMs` sunucu tarafında doğrulanır (B.4): tam sayı değilse veya
 * 0..600000 dışındaysa 422 ile reddedilir. Clamp EDİLMEZ — sessizce veri
 * değiştirmek yasak.
 */
export async function submitChoice(submission: ChoiceSubmission): Promise<void> {
  throw new Error('not implemented: submitChoice (B.4)');
}

/**
 * Turu yeniler (yeni çift getirir). Kalan hak `refreshesRemaining`'de.
 */
export async function refreshRound(gauntletId: string, round: 1 | 2 | 3): Promise<DailyGauntlet> {
  throw new Error('not implemented: refreshRound (B.3)');
}
