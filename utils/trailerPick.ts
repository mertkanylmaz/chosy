/**
 * Mood sonuç ekranı fragman seçimi (Faz 2-4d) — saf fonksiyon, RN/ağ yok.
 *
 * Sıra: Trailer'lar önce, hiçbiri yoksa Teaser'lar (yalnız YouTube).
 * Aynı tür içinde: official önce → dil (uygulama dili, sonra en) → en yeni published_at.
 * Hiçbiri yoksa null → düğme çizilmez.
 */
export interface TrailerCandidate {
  site: string;
  type: string;
  official: boolean;
  key: string;
  iso_639_1?: string | null;
  published_at?: string;
}

function langRank(v: TrailerCandidate, lang: string): number {
  const l = (v.iso_639_1 ?? '').toLowerCase();
  if (l === lang) return 0;
  if (l === 'en') return 1;
  return 2;
}

function best(list: TrailerCandidate[], lang: string): TrailerCandidate | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => {
    if (a.official !== b.official) return a.official ? -1 : 1;
    const lr = langRank(a, lang) - langRank(b, lang);
    if (lr !== 0) return lr;
    return (b.published_at ?? '').localeCompare(a.published_at ?? '');
  })[0];
}

export function pickTrailerKey(videos: readonly TrailerCandidate[], lang: string): string | null {
  const yt = videos.filter((v) => v.site === 'YouTube' && v.key.length > 0);
  const l = lang.toLowerCase();
  return (
    best(yt.filter((v) => v.type === 'Trailer'), l)?.key ??
    best(yt.filter((v) => v.type === 'Teaser'), l)?.key ??
    null
  );
}

export function trailerUrl(key: string): string {
  return `https://www.youtube.com/watch?v=${key}`;
}
