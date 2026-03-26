/**
 * tasteParser — İki Katmanlı Mood Analizi (v2)
 *
 * Katman 1 (Birincil): Claude API — Supabase Edge Function `parse-mood`
 * Katman 2 (Fallback): Kapsamlı keyword-based analiz (200+ keyword)
 *
 * Fallback özellikleri:
 * - Nötr başlangıç (0.5): sadece eşleşen boyutlar değişir
 * - Birden fazla eşleşme → ortalama
 * - Negasyon tespiti: "not scary", "no violence", "istemiyorum"
 * - Çoklu duygu AND mantığı: "funny but sad" → her ikisi de yüksek
 * - Yönetmen / film referansı: "Nolan style", "like Inception"
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants/config';
import { supabase } from './supabase';
import {
  EndingPreference,
  NarrativeStyle,
  PacePreference,
  SocialContext,
  TasteProfile,
  VisualStyle,
} from '../types';

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

/** Kullanıcı başına son istek zamanları (in-memory) */
const rateLimitStore = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

async function checkRateLimit(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const key = session?.user?.id ?? 'anon';
  const now = Date.now();
  const prev = rateLimitStore.get(key) ?? [];
  const recent = prev.filter((ts) => now - ts < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    throw new Error('Rate limit: please wait before making another request.');
  }
  recent.push(now);
  rateLimitStore.set(key, recent);
}

// ─── Edge Function ────────────────────────────────────────────────────────────

type EdgeResponse = TasteProfile & {
  profile_name?: string;
  profile_description?: string;
};

async function callEdgeFunction(input: string): Promise<EdgeResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-mood`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ raw_input: input }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Edge Function ${res.status}: ${body}`);
    }

    return (await res.json()) as EdgeResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateAndNormalize(raw: EdgeResponse): TasteProfile {
  const clamp = (v: unknown, fallback = 0.5): number => {
    const n = typeof v === 'number' ? v : fallback;
    return Math.min(1, Math.max(0, n));
  };
  const oneOf = <T extends string>(
    v: unknown,
    options: readonly T[],
    fallback: T,
  ): T => (options.includes(v as T) ? (v as T) : fallback);

  const es = raw?.emotional_state;
  return {
    emotional_state: {
      joy: clamp(es?.joy),
      sadness: clamp(es?.sadness),
      anger: clamp(es?.anger),
      fear: clamp(es?.fear),
      surprise: clamp(es?.surprise),
      disgust: clamp(es?.disgust),
      anticipation: clamp(es?.anticipation),
      trust: clamp(es?.trust),
    },
    energy_level: clamp(raw?.energy_level),
    pace_preference: oneOf<PacePreference>(
      raw?.pace_preference,
      ['slow', 'medium', 'fast'],
      'medium',
    ),
    visual_style: oneOf<VisualStyle>(
      raw?.visual_style,
      ['minimalist', 'cinematic', 'experimental', 'lush', 'raw'],
      'cinematic',
    ),
    thematic_depth: clamp(raw?.thematic_depth),
    ending_preference: oneOf<EndingPreference>(
      raw?.ending_preference,
      ['hopeful', 'bittersweet', 'open', 'tragic', 'triumphant'],
      'open',
    ),
    era_preference: {
      from:
        typeof raw?.era_preference?.from === 'number'
          ? raw.era_preference.from
          : 1970,
      to:
        typeof raw?.era_preference?.to === 'number'
          ? raw.era_preference.to
          : 2025,
    },
    cultural_context: Array.isArray(raw?.cultural_context)
      ? raw.cultural_context
      : [],
    avoid_signals: Array.isArray(raw?.avoid_signals) ? raw.avoid_signals : [],
    narrative_style: oneOf<NarrativeStyle>(
      raw?.narrative_style,
      ['linear', 'nonlinear', 'anthology', 'dialogue-driven'],
      'linear',
    ),
    social_context: oneOf<SocialContext>(
      raw?.social_context,
      ['alone', 'couple', 'friends', 'family'],
      'alone',
    ),
    rewatch_tolerance:
      typeof raw?.rewatch_tolerance === 'boolean'
        ? raw.rewatch_tolerance
        : false,
  };
}

// ─── Rule-Based Fallback (v2) ──────────────────────────────────────────────────

