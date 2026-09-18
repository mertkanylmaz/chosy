# Ürün/veri kalitesi keşfi — afiş performansı, açıklama eksikliği, IMDb puan uyuşmazlığı

**Tarih:** 18 Eylül 2026
**Mod:** SALT OKUNUR. Hiçbir kod/migration/deploy değişmedi.
**Tetikleyici:** Build 901 TestFlight testi, üç ayrı gözlem.
**Kapsam dışı (CTO ile ayrıca konuşulacak):** "bilinirlik / neden seçileceği
belli değil" gözlemi.

---

## Yönetici özeti

1. **Açıklama verisi EKSİK DEĞİL — taşınmıyor.** Aktif havuzdaki
   **1.867 filmin 1.867'sinde** `overview` dolu (NULL 0, boş string 0).
   Sorun ingestion'da değil: kilitli sözleşme `GauntletFilm`
   (`types/gauntlet.ts:20-27`) synopsis alanı **taşımıyor**. → DUR NOKTASI.
2. **Gösterilen puan IMDb puanı değil, TMDB `vote_average`'ı.** Üstelik
   gerçek IMDb puanı `films.imdb_rating` kolonunda mevcut ve aktif havuzun
   **1.808/1.867'sinde (%96,8) dolu** — UI onu hiç okumuyor.
3. **Sapma sistematik, rastgele değil.** En çok oylanan 500 aktif filmde
   `vote_average − imdb_rating` medyanı **−0,15**; 500'ün **390'ında** TMDB
   puanı IMDb'nin altında. Sapma tam da en tanınan filmlerde en büyük:
   Shawshank UI'da **8,7** / IMDb **9,3**.
