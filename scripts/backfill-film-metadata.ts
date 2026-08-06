/**
 * Film Metadata Backfill — director / original_language / imdb_votes
 *
 * generate-gauntlet'in çeşitlilik kuralları ("aynı yönetmen ≤1", "aynı dil ≤3",
 * tanınırlık yüzdeliği) bu üç alana bakar. Alan NULL ise kural hata vermez,
 * sadece UYGULANMAZ — yani veri katmanında sessiz fallback. Bu script o
 * boşlukları kapatır.
 *
 * Kaynaklar (mevcut pipeline ile tutarlı):
 *   - director          → TMDb /movie/{id}?append_to_response=credits, crew job === 'Director'
 *                         (scripts/enrich-films-metadata.ts:118 ile aynı kural)
 *   - original_language → aynı TMDb movie detail çağrısı
 *   - imdb_votes        → OMDb /?i=<imdb_id>, imdbVotes alanı
 *                         (scripts/lib/omdb-client.ts — TMDb vote_count DEĞİL)
 *
 * Doldurulamayan film NULL kalır ve raporlanır. Uydurma değer yazılmaz.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-film-metadata.ts
 *   npx tsx --env-file=.env scripts/backfill-film-metadata.ts --dry-run
 *   npx tsx --env-file=.env scripts/backfill-film-metadata.ts --tiers=core,extended,trending,archive
 *   npx tsx --env-file=.env scripts/backfill-film-metadata.ts --limit=200
 *
 * Yarıda kesilebilir: her çalıştırmada NULL olan satırlar yeniden sorgulanır,
 * tamamlanan filmler otomatik olarak kapsam dışı kalır.
 *
 * Env: EXPO_PUBLIC_SUPABASE_URL (veya SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
 *      EXPO_PUBLIC_TMDB_API_KEY, OMDB_API_KEY (opsiyonel — yoksa imdb_votes atlanır)
 */

import * as fs from 'fs';
import * as path from 'path';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Varsayılan düello havuzu. */
const DEFAULT_TIERS = ['core', 'extended', 'trending'];

const BATCH_SIZE = 50;
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 3;
const OMDB_BASE_URL = 'https://www.omdbapi.com';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const REPORT_PATH = path.join(process.cwd(), 'data', 'backfill-metadata-report.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilmRow {
  id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  director: string | null;
  original_language: string | null;
  imdb_votes: number | null;
  curation_tier: string | null;
}

interface TmdbCrewMember {
  job: string;
  name: string;
}

interface TmdbMovieDetail {
  original_language?: string;
  credits?: { crew?: TmdbCrewMember[] };
}

interface OmdbResponse {
  Response: 'True' | 'False';
  Error?: string;
  imdbVotes?: string;
}

/** Doldurulamayan bir alanın kaydı. */
interface UnfilledEntry {
  film_id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  curation_tier: string | null;
  field: 'director' | 'original_language' | 'imdb_votes';
  reason: string;
}

interface FieldStats {
  missing_before: number;
  filled: number;
  unfilled: number;
}

