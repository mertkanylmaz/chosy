/**
 * Archetype Engine — TasteProfile'dan sinefil arketipini hesaplar.
 *
 * Strateji: Agirlikli ozellik skoru (0-1 normalize edilmis).
 *   - Her arketip icin: score = sum(weight_i * feature_i) / sum(weight_i)
 *   - En yuksek skoru alan arketip ID'si doner.
 *   - Esik: MIN_SCORE_THRESHOLD altindaki sonuclar null doner
 *     (profil yeterince gelismemis demek).
 *
 * Gelecek surumler: Claude API ile semantik puanlama.
 *
 * Ek: getArchetypeProfile — her arketip icin kanonical TasteProfile.
 *   Today's Pick cold-start fallback'i icin kullanilir.
 */

// Uzantı BİLİNÇLİ: bu modül Deno'dan (recompute-taste-vector) da import edilir
// ve Deno extensionless yolu çözemez (TS2307). `types/index.ts` bağımlılıksız
// saf tip dosyası olduğu için zincir Deno'da güvenle çözülür.
import type { TasteProfile } from '../types/index.ts';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** Bu skorun altinda arketip atamaz (profil yeterli degil) */
const MIN_SCORE_THRESHOLD = 0.35;

// ─── Yardimcilar ──────────────────────────────────────────────────────────────

interface WeightedFeature {
  w: number;
  v: number;
}

/**
 * Agirlikli ortalama: sum(w*v) / sum(w)
 * v degerleri [0,1] araliginda olmalidir.
 */
function weightedScore(features: WeightedFeature[]): number {
  let sumWV = 0;
  let sumW = 0;
  for (const { w, v } of features) {
    sumWV += w * Math.max(0, Math.min(1, v));
    sumW += w;
  }
  return sumW > 0 ? sumWV / sumW : 0;
}

/** Hiz tercihini 0-1 sayisina donusturur */
function paceScore(pace: TasteProfile['pace_preference'], target: 'slow' | 'medium' | 'fast'): number {
  if (pace === target) return 1;
  // Komsu tempo: yarim puan
  const order: TasteProfile['pace_preference'][] = ['slow', 'medium', 'fast'];
  const paceIdx = order.indexOf(pace);
  const targetIdx = order.indexOf(target);
  return Math.abs(paceIdx - targetIdx) === 1 ? 0.45 : 0;
}

/** Visual style eslesme skoru */
function visualScore(style: TasteProfile['visual_style'], ...targets: TasteProfile['visual_style'][]): number {
  return targets.includes(style) ? 1 : 0;
}

/** Ending preference eslesme skoru */
function endingScore(ending: TasteProfile['ending_preference'], ...targets: TasteProfile['ending_preference'][]): number {
  return targets.includes(ending) ? 1 : 0;
}

/** Social context eslesme skoru */
function socialScore(ctx: TasteProfile['social_context'], ...targets: TasteProfile['social_context'][]): number {
  return targets.includes(ctx) ? 1 : 0;
}

/** Narrative style eslesme skoru */
function narrativeScore(ns: TasteProfile['narrative_style'], ...targets: TasteProfile['narrative_style'][]): number {
  return targets.includes(ns) ? 1 : 0;
}

// ─── Arketip Skorlari ─────────────────────────────────────────────────────────

/**
 * 1. Adrenalin Bagimlisi (The Adrenaline Junkie)
 * Karakteristik: yuksek enerji, hizli tempo, korku/gerginlik, ham/sinematik gorsel
 */
function score1(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.0, v: p.energy_level },
    { w: 2.5, v: paceScore(p.pace_preference, 'fast') },
    { w: 2.0, v: e.fear },
    { w: 1.5, v: e.anger },
    { w: 1.5, v: e.anticipation },
    { w: 1.0, v: visualScore(p.visual_style, 'raw', 'cinematic') },
  ]);
}

/**
 * 2. Zihin Bukucu (The Mind-Bender)
 * Karakteristik: yuksek tematik derinlik, surpriz/beklenti, deneysel/dogrusal olmayan
 */
