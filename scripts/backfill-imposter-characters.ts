/**
 * Imposter seçeneklerine ROL ADI ekler ve eski bulmacaları 4 seçeneğe indirir.
 *
 * NEDEN GEREKLİ
 * Oynanış ekranı 31 Tem 2026'da tek sayfaya (kaydırmasız, 2x2 ızgara) alındı:
 *   1. Her round 4 seçenek. `generate-puzzles` bundan sonra 4 üretiyor, ama
 *      ZATEN ÜRETİLMİŞ bulmacalarda round 2'de 5, round 3'te 6 seçenek var.
 *   2. Oyuncu adının altında rol adı gösteriliyor. `films.cast_json` bugün
 *      yalnız `name` + `profile_url` tutuyor; `character` alanı hiç yok.
 *
 * NE YAPAR (iki faz, ikisi de idempotent)
 *   Faz 1 — films.cast_json: TMDb credits'ten `character` çekip mevcut cast
 *           kayıtlarına EKLER. `name`/`profile_url`/`profile_path` aynen kalır.
 *           Zaten `character` taşıyan filmler atlanır.
 *   Faz 2 — daily_puzzles (game_type = 'imposter'):
 *           a. Her seçeneğe `character` yazar — HİÇBİRİ BOŞ KALMAZ. Sıra:
 *              roundun KENDİ filminin kadrosu (gerçek oyuncu, oradaki rolü) →
 *              veritabanındaki başka bir film (sahtekâr, oynadığı DİĞER
 *              filmdeki rolü) → TMDb kişi araması + film kredileri (veritabanında
 *              hiç kaydı olmayan oyuncu için son çare). Ekranda ipucu tam
 *              olarak bu kıyas: sahtekârın rolü ekrandaki filme ait değildir.
 *              Bir seçenek yine de rolsüz kalırsa uyarı basılır; istemci o
 *              roundda rol satırını TÜM kartlarda gizler (eksik satır kendisi
 *              cevabı ele verirdi).
 *           b. Seçenekleri 4'e indirir: TÜM sahtekârlar korunur, kalan yerler
 *              gerçek oyuncularla doldurulur. 4 veya daha az seçenekli roundlar
 *              olduğu gibi bırakılır.
 *
 * NEDEN SİLİP YENİDEN ÜRETMİYORUZ
 * `game_scores.puzzle_id → daily_puzzles(id) ON DELETE CASCADE`
 * (016_game_tables.sql:20). Oynanmış bir bulmacayı silmek o günü oynayan
 * HERKESİN skorunu, serisini ve XP'sini siler. Bunun yerine yalnızca
 * `puzzle_data` güncellenir: `id`, `solution_ref`, `imposter_ids` ve
 * `theme_matched` aynen korunur → FK sağlam, skorlar duruyor, çözüm değişmiyor.
 * (Aynı gerekçe: scripts/backfill-imposter-photos.ts)
 *
 * ÇÖZÜM SIZINTISI YOK (Hard Rule 1)
 * `character` hem gerçek hem sahte oyuncuda dolar; alanın VARLIĞI ipucu
 * vermez. `imposter_ids` bu script tarafından hiç değiştirilmez ve
 * `public_daily_puzzles` view'ı tarafından zaten stripleniyor
 * (064_puzzle_view_strip_solution.sql). Seçenek eleme yalnızca GERÇEK
 * oyuncudan yapılır — doğru cevap kümesi aynen kalır.
 *
 * Kullanım:
 *   npx tsx scripts/backfill-imposter-characters.ts               # dry-run
 *   npx tsx scripts/backfill-imposter-characters.ts --apply       # yazar
 *   npx tsx scripts/backfill-imposter-characters.ts --skip-tmdb   # Faz 1'i atla
 *   npx tsx scripts/backfill-imposter-characters.ts --dns 1.1.1.1 # DNS engeli varsa
 *
 * Env: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      TMDB_API_KEY (veya EXPO_PUBLIC_TMDB_API_KEY)
 */
