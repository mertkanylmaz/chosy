/**
 * E-19 Faz 2 — Editoryal filmleri `films` + `editorial_calendar_*` tablolarına yaz
 *
 * Tek girdi: data/editorial-resolved.json (Faz 1'in çıktısı).
 * data/editorial-films.json'a BAKMAZ — çözümlenmemiş satır buraya gelemez.
 *
 * Tasarım kaynağı: docs/investigations/E19_SCHEMA_VE_INGEST_TASARIM.md
 * (DUR NOKTASI c, Faz 2). Şema: supabase/migrations/112_editorial_calendar.sql
 *
 * ÜÇ KURAL (keşif raporundan, hepsi CLAUDE.md #1'in uygulaması):
 *   1. SESSİZ ELEME YOK. add-missing-films.ts `adult` / poster'sız /
 *      runtime < 60 filmleri `continue` ile hata listesine bile girmeden
 *      düşürüyor. Editoryal listede bu, CTO'nun seçtiği bir filmin sessizce
 *      kaybolması demektir. Burada her eleme rapora düşer ve koşum non-zero
 *      ile biter.
 *   2. `curation_tier` GİRDİDEN gelir, `assignTier()`'dan DEĞİL (S-12).
 *      Editoryal seçkinin arthouse ağırlığı oy sayısına bakan tier'la
 *      `archive`'a düşerdi.
 *   3. `detailToRow` add-missing-films.ts'ten IMPORT edilir, kopyalanmaz
 *      (S-11): iki kopyanın ıraksaması `imdb_votes` kirliliğinin doğuş
 *      biçimiydi.
 *
 * Kullanım — bayrak ZORUNLU, varsayılan yazma yoktur:
 *   npx tsx scripts/ingest-editorial-films.ts --dry-run   # hiçbir yazma
 *   npx tsx scripts/ingest-editorial-films.ts --apply     # DB'ye yaz
 *
 * Env: TMDB_API_KEY veya TMDB_READ_ACCESS_TOKEN · SUPABASE_URL ·
 *      SUPABASE_SERVICE_ROLE_KEY
 *
 * ⚠️ `.env`'deki SUPABASE_SERVICE_ROLE_KEY bu projeye kayıtlı değil (401).
 *    Koşumdan önce PowerShell'de oturum override'ı:
 *    $env:SUPABASE_SERVICE_ROLE_KEY = (Select-String -Path .env -Pattern
 *      '^SUPABASE_SECRET_KEY=' | ForEach-Object { $_.Line.Split('=',2)[1] })
 */

import * as fs from 'fs';
import * as path from 'path';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { initCredentials, tmdbGet, getCallCount } from './lib/tmdb-client';
import type { TmdbMovieDetail } from './lib/tmdb-client';
import { detailToRow, type FilmInsertRow } from './add-missing-films';

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
  console.log(`${c.dim}[ingest-editorial]${c.reset} ${msg}`);
}

// ─── Config ──────────────────────────────────────────────────────────────────

const RESOLVED_PATH = path.resolve(process.cwd(), 'data', 'editorial-resolved.json');
const REPORT_PATH = path.resolve(process.cwd(), 'data', 'editorial-ingest-report.json');

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BATCH_SIZE = 100;

/** Migration 112 `editorial_calendar_days.theme` CHECK kümesiyle birebir aynı. */
const THEMES = [
  'arthouse', 'cult', 'cozy', 'discovery', 'popcorn', 'epic', 'prestige',
] as const;
type Theme = (typeof THEMES)[number];

const TIERS = ['core', 'extended', 'trending', 'archive'] as const;
type Tier = (typeof TIERS)[number];

/** `app_config` anahtarı — takvimin gün 1'ini taşıyan yayın tarihi. */
const LAUNCH_DATE_KEY = 'launch_date';

/** Takvim uzunluğu (migration 112 CHECK: day_number BETWEEN 1 AND 100). */
const CALENDAR_DAYS = 100;

/**
 * Hafta günü → tema. Dizin `Date.getUTCDay()` ile birebir: 0 = Pazar.
 * Kaynak: 7_CHOSY_V1_KAPSAM_KILIDI.md §E-19.2 haftalık gün-tema tablosu.
 * Değerler migration 112 `editorial_calendar_days.theme` CHECK kümesinden.
 */
