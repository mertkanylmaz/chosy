# P-1 — Spotlight sonuç posteri tutarlılığı · Keşif raporu

**Temel:** master @ 8814966 · **Tarih:** 3 Eki 2026 · **Mod:** READ-ONLY
(kod/şema/deploy değişikliği yok; commit yok — iş tanımı "commit yok" diyor).
İş kodu: **P-1** (ilk sürümde yanlışlıkla `S-3` kullanıldı; S-3 Spotlight
attempts işine ayrılmış). Ek keşif bulguları en altta, **"P-1 EK"** bölümünde.

> ⚠️ **Düzeltme (P-1 EK):** Bu raporun ilk sürümündeki §3f ve F-6, Spotlight
> çözümlerinin `fetchFilms` havuzundan (`core/extended` + `minVotes`) geldiğini
> varsayıyordu. Bu **yanlıştı**: 30 Eyl 2026'dan beri (commit `1adc164`,
> `7a281bd`) Spotlight çözümleri `editorial_calendar_films`'ten gelir
> (`generate-puzzles/index.ts:568-633, 1902-1904`). F-6 bulgusu geçersizdir;
> §3f'nin "ham yol Spotlight'a yapısal olarak giremez" sonucu da geçersizdir —
> bkz. P-1 EK §E-4.

---

## Yönetici özeti

1. **Veri düzeyinde poster uyuşmazlığı ölçülmedi.** Bugünün Spotlight çözümü
   Akira (1988) ve yakın tarihli 6 Spotlight çözümünün **6/6**'sında
   `films.poster_url` dosya adı, TMDb'nin bugünkü `en-US` birincil posteriyle
   **aynı**. Spotlight sonucu, Champion, gauntlet kartları, Watchlist ve
   "dün izledin mi?" kartı aynı `films.poster_url` dosyasını gösteriyor.
2. **Yüzeyler arasında fark yalnızca BOYUTTA:** Spotlight sonuç ekranı
   `films.poster_url`'ü **normalizasyonsuz** kullanıyor → `/t/p/original/`
   (Akira: **1.273.277 B**). Champion w780 (171.783 B), gauntlet yüzeyleri w500
   (64.849 B). Spotlight yolu, `gauntletCore.toW500PosterUrl`'ün tek-kaynak
   normalizasyonunun **dışında** kalan tek bugünkü aktif yüzey.
3. **Film detay ekranı tek "farklı kaynak":** posteri DB'den değil, runtime'da
   TMDb `/movie/{id}?language=en-US&include_image_language=en,null` yanıtından
   alıyor. Bugün 6/6 aynı dosya; TMDb birincil posteri değişirse bu yüzey
   diğerlerinden **ayrışır** (gizli sürüklenme riski, şu an ölçülen 0).
4. **"Poster quality gate" hiçbir okuma yolunda bağlı değil** — Spotlight'a
   özgü bir bypass yok; gate D-03 kararıyla **bilinçli olarak bağlanmamış**
   (`docs/TEKNIK_BORC.md:2064`). Not: iş tanımındaki "Product OS §7.2"
   referansı yanlış — §7.2 Spotlight V3 mekaniğidir; poster quality gate
   `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md:276` (D-03)'tür.
5. **Gözlenen görsel farkın kaynağı bu turda yeniden üretilemedi.** Aynı dosya,
   aynı oran (2:3), `contentFit="cover"`. Ekran görüntüsü / hangi iki yüzeyin
   karşılaştırıldığı bilgisi olmadan sınıflandırma kesinleşmiyor (bkz.
   Doğrulanamayanlar).

---

## 1. Yüzey × poster kaynağı tablosu

