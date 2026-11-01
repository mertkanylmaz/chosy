/**
 * Film detayı oyuncu / ekip kartı verisi (Faz 2-6, madde 3). Saf, RN yok.
 *
 * Kök neden: `films.cast_json` satırları `{ name, character, profile_url }` biçiminde (tam URL);
 * ekran eskiden yalnız `profile_path` okuyordu → DB'den gelen oyuncuların fotoğrafı HER ZAMAN
 * boştu. TMDB credits gelmediğinde (ya da gelene kadar) kartlar silüet kalıyordu. Bu yardımcı
 * iki biçimi de okur; fotoğraf gerçekten yoksa `avatarUrl` undefined kalır ve kart yalnız
 * isim + rol gösterir (silüet ikonu yok).
 */
export const TMDB_PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';

export interface DbCastEntry {
  name: string;
  character?: string | null;
  profile_path?: string | null;
  profile_url?: string | null;
}

export interface TmdbCastLike {
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TmdbCrewLike {
  name: string;
  job: string;
  profile_path: string | null;
}

export interface DisplayCastMember {
  name: string;
  character?: string;
  avatarUrl?: string;
}

/** "/abc.jpg" → tam TMDB URL; boş / geçersiz → undefined. */
export function profilePathUrl(path: string | null | undefined): string | undefined {
  if (typeof path !== 'string' || !path.startsWith('/') || path.length < 2) return undefined;
  return `${TMDB_PROFILE_BASE}${path}`;
}

/** DB satırı: önce `profile_url` (https), yoksa `profile_path`. */
export function dbCastAvatar(e: Pick<DbCastEntry, 'profile_path' | 'profile_url'>): string | undefined {
  if (typeof e.profile_url === 'string' && /^https:\/\//.test(e.profile_url)) return e.profile_url;
  return profilePathUrl(e.profile_path);
}

export function mapDbCast(rows: readonly DbCastEntry[] | null | undefined): DisplayCastMember[] {
  return (rows ?? []).map((c) => ({
    name: c.name,
    ...(c.character ? { character: c.character } : {}),
    avatarUrl: dbCastAvatar(c),
  }));
}

/**
 * TMDB credits doluysa onlar (ilk 10), değilse DB oyuncuları. TMDB'de fotoğrafı olmayan bir
 * oyuncunun DB'de fotoğrafı varsa (aynı isim) DB fotoğrafı kullanılır.
 */
export function buildDisplayCast(
  credits: { cast: readonly TmdbCastLike[] } | null,
  dbCast: readonly DbCastEntry[] | null | undefined,
): DisplayCastMember[] {
  const db = mapDbCast(dbCast);
  if (!credits || credits.cast.length === 0) return db;
  const dbPhoto = new Map(db.filter((d) => d.avatarUrl).map((d) => [d.name, d.avatarUrl as string]));
  return credits.cast.slice(0, 10).map((c) => ({
    name: c.name,
    character: c.character,
    avatarUrl: profilePathUrl(c.profile_path) ?? dbPhoto.get(c.name),
  }));
}

export interface CrewDisplay {
  label: string;
  name: string;
  avatarUrl?: string;
}

/** Director / Producer / Composer (ilk eşleşen); etiketler çağıranda çevrilir. */
export function buildCrewDisplay(
  credits: { crew: readonly TmdbCrewLike[] } | null,
  labels: { director: string; producer: string; music: string },
): CrewDisplay[] {
  if (!credits) return [];
  const find = (job: string) => credits.crew.find((c) => c.job === job);
  const out: CrewDisplay[] = [];
  for (const [job, label] of [
    ['Director', labels.director],
    ['Producer', labels.producer],
    ['Original Music Composer', labels.music],
  ] as const) {
    const m = find(job);
    if (m) out.push({ label, name: m.name, avatarUrl: profilePathUrl(m.profile_path) });
  }
  return out;
}
