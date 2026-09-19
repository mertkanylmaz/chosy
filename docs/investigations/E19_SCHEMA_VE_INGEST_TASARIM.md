# E-19 — `editorial_calendar` şeması + title→TMDB ID çözümleme tasarımı

**Tarih:** 19 Eylül 2026
**Mod:** SALT OKUNUR. Hiçbir migration yazılmadı/push edilmedi, hiçbir script
yazılmadı veya çalıştırıldı (`--dry-run` dahil), hiçbir DB yazması yapılmadı,
hiçbir bağımlılık kurulmadı. Tek istisna: bu rapor.
**Ölçüm anahtarı:** tüm canlı ölçümler `SUPABASE_SECRET_KEY` ile, salt-okunur
`GET` + `Prefer: count=exact` ile yapıldı.
**Önceki tur:** `docs/investigations/E19_INGESTION_FIZIBILITE.md` (18 Eyl 2026).
Bu rapor onun üzerine kurulur, bulgularını tekrar etmez; yalnız düzelttiği
sayıları açıkça işaretler.

---

## Yönetici özeti

1. **"300 eşleşme" ayrı bir veri değil — 4 filmin SIRASI.** Gauntlet bir
   king-of-the-hill bracket'i: tur 1 `films[0]` vs `films[1]`, tur 2'nin
   meydan okuyucusu `films[2]`, tur 3'ünki `films[3]`
   (`supabase/functions/generate-gauntlet/index.ts:826-827`,
   `components/gauntlet/GauntletShell/index.tsx:130-131,334`). Yani sıralı bir
   4'lü dizi günün üç eşleşmesini **tamamen** belirler; ayrı bir "matchups"
   tablosu gerekmiyor. Bible'ın "400 film, 300 eşleşme" ifadesi şemada
   100 satır × 4 sıralı film olarak karşılanır.
2. **"Gate devrede olmayacak" kararı üç zorunlu alanı kapsamıyor.** Editoryal
   yol `profile_vector`/`curation_tier` kapısını atlasa bile, id ile çözümleme
   yolu `fetchCandidatesByIds` → `rowToCandidate` üzerinden geçer ve o
   `poster_url`, `runtime`, `year` NULL ise filmi **sessizce düşürür**
   (`_shared/gauntletCore.ts:204-207`); `generate-gauntlet` bunu yakalayıp
   **fatal throw** eder (`generate-gauntlet/index.ts:283-289`). Poster ayrıca
   `image.tmdb.org/t/p/...` kalıbına uymak zorunda (`gauntletCore.ts:181-202`).
3. **`slot_types` kilitli sözleşmeye çarpıyor.** DB tarafında değer kısıtı YOK
   (`069_gauntlet_events.sql:172` yalnız `array_length = 4` kontrol ediyor),
   ama `types/gauntlet.ts:62` `('global'|'personal'|'discovery')[]` union'ını
   taşıyor. Editoryal günde dördüncü bir değer (`'editorial'`) **sözleşme
   değişikliğidir** — bible'ın zaten açık bıraktığı madde, burada kod
   referansıyla doğrulandı.
4. **Service-role key: 15 script + 1 test dosyası (ölçüldü).** Önceki tur "16
   script", `TEKNIK_BORC.md:1231` "14 dosya" diyordu; gerçek sayı
   `process.env.SUPABASE_SERVICE_ROLE_KEY` okuyan **15 script** +
   `tests/game-system/e2e-api.test.ts`. Dosyaya hiç dokunmayan bir üçüncü yol
   var: hem `dotenv/config` hem `scripts/lib/tmdb-client.ts:26-28` mevcut
   `process.env` değerini **ezmiyor**, yani oturum seviyesinde bir
   `$env:SUPABASE_SERVICE_ROLE_KEY` ataması 16 okuma noktasını da düzeltir.