function score2(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.0, v: p.thematic_depth },
    { w: 2.5, v: e.surprise },
    { w: 2.0, v: e.anticipation },
    { w: 2.0, v: narrativeScore(p.narrative_style, 'nonlinear', 'anthology') },
    { w: 1.5, v: visualScore(p.visual_style, 'experimental') },
    { w: 1.0, v: socialScore(p.social_context, 'alone') },
  ]);
}

/**
 * 3. Gozyasi Hirsizi (The Melancholy Soul)
 * Karakteristik: yuksek uzuntu, yavash tempo, acikuclu/trajik bitis, derin temalar
 */
function score3(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.5, v: e.sadness },
    { w: 2.5, v: p.thematic_depth },
    { w: 2.0, v: paceScore(p.pace_preference, 'slow') },
    { w: 2.0, v: endingScore(p.ending_preference, 'bittersweet', 'tragic') },
    { w: 1.0, v: 1 - e.joy },
  ]);
}

/**
 * 4. Gulumseme Avcisi (The Joy Seeker)
 * Karakteristik: yuksek neşe, umutlu bitis, hafif temalar, hizli/orta tempo
 */
function score4(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.5, v: e.joy },
    { w: 2.5, v: endingScore(p.ending_preference, 'hopeful', 'triumphant') },
    { w: 2.0, v: 1 - p.thematic_depth },
    { w: 1.5, v: paceScore(p.pace_preference, 'fast') + paceScore(p.pace_preference, 'medium') * 0.7 },
    { w: 1.5, v: socialScore(p.social_context, 'friends', 'family') },
  ]);
}

/**
 * 5. Umutsuz Romantik (The Hopeless Romantic)
 * Karakteristik: guven/neşe, cift baglami, tath-ac/umutlu bitis
 */
function score5(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.0, v: e.trust },
    { w: 2.5, v: e.joy },
    { w: 2.5, v: socialScore(p.social_context, 'couple') },
    { w: 2.0, v: endingScore(p.ending_preference, 'hopeful', 'bittersweet') },
    { w: 1.0, v: e.sadness > 0.4 ? e.sadness : 0 },
  ]);
}

/**
 * 6. Karanlik Yolcu (The Dark Passenger)
 * Karakteristik: yuksek korku/tiksinti, trajik/acik bitis, yalniz izleme, ham gorsel
 */
function score6(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.0, v: e.fear },
    { w: 3.0, v: e.disgust },
    { w: 2.0, v: endingScore(p.ending_preference, 'tragic', 'open', 'bittersweet') },
    { w: 1.5, v: socialScore(p.social_context, 'alone') },
    { w: 1.5, v: visualScore(p.visual_style, 'raw', 'experimental', 'minimalist') },
    { w: 0.5, v: 1 - e.joy },
  ]);
}

/**
 * 7. Gorsel Sair (The Visual Poet)
 * Karakteristik: estetik gorsel stil, derin temalar, yavas tempo, gorsel hayranligi
 */
function score7(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 2.8, v: visualScore(p.visual_style, 'lush') },
    { w: 2.5, v: p.thematic_depth },
    { w: 2.0, v: paceScore(p.pace_preference, 'slow') },
    { w: 1.5, v: (e.joy + e.surprise) / 2 },
    { w: 0.5, v: socialScore(p.social_context, 'alone') },
  ]);
}

/**
 * 8. Nostalji Bekcisi (The Nostalgia Keeper)
 * Karakteristik: eski doneme yonelim, tekrar izleme, guven/sicaklik, umutlu bitis
 */
function score8(p: TasteProfile): number {
  const e = p.emotional_state;
  const era = p.era_preference;
  // Eski doneme gore normallestirilmis skor
  const eraV =
    era.from < 1970 ? 1.0 :
    era.from < 1990 ? 0.8 :
    era.to < 2000 ? 0.6 :
    era.to < 2010 ? 0.35 : 0;

  return weightedScore([
    { w: 3.0, v: eraV },
    { w: 2.5, v: p.rewatch_tolerance ? 1 : 0 },
    { w: 2.5, v: e.trust },
    { w: 1.5, v: endingScore(p.ending_preference, 'hopeful', 'triumphant') },
    { w: 1.0, v: narrativeScore(p.narrative_style, 'linear') },
    { w: 1.0, v: visualScore(p.visual_style, 'minimalist', 'cinematic') },
  ]);
}