const THEME_BY_WEEKDAY: readonly Theme[] = [
  'prestige',   // 0 Pazar     — Prestij & Akademi / Festival
  'arthouse',   // 1 Pazartesi — Arthouse / Bağımsız
  'cult',       // 2 Salı      — Kültler
  'cozy',       // 3 Çarşamba  — Animasyon / Cozy
  'discovery',  // 4 Perşembe  — Modern Keşifler & Gizli Cevherler
  'popcorn',    // 5 Cuma      — Popcorn & Gişe
  'epic',       // 6 Cumartesi — Epik Anlatılar & Uzun Metrajlar
];

const WEEKDAY_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/**
 * Takvim gününün tarihini verir: `launchDate + (dayNumber - 1)` gün, UTC.
 *
 * UTC bilinçli (CTO kararı, 19 Eyl 2026): `generate-gauntlet` gün anahtarını
 * bugün `utcDateString()` ile üretiyor (S-08). Yerel saat kullanmak takvimi
 * o anahtardan ayırır ve üç saatlik bir pencerede iki sistem farklı gün görür.
 */
function dayNumberToDate(dayNumber: number, launchDate: Date): Date {
  return new Date(launchDate.getTime() + (dayNumber - 1) * 86_400_000);
}

/**
 * Takvim gününün temasını HESAPLAR. Tema hiçbir dosyada, hiçbir satırda
 * taşınmaz — `day_number` + `launch_date` tek kaynaktır (CTO kararı,
 * 19 Eyl 2026). Faz 1 çıktısında `theme` alanı yoktur.
 */
function dayNumberToTheme(dayNumber: number, launchDate: Date): Theme {
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > CALENDAR_DAYS) {
    throw new Error(`day_number 1-${CALENDAR_DAYS} aralığında olmalı, gelen: ${dayNumber}`);
  }
  return THEME_BY_WEEKDAY[dayNumberToDate(dayNumber, launchDate).getUTCDay()];
}

/**
 * `app_config.launch_date` — istek başına lazy okunur, modül seviyesinde
 * cache YOK (CLAUDE.md #6). Anahtar yoksa veya değer bozuksa `throw` eder;
 * sessiz fallback yasak (CLAUDE.md #1) — varsayılan bir tarihe düşmek
 * 100 günün tamamını yanlış temayla yazardı.
 */
async function fetchLaunchDate(sb: SupabaseClient): Promise<Date> {
  const { data, error } = await sb
    .from('app_config')
    .select('value')
    .eq('key', LAUNCH_DATE_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(`app_config.${LAUNCH_DATE_KEY} okunamadı: ${error.message}`);
  }
  if (data === null) {
    throw new Error(
      `app_config'te '${LAUNCH_DATE_KEY}' anahtarı yok. Takvim temaları bu ` +
      `tarihten türetiliyor; değeri CTO yazar (örn. "2026-09-18"). ` +
      `Anahtar gelmeden ingest koşulamaz.`,
    );
  }

  const raw = (data as { value: unknown }).value;
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(
      `app_config.${LAUNCH_DATE_KEY} 'YYYY-MM-DD' metni olmalı, gelen: ${JSON.stringify(raw)}`,
    );
  }

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`app_config.${LAUNCH_DATE_KEY} geçerli bir tarih değil: ${raw}`);
  }
  return parsed;
}

/** Gauntlet'in zorunlu üçlüsü (S-02) dışında, add-missing-films'in eşiği. */
const MIN_RUNTIME = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResolvedRow {
  tmdb_id: number;
  title: string;
  year: number;
  director: string | null;
  day_number: number;
  position: number;
  curation_tier: Tier;
  editor_note?: string;
  tmdb_title: string;
  resolved_at: string;
}

interface Elimination {
  tmdb_id: number;
  title: string;
  day_number: number;
  position: number;
  reason: 'adult' | 'no_poster' | 'runtime_too_short' | 'fetch_error';
  detail: string;
}

// ─── Girdi doğrulama ─────────────────────────────────────────────────────────

