/**
 * GauntletShell — cycle geçiş kuralları (F2 / F2.1). SAF: React, ağ, saat yok.
 * Import'suz (Deno testi: tests/gauntlet/cycleRollover.test.ts).
 *
 * Home her an ya bitmemiş gauntlet'i ya da mevcut cycle'ın champion'ını
 * gösterir; "bekleme" durumu yoktur. Cycle sınırı yerel 18:00'dir ve SUNUCU
 * karar verir: `DailyGauntlet.date` = cycle tarihi, yanıttaki `next_cycle_at` =
 * sonraki geçiş anı. İstemci yerel saatten cycle tarihi HESAPLAMAZ.
 *
 * ── Geçiş kuralı (F2.1, F2'nin otomatik geçişini DEĞİŞTİRİR) ────────────────
 * Uygulama ön plandayken içerik ASLA kendiliğinden değişmez. Otomatik geçiş
 * yalnızca (1) soğuk açılışta ve (2) AppState 'active' olduğunda (arka plandan
 * dönüş; `in_progress` ve meşgulken HAYIR, bkz. `rolloverOnActive`). Ön planda `next_cycle_at` geçtiğinde:
 *   - completed_today / exhausted: sayaç satırı "hazır" butonuna döner;
 *     kullanıcı basınca geçiş uygulanır.
 *   - ready / in_progress: HİÇBİR ŞEY değişmez, mevcut tur oynanır.
 * Sunucu henüz aynı cycle'ı döndürürse satır "Birazdan" der ve artan
 * aralıklarla yeniden sorar.
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
 * yapılmaz (F1 öncesi önbellek kaydı).
 */
export function shouldRefetch(now: Date, nextCycleAt: string | undefined): boolean {
  if (!nextCycleAt) return false;
  const boundary = Date.parse(nextCycleAt);
  if (Number.isNaN(boundary)) return false;
  return now.getTime() >= boundary;
}

/**
 * Sunucunun döndürdüğü gauntlet yeni bir cycle mı. Aynı `date` ise istemci
 * HİÇBİR ŞEY yapmaz. Gösterilen gauntlet yoksa (`null`) her yanıt yenidir.
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
 * AppState 'active' (arka plandan dönüş) sırasında otomatik geçiş uygulanabilir
 * mi (F2.2). Yalnız bitmemiş OLMAYAN ekranlarda: `ready` (hiç seçim yapılmamış)
 * ve `completed_today`. Devam eden tur (`in_progress`), yükleme (`bootstrapping`)
 * ve uçuştaki / kuyruktaki seçim (`busy`) için KAPALI: davranış ön plandaki
 * duruma eşittir — tur oynanır, bitince sayaç satırı "hazır" butonuna döner.
 * Ön plandaki geçiş bu fonksiyona SORULMAZ — ön planda otomatik geçiş yoktur.
 */
export function rolloverOnActive(guard: RolloverGuard): boolean {
  if (guard.busy) return false;
  return guard.state === 'ready' || guard.state === 'completed_today';
}

/** Sayaç satırının sunucuyla ilişkisi (ön planda, kullanıcı eylemiyle ilerler). */
export type RowStatus = 'idle' | 'checking' | 'any_moment';

/** Sayaç satırının görünümü. */
export type RowPhase = 'counting' | 'ready' | 'checking' | 'any_moment';

/**
 * Satır görünümü. Geçiş anı gelmediyse sayaç; geldiyse buton ("hazır"),
 * basıldıktan sonra kontrol ediliyor, sunucu aynı cycle'ı döndüyse "birazdan".
 */
export function cycleRowPhase(input: { boundaryPassed: boolean; status: RowStatus }): RowPhase {
  if (!input.boundaryPassed) return 'counting';
  if (input.status === 'checking') return 'checking';
  if (input.status === 'any_moment') return 'any_moment';
  return 'ready';
}

/** Satır yalnız bitmiş ekranlarda (champion / exhausted) vardır. */
export function showsCycleRow(state: CycleShellState): boolean {
  return state === 'completed_today';
}

const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 300_000;

/**
 * "Birazdan" durumunda yeniden sorma aralığı: 30 sn'den başlar, her denemede
 * ikiye katlanır, en fazla 5 dk (30 · 60 · 120 · 240 · 300 · 300 …).
 */
export function retryDelayMs(attempt: number): number {
  const exp = Math.max(0, Math.floor(attempt));
  return Math.min(RETRY_BASE_MS * 2 ** exp, RETRY_MAX_MS);
}
