/**
 * Spotlight sonucunda "Save for Later" — mevcut `services/watchlist.addToWatchlist`
 * yolunun tek çağrı noktası. Yeni tablo, kolon, Edge Function ya da okuma yolu YOK.
 *
 * `addToWatchlist` yalnızca `film.id`'yi kullanır (UPSERT, `user_id,film_id`
 * UNIQUE + `ignoreDuplicates` — migration 001:75): tekrar kayıt çift satır
 * üretmez, ama "zaten vardı" sinyali de VERMEZ (dönüş `void`). Bu yüzden
 * sonuç ekranı başlangıçta "kayıtlı mı" bilmez; yazma başarısı doğru kabul edilir.
 *
 * ── Sessiz hayalet-başarı kapısı ────────────────────────────────────────────
 * `addToWatchlist`, `film.id` UUID değilse ya da kimlik çözülemezse HATA FIRLATMADAN
 * döner (`services/watchlist.ts:431-447`, yalnız `__DEV__` log). O hâlde çağıran
 * "Saved" gösterirdi, satır yazılmazdı. İki durum burada, çağrıdan ÖNCE, aynı
 * çözümleyicilerle (`getAppUserId`) yakalanır ve fırlatılır; bileşen hatayı
 * görünür kılar ve Sentry'ye yazar. Servisin kendisi değiştirilmez (kapsam dışı).
 */
import { getAppUserId } from '@/services/auth-utils';
import { addToWatchlist } from '@/services/watchlist';
import type { Film } from '@/types/film';
import type { RevealedFilm } from '@/types/game';

/** `services/watchlist.ts` UUID_REGEX ile aynı biçim — o modülde dışa açık değil. */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SpotlightSaveFailure = 'SPOTLIGHT_SAVE_INVALID_FILM_ID' | 'SPOTLIGHT_SAVE_NO_IDENTITY';

export class SpotlightSaveError extends Error {
  readonly code: SpotlightSaveFailure;

  constructor(code: SpotlightSaveFailure) {
    super(code);
    this.name = 'SpotlightSaveError';
    this.code = code;
  }
}

/**
 * Çözüm filmini watchlist'e yazar. `filmId`: `revealedFilm.film_id` (çağıran
 * doğrular; yoksa Kaydet hiç sunulmaz).
 *
 * @throws SpotlightSaveError — servis sessizce atlayacak iki durumda
 * @throws Error — `addToWatchlist` hatası (servis katmanı zaten logladı)
 */
export async function saveRevealedFilm(film: RevealedFilm, filmId: string): Promise<void> {
  if (!UUID_SHAPE.test(filmId)) throw new SpotlightSaveError('SPOTLIGHT_SAVE_INVALID_FILM_ID');

  const appUserId = await getAppUserId();
  if (!appUserId) throw new SpotlightSaveError('SPOTLIGHT_SAVE_NO_IDENTITY');

  // `addToWatchlist` yalnız `id`'yi okur; kalan alanlar tip sözleşmesi içindir
  // (WhyThisMovie ile aynı nötr değerler) — filmler tablosuna sorgu AÇILMAZ.
  const payload: Film = {
    id: filmId,
    title: film.title,
    year: film.year,
    posterUrl: film.poster_url ?? '',
    matchScore: 0,
    moodTags: [],
    whyThisFilm: '',
    director: film.director,
  };
  await addToWatchlist(payload);
}