interface Flags {
  dryRun: boolean;
  tiers: string[];
  limit: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** CLI bayraklarını çözer. */
function parseArgs(): Flags {
  const args = process.argv.slice(2);

  const tiersArg = args.find((a) => a.startsWith('--tiers='));
  const tiers = tiersArg
    ? tiersArg
        .split('=')[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : DEFAULT_TIERS;

  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  return {
    dryRun: args.includes('--dry-run'),
    tiers,
    limit: limit != null && !isNaN(limit) ? limit : null,
  };
}

/** Service-role Supabase istemcisi kurar; kimlik yoksa çıkar. */
function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** İlerleme çubuğu basar. */
function printProgress(current: number, total: number, label: string, startTime: number): void {
  const elapsed = (Date.now() - startTime) / 1000;
  const perItem = current > 0 ? elapsed / current : 0;
  const remaining = Math.round((total - current) * perItem);
  const eta = remaining > 60 ? `${Math.floor(remaining / 60)}m ${remaining % 60}s` : `${remaining}s`;

  const width = 32;
  const filled = total > 0 ? Math.round((current / total) * width) : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pct = total > 0 ? Math.round((current / total) * 100) : 100;

  process.stdout.write(
    `\r[${bar}] ${String(pct).padStart(3)}%  ${current}/${total}  ETA: ${eta.padEnd(8)} ${label.slice(0, 28).padEnd(28)}`,
  );
  if (current === total) process.stdout.write('\n');
}

// ---------------------------------------------------------------------------
// TMDb
// ---------------------------------------------------------------------------

/**
 * TMDb movie detail + credits çeker.
 * Bulunamazsa null, ağ/oran hatasında yeniden dener.
 * Kalıcı hata durumunda throw eder — sessizce yutulmaz.
 */
async function fetchTmdbDetail(tmdbId: number, apiKey: string): Promise<TmdbMovieDetail | null> {
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${apiKey}&append_to_response=credits`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url);

    if (res.status === 404) return null;

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '5', 10);
      const waitMs = (isNaN(retryAfter) ? 5 : retryAfter) * 1000 + 500;
      console.warn(`\n  TMDb 429 — ${waitMs / 1000}s bekleniyor...`);
      await sleep(waitMs);
      continue;
    }

    if (res.status === 401) {
      console.error('\nHATA: TMDb 401 — EXPO_PUBLIC_TMDB_API_KEY geçersiz.');
      process.exit(1);
    }

    if (res.ok) {
      return (await res.json()) as TmdbMovieDetail;
    }

    if (attempt === MAX_RETRIES) {
      throw new Error(`TMDb HTTP ${res.status} (tmdb_id=${tmdbId}, ${MAX_RETRIES} deneme)`);
    }
    await sleep(1000 * attempt);
  }

  throw new Error(`TMDb erişilemedi (tmdb_id=${tmdbId})`);
}

/** crew içinden ilk 'Director' kaydını alır (enrich-films-metadata.ts ile aynı kural). */
function extractDirector(crew: TmdbCrewMember[]): string | null {
  return crew.find((m) => m.job === 'Director')?.name ?? null;
}

// ---------------------------------------------------------------------------
// OMDb
// ---------------------------------------------------------------------------

/**
 * OMDb'den imdbVotes çeker. Bulunamazsa null döner.
 * Kalıcı hata throw edilir.
 */
async function fetchOmdbVotes(imdbId: string, apiKey: string): Promise<number | null> {
  const url = `${OMDB_BASE_URL}/?i=${imdbId}&apikey=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url);

    if (res.status === 429) {
      console.warn('\n  OMDb 429 — 60s bekleniyor...');
      await sleep(60_000);
      continue;
    }

    if (res.status === 401) {
      console.error('\nHATA: OMDb 401 — OMDB_API_KEY geçersiz.');
      process.exit(1);
    }

    if (res.ok) {
      const data = (await res.json()) as OmdbResponse;
      if (data.Response === 'False') return null;
      // "2,500,000" → 2500000 | "N/A" → null (omdb-client.ts:196 ile aynı kural)
      if (!data.imdbVotes || data.imdbVotes === 'N/A') return null;
      const votes = parseInt(data.imdbVotes.replace(/,/g, ''), 10);
      return isNaN(votes) ? null : votes;
    }

    if (attempt === MAX_RETRIES) {
      throw new Error(`OMDb HTTP ${res.status} (imdb_id=${imdbId}, ${MAX_RETRIES} deneme)`);
    }
    await sleep(1000 * attempt);
  }

  throw new Error(`OMDb erişilemedi (imdb_id=${imdbId})`);
}

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

/**
 * Kapsam içindeki, üç alandan en az biri NULL olan filmleri sayfalayarak çeker.
 * Her çalıştırmada yeniden sorgulandığı için script kaldığı yerden devam eder.
 */
