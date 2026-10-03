/**
 * TMDb poster URL boyut yükseltmesi — C.9b-UI C7.
 *
 * ── Neden istemcide ───────────────────────────────────────────────────────
 * `generate-gauntlet` tüm poster URL'lerini **w500**'e sabitliyor
 * (`supabase/functions/_shared/gauntletCore.ts` → `toW500PosterUrl`). Gauntlet
 * karşısındaki iki poster için w500 yeterli (3× ekranda ~494px gerekiyor), ama
 * Champion posteri ekranın %58'ini kaplıyor: 393pt cihazda 3× ~600px, 430pt'de
 * ~665px gerekiyor. Spec eşiği ≥720px — w500 hiçbir cihazda yetmiyor.
 *
 * Yükseltme İSTEMCİDE yapılıyor (CTO kararı 19.09.2026). Böylece
 * `types/gauntlet.ts` kilitli sözleşmesine, `gauntletCore.ts`'e ve Edge
 * Function deploy'una DOKUNULMUYOR — ve K-42 offline önbelleğindeki eski w500
 * URL'leri de otomatik olarak w780 alıyor.
 *
 * ⚠️ Bu, boyut bilgisinin yaşadığı İKİNCİ yer. `gauntletCore.ts` w500'e
 * sabitliyor, burası Champion için w780'e çıkarıyor. Sunucudaki boyut
 * değişirse burası SESSİZCE yanlış olmaz — desen eşleşmezse URL olduğu gibi
 * döner ve `reason` alanı nedenini söyler. Kalıcı çözüm sunucunun boyut
 * varyantı sunması (TEKNIK_BORC, R-18).
 *
 * ── Saflık ────────────────────────────────────────────────────────────────
 * Ağ/DB/cihaz yok, React Native importu yok — Deno birim testiyle doğrulanır
 * (`utils/identityReset.ts` deseni). Sentry raporu ÇAĞIRANIN işi: bu modül
 * yalnız `reason` döner, yan etkisi yoktur.
 */

/** Champion posteri için hedef genişlik (px). §10.2 + 3× ekran hesabı. */
export const CHAMPION_POSTER_WIDTH = 780

/**
 * KATI desen: yalnızca `image.tmdb.org/t/p/<boyut>/<dosya>`.
 * `<boyut>` = `w` + rakamlar, ya da `original`. Başka hiçbir biçim kabul
 * edilmez — tanımadığımız bir URL'i "düzeltmeye" çalışmak, onu bozmaktan
 * daha kötüsünü yapar: sessizce 404 üretir.
 */
const TMDB_POSTER_PATTERN =
  /^(https?:\/\/image\.tmdb\.org\/t\/p\/)(w(\d+)|original)(\/.+)$/

/** Yükseltmenin neden yapılmadığı. `undefined` → yapıldı. */
export type PosterUpgradeSkipReason =
  /** Boş ya da yalnızca boşluk. */
  | 'empty'
  /** TMDb görsel host'u değil (başka CDN, göreli yol, bozuk URL). */
  | 'not_tmdb'
  /** Mevcut boyut hedefe eşit ya da ondan büyük — küçültme YAPILMAZ. */
  | 'already_large_enough'

export interface PosterUpgradeResult {
  /** Kullanılacak URL. Yükseltme olmadıysa girdinin AYNISI (kırpılmamış hâli). */
  url: string
  /** Boyut gerçekten değiştirildi mi. */
  upgraded: boolean
  /** Değiştirilmediyse nedeni. */
  reason?: PosterUpgradeSkipReason
}

/**
 * TMDb poster URL'ini hedef genişliğe yükseltir.
 *
 * Küçültme ASLA yapılmaz: `original` ya da w780'den geniş bir boyut geldiyse
 * olduğu gibi bırakılır (`already_large_enough`). Champion'da daha büyük bir
 * poster zararsızdır, daha küçüğü bulanıklıktır.
 */