function validateResolved(raw: unknown): ResolvedRow[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${RESOLVED_PATH} bir dizi değil. Faz 1'i çalıştırdın mı?`);
  }
  if (raw.length === 0) {
    throw new Error(`${RESOLVED_PATH} boş — yazılacak bir şey yok.`);
  }

  const problems: string[] = [];
  const rows: ResolvedRow[] = [];
  const seenSlots = new Set<string>();
  const seenTmdb = new Map<number, string>();

  raw.forEach((item, idx) => {
    const where = `satır ${idx + 1}`;
    const before = problems.length;

    if (typeof item !== 'object' || item === null) {
      problems.push(`${where}: nesne değil`);
      return;
    }
    const r = item as Record<string, unknown>;

    if (typeof r.tmdb_id !== 'number' || !Number.isInteger(r.tmdb_id)) {
      problems.push(`${where}: tmdb_id tam sayı değil`);
    }
    if (typeof r.day_number !== 'number' || r.day_number < 1 || r.day_number > 100) {
      problems.push(`${where}: day_number 1-100 olmalı`);
    }
    if (typeof r.position !== 'number' || r.position < 1 || r.position > 6) {
      problems.push(`${where}: position 1-6 olmalı`);
    }
    if (typeof r.curation_tier !== 'string' ||
        !(TIERS as readonly string[]).includes(r.curation_tier)) {
      problems.push(`${where}: curation_tier geçersiz`);
    }
    if (problems.length > before) return;

    const row = item as ResolvedRow;

    const slotKey = `${row.day_number}/${row.position}`;
    if (seenSlots.has(slotKey)) {
      problems.push(`${where}: (gün ${row.day_number}, position ${row.position}) tekrar ediyor`);
      return;
    }
    seenSlots.add(slotKey);

    // Migration 112 UNIQUE(film_id): bir film ikinci bir slota konulamaz.
    // Burada yakalamak, 23505'i DB'den yemekten iyidir — hangi iki slot
    // çakışıyor, mesajda görünür.
    const prevSlot = seenTmdb.get(row.tmdb_id);
    if (prevSlot !== undefined) {
      problems.push(
        `${where}: tmdb_id ${row.tmdb_id} iki slotta — ${prevSlot} ve ${slotKey}. ` +
        `editorial_calendar_films UNIQUE(film_id) bunu reddeder.`,
      );
      return;
    }
    seenTmdb.set(row.tmdb_id, slotKey);

    rows.push(row);
  });

  const positionsByDay = new Map<number, Set<number>>();
  for (const row of rows) {
    const set = positionsByDay.get(row.day_number) ?? new Set<number>();
    set.add(row.position);
    positionsByDay.set(row.day_number, set);
  }
  for (const [day, set] of [...positionsByDay.entries()].sort((a, b) => a[0] - b[0])) {
    const missing = [1, 2, 3, 4].filter((p) => !set.has(p));
    if (missing.length > 0) {
      problems.push(`gün ${day}: ana sıra eksik — position ${missing.join(', ')} yok`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `editorial-resolved.json doğrulaması başarısız (${problems.length} sorun):\n  - ` +
      problems.join('\n  - '),
    );
  }

  return rows;
}

// ─── TMDB detayları ──────────────────────────────────────────────────────────

/**
 * Her satır için TMDB detayını çeker ve `films` satırına dönüştürür.
 * Eleme SESSİZ DEĞİL: elenen her film `eliminations` dizisine düşer.
 */