5. **Otomatik ilk-sonuç yasağı ölçümle doğrulandı.** `/search/movie` +
   `primary_release_year=2023` + `query=The Killer` → **45 sonuç**, ilk sırada
   Fincher'ın filmi (800158) ama aynı yıl **tam aynı başlıkla** ikinci bir film
   daha var (1509638, `es`). Başlık+yıl tek başına belirsizliği çözmüyor;
   yönetmen doğrulaması zorunlu.

---

## Bulgular tablosu

| # | Dosya:satır | Bulgu | S/M/L |
|---|---|---|---|
| S-01 | `generate-gauntlet/index.ts:826-827` · `GauntletShell/index.tsx:130-131,334` | Bracket sıralamayla kodlanıyor: tur 1 = `films[0]` vs `films[1]`, tur 2 challenger = `films[2]`, tur 3 = `films[3]`. **Sıralı 4'lü dizi = 3 eşleşme.** Ayrı eşleşme tablosu gereksiz. | — |
| S-02 | `_shared/gauntletCore.ts:204-207, 181-202` | `rowToCandidate` `poster_url`/`runtime`/`year` NULL ise `null` döner; `toW500PosterUrl` TMDB host dışı ya da `/t/p/<size>/<file>` kalıbına uymayan poster'ı da eler. Editoryal yol bu kapıdan **muaf değil**. | S (kural) |
| S-03 | `generate-gauntlet/index.ts:283-289` | Çözümlenemeyen film sessizce atlanmıyor — `throw` + Sentry fatal. Yani eksik alanlı bir editoryal film **o günü tamamen düşürür**. | — |
| S-04 | `types/gauntlet.ts:62` vs `069_gauntlet_events.sql:172` | `slotTypes` union'ı TS'te kilitli, DB'de kısıt yok. `'editorial'` değeri → **CTO onayı gerektiren sözleşme değişikliği**. | M |
| S-05 | `submit-choice/index.ts:991-1043` | `neither`/`seen` dalı `buildScoredPool` + `pickReplacements` ile **algoritmik havuzdan** yedek çekiyor ve `daily_gauntlets.film_ids`'i in-place güncelliyor (`:1027-1042`). Editoryal günde bu, günün kurgusunu kırar (bible K-23 açık maddesi, burada kod referansıyla doğrulandı). | M |
| S-06 | `069_gauntlet_events.sql:164-205, 236-274` | Yeni tablo için izlenecek desen: `ENABLE ROW LEVEL SECURITY` + SELECT-only policy (ya da hiç policy yok = yalnız service_role), partial UNIQUE index, `COMMENT ON`. Yazma yolu yalnız Edge Function. | — |
| S-07 | `035_app_config.sql:7-35` · `_shared/gameUtils.ts:118-131` · `gauntletCore.ts:914-921` | `app_config` lazy getter deseni mevcut; anahtar yoksa `throw` (sessiz fallback yok). Takvim başlangıç tarihi için hazır ve kural-uyumlu taşıyıcı. ⚠️ `app_config` policy'si `USING (true)` — oraya yazılan başlangıç tarihi **herkese açık** olur. | S |
| S-08 | `generate-gauntlet/index.ts:687` | Gün anahtarı hâlâ `utcDateString()`. `day_number` hesabı bugün UTC gününe bağlanır; M2 Faz 2b (user-local gün) geldiğinde **aynı gün iki farklı day_number** üretebilir. | M |
| S-09 | `scripts/lib/tmdb-client.ts:75-145` | `tmdbGet<T>` endpoint-agnostik: `/search/movie` **client değişikliği olmadan** çağrılabilir (rate limit 334 ms, 429 backoff, 3 retry hazır). Yalnız yeni bir response `interface`'i gerekiyor. Yeni bağımlılık YOK. | S |
| S-10 | ölçüm (aşağıda) | `/search/movie?query=The Killer&primary_release_year=2023` → 45 sonuç, 2'si tam başlık eşleşmesi. Belirsizlik gerçek; `results[0]` yasağı gerekçeli. | — |
| S-11 | `scripts/add-missing-films.ts:127-175` | `detailToRow` **export edilmiyor** (modül-içi). Yeni script ya bu fonksiyonu export ettirecek (mevcut dosyaya dokunmak) ya da kopyalayacak (ıraksama riski — `imdb_votes` kirliliğinin doğuş biçiminin aynısı). | M |
| S-12 | `scripts/add-missing-films.ts:119-124` | `assignTier()` oy sayısına bakıyor; editoryal seçkinin arthouse/gizli cevher ağırlığı `archive`'a düşer. Editoryal yolda gate yok ama **100. gün sonrası** ve diğer yüzeyler `ACTIVE_TIERS` (`gauntletCore.ts:41`) kullanıyor. | M |
| S-13 | ölçüm | `films.tmdb_vote_count` kolonu var ve **3.438 satırın 0'ında dolu**. `add-missing-films` TMDb `vote_count`'u bu kolona değil `imdb_votes`'a yazıyor (`:163`) — kirliliğin kaynağı ve boş duran doğru kolon. | S (belgelemek) |
| S-14 | `084_films_dominant_color.sql:19` | `poster_quality_ok` kolonunun **DEFAULT'u yok** → yeni filmler NULL gelir; `dominant_color` da NULL. Işık sızması için `compute-dominant-colors.ts` ayrı koşum. | S |
| S-15 | ölçüm (PGRST205) | `editorial_calendar` canlıda **yok**. Sonraki migration numarası **112** (`supabase/migrations/` listelendi, en yüksek 111). | — |

