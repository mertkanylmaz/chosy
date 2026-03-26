/**
 * Paylaşımlı vektör kodlama modülü — Tek Kaynak Doğruluk (Single Source of Truth)
 *
 * TasteProfile'ı pgvector cosine similarity araması için 384 boyutlu sayısal
 * vektöre dönüştürür.
 *
 * Bu modül şu yerlerden import edilir:
 *   1. scripts/profile-films.ts              (film profilleme pipeline)
 *   2. supabase/functions/recommend/         (öneri endpoint)
 *   3. supabase/functions/parse-taste/       (taste parser)
 */

// ─── Tip Tanımları ────────────────────────────────────────────────────────────
// Not: types/index.ts ile yapısal olarak uyumludur (structural typing).
// Her iki ortamda (Node.js / Deno) bağımsız çalışması için burada tanımlanmıştır.

export interface EmotionalState {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
  anticipation: number;
  trust: number;
}

export type PacePreference = 'slow' | 'medium' | 'fast';
export type VisualStyle = 'minimalist' | 'cinematic' | 'experimental' | 'lush' | 'raw';
export type EndingPreference = 'hopeful' | 'bittersweet' | 'open' | 'tragic' | 'triumphant';
export type NarrativeStyle = 'linear' | 'nonlinear' | 'anthology' | 'dialogue-driven';
export type SocialContext = 'alone' | 'couple' | 'friends' | 'family';

export interface EraPreference {
  from: number;
  to: number;
}

export interface TasteProfile {
  emotional_state: EmotionalState;
  energy_level: number;
  pace_preference: PacePreference;
  visual_style: VisualStyle;
  thematic_depth: number;
  ending_preference: EndingPreference;
  era_preference: EraPreference;
  cultural_context: string[];
  avoid_signals: string[];
  narrative_style: NarrativeStyle;
  social_context: SocialContext;
  rewatch_tolerance: boolean;
}

// ─── Vektör Layout Sabiti ─────────────────────────────────────────────────────

/**
 * 384 boyutlu vektörde her segmentin başlangıç/bitiş indeksleri.
 *
 * Segment dağılımı:
 *   Boyut  1  emotional_state  [  0.. 63]  8 duygu × 8 tekrar      =  64
 *   Boyut  2  energy_level     [ 64.. 71]  1 değer × 8 tekrar      =   8
 *   Boyut  3  pace_preference  [ 72.. 95]  3 kategori × 8 tekrar   =  24
 *   Boyut  4  visual_style     [ 96..135]  5 kategori × 8 tekrar   =  40
 *   Boyut  5  thematic_depth   [136..143]  1 değer × 8 tekrar      =   8
 *   Boyut  6  ending_pref      [144..183]  5 kategori × 8 tekrar   =  40
 *   Boyut  7  era_preference   [184..199]  2 değer × 8 tekrar      =  16
 *   Boyut  8  cultural_context [200..239]  Bloom-filter hash        =  40
 *   Boyut  9  avoid_signals    [240..279]  Bloom-filter hash        =  40
 *   Boyut 10  narrative_style  [280..311]  4 kategori × 8 tekrar   =  32
 *   Boyut 11  social_context   [312..343]  4 kategori × 8 tekrar   =  32
 *   Boyut 12  rewatch_tol.     [344..351]  1 değer × 8 tekrar      =   8
 *   Padding                    [352..383]  sıfır dolgusu            =  32
 *                                                              Toplam = 384
 */
export const VECTOR_LAYOUT = {
  emotional_state:   { start:   0, end:  63, dims: 64 },
  energy_level:      { start:  64, end:  71, dims:  8 },
  pace_preference:   { start:  72, end:  95, dims: 24 },
  visual_style:      { start:  96, end: 135, dims: 40 },
  thematic_depth:    { start: 136, end: 143, dims:  8 },
  ending_preference: { start: 144, end: 183, dims: 40 },
  era_preference:    { start: 184, end: 199, dims: 16 },
  cultural_context:  { start: 200, end: 239, dims: 40 },
  avoid_signals:     { start: 240, end: 279, dims: 40 },
  narrative_style:   { start: 280, end: 311, dims: 32 },
  social_context:    { start: 312, end: 343, dims: 32 },
  rewatch_tolerance: { start: 344, end: 351, dims:  8 },
  padding:           { start: 352, end: 383, dims: 32 },
} as const;

/** Toplam vektör boyutu: pgvector kolonuyla uyumlu olmalı */
export const VECTOR_DIM = 384;

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/**
 * String dizisini Bloom filter benzeri çift-hash ile sabit boyutlu ikili
 * vektöre dönüştürür.
 *
 * - Her string için iki bağımsız polinom hash (h1: base-31, h2: base-17) hesaplanır.
 * - Her hash, sonuç vektöründe bir konumu 1 olarak işaretler.
 * - Aynı girdi her zaman aynı konumları işaretler (deterministik).
 *
 * @param items - Hash'lenecek string dizisi
 * @param dims  - Çıktı vektörünün boyutu
 */
