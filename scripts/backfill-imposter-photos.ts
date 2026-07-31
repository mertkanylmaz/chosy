/**
 * Mevcut Imposter bulmacalarına oyuncu fotoğraflarını geriye dönük ekler.
 *
 * NEDEN GEREKLİ
 * `generate-puzzles` seçenekleri kurarken `actor.profile_path` okuyordu, ama
 * `cast_json`'ı dolduran scriptler (`enrich-films.ts`, `enrich-films-metadata.ts`)
 * `profile_url` yazıyor. Üretim verisinde 1958 aktör kaydının tamamında
 * `profile_url` var, hiçbirinde `profile_path` yok — yani alan her zaman null
 * kalıyordu ve istemci fotoğraf yerine baş harf kartı çiziyordu.
 * Fonksiyon düzeltildi (30 Tem 2026) ama ZATEN ÜRETİLMİŞ bulmacalar fotoğrafsız.
 *
 * NEDEN SİLİP YENİDEN ÜRETMİYORUZ
 * `game_scores.puzzle_id → daily_puzzles(id) ON DELETE CASCADE`
 * (016_game_tables.sql:20). Oynanmış bir bulmacayı silmek o günü oynayan
 * HERKESİN skorunu, serisini ve XP'sini siler. Bunun yerine yalnızca
 * `puzzle_data` güncellenir: `id`, `solution_ref`, `imposter_ids` ve
 * `theme_matched` aynen korunur → FK sağlam, skorlar duruyor, çözüm değişmiyor.
 *
 * ÇÖZÜM SIZINTISI YOK (Hard Rule 1)
 * Yalnızca `options[].profile_path` dolduruluyor. Gerçek ve sahte aktörlerin
 * İKİSİ de fotoğraf taşır, dolayısıyla fotoğrafın varlığı ipucu vermez.
 * `imposter_ids` zaten `public_daily_puzzles` view'ı tarafından stripleniyor
 * (064_puzzle_view_strip_solution.sql).
 *
 * Kullanım:
 *   npx tsx scripts/backfill-imposter-photos.ts             # dry-run (varsayılan)
 *   npx tsx scripts/backfill-imposter-photos.ts --apply     # yazar
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APPLY = process.argv.includes('--apply');

interface CastMember {
  name: string;
  profile_path?: string | null;
  profile_url?: string | null;
}

interface ImposterOption {
  id: number;
  name: string;
  profile_path: string | null;
}

interface ImposterRound {
  round: number;
  options: ImposterOption[];
  [key: string]: unknown;
}

interface PuzzleRow {
  id: string;
  date: string;
  puzzle_data: { rounds?: ImposterRound[] } & Record<string, unknown>;
}

/** cast_json iki şekilde yazılmış — ikisini de kabul et */
function photoOf(actor: CastMember): string | null {
  return actor.profile_path ?? actor.profile_url ?? null;
}

/** İsim → fotoğraf haritası. Aktörler farklı filmlerden geldiği için global. */
async function buildPhotoMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const PAGE = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('films')
      .select('cast_json')
      .not('cast_json', 'is', null)
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const cast = row.cast_json as CastMember[] | null;
      if (!Array.isArray(cast)) continue;
      for (const actor of cast) {
        if (!actor?.name) continue;
        const photo = photoOf(actor);
        const key = actor.name.toLowerCase();
        if (photo && !map.has(key)) map.set(key, photo);
      }
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return map;
}

async function main() {
  console.log(APPLY ? '── UYGULAMA MODU ──' : '── DRY-RUN (yazma yok) ──');

  const photoMap = await buildPhotoMap();
  console.log(`Fotoğraf haritası: ${photoMap.size} benzersiz aktör`);

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
  let alreadyHad = 0;
  let filled = 0;
  let stillMissing = 0;
  let rowsChanged = 0;

  for (const row of puzzles as PuzzleRow[]) {
    const rounds = row.puzzle_data?.rounds;
    if (!Array.isArray(rounds)) {
      console.warn(`  ${row.date}: rounds yok, atlanıyor`);
      continue;
    }

    let rowFilled = 0;

    for (const round of rounds) {
      for (const option of round.options ?? []) {
        totalOptions++;
        if (option.profile_path) {
          alreadyHad++;
          continue;
        }
        const photo = photoMap.get(option.name?.toLowerCase() ?? '');
        if (photo) {
          option.profile_path = photo;
          filled++;
          rowFilled++;
        } else {
          stillMissing++;
        }
      }
    }

    if (rowFilled === 0) continue;
    rowsChanged++;
    console.log(`  ${row.date}: ${rowFilled} fotoğraf dolduruldu`);

    if (APPLY) {
      // YALNIZCA puzzle_data — id/solution_ref/imposter_ids/theme_matched korunur
      const { error: upErr } = await supabase
        .from('daily_puzzles')
        .update({ puzzle_data: row.puzzle_data })
        .eq('id', row.id);
      if (upErr) throw new Error(`${row.date} güncellenemedi: ${upErr.message}`);
    }
  }

  const pct = totalOptions ? Math.round(((alreadyHad + filled) / totalOptions) * 100) : 0;
  console.log('\n── ÖZET ──');
  console.log(`Bulmaca            : ${puzzles.length} (değişen: ${rowsChanged})`);
  console.log(`Toplam seçenek     : ${totalOptions}`);
  console.log(`Zaten fotoğraflı   : ${alreadyHad}`);
  console.log(`Dolduruldu         : ${filled}`);
  console.log(`Hâlâ eksik         : ${stillMissing}`);
  console.log(`Kapsam sonrası     : %${pct}`);
  if (!APPLY) console.log('\nYazmak için: --apply');
}

main().catch((err) => {
  console.error('Backfill başarısız:', err);
  process.exit(1);
});