import 'dotenv/config';
import { Resolver } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { Agent, setGlobalDispatcher } from 'undici';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TMDB_API_KEY = process.env.TMDB_API_KEY ?? process.env.EXPO_PUBLIC_TMDB_API_KEY;

const APPLY = process.argv.includes('--apply');
const SKIP_TMDB = process.argv.includes('--skip-tmdb');

/**
 * TMDb erişilemezse denenecek DNS sunucusu.
 *
 * Bazı ISS'ler (TR dahil) `api.themoviedb.org`'u DNS seviyesinde engelliyor:
 * yerel çözümleyici NXDOMAIN dönüyor ve her istek "fetch failed" oluyor.
 * Node'un `fetch`i işletim sistemi çözümleyicisini kullandığı için
 * `dns.setServers` yetmiyor; undici'ye özel bir `lookup` vermek gerekiyor.
 * `--dns 1.1.1.1` ile değiştirilebilir.
 */
const dnsArgIndex = process.argv.indexOf('--dns');
const DNS_SERVER = dnsArgIndex >= 0 ? process.argv[dnsArgIndex + 1] : '8.8.8.8';

/** TMDb hız sınırı 40 istek/10sn — güvenli aralık */
const TMDB_DELAY_MS = 300;

/** Oynanış ekranının taşımadan gösterebildiği seçenek sayısı */
const MAX_OPTIONS = 4;

interface CastMember {
  name: string;
  profile_path?: string | null;
  profile_url?: string | null;
  character?: string | null;
}

interface FilmRow {
  id: string;
  tmdb_id: number | null;
  title: string;
  cast_json: CastMember[] | null;
}

interface ImposterOption {
  id: number;
  name: string;
  profile_path?: string | null;
  character?: string | null;
}

interface PuzzleRound {
  round: number;
  tmdb_id?: number | null;
  options: ImposterOption[];
  imposter_ids?: number[];
  [key: string]: unknown;
}

interface PuzzleRow {
  id: string;
  date: string;
  puzzle_data: { rounds?: PuzzleRound[] } & Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tüm HTTP isteklerini verilen DNS sunucusuyla çözecek şekilde ayarlar */
function installCustomDns(server: string): void {
  const resolver = new Resolver();
  resolver.setServers([server]);

  const lookup: LookupFunction = (hostname, options, callback) => {
    resolver.resolve4(hostname, (err, addresses) => {
      if (err || !addresses?.length) {
        callback(err ?? new Error(`DNS: ${hostname} çözülemedi`), '', 4);
        return;
      }
      if (options.all) {
        callback(null, addresses.map((address) => ({ address, family: 4 })));
      } else {
        callback(null, addresses[0], 4);
      }
    });
  };

  setGlobalDispatcher(new Agent({ connect: { lookup } }));
}

/**
 * TMDb'ye tek bir istek atıp erişimi doğrular; başarısızsa özel DNS ile
 * bir kez daha dener.
 *
 * Preflight olmadan engelli ağda script 1000+ filmi tek tek deneyip her biri
 * için "fetch failed" basıyor ve hiçbir şey yazmadan bitiyor — hata ancak
 * çıktının sonunda anlaşılıyordu.
 */
async function ensureTmdbReachable(): Promise<void> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY (veya EXPO_PUBLIC_TMDB_API_KEY) tanımlı değil');
  }

  const url = `https://api.themoviedb.org/3/configuration?api_key=${TMDB_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return;
  } catch (err) {
    console.warn(`TMDb erişilemedi (${(err as Error).message}) — DNS ${DNS_SERVER} deneniyor...`);
  }

  installCustomDns(DNS_SERVER);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    console.log(`TMDb erişimi DNS ${DNS_SERVER} ile sağlandı.`);
  } catch (err) {
    throw new Error(
      `TMDb'ye ulaşılamıyor (${(err as Error).message}). ` +
        `Sistem DNS'i 8.8.8.8/1.1.1.1 yapıp veya VPN ile tekrar deneyin; ` +
        `TMDb olmadan yalnız --skip-tmdb ile (mevcut veriyle) çalıştırılabilir.`,
    );
  }
}