function hashStringArray(items: string[], dims: number): number[] {
  const result = new Array<number>(dims).fill(0);
  for (const item of items) {
    const s = item.toLowerCase().trim();
    let h1 = 0;
    let h2 = 7;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = (Math.imul(31, h1) + c) | 0;
      h2 = (Math.imul(17, h2) + c) | 0;
    }
    result[Math.abs(h1) % dims] = 1;
    result[Math.abs(h2) % dims] = 1;
  }
  return result;
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

/**
 * TasteProfile'ı 384 boyutlu sayısal vektöre dönüştürür.
 *
 * Kodlama stratejileri:
 *   - Sürekli sayısal değerler ([0-1]):   doğrudan kopyalanır
 *   - Kategorik değerler:                 one-hot encoding
 *   - String dizileri:                    Bloom-filter hash (deterministik)
 *   - Yıl aralığı:                        [0,1] normalize (baz yıl: 1900, aralık: 130)
 *
 * Her segment cosine similarity kararlılığı için 8 kat tekrarlanır.
 * VECTOR_LAYOUT sabitiyle hangi indeksler hangi boyuta karşılık gelir belgelidir.
 *
 * @param profile - Dönüştürülecek TasteProfile
 * @returns VECTOR_DIM (384) uzunluğunda number[]
 */
export function tasteProfileToVector(profile: TasteProfile): number[] {
  const vec: number[] = [];

  // Segment 1: emotional_state — [0..63]
  const emotions = [
    profile.emotional_state.joy,
    profile.emotional_state.sadness,
    profile.emotional_state.anger,
    profile.emotional_state.fear,
    profile.emotional_state.surprise,
    profile.emotional_state.disgust,
    profile.emotional_state.anticipation,
    profile.emotional_state.trust,
  ];
  for (let r = 0; r < 8; r++) vec.push(...emotions);

  // Segment 2: energy_level — [64..71]
  for (let r = 0; r < 8; r++) vec.push(profile.energy_level);

  // Segment 3: pace_preference — [72..95]
  const paceOpts: PacePreference[] = ['slow', 'medium', 'fast'];
  const paceVec = paceOpts.map((p) => (p === profile.pace_preference ? 1 : 0));
  for (let r = 0; r < 8; r++) vec.push(...paceVec);

  // Segment 4: visual_style — [96..135]
  const vsOpts: VisualStyle[] = ['minimalist', 'cinematic', 'experimental', 'lush', 'raw'];
  const vsVec = vsOpts.map((v) => (v === profile.visual_style ? 1 : 0));
  for (let r = 0; r < 8; r++) vec.push(...vsVec);

  // Segment 5: thematic_depth — [136..143]
  for (let r = 0; r < 8; r++) vec.push(profile.thematic_depth);

  // Segment 6: ending_preference — [144..183]
  const endOpts: EndingPreference[] = ['hopeful', 'bittersweet', 'open', 'tragic', 'triumphant'];
  const endVec = endOpts.map((e) => (e === profile.ending_preference ? 1 : 0));
  for (let r = 0; r < 8; r++) vec.push(...endVec);

  // Segment 7: era_preference — [184..199]
  // [1900, 2030] → [0.0, 1.0]; sınır dışı değerler sıkıştırılır
  const eraFrom = Math.min(1, Math.max(0, (profile.era_preference.from - 1900) / 130));
  const eraTo   = Math.min(1, Math.max(0, (profile.era_preference.to   - 1900) / 130));
  for (let r = 0; r < 8; r++) vec.push(eraFrom, eraTo);

  // Segment 8: cultural_context — [200..239]
  vec.push(...hashStringArray(profile.cultural_context, 40));

  // Segment 9: avoid_signals — [240..279]
  vec.push(...hashStringArray(profile.avoid_signals, 40));

  // Segment 10: narrative_style — [280..311]
  const narOpts: NarrativeStyle[] = ['linear', 'nonlinear', 'anthology', 'dialogue-driven'];
  const narVec = narOpts.map((n) => (n === profile.narrative_style ? 1 : 0));
  for (let r = 0; r < 8; r++) vec.push(...narVec);

  // Segment 11: social_context — [312..343]
  const socOpts: SocialContext[] = ['alone', 'couple', 'friends', 'family'];
  const socVec = socOpts.map((s) => (s === profile.social_context ? 1 : 0));
  for (let r = 0; r < 8; r++) vec.push(...socVec);

  // Segment 12: rewatch_tolerance — [344..351]
  const rewatch = profile.rewatch_tolerance ? 1.0 : 0.0;
  for (let r = 0; r < 8; r++) vec.push(rewatch);

  // Padding [352..383] — 32 sıfır
  while (vec.length < VECTOR_DIM) vec.push(0);

  return vec;
}
