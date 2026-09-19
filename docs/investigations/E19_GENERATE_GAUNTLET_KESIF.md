# E-19 — `generate-gauntlet` editoryal dal keşfi

**Tarih:** 19 Eylül 2026 · **Mod:** salt okunur (`/kesif`) · **Kapsam:** yalnızca
`generate-gauntlet`'in editoryal takvime nasıl bağlanacağının çıkarımı.
Kod değişmedi, migration yazılmadı, deploy yapılmadı.

**Önceki turlar:** `E19_INGESTION_FIZIBILITE.md` · `E19_SCHEMA_VE_INGEST_TASARIM.md`
(oradaki S-01…S-10 bulguları burada tekrarlanmaz, yalnız doğrulanır).

---

## Yönetici özeti

1. **Bugün editoryal takvim kodda hiç okunmuyor.** `editorial` kelimesi
   `types/gauntlet.ts:63,69` ve `scripts/*` dışında hiçbir Edge Function'da,
   serviste ya da bileşende geçmiyor (repo geneli grep). DB tarafı hazır
   (100 gün / 400 slot, ölçüldü), tüketici yok.

2. **Dallanma için en dar nokta `generateQuartet` çağrısı (`index.ts:742`).**
   Handler'ın `date` → idempotency → üretim → INSERT hattı (`index.ts:687-758`)
   editoryal/algoritmik ayrımını görmeden çalışabilir. Ama `slotTypes` kararı
   `index.ts:743`'te ayrı bir fonksiyondan (`slotTypesFor`) geliyor — dal iki
   satıra değer, tek satıra değil.

3. **Editoryal dal `arrangeUnseen`'i ÇAĞIRAMAZ.** `generateQuartet:571` sırayı
   karıştırır; editoryal takvimde sıra *bracket'in kendisidir*
   (`112_editorial_calendar.sql` `COMMENT ON position` + istemci aynası
   `GauntletShell/index.tsx:128-137,334`). Karıştırma, elle kurgulanmış 3
   eşleşmeyi rastgele 3 eşleşmeye çevirir.

4. **`rowToCandidate`/`toGauntletFilm` yeniden kullanılabilir — ayrı dönüştürücü
   gerekmiyor.** Ama `fetchPool` yolu kullanılamaz: 400 editoryal filmin
   **33'ü `curation_tier='archive'`** (havuz `ACTIVE_TIERS` ile sınırlı) ve
   **32'sinin `release_date`'i NULL** (`isDuelEligible` elerdi). Doğru yol
   `fetchCandidatesByIds` (`gauntletCore.ts:370-392`) — bu zaten
   `chosy-conventions` "seçim filtresi ile çözümleme yolu ayrıdır" kuralının
   tarif ettiği yol.

5. **Bugünün gerçek `day_number` = 2 · tema `epic` · dört film de 175-207 dk.**
   `launch_date` Cuma'ya, Gün 1 `popcorn`'a denk geliyor — §E-19.2b hizalaması
   veride tutuyor. Ama Gün 2'nin dördü de `CONTEXT_MAX_RUNTIME.short` (110) ve
   `.medium` (150) tavanının üstünde: editoryal dal bağlam runtime filtresini
   **atlamak zorunda**, aksi halde ilk gerçek test gününde havuz boşalır.

---

## Bulgular tablosu