---

## Ölçülmüş sayılar

Anahtar doğrulaması (bugün yeniden ölçüldü, salt-okunur `GET /rest/v1/films?select=id&limit=1`):

```
SUPABASE_SERVICE_ROLE_KEY (41 kr) → 401
SUPABASE_SECRET_KEY       (41 kr) → 200
```

Tablo varlığı:

```
GET /rest/v1/editorial_calendar?select=*&limit=1
→ HTTP 404 · PGRST205 "Could not find the table 'public.editorial_calendar'"
```

`films` durumu (PostgREST + `Prefer: count=exact`, `Content-Range`):

```
films TOPLAM                         3.438
  curation_tier in (core,extended,trending)   1.867
  curation_tier = 'archive'                   1.571
  imdb_rating IS NULL                         1.167
  director IS NULL                              508
  poster_url IS NULL                              5
  runtime IS NULL                                 0
  year IS NULL                                    0
  dominant_color IS NULL                         39
  poster_quality_ok IS NULL                      34
  poster_quality_ok = false                       5
  tmdb_vote_count IS NOT NULL                     0
film_profiles · profile_vector IS NULL            0
daily_gauntlets TOPLAM                           35
```

TMDB belirsizlik ölçümü (2 salt-okunur çağrı, yazma yok):

```
GET /3/search/movie?query=The Killer&primary_release_year=2023&language=en-US
→ total_results 45
   800158  The Killer        2023-10-25  en   (popularity 13.7)
   862552  The Ritual Killer 2023-03-09  en
  1509638  The Killer        2023-01-01  es   ← AYNI başlık, AYNI yıl

GET /3/search/movie?query=Persona&language=en-US
→ total_results 746 · 1966 · 2000 · 2019 · 2024 · 2026 aynı başlıkla
```

Env okuma noktaları (ripgrep, `process.env.SUPABASE_SERVICE_ROLE_KEY`):