/** Sayfalı tam tablo okuma — Supabase varsayılan 1000 satır sınırını aşar */
async function fetchAllFilms(): Promise<FilmRow[]> {
  const PAGE = 1000;
  const out: FilmRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('films')
      .select('id, tmdb_id, title, cast_json')
      .not('cast_json', 'is', null)
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    out.push(...(data as FilmRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return out;
}

/**
 * Oyuncu adı → oynadığı BAŞKA bir filmdeki rol adı (TMDb kişi araması).
 *
 * Faz 2'nin son çaresi: sahtekârın rol adı boş kalamaz. Veritabanındaki
 * filmlerden rol bulunamayan oyuncu için TMDb'de kişi aranır ve film
 * kredilerinden en popüler, rol adı dolu kayıt seçilir.
 *
 * Sonuç isim bazında önbelleklenir — aynı oyuncu birçok bulmacada geçebilir.
 */
const personCharacterCache = new Map<string, string | null>();

/**
 * İsim karşılaştırma anahtarı — aksan ve Türkçe harf farklarını siler.
 *
 * Gerekçe: `cast_json`'da "Aras Bulut Iynemli" yazıyor, TMDb'de "Aras Bulut
 * İynemli". Düz `toLowerCase()` karşılaştırması bu oyuncuyu bulamıyordu.
 * NFD + birleşen işaretleri atma "İ/ş/ğ/é" gibi harfleri taban harfe indiriyor;
 * noktasız 'ı' işaret taşımadığı için ayrıca eşleniyor.
 */
function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .trim();
}

async function fetchCharacterFromPerson(name: string): Promise<string | null> {
  const key = nameKey(name);
  const cached = personCharacterCache.get(key);
  if (cached !== undefined) return cached;

  let result: string | null = null;
  try {
    await sleep(TMDB_DELAY_MS);
    const searchUrl =
      `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}` +
      `&query=${encodeURIComponent(name)}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`TMDB search ${searchRes.status}`);

    const searchJson = (await searchRes.json()) as {
      results?: Array<{ id: number; name: string }>;
    };
    const person = (searchJson.results ?? []).find(
      (p) => p.name && nameKey(p.name) === key,
    );

    if (person) {
      await sleep(TMDB_DELAY_MS);
      const creditsUrl =
        `https://api.themoviedb.org/3/person/${person.id}/movie_credits?api_key=${TMDB_API_KEY}`;
      const creditsRes = await fetch(creditsUrl);
      if (!creditsRes.ok) throw new Error(`TMDB credits ${creditsRes.status}`);

      const creditsJson = (await creditsRes.json()) as {
        cast?: Array<{ character?: string; popularity?: number }>;
      };
      const best = (creditsJson.cast ?? [])
        .filter((c) => c.character && c.character.trim().length > 0)
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];

      result = best?.character ?? null;
    }
  } catch (err) {
    console.warn(`  TMDb kişi araması başarısız (${name}): ${(err as Error).message}`);
  }

  personCharacterCache.set(key, result);
  return result;
}