| # | Dosya:satır | Açıklama | S/M/L |
|---|---|---|---|
| G-01 | `generate-gauntlet/index.ts:687` · `gauntletCore.ts:139-143` | Gün anahtarı hâlâ `utcDateString()` (S-08 doğrulandı). `day_number` bu **aynı** `date` değişkeninden türetilmeli; ikinci bir `new Date()` çağrısı gün dönümünde `date` ile `day_number`'ı ayrıştırır (aynı hata `duelEligibilityCutoff` yorumunda da anlatılmış, `gauntletCore.ts:253-256`). | S |
| G-02 | `index.ts:691-699, 745-758` | Idempotency (`user_id, scope, date`) ve INSERT editoryal/algoritmik ayrımından **bağımsız**: `film_ids`, `slot_types`, `context`, `relaxed`, `algorithm_version` iki dalda da aynı şekilde yazılır. Dal bu bloğa dokunmadan eklenebilir. | — |
| G-03 | `index.ts:742` (çağrı) · `:553-602` (tanım) | `generateQuartet` bugün `buildScoredPool` → `selectQuartet` → `arrangeUnseen` zincirini kapsıyor ve `GeneratedQuartet` (`{films, relaxed, relaxations, poolSize}`) döndürüyor. Editoryal üretici aynı dönüş tipini üretebilir (`relaxed=false`, `relaxations=[]`, `poolSize=4`) — handler'ın alt akışı değişmez. | M |
| G-04 | `index.ts:571` · `gauntletCore.ts:838` (`arrangeUnseen`) | `arrangeUnseen` dörtlüyü `PAIRINGS` üzerinden yeniden dizer ve `shownPairs` kontrolü yapar. Editoryal dalda **çağrılmamalı** — position 1-4 sırası bracket'i tanımlıyor. | S |
| G-05 | `index.ts:743` · `:242-245` (`slotTypesFor`) | `slotTypes` bugün yalnız `signalCount`'tan türüyor. Editoryal günde `signalCount` alakasız; dört slot da `'editorial'`. `slotTypesFor` başka girdi almadığı için karar bu fonksiyonun **dışında** verilmek zorunda. | S |
| G-06 | `types/gauntlet.ts:63,69` · `069_gauntlet_events.sql:172` | Sözleşme `'editorial'` değerini zaten taşıyor (önceki tur, CTO onaylı). DB `slot_types` CHECK'i yalnız `array_length = 4` istiyor, değer kısıtı yok → `['editorial'×4]` için **ek migration gerekmiyor**. | — |
| G-07 | `gauntletCore.ts:370-392` (`fetchCandidatesByIds`) | Editoryal `film_id`'leri `Candidate`'e çevirmenin hazır yolu: `FILM_COLUMNS` tam (`:226-228`), `rowToCandidate` normalizasyonu uygulanıyor, düello-uygunluk kapısı bilinçli olarak **uygulanmıyor**. `fetchFilmsByIds` (`index.ts:274-293`) zaten bunun üzerine kurulu. Dönüş `Map` olduğu için **sıra çağıranın sorumluluğu** — editoryal dal position sırasını kendisi korumalı (G-04). | S |
| G-08 | `gauntletCore.ts:204-222, 181-202` | S-02 kapısı editoryal yolda da işler ve **atlanmamalı**. Ölçüm: 400 filmin hiçbirinde `poster_url`/`runtime`/`year` NULL değil; 33'ünde `poster_url` ham `poster_path` (`/abc.jpg`) ama `toW500PosterUrl:196-201` bu biçimi kabul ediyor. Yani kapı bugünkü veriyle geçiliyor, gevşetilmesine gerek yok. | — |
| G-09 | `index.ts:283-289` | Çözümlenemeyen film sessizce atlanmıyor: `throw` + dış catch → Sentry fatal → 503. Editoryal dalda anlamı: takvimde bozulan tek film **o günü tamamen düşürür**. Kural 1 ile uyumlu, ama operasyonel risk (DUR-3). | — |
| G-10 | `gauntletCore.ts:35-39` (`CONTEXT_MAX_RUNTIME`) · `:907+` (`buildScoredPool`) | Bağlam runtime tavanı `fetchPool`'un `.lte` filtresinde yaşıyor. Editoryal dal `buildScoredPool`'u hiç çağırmazsa tavan **otomatik** devre dışı kalır — Bible §E-19'un "editoryal seçki bağlam filtresinden geçmiyor" ifadesiyle uyumlu. Yan etki: `context` istemciden gelir ve `daily_gauntlets.context`'e yazılır ama seçime hiç etki etmez. | — |
| G-11 | `_shared/gameUtils.ts:118-131` (`getAppConfig`) | `launch_date` için hazır lazy getter; anahtar yoksa `throw` (sessiz fallback yok, kural 6 uyumlu). `app_config.value` **jsonb** ve değer `"2026-09-18"` → `getAppConfig<string>` doğru tip. ⚠️ S-07: `app_config` policy'si `USING (true)`, yani `launch_date` istemciye açıktır. | S |
| G-12 | `submit-choice/index.ts:991-1002` | S-05 doğrulandı: `neither`/`seen` dalı `buildScoredPool` + `pickReplacements` ile **algoritmik havuzdan** yedek çekiyor. Bu turun kapsamı dışı (K-23), ama editoryal dal canlıya alındığı an ilk `neither`'da günün kurgusu kırılır — iki işin **sırası** bir karardır (DUR-2). | M (ayrı tur) |
| G-13 | `gauntletCore.ts:395-424` (`fetchExclusions`) | Editoryal dal `fetchExclusions`'ı çağırmazsa `watched` / `recentlyShown` / `recentlyRejected` dışlamaları uygulanmaz: kullanıcı zaten izlediği bir filmi editoryal günde görebilir. "Takvim herkes için aynı" ilkesinin doğal sonucu, ama ürün kararı (DUR-4). | — |
| G-14 | `gauntletCore.ts:408-411` | `daily_gauntlets` satırları `recentlyShown`'ı besliyor. Editoryal günler bu tabloya normal yazıldığı için 400 film algoritmik faza geçince yalnız **21 gün** cooldown'da olur — Bible §E-19.4'ün istediği *kalıcı* "gösterildi" işareti değil. | — |
| G-15 | `index.ts:70` (`ALGORITHM_VERSION = 'v0-random-diverse'`) | Editoryal dal aynı etiketi yazarsa iki üretim yolu `daily_gauntlets`/`choice_events` içinde **ayırt edilemez** olur — kural 6'nın (`algorithm_version` zorunlu) amacı tam olarak budur. Ayrı bir sabit gerekiyor. | S |