```
scripts/  15 dosya: add-missing-films · ai-profile-films · audit-film-metadata-gaps
          backfill-cast · backfill-film-metadata · backfill-imposter-characters
          backfill-imposter-photos · compute-dominant-colors · enrich-films
          enrich-films-metadata · profile-films · seed-database · seed-films-to-db
          verify-ai-profiles · verify-db-state
tests/     1 dosya: game-system/e2e-api.test.ts  (ENV['SUPABASE_SERVICE_ROLE_KEY'])
scripts/check-env.ts:73  → OKUMA DEĞİL; adı "Supabase'in otomatik enjekte
                            ettiği" kümesinde listeliyor (:70-78). Yeniden
                            adlandırmadan etkilenmez.
.eas/workflows/e2e-test.yml · eas.json · package.json → hiç geçmiyor (grep: 0)
```

E-19 boru hattında fiilen kullanılacak olanlar bu 15'in **6'sı**:
`add-missing-films` → `backfill-film-metadata` → `enrich-films-metadata` →
`compute-dominant-colors` → `ai-profile-films` → `audit-film-metadata-gaps`.

---

## DUR NOKTASI (a) — service-role key düzeltme yöntemi

Durum: `.env`'deki `SUPABASE_SERVICE_ROLE_KEY` 401 veriyor, `SUPABASE_SECRET_KEY`
200 veriyor; ikisi de `sb_secret_…` kuşağı, 41 karakter, **farklı değer**
(`TEKNIK_BORC.md:1205-1240`). Üç yol var, üçü de karar:

**Yol 1 — Dashboard'dan yeni/doğru service-role anahtarı alıp `.env`'e yazmak.**
Dokunulan dosya: 1 (`.env`). Kod değişmez, test değişmez.
Not: `supabase projects api-keys` secret'ları maskeliyor
(`TEKNIK_BORC.md:636-638`), değer yalnız Dashboard'dan alınabilir — yani bu yol
**CTO'nun elle yapacağı bir iş**, Claude Code tamamlayamaz.

**Yol 2 — 15 script + 1 testin okuduğu env adını `SUPABASE_SECRET_KEY`'e
çevirmek.** Dokunulan dosya: 16. `TEKNIK_BORC.md:1231-1236` bu işin
"scripts + Edge secrets + Vault + EAS/CI birlikte, atomik" yapılmasını
şart koşuyordu; bu turun ölçümü o kapsamı **daraltıyor**: EAS/CI'da bu ad hiç
geçmiyor (grep 0), Edge runtime'ın enjekte ettiği ad zaten değiştirilemez ve
değiştirilmemeli (`check-env.ts:70-78` onu "otomatik enjekte" kümesinde
tutuyor). Yani yeniden adlandırma **yalnız yerel script yüzeyini** ilgilendirir.
Riski: iki anahtardan hangisinin "doğru" olduğu hâlâ bilinmiyor; yanlış olanın
adını kanonik hâle getirmek kafa karışıklığını kalıcılaştırır.