/** Tüm boyutlar nötr (0.5) — sadece eşleşenler değişir */
function neutralProfile(): TasteProfile {
  return {
    emotional_state: {
      joy: 0.5,
      sadness: 0.5,
      anger: 0.5,
      fear: 0.5,
      surprise: 0.5,
      disgust: 0.5,
      anticipation: 0.5,
      trust: 0.5,
    },
    energy_level: 0.5,
    pace_preference: 'medium',
    visual_style: 'cinematic',
    thematic_depth: 0.5,
    ending_preference: 'open',
    era_preference: { from: 1970, to: 2025 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'alone',
    rewatch_tolerance: false,
  };
}

/** Sayısal skor biriktiricisi — birden fazla eşleşme ortalamasını döner */
type ScoreKey =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'disgust'
  | 'anticipation'
  | 'trust'
  | 'energy'
  | 'depth';

type ScoreAcc = Record<ScoreKey, number[]>;

function makeAcc(): ScoreAcc {
  return {
    joy: [],
    sadness: [],
    anger: [],
    fear: [],
    surprise: [],
    disgust: [],
    anticipation: [],
    trust: [],
    energy: [],
    depth: [],
  };
}

function avgAcc(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ─── Keyword Map ──────────────────────────────────────────────────────────────

type KeywordEffect = Partial<{
  joy: number;
  sadness: number;
  fear: number;
  anger: number;
  surprise: number;
  anticipation: number;
  trust: number;
  disgust: number;
  energy_level: number;
  thematic_depth: number;
  visual_style: VisualStyle;
  pace_preference: PacePreference;
  ending_preference: EndingPreference;
}>;

const KEYWORD_MAP: Record<string, KeywordEffect> = {
  // Joy / Pozitif
  happy: { joy: 0.85, energy_level: 0.7 },
  cheerful: { joy: 0.85, energy_level: 0.7 },
  uplifting: { joy: 0.8, energy_level: 0.6 },
  fun: { joy: 0.75, thematic_depth: 0.2 },
  funny: { joy: 0.8, thematic_depth: 0.2 },
  comedy: { joy: 0.8, thematic_depth: 0.2 },
  light: { joy: 0.6, thematic_depth: 0.2 },
  // Sadness / Hüzün
  sad: { sadness: 0.85, energy_level: 0.25 },
  melancholic: { sadness: 0.8, energy_level: 0.2 },
  melancholy: { sadness: 0.8, energy_level: 0.2 },
  grief: { sadness: 0.9, thematic_depth: 0.8 },
  lonely: { sadness: 0.75, energy_level: 0.2 },
  heartbreak: { sadness: 0.85, joy: 0.2 },
  // Fear / Korku
  scary: { fear: 0.85, anticipation: 0.8 },
  horror: { fear: 0.9, anticipation: 0.7 },
  tense: { fear: 0.7, anticipation: 0.85 },
  thriller: { fear: 0.7, anticipation: 0.85 },
  suspense: { fear: 0.65, anticipation: 0.9 },
  creepy: { fear: 0.8, anticipation: 0.6 },
  // Anger / Öfke
  angry: { anger: 0.85, energy_level: 0.85 },
  revenge: { anger: 0.8, anticipation: 0.8 },
  rage: { anger: 0.9, energy_level: 0.9 },
  intense: { anger: 0.6, energy_level: 0.8 },
  // Romantic / Aşk
  romantic: { joy: 0.7, trust: 0.8 },
  love: { joy: 0.7, trust: 0.85 },
  passionate: { joy: 0.6, trust: 0.7, energy_level: 0.7 },
  // Calm / Sakin
  calm: { energy_level: 0.15, sadness: 0.3 },
  peaceful: { energy_level: 0.1, trust: 0.7, joy: 0.5 },
  quiet: { energy_level: 0.15 },
  relaxing: { energy_level: 0.2, joy: 0.5 },
  chill: { energy_level: 0.2 },
  // Energetic
  energetic: { energy_level: 0.9, anticipation: 0.8 },
  action: { energy_level: 0.9, anticipation: 0.85 },
  exciting: { energy_level: 0.85, anticipation: 0.8 },
  fast: { energy_level: 0.85 },
  adrenaline: { energy_level: 0.95, anticipation: 0.9 },
  // Depth / Derinlik
  deep: { thematic_depth: 0.9 },
  philosophical: { thematic_depth: 0.95 },
  'thought-provoking': { thematic_depth: 0.9 },
  meaningful: { thematic_depth: 0.85 },
  'mind-bending': { thematic_depth: 0.95, surprise: 0.85 },
  complex: { thematic_depth: 0.85 },
  // Visual
  beautiful: { visual_style: 'cinematic' },
  cinematic: { visual_style: 'cinematic' },
  raw: { visual_style: 'raw' },
  gritty: { visual_style: 'raw' },
  artistic: { visual_style: 'experimental' },
  experimental: { visual_style: 'experimental' },
  // Pace
  slow: { pace_preference: 'slow' },
  contemplative: { pace_preference: 'slow', thematic_depth: 0.7 },
  'fast-paced': { pace_preference: 'fast', energy_level: 0.8 },
  // Ending
  hopeful: { ending_preference: 'hopeful', joy: 0.6, trust: 0.7, anticipation: 0.7 },
  dark: { ending_preference: 'tragic', sadness: 0.6 },
  bittersweet: { ending_preference: 'bittersweet' },
  nostalgic: { anticipation: 0.6, trust: 0.7, sadness: 0.4 },
  // Emotional states
  tired: { energy_level: 0.1, sadness: 0.4 },
  exhausted: { energy_level: 0.05, sadness: 0.5 },
  bored: { energy_level: 0.3, surprise: 0.7 },
  curious: { anticipation: 0.8, surprise: 0.7 },
  anxious: { fear: 0.6, anticipation: 0.7, energy_level: 0.6 },
  cozy: { energy_level: 0.15, joy: 0.6, trust: 0.7 },
  inspired: { joy: 0.7, anticipation: 0.8, thematic_depth: 0.7 },
  empty: { sadness: 0.7, energy_level: 0.15 },
  excited: { joy: 0.8, energy_level: 0.9, anticipation: 0.85 },
  stressed: { anger: 0.5, fear: 0.5, energy_level: 0.7 },
  confused: { surprise: 0.6, fear: 0.4 },
  grateful: { joy: 0.7, trust: 0.85 },
  // Türkçe keywords
  mutlu: { joy: 0.85, energy_level: 0.7 },
  hüzünlü: { sadness: 0.85, energy_level: 0.25 },
  korku: { fear: 0.85, anticipation: 0.8 },
  sakin: { energy_level: 0.15 },
  enerjik: { energy_level: 0.9 },
  derin: { thematic_depth: 0.9 },
  romantik: { joy: 0.7, trust: 0.8 },
  gerilim: { fear: 0.7, anticipation: 0.85 },
  komedi: { joy: 0.8, thematic_depth: 0.2 },
  aksiyon: { energy_level: 0.9, anticipation: 0.85 },
  // Türkçe duygu durumları
  yorgun: { energy_level: 0.1, sadness: 0.4 },
  'sıkılmış': { energy_level: 0.3, surprise: 0.7 },
  meraklı: { anticipation: 0.8, surprise: 0.7 },
  huzurlu: { energy_level: 0.1, trust: 0.7, joy: 0.5 },
  heyecanlı: { joy: 0.8, energy_level: 0.9, anticipation: 0.85 },
  stresli: { anger: 0.5, fear: 0.5, energy_level: 0.7 },
};

const KM_NEGATE_WORDS = new Set(['not', 'no', 'never', 'değil', 'hayır']);
const KM_DIM_TO_SCORE: Record<string, ScoreKey> = {
  joy: 'joy', sadness: 'sadness', fear: 'fear', anger: 'anger',
  surprise: 'surprise', anticipation: 'anticipation',
  trust: 'trust', disgust: 'disgust',
  energy_level: 'energy', thematic_depth: 'depth',
};

/**
 * KEYWORD_MAP ile metin içindeki her kelimeyi tarar.
 * Eşleşen keyword değerlerini acc'e push eder;
 * önceki kelime negasyon ise değeri tersine çevirir (0.85 → 0.15).
 */
function applyKeywordMap(text: string, acc: ScoreAcc, profile: TasteProfile): void {
  // Boşluk ve noktalama ile böl, heyfen koru (mind-bending, fast-paced vb.)
  const words = text.split(/[\s.,!?;:'"()\[\]/\\]+/).filter(Boolean);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[tasteParser] Input text:', text);
  }

  const matchedKeywords: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const negated = i > 0 && KM_NEGATE_WORDS.has(words[i - 1]);
    const effect = KEYWORD_MAP[word];
    if (!effect) continue;

    matchedKeywords.push(negated ? `NOT:${word}` : word);

    for (const [dim, val] of Object.entries(effect)) {
      if (dim === 'visual_style') {
        if (!negated) profile.visual_style = val as VisualStyle;
      } else if (dim === 'pace_preference') {
        if (!negated) profile.pace_preference = val as PacePreference;
      } else if (dim === 'ending_preference') {
        if (!negated) profile.ending_preference = val as EndingPreference;
      } else {
        const n = val as number;
        const finalVal = negated ? clamp01(1 - n) : n;
        const key = KM_DIM_TO_SCORE[dim];
        if (key) acc[key].push(finalVal);
      }
    }
  }

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[tasteParser] Matched keywords:', matchedKeywords);
  }
}