async function getFilmsNeedingBackfill(
  sb: SupabaseClient,
  tiers: string[],
): Promise<FilmRow[]> {
  const PAGE = 1000;
  const rows: FilmRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await sb
      .from('films')
      .select('id, tmdb_id, imdb_id, title, director, original_language, imdb_votes, curation_tier')
      .in('curation_tier', tiers)
      .or('director.is.null,original_language.is.null,imdb_votes.is.null')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`films sorgu hatası: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as FilmRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return rows;
}

/** Kapsam içindeki alan bazlı NULL sayılarını döner. */
async function countNulls(
  sb: SupabaseClient,
  tiers: string[],
): Promise<{ total: number; director: number; original_language: number; imdb_votes: number }> {
  const head = { count: 'exact' as const, head: true };

  const [total, director, language, votes] = await Promise.all([
    sb.from('films').select('id', head).in('curation_tier', tiers),
    sb.from('films').select('id', head).in('curation_tier', tiers).is('director', null),
    sb.from('films').select('id', head).in('curation_tier', tiers).is('original_language', null),
    sb.from('films').select('id', head).in('curation_tier', tiers).is('imdb_votes', null),
  ]);

  for (const res of [total, director, language, votes]) {
    if (res.error) throw new Error(`sayım hatası: ${res.error.message}`);
  }

  return {
    total: total.count ?? 0,
    director: director.count ?? 0,
    original_language: language.count ?? 0,
    imdb_votes: votes.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseArgs();

  console.log('FILM METADATA BACKFILL');
  console.log('======================\n');
  console.log(`Kapsam (curation_tier): ${flags.tiers.join(', ')}`);

  const tmdbKey = process.env.EXPO_PUBLIC_TMDB_API_KEY ?? process.env.TMDB_API_KEY;
  if (!tmdbKey) {
    console.error('HATA: EXPO_PUBLIC_TMDB_API_KEY gerekli (director + original_language kaynağı).');
    process.exit(1);
  }

  const omdbKey = process.env.OMDB_API_KEY;
  if (!omdbKey) {
    console.warn(
      '\nUYARI: OMDB_API_KEY bulunamadı.\n' +
        '  imdb_votes kaynağı OMDb API\'dir (TMDb vote_count farklı bir metriktir ve\n' +
        '  bu kolona yazılmaz). Anahtar olmadan imdb_votes alanı ATLANIYOR — eksik\n' +
        '  satırlar NULL kalacak ve raporun sonunda listelenecek.\n' +
        '  Doldurmak için .env dosyasına OMDB_API_KEY=<key> ekleyip tekrar çalıştır.\n',
    );
  }

  const sb = getSupabaseClient();

  // ── Öncesi ölçüm ────────────────────────────────────────────────────────
  const before = await countNulls(sb, flags.tiers);
  console.log(`Havuz: ${before.total} film\n`);
  console.log('ÖNCESİ (NULL sayısı)');
  console.log(`  director:          ${before.director}`);
  console.log(`  original_language: ${before.original_language}`);
  console.log(`  imdb_votes:        ${before.imdb_votes}\n`);

  let films = await getFilmsNeedingBackfill(sb, flags.tiers);
  if (flags.limit != null) films = films.slice(0, flags.limit);

  console.log(`İşlenecek film: ${films.length}\n`);

  if (films.length === 0) {
    console.log('Doldurulacak alan yok. Çıkılıyor.');
    return;
  }

  if (flags.dryRun) {
    const needsTmdb = films.filter((f) => !f.director || !f.original_language).length;
    const needsOmdb = films.filter((f) => f.imdb_votes == null).length;
    console.log('--- DRY RUN ---');
    console.log(`TMDb çağrısı gerekecek: ${needsTmdb}`);
    console.log(`OMDb çağrısı gerekecek: ${omdbKey ? needsOmdb : `${needsOmdb} (anahtar yok, atlanacak)`}`);
    const calls = needsTmdb + (omdbKey ? needsOmdb : 0);
    console.log(`Tahmini süre: ~${Math.ceil((calls * REQUEST_DELAY_MS) / 1000)}s`);
    for (const f of films.slice(0, 20)) {
      const eksik = [
        !f.director ? 'director' : null,
        !f.original_language ? 'original_language' : null,
        f.imdb_votes == null ? 'imdb_votes' : null,
      ].filter(Boolean);
      console.log(`  ${f.title} (tmdb=${f.tmdb_id}) → ${eksik.join(', ')}`);
    }
    if (films.length > 20) console.log(`  ... +${films.length - 20} film`);
    return;
  }

  // ── Backfill döngüsü ────────────────────────────────────────────────────
  const unfilled: UnfilledEntry[] = [];
  const stats: Record<'director' | 'original_language' | 'imdb_votes', FieldStats> = {
    director: { missing_before: before.director, filled: 0, unfilled: 0 },
    original_language: { missing_before: before.original_language, filled: 0, unfilled: 0 },
    imdb_votes: { missing_before: before.imdb_votes, filled: 0, unfilled: 0 },
  };

  let processed = 0;
  let updatedRows = 0;
  const startTime = Date.now();

  for (let i = 0; i < films.length; i += BATCH_SIZE) {
    const batch = films.slice(i, i + BATCH_SIZE);

    for (const film of batch) {
      const update: Partial<Pick<FilmRow, 'director' | 'original_language' | 'imdb_votes'>> = {};

      // ── TMDb: director + original_language ──────────────────────────────
      const needsTmdb = !film.director || !film.original_language;
      if (needsTmdb) {
        if (film.tmdb_id == null) {
          for (const field of ['director', 'original_language'] as const) {
            if (!film[field]) {
              unfilled.push({
                film_id: film.id,
                tmdb_id: film.tmdb_id,
                imdb_id: film.imdb_id,
                title: film.title,
                curation_tier: film.curation_tier,
                field,
                reason: 'tmdb_id NULL — TMDb\'de aranamıyor',
              });
              stats[field].unfilled++;
            }
          }
        } else {
          await sleep(REQUEST_DELAY_MS);
          try {
            const detail = await fetchTmdbDetail(film.tmdb_id, tmdbKey);

            if (detail === null) {
              for (const field of ['director', 'original_language'] as const) {
                if (!film[field]) {
                  unfilled.push({
                    film_id: film.id,
                    tmdb_id: film.tmdb_id,
                    imdb_id: film.imdb_id,
                    title: film.title,
                    curation_tier: film.curation_tier,
                    field,
                    reason: 'TMDb 404 — film bulunamadı',
                  });
                  stats[field].unfilled++;
                }
              }
            } else {
              if (!film.director) {
                const director = extractDirector(detail.credits?.crew ?? []);
                if (director) {
                  update.director = director;
                  stats.director.filled++;
                } else {
                  unfilled.push({
                    film_id: film.id,
                    tmdb_id: film.tmdb_id,
                    imdb_id: film.imdb_id,
                    title: film.title,
                    curation_tier: film.curation_tier,
                    field: 'director',
                    reason: 'TMDb crew içinde job=Director yok',
                  });
                  stats.director.unfilled++;
                }
              }

              if (!film.original_language) {
                const lang = detail.original_language;
                if (lang) {
                  update.original_language = lang;
                  stats.original_language.filled++;
                } else {
                  unfilled.push({
                    film_id: film.id,
                    tmdb_id: film.tmdb_id,
                    imdb_id: film.imdb_id,
                    title: film.title,
                    curation_tier: film.curation_tier,
                    field: 'original_language',
                    reason: 'TMDb detail içinde original_language boş',
                  });
                  stats.original_language.unfilled++;
                }
              }
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`\n  TMDb HATA — ${film.title}: ${msg}`);
            for (const field of ['director', 'original_language'] as const) {
              if (!film[field]) {
                unfilled.push({
                  film_id: film.id,
                  tmdb_id: film.tmdb_id,
                  imdb_id: film.imdb_id,
                  title: film.title,
                  curation_tier: film.curation_tier,
                  field,
                  reason: `TMDb hatası: ${msg}`,
                });
                stats[field].unfilled++;
              }
            }
          }
        }
      }

      // ── OMDb: imdb_votes ────────────────────────────────────────────────
      if (film.imdb_votes == null) {
        if (!omdbKey) {
          unfilled.push({
            film_id: film.id,
            tmdb_id: film.tmdb_id,
            imdb_id: film.imdb_id,
            title: film.title,
            curation_tier: film.curation_tier,
            field: 'imdb_votes',
            reason: 'OMDB_API_KEY yok — alan atlandı',
          });
          stats.imdb_votes.unfilled++;
        } else if (!film.imdb_id) {
          unfilled.push({
            film_id: film.id,
            tmdb_id: film.tmdb_id,
            imdb_id: film.imdb_id,
            title: film.title,
            curation_tier: film.curation_tier,
            field: 'imdb_votes',
            reason: 'imdb_id NULL — OMDb anahtarsız sorgulanamıyor',
          });
          stats.imdb_votes.unfilled++;
        } else {
          await sleep(REQUEST_DELAY_MS);
          try {
            const votes = await fetchOmdbVotes(film.imdb_id, omdbKey);
            if (votes != null) {
              update.imdb_votes = votes;
              stats.imdb_votes.filled++;
            } else {
              unfilled.push({
                film_id: film.id,
                tmdb_id: film.tmdb_id,
                imdb_id: film.imdb_id,
                title: film.title,
                curation_tier: film.curation_tier,
                field: 'imdb_votes',
                reason: 'OMDb: kayıt yok veya imdbVotes = N/A',
              });
              stats.imdb_votes.unfilled++;
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`\n  OMDb HATA — ${film.title}: ${msg}`);
            unfilled.push({
              film_id: film.id,
              tmdb_id: film.tmdb_id,
              imdb_id: film.imdb_id,
              title: film.title,
              curation_tier: film.curation_tier,
              field: 'imdb_votes',
              reason: `OMDb hatası: ${msg}`,
            });
            stats.imdb_votes.unfilled++;
          }
        }
      }

      // ── Yazma ───────────────────────────────────────────────────────────
      if (Object.keys(update).length > 0) {
        const { error } = await sb.from('films').update(update).eq('id', film.id);
        if (error) {
          console.error(`\n  DB HATA — ${film.title}: ${error.message}`);
          for (const field of Object.keys(update) as (keyof typeof update)[]) {
            unfilled.push({
              film_id: film.id,
              tmdb_id: film.tmdb_id,
              imdb_id: film.imdb_id,
              title: film.title,
              curation_tier: film.curation_tier,
              field,
              reason: `DB update hatası: ${error.message}`,
            });
            stats[field].filled--;
            stats[field].unfilled++;
          }
        } else {
          updatedRows++;
        }
      }

      processed++;
      printProgress(processed, films.length, film.title, startTime);
    }

    console.log(
      `\n  [batch ${Math.floor(i / BATCH_SIZE) + 1}] ${processed}/${films.length} — ` +
        `dolan: dir ${stats.director.filled} / lang ${stats.original_language.filled} / votes ${stats.imdb_votes.filled}`,
    );
  }

  // ── Sonrası ölçüm ───────────────────────────────────────────────────────
  const after = await countNulls(sb, flags.tiers);

  const report = {
    timestamp: new Date().toISOString(),
    tiers: flags.tiers,
    pool_size: after.total,
    omdb_key_present: !!omdbKey,
    films_processed: films.length,
    rows_updated: updatedRows,
    fields: {
      director: { before: before.director, after: after.director, filled: stats.director.filled },
      original_language: {
        before: before.original_language,
        after: after.original_language,
        filled: stats.original_language.filled,
      },
      imdb_votes: {
        before: before.imdb_votes,
        after: after.imdb_votes,
        filled: stats.imdb_votes.filled,
      },
    },
    unfilled,
  };

  if (!fs.existsSync(path.dirname(REPORT_PATH))) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');

  const pctOf = (n: number): string => `${((n / after.total) * 100).toFixed(1)}%`;

  console.log('\n\n=== BACKFILL TAMAMLANDI ===');
  console.log(`Havuz: ${after.total} film (${flags.tiers.join(', ')})`);
  console.log(`Güncellenen satır: ${updatedRows}\n`);
  console.log('ALAN                ÖNCE   SONRA   DOLAN   SONRA%');
  console.log(
    `director          ${String(before.director).padStart(6)}  ${String(after.director).padStart(6)}  ${String(stats.director.filled).padStart(6)}  ${pctOf(after.director).padStart(7)}`,
  );
  console.log(
    `original_language ${String(before.original_language).padStart(6)}  ${String(after.original_language).padStart(6)}  ${String(stats.original_language.filled).padStart(6)}  ${pctOf(after.original_language).padStart(7)}`,
  );
  console.log(
    `imdb_votes        ${String(before.imdb_votes).padStart(6)}  ${String(after.imdb_votes).padStart(6)}  ${String(stats.imdb_votes.filled).padStart(6)}  ${pctOf(after.imdb_votes).padStart(7)}`,
  );

  console.log(`\nDOLDURULAMAYAN: ${unfilled.length} kayıt (NULL bırakıldı, uydurma değer yazılmadı)`);
  const byReason = new Map<string, number>();
  for (const u of unfilled) {
    const key = `${u.field} — ${u.reason}`;
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  for (const [reason, count] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${reason}`);
  }

  if (unfilled.length > 0 && unfilled.length <= 30) {
    console.log('\nDetay:');
    for (const u of unfilled) {
      console.log(`  ${u.title} (tmdb=${u.tmdb_id}) — ${u.field}: ${u.reason}`);
    }
  }

  console.log(`\nRapor: ${REPORT_PATH}`);
}

main().catch((err: unknown) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