export function upgradePosterUrl(
  raw: string | null | undefined,
  targetWidth: number = CHAMPION_POSTER_WIDTH,
): PosterUpgradeResult {
  const value = (raw ?? '').trim()
  if (value === '') {
    return { url: raw ?? '', upgraded: false, reason: 'empty' }
  }

  const match = TMDB_POSTER_PATTERN.exec(value)
  if (!match) {
    return { url: raw as string, upgraded: false, reason: 'not_tmdb' }
  }

  const [, prefix, sizeSegment, widthDigits, filePath] = match

  // `original` her zaman hedeften büyüktür — dokunulmaz.
  if (sizeSegment === 'original') {
    return { url: raw as string, upgraded: false, reason: 'already_large_enough' }
  }

  const currentWidth = Number(widthDigits)
  if (currentWidth >= targetWidth) {
    return { url: raw as string, upgraded: false, reason: 'already_large_enough' }
  }

  return { url: `${prefix}w${targetWidth}${filePath}`, upgraded: true }
}

// ─── Oyun sonuç kartı (P-1a, 3 Eki 2026) ─────────────────────────────────────

/** `resultPosterUrl`'ün URL'i boyutlandırmadığı durumlar. `undefined` → boyutlandı. */
export type ResultPosterSkipReason =
  /** Boş ya da yalnızca boşluk — sunucu poster vermedi. */
  | 'empty'
  /** `http(s)://` ile başlamıyor (ör. ham `poster_path` `/abc.jpg`) — görsel çizilemez. */
  | 'invalid_uri'
  /** Tam URL ama TMDb boyut deseni değil — olduğu gibi kullanılır. */
  | 'not_tmdb'
  /** Zaten hedef boyutta. */
  | 'already_target'

export interface ResultPosterResult {
  /** Çizilecek URL. `null` → çizilemez (`empty` ya da `invalid_uri`). */
  url: string | null
  /** Boyut değiştirildi mi. */
  resized: boolean
  /** Değiştirilmediyse nedeni. */
  reason?: ResultPosterSkipReason
}

/**
 * Oyun sonuç kartı (ResultCard) posterini hedef genişliğe getirir.
 *
 * `upgradePosterUrl`'den farkı: bu yüzey sunucudan `films.poster_url`'ü HAM
 * alıyor (`submit-guess` / `get-daily-challenge` `revealed_solution`), canlıda
 * bu `/t/p/original/` (Akira: 1,27 MB; w780 172 KB). Bu yüzden burada
 * **küçültme de yapılır**. `upgradePosterUrl`'ün "küçültme yok" kuralı (CTO
 * kararı 19.09.2026) Champion için aynen geçerli — o fonksiyon değişmedi.
 *
 * Boyut seçimi ve desen Champion ile ortak: küçükse `upgradePosterUrl`'e
 * devredilir, aynı `TMDB_POSTER_PATTERN` ve `CHAMPION_POSTER_WIDTH` kullanılır.
 *
 * Saf: Sentry raporu çağıranın işi (`invalid_uri` → çağıran raporlar).
 */
export function resultPosterUrl(
  raw: string | null | undefined,
  targetWidth: number = CHAMPION_POSTER_WIDTH,
): ResultPosterResult {
  const value = (raw ?? '').trim()
  if (value === '') return { url: null, resized: false, reason: 'empty' }

  if (!/^https?:\/\//i.test(value)) {
    return { url: null, resized: false, reason: 'invalid_uri' }
  }

  const match = TMDB_POSTER_PATTERN.exec(value)
  if (!match) return { url: value, resized: false, reason: 'not_tmdb' }

  const [, prefix, sizeSegment, widthDigits, filePath] = match

  if (sizeSegment !== 'original') {
    const width = Number(widthDigits)
    if (width === targetWidth) {
      return { url: value, resized: false, reason: 'already_target' }
    }
    if (width < targetWidth) {
      const up = upgradePosterUrl(value, targetWidth)
      return { url: up.url, resized: up.upgraded }
    }
  }

  // `original` ya da hedeften geniş → hedefe indirilir.
  return { url: `${prefix}w${targetWidth}${filePath}`, resized: true }
}