/**
 * 9. Kaos Elcisi (The Chaos Agent)
 * Karakteristik: onglenemeyen ogeler, yuksek ofke/sarpinti, ham/deneysel, anti-kahraman
 */
function score9(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.5, v: e.anger },
    { w: 2.5, v: e.surprise },
    { w: 2.5, v: e.disgust },
    { w: 1.5, v: paceScore(p.pace_preference, 'fast') },
    { w: 1.5, v: visualScore(p.visual_style, 'raw', 'experimental', 'minimalist') },
    { w: 1.5, v: 1 - e.fear },
    { w: 0.5, v: endingScore(p.ending_preference, 'open', 'tragic') },
  ]);
}

/**
 * 10. Huzur Gezgini (The Zen Wanderer)
 * Karakteristik: dusuk enerji, yavash tempo, guven, yalnizlik, dogayla baglanti
 */
function score10(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.0, v: 1 - p.energy_level },
    { w: 2.5, v: paceScore(p.pace_preference, 'slow') },
    { w: 2.0, v: e.trust },
    { w: 2.0, v: socialScore(p.social_context, 'alone') },
    { w: 1.5, v: (1 - e.fear + 1 - e.anger) / 2 },
  ]);
}

/**
 * 11. Gerceklik Dedektifi (The Truth Seeker)
 * Karakteristik: cok derin temalar, ham/minimalist gorsel, diyalog odakli, gercekci
 */
function score11(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.5, v: p.thematic_depth },
    { w: 2.5, v: visualScore(p.visual_style, 'raw', 'minimalist') },
    { w: 2.0, v: narrativeScore(p.narrative_style, 'dialogue-driven') },
    { w: 1.5, v: 1 - e.joy },
    { w: 1.5, v: (e.disgust + e.anger) / 2 },
  ]);
}

/**
 * 12. Fantastik Hayalperest (The Escapist)
 * Karakteristik: beklenti/neşe, yuksek enerji, bol gorsel, umutlu/zaferci bitis
 */
function score12(p: TasteProfile): number {
  const e = p.emotional_state;
  return weightedScore([
    { w: 3.0, v: e.anticipation },
    { w: 2.5, v: e.joy },
    { w: 2.0, v: p.energy_level },
    { w: 2.0, v: visualScore(p.visual_style, 'lush', 'cinematic') },
    { w: 1.5, v: endingScore(p.ending_preference, 'hopeful', 'triumphant') },
    { w: 0.5, v: p.rewatch_tolerance ? 1 : 0 },
  ]);
}

// ─── Skorlayicilar Dizisi ──────────────────────────────────────────────────────

/** id = index + 1 */
const SCORERS: ReadonlyArray<(p: TasteProfile) => number> = [
  score1, score2, score3, score4, score5, score6,
  score7, score8, score9, score10, score11, score12,
];

// ─── Ana Fonksiyon ─────────────────────────────────────────────────────────────

/**
 * Kullanicinin TasteProfile'indan en yakin sinefil arketipini hesaplar.
 *
 * @param profile - Kullanicinin 12-boyutlu tat profili
 * @returns Arketip ID'si (1-12) veya null (profil yoksa / esik alti)
 *
 * @example
 * const id = computeArchetype(lastProfile); // => 3 (The Melancholy Soul)
 * const archetype = getArchetype(id);       // => Archetype nesnesi
 */
export function computeArchetype(profile: TasteProfile | null): number | null {
  if (!profile) return null;

  let bestId = -1;
  let bestScore = -1;

  SCORERS.forEach((scorer, idx) => {
    const s = scorer(profile);
    if (s > bestScore) {
      bestScore = s;
      bestId = idx + 1;
    }
  });

  if (bestScore < MIN_SCORE_THRESHOLD) return null;
  return bestId;
}

/**
 * Tum arketiplerin skorlarini dondurur (hata ayiklama / analiz icin).
 *
 * @returns { id, score }[] — skora gore azalan sirali
 */