| Yüzey | Görsel kaynağı (dosya:satır) | Alan | Boyut | Dil | Fallback zinciri |
|---|---|---|---|---|---|
| **Spotlight sonuç ekranı** | `components/games/Spotlight/index.tsx:477` → `components/games/ResultCard/index.tsx:139, 172-178` | `revealedFilm.poster_url` = **ham** `films.poster_url` (sunucu: `submit-guess/index.ts:573, 788`; resume: `get-daily-challenge/index.ts:202, 220`) | DB'de ne varsa: canlıda `original` (bkz. §3); kutu 148×222 (`ResultCard/styles.ts:37-43`) | Yok (DB değeri) | `filmPosterUrl ?? getPosterUrl(filmPosterPath, 'w342')` — Spotlight `filmPosterPath` geçmiyor; `null` → poster hiç çizilmez (`ResultCard/index.tsx:172`). Yükleme hatası yakalanmıyor (`onError` yok). |
| **Spotlight oyun ekranı** (bağlam için) | `components/games/Spotlight/index.tsx:536-537` | `puzzle_data.backdrop_url` (üretim: `generate-puzzles/index.ts:846`, ham `films.backdrop_url`) | `original` | Yok | `?? ''` |
| **SpotlightBonusCard** (S-2) | `components/gauntlet/SpotlightBonusCard/useSpotlightCardState.ts:46-52` → `SpotlightBonusCard/index.tsx:149-156` | `puzzle_data.backdrop_url` — **poster değil, kare** | `original`, `blurRadius=SPOTLIGHT_MAX_BLUR` | Yok | Boş string → `Image` mount edilmez (`:149`) |
| **Champion (ChampionReveal)** | `components/gauntlet/ChampionReveal/index.tsx:374-375, 536` | `champion.posterUrl` ← `gauntletCore.toW500PosterUrl(films.poster_url)` (`supabase/functions/_shared/gauntletCore.ts:181-206`) | w500 → istemcide **w780**'e yükseltilir (`utils/posterUrl.ts:29, 65-92`) | Yok | w780 1.5 s'de yüklenmezse w500 (`:400-415`); w780 hata → w500 (`:440-458`); w500 hata/boş → yer tutucu + breadcrumb (`:427-449`) |
| Gauntlet poster kartları | `components/gauntlet/PosterTile/index.tsx:225` | `film.posterUrl` (w500, `gauntletCore.ts:206`) | w500 | Yok | — |
| Waiting (before_18) | `components/gauntlet/WaitingChampion/index.tsx:92, 131-132` | `champion.posterUrl` | w500 (yükseltme yok) | Yok | `posterUrl` falsy → poster çizilmez |
| **"Did you watch yesterday's film?"** | `components/gauntlet/PendingWatchFeedbackCard/index.tsx:65-66` | `film.posterUrl` ← `resolvePendingWatchFeedback` → `fetchCandidatesByIds` + `toGauntletFilm` (`generate-gauntlet/index.ts:410-427`) | w500 | Yok | Yok (`fetchCandidatesByIds` çözemezse throw, `:420-425`) |
| **Watchlist / Saved** | `services/watchlist.ts:549, 569` (`toTmdbUrl`, `:517-521`) → `components/Watchlist/WatchlistCard/index.tsx:91-94, 112` | `films.poster_url` | `http…` ise **olduğu gibi** (canlıda `original`); ham yol ise servis w780, kart w500 ekler | Yok | Boş → `''` |
| Watchlist grup başlığı | `components/Watchlist/SessionAccordion/index.tsx:59-62` | aynı | `http…` ise olduğu gibi; ham yol w185 | Yok | — |
| **Film detay** | `app/film/[id].tsx:357, 385, 409, 426` · `toTmdbUrl` `:123-127` · `services/tmdb.ts:12-14, 245-250` | Önce `films.poster_url`; `tmdb_id` varsa **runtime TMDb `poster_path`** ile EZİLİR | DB değeri `http…` ise olduğu gibi; TMDb yolu → **w780** | TMDb `language=en-US`, `include_image_language=en,null` (sabit) | TMDb `null`/`poster_path` boş → DB değeri kalır |
| Film detay paylaşım kartı | `app/film/[id].tsx:1137-1144` → `components/ShareCards/FilmShareCard.tsx:49-72` | Film detayının `film.posterUrl`'ü (yukarıdaki runtime TMDb değeri) | w780 | en-US | Boş → emoji yer tutucu (`:76-77`) |
| Spotlight paylaşım kartı | `components/games/ResultCard/index.tsx:157-166` → `components/ShareCards/GameShareCard.tsx` | **Görsel yok** (grep: `poster`/`Image` eşleşmesi yok) | — | — | — (Spotlight kuralı 5-6 ile uyumlu) |
| Gauntlet paylaşımı | `components/gauntlet/ChampionReveal/index.tsx:299-312` → `utils/gauntletShareText.ts:64` | **Yalnız metin** (panoya kopyalama) | — | — | — |

---

## 2. Spotlight sonuç posterinin yolu

- **Sunucudan geliyor, istemci TMDb'ye gitmiyor.** Kaynak her durumda
  `films.poster_url`, ham hâliyle `revealed_solution.poster_url` alanında.
- Çözüm **yalnız oyun tamamlandığında** iner:
  - Kazanma / tahminle bitiş: `submitSpotlightGuess` → `submit-guess`
    `:659-663` (çözüm filmi sorgusu) → `:781-790` → yanıt `:814`.
  - Haklar harfle bitti: `submitSpotlightLetter` → `submit-guess` `:560-574`
    → yanıt `:623`.
  - Tamamlanmış oyunu yeniden açma: `getDailyChallenge` → `get-daily-challenge`
    `:178-221` (`completed_at != null` koşulu) → yanıt `:311`.
  - İstemci: `components/games/Spotlight/index.tsx:258, 312, 368`.
