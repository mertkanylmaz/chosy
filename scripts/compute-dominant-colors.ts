/**
 * Dominant Color Extraction — Isik Sizmasi backend katmani
 *
 * Poster goruntusunden hakim rengi cikarir, BLEED_CONSTRAINTS tavanlarina
 * kisitlar ve films.dominant_color kolonuna OKLCH {l,c,h} olarak yazar.
 *
 * LLM CAGRISI YOKTUR — saf goruntu isleme.
 * Istemciye hicbir ham goruntu verisi gitmez, yalnizca uc sayi.
 *
 * Kaynak: docs/os/3_CHOSY_DESIGN_OS.md §5.2 · §5.4 (CTO onayi 04.08.2026)
 * Sema:   supabase/migrations/084 + 085
 *
 * Usage:
 *   npx tsx scripts/compute-dominant-colors.ts --self-test    # normalizePosterUrl testleri
 *   npx tsx scripts/compute-dominant-colors.ts --dry-run      # plan, indirme yok
 *   npx tsx scripts/compute-dominant-colors.ts --limit=10     # ilk 10 film
 *   npx tsx scripts/compute-dominant-colors.ts --only-missing # hic denenmemisler
 *   npx tsx scripts/compute-dominant-colors.ts --retry-failed # poster_quality_ok=false olanlari da dene
 *   npx tsx scripts/compute-dominant-colors.ts --film-id=<uuid>
 *   npx tsx scripts/compute-dominant-colors.ts --force        # her seyi yeniden hesapla
 *
 * Env: SUPABASE_URL (veya EXPO_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

// ─── .env yukleme (omdb-client.ts deseni — dotenv bagimliligi yok) ───────────
function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eqIdx + 1).trim();
  }
}
loadEnvFile();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** 3_CHOSY_DESIGN_OS §5.2 — migration 085'teki CHECK kisitiyla birebir ayni. */
const BLEED_CONSTRAINTS = {
  maxChroma: 0.08,
  maxLightness: 0.22,
} as const;

/**
 * Renk hesaplanacak havuz.
 *
 * 15 Ago 2026 — `archive` EKLENDI (CTO onayi). Gerekce: gauntletCore son care
 * gevsetmesinde `RELAXED_TIERS` archive'i havuza ALIYOR; o filmler renksiz
 * oldugu icin sizma sessizce ink'e dusuyordu (1537 film, hepsi NULL).
 * Bu YALNIZ bu script'in okuma filtresidir — gauntletCore'un tier mantigina
 * dokunulmadi, arsivlenmis film hala duelloya normal yoldan girmez.
 */
const POOL_TIERS = ['core', 'extended', 'trending', 'archive'] as const;

const TMDB_IMAGE_HOST = 'image.tmdb.org';
const POSTER_SIZE = 'w92';               // §5.4: tam boyut kabul edilemez
const TMDB_W92_BASE = `https://${TMDB_IMAGE_HOST}/t/p/${POSTER_SIZE}`;

const BATCH_CONCURRENCY = 8;             // TMDb goruntu CDN'i, anahtarsiz
const BATCH_DELAY_MS = 200;
const MAX_RETRIES = 3;
const RATE_LIMIT_WAIT_MS = 10_000;
const FETCH_TIMEOUT_MS = 15_000;
const PROGRESS_INTERVAL = 50;
const DB_PAGE_SIZE = 1000;               // PostgREST varsayilan tavani

/** Hue oylamasina katilmak icin gereken en dusuk ham chroma. */
const MIN_VOTING_CHROMA = 0.02;
/** Hue histogram kova sayisi (15 derece). */
const HUE_BUCKETS = 24;
/** Sinyal tasimayan uc noktalar: neredeyse siyah / neredeyse beyaz pikseller. */
const MIN_PIXEL_LIGHTNESS = 0.05;
const MAX_PIXEL_LIGHTNESS = 0.98;

const ERRORS_PATH = path.join(process.cwd(), 'data', 'dominant-color-errors.json');
const STATS_PATH = path.join(process.cwd(), 'data', 'dominant-color-stats.json');

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** types/gauntlet.ts OklchColor ile birebir ayni sekil. */
interface OklchColor {
  l: number;
  c: number;
  h: number;
}

