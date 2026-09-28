/**
 * Ritüel haftası — Profil avatar halkasının saf hesap katmanı.
 *
 * Halka son 7 günü gösterir: o gün şampiyon seçildiyse dilim dolu. Seri
 * (streak) DEĞİL — sıfırlanmaz, sayaç tutmaz; K-08 Streak bölümü ertelemesi
 * (E-22) ile karışmaması için yalnız pencere içi doluluk gösterir.
 *
 * Gün uzayı UTC: `daily_gauntlets.date`, generate-gauntlet'te
 * `utcDateString()` ile yazılıyor. Yerel güne geçiş M2 zaman mimarisi
 * işidir; o gün geldiğinde bu dosyadaki `utcDayKey` sunucuyla birlikte
 * değişmeli, aksi halde halka bir gün kayar.
 *
 * React Native import'u YOK — Deno testi doğrudan çalıştırır.
 */

export const RITUAL_WEEK_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD`, UTC — `daily_gauntlets.date` ile aynı anahtar uzayı. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Son 7 UTC günün anahtarları, eskiden yeniye. Son eleman bugün. */
export function ritualWeekKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let offset = RITUAL_WEEK_DAYS - 1; offset >= 0; offset -= 1) {
    keys.push(utcDayKey(new Date(now.getTime() - offset * DAY_MS)));
  }
  return keys;
}

/** Pencerenin ilk günü — sorgunun alt sınırı (`date >= since`). */
export function ritualWeekStart(now: Date): string {
  return ritualWeekKeys(now)[0];
}

/**
 * Şampiyonlu gün anahtarlarından 7 elemanlı doluluk dizisi (eskiden yeniye).
 * Pencere dışındaki ve tekrar eden tarihler etkisizdir.
 */
export function buildRitualWeek(championDates: readonly string[], now: Date): boolean[] {
  const filled = new Set(championDates);
  return ritualWeekKeys(now).map((key) => filled.has(key));
}