- Üç sunucu yolunun **hiçbiri** poster URL'ini normalize etmiyor. Gauntlet
  tarafında aynı ıraksama M3 Faz 2'de kapatılmıştı
  (`generate-gauntlet/index.ts:302-326` yorumu: "iki ıraksak yol"); Spotlight
  sonucu o tek-kaynak normalizasyonun dışında.

---

## 3. Ölçülmüş sayılar

Tümü `supabase db query --linked` (salt okunur SELECT) ve TMDb public API GET.

**3a. Akira satırı**

```sql
select id, tmdb_id, title, tr_title, year, poster_url, backdrop_url, curation_tier,
       poster_quality_ok, dominant_color_computed_at, created_at, updated_at
from films where title ilike 'akira%' order by year;
```

| alan | değer |
|---|---|
| id | `08062918-80b7-4e26-93a4-97302b4bade8` |
| tmdb_id | 149 |
| poster_url | `https://image.tmdb.org/t/p/original/neZ0ykEsPqxamsX6o5QNUFILQrz.jpg` |
| backdrop_url | `https://image.tmdb.org/t/p/original/fK40VGYIm7hmKrLJ26fgPQU0qRG.jpg` |
| tr_title | NULL |
| curation_tier | `trending` |
| poster_quality_ok | `true` (dominant_color_computed_at 2026-08-15) |
| updated_at | 2026-08-31 06:00 UTC |

Tek satır; tr/en poster varyantı tutan kolon **yok** (şemada tek `poster_url`).

**3b. Akira — TMDb canlı (`/movie/149`)**

| istek | `poster_path` |
|---|---|
| `language=en-US&include_image_language=en,null` (film detay ekranının isteği) | `/neZ0ykEsPqxamsX6o5QNUFILQrz.jpg` ✅ DB ile aynı |
| dil parametresiz | `/neZ0ykEsPqxamsX6o5QNUFILQrz.jpg` |
| `language=tr-TR` | `/oVc2I0WBRaVCmnL3DO0LaPQuEqh.jpg` (farklı) |
| `language=ja-JP` | `/oVc2I0WBRaVCmnL3DO0LaPQuEqh.jpg` (farklı) |

`/images`: 184 poster; DB'deki dosya `iso_639_1=en`, 2000 px genişlik,
vote_average 7.41. Uygulamada `tr-TR` poster isteyen **hiçbir yol yok**
(`services/tmdb.ts:12-14` sabit `en-US`).

**3c. Yakın Spotlight çözümleri: DB ↔ TMDb en-US**

```sql
select p.date, f.tmdb_id, f.title, f.year, f.poster_url,
       (p.puzzle_data->>'backdrop_url') = f.backdrop_url as backdrop_same,
       f.poster_quality_ok, f.updated_at::date
from daily_puzzles p join films f on f.id = p.solution_ref
where p.game_type = 'spotlight' and p.date between '2026-09-19' and '2026-10-05'
order by p.date;
```

| tarih | film | DB dosya = TMDb en-US | backdrop puzzle = films | poster_quality_ok |
|---|---|---|---|---|
| 09-30 | War and Peace (1968) | ✅ | ✅ | true |
| 10-01 | Everything Everywhere All at Once | ✅ | ✅ | true |
| 10-02 | Toy Story 3 | ✅ | ✅ | true |
| 10-03 | **Akira** | ✅ | ✅ | true |
| 10-04 | Beau Travail | ✅ | ✅ | true |
| 10-05 | The King's Speech | ✅ | ✅ | true |

**6/6 aynı dosya.** (Sorgu aralığı 09-19'dan başlıyor; o tarihten önceki ilk
satır 09-30 — aradaki günlerde Spotlight satırı yok.)

**3d. Akira poster boyutları (HEAD `Content-Length`)**

| boyut | bayt | hangi yüzey |
|---|---|---|
| original | 1.273.277 | Spotlight sonucu, Watchlist (DB değeri `http…` olduğu için) |
| w780 | 171.783 | Champion, film detay |
| w500 | 64.849 | Gauntlet kartları, "dün izledin mi?", Waiting |
| w342 | 32.137 | (ResultCard'ın kullanılmayan `filmPosterPath` fallback'i) |

Spotlight sonucunun 148×222 pt kutusu için `original` ≈ **7,4×** w780, **19,6×** w500.

