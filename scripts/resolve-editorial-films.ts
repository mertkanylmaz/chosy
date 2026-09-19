/**
 * E-19 Faz 1 — Editoryal takvim: başlık → TMDB id çözümleme
 *
 * SALT OKUNUR. Ne DB'ye ne de `films` tablosuna dokunur; yalnız TMDB'den
 * okur ve iki JSON raporu yazar. Bu yüzden `--dry-run` bayrağı YOKTUR.
 *
 * Tasarım kaynağı: docs/investigations/E19_SCHEMA_VE_INGEST_TASARIM.md
 * (DUR NOKTASI c, Faz 1). Ölçüm S-10: `/search/movie?query=The Killer&
 * primary_release_year=2023` 45 sonuç döndürüyor ve AYNI yılda AYNI başlıkla
 * ikinci bir film var. Bu yüzden `results[0]`'ı almak HİÇBİR koşulda yok.
 *
 * Girdi: data/editorial-films.json
 *   [{ "title": "The Killer", "year": 2023, "director": "David Fincher",
 *      "day_number": 12, "position": 1, "curation_tier": "core",
 *      "editor_note": "..." }]
 *   position 1-4 = günün bracket sırası · 5-6 = K-23 yedek kulübesi
 *   editor_note = opsiyonel
 *
 * `theme` bu fazın girdisi DEĞİLDİR (CTO kararı, 19 Eyl 2026). Tema
 * `editorial_calendar_days` alanıdır ve bible §2b uyarınca `launch_date`'in
 * hafta gününden türer; Faz 1 yalnız başlık → tmdb_id çözümlemesi yapar.
 * Aynı kararla "her günün position 1-4'ü tam olmalı" invariant'ı da bu fazdan
 * kaldırıldı — takvim bütünlüğü Faz 2 / DB katmanının işidir, böylece dosya
 * boşluk-doldurma partisi olarak koşulabilir.
 *
 * Çıktı:
 *   data/editorial-resolved.json       → Faz 2'nin TEK girdisi
 *   data/editorial-manual-review.json  → CTO'nun elle seçeceği belirsiz satırlar
 *
 * Çıkış kodu: manual_review boş DEĞİLSE non-zero. "96'nın 91'i çözüldü" bir
 * başarı değil yarım iştir; yeşil dönerse Faz 2 yanlışlıkla koşulur.
 *
 * Kullanım:
 *   npx tsx scripts/resolve-editorial-films.ts
 *
 * Env: TMDB_API_KEY veya TMDB_READ_ACCESS_TOKEN. Supabase anahtarı GEREKMEZ.
 */

import * as fs from 'fs';
import * as path from 'path';

import { initCredentials, tmdbGet, getCallCount } from './lib/tmdb-client';
import type { TmdbMovieDetail } from './lib/tmdb-client';

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function log(msg: string): void {
  console.log(`${c.dim}[resolve-editorial]${c.reset} ${msg}`);
}

// ─── Config ──────────────────────────────────────────────────────────────────

const INPUT_PATH = path.resolve(process.cwd(), 'data', 'editorial-films.json');
const RESOLVED_PATH = path.resolve(process.cwd(), 'data', 'editorial-resolved.json');
const REVIEW_PATH = path.resolve(process.cwd(), 'data', 'editorial-manual-review.json');

/** `films.curation_tier` değerleri. */
const TIERS = ['core', 'extended', 'trending', 'archive'] as const;
type Tier = (typeof TIERS)[number];

/** manual_review'a düşen her satır en çok bu kadar aday taşır. */
const MAX_CANDIDATES_IN_REPORT = 5;

// ─── Types ───────────────────────────────────────────────────────────────────

interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  popularity: number;
  original_language: string;
}

interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchResult[];
  total_pages: number;
  total_results: number;
}

interface EditorialInput {
  title: string;
  year: number;
  director?: string;
  day_number: number;
  position: number;
  curation_tier: Tier;
  editor_note?: string;
}

