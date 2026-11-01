/**
 * Mood Gauntlet film olguları (Faz 2-3) — saf, RN / ağ yok. LLM YOK.
 *
 *  - Çipler: tempo, yoğunluk, süre. Kaynak `film_profiles.dimensions_json`:
 *      tempo    ← `pace_preference` (yoksa `pace`): 'slow' | 'medium' | 'fast'
 *      yoğunluk ← `energy_level` (0..1)
 *    Süre `films.runtime` (dakika) → "1h 41m".
 *  - "Why this fits you" satırı: kullanıcının 3 seçiminde kazanan ↔ kaybeden karşılaştırılır;
 *    anlamlı desen yoksa satır YOK (null). Kurallar ve eşikler yalnız bu dosyada.
 */
import type { MoodFlow } from './moodGauntletFlow';

export type Pace = 'slow' | 'medium' | 'fast';
export type EnergyBand = 'gentle' | 'moderate' | 'intense';

export interface FilmDims {
  pace: Pace | null;
  /** 0..1; bilinmiyorsa null. */
  energy: number | null;
}

/** Yoğunluk bantları (energy_level): < 0.45 sakin, < 0.70 orta, ≥ 0.70 yoğun. */
export const ENERGY_GENTLE_MAX = 0.45;
export const ENERGY_MODERATE_MAX = 0.7;

/** Bir turun "daha sakin / daha hareketli" sayılması için asgari enerji farkı. */
export const ENERGY_DELTA = 0.1;
/** Kayan nokta payı: 0.5 − 0.4 = 0.0999… eşiği kaçırmasın. */
const FP_EPS = 1e-9;

/** Desen için asgari tur sayısı (karşıt oy olmadan). */
export const PATTERN_MIN_ROUNDS = 2;

const PACE_RANK: Record<Pace, number> = { slow: 0, medium: 1, fast: 2 };

function isPace(v: unknown): v is Pace {
  return v === 'slow' || v === 'medium' || v === 'fast';
}

/** `dimensions_json` (opak) → FilmDims. Tanınmayan / eksik alan null; uydurma değer yok. */
export function parseDims(raw: unknown): FilmDims {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const paceRaw = o.pace_preference ?? o.pace;
  const e = o.energy_level;
  return {
    pace: isPace(paceRaw) ? paceRaw : null,
    energy: typeof e === 'number' && Number.isFinite(e) && e >= 0 && e <= 1 ? e : null,
  };
}

export function energyBand(energy: number): EnergyBand {
  if (energy < ENERGY_GENTLE_MAX) return 'gentle';
  if (energy < ENERGY_MODERATE_MAX) return 'moderate';
  return 'intense';
}

/** Dakika → "1h 41m" / "45m" / "2h". Geçersiz → null. */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null;
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface FilmChips {
  /** i18n anahtarı son eki; null = çizilmez. */
  pace: Pace | null;
  energy: EnergyBand | null;
  runtime: string | null;
}

/**
 * Faz 2-8: tempo ve enerji birbiriyle çelişiyorsa tempo çipi gizlenir (tempo verisi bazı profillerde
 * süre vekili; bkz. rapor). slow + enerji ≥ ENERGY_MODERATE_MAX (0.70) ya da fast + enerji < ENERGY_GENTLE_MAX (0.45).
 * Genel kural, film başına kod yok; enerji bilinmiyorsa çelişki kanıtlanamaz → çip kalır.
 */
export function paceContradictsEnergy(pace: Pace | null, energy: number | null): boolean {
  if (pace === null || energy === null) return false;
  return (pace === 'slow' && energy >= ENERGY_MODERATE_MAX) || (pace === 'fast' && energy < ENERGY_GENTLE_MAX);
}

export function buildChips(dims: FilmDims | undefined, runtimeMinutes: number | null | undefined): FilmChips {
  return {
    pace: dims && !paceContradictsEnergy(dims.pace, dims.energy) ? dims.pace : null,
    energy: dims?.energy != null ? energyBand(dims.energy) : null,
    runtime: formatRuntime(runtimeMinutes),
  };
}

// ─── Seçim deseni ────────────────────────────────────────────────────────────

export interface RoundPick {
  winner: string;
  loser: string;
}

/** Tamamlanan turların (kazanan, kaybeden) çiftleri; `flow` tamamlanmamışsa var olanlar. */
export function roundPicks(flow: MoodFlow): RoundPick[] {
  const w = flow.winners;
  const out: RoundPick[] = [];
  if (w.length >= 1) out.push({ winner: w[0], loser: w[0] === flow.four[0] ? flow.four[1] : flow.four[0] });
  if (w.length >= 2) out.push({ winner: w[1], loser: w[1] === flow.four[2] ? flow.four[3] : flow.four[2] });
  if (w.length >= 3) out.push({ winner: w[2], loser: w[2] === w[0] ? w[1] : w[0] });
  return out;
}

/**
 * Bir tur: +1 = kazanan DAHA SAKİN, −1 = DAHA HAREKETLİ, 0 = belirsiz.
 * Sakin: enerji en az ENERGY_DELTA düşük ve tempo daha hızlı değil, YA DA tempo en az bir kademe
 * yavaş ve enerji daha yüksek değil (enerji bilinmiyorsa yalnız tempo yeter). Hareketli: aynasi.
 * Çelişkili boyutlar (biri sakin, biri hareketli) → 0.
 */