interface FilmRow {
  id: string;
  title: string;
  poster_url: string | null;
  curation_tier: string | null;
}

interface ExtractionError {
  film_id: string;
  title: string;
  stage: 'poster_url' | 'download' | 'decode' | 'analyze' | 'db_write';
  error: string;
  timestamp: string;
}

interface FilmResult {
  film: FilmRow;
  /** Kisitlanmis, DB'ye yazilacak deger. Hata halinde null. */
  color: OklchColor | null;
  /** Kisitlama oncesi ham OKLCH — yalnizca raporlama, DB'ye YAZILMAZ. */
  raw: OklchColor | null;
  posterQualityOk: boolean;
  error: ExtractionError | null;
  /** Poster gri tonlamali/renksiz mi (hue oyu veren piksel yok). */
  achromatic: boolean;
}

interface Flags {
  limit: number | null;
  filmId: string | null;
  dryRun: boolean;
  force: boolean;
  onlyMissing: boolean;
  retryFailed: boolean;
  selfTest: boolean;
  lightnessMode: 'scale' | 'clamp' | 'mapped';
}

// ---------------------------------------------------------------------------
// normalizePosterUrl — poster_url iki formatta olabilir
//
// fetch-films.ts / add-missing-films.ts tam URL yazar:
//   https://image.tmdb.org/t/p/original/abc.jpg
// seed-database.ts ise ham TMDb poster_path yazar:
//   /abc.jpg
// Ikisi de w92 boyutuna normalize edilir; tanimsiz girdi HATA dondurur,
// sessizce atlanmaz.
// ---------------------------------------------------------------------------

export type NormalizeResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function normalizePosterUrl(raw: string | null | undefined): NormalizeResult {
  if (raw === null || raw === undefined) {
    return { ok: false, error: 'poster_url NULL' };
  }

  const value = raw.trim();
  if (value === '') {
    return { ok: false, error: 'poster_url bos string' };
  }

  // Tam URL yolu
  if (/^https?:\/\//i.test(value)) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return { ok: false, error: `URL ayristirilamadi: ${value}` };
    }

    if (parsed.hostname !== TMDB_IMAGE_HOST) {
      // TMDb disi barindirici — boyut degistiremeyiz, oldugu gibi denenir.
      return { ok: true, url: parsed.toString() };
    }

    // /t/p/<size>/<file> → /t/p/w92/<file>
    const match = parsed.pathname.match(/^\/t\/p\/[^/]+\/(.+)$/);
    if (!match) {
      return { ok: false, error: `beklenmeyen TMDb goruntu yolu: ${parsed.pathname}` };
    }
    return { ok: true, url: `${TMDB_W92_BASE}/${match[1]}` };
  }

  // Ham poster_path yolu ("/abc.jpg" ya da "abc.jpg")
  if (value.includes('://')) {
    return { ok: false, error: `desteklenmeyen sema: ${value}` };
  }
  const file = value.startsWith('/') ? value.slice(1) : value;
  if (!/^[\w.\-/]+$/.test(file)) {
    return { ok: false, error: `poster_path bicimi taninmadi: ${value}` };
  }
  return { ok: true, url: `${TMDB_W92_BASE}/${file}` };
}

// ---------------------------------------------------------------------------
// Renk uzayi: sRGB → linear → OKLab → OKLCH
// Bjorn Ottosson'un OKLab tanimi. Ek bagimlilik gerektirmez.
// ---------------------------------------------------------------------------