interface CandidateSummary {
  tmdb_id: number;
  title: string;
  original_title: string;
  release_date: string;
  original_language: string;
  director: string | null;
  poster_path: string | null;
  popularity: number;
}

interface ResolvedRow {
  tmdb_id: number;
  title: string;
  year: number;
  director: string | null;
  day_number: number;
  position: number;
  curation_tier: Tier;
  editor_note?: string;
  /** Çözümleme anında TMDB'nin döndürdüğü başlık — girdiyle aynı olmayabilir. */
  tmdb_title: string;
  resolved_at: string;
}

type ReviewReason = 'ambiguous' | 'no_director_match' | 'unverified' | 'no_search_hit';

interface ReviewRow {
  input: EditorialInput;
  reason: ReviewReason;
  detail: string;
  candidates: CandidateSummary[];
}

// ─── Normalizasyon ───────────────────────────────────────────────────────────

/**
 * Karşılaştırma için sadeleştirme: aksan kaldırılır, noktalama kaldırılır,
 * küçük harfe düşülür, boşluklar teke iner.
 *
 * `toLowerCase()` bilinçli — `toLocaleLowerCase()` Türkçe locale'de I → ı
 * üretir ve İngilizce başlıkları bozar.
 */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // aksan/birleşen işaretler
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ─── Girdi doğrulama ─────────────────────────────────────────────────────────

/**
 * Girdiyi TMDB'ye tek çağrı yapmadan ÖNCE tümüyle doğrular. Bozuk satır
 * sessizce atlanmaz — tamamı toplanır ve fatal olarak rapor edilir.
 */
