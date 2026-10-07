/**
 * Film arama sonucu siniflandirmasi — saf mantik (React Native / Supabase yok).
 *
 * `searchFilms` / `searchFilmsDb` her hatayi yutup [] doner; "eslesme yok" ile
 * "arama patladi" ayirt edilemez. Strict varyant (`searchFilmsStrict`) hatayi
 * burada siniflandirir:
 *   ok     — arama calisti (`films` bos olabilir: gercek "bulunamadi")
 *   offline — arama patladi VE cihaz cevrimdisi
 *   failed — arama patladi, cihaz cevrimici (sunucu/RPC hatasi)
 *
 * Test: `tests/games/filmSearchList.test.ts` (npm run test:film-search).
 */

export type FilmSearchOutcome<T> =
  | { status: 'ok'; films: T[] }
  | { status: 'offline'; error: unknown }
  | { status: 'failed'; error: unknown };

export async function classifyFilmSearch<T>(
  run: () => Promise<T[]>,
  isOnline: () => boolean,
): Promise<FilmSearchOutcome<T>> {
  try {
    return { status: 'ok', films: await run() };
  } catch (error) {
    return { status: isOnline() ? 'failed' : 'offline', error };
  }
}