/** TMDb credits → isim (küçük harf) → rol adı */
async function fetchCharacters(tmdbId: number): Promise<Map<string, string>> {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} (tmdb_id ${tmdbId})`);

  const json = (await res.json()) as {
    cast?: Array<{ name?: string; character?: string }>;
  };

  const map = new Map<string, string>();
  for (const c of json.cast ?? []) {
    if (!c.name || !c.character) continue;
    const key = c.name.toLowerCase();
    if (!map.has(key)) map.set(key, c.character);
  }
  return map;
}

/**
 * FAZ 1 — films.cast_json kayıtlarına `character` ekler.
 *
 * @returns Güncellenmiş film listesi (Faz 2 haritalarını bundan kurar)
 */
async function fillFilmCharacters(films: FilmRow[]): Promise<void> {
  const needsWork = films.filter(
    (f) =>
      f.tmdb_id != null &&
      Array.isArray(f.cast_json) &&
      f.cast_json.some((c) => !c.character),
  );

  console.log(`\n── FAZ 1: films.cast_json rol adları ──`);
  console.log(`Rol adı eksik film: ${needsWork.length} / ${films.length}`);

  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY (veya EXPO_PUBLIC_TMDB_API_KEY) tanımlı değil');
  }

  let updated = 0;
  let filledEntries = 0;
  let failed = 0;

  for (const film of needsWork) {
    try {
      await sleep(TMDB_DELAY_MS);
      const chars = await fetchCharacters(film.tmdb_id!);

      let changed = 0;
      for (const actor of film.cast_json ?? []) {
        if (actor.character) continue;
        const c = chars.get(actor.name?.toLowerCase() ?? '');
        if (c) {
          actor.character = c;
          changed++;
        }
      }

      if (changed === 0) continue;
      filledEntries += changed;
      updated++;

      if (APPLY) {
        const { error } = await supabase
          .from('films')
          .update({ cast_json: film.cast_json })
          .eq('id', film.id);
        if (error) throw new Error(error.message);
      }
    } catch (err) {
      failed++;
      console.warn(`  ATLANDI ${film.title}: ${(err as Error).message}`);
    }
  }

  console.log(`Güncellenen film   : ${updated}`);
  console.log(`Doldurulan oyuncu  : ${filledEntries}`);
  console.log(`Başarısız istek    : ${failed}`);
}

/**
 * FAZ 2 — bulmaca seçeneklerine rol adı yazar ve 4 seçeneğe indirir.
 */
async function fixPuzzles(films: FilmRow[]): Promise<void> {
  console.log(`\n── FAZ 2: daily_puzzles (imposter) ──`);

  /** tmdb_id → (isim → rol) : roundun KENDİ filmindeki roller */
  const byFilm = new Map<number, Map<string, string>>();
  /** isim → rol : sahtekârlar için "başka filmdeki rolü" */
  const global = new Map<string, string>();

  for (const f of films) {
    const perFilm = new Map<string, string>();
    for (const actor of f.cast_json ?? []) {
      if (!actor.name || !actor.character) continue;
      const key = actor.name.toLowerCase();
      perFilm.set(key, actor.character);
      if (!global.has(key)) global.set(key, actor.character);
    }
    if (f.tmdb_id != null) byFilm.set(f.tmdb_id, perFilm);
  }
  console.log(`Rol haritası: ${global.size} benzersiz oyuncu`);

  const { data: puzzles, error } = await supabase
    .from('daily_puzzles')
    .select('id, date, puzzle_data')
    .eq('game_type', 'imposter')
    .order('date', { ascending: true });

  if (error) throw error;
  if (!puzzles?.length) {
    console.log('Imposter bulmacası bulunamadı.');
    return;
  }

  let totalOptions = 0;
  let charFilled = 0;
  let charMissing = 0;
  let trimmedOptions = 0;
  let rowsChanged = 0;
  let skippedTrim = 0;

  for (const row of puzzles as PuzzleRow[]) {
    const rounds = row.puzzle_data?.rounds;
    if (!Array.isArray(rounds)) {
      console.warn(`  ${row.date}: rounds yok, atlanıyor`);
      continue;
    }

    let rowChanges = 0;

    for (const round of rounds) {
      const roundMap = round.tmdb_id != null ? byFilm.get(round.tmdb_id) : undefined;

      // (a) Rol adları — boş kalmamalı
      for (const option of round.options ?? []) {
        totalOptions++;
        if (option.character) continue;

        const key = option.name?.toLowerCase() ?? '';
        /*
         * Sıra: roundun KENDİ filmi (gerçek oyuncu, doğru rol) → veritabanındaki
         * başka bir film (sahtekâr, "oynadığı diğer filmdeki rol") → TMDb kişi
         * araması (veritabanında hiç kaydı olmayan oyuncu). Sahtekârın rolü
         * boş kalamaz; boş satır cevabı ele verir.
         */
        let character = roundMap?.get(key) ?? global.get(key) ?? null;
        if (!character && !SKIP_TMDB) {
          character = await fetchCharacterFromPerson(option.name ?? '');
          // Bulunanı haritaya yaz — aynı oyuncu başka bulmacada da geçebilir
          if (character && key) global.set(key, character);
        }

        if (character) {
          option.character = character;
          charFilled++;
          rowChanges++;
        } else {
          charMissing++;
          console.warn(`  ${row.date} round ${round.round}: rol bulunamadı — ${option.name}`);
        }
      }

      /*
       * Sözleşme kontrolü: istemci, tek bir seçenekte bile rol adı eksikse rol
       * satırını TÜM kartlarda gizler. Yani eksik kalan round sessizce bozulmaz,
       * yalnızca ipucu katmanını kaybeder — ama bunu bilerek raporluyoruz.
       */
      const stillMissing = (round.options ?? []).filter((o) => !o.character);
      if (stillMissing.length > 0) {
        console.warn(
          `  ${row.date} round ${round.round}: ${stillMissing.length} seçenek rolsüz ` +
            `→ bu roundda rol satırı hiç gösterilmeyecek`,
        );
      }

      // (b) 4 seçeneğe indir — sahtekârlar korunur, gerçekler elenir
      const options = round.options ?? [];
      if (options.length <= MAX_OPTIONS) continue;

      const imposterIds = new Set(round.imposter_ids ?? []);
      if (imposterIds.size === 0) {
        // imposter_ids yoksa hangi seçeneğin cevap olduğu bilinemez → dokunma
        skippedTrim++;
        console.warn(`  ${row.date} round ${round.round}: imposter_ids yok, eleme atlandı`);
        continue;
      }

      const imposters = options.filter((o) => imposterIds.has(o.id));
      const reals = options.filter((o) => !imposterIds.has(o.id));
      if (imposters.length > MAX_OPTIONS) {
        skippedTrim++;
        console.warn(`  ${row.date} round ${round.round}: ${imposters.length} sahtekâr, eleme atlandı`);
        continue;
      }

      const keptReals = reals.slice(0, MAX_OPTIONS - imposters.length);
      // Sıra sabit kalsın: orijinal dizilimi koru, yalnız elenenleri çıkar
      const kept = new Set([...imposters, ...keptReals]);
      const next = options.filter((o) => kept.has(o));

      trimmedOptions += options.length - next.length;
      round.options = next;
      rowChanges++;
    }

    if (rowChanges === 0) continue;
    rowsChanged++;
    console.log(`  ${row.date}: ${rowChanges} değişiklik`);

    if (APPLY) {
      // YALNIZCA puzzle_data — id/solution_ref/imposter_ids/theme_matched korunur
      const { error: upErr } = await supabase
        .from('daily_puzzles')
        .update({ puzzle_data: row.puzzle_data })
        .eq('id', row.id);
      if (upErr) throw new Error(`${row.date} güncellenemedi: ${upErr.message}`);
    }
  }

  console.log(`Bulmaca            : ${puzzles.length} (değişen: ${rowsChanged})`);
  console.log(`Toplam seçenek     : ${totalOptions}`);
  console.log(`Rol adı dolduruldu : ${charFilled}`);
  console.log(`Rol adı bulunamadı : ${charMissing}`);
  console.log(`Elenen seçenek     : ${trimmedOptions}`);
  console.log(`Elenemeyen round   : ${skippedTrim}`);
}

async function main() {
  console.log(APPLY ? '── UYGULAMA MODU ──' : '── DRY-RUN (yazma yok) ──');

  if (!SKIP_TMDB) {
    // Ağ engelini en başta yakala — 1000+ filmi boşuna dolaşma
    await ensureTmdbReachable();
  }

  const films = await fetchAllFilms();
  console.log(`Kadrosu olan film: ${films.length}`);

  if (!SKIP_TMDB) {
    await fillFilmCharacters(films);
  } else {
    console.log('\n── FAZ 1 atlandı (--skip-tmdb) ──');
  }

  await fixPuzzles(films);

  if (!APPLY) console.log('\nYazmak için: --apply');
}

main().catch((err) => {
  console.error('Backfill başarısız:', err);
  process.exit(1);
});
