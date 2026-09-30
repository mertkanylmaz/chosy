/**
 * GauntletShell — 18:00 kapısının saf saat kuralları. SAF: React, ağ yok.
 * Import'suz (Deno testi: tests/gauntlet/unlockClock.test.ts).
 *
 * `__DEV__` / preview-e2e bypass'ı BURADA DEĞİL — `isUnlockedNow()` ve
 * `getNextUnlockAt()` (GauntletShell/index.tsx) uygular. Bu dosya yalnız
 * yerel saatle "kapı ne zaman" sorusunu cevaplar.
 */

/**
 * 18:00 kapısı — PRODUCT_OS §3.6: "Gauntlet 18:00'den önce açılmaz."
 * app_config anahtarı YOK (migration bu işte yasak) — TEKNIK_BORC:
 * "gauntlet_unlock_hour app_config'e taşınmalı". Tasarım token'ı değil,
 * ürün kuralı — bu yüzden constants/design/ altında DEĞİL, burada.
 *
 * İstemcide TEK tanım (V-1 D9). Sunucu aynası:
 * supabase/functions/_shared/previousCycle.ts `UNLOCK_HOUR`.
 */
export const UNLOCK_HOUR = 18;

/**
 * Kapı saati, arayüz diline göre biçimli ("6:00 PM" / "18:00"). Bekleme
 * metni, Settings bildirim satırı ve bekleme CTA'sı aynı biçimi kullanır.
 *
 * BUGÜNÜN tarihiyle kurulur. 30 Eyl 2026 TestFlight hatası: eski sabit
 * tarih (1 Oca 2000) İstanbul'da "5:00 PM" gösteriyordu, sayaç ise 18:00'e
 * sayıyordu. Hermes `new Date(y,m,d,h)`'yi BUGÜNKÜ ofsetle (UTC+3) kurar,
 * ICU biçimleyicisi 2000'in tarihsel ofsetiyle (UTC+2) okur — bir saat kayar.
 */
export function formatUnlockTime(language: string, now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), UNLOCK_HOUR, 0).toLocaleTimeString(
    language === 'tr' ? 'tr-TR' : 'en-US',
    { hour: 'numeric', minute: '2-digit' },
  );
}

/**
 * `now`'dan sonraki ilk kapı anı, YEREL saat. Kapı bugün henüz açılmadıysa
 * bugün UNLOCK_HOUR:00, açıldıysa (tam UNLOCK_HOUR:00 dahil) yarın.
 *
 * Tarih bileşenlerinden kurulur, milisaniye eklenerek DEĞİL — DST gününde
 * 24 saat eklemek kapıyı bir saat kaydırırdı.
 */
export function nextUnlockAfter(now: Date): Date {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const today = new Date(y, m, d, UNLOCK_HOUR, 0, 0, 0);
  if (now.getTime() < today.getTime()) return today;
  return new Date(y, m, d + 1, UNLOCK_HOUR, 0, 0, 0);
}