/**
 * Metindeki negasyon bölgelerini tespit eder.
 * "not scary", "no violence", "korkmak istemiyorum" → negated token seti.
 */
function buildNegatedTokens(text: string): Set<string> {
  const negated = new Set<string>();

  // "not/no/never/without/don't/avoid" + sonraki 1-2 kelime
  const negWords =
    /\b(?:not|no|never|without|don'?t|avoid|istemiyorum|değil|yok|olmadan|kaçın|istemem|hayır|sevmiyorum)\s+(\w+(?:\s+\w+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = negWords.exec(text)) !== null) {
    m[1].split(/\s+/).forEach((tok) => negated.add(tok));
  }

  // "nothing too heavy/dark/scary"
  const nothingToo = /nothing\s+(?:too\s+)?(\w+)/gi;
  while ((m = nothingToo.exec(text)) !== null) {
    negated.add(m[1]);
  }

  // "X istemiyorum" (TR: kelime + istemiyorum)
  const trNeg = /(\w+)\s+istemiyorum/gi;
  while ((m = trNeg.exec(text)) !== null) {
    negated.add(m[1]);
  }

  return negated;
}

/**
 * Kapsamlı keyword eşleştirmesiyle TasteProfile oluşturur (v2).
 * 200+ keyword, negasyon, yönetmen/film referansları.
 */
