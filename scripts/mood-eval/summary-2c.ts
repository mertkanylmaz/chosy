/**
 * MOOD-VEC-2c özet raporu: V0 (v3 hattı) ↔ V3 (v2 parse + match_films_v4 + rerank 40→4).
 * Yalnız ölçülen sayılar — puanlama YOK. Çıktı: summary-2c.md, rating-top4.csv (OUT_DIR).
 *
 * Kullanım: MOOD_EVAL_OUT=docs/investigations/mood-vec-2c/eval npx tsx scripts/mood-eval/summary-2c.ts
 * Önkoşul: run.ts --variant V0,V3 tamamlanmış; films-meta.json run.ts'in rapor adımında dolar.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  LEGACY_PARSED_DIR, META_FILE, OUT_DIR, PARSED_DIR, PARSED_V2_DIR,
  computeFinal, loadMoods, rawFile, readJson,
  type FilmMeta, type Mood, type ParsedFile, type RawRecord, type Row, type Variant,
} from './common';

const TOP_N = 4;

interface Item {
  mood: Mood;
  rec: RawRecord;
  top: Row[];
  parseMs: number | null;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
const fmt = (n: number | null, d = 0): string => (n === null ? '—' : n.toFixed(d));
const pct = (n: number | null): string => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
const csv = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function table(headers: string[], rows: string[][]): string {
  const line = (r: string[]): string => `| ${r.join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

function load(v: Variant, moods: Mood[]): Item[] {
  const items: Item[] = [];
  for (const mood of moods) {
    const f = rawFile(mood.id, v);
    if (!fs.existsSync(f)) continue;
    const rec = readJson<RawRecord>(f);
    const dirs = v === 'V3' ? [PARSED_V2_DIR] : [PARSED_DIR, LEGACY_PARSED_DIR];
    let parseMs: number | null = null;
    for (const d of dirs) {
      const pf = path.join(d, `${mood.id}.json`);
      if (fs.existsSync(pf)) {
        parseMs = readJson<ParsedFile>(pf).ms;
        break;
      }
    }
    items.push({ mood, rec, top: computeFinal(rec).top.slice(0, TOP_N), parseMs });
  }
  return items;
}

const meta: Record<string, FilmMeta> = fs.existsSync(META_FILE) ? readJson<Record<string, FilmMeta>>(META_FILE) : {};
const votesOf = (id: string): number | null => {
  const v = meta[id]?.imdb_votes ?? null;
  return v === null || v === 0 ? null : v;
};

function timing(items: Item[]): string[][] {
  const col = (pick: (i: Item) => number | null): number[] =>
    items.map(pick).filter((x): x is number => x !== null);
  const rows: [string, number[]][] = [
    ['parse', col((i) => i.parseMs)],
    ['RPC (toplam deneme)', col((i) => i.rec.rpc.total_ms)],
    ['rerank', col((i) => i.rec.rerank?.ms ?? null)],
    ['toplam (parse+RPC+rerank)', col((i) => (i.parseMs !== null && i.rec.rerank ? i.parseMs + i.rec.rpc.total_ms + i.rec.rerank.ms : null))],
  ];
  return rows.map(([name, vals]) => [name, String(vals.length), fmt(percentile(vals, 0.5)), fmt(percentile(vals, 0.9))]);
}

function stats(items: Item[]): {
  votesMed: number | null; lt100: number | null; nulls: number; slots: number; pre1970: number;
  genres: Map<string, number>; repeats: { title: string; year: number | null; moods: number }[]; distinct: number;
  channels: Map<string, number>; channelOnly: Map<string, number>;
} {
  const votes: number[] = [];
  let nulls = 0;
  let slots = 0;
  let pre1970 = 0;
  const genres = new Map<string, number>();
  const count = new Map<string, { title: string; year: number | null; moods: number }>();
  const channels = new Map<string, number>();
  const channelOnly = new Map<string, number>();
  for (const it of items) {
    for (const r of it.top) {
      slots += 1;
      const v = votesOf(r.id);
      if (v === null) nulls += 1;
      else votes.push(v);
      if (r.year !== null && r.year < 1970) pre1970 += 1;
      for (const g of r.genres ?? []) genres.set(g, (genres.get(g) ?? 0) + 1);
      const c = count.get(r.id) ?? { title: r.title, year: r.year, moods: 0 };
      c.moods += 1;
      count.set(r.id, c);
      const chs = r.channels ?? [];
      for (const ch of chs) channels.set(ch, (channels.get(ch) ?? 0) + 1);
      if (chs.length > 0) {
        const key = [...chs].sort().join('+');
        channelOnly.set(key, (channelOnly.get(key) ?? 0) + 1);
      }
    }
  }
  return {
    votesMed: percentile(votes, 0.5),
    lt100: votes.length ? votes.filter((x) => x < 100_000).length / votes.length : null,
    nulls, slots, pre1970, genres,
    repeats: [...count.values()].filter((c) => c.moods >= 3).sort((a, b) => b.moods - a.moods),
    distinct: count.size, channels, channelOnly,
  };
}

function main(): void {
  const moods = loadMoods();
  const v0 = load('V0', moods);
  const v3 = load('V3', moods);
  if (v0.length === 0 || v3.length === 0) throw new Error(`V0=${v0.length} V3=${v3.length} mood; önce run.ts çalışmalı.`);
  const both = new Set(v0.map((i) => i.mood.id).filter((id) => v3.some((i) => i.mood.id === id)));
  const a = stats(v0.filter((i) => both.has(i.mood.id)));
  const b = stats(v3.filter((i) => both.has(i.mood.id)));

  const out: string[] = [];
  out.push('# MOOD-VEC-2c eval özeti — V0 ↔ V3', '');
  out.push(`Mood sayısı (ikisinde de tamamlanan): ${both.size}. Ölçüt: kalite süzgeci sonrası ilk ${TOP_N} film. Puanlama yok; fit/recognizable elle, rating-top4.csv'de.`, '');

  out.push('## Tanınırlık ve eskilik', '');
  out.push(table(['ölçüt', 'V0', 'V3'], [
    ['imdb_votes medyan (0/NULL hariç)', fmt(a.votesMed), fmt(b.votesMed)],
    ['< 100k oy payı', pct(a.lt100), pct(b.lt100)],
    ['imdb_votes NULL/0 slot', `${a.nulls}/${a.slots}`, `${b.nulls}/${b.slots}`],
    ['1970 öncesi film', `${a.pre1970}/${a.slots}`, `${b.pre1970}/${b.slots}`],
    ['tekil film sayısı', String(a.distinct), String(b.distinct)],
  ]), '');

  out.push('## Tekrar eden filmler (≥3 moodda)', '');
  out.push(table(['', 'film sayısı', 'filmler'], [
    ['V0', String(a.repeats.length), a.repeats.map((r) => `${r.title} (${r.year ?? '?'}) ×${r.moods}`).join('; ') || '—'],
    ['V3', String(b.repeats.length), b.repeats.map((r) => `${r.title} (${r.year ?? '?'}) ×${r.moods}`).join('; ') || '—'],
  ]), '');

  out.push('## Tür payı (ilk 4, film başına tüm türler)', '');
  const allGenres = [...new Set([...a.genres.keys(), ...b.genres.keys()])]
    .sort((x, y) => (b.genres.get(y) ?? 0) + (a.genres.get(y) ?? 0) - (b.genres.get(x) ?? 0) - (a.genres.get(x) ?? 0));
  out.push(table(['tür', 'V0', 'V3'], allGenres.slice(0, 15).map((g) => [
    g,
    pct((a.genres.get(g) ?? 0) / Math.max(1, a.slots)),
    pct((b.genres.get(g) ?? 0) / Math.max(1, b.slots)),
  ])), '');

  out.push('## Süreler (ms) — p50 / p90', '');
  const t0 = timing(v0.filter((i) => both.has(i.mood.id)));
  const t3 = timing(v3.filter((i) => both.has(i.mood.id)));
  out.push(table(['aşama', 'n (V0)', 'V0 p50', 'V0 p90', 'n (V3)', 'V3 p50', 'V3 p90'],
    t0.map((r, i) => [r[0], r[1], r[2], r[3], t3[i][1], t3[i][2], t3[i][3]])), '');
  out.push('_Parse süreleri istemciden uca ölçülür. V0 parse süresi mood-vec-1 önbelleğinden gelir (eski koşu)._', '');

  out.push('## V3 kanal dağılımı (ilk 4)', '');
  const chRows = ['v', 'a', 'c'].map((ch) => [ch, String(b.channels.get(ch) ?? 0), pct((b.channels.get(ch) ?? 0) / Math.max(1, b.slots))]);
  out.push(table(['kanal (çoklu sayılır)', 'slot', 'pay'], chRows), '');
  out.push(table(['kanal birleşimi', 'slot', 'pay'],
    [...b.channelOnly.entries()].sort((x, y) => y[1] - x[1]).map(([k, n]) => [k, String(n), pct(n / Math.max(1, b.slots))])), '');

  const rerankFallbacks = v3.filter((i) => i.rec.rerank?.server_fallback).length;
  const noRerank = v3.filter((i) => !i.rec.rerank).length;
  out.push('## V3 notları', '');
  out.push(`- rerank sunucu fallback: ${rerankFallbacks}/${v3.length}, rerank kaydı olmayan: ${noRerank}`);
  out.push(`- rerank > 6 sn (uygulama zaman aşımı): ${v3.filter((i) => i.rec.rerank?.exceeded_app_timeout).length}`);
  out.push(`- RPC satır sayısı medyan: ${fmt(percentile(v3.map((i) => i.rec.rpc.rows.length), 0.5))}`, '');

  fs.writeFileSync(path.join(OUT_DIR, 'summary-2c.md'), out.join('\n') + '\n');

  const head = ['mood_id', 'mood_text', 'rank', 'film_id', 'title', 'year', 'runtime', 'genres', 'channels', 'imdb_votes', 'gerekce', 'fit', 'recognizable', 'notes'];
  const lines = [head.join(',')];
  for (const it of v3) {
    const reasons = it.rec.rerank?.reasons ?? {};
    it.top.forEach((r, i) => {
      lines.push([
        it.mood.id, it.mood.text, i + 1, r.id, r.title, r.year, r.runtime, (r.genres ?? []).join('/'),
        (r.channels ?? []).join('+'), votesOf(r.id), reasons[r.id] ?? '', '', '', '',
      ].map(csv).join(','));
    });
  }
  fs.writeFileSync(path.join(OUT_DIR, 'rating-top4.csv'), lines.join('\n') + '\n');
  console.log(`summary-2c.md ve rating-top4.csv yazıldı (${OUT_DIR})`);
}

main();
