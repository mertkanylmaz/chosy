/**
 * MOOD-VEC özet raporu: V3 (2c) ↔ V5 (istemci hattı: parse v2 → v4 → id-rerank → reasons).
 * Yalnız ölçülen sayılar — puanlama YOK. Çıktı (OUT_DIR): summary-2d.md, changed-rows.csv, reasons-v5.csv.
 *
 * Kullanım (run.ts --variant V5 + run.ts --cached-pass sonrası):
 *   MOOD_EVAL_OUT=docs/investigations/mood-vec-2e/eval npx tsx scripts/mood-eval/summary-2d.ts
 * V3 verisi MOOD_EVAL_V3_DIR'den okunur (varsayılan docs/investigations/mood-vec-2c/eval).
 *
 * Süreler istemci-uç, AŞAMA BAZINDA: parse · v4 · pick (id-rerank) · reasons (dörtlü göründükten sonra, arkadan).
 * Dörtlü-görünür = parse + v4 + pick. V3'te id+gerekçe TEK rerank çağrısıydı: "birleşik rerank" ayrı sütundadır
 * ve V3 dörtlü-görünür = parse + RPC + birleşik rerank.
 * Hedefler (CTO): quick mood (önbellekli) dörtlü-görünür p50 ≤ 5 sn · serbest metin ≤ 8 sn · pick p50 ≤ 3 sn.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  CACHED_PASS_DIR, META_FILE, OUT_DIR, computeFinal, loadMoods, readJson,
  type FilmMeta, type Mood, type ParsedFile, type RawRecord, type Row,
} from './common';

const TOP_N = 4;
const V3_DIR = path.resolve(process.env.MOOD_EVAL_V3_DIR ?? path.join(__dirname, '../../docs/investigations/mood-vec-2c/eval'));
const TARGETS = { quickCachedVisibleP50: 5_000, freeVisibleP50: 8_000, pickP50: 3_000 } as const;

interface Timed {
  mood: Mood;
  parseMs: number;
  v4Ms: number;
  /** V5: id-rerank (pick). V3: null. */
  pickMs: number | null;
  /** V5: dörtlü göründükten sonraki gerekçe çağrısı. V3: null. */
  reasonsMs: number | null;
  /** V3: id+gerekçe tek çağrı. V5: null. */
  combinedMs: number | null;
}