**Yol 3 — hiçbir dosyaya dokunmadan, oturum seviyesinde override.**
Ölçülmüş dayanak: `scripts/lib/tmdb-client.ts:26-28` `.env`'i okurken
`if (!process.env[key])` kontrolü yapıyor, yani **mevcut değeri ezmiyor**;
`dotenv/config` de varsayılan olarak ezmez. Dolayısıyla koşum öncesi tek satır
16 okuma noktasını da doğru anahtara yönlendirir:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = (Select-String -Path .env -Pattern '^SUPABASE_SECRET_KEY=' | ForEach-Object { $_.Line.Split('=',2)[1] })
```

Dokunulan dosya: 0. Kalıcı değil, her yeni terminalde tekrarlanır ve
`.env`'deki yanıltıcı isim yerinde kalır — **düzeltme değil, geçici köprü.**

> Karar gereken: E-19 ingest'i Yol 3 ile mi koşulacak (dosya değişikliği yok,
> borç yerinde kalır), yoksa önce Yol 1 veya Yol 2 ile kalıcı düzeltme mi
> yapılacak. Yol 1 CTO'nun Dashboard erişimini gerektirir.

---

## DUR NOKTASI (b) — `editorial_calendar` şeması

Aşağıdakiler **taslak öneridir; yazılmadı, push edilmedi.** Tablo/kolon ekleme
CTO onayı ister (CLAUDE.md "Yetki sınırı").

### b.1 — Tek satır mı, dört satır mı (iki seçenek)

**Seçenek A — gün başına tek satır, sıralı dizi (mevcut `daily_gauntlets`
deseninin aynısı):**

```sql
-- TASLAK · supabase/migrations/112_editorial_calendar.sql (YAZILMADI)
CREATE TABLE editorial_calendar (
  day_number   INT  PRIMARY KEY CHECK (day_number BETWEEN 1 AND 100),
  theme        TEXT NOT NULL CHECK (theme IN
                 ('arthouse','cult','cozy','discovery','popcorn','epic','prestige')),
  -- SIRA ANLAMLIDIR: [0] defender, [1] tur-1 challenger,
  -- [2] tur-2 challenger, [3] tur-3 challenger.
  film_ids     UUID[] NOT NULL CHECK (array_length(film_ids, 1) = 4),
  editor_note  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- ✅ `daily_gauntlets.film_ids`'e birebir kopyalanabilir, dönüşüm yok.
- ❌ `UUID[]` üzerine **FK kurulamaz** — silinmiş/yanlış bir film id'si DB
  tarafından yakalanmaz, ancak koşum anında `generate-gauntlet` fatal'ıyla
  (S-03) ortaya çıkar.
- ❌ "400 film benzersiz" kuralı DB'de ifade edilemez.

**Seçenek B — gün başına dört satır, normalize:**

```sql
-- TASLAK (YAZILMADI)
CREATE TABLE editorial_calendar_days (
  day_number  INT PRIMARY KEY CHECK (day_number BETWEEN 1 AND 100),
  theme       TEXT NOT NULL CHECK (theme IN (...)),
  editor_note TEXT
);

CREATE TABLE editorial_calendar_films (
  day_number  INT  NOT NULL REFERENCES editorial_calendar_days(day_number) ON DELETE CASCADE,
  position    INT  NOT NULL CHECK (position BETWEEN 1 AND 4),
  film_id     UUID NOT NULL REFERENCES public.films(id) ON DELETE RESTRICT,
  PRIMARY KEY (day_number, position)
);

-- "400 film benzersiz" kuralı DB'de:
CREATE UNIQUE INDEX editorial_calendar_films_film_uniq
  ON editorial_calendar_films (film_id);
```

- ✅ FK + `ON DELETE RESTRICT` (film verisinde DELETE zaten yasak, CLAUDE.md #4).
- ✅ Benzersizlik kısıtı bible'ın "400 benzersiz film" kuralını **veri
  seviyesinde** garantiler.
- ✅ 100. gün "kalıcı gösterildi" işareti için doğrudan sorgulanabilir.
- ❌ İki tablo, okuma tarafında `order by position` + dizi kurma adımı.

> Karar gereken: A mı B mi. (Mevcut desenle tutarlılık A'yı, referans
> bütünlüğü B'yi işaret ediyor; ikisi birbirini dışlıyor.)

### b.2 — Tarih hesaplama: `date` kolonu YOK

Bible §2b: "Gün 1 gerçek yayın tarihinin **hafta gününe** hizalanır."
Bunun şemadaki karşılığı:

```
date       = launch_date + (day_number - 1)      -- okuma anında hesaplanır
theme      = haftanın gününden türer              -- Pzt→arthouse … Paz→prestige
day_number = (bugün - launch_date) + 1            -- 1..100 dışındaysa algoritmik faz
```

`launch_date` için hazır ve kural-uyumlu taşıyıcı `app_config` (S-07):
lazy okunur, anahtar yoksa `throw` eder, sessiz fallback üretmez.

⚠️ **İki uyarı:**
- `app_config` SELECT policy'si `USING (true)` (`035_app_config.sql:24-27`) —
  oraya yazılan yayın tarihi **istemciye açıktır**. Sızıntı değeri düşük ama
  bilinçli olmalı.
- Yayın tarihi **kayarsa** ne olacağı bir üründür kararıdır: `theme` satırda
  saklanırsa ve `launch_date` bir gün kayarsa, her günün teması hafta gününden
  kopar (Pazartesi kurgulanan arthouse günü Salı'ya düşer). Alternatif, temayı
  hiç saklamayıp hafta gününden türetmek ve satırdaki `theme`'i yalnızca bir
  **tutarlılık iddiası** olarak tutmaktır (kurgu ile hesap uyuşmazsa fatal).

⚠️ **S-08 ile kesişim:** `generate-gauntlet` gün anahtarını hâlâ
`utcDateString()` ile üretiyor. `day_number` bugün UTC gününe bağlanır;
M2 Faz 2b (kullanıcı-yerel gün) geldiğinde İstanbul'da 03:00'te açan kullanıcı
bir önceki `day_number`'ı görür. Editoryal takvim **herkes için aynı** olduğu
için bu, Spotlight'ın "günlük bulmaca herkes için aynıdır" kuralıyla aynı
sınıfta bir karardır.

### b.3 — RLS

Öneri: `ENABLE ROW LEVEL SECURITY` + **hiç SELECT policy'si yok**
(service_role RLS'i baypas eder, istemci hiçbir satır göremez).
Gerekçe, 069'daki `scope = 'anonim'` kararının aynısı
(`069_gauntlet_events.sql:270-273`): istemci **yarının filmlerini önceden
görmemeli**. Bu, Spotlight'ın "çözüm istemciye inmez" kuralının takvim
karşılığıdır. İstemci günün dörtlüsünü zaten `daily_gauntlets` üzerinden alır.

### b.4 — Index

- Seçenek A: PK (`day_number`) yeterli. 100. gün "kalıcı gösterildi" taraması
  için `CREATE INDEX ... USING GIN (film_ids)`
  (`069_gauntlet_events.sql:198` ile aynı desen).
- Seçenek B: PK (`day_number, position`) + `UNIQUE (film_id)` yeterli; ek index
  gerekmez.

### b.5 — Şemanın cevaplamadığı iki açık madde

- **K-23 yedek filmi (S-05).** `submit-choice`'ın `neither`/`seen` dalı
  algoritmik havuzdan yedek çekiyor. Editoryal günde ya şemaya bir
  `backup_film_ids UUID[]` (ya da B'de `position 5..6`) eklenecek, ya ret
  editoryal günü algoritmik havuza düşürecek. **Şema bu karara bağlı** —
  kolon sonradan eklenebilir ama davranış kararı önce gelir.
- **`slotTypes` (S-04).** `'editorial'` değeri `types/gauntlet.ts`
  değişikliğidir. Şema bundan etkilenmez, ama aynı sprintte kararlaşmalı.

---

## DUR NOKTASI (c) — yeni ingest script'in tasarımı

**Önerilen biçim: TEK dosya değil, iki fazlı ayrı iki koşum.** Gerekçe:
çözümleme (belirsizlik + insan onayı) ile yazma (DB) farklı risk sınıfları;
tek script'te birleştirilirse "manuel onay bekliyor" durumu yarı yazılmış bir
DB ile karşılaşır.

### Faz 1 — `scripts/resolve-editorial-films.ts` (salt okunur, DB'ye dokunmaz)

**Girdi** (yeni dosya, formatı karar): `data/editorial-films.json`

```jsonc
[{ "title": "The Killer", "year": 2023, "director": "David Fincher",
   "day_number": 12, "position": 1, "curation_tier": "core" }]
```

**Akış (her başlık için):**

1. `tmdbGet('/search/movie', { query, primary_release_year })` — S-09: mevcut
   client değişmeden çalışır, yalnız yeni bir `TmdbSearchResponse` interface'i
   gerekir.
2. **Başlık daraltması:** `title` VE `original_title` üzerinde normalize
   edilmiş (küçük harf, aksan/noktalama sadeleştirilmiş) **tam eşleşme**.
   Benzerlik skoru / "en yakın" YOK.
3. **Yönetmen doğrulaması:** kalan her aday için
   `/movie/{id}?append_to_response=credits`, `crew` içinde `job === 'Director'`
   karşılaştırması (normalize edilmiş tam eşleşme).
4. **Karar kuralı — üç yol, dördüncüsü yok:**
   - Tam olarak **1** aday geçti → `resolved`.
   - **0** aday geçti → `manual_review` (sebep: `no_director_match`).
   - **2+** aday geçti → `manual_review` (sebep: `ambiguous`).
   `results[0]`'ı almak **hiçbir koşulda** yok. Girdide `director` alanı yoksa
   aday sayısı 1 bile olsa `manual_review` (sebep: `unverified`) —
   doğrulanmamış eşleşme sessiz kabul edilmez.
5. **Çıktı:** `data/editorial-resolved.json` +
   `data/editorial-manual-review.json` (her satırda ilk 5 aday: `id`, `title`,
   `original_title`, `release_date`, `director`, `poster_path`, `popularity` —
   CTO'nun tek bakışta seçebilmesi için).
6. **Çıkış kodu:** `manual_review` boş değilse **non-zero**. "96'nın 91'i
   çözüldü" bir başarı değil, yarım iştir; yeşil dönerse Faz 2 yanlışlıkla
   koşulur.

**Maliyet/süre (hesaplandı, koşulmadı):** 96 arama + adayların detayları
≈ 200–400 TMDB çağrısı × 334 ms (`tmdb-client.ts:35`) ≈ **1–2,5 dakika**.
TMDB kotası için ihmal edilebilir; para maliyeti yok.

### Faz 2 — `scripts/ingest-editorial-films.ts` (girdisi yalnız `editorial-resolved.json`)

- `tmdb_id` listesini alır, `films`'te var olanı atlar
  (`films.tmdb_id` UNIQUE — `001_initial_schema.sql:26`).
- Satır dönüşümü: **`add-missing-films.ts:127-175`'teki `detailToRow`**.
  S-11: fonksiyon export edilmiyor. İki yol var, ikisi de karar:
  export ettirmek (mevcut dosyaya dokunmak) veya kopyalamak (ıraksama riski).
- **Sessiz elemeler kaldırılmalı.** `add-missing-films.ts:271-275` `adult`,
  `poster_path` yok, `runtime < 60` olanları `continue` ile **hata listesine
  bile girmeden** düşürüyor. Editoryal listede bu, CTO'nun seçtiği bir filmin
  sessizce kaybolması demektir → yeni script'te her eleme **rapora** düşmeli
  (CLAUDE.md #1: sessiz fallback yasak).
- **`curation_tier` girdiden gelir**, `assignTier()`'dan DEĞİL (S-12).
- `--dry-run` zorunlu (mevcut beş script'te de var).

### Faz 2 sonrası zincir (değişmiyor, önceki turdan)

```
ingest-editorial-films → backfill-film-metadata → enrich-films-metadata
  → compute-dominant-colors → ai-profile-films → audit-film-metadata-gaps
```

`ai-profile-films` editoryal yol için **gate değil**, ama 100. gün sonrası
algoritmik faz için zorunlu ve **maliyet kalemidir** (Claude Haiku 4.5;
CLAUDE.md "maliyet gerektiren işte onay iste").

### 96 filmin alacağı alanlar (`add-missing-films.ts:80-106` FilmInsertRow)

| Durum | Alanlar |
|---|---|
| **Dolu gelir** | `tmdb_id` · `title` · `original_title` · `original_language` · `overview` · `release_date` · `year` · `runtime` · `vote_average` · `genres` · `poster_url` · `backdrop_url` · `director` · `country` · `cast` · `tmdb_keywords` · `imdb_id` · `curation_tier` · `metadata_json` |
| **Bilerek NULL/0** | `imdb_rating` (NULL) · `metascore` (NULL) · `content_rating` (NULL) · `oscar_wins`/`oscar_nominations` (0) |
| **Hiç yazılmaz** | `cast_json` · `trailer_url` · `tr_title` · `tmdb_vote_count` (S-13: kolon var, canlıda 0/3.438 dolu) · `dominant_color` · `dominant_color_computed_at` · `poster_quality_ok` (S-14: DEFAULT yok → NULL) |
| **Ayrı koşumla** | `dominant_color` + `poster_quality_ok` → `compute-dominant-colors` · `profile_vector` → `ai-profile-films` |

**Gauntlet için zorunlu üçlü (S-02) bu listede karşılanıyor:** `poster_url`,
`runtime`, `year` dolu gelir — ancak `add-missing-films.ts:274-275` poster'ı
olmayan ve `runtime < 60` olan filmi zaten eliyor, yani "karşılandı" değil
"elenmiş olur". Editoryal listede kısa metraj/poster'sız bir seçim varsa
**o gün ingest edilemez**; bu yüzden eleme raporlanmalı (yukarıda).

### Önceki E-19 ingestion raporuyla çakışma

`E19_INGESTION_FIZIBILITE.md` I-01/I-02'nin "giriş yolu yok / title→ID
çözümlemesi yok" tespiti **bu tasarımla karşılanıyor**; I-05 (`imdb_rating`
DB yolu yok), I-06 (`imdb_votes` kirliliği), I-07 (`assignTier`), I-08
(`OMDB_API_KEY` yok) **değişmeden açık kalıyor**. I-03 (401) için bu turda
üçüncü bir yol ölçüldü (Yol 3, yukarıda). I-04 (`profile_vector` gate)
editoryal yolda **düşüyor**, 100. gün sonrası için **geri geliyor**.

---

## Doğrulanamayanlar

- **96 filmlik liste repoda YOK.** `docs/`, `docs/investigations/`, `data/`
  tarandı — başlık listesi taşıyan bir dosya bulunamadı. (c) bölümünün girdi
  formatı bu yüzden **öneridir**, mevcut bir dosyaya bakılarak yazılmadı.
  Listede yönetmen bilgisi yoksa Faz 1'in `unverified` dalı 96 satırın
  tamamını manuel onaya düşürür.
- **"E-18" diye bir karar kaydı YOK.** Bible'da tek bir satırda geçiyor
  (`7_CHOSY_V1_KAPSAM_KILIDI.md:504`, "E-18 genre-verisi keşfiyle
  birleştirilebilir"); sürüm tablosunda E-14'ten E-19'a atlanıyor
  (`:640-642`). Brief'in "E-18 fizibilitesiyle çakışan kısımlar" maddesi bu
  yüzden `E19_INGESTION_FIZIBILITE.md` ile karşılaştırılarak yazıldı —
  **E-18'in kendisi görülmedi.**
- **Hiçbir script çalıştırılmadı** (`--dry-run` dahil); Faz 1/Faz 2 tasarımı
  kaynak okumaya dayanıyor, davranış ölçülmedi.
- **Şema taslağı DB'de denenmedi.** CHECK/FK/index ifadelerinin sözdizimi
  gözle doğrulandı, `supabase db diff`/`push` **çalıştırılmadı**.
- **`daily_gauntlets` ↔ `editorial_calendar` bağının Edge tarafı ölçülmedi.**
  `generate-gauntlet`'in 1-100 dalını nereye takacağı (S-08 tarih hesabı
  dahil) bu raporda **tasarlanmadı** — şema kararı (b) verilmeden o dal
  yazılamaz.
