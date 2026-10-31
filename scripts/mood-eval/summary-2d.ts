/**
 * MOOD-VEC-2d özet raporu: V3 (2c) ↔ V5 (V3 + önbellekli parse, 6 öneri, rerank 20 aday/15 kelime).
 * Yalnız ölçülen sayılar — puanlama YOK. Çıktı (OUT_DIR): summary-2d.md, changed-rows.csv, reasons-v4.csv.
 *
 * Kullanım (deploy + run.ts --variant V5 + run.ts --cached-pass sonrası):
 *   MOOD_EVAL_OUT=docs/investigations/mood-vec-2d/eval npx tsx scripts/mood-eval/summary-2d.ts
 * V3 verisi MOOD_EVAL_V3_DIR'den okunur (varsayılan docs/investigations/mood-vec-2c/eval).
 *
 * Hedefler (CTO): quick mood (önbellekli) toplam p50 ≤ 5 sn · serbest metin toplam p50 ≤ 8 sn ·
 * rerank p50 ≤ 3 sn. "Toplam" = parse + RPC + rerank istemci-uç ölçümleri toplamı.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  CACHED_PASS_DIR, OUT_DIR, PARSED_V4_DIR, computeFinal, loadMoods, readJson,
  type CachedPassRecord, type Mood, type ParsedFile, type RawRecord, type Row,
} from './common';

const TOP_N = 4;
const V3_DIR = path.resolve(process.env.MOOD_EVAL_V3_DIR ?? path.join(__dirname, '../../docs/investigations/mood-vec-2c/eval'));
const TARGETS = { quickCachedTotalP50: 5_000, freeTotalP50: 8_000, rerankP50: 3_000 } as const;

interface Timed {
  mood: Mood;
  parseMs: number;
  rpcMs: number;
  rerankMs: number | null;
  rerankLocalCached: boolean;
}

const total = (t: Timed): number | null => (t.rerankMs === null ? null : t.parseMs + t.rpcMs + t.rerankMs);

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
const fmt = (n: number | null): string => (n === null ? '—' : String(Math.round(n)));
const csv = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function table(headers: string[], rows: string[][]): string {
  const line = (r: string[]): string => `| ${r.join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

function loadRaw(dir: string, moodId: string, v: 'V3' | 'V5'): RawRecord | null {
  const f = path.join(dir, 'raw', `${moodId}.${v}.json`);
  return fs.existsSync(f) ? readJson<RawRecord>(f) : null;
}
function loadParseMs(dir: string, sub: string, moodId: string): number | null {
  const f = path.join(dir, sub, `${moodId}.json`);
  return fs.existsSync(f) ? readJson<ParsedFile>(f).ms : null;
}

function timedOf(mood: Mood, rec: RawRecord, parseMs: number): Timed {
  return {
    mood, parseMs, rpcMs: rec.rpc.total_ms,
    rerankMs: rec.rerank ? rec.rerank.ms : null,
    rerankLocalCached: rec.rerank?.cached === true,
  };
}

function timingRow(label: string, items: Timed[], target: number | null): string[] {
  const totals = items.map(total).filter((n): n is number => n !== null);
  const p50 = percentile(totals, 0.5);
  return [
    label, String(items.length),
    fmt(percentile(items.map((t) => t.parseMs), 0.5)),
    fmt(percentile(items.map((t) => t.rpcMs), 0.5)),
    fmt(percentile(items.map((t) => t.rerankMs).filter((n): n is number => n !== null), 0.5)),
    fmt(p50), fmt(percentile(totals, 0.9)),
    target === null ? '—' : p50 !== null && p50 <= target ? `GEÇTİ (≤${target})` : `GEÇMEDİ (>${target})`,
  ];
}

function main(): void {
  const moods = loadMoods();
  const v3: Timed[] = [];
  const v4: Timed[] = [];
  const cached: Timed[] = [];
  const topV3 = new Map<string, Row[]>();
  const topV4 = new Map<string, Row[]>();
  const recV4 = new Map<string, RawRecord>();
  const recV3 = new Map<string, RawRecord>();

  for (const mood of moods) {
    const r3 = loadRaw(V3_DIR, mood.id, 'V3');
    const p3 = loadParseMs(V3_DIR, 'parsed-v2', mood.id);
    if (r3 && p3 !== null) {
      v3.push(timedOf(mood, r3, p3));
      topV3.set(mood.id, computeFinal(r3).top.slice(0, TOP_N));
      recV3.set(mood.id, r3);
    }
    const r4 = loadRaw(OUT_DIR, mood.id, 'V5');
    const p4 = loadParseMs(OUT_DIR, path.relative(OUT_DIR, PARSED_V4_DIR), mood.id);
    if (r4 && p4 !== null) {
      v4.push(timedOf(mood, r4, p4));
      topV4.set(mood.id, computeFinal(r4).top.slice(0, TOP_N));
      recV4.set(mood.id, r4);
    }
    const cf = path.join(CACHED_PASS_DIR, `${mood.id}.json`);
    if (fs.existsSync(cf)) {
      const c = readJson<CachedPassRecord>(cf);
      cached.push({
        mood, parseMs: c.parse_ms, rpcMs: c.rpc.total_ms,
        rerankMs: c.rerank ? c.rerank.ms : null, rerankLocalCached: false,
      });
    }
  }

  const free = (xs: Timed[]): Timed[] => xs.filter((t) => t.mood.kind === 'free');
  const quick = (xs: Timed[]): Timed[] => xs.filter((t) => t.mood.kind === 'quick');
  const rerankOnly = (xs: Timed[]): number[] =>
    xs.filter((t) => !t.rerankLocalCached).map((t) => t.rerankMs).filter((n): n is number => n !== null);
  const rerankP50V4 = percentile([...rerankOnly(v4), ...rerankOnly(cached)], 0.5);
  const rerankP50V3 = percentile(rerankOnly(v3), 0.5);

  const timingTable = table(
    ['Küme', 'n', 'parse p50', 'RPC p50', 'rerank p50', 'toplam p50', 'toplam p90', 'hedef'],
    [
      timingRow('V3 tümü (2c)', v3, null),
      timingRow('V3 serbest', free(v3), null),
      timingRow('V3 quick', quick(v3), null),
      timingRow('V5 tümü (ilk geçiş)', v4, null),
      timingRow('V5 serbest (ilk geçiş)', free(v4), TARGETS.freeTotalP50),
      timingRow('V5 quick (ilk geçiş, önbelleksiz)', quick(v4), null),
      timingRow('V5 quick (ÖNBELLEKLİ ikinci geçiş)', cached, TARGETS.quickCachedTotalP50),
    ],
  );
  const rerankVerdict = rerankP50V4 === null ? '—' : rerankP50V4 <= TARGETS.rerankP50 ? 'GEÇTİ' : 'GEÇMEDİ';
  const localCachedV4 = v4.filter((t) => t.rerankLocalCached).length;

  // ── Kalite regresyonu: V3 ↔ V5 ilk 4 kesişimi ──
  const qualityRows: string[][] = [];
  const changedCsv: string[] = [
    ['mood_id', 'mood_text', 'taraf', 'sıra', 'başlık', 'yıl', 'türler', 'V4_gerekçe', 'CTO_puan'].join(','),
  ];
  let commonSum = 0;
  let compared = 0;
  let identical = 0;
  for (const mood of moods) {
    const a = topV3.get(mood.id);
    const b = topV4.get(mood.id);
    if (!a || !b) continue;
    const idsA = new Set(a.map((r) => r.id));
    const idsB = new Set(b.map((r) => r.id));
    const common = [...idsA].filter((id) => idsB.has(id)).length;
    commonSum += common;
    compared += 1;
    const same = common === a.length && a.length === b.length;
    if (same) identical += 1;
    qualityRows.push([mood.id, mood.kind, mood.lang, String(common), `${a.length}/${b.length}`, same ? 'aynı' : 'DEĞİŞTİ']);
    if (same) continue;
    const reasons4 = recV4.get(mood.id)?.rerank?.reasons ?? {};
    const reasons3 = recV3.get(mood.id)?.rerank?.reasons ?? {};
    a.forEach((r, i) => {
      if (idsB.has(r.id)) return;
      changedCsv.push([mood.id, mood.text, 'yalnız_V3', i + 1, r.title, r.year, (r.genres ?? []).join('/'), reasons3[r.id] ?? '', ''].map(csv).join(','));
    });
    b.forEach((r, i) => {
      if (idsA.has(r.id)) return;
      changedCsv.push([mood.id, mood.text, 'yalnız_V4', i + 1, r.title, r.year, (r.genres ?? []).join('/'), reasons4[r.id] ?? '', ''].map(csv).join(','));
    });
  }

  // ── TR gerekçe dökümü ──
  const reasonsCsv: string[] = [['mood_id', 'dil', 'başlık', 'gerekçe', 'kelime'].join(',')];
  let reasonTotal = 0;
  let reasonEmpty = 0;
  let reasonDropped = 0;
  let overWords = 0;
  for (const [moodId, rec] of recV4) {
    const mood = moods.find((m) => m.id === moodId);
    const rs = rec.rerank?.reasons ?? {};
    reasonDropped += rec.rerank?.reasons_dropped ?? 0;
    const top = topV4.get(moodId) ?? [];
    for (const row of top) {
      const reason = rs[row.id];
      if (reason === undefined) continue;
      reasonTotal += 1;
      if (reason === '') reasonEmpty += 1;
      const words = reason.trim() === '' ? 0 : reason.trim().split(/\s+/).length;
      if (words > 15) overWords += 1;
      reasonsCsv.push([moodId, mood?.lang ?? '', row.title, reason, words].map(csv).join(','));
    }
  }

  const md = [
    '# MOOD-VEC-2d özet (ölçüm; puanlama yok)',
    '',
    `V3 kaynağı: \`${path.relative(process.cwd(), V3_DIR)}\` · V5 kaynağı: \`${path.relative(process.cwd(), OUT_DIR)}\``,
    `Örneklem: V3 ${v3.length} mood · V5 ${v4.length} mood · önbellekli geçiş ${cached.length} quick mood.`,
    '',
    '## Süre (ms, istemci-uç; toplam = parse + RPC + rerank)',
    '',
    timingTable,
    '',
    `Rerank p50 (V5, ilk geçiş + önbellekli geçiş; yerel rerank önbelleğinden gelenler hariç): **${fmt(rerankP50V4)} ms** — hedef ≤ ${TARGETS.rerankP50} → **${rerankVerdict}** (V3: ${fmt(rerankP50V3)} ms).`,
    localCachedV4 > 0 ? `\nUYARI: ${localCachedV4} V5 rerank kaydı yerel rerank önbelleğinden okundu (süre ilk çağrının süresi).` : '',
    '',
    '## Kalite regresyonu: V3 ↔ V5 ilk 4 kesişimi',
    '',
    `Ortalama kesişim: **${compared === 0 ? '—' : (commonSum / compared).toFixed(2)} / ${TOP_N}** (${compared} mood) · birebir aynı küme: ${identical}/${compared}.`,
    '',
    table(['mood', 'tür', 'dil', 'ortak', 'n (V3/V5)', 'durum'], qualityRows),
    '',
    `Değişen satırlar: \`changed-rows.csv\` (CTO yalnız bunları puanlar; \`CTO_puan\` sütunu boş).`,
    '',
    '## Gerekçeler',
    '',
    `Toplam ${reasonTotal} gerekçe (ilk 4) · sunucuda TR sızıntı denetiminde boşaltılan (yanıt sayacı): ${reasonDropped} · boş: ${reasonEmpty} · 15 kelimeyi aşan: ${overWords}.`,
    'Tüm gerekçeler: `reasons-v4.csv` (TR bozuk Türkçe kontrolü için gözle bakılır).',
    '',
  ].join('\n');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'summary-2d.md'), md);
  fs.writeFileSync(path.join(OUT_DIR, 'changed-rows.csv'), changedCsv.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT_DIR, 'reasons-v4.csv'), reasonsCsv.join('\n') + '\n');
  console.log(md);
}

main();