**3e. `films.poster_url` biçim dağılımı**

```sql
select case when poster_url is null then 'null'
            when poster_url like 'https://image.tmdb.org/t/p/original/%' then 'tmdb_original'
            when poster_url ~ '^https://image.tmdb.org/t/p/w[0-9]+/' then 'tmdb_wN'
            when poster_url like '/%' then 'raw_path' else 'other' end as fmt,
       count(*) from films group by 1;
```

| biçim | n |
|---|---|
| tmdb_original | 2.579 |
| raw_path (`/abc.jpg`) | 948 — 945 `archive`, 2 `trending`, 1 `core` |
| null | 5 |

`backdrop_url`: original 2.574 · raw_path 911 (911'inin posteri de raw) · null 47.

**3f. Spotlight çözümlerinde ham yol**

```sql
select count(*) total,
       count(*) filter (where f.poster_url like '/%') sol_poster_raw,
       count(*) filter (where (p.puzzle_data->>'backdrop_url') like '/%') pd_backdrop_raw, ...
from daily_puzzles p join films f on f.id = p.solution_ref where p.game_type='spotlight';
```

33 Spotlight bulmacası (2026-07-24 → 2026-10-13): çözüm posteri ham yol **0**,
puzzle backdrop ham yol **0**, ileri tarihli 11 bulmacada da **0**. Arşiv dışı
ham yollu 3 filmin (`The Bourne Ultimatum` core, 2 trending) `metadata_json.vote_count`'u
NULL → `generate-puzzles/index.ts:526-528` `minVotes` filtresinden geçemiyor.
Yani ham yol bugün Spotlight'a **yapısal olarak giremiyor**; girerse
`ResultCard` `/abc.jpg`'yi URI olarak verir ve görsel kırık olur (normalizasyon yok).

**3g. Bugünün gauntlet'i**

```sql
select count(*) gauntlets_today,
       count(*) filter (where film_ids @> array['08062918-…']::uuid[]) with_akira,
       count(*) filter (where champion_film_id = '08062918-…') akira_champion
from daily_gauntlets where date = '2026-10-03';
```

1 gauntlet · Akira içeren **0** · Akira şampiyon **0**. Watchlist'te Akira
satırı **0**. Yani bugün Akira'yı Spotlight sonucu dışında gösteren bir
gauntlet/watchlist yüzeyi canlı veride **yok**; karşılaştırma ancak film
detay ekranıyla (ResultCard → keşif/film detay) ya da başka bir filmle
yapılmış olabilir.

---

## 4. Poster quality gate Spotlight yolunda

- Referans düzeltmesi: "Product OS §7.2" Spotlight V3 mekanik tablosudur
  (`docs/os/1_CHOSY_PRODUCT_OS.md:406-418`) ve poster kalitesinden söz etmez.
  Poster quality gate **D-03**'tür (`docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md:276-282`).
- `poster_quality_ok` kolonunu **okuyan** hiçbir Edge Function / servis /
  ekran yok. Tek dokunan: yazan yerel script
  `scripts/compute-dominant-colors.ts:553, 576` (grep: `supabase/functions`,
  `services`, `app`, `components` altında eşleşme 0).
- Gate'in bağlanmaması CTO kararı (18 Ağu 2026, `docs/TEKNIK_BORC.md:2084-2100`).
- Sonuç: Spotlight yolu gate'i **bypass etmiyor**; gate gauntlet dahil
  **hiçbir** yolda uygulanmıyor. Spotlight havuzundaki fiili poster kapısı
  yalnızca `poster_url` dolu mu (`generate-puzzles/index.ts:532`).
- Ölçülen 6 çözümün 6'sı `poster_quality_ok = true` — gate bağlı olsaydı da
  bugünkü sonucu değiştirmezdi.

---

## 5. Sınıflandırma

| # | Bulgu | Sınıf | dosya:satır | İş |
|---|---|---|---|---|
| F-1 | Spotlight sonucu `films.poster_url`'ü normalizasyonsuz (`original`) gösteriyor; diğer gauntlet yüzeyleri `toW500PosterUrl` ile w500/w780. Aynı görsel, farklı çözünürlük/yük (1,27 MB vs 65–172 KB). Ham yollu bir film çözüm olursa kırık görsel. | **(b)** tek yüzeyde normalizasyon eksik (alan doğru, biçim ham) | `submit-guess/index.ts:573, 788` · `get-daily-challenge/index.ts:220` · `ResultCard/index.tsx:139` | S–M |
| F-2 | Film detay posteri runtime TMDb `poster_path` ile ezilir; DB'deki dosyadan ayrışabilir. Bugün 6/6 aynı. | **(a)** bilinçli fark (EN zorlaması yorumu `services/tmdb.ts:11`) + gizli sürüklenme riski | `app/film/[id].tsx:395-409` | — (ölçüm) |
| F-3 | Watchlist `http…` değerini olduğu gibi geçiriyor → `original`; ham yol için servis w780, kart w500, accordion w185 — **üç farklı** boyut kuralı. | **(b)**-benzeri tutarsızlık (Spotlight dışı, kapsam bilgisi için) | `services/watchlist.ts:517-521` · `WatchlistCard/index.tsx:91-94` · `SessionAccordion/index.tsx:59-62` | S |
| F-4 | `ResultCard` poster `Image`'inde `onError` yok; yükleme hatası iz bırakmaz. | Kural 1 ile ilişkili gözlem | `ResultCard/index.tsx:173-178` | S |
| F-5 | Veri tutarsızlığı (`films` satırı ↔ TMDb) — Akira dahil 6/6'da **ölçülmedi**. | **(c) değil** (örneklemde) | §3c | — |
| F-6 | Kapsam dışı yan gözlem: Akira bugün `curation_tier = 'trending'`, Spotlight havuzu `core/extended` (`generate-puzzles/index.ts:499`). Bulmaca 2026-09-30'da üretildi, film satırı 2026-08-31'den beri değişmemiş. Repo'daki üretim yolu bu filmi seçemezdi. | Doğrulanamadı — bkz. aşağı | `generate-puzzles/index.ts:499` | — |

### Düzeltme seçenekleri (UYGULANMADI — karar CTO'nun)

- **F-1 / seçenek A (sunucu):** `submit-guess` ve `get-daily-challenge`'ın
  `revealed_solution.poster_url`'ü, gauntlet'in kullandığı normalizasyonla
  üretmesi. ⚠️ `toW500PosterUrl` şu an `gauntletCore.ts` içinde **export
  edilmeyen** yerel fonksiyon; paylaşılan modüle açmak `_shared` yüzeyini
  değiştirir ve iki Edge Function deploy'u ister → DUR noktası.
- **F-1 / seçenek B (istemci):** `ResultCard`/Spotlight'ın gelen URL'i
  `utils/posterUrl.ts` ile hedef boyuta indirmesi. ⚠️ `upgradePosterUrl`
  bilinçli olarak **küçültme yapmıyor** (`utils/posterUrl.ts:61-63, 81-89`);
  `original` → w342/w500 için ya bu kural değişir ya ikinci bir yardımcı
  gerekir. Ayrıca ham yol (`/abc.jpg`) bu desenle eşleşmez (`not_tmdb`).
- **F-1 / seçenek C (veri):** `films.poster_url`'ü tek biçime göçürmek
  (ör. yalnız dosya yolu) — şema/veri sözleşmesi değişikliği, DUR noktası.
- **F-2:** Ya kabul (bilinçli EN zorlaması) ya film detayının DB değerini
  tercih etmesi. Ürün kararı.
- **F-4:** `onError` + breadcrumb (ChampionReveal `:440-458` deseni).

---

## DUR NOKTASI gerektiren maddeler

1. **F-1 seçenek A** — `_shared/gauntletCore.ts` dışa açılan yüzeyinin
   değişmesi + `submit-guess` / `get-daily-challenge` redeploy'u. Paylaşılan
   modül deploy sırası kuralı (chosy-conventions §9) geçerli.
2. **F-1 seçenek C** — `films.poster_url` biçim göçü (948 ham + 2.579 tam URL);
   veri sözleşmesi değişikliği.
3. **F-1 seçenek B** — `utils/posterUrl.ts`'in "küçültme yok" ilkesinin
   değişmesi (C.9b-UI C7 CTO kararı, 19.09.2026).
4. **F-2** — film detay posterinin kaynağı (DB mi, runtime TMDb mi) ürün kararı.

---

## Doğrulanamayanlar

- **Gözlenen görsel farkın kendisi.** Ekran görüntüsü yok; hangi iki yüzeyin
  karşılaştırıldığı bilinmiyor. Veride aynı dosya, aynı 2:3 oran,
  `contentFit="cover"` — fark yalnız çözünürlük/yükleme süresi olarak
  ölçülebildi. Farklı **görsel** (başka afiş) görüldüyse, en olası yüzey
  film detay ekranı (runtime TMDb); ama bugün Akira için o da aynı dosyayı
  döndürüyor.
- **Deploy edilmiş Edge Function sürümleri** repo ile diff'lenmedi
  (`submit-guess`, `get-daily-challenge`, `generate-puzzles`). Rapordaki
  satır referansları master @ 8814966'ya aittir.
- **F-6 (Akira'nın tier'ı):** tier geçmişi tutan tablo yok; Akira'nın
  2026-09-30'da `core/extended` olup sonradan `trending`e geçip geçmediği ya
  da bulmacanın başka bir yolla (deploy edilmiş farklı kod, elle üretim)
  oluşturulup oluşturulmadığı doğrulanamadı. `updated_at` 08-31 olduğu için
  satırın bulmaca üretiminden sonra değişmediği görülüyor — bu, repo'daki
  havuz filtresiyle çelişiyor.
  **→ P-1 EK'te çözüldü:** çelişki yok; Spotlight 30 Eyl'den beri editoryal
  takvimden üretiliyor, tier filtresi o yolda uygulanmıyor (§E-2).
- expo-image disk önbelleğinde eski bir URL'in kalıp kalmadığı cihazda
  ölçülmedi.

---

# P-1 EK — Spotlight bulmaca bütünlüğü (3 Eki 2026, READ-ONLY)

## EK yönetici özeti

1. **backdrop bütünlüğü sağlam:** son 14 günün (09-20 → 10-03) **4/4**
   bulmacasında `puzzle_data.backdrop_url = films.backdrop_url`; tüm V3
   bulmacalarında (28) eşleşmeyen **0**.
2. **Repo kuralına uymayan bulmaca 0.** 30 Eyl'den beri üretilen 14 bulmacanın
   14'ü editoryal takvim sırasını birebir izliyor (position 1, day_number
   100 → 86; 98. gün başlık uzunluğu yüzünden atlanmış — kodla tutarlı).
   Akira'nın `trending` olması kural ihlali **değil**.