function srgbToLinear(channel255: number): number {
  const x = channel255 / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

interface Oklab { L: number; a: number; b: number; }

function rgbToOklab(r255: number, g255: number, b255: number): Oklab {
  const r = srgbToLinear(r255);
  const g = srgbToLinear(g255);
  const b = srgbToLinear(b255);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

function oklabToLch(lab: Oklab): OklchColor {
  const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let hue = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  if (hue < 0) hue += 360;
  if (hue >= 360) hue -= 360;   // 085 kisiti: h < 360
  return { l: lab.L, c: chroma, h: hue };
}

/**
 * BLEED_CONSTRAINTS uygulanmasi. DB'ye YALNIZCA bu cikti yazilir.
 *
 * lightnessMode:
 *   'mapped' — VARSAYILAN (15 Ago 2026, CTO karari "aday B").
 *              l = MAPPED_BASE + MAPPED_SLOPE × hamL
 *              Iki ucun de sorununu cozer: 'clamp' filmlerin %94'unu tavana
 *              yapistirip AYNI zemini uretiyordu (ayni hue'da iki filmin
 *              ayrimi = 0), 'scale' ise ayrimi koruyordu ama neredeyse hicbir
 *              film gorunur olmuyordu (medyan Δ=1). 'mapped' ile medyan Δ=8,
 *              ayni-hue filmler arasi ayrim Δ=3-4.
 *   'scale'  — ham L [0,1] araligindan [0, maxLightness]'e olceklenir.
 *              Ayrim korunur ama sonuc gorunmez. Karsilastirma icin duruyor.
 *   'clamp'  — duz tavan. Gorunur ama tekduze. Karsilastirma icin duruyor.
 *
 * Tavanlar (maxLightness 0.22, maxChroma 0.08) UC MODDA DA degismez; asagidaki
 * clamp+round4 guvenlik agidir. 'mapped' formulu hamL=1'de tam 0.22 verir,
 * yani teorik olarak tavani asmaz — ama kirpma SAVUNMA amaciyla korunur
 * (formul degisirse 085 CHECK'i INSERT'i reddetmeden once burada yakalanir).
 */
const MAPPED_BASE = 0.10;
const MAPPED_SLOPE = 0.12;

function applyBleedConstraints(
  rawColor: OklchColor,
  lightnessMode: 'scale' | 'clamp' | 'mapped',
): OklchColor {
  const l = lightnessMode === 'scale'
    ? rawColor.l * BLEED_CONSTRAINTS.maxLightness
    : lightnessMode === 'mapped'
    ? MAPPED_BASE + MAPPED_SLOPE * rawColor.l
    : Math.min(rawColor.l, BLEED_CONSTRAINTS.maxLightness);

  return {
    l: round4(clamp(l, 0, BLEED_CONSTRAINTS.maxLightness)),
    c: round4(clamp(rawColor.c, 0, BLEED_CONSTRAINTS.maxChroma)),
    h: round4(clamp(rawColor.h, 0, 359.9999)),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

// ---------------------------------------------------------------------------
// Hakim renk analizi
//
// Duz ortalama gri uretir (zit hue'lar birbirini goturur). Bunun yerine
// chroma agirlikli hue histogramu: en cok "renk oyu" alan hue kovasi secilir,
// o kovadaki piksellerin dairesel ortalama hue'su + medyan chroma/lightness
// hakim renk sayilir. Tamamen renksiz posterde chroma 0 dondurulur.
// ---------------------------------------------------------------------------

interface AnalyzeResult { color: OklchColor; achromatic: boolean; }

function analyzeDominantColor(
  pixels: Uint8Array | Buffer,
  width: number,
  height: number,
): AnalyzeResult {
  const buckets: { weight: number; sumSin: number; sumCos: number; chromas: number[]; lights: number[] }[] =
    Array.from({ length: HUE_BUCKETS }, () => ({
      weight: 0, sumSin: 0, sumCos: 0, chromas: [], lights: [],
    }));

  const allLights: number[] = [];
  let consideredPixels = 0;

  for (let i = 0; i < width * height; i++) {
    const off = i * 4;
    const alpha = pixels[off + 3];
    if (alpha !== undefined && alpha < 128) continue;   // seffaf piksel

    const lab = rgbToOklab(pixels[off], pixels[off + 1], pixels[off + 2]);
    if (lab.L < MIN_PIXEL_LIGHTNESS || lab.L > MAX_PIXEL_LIGHTNESS) continue;

    consideredPixels++;
    const lch = oklabToLch(lab);
    allLights.push(lch.l);

    if (lch.c < MIN_VOTING_CHROMA) continue;            // renksiz — oy vermez

    const idx = Math.min(HUE_BUCKETS - 1, Math.floor(lch.h / (360 / HUE_BUCKETS)));
    const rad = lch.h * (Math.PI / 180);
    const bucket = buckets[idx];
    bucket.weight += lch.c;                              // chroma agirlikli oy
    bucket.sumSin += Math.sin(rad) * lch.c;
    bucket.sumCos += Math.cos(rad) * lch.c;
    bucket.chromas.push(lch.c);
    bucket.lights.push(lch.l);
  }

  if (consideredPixels === 0) {
    throw new Error('analiz edilebilir piksel yok (poster tamamen siyah/beyaz/seffaf)');
  }

  let best = -1;
  let bestWeight = 0;
  for (let i = 0; i < HUE_BUCKETS; i++) {
    if (buckets[i].weight > bestWeight) {
      bestWeight = buckets[i].weight;
      best = i;
    }
  }

  // Renkli piksel hic yok → gri tonlamali poster
  if (best === -1) {
    return {
      color: { l: median(allLights), c: 0, h: 0 },
      achromatic: true,
    };
  }

  const b = buckets[best];
  let hue = Math.atan2(b.sumSin, b.sumCos) * (180 / Math.PI);
  if (hue < 0) hue += 360;
  if (hue >= 360) hue -= 360;

  return {
    color: { l: median(b.lights), c: median(b.chromas), h: hue },
    achromatic: false,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ---------------------------------------------------------------------------
// Poster indirme + cozme
// ---------------------------------------------------------------------------

interface DecodedImage { data: Uint8Array | Buffer; width: number; height: number; }

function detectFormat(bytes: Uint8Array): 'jpeg' | 'png' | null {
  if (bytes.length < 8) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  return null;
}

/** Tek indirme denemesi. HTTP hatasini ve icerik tipini acikca yukseltir. */
async function downloadPoster(url: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 429) {
      const err = new Error('rate limited (429)') as Error & { rateLimited?: boolean };
      err.rateLimited = true;
      throw err;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0) throw new Error('bos yanit govdesi (0 bayt)');
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

function decodeImage(bytes: Uint8Array): DecodedImage {
  const format = detectFormat(bytes);
  if (format === null) {
    throw new Error(`taninmayan goruntu formati (ilk baytlar: ${
      Array.from(bytes.slice(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join(' ')
    })`);
  }

  if (format === 'jpeg') {
    const raw = jpeg.decode(Buffer.from(bytes), { useTArray: true });
    if (!raw.width || !raw.height) throw new Error('JPEG cozuldu ama boyut 0');
    return { data: raw.data, width: raw.width, height: raw.height };
  }

  const png = PNG.sync.read(Buffer.from(bytes));
  if (!png.width || !png.height) throw new Error('PNG cozuldu ama boyut 0');
  return { data: png.data, width: png.width, height: png.height };
}

/**
 * Tek film icin uctan uca: URL normalize → indir → coz → analiz → kisitla.
 * Hicbir asamada sessiz atlama yok; her basarisizlik ExtractionError doner.
 */
async function processFilm(film: FilmRow, flags: Flags): Promise<FilmResult> {
  const fail = (stage: ExtractionError['stage'], message: string): FilmResult => ({
    film,
    color: null,
    raw: null,
    posterQualityOk: false,
    achromatic: false,
    error: {
      film_id: film.id,
      title: film.title,
      stage,
      error: message,
      timestamp: new Date().toISOString(),
    },
  });

  const normalized = normalizePosterUrl(film.poster_url);
  if (!normalized.ok) {
    return fail('poster_url', normalized.error);
  }

  let bytes: Uint8Array | null = null;
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      bytes = await downloadPoster(normalized.url);
      break;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      const rateLimited = typeof err === 'object' && err !== null && 'rateLimited' in err;

      // 404 kalicidir — tekrar denemek anlamsiz
      if (lastError.startsWith('HTTP 404')) break;

      if (attempt < MAX_RETRIES) {
        await sleep(rateLimited ? RATE_LIMIT_WAIT_MS : 1500 * attempt);
      }
    }
  }
  if (bytes === null) {
    return fail('download', `${lastError} (${normalized.url})`);
  }

  let decoded: DecodedImage;
  try {
    decoded = decodeImage(bytes);
  } catch (err: unknown) {
    return fail('decode', err instanceof Error ? err.message : String(err));
  }

  try {
    const analysis = analyzeDominantColor(decoded.data, decoded.width, decoded.height);
    const constrained = applyBleedConstraints(analysis.color, flags.lightnessMode);

    // Tavan asimi SESSIZ GECILMEZ. applyBleedConstraints zaten kirpiyor, bu
    // yuzden buraya dusulmemeli; dusulurse kirpma mantigi bozulmus demektir ve
    // 085 CHECK kisiti INSERT'i reddederdi. Once burada gorunur olsun.
    if (
      constrained.l > BLEED_CONSTRAINTS.maxLightness ||
      constrained.c > BLEED_CONSTRAINTS.maxChroma ||
      constrained.h < 0 || constrained.h >= 360
    ) {
      return fail(
        'analyze',
        `kisitlama sonrasi tavan asildi: l=${constrained.l} c=${constrained.c} h=${constrained.h}`,
      );
    }

    return {
      film,
      color: constrained,
      raw: analysis.color,
      posterQualityOk: true,
      achromatic: analysis.achromatic,
      error: null,
    };
  } catch (err: unknown) {
    return fail('analyze', err instanceof Error ? err.message : String(err));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(`${c.red}ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY .env'de yok.${c.reset}`);
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Havuzu sayfa sayfa ceker (PostgREST 1000 satir tavani). */
async function fetchPool(sb: SupabaseClient, flags: Flags): Promise<FilmRow[]> {
  const rows: FilmRow[] = [];

  for (let from = 0; ; from += DB_PAGE_SIZE) {
    let query = sb
      .from('films')
      .select('id, title, poster_url, curation_tier')
      .in('curation_tier', POOL_TIERS as unknown as string[])
      .order('id', { ascending: true })
      .range(from, from + DB_PAGE_SIZE - 1);

    if (flags.filmId) {
      query = query.eq('id', flags.filmId);
    } else if (!flags.force) {
      if (flags.retryFailed) {
        query = query.is('dominant_color', null);
      } else if (flags.onlyMissing) {
        // Hic denenmemis olanlar: basarisiz kayitlar tekrar denenmez
        query = query.is('dominant_color', null).is('poster_quality_ok', null);
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(`films sorgusu basarisiz: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as FilmRow[]));
    if (data.length < DB_PAGE_SIZE) break;
    if (flags.limit !== null && rows.length >= flags.limit) break;
  }

  return flags.limit !== null ? rows.slice(0, flags.limit) : rows;
}

/** Tek satir guncelleme. Basarisizlik cagirana hata olarak doner. */
async function writeResult(sb: SupabaseClient, result: FilmResult): Promise<string | null> {
  const { error } = await sb
    .from('films')
    .update({
      dominant_color: result.color,
      dominant_color_computed_at: new Date().toISOString(),
      poster_quality_ok: result.posterQualityOk,
    })
    .eq('id', result.film.id);

  return error ? error.message : null;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseFlags(argv: string[]): Flags {
  const get = (name: string): string | null => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };

  const limitRaw = get('limit');
  const limit = limitRaw === null ? null : Number.parseInt(limitRaw, 10);
  if (limit !== null && (Number.isNaN(limit) || limit <= 0)) {
    console.error(`${c.red}ERROR: --limit pozitif tamsayi olmali.${c.reset}`);
    process.exit(1);
  }

  const modeRaw = get('lightness-mode');
  if (modeRaw !== null && modeRaw !== 'scale' && modeRaw !== 'clamp' && modeRaw !== 'mapped') {
    console.error(`${c.red}ERROR: --lightness-mode yalnizca 'mapped', 'clamp' veya 'scale'.${c.reset}`);
    process.exit(1);
  }

  return {
    limit,
    filmId: get('film-id'),
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    onlyMissing: argv.includes('--only-missing'),
    retryFailed: argv.includes('--retry-failed'),
    selfTest: argv.includes('--self-test'),
    // VARSAYILAN GECMISI (tavanlarin KENDISI hic degismedi):
    //   'scale' → 'clamp'  (15.08, sabah): 'scale' ham L'yi 0.22 ile CARPIYOR,
    //     tipik poster l~0.11'de kaliyordu → %10 alfada kompozit ink'ten 1-2/255
    //     ayrisiyor, sizma GORULEMEZ oluyordu (400 filmde medyan Δ=1).
    //   'clamp' → 'mapped' (15.08, aksam): 'clamp' bu kez ters uca dustu —
    //     filmlerin %94'u tavana yapisip AYNI zemini uretti, ayni hue'daki iki
    //     filmin ayrimi 0 oldu (cihaz testi: "3 tur boyunca renk degismiyor").
    //     'mapped' ikisinin arasi: gorunur KALIR, ayrim GERI GELIR.
    lightnessMode: (modeRaw as 'scale' | 'clamp' | 'mapped' | null) ?? 'mapped',
  };
}

/** normalizePosterUrl davranis testi — DB'ye ya da aga dokunmaz. */
function runSelfTest(): void {
  const cases: { label: string; input: string | null }[] = [
    { label: 'tam URL (fetch-films.ts yazimi)', input: 'https://image.tmdb.org/t/p/original/kqjL17yufvn9OVLyXYpvtyrFfak.jpg' },
    { label: 'ham poster_path (seed-database.ts yazimi)', input: '/kqjL17yufvn9OVLyXYpvtyrFfak.jpg' },
    { label: 'onde slash olmayan path', input: 'kqjL17yufvn9OVLyXYpvtyrFfak.jpg' },
    { label: 'zaten w92', input: 'https://image.tmdb.org/t/p/w92/kqjL17yufvn9OVLyXYpvtyrFfak.jpg' },
    { label: 'TMDb disi barindirici', input: 'https://cdn.example.com/poster.jpg' },
    { label: 'BOZUK — NULL', input: null },
    { label: 'BOZUK — bos string', input: '   ' },
    { label: 'BOZUK — beklenmeyen TMDb yolu', input: 'https://image.tmdb.org/foo/bar.jpg' },
    { label: 'BOZUK — desteklenmeyen sema', input: 'ftp://image.tmdb.org/x.jpg' },
  ];

  console.log(`\n${c.cyan}normalizePosterUrl — self test${c.reset}\n`);
  for (const test of cases) {
    const out = normalizePosterUrl(test.input);
    const shown = out.ok
      ? `${c.green}OK${c.reset}    ${out.url}`
      : `${c.yellow}HATA${c.reset}  ${out.error}`;
    console.log(`  ${test.label}\n    girdi: ${JSON.stringify(test.input)}\n    ${shown}\n`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.selfTest) {
    runSelfTest();
    return;
  }

  const sb = getSupabaseClient();

  console.log(`${c.cyan}Dominant color extraction${c.reset}`);
  console.log(`  Havuz: ${POOL_TIERS.join(', ')}`);
  console.log(`  Poster boyutu: ${POSTER_SIZE}`);
  console.log(`  Kisitlar: maxLightness ${BLEED_CONSTRAINTS.maxLightness} · maxChroma ${BLEED_CONSTRAINTS.maxChroma}`);
  console.log(`  Lightness modu: ${flags.lightnessMode}`);

  const films = await fetchPool(sb, flags);
  console.log(`  Islenecek film: ${films.length}\n`);

  if (films.length === 0) {
    console.log('Islenecek film yok.');
    return;
  }

  if (flags.dryRun) {
    const estBatches = Math.ceil(films.length / BATCH_CONCURRENCY);
    const estSeconds = estBatches * (BATCH_DELAY_MS / 1000 + 0.9);
    console.log('--- DRY RUN ---');
    console.log(`  Es zamanlilik: ${BATCH_CONCURRENCY}`);
    console.log(`  Tahmini sure: ${Math.floor(estSeconds / 60)}dk ${Math.round(estSeconds % 60)}sn`);
    console.log('  Parasal maliyet: $0 (TMDb goruntu CDN\'i anahtarsiz, LLM cagrisi yok)');
    if (films.length <= 20) {
      for (const f of films) console.log(`   - ${f.title}`);
    }
    return;
  }

  const errors: ExtractionError[] = [];
  const results: FilmResult[] = [];
  let ok = 0;
  let failed = 0;
  let dbErrors = 0;
  const startedAt = Date.now();

  for (let i = 0; i < films.length; i += BATCH_CONCURRENCY) {
    const batch = films.slice(i, i + BATCH_CONCURRENCY);
    const batchResults = await Promise.all(batch.map((f) => processFilm(f, flags)));

    for (const result of batchResults) {
      results.push(result);
      if (result.error) {
        errors.push(result.error);
        failed++;
        console.warn(
          `  ${c.yellow}BASARISIZ${c.reset} [${result.error.stage}] "${result.film.title}" — ${result.error.error}`
        );
      } else {
        ok++;
      }

      // Basari da basarisizlik da DB'ye yazilir: basarisizlikta
      // poster_quality_ok = false, dominant_color = null. Satir SILINMEZ.
      const writeError = await writeResult(sb, result);
      if (writeError) {
        dbErrors++;
        const dbErr: ExtractionError = {
          film_id: result.film.id,
          title: result.film.title,
          stage: 'db_write',
          error: writeError,
          timestamp: new Date().toISOString(),
        };
        errors.push(dbErr);
        console.error(`  ${c.red}DB YAZMA HATASI${c.reset} "${result.film.title}" — ${writeError}`);
      }
    }

    if ((i + BATCH_CONCURRENCY) % PROGRESS_INTERVAL < BATCH_CONCURRENCY && films.length > PROGRESS_INTERVAL) {
      const done = Math.min(i + BATCH_CONCURRENCY, films.length);
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = done / elapsed;
      const remaining = Math.round((films.length - done) / rate);
      console.log(
        `${c.dim}  ${done}/${films.length} · ${rate.toFixed(1)} film/sn · kalan ~${Math.floor(remaining / 60)}dk${c.reset}`
      );
    }

    if (i + BATCH_CONCURRENCY < films.length) await sleep(BATCH_DELAY_MS);
  }

  // ─── Ornek tablo (kucuk calistirmalarda gozle dogrulama icin) ─────────────
  if (results.length <= 25) {
    console.log(`\n${c.cyan}Sonuclar${c.reset}`);
    for (const r of results) {
      if (r.color && r.raw) {
        const flag = r.achromatic ? ' [gri tonlamali]' : '';
        console.log(
          `  ${r.film.title}\n` +
          `    ham    l=${r.raw.l.toFixed(4)} c=${r.raw.c.toFixed(4)} h=${r.raw.h.toFixed(1)}\n` +
          `    yazilan l=${r.color.l} c=${r.color.c} h=${r.color.h}  poster_quality_ok=true${flag}`
        );
      } else {
        console.log(
          `  ${r.film.title}\n` +
          `    dominant_color=null  poster_quality_ok=false  (${r.error?.stage}: ${r.error?.error})`
        );
      }
    }
  }

  const durationSec = Math.round((Date.now() - startedAt) / 1000);

  fs.mkdirSync(path.dirname(ERRORS_PATH), { recursive: true });
  fs.writeFileSync(ERRORS_PATH, JSON.stringify(errors, null, 2));
  fs.writeFileSync(STATS_PATH, JSON.stringify({
    total_films: films.length,
    computed: ok,
    failed,
    db_write_errors: dbErrors,
    lightness_mode: flags.lightnessMode,
    constraints: BLEED_CONSTRAINTS,
    duration_seconds: durationSec,
    finished_at: new Date().toISOString(),
  }, null, 2));

  console.log(`\n${c.cyan}Ozet${c.reset}`);
  console.log(`  Hesaplandi: ${ok}/${films.length}`);
  console.log(`  Basarisiz (poster_quality_ok=false): ${failed}`);
  console.log(`  DB yazma hatasi: ${dbErrors}`);
  console.log(`  Sure: ${durationSec}sn`);
  console.log(`  Hatalar: ${ERRORS_PATH}`);
  console.log(`  Istatistik: ${STATS_PATH}`);

  if (dbErrors > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(`${c.red}FATAL:${c.reset}`, err instanceof Error ? err.message : String(err));
  process.exit(1);
});
