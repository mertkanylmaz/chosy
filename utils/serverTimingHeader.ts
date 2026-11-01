/**
 * `Server-Timing` başlığı ayrıştırıcı (Faz 2-5, P1-5c). Saf, RN / ağ yok.
 * "auth;dur=12.0, v4_rpc;dur=800.5" → { auth: 12, v4_rpc: 801 }. Bozuk girdi atlanır, sessizce 0 üretilmez.
 */
export type MoodFourServerMs = Partial<Record<'auth' | 'v4_rpc' | 'pick_llm' | 'total', number>>;

const KEYS: readonly (keyof MoodFourServerMs)[] = ['auth', 'v4_rpc', 'pick_llm', 'total'];

export function parseMoodFourServerTiming(header: string | null | undefined): MoodFourServerMs | undefined {
  if (typeof header !== 'string' || header.length === 0) return undefined;
  const out: MoodFourServerMs = {};
  for (const part of header.split(',')) {
    const m = /^\s*([a-z0-9_]+)\s*;\s*dur=([0-9]+(?:\.[0-9]+)?)\s*$/i.exec(part);
    if (!m) continue;
    const name = m[1] as keyof MoodFourServerMs;
    if ((KEYS as readonly string[]).includes(name)) out[name] = Math.round(Number(m[2]));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
