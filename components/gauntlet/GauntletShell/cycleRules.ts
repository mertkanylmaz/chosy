/**
 * GauntletShell — E-21 önceki döngü geçiş kuralları. SAF: React, ağ, saat yok.
 * Import'suz (Deno testi: tests/gauntlet/cycleRules.test.ts).
 *
 * Kilitli beş durum sözleşmesi DEĞİŞMEZ — önceki döngü bir durum değil, hangi
 * döngünün istendiğini söyleyen bir moddur (`CycleMode`).
 */

/** GauntletShell `ShellState`'inin aynası (beş durum, CTO 14.08.2026). */
export type CycleShellState =
  | 'before_18'
  | 'bootstrapping'
  | 'ready'
  | 'in_progress'
  | 'completed_today';

/**
 * İstenen döngü. `previous` yalnız E-21 sorgusuyla girilir ve yalnız nabız
 * (18:00 / gece yarısı) ya da ret ile `current`'a döner. Yükleme tetikleyicisi
 * (reconnect, 401, retry) modu DEĞİŞTİRMEZ — aksi halde önceki döngü oyunu
 * sırasındaki bir reconnect sabah bugünün satırını üretirdi.
 */
export type CycleMode = 'current' | 'previous';

export type ProgressStatusLike = 'in_progress' | 'champion' | 'exhausted' | undefined;

/** `generate-gauntlet` isteğine eklenecek seçenek. */
export function requestOptionsFor(mode: CycleMode): { cycle?: 'previous' } {
  return mode === 'previous' ? { cycle: 'previous' } : {};
}

/**
 * Önceki döngü yüklemesi sonrası. Bitmiş önceki döngü YENİDEN AÇILIŞTA
 * gösterilmez → `before_18` (V-1 Tur 4 onayı: "Reveal → sonra before_18").
 *
 * "Yeniden açılış" = yükleme `bootstrapping`'den yapılıyor. Oyun ekranı
 * açıkken gelen yükleme (K-42 reconnect: kuyruktaki son seçim gönderildi,
 * ya da reveal ekrandayken bağlantı döndü) şampiyonu GÖSTERİR — aksi halde
 * çevrimdışı oynanan final kullanıcıya hiç görünmezdi (CTO SARI-2).
 */
export function previousLoadOutcome(
  status: ProgressStatusLike,
  fromState: CycleShellState,
): 'play' | 'close' {
  const finished = status === 'champion' || status === 'exhausted';
  return finished && fromState === 'bootstrapping' ? 'close' : 'play';
}

/**
 * Önceki döngü yüklemesi AĞA ULAŞAMADI. Açılış (`bootstrapping`) sırasında
 * ise bekleyiş ekranı gösterilir — hata ekranı değil: ağ yokken mevcut
 * kullanıcı 18:00 öncesi zaten bekleyiş ekranını görürdü (CTO SARI-4). Sessiz
 * değildir: servis GAUNTLET_OFFLINE uyarısını Sentry'ye yazar ve iz yazılmaz,
 * bir sonraki açılışta yeniden sorulur. Sunucu hatası (5xx) bu yola GİRMEZ.
 */
export function previousOfflineOutcome(fromState: CycleShellState): 'before_18' | 'load_error' {
  return fromState === 'bootstrapping' ? 'before_18' : 'load_error';
}

export type PulseAction =
  /** before_18 → bootstrapping + current yükleme (mevcut 18:00 kapısı). */
  | 'open_gate'
  /** Gösterilen şampiyonu temizle + bootstrapping + current yükleme. */
  | 'reset_and_load'
  /** Gösterilen şampiyonu temizle + before_18. */
  | 'reset_to_before_18'
  | 'none';

export interface PulseInput {
  state: CycleShellState;
  mode: CycleMode;
  unlocked: boolean;
  /** Tamamlanma anındaki yerel gün anahtarı değişti mi (gece yarısı). */
  dateKeyChanged: boolean;
}

/**
 * Dakikalık nabız. İlk ve son dal E-21 öncesi davranışın birebir aynısı;
 * ortadaki dal E-21 "18:00 geçişi": önceki döngü şampiyonu gösterilirken
 * kapı açılırsa bugünün gauntlet'i yüklenir. `ready`/`in_progress` önceki
 * döngü 18:00'de KESİLMEZ — oyun bitirilir, bitince bu dal devreye girer.
 */
export function pulseAction(input: PulseInput): PulseAction {
  if (input.state === 'before_18') return input.unlocked ? 'open_gate' : 'none';
  if (input.state !== 'completed_today') return 'none';
  if (input.mode === 'previous' && input.unlocked) return 'reset_and_load';
  if (input.dateKeyChanged) return input.unlocked ? 'reset_and_load' : 'reset_to_before_18';
  return 'none';
}

/**
 * Analytics `cycle` property'si (3i). Gauntlet kimliğiyle eşlenir, moda
 * değil: 18:00'de mod `current`'a döndükten sonra geç gelen bir önceki döngü
 * olayı yanlış etiketlenmesin.
 */
export function gauntletCycleProps(
  gauntletId: string | null | undefined,
  previousGauntletId: string | null,
): { cycle: 'previous' | 'current' } {
  return {
    cycle: gauntletId != null && gauntletId === previousGauntletId ? 'previous' : 'current',
  };
}