export function roundVote(winner: FilmDims | undefined, loser: FilmDims | undefined): -1 | 0 | 1 {
  if (!winner || !loser) return 0;
  let calm = 0;
  let lively = 0;
  if (winner.energy !== null && loser.energy !== null) {
    const d = loser.energy - winner.energy;
    if (d >= ENERGY_DELTA - FP_EPS) calm += 1;
    else if (d <= -(ENERGY_DELTA - FP_EPS)) lively += 1;
  }
  if (winner.pace !== null && loser.pace !== null) {
    const d = PACE_RANK[loser.pace] - PACE_RANK[winner.pace];
    if (d >= 1) calm += 1;
    else if (d <= -1) lively += 1;
  }
  if (calm > 0 && lively === 0) return 1;
  if (lively > 0 && calm === 0) return -1;
  return 0;
}

export type PickPattern =
  | 'calmer_all' | 'calmer_two'
  | 'intense_all' | 'intense_two'
  | 'shorter_all' | 'shorter_two';

/** "Daha kısa" sayılması için asgari süre farkı (dakika). */
export const RUNTIME_DELTA_MIN = 15;

/** Bir tur: +1 = kazanan belirgin DAHA KISA, −1 = daha uzun, 0 = belirsiz / veri yok. */
export function runtimeVote(winner: number | null | undefined, loser: number | null | undefined): -1 | 0 | 1 {
  if (typeof winner !== 'number' || typeof loser !== 'number' || winner <= 0 || loser <= 0) return 0;
  const d = loser - winner;
  if (d >= RUNTIME_DELTA_MIN) return 1;
  if (d <= -RUNTIME_DELTA_MIN) return -1;
  return 0;
}

/** Bir boyutta tur oyları → 'all' (3 turun 3'ü), 'two' (>=2, karşıt yok) ya da null. */
function strength(votes: readonly number[], total: number, sign: 1 | -1): 'all' | 'two' | null {
  const same = votes.filter((v) => v === sign).length;
  const opposite = votes.filter((v) => v === -sign).length;
  if (opposite > 0 || same < PATTERN_MIN_ROUNDS) return null;
  return same === 3 && total === 3 ? 'all' : 'two';
}

/**
 * Desen (LLM yok). Üç boyut: daha sakin (tempo/enerji), daha yoğun (aynası), daha kısa (süre).
 * Bir boyutta en az PATTERN_MIN_ROUNDS tur aynı yönde ve HİÇ karşıt tur yoksa aday olur; 3 turun 3'ü
 * 'all', diğeri 'two'. Birden çok aday varsa 'all' 'two'dan güçlüdür; eşitlikte sıra sakin > yoğun > kısa.
 * Hiç aday yoksa null (satır çizilmez).
 */
export function detectPickPattern(
  picks: readonly RoundPick[],
  dimsById: Readonly<Record<string, FilmDims | undefined>>,
  runtimeById: Readonly<Record<string, number | null | undefined>> = {},
): PickPattern | null {
  if (picks.length < PATTERN_MIN_ROUNDS) return null;
  const mood = picks.map((p) => roundVote(dimsById[p.winner], dimsById[p.loser]));
  const time = picks.map((p) => runtimeVote(runtimeById[p.winner], runtimeById[p.loser]));
  const candidates: Array<{ pattern: PickPattern; level: 'all' | 'two' }> = [];
  const calm = strength(mood, picks.length, 1);
  const intense = strength(mood, picks.length, -1);
  const shorter = strength(time, picks.length, 1);
  if (calm) candidates.push({ pattern: `calmer_${calm}`, level: calm });
  if (intense) candidates.push({ pattern: `intense_${intense}`, level: intense });
  if (shorter) candidates.push({ pattern: `shorter_${shorter}`, level: shorter });
  const best = candidates.find((c) => c.level === 'all') ?? candidates[0];
  return best ? best.pattern : null;
}

/**
 * Faz 2-8 sunum kuralı: göreli içgörü ("quieter films" / "more intense films"), şampiyonun AYNI
 * eksendeki MUTLAK çipiyle çelişiyorsa gösterilmez. Film başına değil, genel kural.
 *  - calmer_*  ← champion enerjisi 'intense' VEYA tempo 'fast' ise çelişir
 *  - intense_* ← champion enerjisi 'gentle'  VEYA tempo 'slow' ise çelişir
 *  - shorter_* süre ekseni: çip tempo/enerji ile aynı eksen değil → hiç gizlenmez
 * Boyut verisi yoksa (null) çelişki kanıtlanamaz → içgörü kalır.
 */
export function insightContradictsChips(pattern: PickPattern, dims: FilmDims | undefined): boolean {
  if (dims === undefined) return false;
  const band = dims.energy !== null ? energyBand(dims.energy) : null;
  if (pattern === 'calmer_all' || pattern === 'calmer_two') return band === 'intense' || dims.pace === 'fast';
  if (pattern === 'intense_all' || pattern === 'intense_two') return band === 'gentle' || dims.pace === 'slow';
  return false;
}

/** Çizilecek içgörü deseni: çelişiyorsa null (satır yok). */
export function visibleInsight(pattern: PickPattern | null, dims: FilmDims | undefined): PickPattern | null {
  return pattern !== null && !insightContradictsChips(pattern, dims) ? pattern : null;
}