async function buildFilmRows(rows: ResolvedRow[]): Promise<{
  filmRows: Map<number, FilmInsertRow>;
  eliminations: Elimination[];
}> {
  const filmRows = new Map<number, FilmInsertRow>();
  const eliminations: Elimination[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let detail: TmdbMovieDetail;

    try {
      detail = await tmdbGet<TmdbMovieDetail>(`/movie/${row.tmdb_id}`, {
        append_to_response: 'credits,keywords,external_ids',
      });
    } catch (err: unknown) {
      eliminations.push({
        tmdb_id: row.tmdb_id,
        title: row.title,
        day_number: row.day_number,
        position: row.position,
        reason: 'fetch_error',
        detail: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // add-missing-films.ts:271-275'teki üç eleme — orada `continue`,
    // burada RAPORLANIR.
    if (detail.adult) {
      eliminations.push({
        tmdb_id: row.tmdb_id, title: row.title,
        day_number: row.day_number, position: row.position,
        reason: 'adult', detail: 'TMDB adult=true',
      });
      continue;
    }
    if (!detail.poster_path) {
      eliminations.push({
        tmdb_id: row.tmdb_id, title: row.title,
        day_number: row.day_number, position: row.position,
        reason: 'no_poster',
        detail:
          'poster_path null. Gauntlet zorunlu üçlüsü (S-02): poster_url NULL ' +
          'ise rowToCandidate filmi düşürür ve generate-gauntlet fatal atar.',
      });
      continue;
    }
    if (detail.runtime !== null && detail.runtime < MIN_RUNTIME) {
      eliminations.push({
        tmdb_id: row.tmdb_id, title: row.title,
        day_number: row.day_number, position: row.position,
        reason: 'runtime_too_short',
        detail: `runtime ${detail.runtime} dk < ${MIN_RUNTIME} dk`,
      });
      continue;
    }

    // curation_tier GİRDİDEN (S-12) — detailToRow'un assignTier() değeri ezilir.
    filmRows.set(row.tmdb_id, {
      ...detailToRow(detail),
      curation_tier: row.curation_tier,
    });

    if ((i + 1) % 20 === 0 || i === rows.length - 1) {
      log(`  Detay ${i + 1}/${rows.length} — ${filmRows.size} geçerli, ${eliminations.length} elendi`);
    }
  }

  return { filmRows, eliminations };
}

// ─── DB yazma ────────────────────────────────────────────────────────────────

async function upsertFilms(sb: SupabaseClient, rows: FilmInsertRow[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from('films').upsert(batch, { onConflict: 'tmdb_id' });
    if (error) throw new Error(`films upsert hatası: ${error.message}`);
    total += batch.length;
    log(`  films upsert: ${total}/${rows.length}`);
  }
  return total;
}

/** tmdb_id → films.id (UUID) eşlemesi. Eksik kalan varsa fatal. */
async function fetchFilmUuids(
  sb: SupabaseClient,
  tmdbIds: number[],
): Promise<Map<number, string>> {
  const uuidByTmdb = new Map<number, string>();

  for (let i = 0; i < tmdbIds.length; i += 500) {
    const batch = tmdbIds.slice(i, i + 500);
    const { data, error } = await sb
      .from('films')
      .select('id, tmdb_id')
      .in('tmdb_id', batch);

    if (error) throw new Error(`films UUID sorgusu hatası: ${error.message}`);
    for (const r of data ?? []) {
      uuidByTmdb.set(r.tmdb_id as number, r.id as string);
    }
  }

  const missing = tmdbIds.filter((id) => !uuidByTmdb.has(id));
  if (missing.length > 0) {
    throw new Error(
      `${missing.length} film upsert sonrası DB'de bulunamadı: ${missing.join(', ')}`,
    );
  }
  return uuidByTmdb;
}

/** `ai-profile-films` için placeholder satırları (add-missing-films deseni). */
async function createPlaceholderProfiles(
  sb: SupabaseClient,
  uuids: string[],
): Promise<number> {
  const existing = new Set<string>();
  for (let i = 0; i < uuids.length; i += 500) {
    const batch = uuids.slice(i, i + 500);
    const { data, error } = await sb
      .from('film_profiles')
      .select('film_id')
      .in('film_id', batch);
    if (error) throw new Error(`film_profiles sorgusu hatası: ${error.message}`);
    for (const r of data ?? []) existing.add(r.film_id as string);
  }

  const missing = uuids.filter((id) => !existing.has(id));
  if (missing.length === 0) return 0;

  const placeholders = missing.map((filmId) => ({
    film_id: filmId,
    profile_vector: null,
    dimensions_json: null,
  }));

  for (let i = 0; i < placeholders.length; i += BATCH_SIZE) {
    const batch = placeholders.slice(i, i + BATCH_SIZE);
    const { error } = await sb
      .from('film_profiles')
      .upsert(batch, { onConflict: 'film_id' });
    if (error) throw new Error(`film_profiles placeholder hatası: ${error.message}`);
  }
  return missing.length;
}

async function upsertCalendarDays(
  sb: SupabaseClient,
  rows: ResolvedRow[],
  launchDate: Date,
): Promise<number> {
  const byDay = new Map<number, { day_number: number; theme: Theme; editor_note: string | null }>();
  for (const row of rows) {
    if (byDay.has(row.day_number)) continue;
    byDay.set(row.day_number, {
      day_number: row.day_number,
      // Tema girdiden DEĞİL, day_number + launch_date'ten hesaplanır.
      theme: dayNumberToTheme(row.day_number, launchDate),
      editor_note: row.editor_note ?? null,
    });
  }

  const dayRows = [...byDay.values()].sort((a, b) => a.day_number - b.day_number);
  const { error } = await sb
    .from('editorial_calendar_days')
    .upsert(dayRows, { onConflict: 'day_number' });

  if (error) throw new Error(`editorial_calendar_days upsert hatası: ${error.message}`);
  return dayRows.length;
}

async function upsertCalendarFilms(
  sb: SupabaseClient,
  rows: ResolvedRow[],
  uuidByTmdb: Map<number, string>,
): Promise<number> {
  const filmRows = rows.map((row) => {
    const filmId = uuidByTmdb.get(row.tmdb_id);
    if (filmId === undefined) {
      throw new Error(`tmdb_id ${row.tmdb_id} için UUID yok — upsert sırası bozuk.`);
    }
    return { day_number: row.day_number, position: row.position, film_id: filmId };
  });

  const { error } = await sb
    .from('editorial_calendar_films')
    .upsert(filmRows, { onConflict: 'day_number,position' });

  if (error) {
    // 23505 = UNIQUE(film_id) ihlali: film başka bir güne zaten yazılmış.
    throw new Error(
      `editorial_calendar_films upsert hatası: ${error.message}` +
      (error.code === '23505'
        ? ' — UNIQUE(film_id): bu film takvimde başka bir slotta zaten var.'
        : ''),
    );
  }
  return filmRows.length;
}

/**
 * Dry-run çıktısı: 100 günün tarihi, hafta günü ve hesaplanan teması.
 * Yazmadan önce tema eşlemesinin gözle doğrulanabilmesi için.
 */
function printThemeTable(launchDate: Date): void {
  console.log(`
${c.bold}═══ Hesaplanan gün-tema tablosu (${CALENDAR_DAYS} gün) ═══${c.reset}`);
  const counts = new Map<Theme, number>();
  for (let day = 1; day <= CALENDAR_DAYS; day++) {
    const date = dayNumberToDate(day, launchDate);
    const theme = dayNumberToTheme(day, launchDate);
    counts.set(theme, (counts.get(theme) ?? 0) + 1);
    console.log(
      `  gün ${String(day).padStart(3)} · ${date.toISOString().slice(0, 10)} · ` +
      `${WEEKDAY_TR[date.getUTCDay()].padEnd(9)} → ${c.cyan}${theme}${c.reset}`,
    );
  }
  console.log(`
${c.bold}Tema dağılımı:${c.reset}`);
  for (const [theme, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${theme}: ${n}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `\n${c.bold}${c.magenta}` +
    `╔════════════════════════════════════════════╗\n` +
    `║  E-19 Faz 2 — Editoryal film ingest        ║\n` +
    `╚════════════════════════════════════════════╝${c.reset}\n`,
  );

  const isDryRun = process.argv.includes('--dry-run');
  const isApply = process.argv.includes('--apply');

  // Varsayılan yazma YOK: bayrak verilmezse ne yapılacağı belirsiz kalır.
  if (isDryRun === isApply) {
    console.error(
      `${c.red}Bayrak zorunlu: --dry-run (yazma yok) VEYA --apply (DB'ye yaz).${c.reset}`,
    );
    process.exit(1);
  }

  initCredentials();

  if (!fs.existsSync(RESOLVED_PATH)) {
    throw new Error(
      `${RESOLVED_PATH} yok. Önce: npx tsx scripts/resolve-editorial-films.ts`,
    );
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Tema hesabı girdiden bağımsızdır (yalnız launch_date'e bakar), bu yüzden
  // girdi doğrulamasından ÖNCE okunur: dry-run, takvim eksik olsa bile
  // 100 günün temasını gösterebilmeli.
  const launchDate = await fetchLaunchDate(sb);
  log(
    `${LAUNCH_DATE_KEY} = ${launchDate.toISOString().slice(0, 10)} ` +
    `(${WEEKDAY_TR[launchDate.getUTCDay()]}) → gün 1 teması: ` +
    `${dayNumberToTheme(1, launchDate)}`,
  );

  if (isDryRun) printThemeTable(launchDate);

  const rows = validateResolved(JSON.parse(fs.readFileSync(RESOLVED_PATH, 'utf-8')));
  const dayCount = new Set(rows.map((r) => r.day_number)).size;
  log(`Girdi doğrulandı: ${rows.length} film · ${dayCount} gün`);

  log(`TMDB detayları çekiliyor (${rows.length} film)...`);
  const { filmRows, eliminations } = await buildFilmRows(rows);

  const report = {
    generated_at: new Date().toISOString(),
    mode: isDryRun ? 'dry-run' : 'apply',
    input_rows: rows.length,
    days: dayCount,
    valid: filmRows.size,
    eliminations,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n${c.bold}═══ Ingest raporu ═══${c.reset}`);
  console.log(`  Girdi:     ${rows.length} film · ${dayCount} gün`);
  console.log(`  ${c.green}Geçerli:   ${filmRows.size}${c.reset}`);
  console.log(`  ${c.yellow}Elenen:    ${eliminations.length}${c.reset}`);
  console.log(`  TMDB çağrısı: ${getCallCount()}`);
  console.log(`  ${c.dim}${REPORT_PATH}${c.reset}`);

  // SESSİZ ELEME YASAK: tek bir eleme bile o günü oynanamaz kılar (S-03).
  if (eliminations.length > 0) {
    console.error(`\n${c.red}${c.bold}${eliminations.length} film elendi:${c.reset}`);
    for (const e of eliminations) {
      console.error(
        `  ${c.red}✗${c.reset} gün ${e.day_number}/pos ${e.position} · ` +
        `${e.title} (tmdb ${e.tmdb_id}) — ${c.yellow}${e.reason}${c.reset}: ${e.detail}`,
      );
    }
    console.error(
      `\n${c.red}Bu filmler CTO'nun seçkisindeydi ve ingest edilemiyor. ` +
      `Yazma YAPILMADI — seçkiyi düzelt ve Faz 1'i tekrar koş.${c.reset}\n`,
    );
    process.exit(1);
  }

  if (isDryRun) {
    console.log(`\n${c.yellow}DRY RUN — hiçbir yazma yapılmadı.${c.reset}`);
    console.log(`  Yazılacaktı: ${filmRows.size} films · ${dayCount} calendar_days · ${rows.length} calendar_films`);
    const tierCounts = new Map<string, number>();
    for (const r of filmRows.values()) {
      tierCounts.set(r.curation_tier, (tierCounts.get(r.curation_tier) ?? 0) + 1);
    }
    console.log(`\n${c.bold}curation_tier dağılımı (girdiden):${c.reset}`);
    for (const [tier, n] of tierCounts) console.log(`  ${tier}: ${n}`);
    return;
  }

  // ─── Yazma ───────────────────────────────────────────────────────────────
  log(`\n${c.cyan}films upsert ediliyor...${c.reset}`);
  const inserted = await upsertFilms(sb, [...filmRows.values()]);
  log(`${c.green}✓ ${inserted} film upsert edildi${c.reset}`);

  const uuidByTmdb = await fetchFilmUuids(sb, [...filmRows.keys()]);

  const placeholders = await createPlaceholderProfiles(sb, [...uuidByTmdb.values()]);
  log(`${c.green}✓ ${placeholders} placeholder film_profiles satırı${c.reset}`);

  const days = await upsertCalendarDays(sb, rows, launchDate);
  log(`${c.green}✓ ${days} editorial_calendar_days satırı${c.reset}`);

  const calendarFilms = await upsertCalendarFilms(sb, rows, uuidByTmdb);
  log(`${c.green}✓ ${calendarFilms} editorial_calendar_films satırı${c.reset}`);

  console.log(
    `\n${c.bold}${c.green}` +
    `╔════════════════════════════════════════════╗\n` +
    `║           INGEST TAMAMLANDI                ║\n` +
    `╚════════════════════════════════════════════╝${c.reset}\n`,
  );
  console.log(`  films:                   ${inserted}`);
  console.log(`  film_profiles (boş):     ${placeholders}`);
  console.log(`  editorial_calendar_days: ${days}`);
  console.log(`  editorial_calendar_films:${calendarFilms}`);
  console.log(`  TMDB çağrısı:            ${getCallCount()}`);
  console.log(
    `\n  ${c.yellow}SONRAKİ ZİNCİR: backfill-film-metadata → enrich-films-metadata\n` +
    `  → compute-dominant-colors → ai-profile-films (MALİYET, onay gerekir)\n` +
    `  → audit-film-metadata-gaps${c.reset}\n`,
  );
}

main().catch((err: unknown) => {
  console.error(`\n${c.red}Fatal error:${c.reset}`, err);
  process.exit(1);
});