function validateInput(raw: unknown): EditorialInput[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${INPUT_PATH} bir dizi değil.`);
  }

  const problems: string[] = [];
  const rows: EditorialInput[] = [];
  const seenSlots = new Map<string, number>();

  raw.forEach((item, idx) => {
    const where = `satır ${idx + 1}`;
    const before = problems.length;

    if (typeof item !== 'object' || item === null) {
      problems.push(`${where}: nesne değil`);
      return;
    }
    const r = item as Record<string, unknown>;

    const { title, year, day_number, position, curation_tier, director, editor_note } = r;

    if (typeof title !== 'string' || title.trim() === '') {
      problems.push(`${where}: title eksik/boş`);
    }
    if (typeof year !== 'number' || !Number.isInteger(year)) {
      problems.push(`${where}: year tam sayı değil`);
    }
    if (typeof day_number !== 'number' || !Number.isInteger(day_number) ||
        day_number < 1 || day_number > 100) {
      problems.push(`${where}: day_number 1-100 aralığında tam sayı olmalı`);
    }
    if (typeof position !== 'number' || !Number.isInteger(position) ||
        position < 1 || position > 6) {
      problems.push(`${where}: position 1-6 olmalı (1-4 ana sıra, 5-6 yedek)`);
    }
    if (typeof curation_tier !== 'string' || !(TIERS as readonly string[]).includes(curation_tier)) {
      problems.push(`${where}: curation_tier geçersiz — beklenen: ${TIERS.join('|')}`);
    }
    if (director !== undefined && (typeof director !== 'string' || director.trim() === '')) {
      problems.push(`${where}: director verilmişse boş olamaz`);
    }
    if (editor_note !== undefined && typeof editor_note !== 'string') {
      problems.push(`${where}: editor_note metin olmalı`);
    }

    if (problems.length > before) return;

    const row: EditorialInput = {
      title: (title as string).trim(),
      year: year as number,
      director: typeof director === 'string' ? director.trim() : undefined,
      day_number: day_number as number,
      position: position as number,
      curation_tier: curation_tier as Tier,
      editor_note: typeof editor_note === 'string' ? editor_note : undefined,
    };

    const slotKey = `${row.day_number}/${row.position}`;
    const prev = seenSlots.get(slotKey);
    if (prev !== undefined) {
      problems.push(
        `${where}: (gün ${row.day_number}, position ${row.position}) ${prev}. satırda zaten var`,
      );
      return;
    }
    seenSlots.set(slotKey, idx + 1);

    rows.push(row);
  });

  // NOT: "her günün position 1-4'ü tam" kontrolü bilinçli olarak YOK —
  // CTO kararı (19 Eyl 2026). Takvim bütünlüğü Faz 2 / DB katmanında
  // doğrulanır; Faz 1 kısmi (boşluk-doldurma) parti kabul eder.

  if (problems.length > 0) {
    throw new Error(
      `Girdi doğrulaması başarısız (${problems.length} sorun):\n  - ` +
      problems.join('\n  - '),
    );
  }

  return rows;
}

// ─── TMDB çözümleme ──────────────────────────────────────────────────────────

/** Bir adayın yönetmenlerini çeker. Hata yutulmaz — çağırana yükselir. */
async function fetchDirectors(tmdbId: number): Promise<string[]> {
  const detail = await tmdbGet<TmdbMovieDetail>(`/movie/${tmdbId}`, {
    append_to_response: 'credits',
  });
  return detail.credits.crew
    .filter((cr) => cr.job === 'Director')
    .map((cr) => cr.name);
}

function toSummary(r: TmdbSearchResult, director: string | null): CandidateSummary {
  return {
    tmdb_id: r.id,
    title: r.title,
    original_title: r.original_title,
    release_date: r.release_date,
    original_language: r.original_language,
    director,
    poster_path: r.poster_path,
    popularity: r.popularity,
  };
}

interface ResolveOutcome {
  resolved?: ResolvedRow;
  review?: ReviewRow;
}

async function resolveOne(input: EditorialInput): Promise<ResolveOutcome> {
  const search = await tmdbGet<TmdbSearchResponse>('/search/movie', {
    query: input.title,
    primary_release_year: String(input.year),
  });

  // 1) Başlık daraltması: title VEYA original_title üzerinde TAM eşleşme.
  //    Benzerlik skoru / "en yakın" YOK — S-10 belirsizliği gerçek.
  const wanted = norm(input.title);
  const titleMatches = search.results.filter(
    (r) => norm(r.title) === wanted || norm(r.original_title) === wanted,
  );

  if (titleMatches.length === 0) {
    return {
      review: {
        input,
        reason: 'no_search_hit',
        detail:
          `'${input.title}' (${input.year}) için tam başlık eşleşmesi yok. ` +
          `TMDB ${search.total_results} sonuç döndürdü.`,
        candidates: search.results
          .slice(0, MAX_CANDIDATES_IN_REPORT)
          .map((r) => toSummary(r, null)),
      },
    };
  }

  // 2) Yönetmen doğrulaması. Girdide director yoksa doğrulama YAPILAMAZ —
  //    aday sayısı 1 bile olsa sessiz kabul edilmez (sebep: 'unverified').
  const candidates: CandidateSummary[] = [];
  for (const r of titleMatches.slice(0, MAX_CANDIDATES_IN_REPORT)) {
    const directors = await fetchDirectors(r.id);
    candidates.push(toSummary(r, directors[0] ?? null));
  }

  if (input.director === undefined) {
    return {
      review: {
        input,
        reason: 'unverified',
        detail:
          `Girdide director alanı yok — ${candidates.length} başlık eşleşmesi ` +
          `doğrulanamadı. Yönetmen ekle veya tmdb_id'yi elle seç.`,
        candidates,
      },
    };
  }

  const wantedDirector = norm(input.director);
  const verified = candidates.filter(
    (cand) => cand.director !== null && norm(cand.director) === wantedDirector,
  );

  // 3) Karar kuralı — üç yol, dördüncüsü yok.
  if (verified.length === 1) {
    const hit = verified[0];
    return {
      resolved: {
        tmdb_id: hit.tmdb_id,
        title: input.title,
        year: input.year,
        director: hit.director,
        day_number: input.day_number,
        position: input.position,
        curation_tier: input.curation_tier,
        ...(input.editor_note !== undefined ? { editor_note: input.editor_note } : {}),
        tmdb_title: hit.title,
        resolved_at: new Date().toISOString(),
      },
    };
  }

  if (verified.length === 0) {
    return {
      review: {
        input,
        reason: 'no_director_match',
        detail:
          `${candidates.length} başlık eşleşmesinin hiçbirinin yönetmeni ` +
          `'${input.director}' değil.`,
        candidates,
      },
    };
  }

  return {
    review: {
      input,
      reason: 'ambiguous',
      detail:
        `${verified.length} aday aynı başlık + aynı yıl + aynı yönetmenle geçti. ` +
        `Elle seçim gerekiyor.`,
      candidates: verified,
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `\n${c.bold}${c.magenta}` +
    `╔════════════════════════════════════════════╗\n` +
    `║  E-19 Faz 1 — Editoryal film çözümleme     ║\n` +
    `╚════════════════════════════════════════════╝${c.reset}\n`,
  );

  initCredentials();

  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Girdi dosyası yok: ${INPUT_PATH}`);
  }

  const rows = validateInput(JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8')));
  const days = new Set(rows.map((r) => r.day_number));
  log(`Girdi doğrulandı: ${rows.length} satır · ${days.size} gün`);

  const resolved: ResolvedRow[] = [];
  const review: ReviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const input = rows[i];
    const outcome = await resolveOne(input);

    if (outcome.resolved) {
      resolved.push(outcome.resolved);
      console.log(
        `  ${c.green}✓${c.reset} ${String(i + 1).padStart(3)}/${rows.length} ` +
        `${input.title} (${input.year}) → tmdb_id ${outcome.resolved.tmdb_id}`,
      );
    } else if (outcome.review) {
      review.push(outcome.review);
      console.log(
        `  ${c.yellow}?${c.reset} ${String(i + 1).padStart(3)}/${rows.length} ` +
        `${input.title} (${input.year}) → ${c.yellow}${outcome.review.reason}${c.reset}`,
      );
    }
  }

  fs.writeFileSync(RESOLVED_PATH, JSON.stringify(resolved, null, 2), 'utf-8');
  fs.writeFileSync(REVIEW_PATH, JSON.stringify(review, null, 2), 'utf-8');

  console.log(`\n${c.bold}═══ Çözümleme raporu ═══${c.reset}`);
  console.log(`  Girdi satırı:    ${rows.length}`);
  console.log(`  ${c.green}Çözüldü:         ${resolved.length}${c.reset}`);
  console.log(`  ${c.yellow}Manuel inceleme: ${review.length}${c.reset}`);
  console.log(`  TMDB çağrısı:    ${getCallCount()}`);
  console.log(`  ${c.dim}${RESOLVED_PATH}${c.reset}`);
  console.log(`  ${c.dim}${REVIEW_PATH}${c.reset}`);

  if (review.length > 0) {
    const byReason = new Map<ReviewReason, number>();
    for (const r of review) byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
    console.log(`\n${c.bold}Sebep dağılımı:${c.reset}`);
    for (const [reason, n] of byReason) console.log(`  ${reason}: ${n}`);

    console.error(
      `\n${c.red}${c.bold}YARIM İŞ — ${review.length} satır çözülemedi.${c.reset}\n` +
      `${c.red}Faz 2 (ingest-editorial-films.ts) KOŞULMAMALI. ` +
      `${REVIEW_PATH} dosyasını incele.${c.reset}\n`,
    );
    process.exit(1);
  }

  console.log(`\n${c.green}${c.bold}Tüm satırlar çözüldü. Faz 2 koşulabilir.${c.reset}\n`);
}

main().catch((err: unknown) => {
  console.error(`\n${c.red}Fatal error:${c.reset}`, err);
  process.exit(1);
});
