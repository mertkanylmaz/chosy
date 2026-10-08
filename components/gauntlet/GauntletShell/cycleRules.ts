/**
 * GauntletShell — cycle geçiş kuralları (F2). SAF: React, ağ, saat yok.
 * Import'suz (Deno testi: tests/gauntlet/cycleRollover.test.ts).
 *
 * Home her an ya bitmemiş gauntlet'i ya da mevcut cycle'ın champion'ını
 * gösterir; "bekleme" durumu yoktur. Cycle sınırı yerel 18:00'dir ve SUNUCU
 * karar verir: `DailyGauntlet.date` = cycle tarihi, yanıttaki `next_cycle_at` =
 * sonraki geçiş anı. İstemci yerel saatten cycle tarihi HESAPLAMAZ — yalnızca
 * "sunucuya yeniden sorma zamanı geldi mi" diye bakar. Karar sunucunundur.
 */

/** GauntletShell `ShellState`'inin aynası. */
export type CycleShellState =
  | 'bootstrapping'
  | 'ready'
  | 'in_progress'
  | 'completed_today';

/**
 * Sunucuya yeniden sorma zamanı geldi mi: `now >= next_cycle_at`.
 * Alan yoksa ya da okunamıyorsa `false` — tahmini bir sınırla yeniden yükleme
 * yapılmaz (F1 öncesi önbellek kaydı). Açılış ve AppState 'active' zaten
 * sunucuya sorar.
 */
export function shouldRefetch(now: Date, nextCycleAt: string | undefined): boolean {
  if (!nextCycleAt) return false;
  const boundary = Date.parse(nextCycleAt);
  if (Number.isNaN(boundary)) return false;
  return now.getTime() >= boundary;
}

/**
 * Sunucunun döndürdüğü gauntlet yeni bir cycle mı. Aynı `date` ise istemci
 * HİÇBİR ŞEY yapmaz: remount yok, titreme yok, event yok. Gösterilen gauntlet
 * yoksa (`null`) her yanıt yenidir.
 */
export function isNewCycle(currentDate: string | null | undefined, incomingDate: string): boolean {
  return currentDate !== incomingDate;
}

export interface RolloverGuard {
  state: CycleShellState;
  /** Seçim gönderiliyor, geçiş animasyonu oynuyor ya da kuyrukta bekleyen seçim var. */
  busy: boolean;
}

/**
 * Yeni cycle'a geçiş şimdi uygulanabilir mi. Devam eden tur (`in_progress`,
 * ya da en az bir seçim yapılmış) 18:00'de yarıda KESİLMEZ: oyun bitirilir,
 * `completed_today`'e geçince bir sonraki kontrol geçişi uygular. Yükleme
 * sürerken (`bootstrapping`) ve seçim uçuştayken de ertelenir.
 */
export function canRollOver(guard: RolloverGuard): boolean {
  if (guard.busy) return false;
  return guard.state === 'ready' || guard.state === 'completed_today';
}