export function computeAllScores(profile: TasteProfile): { id: number; score: number }[] {
  return SCORERS
    .map((scorer, idx) => ({ id: idx + 1, score: scorer(profile) }))
    .sort((a, b) => b.score - a.score);
}

// ─── Kanonical Arketip Profilleri ─────────────────────────────────────────────

/**
 * Her sinefil arketipinin sinematik kimligini temsil eden kanonical TasteProfile.
 *
 * Kullanim:
 *   - Today's Pick cold-start: kullanici mood girmeden once arketipine gore oneri
 *   - Kalibrasyon sonrasi ilk gun: preferences_vector yokken devreye girer
 *   - Her profil archetypeEngine skor fonksiyonlariyla tutarlidir
 */
const ARCHETYPE_PROFILES: Readonly<Record<number, TasteProfile>> = {
  /** 1 — Adrenalin Bagimlisi: hizli, yuksek enerji, gerilim/aksiyon */
  1: {
    emotional_state: { joy: 0.3, sadness: 0.1, anger: 0.7, fear: 0.8, surprise: 0.5, disgust: 0.2, anticipation: 0.8, trust: 0.3 },
    energy_level: 0.9,
    pace_preference: 'fast',
    visual_style: 'cinematic',
    thematic_depth: 0.35,
    ending_preference: 'triumphant',
    era_preference: { from: 1990, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'friends',
    rewatch_tolerance: true,
  },
  /** 2 — Zihin Bukucu: derin, dogrusal olmayan, zihin-buran */
  2: {
    emotional_state: { joy: 0.3, sadness: 0.4, anger: 0.3, fear: 0.5, surprise: 0.9, disgust: 0.2, anticipation: 0.8, trust: 0.3 },
    energy_level: 0.6,
    pace_preference: 'medium',
    visual_style: 'experimental',
    thematic_depth: 0.95,
    ending_preference: 'open',
    era_preference: { from: 1990, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'nonlinear',
    social_context: 'alone',
    rewatch_tolerance: true,
  },
  /** 3 — Gozyasi Hirsizi: melankolik, yavas, tath-ac bitis */
  3: {
    emotional_state: { joy: 0.2, sadness: 0.9, anger: 0.2, fear: 0.3, surprise: 0.3, disgust: 0.1, anticipation: 0.4, trust: 0.5 },
    energy_level: 0.25,
    pace_preference: 'slow',
    visual_style: 'lush',
    thematic_depth: 0.8,
    ending_preference: 'bittersweet',
    era_preference: { from: 1980, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'alone',
    rewatch_tolerance: false,
  },
  /** 4 — Gulumseme Avcisi: neşeli, umutlu, hafif temalar */
  4: {
    emotional_state: { joy: 0.95, sadness: 0.1, anger: 0.1, fear: 0.1, surprise: 0.5, disgust: 0.05, anticipation: 0.6, trust: 0.7 },
    energy_level: 0.7,
    pace_preference: 'fast',
    visual_style: 'cinematic',
    thematic_depth: 0.2,
    ending_preference: 'hopeful',
    era_preference: { from: 1990, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'friends',
    rewatch_tolerance: true,
  },
  /** 5 — Umutsuz Romantik: guven/ask, cift baglami, tath-ac */
  5: {
    emotional_state: { joy: 0.7, sadness: 0.5, anger: 0.1, fear: 0.2, surprise: 0.3, disgust: 0.05, anticipation: 0.6, trust: 0.9 },
    energy_level: 0.45,
    pace_preference: 'medium',
    visual_style: 'lush',
    thematic_depth: 0.6,
    ending_preference: 'bittersweet',
    era_preference: { from: 1980, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'couple',
    rewatch_tolerance: true,
  },
  /** 6 — Karanlik Yolcu: karanlik temalar, trajik, yalniz izleme */
  6: {
    emotional_state: { joy: 0.05, sadness: 0.5, anger: 0.5, fear: 0.9, surprise: 0.4, disgust: 0.8, anticipation: 0.4, trust: 0.2 },
    energy_level: 0.55,
    pace_preference: 'medium',
    visual_style: 'raw',
    thematic_depth: 0.8,
    ending_preference: 'tragic',
    era_preference: { from: 1970, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'nonlinear',
    social_context: 'alone',
    rewatch_tolerance: false,
  },
  /** 7 — Gorsel Sair: estetik, yavas, gorsel hikaye anlayisi */
  7: {
    emotional_state: { joy: 0.5, sadness: 0.4, anger: 0.1, fear: 0.2, surprise: 0.6, disgust: 0.1, anticipation: 0.5, trust: 0.6 },
    energy_level: 0.3,
    pace_preference: 'slow',
    visual_style: 'lush',
    thematic_depth: 0.85,
    ending_preference: 'open',
    era_preference: { from: 1960, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'nonlinear',
    social_context: 'alone',
    rewatch_tolerance: true,
  },
  /** 8 — Nostalji Bekcisi: klasik donem, tekrar izleme, sicak/guvenli */
  8: {
    emotional_state: { joy: 0.7, sadness: 0.3, anger: 0.1, fear: 0.15, surprise: 0.3, disgust: 0.05, anticipation: 0.5, trust: 0.85 },
    energy_level: 0.4,
    pace_preference: 'medium',
    visual_style: 'cinematic',
    thematic_depth: 0.5,
    ending_preference: 'hopeful',
    era_preference: { from: 1940, to: 1990 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'family',
    rewatch_tolerance: true,
  },
  /** 9 — Kaos Elcisi: kaotik, ongoren olmayan, ham enerji */
  9: {
    emotional_state: { joy: 0.3, sadness: 0.2, anger: 0.9, fear: 0.4, surprise: 0.8, disgust: 0.6, anticipation: 0.5, trust: 0.15 },
    energy_level: 0.85,
    pace_preference: 'fast',
    visual_style: 'raw',
    thematic_depth: 0.5,
    ending_preference: 'open',
    era_preference: { from: 1990, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'nonlinear',
    social_context: 'alone',
    rewatch_tolerance: false,
  },
  /** 10 — Huzur Gezgini: sakin, dusuk enerji, i huzur arayan */
  10: {
    emotional_state: { joy: 0.5, sadness: 0.3, anger: 0.05, fear: 0.05, surprise: 0.3, disgust: 0.05, anticipation: 0.3, trust: 0.85 },
    energy_level: 0.15,
    pace_preference: 'slow',
    visual_style: 'minimalist',
    thematic_depth: 0.6,
    ending_preference: 'open',
    era_preference: { from: 1970, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'alone',
    rewatch_tolerance: true,
  },
  /** 11 — Gerceklik Dedektifi: ham gercekcilik, diyalog odakli, derin analiz */
  11: {
    emotional_state: { joy: 0.2, sadness: 0.5, anger: 0.4, fear: 0.3, surprise: 0.3, disgust: 0.4, anticipation: 0.6, trust: 0.4 },
    energy_level: 0.4,
    pace_preference: 'slow',
    visual_style: 'raw',
    thematic_depth: 0.95,
    ending_preference: 'open',
    era_preference: { from: 1960, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'dialogue-driven',
    social_context: 'alone',
    rewatch_tolerance: true,
  },
  /** 12 — Fantastik Hayalperest: epik, gorselli, umut dolu macera */
  12: {
    emotional_state: { joy: 0.8, sadness: 0.1, anger: 0.1, fear: 0.2, surprise: 0.5, disgust: 0.05, anticipation: 0.9, trust: 0.6 },
    energy_level: 0.85,
    pace_preference: 'fast',
    visual_style: 'lush',
    thematic_depth: 0.4,
    ending_preference: 'triumphant',
    era_preference: { from: 1990, to: 2024 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'friends',
    rewatch_tolerance: true,
  },
};

/**
 * Verilen arketip ID'sine karsilik gelen kanonical TasteProfile'i dondurur.
 *
 * Today's Pick cold-start senaryosunda kullanilir: kalibrasyon tamamlanmis ama
 * henuz mood session yoksa, arketip kimligine gore film onerisi uretilir.
 *
 * @param archetypeId - 1-12 arasi arketip kimlik numarasi
 * @returns TasteProfile veya null (gecersiz ID)
 */
export function getArchetypeProfile(archetypeId: number): TasteProfile | null {
  return ARCHETYPE_PROFILES[archetypeId] ?? null;
}