---

## Ölçülmüş sayılar

Tümü `supabase db query --linked`, salt okunur SELECT, 19 Eyl 2026.

### 1. Takvim doluluğu

```sql
select (select count(*) from editorial_calendar_days)  as days,
       (select count(*) from editorial_calendar_films) as films,
       (select count(*) from editorial_calendar_films where position between 1 and 4) as main_slots,
       (select count(*) from editorial_calendar_films where position between 5 and 6) as bench;
```

| days | films | main_slots | bench |
|---|---|---|---|
| 100 | 400 | 400 | **0** |

Yedek kulübesi (position 5-6) şemada var, **veri olarak boş**. K-23 dalının
editoryal karşılığı bugün veri seviyesinde de yok.

### 2. `launch_date` ve bugünün `day_number`'ı

```sql
select key, value from app_config where key ilike '%launch%';
select (current_date - date '2026-09-18') + 1 as day_number_today,
       to_char(date '2026-09-18','Day') as launch_dow,
       to_char(current_date,'Day')      as today_dow;
```

| launch_date | day_number (bugün) | launch günü | bugün |
|---|---|---|---|
| `"2026-09-18"` (jsonb string) | **2** | Friday | Saturday |

### 3. Bugünün (Gün 2) editoryal dörtlüsü — tema `epic`

```sql
select e.position, f.title, f.year, f.runtime
from editorial_calendar_films e join films f on f.id = e.film_id
where e.day_number = 2 order by e.position;
```

| pos | rol | film | yıl | dk |
|---|---|---|---|---|
| 1 | defender | Oppenheimer | 2023 | 181 |
| 2 | tur-1 challenger | Killers of the Flower Moon | 2023 | 206 |
| 3 | tur-2 challenger | The Godfather | 1972 | 175 |
| 4 | tur-3 challenger | Seven Samurai | 1954 | 207 |

Gün 1 (`popcorn`, Cuma): Mad Max: Fury Road · Top Gun: Maverick · Baby Driver · Dune.
Gün 3 (`prestige`, Pazar): Parasite · Anatomy of a Fall · …

Bible §E-19.2b'nin "Gün 1 gerçek yayın tarihinin hafta gününe hizalanır" kuralı
veride **tutuyor**: 18 Eyl = Cuma = `popcorn`, 19 Eyl = Cumartesi = `epic`.

**İlk gerçek test Gün 2 ile olacak** ve dördü de ≥175 dk — `short`/`medium`
bağlamıyla algoritmik havuzdan **hiçbiri** gelmezdi (G-10).

### 4. Editoryal filmlerin algoritmik havuz uygunluğu

