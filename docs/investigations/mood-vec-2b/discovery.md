# MOOD-VEC-2b Adım 0 — Arşiv geri kazanımı keşfi

30 Eki 2026 · dal `feat/mood-vec-2b` (kaynak HEAD `b470136`) · **yalnız okuma**: canlıya yazma yok, OMDb yok.
Kaynaklar: canlı DB (SELECT + anon REST dökümü), `data/imdb/title.ratings.tsv.gz` + `title.basics.tsv.gz`
(ikisi de gitignored), TMDb `/movie/{id}/external_ids` (yalnız 50 film, anahtar loglanmadı).
Simülasyon betiği scratchpad'de çalıştı, repoya **eklenmedi** (typecheck sayısı etkilenmez).

## Özet (CTO için)

| | |
|---|---|
| Arşiv | 1.633 film |
| IMDb veri setinden eşleşen | 1.562 (%95,7): 1.108 `imdb_id` ile, 454 title+year ile |
| Kural B + `determineCurationTier` ile arşivden çıkacak | **936** (127 core, 809 extended); 626 arşivde kalır |
| Bunlardan havuz kapısını **şimdi** geçen | 431 (311'i hiçbir dış veri gerekmeden) |
| Havuz kapısını geçmeyen (release_date NULL) | 505 → TMDb details gerekir |
| 8 ikonik filmin hepsi geri kazanılır | 2 core (Groundhog Day, Get Out), 6 extended |
| Yüzdelik etkisi | p55 89.354→73.332, p80 334.411→289.128; banttan çıkan 44, giren 70 (aşağıda f) |

En büyük sürpriz: **311 arşiv filmi, DB'deki mevcut `imdb_rating`/`imdb_votes` ile zaten kural B'ye uyuyor**
(rating ≥ 5.8, votes ≥ 5.000), hepsi İngilizce etiketli, release_date/poster/runtime dolu, hepsi havuz kapısını geçiyor.
Yalnız `curation_tier` güncellenmemiş. 249'u eski kuralda (6.5) bile extended olurdu.
`tier-b-apply.sql` yalnız 6 filmi *arşive* alıyor; bu yöndeki (arşivden çıkarma) düzeltme hiç yapılmamış.

## a. Arşiv sayımı

SQL (Türkçe etiket kümesi = `Komedi, Aksiyon, Gerilim, Macera, Romantik, Animasyon, Aile, Fantezi, Bilim Kurgu, Korku, Suç, Gizem, Tarih, Müzik, Belgesel, Savaş, TV Film`;
`Drama` ve `Western` iki dilde aynı olduğu için sayılmadı):

```sql
select count(*) total,
  count(*) filter (where genres && array['Komedi', ... 'TV Film']) tr_label,
  count(*) filter (where imdb_id is null) no_imdb_id,
  count(*) filter (where release_date is null) no_reldate,
  count(*) filter (where imdb_rating is null) no_rating,
  count(*) filter (where imdb_votes is null) no_votes
from films where curation_tier = 'archive';
```

| alan | sayı |
|---|---|
| toplam | 1.633 |
| Türkçe etiketli / İngilizce etiketli | 870 / 763 |
| `imdb_id` boş | 518 (469'u Türkçe etiketli) |
| `tmdb_id` boş | 0 |
| `profile_vector` boş (film_profiles) | 0 |
| `poster_url` boş | 5 |
| `runtime` / `year` boş | 0 / 0 |
| `release_date` boş | 951 (**870'i Türkçe etiketlilerin tamamı**, +81 İngilizce) |
| `release_date` gelecekte | 0 |
| `imdb_rating` boş | 1.164 |
| `imdb_votes` boş / 0 | 1.057 / 21 |
| `vote_average` boş veya 0 | 48 |
| `tmdb_vote_count` | tüm arşivde NULL (`metadata_json.vote_count` da NULL) → TMDb oy sayısı yok |

Eksik-alan kesişimi (tümü `curation_tier='archive'`):

| etiket | imdb_id | release_date | imdb_rating | imdb_votes | poster | film |
|---|---|---|---|---|---|---|
| EN | dolu | dolu | dolu | dolu | dolu | 469 |
| TR | **boş** | **boş** | boş | boş | dolu | 468 |
| TR | dolu | **boş** | boş | boş | dolu | 397 |
| EN | dolu | dolu | boş | dolu | dolu | 104 |
| EN | dolu | dolu | boş | boş | dolu | 103 |
| EN | boş | boş | boş | boş | dolu | 43 |
| EN | dolu | boş | boş | boş | dolu | 38 |
| TR | dolu | boş | boş | boş | **boş** | 4 |
| EN | boş | dolu | boş | boş | dolu | 3 |
| EN | boş | dolu | boş | dolu | dolu | 3 |
| TR | boş | boş | boş | boş | **boş** | 1 |

Okuma: Türkçe etiketli 870 film MoodFlix döneminden kalma tek bir toplu yükleme izi taşıyor
(hepsinde release_date, imdb_rating, imdb_votes boş; Türkçe tür). İngilizce 469 film "tam" ve gerçekten düşük tanınırlıkta.

## b. imdb_id eşleştirme yolu

**`imdb_id` boş 518 film için** iki yol ölçüldü (title+year için sıkı sürüm: tam yıl + runtime ±5 dk + tekil):

| yol | sonuç (518 film) |
|---|---|
| title+year, gevşek (±1 yıl) | 443 tekil + 14 runtime ile tekil + 2 belirsiz + 59 yok |
| title+year, **sıkı** (tam yıl + runtime ±5 + tekil) | **429 güvenli**; 12 tam yıl ama runtime uyuşmaz; 2 aynı yılda çoklu; 16 yalnız ±1 yıl; 59 yok |
| TMDb `external_ids` (50 filmlik örnek, 518'den her ~10'uncu) | 47/50 (%94) `imdb_id` döndü, 3 null; döneni 47/47 IMDb ratings dosyasında |

Çapraz kontrol (TMDb referans, 50 örnek): title+year 39 uyumlu, **1 uyumsuz**, 1 belirsiz, 6 bulunamadı.
Uyumsuz vaka: *Whiplash* (tmdb 367412, yıl 2013, runtime **18 dk**): bu 2013 kısa filmi. `basics` süzgecim
(movie + tvMovie) kısa filmi dışladığı için title+year ±1 yılla 2014 uzun metrajını buldu. TMDb doğru, title+year yanlış.
Runtime ±5 şartı bu vakayı yakalıyor (18 dk ≠ 106 dk).

Yanlış eşleşme riski: (1) kısa/dizi başlıkları ile komşu yıl, (2) aynı başlık + aynı yıl iki yapım, (3) yeniden çevrim.
Önlem: TMDb `external_ids` **birincil** (kimlik TMDb'nin kendi eşlemesi), title+year yalnız **çapraz kontrol**;
yalnız TMDb null döndüğünde ve sıkı kuralı tekil geçtiğinde kabul, geri kalanı elle inceleme listesine.
Maliyet: ≤518 TMDb çağrısı (~2,5 dk @ 250 ms), TMDb ücretsiz.

**Mevcut `imdb_id`'lerin sağlığı** (1.115 dolu): 1.108'i ratings'te, 1.058'i basics'te (movie/tvMovie);
yıl uyumlu 1.056, uyumsuz 2 (`¿Y Cómo Es Él?` 2022↔2020, `Il nano e la strega` 1973↔1975 → yanlış `imdb_id` ihtimali).
7 film `imdb_id` dolu ama ratings'te yok.

Kaynak betik hâlâ yalnız aktif tier'ları kapsıyor: `scripts/backfill-imdb-dataset.ts:33` (`TIERS = ['core','extended','trending']`).

## c. Eşik simülasyonu (yalnız hesap)

Kural B (`scripts/assign-tiers.ts:159-160`, standart: rating < 5.8 veya votes < 5.000) + `determineCurationTier` (`:182`),
`current_tier: 'archive'`. Eşleşen 1.562 film (çözülemeyen 71).

| grup | eşleşen | core | extended | arşivde kalır |
|---|---|---|---|---|
| tümü | 1.562 | 127 | 809 | 626 |
| TR etiketli | 808 | 56 | 405 | 347 |
| EN etiketli | 754 | 71 | 404 | 279 |
| release_date NULL | 888 | 60 | 445 | 383 |
| release_date dolu | 674 | 67 | 364 | 243 |
| yol = mevcut imdb_id | 1.108 | 106 | 475 | 527 |
| yol = title+year | 454 | 21 | 334 | 99 |

- Geri kazanılabilir (tier ≠ archive): **936**. Arşivde kalan 626: 515'i votes < 5.000, 111'i votes ≥ 5.000 ama rating < 5.8.
- Not: metascore, oscar ve keyword arşiv satırlarında çoğunlukla boş; bu yüzden core sayısı alt sınır (yalnız rating ≥ 8 / auteur+7.0 yolları çalışıyor).
- **votes ≥ 100.000: 330 film** eşleşen arşivde, bunun **309'u geri kazanılabilir**.
- Geri kazanılabilir 936'nın votes dağılımı: 5k–20k 416 · 20k–50k 88 · 50k–100k 91 · 100k–500k 247 · ≥500k 62.
- Tür (EN'e normalize, çoklu): Drama 463, Comedy 272, Action 240, Thriller 194, Adventure 169, Romance 148, Fantasy 140, Crime 131, Animation 123, Sci-Fi 111, Family 97, Horror 75, History 66, Mystery 62, War 54, Music 47, Documentary 24, TV Movie 16, Western 6.
- Birincil tür (`genres[0]`): Drama 254, Action 137, Comedy 118, Animation 80, Horror 50, Romance 41, Crime 40, Adventure 38, Thriller 35, Sci-Fi 28, Fantasy 22, War 19, Documentary 19, Family 16, Music 14, Mystery 11, History 10, TV Movie 2, Western 2.

**8 ikonik film**

| film | tmdb_id | DB imdb_id | bulunan tconst (yol) | rating | votes | sim tier |
|---|---|---|---|---|---|---|
| Superbad | 8363 | NULL | tt0829482 (title+year) | 7,6 | 706.728 | extended |
| Hot Fuzz | 4638 | NULL | tt0425112 (title+year) | 7,8 | 574.612 | extended |
| Groundhog Day | 137 | NULL | tt0107048 (title+year) | 8,0 | 742.702 | core |
| Ferris Bueller's Day Off | 9377 | NULL | tt0091042 (title+year) | 7,8 | 421.863 | extended |
| Bridesmaids | 55721 | NULL | tt1478338 (title+year) | 6,8 | 329.238 | extended |
| Paddington 2 | 346648 | NULL | tt4468740 (title+year) | 7,8 | 117.092 | extended |
| Ocean's Eleven (2001) | 161 | NULL | tt0240772 (title+year) | 7,7 | 687.132 | extended |
| Get Out | 419430 | tt5052448 | tt5052448 (imdb_id) | 7,8 | 843.625 | core |

Hepsi release_date NULL + Türkçe etiketli. *Ocean's Eight* (402900) de aynı grupta, listede değildi.

## d. Uygunluk engelleri

Havuz kapısı: `supabase/functions/_shared/gauntletCore.ts:306-348` (`fetchPool`): `profile_vector` NOT NULL,
`poster_url`, `runtime`, `year`, `release_date` NOT NULL ve `release_date <= bugün`, ardından `recognitionMissing` ve `releasedBy` elemesi.

Geri kazanılabilir 936 film içinde:

| engel | film |
|---|---|
| `release_date` NULL (kapıyı geçmez) | **505** |
| `poster_url` NULL | 1 |
| `runtime` / `year` NULL | 0 / 0 |
| `profile_vector` NULL | 0 |
| `director` NULL | 355 |
| `original_language` NULL | 354 |
| Türkçe tür etiketi | 461 |
| `imdb_id` NULL (title+year/TMDb ile yazılacak) | 355 |
| kapıyı doğrudan geçen | **431** |

Grup bazında geri kazanım:

| grup | film | engel | dış çağrı |
|---|---|---|---|
| **A** DB'de zaten rating+votes dolu, kural B'ye uyuyor | 311 | yok (hepsi İngilizce, date/poster/runtime/director dolu) | **0** |
| **B** İngilizce, tarihli, rating/votes boş ama `imdb_id` var | ≈120 (431 − 311) | yalnız rating/votes (veri seti) | 0 (dosya) |
| **C** release_date NULL (çoğu Türkçe etiketli) | 505 | date, TR tür, director/language, kısmen imdb_id | 505 TMDb details + ≤355 external_ids |

Mevcut betik kapsamı: `scripts/backfill-film-metadata.ts` yalnız `director`, `original_language` ve OMDb'den `imdb_votes` dolduruyor
(`:176-209` TMDb detail çağrısı). `release_date`, `genres`, `runtime`, `poster_url` **yazmıyor**; yani C grubunun asıl engeli
(release_date + tür) için hazır bir betik yok. OMDb yolu bu işte kullanılmayacağı için `imdb_votes` kısmı da
`backfill-imdb-dataset.ts` ile yapılmalı (kapsamı arşive açılarak).
TMDb detail çağrısı `language` vermiyor (varsayılan en-US), yani aynı çağrı Türkçe etiketleri de İngilizceye çevirir.

## e. Tür etiketleri

- Arşivde Türkçe etiketli film: **870** (aday 936 içinde 461). Aktif tier'larda yalnız 6 Türkçe etiket var (Aksiyon 2, Gerilim 2, Gizem 1, Fantezi 1).
- **Gauntlet normalleştirmiyor:** `gauntletCore.ts:216` `primaryGenre = f.genres[0]` ham; çeşitlilik kuralı `:653-657`
  aynı birincil türü ≤ 2 sayıyor. `Comedy` ile `Komedi` farklı sayılır → bir dörtlüde 4 komedi geçebilir.
  Bu bugün 6 filmle sınırlı, C grubu Türkçe etiketle gelirse büyür.
- İstemci tarafında normalleştirme haritası zaten var: `utils/filmFilters.ts:14-36` (`TR_TO_EN_GENRE`), `normalizeGenre` `:47`.
  Yalnızca UI/lokalizasyon için kullanılıyor (`app/film/[id].tsx:67`, `app/roulette.tsx:86`).
- Öneri: harita yazmak yerine C grubunda TMDb details (en-US) ile `genres` yeniden yazılır; böylece Edge Function'a
  harita eklenmez (mimari karar gerektirmez). Ek harita ancak details çağrısı atlanırsa gerekir.
- Çevrilemeyen: `TV Film` → `TV Movie` (haritada var), `Drama`/`Western` aynı.

## f. Yüzdelik cetveli etkisi (yalnız hesap)

Havuz tahmini: aktif tier + yayınlanmış + poster/runtime/year; yüzdelik `gauntletCore.ts:574` `percentRanks`, puan `:601-630`
(bant 55/80, orta 67,5, yarı genişlik 32,5). Tüm 936 filmin havuza girdiği varsayıldı (üst sınır).

| | önce | sonra (936 eklenince) |
|---|---|---|
| havuz (votes'lu) | 1.951 | 2.887 |
| p55 votes | 89.354 | 73.332 |
| p80 votes | 334.411 | 289.128 |
| medyan | 67.741 | 56.401 |
| bant (p55–p80) içi, eski filmler | 488 | 514 |
| bant içi, yeni filmler | – | 207 / 936 |
| mevcut filmlerden banttan çıkan / giren | – | 44 / 70 |
| ortalama tanınırlık puanı (eski filmler) | 0,325 | 0,349 |
| ortalama puan (yeni filmler) | – | 0,275 |
| votes ≥ 100k oranı | %43,2 | %39,9 |

Yorum: cetvel kayıyor ama küçük (p55 −%18, p80 −%14). Eski filmlerin ortalama puanı hafifçe **artıyor**
(bant biraz alt tarafa genişliyor), yeni filmler ortalamanın altında puanlanıyor (daha çok düşük-oy kuyruğunda).
Not: 311'lik A grubu tek başına votes 5k–100k arası ve tamamı düşük-orta uçta; cetveli aşağı çeken pay burada.
Yalnız A için ayrı ölçüm yapılmadı.

## Riskler

1. **Yanlış `imdb_id`** (title+year, kısa/komşu yıl): TMDb birincil + runtime ±5 şartı + 28 şüpheli film elle incelenir.
2. **Mevcut `imdb_id` hatası**: 2 film yıl uyumsuz, 7 film dosyada yok; yazmadan önce doğrulanmalı.
3. **Tür çeşitliliği**: Türkçe etiket normalleştirilmezse `:653` kuralı sessizce zayıflar.
4. **release_date**: C grubunun 505 filmi bugün havuza girmiyor; date yazılmadan tier değişikliği havuza etki etmez (ama tier yine de yanlış kalır).
5. **core eksik**: metascore/oscar/keyword yok → bazı gerçek core filmler extended çıkar (kabul edilebilir, alt sınır).
6. **Gauntlet çeşitliliği**: `director` NULL 355 film "bilinmeyen yönetmen" kovasına düşer, dörtlüde en fazla 1 (`:645`); C grubunda director doldurulmazsa seçilme olasılığı düşer.
7. **Yazma yolu**: canlı yazma anahtarı notu (hafıza: `SUPABASE_SERVICE_ROLE_KEY` bu projede 401, çalışan `SUPABASE_SECRET_KEY`) Adım 1'de netleştirilmeli.

## Öneri (uygulanmadı)

1. **A önce (311 film, 0 dış çağrı, 0 engel).** Yalnız `curation_tier` UPDATE'i; yedek tablo + rollback SQL, `tier-b-apply.sql` kalıbıyla.
   Her UPDATE `AND curation_tier='archive'` korumalı. En düşük risk, en yüksek getiri/maliyet oranı (8 ikoniğin hiçbiri bu grupta değil ama 311 film havuza girer).
2. **B (≈120 film)**: `backfill-imdb-dataset.ts` kapsamını arşive açıp yalnız SQL üret; rating/votes yazılır, tier A ile aynı kuralla.
3. **C (505 film)** — ikonik filmlerin hepsi burada: yeni bir betik, TMDb details (date, en-US tür, director, language) + external_ids; sonra B ile aynı rating/votes yolu.
   Tahmini ~860 TMDb çağrısı (~4–5 dk), ücretsiz. En çok iş, en yüksek kullanıcı değeri; onaydan sonra.
4. Her adım ayrı onay + ayrı SQL; CTO onayı gereken noktalar: yeni betik (C), `backfill-imdb-dataset.ts` kapsam genişletmesi (B), bant yüzdeliği (f) kabulü.

**DUR NOKTASI 1:** kapsam ve uygulama planı CTO onayına kadar Adım 1'e geçilmedi.
