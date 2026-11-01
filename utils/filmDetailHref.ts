/**
 * Film detay ekranına geçişte eldeki kayıttan ön-izleme taşır (Faz 2-5, P1-6).
 * Başlık / yıl / poster query parametresi olarak gider; ekran DB satırı gelene kadar bunlarla
 * ANINDA çizer (iskelet yok), DB satırı gelince tamamını ondan alır. Saf, RN yok.
 *
 * Ön-izleme yalnız görüntü içindir: yazma / analitik / kimlik kararı ondan verilmez.
 */
export interface FilmPreview {
  title: string;
  year: number | null;
  posterUrl: string | null;
}

export function filmDetailHref(id: string, preview?: FilmPreview | null): string {
  const base = `/film/${id}`;
  if (!preview || preview.title.trim().length === 0) return base;
  const q: string[] = [`pt=${encodeURIComponent(preview.title)}`];
  if (typeof preview.year === 'number' && preview.year > 0) q.push(`py=${Math.round(preview.year)}`);
  if (preview.posterUrl) q.push(`pp=${encodeURIComponent(preview.posterUrl)}`);
  return `${base}?${q.join('&')}`;
}

/** Route parametrelerinden ön-izleme; başlık yoksa null. Param dizi gelirse ilk öğe. */
export function parseFilmPreview(params: { pt?: string | string[]; py?: string | string[]; pp?: string | string[] }): FilmPreview | null {
  const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
  const title = one(params.pt)?.trim();
  if (!title) return null;
  const yearRaw = Number(one(params.py));
  const poster = one(params.pp)?.trim();
  return {
    title,
    year: Number.isFinite(yearRaw) && yearRaw > 0 ? Math.round(yearRaw) : null,
    posterUrl: poster && /^https:\/\//.test(poster) ? poster : null,
  };
}