4. **Afiş boyutu tek sorun değil ama en büyüğü:** DB `poster_url`'ü
   `/t/p/original/` olarak saklıyor (3.438 satırın 2.484'ü). Ölçülen fark aynı
   poster için **1.068.762 bayt / 72.829 bayt = 14,7 kat**.
5. **"Bozuk" hissinin doğrudan sebebi: yükleme göstergesi fiilen yok.**
   `PosterTile`'ın iskeleti `height={1}` ile çağrılıyor ve override eden
   stilde yükseklik yok → **1 piksellik çizgi**. Ayrıca `cachePolicy` yok,
   `transition` yok, tur 2/3 filmleri için prefetch yok.

---

## Bulgu 1 — Afiş yükleme performansı

### Kök neden (dört ayrı katman)

| # | Dosya:satır | Durum |
|---|---|---|
| 1a | `components/gauntlet/PosterTile/index.tsx:172-179` + `styles.ts:34-37` | İskelet `height={1}` ile çağrılıyor. Override eden `styles.skeleton` = `StyleSheet.absoluteFillObject` + `backgroundColor` — **yükseklik içermiyor**. `SkeletonLoader/index.tsx:58-66`'daki stil sırasında inline `height: 1` ayakta kalıyor. Yoga'da `top:0 + bottom:0 + height:1` çakışınca `height` kazanır. Sonuç: poster yüklenirken görünen tek şey `posterWrapper` arka planı. |
| 1b | `components/gauntlet/PosterTile/index.tsx:164-171` | `Image`'da `cachePolicy` YOK (expo-image 3.0.11 varsayılanı `disk`, `memory-disk` değil) ve `transition` YOK. Kod tabanındaki diğer tüm `Image` kullanımları bunları veriyor — ör. `Discover/TrendingSection/index.tsx:83-84`, `gauntlet/WatchProviders/index.tsx:174`. Gauntlet'in ANA görseli istisna. |
| 1c | `components/gauntlet/GauntletShell/index.tsx:1035-1054` | Yalnız o anki çift render ediliyor. Tur 2/3'ün filmleri (`gauntlet.films[2]`, `[3]`) **prefetch edilmiyor** — her tur geçişinde sıfırdan indirme. Prefetch deseni kod tabanında zaten var: `app/roulette.tsx:208-212`. |
| 1d | `films.poster_url` | DB `/t/p/original/` saklıyor. Gauntlet yolu sunucuda w500'e normalize ediyor (`supabase/functions/_shared/gauntletCore.ts:181-201, 206`), ama `poster_url`'ü doğrudan okuyan diğer ekranlar (`app/film/[id].tsx:344`, `components/Profile/DailyMatchCard`, `SwipeCard/*`) **ham original'i** alıyor. |

**Not:** 1d'nin gauntlet tarafındaki düzeltmesi commit `8705931`'de yapılmış
görünüyor; **canlıya deploy edildiği bu keşifte doğrulanamadı.** Eğer deploy
edilmediyse gauntlet başına indirilen veri 4 × ~1 MB'tır.

### Tahmini iş büyüklüğü
- 1a + 1b (iskelet yüksekliği + `cachePolicy="memory-disk"` + `transition`): **S**
- 1c (tur 2/3 prefetch): **M**
- 1d (diğer ekranlarda boyut normalizasyonu): **M**

---

## Bulgu 2 — Film açıklamasının hiç görünmemesi

### Kök neden: veri değil, sözleşme

`films.overview` kolonu var (migration `003`'ten beri RPC imzalarında) ve
**aktif havuzda %100 dolu** (aşağıdaki ölçüm). Yani ingestion/enrich
pipeline'ında eksik YOK.

Gösterilmemesinin sebebi, kilitli sözleşmenin alanı taşımaması:

```typescript
// types/gauntlet.ts:20-27  🔒 KİLİTLİ SÖZLEŞME
export interface GauntletFilm {
  id: string; title: string; year: number; runtime: number;
  posterUrl: string; dominantColor?: OklchColor;
}
```

`supabase/functions/_shared/gauntletCore.ts:226-228`'deki `FILM_COLUMNS`
listesi de `overview`'u **çekmiyor**. Yani zincirin üç halkası da (SQL select
→ Edge Function tipi → istemci sözleşmesi) synopsis'siz.

Karşılaştırma: film detay ekranı `overview`'u hem çekiyor
(`app/film/[id].tsx:344`) hem gösteriyor (`:982-985`). Yani boşluk yalnızca
gauntlet yüzeyinde.

### Tahmini iş büyüklüğü
Kod olarak **S** — ama **DUR NOKTASI** (aşağıya bakınız).

---

## Bulgu 3 — IMDb puan uyuşmazlığı

### Kök neden: yanlış kolon, IMDb markasıyla gösteriliyor

`films` tablosunda **iki ayrı puan** var:

- `vote_average` — TMDB'nin kendi kullanıcı puanı
- `imdb_rating` — gerçek IMDb puanı (migration `028_imdb_and_curation.sql:11`,
  `scripts/enrich-imdb-ratings.ts` ile dolduruluyor)

UI her yerde **`vote_average`'ı gösteriyor ve IMDb gibi etiketliyor**:

| Dosya:satır | Ne yapıyor |
|---|---|
| `components/Profile/DailyMatchCard/index.tsx:168-172` | `film.voteAverage.toFixed(1)` değerini `styles.imdbBadge` / `styles.imdbText` içinde gösteriyor; renk `Colors.imdbYellow` (`styles.ts:271-278`) |
| `components/SwipeCard/index.tsx:106, 270` + `styles.ts:795-796` | Aynı desen: `voteAverage` → `imdbText` + `Colors.imdbYellow` |
| `components/SwipeCard/SwipeCardStack.tsx:95, 243` + `:711-712` | Aynı desen |
| `components/Discover/TrendingSection/index.tsx:70, 93` | `vote_average` → `Colors.imdbYellow` yıldız |
| `app/film/[id].tsx:922-926` | `voteAverage` gösteriyor; burada IMDb etiketi YOK, yalnız ★ pill — marka karışıklığı yok ama değer yine TMDB'nin |

**Önemli ayrım:** Gauntlet ekranının kendisi hiçbir puan göstermiyor —
`GauntletFilm` sözleşmesinde puan alanı yok. Yani bu gözlem gauntlet
dışındaki bir yüzeyden (Profile / watchlist / film detay) geliyor olmalı.

### Sapma sistematik mi? — Ölçüldü, EVET

En çok oylanan 500 aktif film (her ikisi de dolu) üzerinde
`vote_average − imdb_rating`:

```
n                                  = 500
ortalama sapma                     = -0,125
medyan sapma                       = -0,15
min / max                          = -0,61 / +0,79
vote_average < imdb_rating         = 390 / 500  (%78)
|sapma| >= 0,3                     = 131
|sapma| >= 0,5                     =  12
|sapma| >= 1,0                     =   0
```

Yön tutarlı (TMDB sistematik olarak daha düşük okuyor) ve sapma **tam da
kullanıcının tanıdığı filmlerde** en büyük — yani en görünür yerde:

```
The Shawshank Redemption (1994): UI 8,7 | gerçek IMDb 9,3 | fark -0,58
The Godfather (1972):            UI 8,7 | gerçek IMDb 9,2 | fark -0,51
The Dark Knight (2008):          UI 8,5 | gerçek IMDb 9,1 | fark -0,57
LOTR: Return of the King (2003): UI 8,5 | gerçek IMDb 9,0 | fark -0,50
The Matrix (1999):               UI 8,2 | gerçek IMDb 8,7 | fark -0,45
Inception (2010):                UI 8,4 | gerçek IMDb 8,8 | fark -0,43
Fight Club (1999):               UI 8,4 | gerçek IMDb 8,8 | fark -0,40
Forrest Gump (1994):             UI 8,5 | gerçek IMDb 8,8 | fark -0,34
Pulp Fiction (1994):             UI 8,5 | gerçek IMDb 8,8 | fark -0,32
```

Ayrıca `vote_average` 3 ondalıkla saklanıyor (ör. `8.721`) ve `.toFixed(1)`
ile kırpılıyor — yani 8,7 gösteriliyor, IMDb 9,3 diyor.

### Tahmini iş büyüklüğü
**S** — dört bileşende kaynak kolonu değiştirmek. Ama `imdb_rating`
aktif havuzun %3,2'sinde NULL olduğu için "NULL ise ne gösterilecek" bir ürün
kararıdır (rozeti gizle / TMDB'yi TMDB etiketiyle göster).

---

## Ölçülmüş sayılar

Yöntem: PostgREST + `Prefer: count=exact`, `Content-Range` başlığından okundu
(istemci tarafı sayım YOK — chosy-conventions §9). Proje:
`xpcwihldlnlmyopjubdc` (linked).

```
films TOPLAM                              3.438
  curation_tier != 'archive' (aktif)      1.867
  curation_tier  = 'archive'              1.571

overview IS NULL                              0
overview = '' (tüm tablo)                   183
overview = '' (aktif havuz)                   0     ← aktif havuzda %100 dolu

poster_url LIKE '%/t/p/original/%'        2.484
poster_url LIKE '%w500%'                      0
poster_url LIKE '%w780%'                      1
poster_url NOT LIKE 'http%'                 949     ← ham poster_path kalıntısı
poster_url IS NULL                            5

vote_average IS NULL                          0
imdb_rating  IS NULL                      1.167
imdb_rating dolu + aktif havuz            1.808 / 1.867   (%96,8)
imdb_votes   IS NULL                      1.051
imdb_votes   = 0                             22     ← sentinel ihlali, bilinen borç
```

Afiş yükü (aynı poster, TMDB CDN'den ölçüldü —
`/t/p/original/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg`):

```
original : 1.068.762 bayt
w500     :    72.829 bayt
oran     : 14,7×
```

Gauntlet başına 4 film: **~4,3 MB / ~291 KB.**

---

## DUR NOKTASI gerektiren maddeler

1. **Bulgu 2 — `GauntletFilm`'e synopsis alanı eklemek KİLİTLİ SÖZLEŞME
   değişikliğidir** (`types/gauntlet.ts`, CLAUDE.md kural 8). Ayrıca
   `gauntletCore.ts:226-228`'deki `FILM_COLUMNS`'a `overview` eklemek
   gauntlet response'unun boyutunu her çağrıda büyütür. Tek başıma yapmam.
   *Ayrıca bir ürün sorusu:* PRODUCT_OS "serbest metin yok, hızlı karar"
   diyor — synopsis eklemek ritüelin okuma yükünü bilinçli olarak artırır.
2. **Bulgu 3 — `imdb_rating` NULL olduğunda ne gösterileceği ürün kararıdır**
   (aktif havuzun 59 filmi). Rozeti gizlemek mi, TMDB puanını dürüst etiketle
   göstermek mi?
3. **Bulgu 1d — `films.poster_url`'ün normalize edilmesi (949 ham
   `poster_path` kalıntısı dahil) veri yazma işidir**, migration veya toplu
   UPDATE gerektirir. Film verisinde DELETE yasağı (kural 4) ihlal edilmez ama
   toplu UPDATE yine de CTO onayı ister.

---

## Doğrulanamayanlar

- **Edge Function'ların canlı sürümü doğrulanamadı.** `gauntletCore.ts`'teki
  w500 normalizasyonu repoda var (commit `8705931`); **deploy edilmiş sürüm
  okunamadı.** Bu yüzden gauntlet ekranının bugün w500 mü yoksa original mi
  aldığı **açık soru** — afiş yavaşlığının büyüklüğü buna bağlı.
- **Supabase MCP bu oturumda bağlı değil.** Tüm ölçümler PostgREST + secret
  key üzerinden `count=exact` ile alındı; sayılar sunucudan geldi.
- **Gerçek IMDb API'siyle karşılaştırma yapılmadı.** Referans olarak
  `films.imdb_rating` kolonu kullanıldı; o kolon `scripts/enrich-imdb-ratings.ts`
  (OMDb) ile dolduruluyor. Kolonun kendi tazeliği ölçülmedi.
- **Cihazda afiş yükleme süresi ölçülmedi** — bayt ölçümü CDN'den alındı,
  gerçek cihaz/şebeke süresi değil.
- Kullanıcının IMDb uyuşmazlığını **hangi ekranda** gördüğü doğrulanmadı;
  gauntlet ekranı puan göstermiyor, dolayısıyla gözlem Profile / watchlist /
  film detay yüzeylerinden biri olmalı.