3. **Deploy = repo.** Canlı `generate-puzzles` v53 (güncelleme 2026-10-01
   06:19 UTC) ve bağımlı 4 `_shared` dosyası, master ile satır sonları hariç
   **birebir aynı**.
4. **Yeni risk (ölçüldü):** editoryal Spotlight havuzunda **33/400** filmin
   `poster_url` VE `backdrop_url`'ü ham yol (`/abc.jpg`). Spotlight yolu hiçbir
   yerde normalize etmediği için bu filmler çözüm olduğunda oyun karesi,
   bonus kartı karesi ve sonuç posteri **geçersiz URI** alır. İlki kuyrukta
   44. sırada (Ocean's Eleven). Çıkmış çözümler içinde: **0**.
5. **Kapsam dışı ama bütünlükle ilgili:** 2026-08-12 → 2026-09-29 arası
   (**49 gün**) Spotlight bulmacası **yok** (satır sayısı 0, acil havuz 0).

## E-1. backdrop eşleşmesi (son 14 gün)

```sql
select count(*) total,
       count(*) filter (where p.puzzle_data->>'backdrop_url' = f.backdrop_url) bd_match,
       count(*) filter (where p.puzzle_data->>'backdrop_url' is distinct from f.backdrop_url) bd_mismatch,
       count(*) filter (where p.puzzle_data->>'backdrop_url' is null) pd_bd_null,
       count(*) filter (where f.id is null) sol_missing, min(p.date), max(p.date)
from daily_puzzles p left join films f on f.id = p.solution_ref
where p.game_type='spotlight' and p.date between '2026-09-20' and '2026-10-03';
```

| total | bd_match | bd_mismatch | pd_bd_null | sol_missing | aralıkta ilk/son |
|---|---|---|---|---|---|
| 4 | 4 | 0 | 0 | 0 | 09-30 / 10-03 |

14 günlük pencerede yalnız 4 bulmaca var (bkz. E-5). Tüm tablo (33 satır):
V3 bulmacalarının 28'inde eşleşme 28/28; 07-24 → 07-28 arası 5 bulmaca V3
öncesi (`puzzle_data.v` NULL, backdrop alanı yok) — karşılaştırılamaz,
istemci bunları `staleFormat` olarak gösterir (`Spotlight/index.tsx:248`).
Eşleşmeyen satır yok, listelenecek bir şey yok.

## E-2. Çözüm tier dağılımı ve kural uyumu

```sql
select coalesce(f.curation_tier,'(film yok)') tier, count(*) n,
       count(*) filter (where p.date between '2026-09-20' and '2026-10-03') n_14d
from daily_puzzles p left join films f on f.id=p.solution_ref
where p.game_type='spotlight' group by 1;
```

| tier | tümü (33) | son 14 gün (4) |
|---|---|---|
| core | 24 | 2 |
| extended | 8 | 1 |
| trending | 1 (Akira, 10-03) | 1 |
| diğer | 0 | 0 |

**Hangi kural geçerli — iki dönem:**

| Dönem | Üreten yol | Kural | Uymayan |
|---|---|---|---|
| 07-29 → 08-11 (14 V3) | `fetchFilms` (`generate-puzzles/index.ts:477-565`) | `curation_tier ∈ {core, extended}` (`:499`), `vote_count ≥ minVotes` (Spotlight için 3000 tavanı, `:485-487`), backdrop/poster dolu | **0** — tier 14/14 core/extended, en düşük vote_count 3.382 |
| 09-30 → 10-13 (14) | `fetchSpotlightEditorialPool` (`:594-633`), commit `1adc164` + `7a281bd` (30 Eyl) | Takvim sırası `position ASC, day_number DESC`; backdrop+poster dolu; başlık maskesi oynanabilir (`:623-625`); **tier/vote filtresi YOK** (yorum `:573-574`: "Genel films havuzu Spotlight için KULLANILMAZ") | **0** — 14/14 takvim sırasında |
| 07-24 → 07-28 (5, V3 öncesi) | o günkü kod (V1/V2) | değerlendirilmedi | — |

Editoryal sıra kanıtı (`editorial_calendar_films` join):
09-30 War and Peace (d100/p1) · 10-01 EEAAO (d99/p1) · 10-02 Toy Story 3
(d97/p1) · **10-03 Akira (d96/p1)** · 10-04 Beau Travail (d95/p1) · … ·
10-13 Magnolia (d86/p1). 98. gün p1 = "BARDO, False Chronicle of a Handful of
Truths" → maskede 30'dan fazla harf → `:625` eler; kod ile tutarlı.

Bu dönemdeki 6 çözümün `vote_count`'u 3000'in altında (War and Peace 165,
Beau Travail 376, Wheel of Fortune and Fantasy 371, Frances Ha 1.865,
Whisper of the Heart 2.273, Das Boot 2.509). Editoryal yol bu eşiği
uygulamadığı için **kural ihlali değil**; ürün etkisi (tanınırlık / zorluk)
ayrı bir soru, bu turda ölçülmedi.

## E-3. Canlı ↔ repo diff

```
supabase functions list --project-ref xpcwihldlnlmyopjubdc
supabase functions download generate-puzzles --project-ref xpcwihldlnlmyopjubdc --workdir <scratchpad>/p1_deployed
diff <(tr -d '\r' < deployed) <(tr -d '\r' < repo)
```

| Function | Canlı sürüm | Canlı güncelleme (UTC) |
|---|---|---|
| generate-puzzles | v53 | 2026-10-01 06:19:59 |
| get-daily-challenge | v30 | 2026-07-29 08:29:18 |
| submit-guess | v37 | 2026-08-05 17:52:02 |

`generate-puzzles` indirmesi 5 dosya: `generate-puzzles/index.ts`,
`_shared/auth.ts`, `_shared/gameUtils.ts`, `_shared/sentry.ts`,
`_shared/spotlightLetters.ts`. **5/5 dosyada fark 0** (CRLF normalize
edildikten sonra). Deploy yapılmadı; indirme repo ağacına değil scratchpad'e
yazıldı.

Not: canlı v53 (10-01 06:19 UTC) 09-30 13:55 UTC'deki üretim koşumundan
**sonra** deploy edilmiş. Arada repo'da tek commit var: `320e2c5` (09-30
21:19 +03, "acil havuz ekleme hatası artık yutulmuyor"). 09-30 batch'i
büyük olasılıkla `7a281bd` hâliyle üretildi; o ara sürüm canlıdan
indirilemez (yalnız son sürüm iner) — **doğrulanamadı**. `320e2c5` Spotlight
seçim sırasına dokunmuyorsa (commit başlığı acil havuz) sonuç değişmez; bu
commit'in diff'i bu turda okunmadı.

