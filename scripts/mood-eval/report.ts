/**
 * MOOD-VEC-1 raporları: results.json, rating-sheet.csv, summary.md.
 * Yalnız ölçülen sayılar — puanlama ve kalite yorumu YOK.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  META_FILE, OUT_DIR, PARSED_DIR, VARIANTS,
  computeFinal, computeRpcOrderTop, loadMoods, rawFile, readJson, writeJson,
  type FilmMeta, type Ledger, type Mood, type ParsedFile, type RawRecord, type Row, type Variant, LEDGER_FILE,
} from './common';
import type { EvalSession } from './session';

// ─── İstatistik yardımcıları ─────────────────────────────────────────────────

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
const median = (v: number[]): number | null => percentile(v, 0.5);
const mean = (v: number[]): number | null => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const fmt = (n: number | null, d = 1): string => (n === null ? '—' : n.toFixed(d));
const pct = (n: number | null): string => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

function table(headers: string[], rows: string[][]): string {
  const line = (r: string[]): string => `| ${r.join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

// ─── Film meta (imdb_rating / imdb_votes) ────────────────────────────────────

async function loadMeta(session: EvalSession, ids: string[]): Promise<Record<string, FilmMeta>> {
  const meta: Record<string, FilmMeta> = fs.existsSync(META_FILE) ? readJson<Record<string, FilmMeta>>(META_FILE) : {};
  const missing = ids.filter((id) => !(id in meta));
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    const { data, error } = await session.supabase.from('films').select('id, imdb_rating, imdb_votes').in('id', chunk);
    if (error || !data) throw new Error(`films meta okunamadı (RLS?): ${error?.message ?? 'veri yok'}`);
    for (const r of data as { id: string; imdb_rating: number | null; imdb_votes: number | null }[]) {
      meta[r.id] = { imdb_rating: r.imdb_rating, imdb_votes: r.imdb_votes };
    }
    const got = new Set((data as { id: string }[]).map((r) => r.id));
    const gone = chunk.filter((id) => !got.has(id));
    if (gone.length > 0) throw new Error(`films satırı dönmedi (RLS/silinmiş?): ${gone.slice(0, 5).join(', ')} … (${gone.length})`);
  }
  writeJson(META_FILE, meta);
  return meta;
}

// ─── Segmentler ──────────────────────────────────────────────────────────────

type Seg = 'tümü' | 'quick' | 'serbest' | 'EN' | 'TR';
const SEGS: Seg[] = ['tümü', 'quick', 'serbest', 'EN', 'TR'];
const inSeg = (m: Mood, s: Seg): boolean =>
  s === 'tümü' || (s === 'quick' && m.kind === 'quick') || (s === 'serbest' && m.kind === 'free') ||
  (s === 'EN' && m.lang === 'en') || (s === 'TR' && m.lang === 'tr');

interface Item {
  mood: Mood;
  parsed: ParsedFile | null;
  rec: RawRecord;
  top: Row[];
}

const votesOf = (id: string, meta: Record<string, FilmMeta>): number | null => {
  const v = meta[id]?.imdb_votes ?? null;
  return v === null || v === 0 ? null : v; // imdb_votes = 0 → NULL (kirli kolon notu)
};

const decade = (y: number | null): number | null => (y === null ? null : Math.floor(y / 10) * 10);

function recognizability(items: Item[], n: number, meta: Record<string, FilmMeta>): { med: number | null; lt100: number | null; lt50: number | null; nulls: number; total: number } {
  const votes: number[] = [];
  let nulls = 0;
  let total = 0;
  for (const it of items) {
    for (const r of it.top.slice(0, n)) {
      total += 1;
      const v = votesOf(r.id, meta);
      if (v === null) nulls += 1;
      else votes.push(v);
    }
  }
  return {
    med: median(votes),
    lt100: votes.length ? votes.filter((v) => v < 100_000).length / votes.length : null,
    lt50: votes.length ? votes.filter((v) => v < 50_000).length / votes.length : null,
    nulls,
    total,
  };
}

function repeats(items: Item[], n: number): { films: { title: string; year: number | null; moods: number }[]; distinct: number; slotShare: number | null } {
  const count = new Map<string, { title: string; year: number | null; moods: number }>();
  let slots = 0;
  for (const it of items) {
    for (const r of it.top.slice(0, n)) {
      slots += 1;
      const c = count.get(r.id) ?? { title: r.title, year: r.year, moods: 0 };
      c.moods += 1;
      count.set(r.id, c);
    }
  }
  const rep = [...count.values()].filter((c) => c.moods >= 3).sort((a, b) => b.moods - a.moods);
  const repSlots = rep.reduce((s, c) => s + c.moods, 0);
  return { films: rep, distinct: count.size, slotShare: slots ? repSlots / slots : null };
}

// ─── Ana ─────────────────────────────────────────────────────────────────────

export async function buildReports(session: EvalSession): Promise<void> {
  const moods = loadMoods();
  const ledger: Ledger | null = fs.existsSync(LEDGER_FILE) ? readJson<Ledger>(LEDGER_FILE) : null;

  const parsedBy = new Map<string, ParsedFile>();
  const recs = new Map<string, RawRecord>(); // `${mood}|${variant}`
  for (const m of moods) {
    const pf = path.join(PARSED_DIR, `${m.id}.json`);
    if (fs.existsSync(pf)) parsedBy.set(m.id, readJson<ParsedFile>(pf));
    for (const v of VARIANTS) {
      const f = rawFile(m.id, v);
      if (fs.existsSync(f)) recs.set(`${m.id}|${v}`, readJson<RawRecord>(f));
    }
  }
  if (recs.size === 0) {
    console.log('Rapor için ham kayıt yok.');
    return;
  }

  const allIds = new Set<string>();
  for (const r of recs.values()) for (const row of r.rpc.rows) allIds.add(row.id);
  const meta = await loadMeta(session, [...allIds]);

  // Varyant tamamlanma: RPC var ve (rerank var ya da aday yok)
  const complete = (r: RawRecord): boolean => r.rpc.rows.length === 0 || !!r.rerank;
  const itemsOf = (v: Variant, finalMode: boolean): Item[] => {
    const out: Item[] = [];
    for (const m of moods) {
      const rec = recs.get(`${m.id}|${v}`);
      if (!rec || (finalMode && !complete(rec))) continue;
      out.push({ mood: m, parsed: parsedBy.get(m.id) ?? null, rec, top: finalMode ? computeFinal(rec).top : computeRpcOrderTop(rec) });
    }
    return out;
  };

  // results.json
  writeJson(path.join(OUT_DIR, 'results.json'), {
    generated_at: new Date().toISOString(),
    moods: moods.map((m) => ({
      ...m,
      parse: parsedBy.get(m.id) ?? null,
      variants: Object.fromEntries(VARIANTS.map((v) => {
        const rec = recs.get(`${m.id}|${v}`);
        if (!rec) return [v, null];
        const f = computeFinal(rec);
        return [v, {
          rpc: rec.rpc,
          rerank: rec.rerank ?? null,
          rerank_applied: f.rerankApplied,
          final_top_ids: f.top.map((r) => r.id),
          rpc_order_top_ids: computeRpcOrderTop(rec).map((r) => r.id),
        }];
      })),
    })),
    ledger,
  });

  // rating-sheet.csv
  const q = (x: unknown): string => {
    const s = x === null || x === undefined ? '' : String(x);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['mood_id', 'variant', 'rank', 'film_id', 'title', 'year', 'vote_average', 'imdb_rating', 'imdb_votes',
    'runtime', 'genres', 'director', 'similarity', 'rerank_rank', 'fit', 'recognizable', 'notes'];
  const lines = [header.join(',')];
  for (const m of moods) {
    for (const v of VARIANTS) {
      const rec = recs.get(`${m.id}|${v}`);
      if (!rec || !complete(rec)) continue;
      const f = computeFinal(rec);
      f.top.slice(0, 8).forEach((r, i) => {
        lines.push([
          m.id, v, i + 1, r.id, r.title, r.year, r.vote_average, meta[r.id]?.imdb_rating ?? '', meta[r.id]?.imdb_votes ?? '',
          r.runtime, (r.genres ?? []).join('|'), r.director, r.similarity.toFixed(4), f.rerankRank.get(r.id) ?? '', '', '', '',
        ].map(q).join(','));
      });
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'rating-sheet.csv'), lines.join('\n') + '\n');

  // summary.md
  const out: string[] = ['# MOOD-VEC-1 — otomatik metrikler', '', 'Yalnız ölçülen sayılar; puanlama ve kalite yorumu içermez.', ''];
  const doneV = VARIANTS.filter((v) => itemsOf(v, true).length > 0);
  const pending = VARIANTS.map((v) => {
    const have = moods.filter((m) => recs.has(`${m.id}|${v}`)).length;
    const done = itemsOf(v, true).length;
    return `${v}: RPC ${have}/${moods.length}, rerank tamam ${done}/${moods.length}`;
  });
  out.push('## Kapsam', '', ...pending.map((p) => `- ${p}`));
  const parseCount = parsedBy.size;
  out.push(`- parse: ${parseCount}/${moods.length}`);
  if (ledger) {
    out.push(`- defter: parse=${ledger.parse_total}, rerank=${ledger.rerank_total}, UTC gün başına rerank=${JSON.stringify(ledger.rerank_by_day)}`);
    out.push(`- mood_searches'a yazılan satır (parse yanıtındaki search_id): ${ledger.mood_searches_rows.length}`);
  }
  const limits = [...new Set([...parsedBy.values()].map((p) => String(p.limit)))];
  out.push(`- parse yanıtı \`limit\` değerleri: ${limits.join(', ') || '—'}`);
  out.push('', 'Not: `imdb_votes` kolonu kirlidir (OMDb ve TMDb karışık); `0` değeri NULL sayıldı ve oranlardan düşüldü.', '');

  // Süreler
  out.push('## Süre (ms, p50 / p90)', '');
  const parseTimes = (segm: Seg): number[] => moods.filter((m) => inSeg(m, segm) && parsedBy.has(m.id)).map((m) => parsedBy.get(m.id)!.ms);
  out.push(table(['segment', 'n', 'parse p50', 'parse p90'], SEGS.map((s) => {
    const t = parseTimes(s);
    return [s, String(t.length), fmt(median(t), 0), fmt(percentile(t, 0.9), 0)];
  })), '');
  for (const v of VARIANTS) {
    const all = itemsOf(v, false);
    if (all.length === 0) continue;
    out.push(`### ${v} süre`, '');
    const rows: string[][] = [];
    for (const s of SEGS) {
      const its = all.filter((it) => inSeg(it.mood, s));
      const rpcTot = its.map((i) => i.rec.rpc.total_ms);
      const rpcAtt = its.flatMap((i) => i.rec.rpc.attempts.map((a) => a.ms));
      const rr = its.filter((i) => i.rec.rerank && !i.rec.rerank.cached).map((i) => i.rec.rerank!.ms);
      const rrAll = its.filter((i) => i.rec.rerank).map((i) => i.rec.rerank!.ms);
      const totals = its.filter((i) => i.rec.rerank && i.parsed).map((i) => i.parsed!.ms + i.rec.rpc.total_ms + i.rec.rerank!.ms);
      const f = (xs: number[]): string => `${fmt(median(xs), 0)} / ${fmt(percentile(xs, 0.9), 0)}`;
      rows.push([s, String(its.length), f(rpcAtt), f(rpcTot), f(rrAll), String(rr.length), f(totals)]);
    }
    out.push(table(['segment', 'n', 'RPC deneme', 'RPC toplam', 'rerank', 'rerank (canlı çağrı n)', 'toplam (parse+RPC+rerank)'], rows), '');
    const slow = itemsOf(v, true).filter((i) => i.rec.rerank?.exceeded_app_timeout).length;
    const nRpcAttempts = all.map((i) => i.rec.rpc.attempts.length);
    out.push(`- uygulamanın 6 sn rerank zaman aşımını aşan: ${slow}; ortalama RPC deneme sayısı: ${fmt(mean(nRpcAttempts), 2)}; sunucu fallback (rerank uygulanmadı): ${itemsOf(v, true).filter((i) => !computeFinal(i.rec).rerankApplied).length}`, '');
  }

  // Metrikler (final liste)
  for (const v of doneV) {
    const all = itemsOf(v, true);
    out.push(`## ${v} — bilinirlik / çeşitlilik / tekrar (rerank + kalite süzgeci sonrası)`, '');
    const rows: Record<string, string[]> = {};
    const put = (k: string, s: Seg, val: string): void => { (rows[k] ??= []).push(val); void s; };
    for (const s of SEGS) {
      const its = all.filter((it) => inSeg(it.mood, s));
      const r4 = recognizability(its, 4, meta);
      const r8 = recognizability(its, 8, meta);
      put('n mood', s, String(its.length));
      put('imdb_votes medyan, ilk 4', s, fmt(r4.med, 0));
      put('imdb_votes medyan, ilk 8', s, fmt(r8.med, 0));
      put('<100 bin oy, ilk 4', s, pct(r4.lt100));
      put('<100 bin oy, ilk 8', s, pct(r8.lt100));
      put('<50 bin oy, ilk 4', s, pct(r4.lt50));
      put('<50 bin oy, ilk 8', s, pct(r8.lt50));
      put('oy bilgisi yok (NULL/0), ilk 8', s, `${r8.nulls}/${r8.total}`);
      const dec = its.map((i) => new Set(i.top.slice(0, 4).map((r) => decade(r.year)).filter((d) => d !== null)).size);
      put('farklı on yıl, ilk 4 (ort.)', s, fmt(mean(dec), 2));
      const topGenre = its.map((i) => {
        const four = i.top.slice(0, 4);
        if (four.length === 0) return 0;
        const c = new Map<string, number>();
        for (const r of four) for (const g of new Set(r.genres ?? [])) c.set(g, (c.get(g) ?? 0) + 1);
        return Math.max(0, ...c.values()) / four.length;
      });
      put('en sık türün payı, ilk 4 (ort.)', s, pct(mean(topGenre)));
      const rp4 = repeats(its, 4);
      const rp8 = repeats(its, 8);
      put('≥3 moodda görünen film, ilk 4 (adet / slot payı)', s, `${rp4.films.length} / ${pct(rp4.slotShare)}`);
      put('≥3 moodda görünen film, ilk 8 (adet / slot payı)', s, `${rp8.films.length} / ${pct(rp8.slotShare)}`);
      put('pre-1970 film, ilk 4 (toplam)', s, String(its.reduce((n, i) => n + i.top.slice(0, 4).filter((r) => (r.year ?? 9999) < 1970).length, 0)));
      put('pre-1970 film, ilk 8 (toplam)', s, String(its.reduce((n, i) => n + i.top.slice(0, 8).filter((r) => (r.year ?? 9999) < 1970).length, 0)));
    }
    out.push(table(['metrik', ...SEGS], Object.entries(rows).map(([k, cells]) => [k, ...cells])), '');
    const all4 = repeats(all, 4);
    const all8 = repeats(all, 8);
    out.push(`**≥3 moodda ilk 4'te görünen filmler (${v}, tümü):** ${all4.films.map((f) => `${f.title} (${f.year ?? '?'}) ×${f.moods}`).join('; ') || 'yok'}`, '');
    out.push(`**≥3 moodda ilk 8'de görünen filmler (${v}, tümü):** ${all8.films.map((f) => `${f.title} (${f.year ?? '?'}) ×${f.moods}`).join('; ') || 'yok'}`, '');
    out.push(`(TR segmentinde 3 mood vardır; "≥3 mood" eşiği orada yalnız hepsinde görünen filmi yakalar.)`, '');
  }

  // Karşılaştırmalar
  const cmp = (a: Variant, b: Variant, finalMode: boolean, n: number): { rows: string[][]; sum: number; slots: number } => {
    const A = new Map(itemsOf(a, finalMode).map((i) => [i.mood.id, i]));
    const B = new Map(itemsOf(b, finalMode).map((i) => [i.mood.id, i]));
    const rows: string[][] = [];
    let sum = 0;
    let slots = 0;
    for (const s of SEGS) {
      const inter: number[] = [];
      for (const m of moods.filter((x) => inSeg(x, s))) {
        const ia = A.get(m.id);
        const ib = B.get(m.id);
        if (!ia || !ib) continue;
        const sb = new Set(ib.top.slice(0, n).map((r) => r.id));
        inter.push(ia.top.slice(0, n).filter((r) => sb.has(r.id)).length);
      }
      rows.push([s, String(inter.length), fmt(mean(inter), 2), pct(inter.length ? inter.reduce((x, y) => x + y, 0) / (inter.length * n) : null)]);
      if (s === 'tümü') { sum = inter.reduce((x, y) => x + y, 0); slots = inter.length * n; }
    }
    return { rows, sum, slots };
  };

  out.push('## Era etkisi (V0 ↔ V1: vektörde era segmenti sıfırlanmış)', '');
  const e0 = cmp('V0', 'V1', true, 4);
  out.push(e0.slots ? '### İlk 4 kesişimi (rerank + süzgeç sonrası)' : '_V1 rerank henüz tamamlanmadı; final liste kesişimi yok._', '');
  if (e0.slots) out.push(table(['segment', 'n mood', 'ort. kesişim (/4)', 'oran'], e0.rows), '');
  const e1 = cmp('V0', 'V1', false, 4);
  if (e1.slots) {
    out.push('### İlk 4 kesişimi — RPC sırası (rerank ÖNCESİ, yalnız kalite süzgeci)', '', table(['segment', 'n mood', 'ort. kesişim (/4)', 'oran'], e1.rows), '');
  }
  out.push('### 1970 öncesi film sayısı (ilk 4 / ilk 8, tümü)', '');
  const preRows: string[][] = [];
  for (const v of ['V0', 'V1'] as Variant[]) {
    for (const mode of [true, false]) {
      const its = itemsOf(v, mode);
      if (its.length === 0) continue;
      const c = (n: number): number => its.reduce((s, i) => s + i.top.slice(0, n).filter((r) => (r.year ?? 9999) < 1970).length, 0);
      preRows.push([v, mode ? 'rerank sonrası' : 'RPC sırası', String(its.length), String(c(4)), String(c(8))]);
    }
  }
  out.push(table(['varyant', 'sıra', 'n mood', 'pre-1970 ilk 4', 'pre-1970 ilk 8'], preRows), '');

  out.push('## Rerank aday etkisi (V0 ↔ V2: 30 aday/150 kr ↔ 20 aday/100 kr)', '');
  const v02 = cmp('V0', 'V2', true, 4);
  if (v02.slots) {
    out.push(table(['segment', 'n mood', 'ort. kesişim (/4)', 'oran'], v02.rows), '');
    const A = new Map(itemsOf('V0', true).map((i) => [i.mood.id, i]));
    const B = new Map(itemsOf('V2', true).map((i) => [i.mood.id, i]));
    const diffs: number[] = [];
    const v0t: number[] = [];
    const v2t: number[] = [];
    for (const m of moods) {
      const a = A.get(m.id)?.rec.rerank;
      const b = B.get(m.id)?.rec.rerank;
      if (a && b) { diffs.push(a.ms - b.ms); v0t.push(a.ms); v2t.push(b.ms); }
    }
    out.push(table(['rerank süresi', 'p50', 'p90', 'ort.'], [
      ['V0 (ms)', fmt(median(v0t), 0), fmt(percentile(v0t, 0.9), 0), fmt(mean(v0t), 0)],
      ['V2 (ms)', fmt(median(v2t), 0), fmt(percentile(v2t, 0.9), 0), fmt(mean(v2t), 0)],
      ['V0 − V2 (ms, mood başına)', fmt(median(diffs), 0), fmt(percentile(diffs, 0.9), 0), fmt(mean(diffs), 0)],
    ]), '');
  } else {
    out.push('_V0 ve V2 birlikte tamamlanmadı._', '');
  }

  fs.writeFileSync(path.join(OUT_DIR, 'summary.md'), out.join('\n') + '\n');
  console.log(`Rapor yazıldı: ${OUT_DIR} (results.json, rating-sheet.csv, summary.md)`);
}