```sql
select f.curation_tier, count(*) as n,
       count(*) filter (where f.release_date is null) as null_release,
       count(*) filter (where coalesce(f.imdb_votes,0)=0
                          and coalesce(f.vote_average,0)=0) as no_recognition
from editorial_calendar_films e join films f on f.id = e.film_id
group by 1;
```

| tier | n | release_date NULL | tanınırlık yok |
|---|---|---|---|
| core | 238 | 1 | 0 |
| extended | 127 | 0 | 0 |
| **archive** | **33** | **32** | 0 |
| trending | 2 | 0 | 0 |

33 film `ACTIVE_TIERS` (`core`/`extended`/`trending`) dışında, 33 film
`releasedBy()` kapısına takılır. `fetchPool` yolu bunları **sessizce elerdi** ve
ilgili günler 4'ten az filmle kalırdı.

### 5. Alan bütünlüğü (S-02 kapısı)

```sql
select count(*) filter (where f.poster_url is null) as null_poster,
       count(*) filter (where f.runtime is null)    as null_runtime,
       count(*) filter (where f.year is null)       as null_year,
       count(*) filter (where f.poster_url not like 'https://image.tmdb.org/t/p/%')
         as raw_poster_path,
       count(*) filter (where fp.profile_vector is null) as null_profile_vector
from editorial_calendar_films e
join films f on f.id = e.film_id
left join film_profiles fp on fp.film_id = f.id;
```

| null_poster | null_runtime | null_year | ham poster_path | profile_vector NULL |
|---|---|---|---|---|
| 0 | 0 | 0 | 33 | 0 |

`rowToCandidate` kapısı bugünkü 400 filmin **hepsini geçiriyor**. Kontrolün
editoryal yolda atlanmasına gerek yok — kapı zaten maliyetsiz ve G-09 gereği
sessiz eleme değil, fatal üretir.

### 6. Çakışma durumu

```sql
select count(*) from daily_gauntlets where date = current_date and scope='personal';
select count(*) from daily_gauntlets where date = current_date and scope='global';
select count(*) from daily_gauntlets where date >= current_date - 21;
```

| bugün personal | bugün global | son 21 gün toplam |
|---|---|---|
| 0 | 0 | 5 |

Bugün için üretilmiş gauntlet yok; editoryal dal devreye alınırsa idempotency
çakışması olmadan ilk üretim editoryal yoldan gider.

---

## Önerilen entegrasyon noktası (öneri — karar değil)

Mevcut fonksiyon yapısını bozmadan en dar dokunuş **üç** noktaya iniyor:

**(a) `index.ts:687` civarı — `day_number` türetimi.**
`date` zaten hesaplanmış; `launch_date` `getAppConfig<string>(service, 'launch_date')`
ile **lazy** okunur (G-11, kural 6) ve `day_number` **aynı `date` string'inden**
türetilir — ikinci `new Date()` yok (G-01). `1 ≤ day_number ≤ 100` değilse
(negatif, 0 veya >100) `null` → mevcut algoritmik dal aynen çalışır.

**(b) `index.ts:742` — üretim dalı.**
`generateQuartet`'in yanına ikinci bir üretici konur; ikisi de `GeneratedQuartet`
döndürür, handler tek `if` ile seçer. Editoryal üretici:
`editorial_calendar_films` → `position` 1-4 → sıralı `film_id[]` →
`fetchCandidatesByIds` → **position sırası korunarak** `Candidate[]`
(G-04, G-07). 4'ten az film çözülürse `throw` (G-09 deseni), fallback yok.

**(c) `index.ts:743` — `slotTypes`.**
`slotTypesFor(signalCount)` editoryal dalda atlanır,
`['editorial','editorial','editorial','editorial']` yazılır (G-05, G-06).
DB kısıtı ek migration istemiyor.

Ek olarak `ALGORITHM_VERSION` yanına editoryal dal için **ayrı bir sabit**
gerekir (G-15).

**Dokunulmayan yerler:** idempotency bloğu, cached-serve yolu (`index.ts:708-740`),
`deriveProgress`, `fetchFilmsByIds`, `resolvePendingWatchFeedback`,
`persistTimezone`, INSERT şekli, `_shared/gauntletCore.ts`, istemci.