`get-daily-challenge` ve `submit-guess` indirilmedi (iş tanımı yalnız
puzzle-üreten function'ı istiyor); önceki rapordaki satır referansları
yalnız repo için geçerli.

## E-4. Ham path poster sayıları

```sql
select count(*) cal_rows, count(distinct film_id) films,
       count(*) filter (where f.poster_url like '/%') raw_poster,
       count(*) filter (where f.backdrop_url like '/%') raw_backdrop,
       count(*) filter (where f.backdrop_url is null or f.poster_url is null) missing_img
from editorial_calendar_films e join films f on f.id=e.film_id;
```

| Kapsam | Ham `poster_url` |
|---|---|
| Editoryal Spotlight havuzu (400 satır / 400 film) | **33** (33'ünün backdrop'u da ham) |
| — bunlardan maske filtresini geçmesi beklenen (SQL yaklaşığı: A-Z harf sayısı 3..30) | **31** ("300": 0 harf; "Birdman or (…)": 39 harf → elenir) |
| — tier'ı | 32 `archive`, 1 `core` (The Bourne Ultimatum) |
| Çıkmış Spotlight çözümleri (33 bulmaca, tüm zamanlar) | **0** |
| Çıkmış çözümler — editoryal dönem (14) | **0** |

Kuyruktaki ilk ham-yollu filmler (`position ASC, day_number DESC` sırası):
44 Ocean's Eleven (d57/p1) · 45 The Quiet Girl (d56/p1) · 46 The Princess
Bride (d55/p1) · 79 Mission: Impossible – Fallout (d22/p1) · 102 Scott
Pilgrim vs. the World (d99/p2) … (tam liste sorgu çıktısında, 33 satır).

**Etkisi (kod okumasıyla):** bu filmler çözüm olduğunda
- oyun karesi `Image source={{ uri: '/abc.jpg' }}` (`Spotlight/index.tsx:536-537`)
  — oyunun tek görsel ipucu çizilmez;
- bonus kartı karesi aynı (`SpotlightBonusCard/index.tsx:149-151`);
- sonuç posteri aynı (`ResultCard/index.tsx:139, 173-174`);
- üretim tarafında `spotlightData` yalnız `!solution.backdrop_url` kontrol
  ediyor (`generate-puzzles/index.ts:820`), biçimi değil.

Gauntlet aynı filmleri `toW500PosterUrl` ile düzeltiyor
(`_shared/gauntletCore.ts:198-201`); Spotlight yolunda karşılığı yok.

**Ne zaman?** Kuyruk sırası 44 ≈ 30 Eyl + ~42 gün → **Kasım 2026 ortası**
civarı. Kesin tarih `buildTitleMask` ile kuyruğu simüle etmeyi gerektirir
(kuyrukta 44'ten önce elenen başlık sayısı tarihi öne çeker) —
**doğrulanamadı**. Bugün üretilmiş en ileri tarih 10-13 (Magnolia, sıra 15).

## E-5. Kapsam dışı gözlem — 49 günlük boşluk

```sql
select count(*) filter (where date between '2026-08-12' and '2026-09-29') gap_rows,
       count(*) filter (where is_emergency_pool) emergency_rows,
       count(*) filter (where date is null) null_date
from daily_puzzles where game_type='spotlight';
```

gap_rows **0** · emergency_rows **0** · null_date **0**. 2026-08-12 →
2026-09-29 arasında Spotlight bulmacası yok ve acil havuz satırı da yok.
Tüm zamanlarda Spotlight `game_scores` satırı **6** (3 kullanıcı). Bu dönemde
istemcinin ne gösterdiği (hata durumu mu, boş kart mı) bu turda incelenmedi.

## E-6. Poster quality gate atfı

CTO notu doğru: gate **D-03**'tür (`docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md:276`),
Product OS §7.2 değil; 18 Ağu 2026 kararıyla hiçbir okuma yoluna bağlı değil
(`docs/TEKNIK_BORC.md:2084-2100`). Editoryal Spotlight havuzu
`poster_quality_ok`'u da okumaz (`generate-puzzles/index.ts:594-633`).

## EK — DUR NOKTASI gerektiren maddeler

1. **E-4 ham yol:** düzeltmenin yeri (üretimde `puzzle_data.backdrop_url`'ü
   normalize etmek · editoryal havuzda ham yolu elemek · `films` verisini
   tek biçime göçürmek · istemcide normalize etmek) mimari karar. Elemek
   havuzu 400 → ~367'ye düşürür; normalize etmek `toW500PosterUrl`'ün
   paylaşılmasını ve Edge Function redeploy'unu gerektirir. **Takvim:**
   ilk etkilenen bulmaca ~Kasım ortası; bulmacalar ~14 gün önceden üretiliyor.
2. **E-5 boşluk:** 49 günlük üretim boşluğunun nedeni (cron, havuz, hata)
   ayrı keşif konusu.

## EK — Doğrulanamayanlar

- 09-30 batch'ini üreten kodun tam sürümü (canlıda yalnız v53 var).
- Ham-yollu ilk filmin kesin bulmaca tarihi (maske simülasyonu yapılmadı).
- `get-daily-challenge` ve `submit-guess` canlı sürümleri repo ile diff'lenmedi.
- 49 günlük boşluğun nedeni.