const visible = (t: Timed): number => t.parseMs + t.v4Ms + (t.pickMs ?? 0) + (t.combinedMs ?? 0);

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
const fmt = (n: number | null): string => (n === null ? '—' : String(Math.round(n)));
const pct = (n: number | null): string => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
const csv = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function table(headers: string[], rows: string[][]): string {
  const line = (r: string[]): string => `| ${r.join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}
const words = (s: string): number => (s.trim() === '' ? 0 : s.trim().split(/\s+/).length);

function readIf<T>(f: string): T | null {
  return fs.existsSync(f) ? readJson<T>(f) : null;
}

/** V5 kaydından dörtlü satırları (havuzdan, sıralı). */
function fourRows(rec: RawRecord): Row[] {
  const byId = new Map(rec.rpc.rows.map((r) => [r.id, r]));
  return (rec.v5?.four ?? []).map((id) => byId.get(id)).filter((r): r is Row => r !== undefined);
}

const votesOf = (id: string, meta: Record<string, FilmMeta>): number | null => {
  const v = meta[id]?.imdb_votes ?? null;
  return v === null || v === 0 ? null : v; // imdb_votes = 0 → NULL (kirli kolon notu)
};

interface SetItem { mood: Mood; rows: Row[] }

function recognizability(items: SetItem[], meta: Record<string, FilmMeta>): { med: number | null; lt100: number | null; nulls: number; total: number } {
  const votes: number[] = [];
  let nulls = 0;
  let total = 0;
  for (const it of items) {
    for (const r of it.rows) {
      total += 1;
      const v = votesOf(r.id, meta);
      if (v === null) nulls += 1;
      else votes.push(v);
    }
  }
  return {
    med: percentile(votes, 0.5),
    lt100: votes.length ? votes.filter((v) => v < 100_000).length / votes.length : null,
    nulls,
    total,
  };
}

function repeats(items: SetItem[]): { films: { title: string; year: number | null; moods: number }[]; distinct: number; slotShare: number | null } {
  const count = new Map<string, { title: string; year: number | null; moods: number }>();
  let slots = 0;
  for (const it of items) {
    for (const r of it.rows) {
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

function channelTally(items: SetItem[]): { total: number; by: Map<string, number> } {
  const by = new Map<string, number>();
  let total = 0;
  for (const it of items) {
    for (const r of it.rows) {
      total += 1;
      const key = Array.isArray(r.channels) && r.channels.length > 0 ? [...r.channels].sort().join('+') : '(etiket yok)';
      by.set(key, (by.get(key) ?? 0) + 1);
    }
  }
  return { total, by };
}

function timingRow(label: string, items: Timed[], target: number | null): string[] {
  const vis = items.map(visible);
  const p50 = percentile(vis, 0.5);
  const col = (f: (t: Timed) => number | null): string =>
    fmt(percentile(items.map(f).filter((n): n is number => n !== null), 0.5));
  return [
    label, String(items.length),
    col((t) => t.parseMs), col((t) => t.v4Ms), col((t) => t.pickMs), col((t) => t.reasonsMs), col((t) => t.combinedMs),
    fmt(p50), fmt(percentile(vis, 0.9)),
    target === null ? '—' : p50 !== null && p50 <= target ? `GEÇTİ (≤${target})` : `GEÇMEDİ (>${target})`,
  ];
}

function main(): void {
  const moods = loadMoods();
  const v3t: Timed[] = [];
  const v5t: Timed[] = [];
  const cachedT: Timed[] = [];
  const setsV3: SetItem[] = [];
  const setsV5: SetItem[] = [];
  const recV5 = new Map<string, RawRecord>();
  const recV3 = new Map<string, RawRecord>();
  const cachedRecs: RawRecord[] = [];

  const meta: Record<string, FilmMeta> = {
    ...(readIf<Record<string, FilmMeta>>(path.join(V3_DIR, 'films-meta.json')) ?? {}),
    ...(readIf<Record<string, FilmMeta>>(META_FILE) ?? {}),
  };

  const timedV5 = (mood: Mood, rec: RawRecord): Timed | null => {
    const s = rec.v5?.stages_ms;
    return s ? { mood, parseMs: s.parse, v4Ms: s.v4, pickMs: s.pick, reasonsMs: s.reasons, combinedMs: null } : null;
  };

  for (const mood of moods) {
    const r3 = readIf<RawRecord>(path.join(V3_DIR, 'raw', `${mood.id}.V3.json`));
    const p3 = readIf<ParsedFile>(path.join(V3_DIR, 'parsed-v2', `${mood.id}.json`));
    if (r3 && p3) {
      v3t.push({ mood, parseMs: p3.ms, v4Ms: r3.rpc.total_ms, pickMs: null, reasonsMs: null, combinedMs: r3.rerank ? r3.rerank.ms : null });
      setsV3.push({ mood, rows: computeFinal(r3).top.slice(0, TOP_N) });
      recV3.set(mood.id, r3);
    }
    const r5 = readIf<RawRecord>(path.join(OUT_DIR, 'raw', `${mood.id}.V5.json`));
    if (r5?.v5) {
      const t = timedV5(mood, r5);
      if (t) v5t.push(t);
      setsV5.push({ mood, rows: fourRows(r5) });
      recV5.set(mood.id, r5);
    }
    const c = readIf<RawRecord>(path.join(CACHED_PASS_DIR, `${mood.id}.json`));
    if (c?.v5) {
      const t = timedV5(mood, c);
      if (t) cachedT.push(t);
      cachedRecs.push(c);
    }
  }

  const free = (xs: Timed[]): Timed[] => xs.filter((t) => t.mood.kind === 'free');
  const quick = (xs: Timed[]): Timed[] => xs.filter((t) => t.mood.kind === 'quick');
  const pickAll = [...v5t, ...cachedT].map((t) => t.pickMs).filter((n): n is number => n !== null);
  const pickP50 = percentile(pickAll, 0.5);
  const pickVerdict = pickP50 === null ? '—' : pickP50 <= TARGETS.pickP50 ? 'GEÇTİ' : 'GEÇMEDİ';

  const timingTable = table(
    ['Küme', 'n', 'parse p50', 'v4 p50', 'pick p50', 'reasons p50', 'birleşik rerank p50 (V3)', 'dörtlü-görünür p50', 'dörtlü-görünür p90', 'hedef'],
    [
      timingRow('V3 tümü (2c)', v3t, null),
      timingRow('V3 serbest', free(v3t), null),
      timingRow('V3 quick', quick(v3t), null),
      timingRow('V5 tümü (ilk geçiş)', v5t, null),
      timingRow('V5 serbest (ilk geçiş)', free(v5t), TARGETS.freeVisibleP50),
      timingRow('V5 quick (ilk geçiş, önbelleksiz)', quick(v5t), null),
      timingRow('V5 quick (ÖNBELLEKLİ ikinci geçiş)', cachedT, TARGETS.quickCachedVisibleP50),
    ],
  );

  // ── Kalite: V3 ↔ V5 ilk 4 kesişimi ──
  const qualityRows: string[][] = [];
  const changedCsv: string[] = [['mood_id', 'rank', 'title', 'year', 'imdb_votes', 'channels', 'reason'].join(',')];
  let commonSum = 0;
  let compared = 0;
  let identical = 0;
  for (const mood of moods) {
    const a = setsV3.find((s) => s.mood.id === mood.id)?.rows;
    const b = setsV5.find((s) => s.mood.id === mood.id)?.rows;
    const rec5 = recV5.get(mood.id);
    if (!a || !b || !rec5) continue;
    const idsA = new Set(a.map((r) => r.id));
    const idsB = new Set(b.map((r) => r.id));
    const common = [...idsA].filter((id) => idsB.has(id)).length;
    commonSum += common;
    compared += 1;
    const same = common === a.length && a.length === b.length;
    if (same) identical += 1;
    qualityRows.push([mood.id, mood.kind, mood.lang, String(common), `${a.length}/${b.length}`, same ? 'aynı' : 'DEĞİŞTİ']);
    if (same) continue;
    const reasons = rec5.v5?.reasons ?? {};
    // İlk 4'ü V3'ten değişen mood'larda: V5 dörtlüsünde V3 ilk 4'te OLMAYAN satırlar (sıra = V5 dörtlüsündeki sıra).
    b.forEach((r, i) => {
      if (idsA.has(r.id)) return;
      changedCsv.push([
        mood.id, i + 1, r.title, r.year, votesOf(r.id, meta) ?? '',
        Array.isArray(r.channels) ? [...r.channels].sort().join('+') : '', reasons[r.id] ?? '',
      ].map(csv).join(','));
    });
  }

  // ── Tanınırlık, tekrar, kanal ──
  const rec3 = recognizability(setsV3, meta);
  const rec5 = recognizability(setsV5, meta);
  const rep3 = repeats(setsV3);
  const rep5 = repeats(setsV5);
  const ch3 = channelTally(setsV3);
  const ch5 = channelTally(setsV5);
  const fmtRep = (r: ReturnType<typeof repeats>): string =>
    r.films.length === 0 ? 'yok' : r.films.map((f) => `${f.title}${f.year ? ` (${f.year})` : ''} ×${f.moods}`).join(', ');
  const chKeys = [...new Set([...ch3.by.keys(), ...ch5.by.keys()])].sort();
  const channelTable = table(
    ['kanal', 'V3 satır', 'V3 pay', 'V5 satır', 'V5 pay'],
    chKeys.map((k) => [
      k, String(ch3.by.get(k) ?? 0), pct(ch3.total ? (ch3.by.get(k) ?? 0) / ch3.total : null),
      String(ch5.by.get(k) ?? 0), pct(ch5.total ? (ch5.by.get(k) ?? 0) / ch5.total : null),
    ]),
  );
  const recogTable = table(
    ['ölçü', 'V3 ilk 4', 'V5 dörtlü'],
    [
      ['imdb_votes medyan', fmt(rec3.med), fmt(rec5.med)],
      ['< 100k payı (imdb_votes olanlar içinde)', pct(rec3.lt100), pct(rec5.lt100)],
      ['imdb_votes NULL/0 (hariç)', `${rec3.nulls}/${rec3.total}`, `${rec5.nulls}/${rec5.total}`],
      ['≥3 moodda tekrar eden film sayısı', String(rep3.films.length), String(rep5.films.length)],
      ['tekrarlı filmlerin slot payı', pct(rep3.slotShare), pct(rep5.slotShare)],
      ['farklı film (toplam slot içinde)', `${rep3.distinct}/${setsV3.length * TOP_N}`, `${rep5.distinct}/${setsV5.length * TOP_N}`],
    ],
  );

  // ── Gerekçeler, yedek yollar ──
  const reasonsCsv: string[] = [['mood_id', 'geçiş', 'dil', 'sıra', 'başlık', 'gerekçe', 'kelime'].join(',')];
  let reasonSlots = 0;
  let reasonShown = 0;
  let over12 = 0;
  let over16 = 0;
  let dropped = 0;
  let reasonsCalls = 0;
  let reasonsFailed = 0;
  const models = new Map<string, number>();
  const fallbackTally = new Map<string, number>();
  const errorLines: string[] = [];
  const dump = (label: string, rec: RawRecord): void => {
    const v5 = rec.v5;
    if (!v5) return;
    const mood = moods.find((m) => m.id === rec.mood_id);
    const rows = fourRows(rec);
    reasonSlots += rows.length;
    rows.forEach((r, i) => {
      const reason = v5.reasons[r.id];
      if (reason === undefined) return;
      reasonShown += 1;
      const w = words(reason);
      if (w > 12) over12 += 1;
      if (w > 16) over16 += 1;
      reasonsCsv.push([rec.mood_id, label, mood?.lang ?? '', i + 1, r.title, reason, w].map(csv).join(','));
    });
    for (const c of v5.calls) {
      if (!c.with_reasons) continue;
      reasonsCalls += 1;
      if (c.failure !== null) reasonsFailed += 1;
      dropped += c.reasons_dropped ?? 0;
      const m = c.reason_model ?? '(yok)';
      models.set(m, (models.get(m) ?? 0) + 1);
    }
    for (const f of v5.fallbacks) fallbackTally.set(f, (fallbackTally.get(f) ?? 0) + 1);
    for (const e of v5.errors) errorLines.push(`${rec.mood_id}: ${e}`);
    for (const c of v5.calls) if (c.failure !== null) errorLines.push(`${rec.mood_id} ${c.with_reasons ? 'reasons' : 'id-rerank'}: ${c.failure}${c.error_detail ? ` (${c.error_detail})` : ''}`);
  };
  for (const [, rec] of recV5) dump('ilk', rec);
  for (const rec of cachedRecs) dump('önbellekli', rec);

  const cacheHitsQuick = quick(v5t).length;
  const md = [
    '# MOOD-VEC V3 ↔ V5 özet (ölçüm; puanlama yok)',
    '',
    `V3 kaynağı: \`${path.relative(process.cwd(), V3_DIR)}\` · V5 kaynağı: \`${path.relative(process.cwd(), OUT_DIR)}\``,
    `Örneklem: V3 ${v3t.length} mood · V5 ${v5t.length} mood (quick ${cacheHitsQuick}) · önbellekli geçiş ${cachedT.length} quick mood.`,
    'V5 = istemcinin saf hattı (`services/moodGauntlet.ts` doğrudan): parse v2 + quick_mood_id → match_films_v4 → id-rerank {count:4, reason:false, ilk 20} → reasons {reason:true, yalnız 4 film}. Yoğunluk / "Başka bir dörtlü" yok; soğuk eval hesabı (dışlama yok).',
    '',
    '## Süre (ms, aşama bazında; eval bekleme süreleri düşülmüş)',
    '',
    'dörtlü-görünür = parse + v4 + pick (V3: parse + RPC + birleşik rerank). `reasons` dörtlü göründükten sonra arkadan gelir, görünürlüğe dahil değildir.',
    '',
    timingTable,
    '',
    `pick p50 (V5, ilk + önbellekli geçiş): **${fmt(pickP50)} ms** — hedef ≤ ${TARGETS.pickP50} → **${pickVerdict}** (n=${pickAll.length}).`,
    '',
    '## Kalite: V3 ↔ V5 ilk 4 kesişimi',
    '',
    `Ortalama kesişim: **${compared === 0 ? '—' : (commonSum / compared).toFixed(2)} / ${TOP_N}** (${compared} mood) · birebir aynı küme: ${identical}/${compared}.`,
    '',
    table(['mood', 'tür', 'dil', 'ortak', 'n (V3/V5)', 'durum'], qualityRows),
    '',
    'Değişen satırlar (V5 dörtlüsünde olup V3 ilk 4\'te olmayanlar): `changed-rows.csv` — mood_id, rank, title, year, imdb_votes, channels, reason.',
    '',
    '## Tanınırlık ve tekrar',
    '',
    recogTable,
    '',
    `V3 ≥3 moodda tekrar: ${fmtRep(rep3)}`,
    '',
    `V5 ≥3 moodda tekrar: ${fmtRep(rep5)}`,
    '',
    '## Kanal dağılımı (match_films_v4: v = vektör, a = anahtar kelime, c = referans/öneri; dörtlü satırları)',
    '',
    channelTable,
    '',
    '## Gerekçeler ve yedek yollar (V5: ilk geçiş + önbellekli geçiş)',
    '',
    `Gerekçe çağrısı: ${reasonsCalls} · başarısız/zaman aşımı: ${reasonsFailed} · dörtlü slotu: ${reasonSlots} · gerekçesi gelen: ${reasonShown} · 12 kelimeyi aşan: ${over12} · 16 kelimeyi aşan: ${over16}.`,
    `**reasons_dropped (sunucu yanıt sayaçları toplamı): ${dropped}.** reason_model: ${[...models.entries()].map(([k, v]) => `${k} ×${v}`).join(', ') || '—'}.`,
    `Yedek yol (onFallback): ${[...fallbackTally.entries()].map(([k, v]) => `${k} ×${v}`).join(', ') || 'yok'}.`,
    errorLines.length > 0 ? `\nHat hataları:\n${errorLines.map((l) => `- ${l}`).join('\n')}` : '',
    '',
    'Tüm gerekçeler: `reasons-v5.csv` (TR bozuk Türkçe kontrolü için gözle bakılır).',
    '',
  ].join('\n');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'summary-2d.md'), md);
  fs.writeFileSync(path.join(OUT_DIR, 'changed-rows.csv'), changedCsv.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT_DIR, 'reasons-v5.csv'), reasonsCsv.join('\n') + '\n');
  console.log(md);
}

main();