function ruleBased(rawInput: string): TasteProfile {
  const t = rawInput.toLowerCase();
  const p = neutralProfile();
  const neg = buildNegatedTokens(t);
  const acc = makeAcc();

  // ── 0. KEYWORD_MAP TARAMASI (kelime kelime, çoklu eşleşme → ortalama) ───────
  applyKeywordMap(t, acc, p);

  /** Pattern eşleşiyor mu? */
  const hit = (re: RegExp): boolean => re.test(t);

  /** Verilen kelimelerden herhangi biri negated set'inde mi? */
  const isNeg = (...words: string[]): boolean =>
    words.some((w) => neg.has(w));

  /** Skora push et — negated ise tersini ekle */
  const push = (
    key: ScoreKey,
    positiveVal: number,
    negatedVal = 0.1,
    ...negWords: string[]
  ): void => {
    acc[key].push(isNeg(...negWords) ? negatedVal : positiveVal);
  };

  // ── 1. JOY ─────────────────────────────────────────────────────────────────
  if (
    hit(
      /\b(happy|happiness|cheerful|uplifting|feel.?good|warm|heartwarming|joyful|optimistic|light.?hearted|delightful|wonderful|elated|blissful|content|pleased|bright|gleeful|jolly|merry|jubilant|radiant|sunny|carefree|breezy)\b/,
    )
  ) {
    push('joy', 0.88, 0.1, 'happy', 'happiness', 'joyful');
  }

  if (
    hit(
      /\b(funny|comedy|laugh|laughing|hilarious|humor|humorous|amusing|witty|comic|lighthearted|giggle|chuckle|slapstick|satirical|parody|farce|romcom)\b/,
    )
  ) {
    push('joy', 0.82, 0.2, 'funny', 'comedy', 'laugh');
    push('energy', 0.65, 0.65);
    push('depth', 0.20, 0.20);
    if (!isNeg('comedy', 'funny')) p.ending_preference = 'triumphant';
  }

  if (
    hit(
      /\b(inspiring|inspirational|motivated|empowering|uplifted|heartwarming|moving|touching|life.?affirming|feel.?good|wholesome)\b/,
    )
  ) {
    push('joy', 0.72, 0.2, 'inspiring');
    push('anticipation', 0.68, 0.3);
    if (!isNeg('inspiring', 'hopeful')) p.ending_preference = 'hopeful';
  }

  // Türkçe joy
  if (hit(/mutlu|neşeli|sevinçli|keyifli|coşkulu|şen|neşe|sevinç|eğlenceli|komik|güldürü|mizah/)) {
    push('joy', 0.85, 0.1, 'mutlu', 'neşeli');
  }

  // ── 2. SADNESS ─────────────────────────────────────────────────────────────
  if (
    hit(
      /\b(sad|sadness|melancholic|melancholy|grief|loss|heartbreaking|tearjerker|emotional|depressing|sorrow|sorrowful|bittersweet|cry|crying|weep|devastating|gloomy|mournful|wistful|somber|bleak|desolate|forlorn|anguish|lament|mourn|bereaved)\b/,
    )
  ) {
    push('sadness', 0.87, 0.1, 'sad', 'sadness', 'depressing');
    push('depth', 0.72, 0.4);
    if (!isNeg('sad', 'sadness')) {
      p.pace_preference = 'slow';
      p.ending_preference = 'bittersweet';
    }
  }

  if (
    hit(
      /\b(lonely|isolated|alone|solitary|disconnected|alienated|estranged|withdrawn|reclusive)\b/,
    )
  ) {
    push('sadness', 0.68, 0.2, 'lonely');
    push('depth', 0.58, 0.3);
    if (!isNeg('lonely', 'alone')) p.social_context = 'alone';
  }

  if (
    hit(
      /\b(nostalgic|nostalgia|throwback|reminiscent|sentimental|yearning|wistful|longing|bittersweet|remember)\b/,
    )
  ) {
    push('sadness', 0.48, 0.2);
    push('trust', 0.60, 0.3);
    p.rewatch_tolerance = true;
  }

  // Türkçe sadness
  if (hit(/üzgün|üzücü|hüzünlü|melankolik|kederli|ağlamak|gözyaşı|duygusal|bunalım|nostalkji|özlem|yalnız/)) {
    push('sadness', 0.85, 0.1, 'üzücü', 'hüzünlü');
    push('depth', 0.68, 0.3);
  }

  // ── 3. FEAR ────────────────────────────────────────────────────────────────
  if (
    hit(
      /\b(scary|horror|terrifying|creepy|thriller|suspense|frightening|disturbing|dark|nightmare|psychological|paranoia|dread|sinister|eerie|chilling|haunting|spine.?chilling|goosebumps|spooked|terror|ominous|foreboding|macabre|ghastly|ghoulish|menacing)\b/,
    )
  ) {
    if (isNeg('scary', 'horror', 'dark', 'nightmare', 'thriller')) {
      push('fear', 0.10, 0.10);
      p.avoid_signals.push('horror');
    } else {
      push('fear', 0.87, 0.1);
      push('anticipation', 0.82, 0.3);
      push('energy', 0.75, 0.3);
      p.pace_preference = 'fast';
      p.visual_style = 'raw';
    }
  }

  if (
    hit(
      /\b(tense|tension|suspenseful|on.?edge|nail.?biting|nerve.?wracking|pulse.?pounding|heart.?pounding|breathless|gripping)\b/,
    )
  ) {
    push('fear', 0.68, 0.2, 'tense', 'tension');
    push('anticipation', 0.78, 0.3);
  }

  if (
    hit(
      /\b(anxious|anxiety|nervous|worried|uneasy|apprehensive|stressed|overwhelmed|dread)\b/,
    )
  ) {
    push('fear', 0.62, 0.2, 'anxious', 'anxiety');
    push('energy', 0.30, 0.6);
    if (!isNeg('anxious', 'stressed')) {
      p.pace_preference = 'slow';
      p.ending_preference = 'hopeful';
    }
  }

  // Türkçe fear
  if (hit(/korku|gerilim|karanlık|ürkütücü|korkunç|dehşet|kabus|kasvetli|endişeli|gergin|tedirgin/)) {
    if (isNeg('korku', 'karanlık', 'korkunç')) {
      push('fear', 0.10, 0.10);
      p.avoid_signals.push('horror');
    } else {
      push('fear', 0.85, 0.1);
      push('anticipation', 0.75, 0.3);
    }
  }

  // ── 4. ANGER ───────────────────────────────────────────────────────────────
  if (
    hit(
      /\b(revenge|rage|brutal|intense|aggressive|fury|vendetta|justice|rebellion|fight|war|battle|conflict|angry|furious|enraged|outraged|wrathful|fierce|ferocious|ruthless|relentless|gritty|raw)\b/,
    )
  ) {
    if (isNeg('violent', 'violence', 'brutal', 'rage', 'fight')) {
      push('anger', 0.10, 0.10);
      p.avoid_signals.push('violence');
    } else {
      push('anger', 0.78, 0.1);
      push('energy', 0.80, 0.3);
    }
  }

  if (hit(/\b(violent|violence|gore|graphic violence|bloody)\b/)) {
    if (isNeg('violent', 'violence', 'gore', 'bloody')) {
      p.avoid_signals.push('violence');
      push('anger', 0.10, 0.10);
    } else {
      push('anger', 0.75, 0.1);
      push('disgust', 0.55, 0.2);
    }
  }

  // Türkçe anger
  if (hit(/intikam|öfke|şiddet|isyan|savaş|öfkeli|sinirli|kızgın|asabi|kavga/)) {
    if (isNeg('şiddet', 'öfke')) {
      push('anger', 0.10, 0.10);
      p.avoid_signals.push('violence');
    } else {
      push('anger', 0.78, 0.1);
      push('energy', 0.75, 0.3);
    }
  }

  // ── 5. SURPRISE ────────────────────────────────────────────────────────────
  if (
    hit(
      /\b(twist|plot.?twist|unexpected|mind.?bending|puzzle|mystery|mysterious|unpredictable|shocking|revelation|mind.?blowing|confusing|complex.?plot|subversive|subverts|deceptive|misdirection|red.?herring)\b/,
    )
  ) {
    push('surprise', 0.87, 0.2, 'twist', 'unexpected', 'mystery');
    push('anticipation', 0.75, 0.3);
    push('depth', 0.70, 0.3);
  }

  if (
    hit(
      /\b(sci.?fi|science.?fiction|space|alien|robot|artificial intelligence|future|dystopia|utopia|cyberpunk|post.?apocalyptic|time.?travel|parallel universe|multiverse)\b/,
    )
  ) {
    push('surprise', 0.75, 0.3);
    push('anticipation', 0.72, 0.3);
    push('depth', 0.72, 0.3);
    p.visual_style = 'cinematic';
  }

  if (hit(/\b(fantasy|magical|mythical|dragons|quest|sorcery|enchanted|otherworldly)\b/)) {
    push('surprise', 0.65, 0.3);
    push('anticipation', 0.68, 0.3);
    push('energy', 0.65, 0.3);
  }

  // Türkçe surprise
  if (hit(/sürpriz|beklenmedik|gizemli|şaşırtıcı|gizem|bükülme|bilim.?kurgu|uzay|yapay zeka|gelecek/)) {
    push('surprise', 0.82, 0.2);
    push('anticipation', 0.72, 0.3);
  }

  // ── 6. ANTICIPATION ────────────────────────────────────────────────────────
  if (
    hit(
      /\b(exciting|adventure|adventurous|thrilling|action|chase|heist|mission|quest|edge.?of.?seat|adrenaline|explosive|dynamic|action.?packed|non.?stop|high.?octane|breakneck|fast.?paced|exhilarating|pulse.?racing|gripping)\b/,
    )
  ) {
    push('anticipation', 0.90, 0.2, 'action', 'exciting');
    push('energy', 0.90, 0.2);
    if (!isNeg('action', 'exciting', 'adventure')) {
      p.pace_preference = 'fast';
      p.ending_preference = 'triumphant';
    }
  }

  if (hit(/\b(curious|inquisitive|fascinated|intrigued|wonder|discover|explore|investigative)\b/)) {
    push('anticipation', 0.75, 0.3);
    push('surprise', 0.65, 0.3);
    push('energy', 0.62, 0.3);
  }

  // Türkçe anticipation
  if (hit(/heyecan|macera|aksiyon|görev|adrenalin|nefes kesen|gerilim dolu/)) {
    push('anticipation', 0.88, 0.2, 'heyecan');
    push('energy', 0.85, 0.2);
  }

  // ── 7. TRUST ───────────────────────────────────────────────────────────────
  if (
    hit(
      /\b(romantic|romance|love|love.?story|relationship|affection|tender|intimate|heartfelt|devotion|adoration|passionate|sweet|charming|endearing)\b/,
    )
  ) {
    if (isNeg('romantic', 'love', 'romance')) {
      push('trust', 0.20, 0.20);
    } else {
      push('trust', 0.87, 0.2);
      push('joy', 0.65, 0.3);
      p.social_context = 'couple';
      p.ending_preference = 'bittersweet';
    }
  }

  if (
    hit(
      /\b(friendship|friends|bond|loyalty|together|connection|camaraderie|brotherhood|sisterhood|teamwork|solidarity|unity|companionship)\b/,
    )
  ) {
    push('trust', 0.82, 0.2, 'friendship', 'friends');
    push('joy', 0.62, 0.3);
    if (!isNeg('friends', 'friendship')) p.social_context = 'friends';
  }

  if (hit(/\b(family|familial|parental|fatherhood|motherhood|siblings|kinship)\b/)) {
    push('trust', 0.78, 0.2, 'family');
    if (!isNeg('family')) p.social_context = 'family';
  }

  if (hit(/\b(faith|hope|believe|belief|spiritual|redemption|forgiveness|compassion)\b/)) {
    push('trust', 0.72, 0.2);
    push('anticipation', 0.62, 0.3);
    if (!isNeg('hope', 'faith')) p.ending_preference = 'hopeful';
  }

  // Türkçe trust
  if (hit(/aşk|romantik|sevgi|ilişki|randevu|çift|sevgili|dostluk|arkadaşlık|aile|güven|sadakat/)) {
    if (isNeg('aşk', 'romantik')) {
      push('trust', 0.20, 0.20);
    } else {
      push('trust', 0.83, 0.2);
      push('joy', 0.62, 0.3);
    }
  }

  // ── 8. DISGUST ─────────────────────────────────────────────────────────────
  if (hit(/\b(gross|disgusting|revolting|visceral|gory|disturbing|repulsive|nauseating)\b/)) {
    if (isNeg('gross', 'gore', 'disgusting')) {
      push('disgust', 0.10, 0.10);
      p.avoid_signals.push('gore');
    } else {
      push('disgust', 0.75, 0.1);
    }
  }

  // ── 9. ENERJİ ──────────────────────────────────────────────────────────────
  if (
    hit(
      /\b(calm|peaceful|tranquil|serene|soothing|chill|relaxing|unwind|cozy|gentle|ambient|meditative|quiet|still|mellow|laid.?back|slow.?paced|unhurried)\b/,
    )
  ) {
    push('energy', 0.15, 0.60, 'calm', 'peaceful', 'relaxing');
    if (!isNeg('calm', 'peaceful', 'relaxing')) p.pace_preference = 'slow';
  }

  if (
    hit(
      /\b(tired|exhausted|drained|weary|sleepy|fatigued|low.?energy|burnout|burnt.?out|lethargic|listless)\b/,
    )
  ) {
    push('energy', 0.10, 0.55, 'tired', 'exhausted');
    if (!isNeg('tired', 'exhausted')) p.pace_preference = 'slow';
  }

  if (hit(/\b(energetic|pumped|hyped|dynamic|lively|vibrant|spirited|electric|charged|intense)\b/)) {
    push('energy', 0.87, 0.3, 'energetic');
  }

  // Türkçe energy
  if (hit(/sakin|huzurlu|dingin|rahatlatıcı|sessiz|yorgun|bitkin|enerjik|canlı|dinamik/)) {
    if (hit(/yorgun|bitkin|tükenmişlik|uykusuz/)) {
      push('energy', 0.10, 0.55, 'yorgun', 'bitkin');
      p.pace_preference = 'slow';
    } else if (hit(/sakin|huzurlu|dingin|rahatlatıcı/)) {
      push('energy', 0.15, 0.55, 'sakin');
      p.pace_preference = 'slow';
    } else if (hit(/enerjik|canlı|dinamik/)) {
      push('energy', 0.85, 0.3);
    }
  }

  // ── 10. TEMATİK DERİNLİK ───────────────────────────────────────────────────
  if (
    hit(
      /\b(philosophical|thought.?provoking|complex|intellectual|existential|profound|layered|challenging|cerebral|deep|meaningful|introspective|contemplative|nuanced|rich|weighty|heavy|dense|ambitious)\b/,
    )
  ) {
    push(
      'depth',
      0.90,
      0.20,
      'complex',
      'deep',
      'heavy',
      'philosophical',
    );
    if (!isNeg('deep', 'complex', 'heavy')) p.pace_preference = 'slow';
  }

  if (
    hit(
      /\b(fun|easy|popcorn|entertaining|light|casual|simple|breezy|fluffy|no.?brainer|mindless|escapist)\b/,
    )
  ) {
    push('depth', 0.18, 0.65, 'fun', 'easy', 'light');
    if (!isNeg('fun', 'easy', 'light')) push('energy', 0.58, 0.4);
  }

  if (
    hit(
      /\b(drama|dramatic|intense|heavy|powerful|emotionally.?rich|poignant|affecting|raw.?emotion|searing|harrowing|gut.?wrenching)\b/,
    )
  ) {
    push('depth', 0.78, 0.3);
    push('sadness', 0.55, 0.3);
    if (!isNeg('drama', 'intense', 'heavy')) {
      p.pace_preference = 'slow';
      if (p.ending_preference === 'open') p.ending_preference = 'bittersweet';
    }
  }

  // Türkçe depth
  if (hit(/felsefi|derin|düşündürücü|anlamlı|varoluşsal|karmaşık|yoğun|dram|dramatik/)) {
    if (isNeg('derin', 'karmaşık', 'yoğun')) {
      push('depth', 0.20, 0.20);
    } else {
      push('depth', 0.85, 0.2);
    }
  }

  // ── 11. GÖRSEL STİL ────────────────────────────────────────────────────────
  if (
    hit(
      /\b(epic|grand|sweeping|visually.?stunning|beautiful cinematography|cinematic|breathtaking|gorgeous|majestic|spectacular|lavish|sumptuous)\b/,
    )
  ) {
    p.visual_style = 'cinematic';
  }
  if (
    hit(
      /\b(gritty|realistic|raw|documentary|handheld|indie|guerrilla|grounded|naturalistic|verite|unfiltered)\b/,
    )
  ) {
    p.visual_style = 'raw';
  }
  if (
    hit(
      /\b(surreal|abstract|avant.?garde|dreamlike|trippy|psychedelic|hallucinatory|mind.?bending visual|bizarre|hypnotic|kaleidoscopic|otherworldly visual)\b/,
    )
  ) {
    p.visual_style = 'experimental';
    p.narrative_style = 'nonlinear';
  }
  if (hit(/\b(minimalist|simple|clean|sparse|stripped.?down|understated|austere|unadorned)\b/)) {
    p.visual_style = 'minimalist';
  }
  if (
    hit(
      /\b(colorful|vibrant|vivid|saturated|lush|opulent|visually.?rich|gorgeous palette|rich colors|canlı|renkli)\b/,
    )
  ) {
    p.visual_style = 'lush';
  }

  // Türkçe visual style
  if (hit(/sinematik|görkemli|muhteşem|görsel şölen/)) p.visual_style = 'cinematic';
  if (hit(/gerçekçi|belgesel|ham gerçeklik/)) p.visual_style = 'raw';
  if (hit(/sürreal|rüya gibi|deneysel|absürd/)) {
    p.visual_style = 'experimental';
    p.narrative_style = 'nonlinear';
  }
  if (hit(/minimalist|sade görsel/)) p.visual_style = 'minimalist';
  if (hit(/renkli|canlı görsel|zengin görsel/)) p.visual_style = 'lush';

  // ── 12. TEMPO ──────────────────────────────────────────────────────────────
  if (
    hit(
      /\b(slow.?burn|slow burn|contemplative|artistic|arthouse|art.?house|meditative|patient|atmospheric|deliberate|unhurried|languid)\b/,
    )
  ) {
    p.pace_preference = 'slow';
  }
  if (hit(/\b(fast.?paced|quick|rapid|non.?stop|action.?packed|breakneck|relentless|propulsive)\b/)) {
    p.pace_preference = 'fast';
  }
  if (hit(/yavaş|ağır tempo|sanatsal sinema/)) p.pace_preference = 'slow';
  if (hit(/hızlı|tempolu|aksiyonlu|duraksız/)) p.pace_preference = 'fast';

  // ── 13. BİTİŞ TERCİHİ ──────────────────────────────────────────────────────
  if (
    hit(
      /\b(happy.?ending|uplifting|triumphant|victorious|inspiring ending|redemption arc|feel.?good ending|mutlu son)\b/,
    )
  ) {
    p.ending_preference = isNeg('happy ending', 'uplifting') ? 'tragic' : 'hopeful';
  }
  if (
    hit(
      /\b(tragic|devastating ending|heartbreaking end|everybody dies|sad ending|tragedy|trajik|üzücü son|kötü bitis|hüzünlü son)\b/,
    )
  ) {
    if (isNeg('tragic', 'tragedy', 'sad ending', 'trajik')) {
      p.ending_preference = 'hopeful';
      p.avoid_signals.push('tragic_ending');
    } else {
      p.ending_preference = 'tragic';
    }
  }
  if (hit(/\b(bittersweet|mixed ending|complex ending|not fully happy|acı.?tatlı|karma son)\b/)) {
    p.ending_preference = 'bittersweet';
  }
  if (
    hit(
      /\b(ambiguous|open.?ended|unanswered|makes you think|no clear ending|belirsiz bitiş|açık son)\b/,
    )
  ) {
    p.ending_preference = 'open';
  }
  if (hit(/\b(victory|winning|overcome|overcoming|conquer|champion|zafer|kazanmak|üstesinden)\b/)) {
    p.ending_preference = 'triumphant';
  }

  // ── 14. ANLATIM BİÇİMİ ─────────────────────────────────────────────────────
  if (
    hit(
      /\b(nonlinear|non.?linear|fragmented|out.?of.?order|time.?jumps|multiple.?timelines|kaleidoscopic narrative|doğrusal olmayan|karma yapı)\b/,
    )
  ) {
    p.narrative_style = 'nonlinear';
  }
  if (
    hit(
      /\b(dialogue.?driven|talky|conversation.?heavy|character.?study|verbal sparring|witty banter|diyalog ağırlıklı|karakter çalışması)\b/,
    )
  ) {
    p.narrative_style = 'dialogue-driven';
  }
  if (hit(/\b(anthology|segments|vignettes|multiple.?stories|portmanteau|antoloji|segmentler)\b/)) {
    p.narrative_style = 'anthology';
  }

  // ── 15. DÖNEM ──────────────────────────────────────────────────────────────
  if (hit(/\b(classic|vintage|golden.?age|old hollywood|silent.?era|klasik|eski dönem|altın çağ)\b/)) {
    p.era_preference = { from: 1940, to: 1975 };
  }
  if (hit(/\b(70s|seventies|1970s)\b/)) p.era_preference = { from: 1970, to: 1980 };
  if (hit(/\b(80s|eighties|1980s|80'?ler|80'ler)\b/)) p.era_preference = { from: 1980, to: 1990 };
  if (hit(/\b(90s|nineties|1990s|90'?lar|90'lar)\b/)) p.era_preference = { from: 1990, to: 2000 };
  if (hit(/\b(2000s|two.?thousands|00s|2000'?ler)\b/)) p.era_preference = { from: 2000, to: 2010 };
  if (hit(/\b(2010s|twenty.?tens|2010'?lar)\b/)) p.era_preference = { from: 2010, to: 2020 };
  if (hit(/\b(recent|new|modern|contemporary|latest|2020s|son yıllar|yeni|güncel)\b/)) {
    p.era_preference = { from: 2018, to: 2025 };
  }

  // ── 16. KÜLTÜREL BAĞLAM ────────────────────────────────────────────────────
  if (hit(/\b(türk|turkish|türkiye|turkey)\b/)) p.cultural_context.push('turkey');
  if (hit(/\b(fransız|french|france)\b/)) p.cultural_context.push('france');
  if (hit(/\b(japon|japanese|japan|anime)\b/)) p.cultural_context.push('japan');
  if (hit(/\b(kore|korean|korea|k.?drama)\b/)) p.cultural_context.push('korea');
  if (hit(/\b(amerikan|american|hollywood|usa)\b/)) p.cultural_context.push('usa');
  if (hit(/\b(İtalyan|italian|italy)\b/)) p.cultural_context.push('italy');
  if (hit(/\b(İskandinav|nordic|scandinavian|swedish|danish|norwegian)\b/)) {
    p.cultural_context.push('scandinavia');
  }
  if (hit(/\b(alman|german|germany)\b/)) p.cultural_context.push('germany');
  if (hit(/\b(british|İngiliz|england|uk|british cinema)\b/)) p.cultural_context.push('uk');
  if (hit(/\b(İspanyol|spanish|spain)\b/)) p.cultural_context.push('spain');
  if (hit(/\b(hint|indian|bollywood|india)\b/)) p.cultural_context.push('india');
  if (hit(/\b(latin|latin american|mexican|brazilian|spanish.?language)\b/)) {
    p.cultural_context.push('latin_america');
  }

  // ── 17. KAÇINMA SİNYALLERİ ─────────────────────────────────────────────────
  if (
    hit(/\b(no violence|avoid violence|without violence|şiddet yok|şiddet istemiyorum)\b/) ||
    isNeg('violence', 'violent', 'brutal', 'gore', 'şiddet')
  ) {
    if (!p.avoid_signals.includes('violence')) p.avoid_signals.push('violence');
    push('anger', 0.10, 0.10);
  }
  if (
    hit(/\b(no sex|no explicit|no sexual|explicit content yok|cinsel yok)\b/) ||
    isNeg('sexual', 'explicit', 'sex')
  ) {
    if (!p.avoid_signals.includes('explicit_content'))
      p.avoid_signals.push('explicit_content');
  }
  if (
    hit(/\b(no jump.?scares|without jump.?scares|ani korku yok)\b/) ||
    isNeg('jumpscare', 'jump scare', 'ani korku')
  ) {
    if (!p.avoid_signals.includes('jumpscares')) p.avoid_signals.push('jumpscares');
  }
  if (
    hit(/\b(no sad ending|no tragedy|happy ending only|mutlu son istiyorum|üzücü son istemiyorum)\b/)
  ) {
    if (!p.avoid_signals.includes('tragic_ending')) p.avoid_signals.push('tragic_ending');
    p.ending_preference = 'hopeful';
  }

  // ── 18. TEKRAR İZLEME ──────────────────────────────────────────────────────
  if (
    hit(
      /\b(comfort.?movie|comfort film|rewatch|rewatchable|watch again|old favorite|classic film)\b/,
    ) ||
    hit(/tekrar|yeniden izle|her zaman izliyorum|kaç kez izlesem/)
  ) {
    p.rewatch_tolerance = true;
  }

  // ── 19. SOSYAL BAĞLAM ──────────────────────────────────────────────────────
  if (hit(/\b(watching alone|movie night alone|solo|by myself|just me)\b/) || hit(/tek başıma|yalnız izliyorum/)) {
    p.social_context = 'alone';
  }
  if (hit(/\b(date night|with partner|with girlfriend|with boyfriend|romantic evening|couples film)\b/) ||
      hit(/sevgilimle|partnerimle|çiftler için|ikimiz için/)) {
    p.social_context = 'couple';
  }
  if (hit(/\b(friends night|with friends|friend group|group watch|movie night with friends)\b/) ||
      hit(/arkadaşlarla|arkadaş gecesi|grup halinde/)) {
    p.social_context = 'friends';
  }
  if (hit(/\b(family night|with family|kids friendly|all ages|whole family)\b/) ||
      hit(/aile gecesi|çocuklarla|aileyle|çocuk dostu/)) {
    p.social_context = 'family';
  }

  // ── 20. YÖNETMEN / FİLM REFERANSLARı ──────────────────────────────────────
  if (hit(/\bnolan\b|christopher nolan|nolan.?style|nolan.?gibi/)) {
    push('anticipation', 0.88);
    push('depth', 0.88);
    push('surprise', 0.78);
    push('energy', 0.65);
    p.visual_style = 'cinematic';
    p.pace_preference = 'medium';
  }
  if (hit(/\btarantino\b|quentin tarantino|tarantino.?style|tarantino.?gibi/)) {
    push('anger', 0.68);
    push('surprise', 0.78);
    push('energy', 0.80);
    push('anticipation', 0.72);
    p.pace_preference = 'fast';
    p.visual_style = 'raw';
    p.narrative_style = 'nonlinear';
  }
  if (hit(/\bwes anderson\b|wes anderson.?style|wes anderson.?gibi/)) {
    push('joy', 0.68);
    push('depth', 0.62);
    push('surprise', 0.60);
    p.visual_style = 'lush';
    p.narrative_style = 'anthology';
  }
  if (hit(/\bkubrick\b|stanley kubrick|kubrick.?style/)) {
    push('fear', 0.58);
    push('depth', 0.95);
    push('energy', 0.22);
    p.visual_style = 'cinematic';
    p.pace_preference = 'slow';
  }
  if (hit(/\bscorsese\b|martin scorsese|scorsese.?gibi/)) {
    push('anger', 0.68);
    push('energy', 0.78);
    push('depth', 0.82);
    p.visual_style = 'raw';
    p.pace_preference = 'fast';
  }
  if (hit(/\bwong kar.?wai\b/)) {
    push('sadness', 0.72);
    push('trust', 0.68);
    push('depth', 0.78);
    push('energy', 0.25);
    p.visual_style = 'cinematic';
    p.pace_preference = 'slow';
  }
  if (hit(/\bterrence malick\b|\bmalick\b/)) {
    push('depth', 0.92);
    push('energy', 0.18);
    p.visual_style = 'lush';
    p.pace_preference = 'slow';
  }
  if (hit(/\baronofsky\b|darren aronofsky/)) {
    push('fear', 0.72);
    push('depth', 0.85);
    push('disgust', 0.55);
    push('energy', 0.70);
    p.visual_style = 'raw';
    p.pace_preference = 'fast';
  }
  if (hit(/\bfincher\b|david fincher/)) {
    push('fear', 0.65);
    push('depth', 0.85);
    push('anticipation', 0.82);
    push('energy', 0.68);
    p.visual_style = 'raw';
    p.pace_preference = 'medium';
  }
  // Film referansları
  if (hit(/\blike inception\b|inception gibi|inception.?style/)) {
    push('surprise', 0.88);
    push('anticipation', 0.88);
    push('depth', 0.88);
    push('energy', 0.75);
    p.pace_preference = 'fast';
    p.narrative_style = 'nonlinear';
  }
  if (hit(/\blike titanic\b|titanic gibi/)) {
    push('sadness', 0.82);
    push('trust', 0.82);
    push('joy', 0.45);
    p.ending_preference = 'tragic';
    p.social_context = 'couple';
  }
  if (hit(/\blike the godfather\b|godfather gibi/)) {
    push('depth', 0.92);
    push('anger', 0.58);
    push('energy', 0.45);
    p.pace_preference = 'slow';
  }
  if (hit(/\blike interstellar\b|interstellar gibi/)) {
    push('anticipation', 0.88);
    push('depth', 0.88);
    push('surprise', 0.78);
    push('sadness', 0.58);
    push('energy', 0.70);
    p.visual_style = 'cinematic';
    p.pace_preference = 'medium';
  }
  if (hit(/\blike parasite\b|parasite gibi|parazit gibi/)) {
    push('surprise', 0.92);
    push('depth', 0.88);
    push('fear', 0.58);
    push('energy', 0.78);
    p.pace_preference = 'fast';
  }
  if (hit(/\blike schindler\b|schindler gibi/)) {
    push('sadness', 0.88);
    push('depth', 0.92);
    push('anger', 0.62);
    push('trust', 0.65);
    p.pace_preference = 'slow';
    p.ending_preference = 'bittersweet';
  }
  if (hit(/\blike mulholland\b|mulholland drive gibi/)) {
    push('surprise', 0.92);
    push('fear', 0.68);
    push('depth', 0.88);
    p.visual_style = 'experimental';
    p.narrative_style = 'nonlinear';
  }

  // ── 21. SCORES → PROFILE ───────────────────────────────────────────────────
  // Birden fazla kural aynı boyutu etkilediyse ortalama al; eşleşme yoksa 0.5 kal
  const resolve = (key: ScoreKey): number | null => {
    const val = avgAcc(acc[key]);
    return val !== null ? clamp01(val) : null;
  };

  const joyVal = resolve('joy');
  const sadVal = resolve('sadness');
  const angVal = resolve('anger');
  const feaVal = resolve('fear');
  const surVal = resolve('surprise');
  const disVal = resolve('disgust');
  const antVal = resolve('anticipation');
  const truVal = resolve('trust');
  const engVal = resolve('energy');
  const depVal = resolve('depth');

  if (joyVal !== null) p.emotional_state.joy = joyVal;
  if (sadVal !== null) p.emotional_state.sadness = sadVal;
  if (angVal !== null) p.emotional_state.anger = angVal;
  if (feaVal !== null) p.emotional_state.fear = feaVal;
  if (surVal !== null) p.emotional_state.surprise = surVal;
  if (disVal !== null) p.emotional_state.disgust = disVal;
  if (antVal !== null) p.emotional_state.anticipation = antVal;
  if (truVal !== null) p.emotional_state.trust = truVal;
  if (engVal !== null) p.energy_level = engVal;
  if (depVal !== null) p.thematic_depth = depVal;

  // Deduplication
  p.avoid_signals = [...new Set(p.avoid_signals)];
  p.cultural_context = [...new Set(p.cultural_context)];

  return p;
}

// ─── Ana Export ───────────────────────────────────────────────────────────────

/**
 * Kullanıcının serbest metin girdisini 12 boyutlu TasteProfile'a dönüştürür.
 *
 * Claude API (Edge Function) birincil kaynaktır.
 * Timeout (5 sn), 404 veya hata durumunda kapsamlı rule-based fallback devreye girer.
 *
 * @param input - Kullanıcının yazdığı ham mood metni (TR veya EN)
 */
export async function parseMood(input: string): Promise<TasteProfile> {
  try {
    await checkRateLimit();
    const raw = await callEdgeFunction(input);
    return validateAndNormalize(raw);
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[tasteParser] Claude API failed, using rule-based fallback:', error);
    }
    return ruleBased(input);
  }
}

/** @deprecated parseTaste yerine parseMood kullanın. */
export const parseTaste = parseMood;