**İstemci değişikliği gerekmiyor:** `slotTypes` `services/`, `components/`,
`app/`, `hooks/`, `contexts/` altında **hiç okunmuyor** (grep ile doğrulandı) —
`'editorial'` değeri istemciye şeffaf geçer.

---

## 🛑 DUR NOKTASI

Bu turda hiçbiri kararlaştırılmadı. Hepsi CTO onayı ister.

**DUR-1 — Edge Function'a ikinci üretim dalı eklemek mimari değişikliktir.**
`generate-gauntlet` bugün tek üretim yoluna sahip. (a)(b)(c) kalemlerinin
tamamı `chosy-conventions` §10 "yeni mimari pattern" başlığına girer.
Onaysız yazılamaz.

**DUR-2 — Sıra: editoryal dal mı, K-23 yedeği mi önce?**
Editoryal dal K-23'ten (G-12) **önce** canlıya alınırsa, editoryal bir günde ilk
`neither` ya da `seen` seçiminde `submit-choice` algoritmik havuzdan yedek çeker
ve o günün kurgusu kırılır. Üstelik position 5-6 bandı **veri olarak boş**
(ölçüm 1): şema hazır, içerik yok. Görünen üç yol (hiçbiri seçilmedi):
editoryal dalı yedekler dolana kadar bekletmek · dalı açıp kırılmayı kabul etmek ·
editoryal günde `neither`/`seen` davranışını değiştirmek (K-23 🔒 madde).

**DUR-3 — Editoryal günde üretim hatasının karşılığı yok.**
G-09 gereği tek bozuk film o günü 503'e düşürür; algoritmik havuza sessizce
düşmek kural 1 ihlalidir. "Editoryal gün çöktüğünde ne olur" bir ürün kararıdır:
gün düşsün mü, yoksa açıkça loglanan-bildirilen bir algoritmik dönüş mü olsun.

**DUR-4 — Editoryal günde kişisel dışlamalar uygulanmıyor** (G-13).
Kullanıcı `watchlist.watched_at` ile zaten izlediği bir filmi editoryal günde
görebilir. Takvimin herkes için aynı olmasının doğal sonucu, ama `seen`
sinyalini normalden sık üretir ve doğrudan DUR-2'nin yüküne eklenir.

**DUR-5 — `day_number`'ın gün anahtarına bağlılığı (S-08 devamı).**
`day_number` UTC gününden türeyecek. M2 Faz 2b (kullanıcı-yerel gün) geldiğinde
aynı takvim günü iki farklı `day_number` üretebilir. Editoryal dal bu
çatallanmayı **ilk kez kullanıcıya görünür** hale getirir: algoritmik dalda fark
yalnız film seçimiydi, editoryalde "yanlış günün teması" olur.

**DUR-6 — Gün 100 sonrası (G-14).**
`day_number > 100` dalı algoritmiğe düşer, ama Bible §E-19.4 o 400 filmin
*kalıcı* "gösterildi" işareti almasını istiyor; `daily_gauntlets` tabanlı
`recentlyShown` yalnız 21 gün tutuyor. Ayrı iş kalemi — editoryal dal onsuz da
çalışır, ama 100. günde 400 filmin havuza geri dönmesi tasarım dışıdır.

---

## Doğrulanamayanlar

- **`launch_date`'in kesinliği.** `app_config.launch_date = "2026-09-18"` ölçüldü,
  ama bunun gerçek yayın tarihi mi yer tutucu mu olduğu koddan anlaşılmıyor.
  Yayın kayarsa tek `app_config` güncellemesi tarihi düzeltir ama 100 satırın
  **hafta günü hizalamasını** (§E-19.2b) düzeltmez.
- **Position 5-6 yedeklerinin planı.** Şemada band var, veri yok; hangi filmlerin
  yedek olacağı ve nereden geleceği bu turda görülmedi (K-23 kapsamı, bilinçli
  olarak kapsam dışı bırakıldı).
- **Editoryal dalın koşum davranışı.** Dal hiç yazılmadı ve çalıştırılmadı;
  buradaki tüm çıkarımlar statik kod okuması + DB ölçümüdür, koşum ölçümü değil.
