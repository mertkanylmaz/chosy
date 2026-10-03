# P-1b — Spotlight kesintisi ve kuyruk sağlığı · Keşif raporu

**Temel:** master @ 8814966 · **Tarih:** 3 Eki 2026 (ölçümler ~18:00–19:00 UTC)
· **Mod:** READ-ONLY — kod, deploy, DB yazma, commit yok.
Önceki rapor: `P1_SPOTLIGHT_POSTER_TUTARLILIK_KESIF.md` (P-1 + P-1 EK).

---

## Yönetici özeti

1. **P0 — kuyruk 2026-10-13'te bitiyor ve yenileyecek cron büyük olasılıkla
   401 alacak.** Tek tetikleyici `generate-puzzles-spotlight` (pg_cron
   jobid 19, Pzt 02:00 UTC) **hiç koşmadı**; ilk koşum 5 Eki 02:00 UTC.
   Kullandığı Vault sırrı `cron_service_role_key` **13 karakter** (beklenen
   41), 2026-10-01 06:23 UTC'de güncellenmiş; aynı sırrı kullanan
   `global-slot-daily` bugün 00:05'te **401 "Invalid API key"** aldı.
2. **10-14'ten itibaren** `get-daily-challenge` 404 `NO_PUZZLE` döner; bonus
   kartı karesiz nötr metne düşer, oyun ekranı "bağlantını kontrol et" diyen
   genel hata gösterir (yanlış teşhis metni). **Acil havuz bu durumda
   devreye GİRMEZ** — yalnız üretim koşumu içinde kullanılır ve şu an 0 satır.
3. **12 Ağu – 29 Eyl boşluğunun nedeni:** `generate-puzzles` için kalıcı cron
   **hiç yoktu**; üretim elle yapılıyordu. Üç elle koşum var (07-24, 07-29,
   09-30); 07-29 koşumu LOOKAHEAD=14 ile 08-11'e kadar bulmaca üretti, sonra
   kimse tetiklemedi. Flag değil (spotlight 07-28'den beri açık), kod hatası
   değil (aralıkta ilgili commit yok).
4. **Boşlukta etkilenen kullanıcı ölçülebilir değil:** PostHog
   `game_daily_opened` yalnız **başarılı** yüklemede atılıyor — boşlukta
   yapısal olarak 0. Sentry'de `game_id:spotlight` hatası 90 günde **2**
   (ikisi de 09-30 13:18, tek kullanıcı); boşlukta **0**. Bonus kartı repoya
   09-20'de girdi.
5. **Ham path kök nedeni:** `scripts/seed-database.ts:283-284` TMDb
   `poster_path`/`backdrop_path`'i ham yazıyor. 948 ham poster + 911 ham
   backdrop; **hepsi 2026-03-09 / 03-20'de oluşturulmuş**, sonra yeni ham satır
   yok. Ama script `package.json`'da (`npm run seed-database`) ve
   `tmdb_id` üzerinden **upsert** yapıyor → yeniden koşarsa düzgün URL'leri
   ham yolla ezer. **İlk ham-yollu Spotlight bulmacası tahmini 2026-10-25**
   (P-1 EK'teki "Kasım ortası" tahmini acil havuz tüketimini hesaba katmıyordu
   — düzeltildi, bkz. §6).

---

## 1. Kuyruk sağlığı

### 1a. Üretilmiş tarihler

```sql
select max(date) last_date,
       count(*) filter (where date >= '2026-10-03') from_today,
       count(*) filter (where date >  '2026-10-03') future
from daily_puzzles where game_type='spotlight';
```

| son tarih | bugün dahil | gelecek |
|---|---|---|
| **2026-10-13** | 11 | 10 |

Üretim batch'leri (`created_at::date` gruplu): 07-24 → 5 bulmaca (07-24..07-28) ·
07-29 → 14 (07-29..08-11) · 09-30 → 14 (09-30..10-13). Başka üretim yok.

### 1b. Tetikleyici

`cron.job` (9 job). Spotlight'ı üreten **tek** job:

| jobid | jobname | schedule | active | hedef |
|---|---|---|---|---|
| 19 | `generate-puzzles-spotlight` | `0 2 * * 1` (Pzt 02:00 UTC) | true | `/functions/v1/generate-puzzles?game=spotlight`, timeout 150 s |

Kaynak: `supabase/migrations/120_spotlight_puzzles_cron.sql:60-77`
(`schema_migrations`'ta 120 uygulanmış). Repo README de bunu söylüyor
(`supabase/functions/generate-puzzles/README.md:6-9`).

**Son 10 koşum:** `cron.job_run_details where jobid=19` → **0 satır**. Job
hiç tetiklenmedi (30 Eyl Çarşamba kuruldu; ilk Pazartesi 5 Eki).
`job_run_details` geçmişi 2026-05-17'ye kadar gidiyor.

### 1c. Kimlik bilgisi — 5 Eki koşumu büyük olasılıkla 401

```sql
select (decrypted_secret like 'sb\_secret\_%') new_gen, length(decrypted_secret) len, updated_at
from vault.decrypted_secrets where name='cron_service_role_key';
```

| new_gen | len | updated_at |
|---|---|---|
| true | **13** | 2026-10-01 06:23:22 UTC |

- `.env` `SUPABASE_SECRET_KEY` uzunluğu **41** (değer okunmadı/yazdırılmadı).
- `net._http_response` (yalnız son yanıtı tutuyor):
  `2026-10-03 00:05:00 · 401 · {"message":"Invalid API key"}` — saat
  `global-slot-daily` (jobid 7, `5 0 * * *`) ile eşleşiyor; job 7 de aynı
  Vault sırrını okuyor (jobid 6, 7, 18, 19'un dördü de).
- 29 Eyl ölçümünde mesaj "Unregistered API key" idi
  (`docs/TEKNIK_BORC.md:2905-2913`); bugün "Invalid API key" — sır değişmiş,
  ama yine geçersiz.
- Migration 120'nin guard'ı `length >= 40` istiyor (`:42-57`). Bugünkü 13
  karakterlik değer bu guard'dan geçemezdi → sır **migration uygulandıktan
  sonra** 06:23'te değiştirilmiş olmalı. Kim/nasıl değiştirdi:
  **bulunamadı** (repo'da 1 Eki tarihli commit yok; Vault değişikliği
  migration dışı).
- `scope='global'` `daily_gauntlets` son satır **2026-08-31** (jobid 7
  `job_run_details`'ta 57 kez `succeeded` — bu yalnız `net.http_post`'un
  kuyruğa alınmasını ölçer, kanıt değildir; README `:96-98`).

**Sonuç:** jobid 19, 5 Eki 02:00'de aynı sırla istek atacak. Sır değişmezse
yanıt 401, bulmaca üretilmez. Bu bir tahmin değil, aynı sırrın bugünkü
sonucundan çıkarım; kesin kanıt ancak 5 Eki koşumundan sonra
`net._http_response`'tan okunur.

### 1d. Kuyruk biterse (10-14) istemci ne gösterir

| Katman | Davranış | dosya:satır |
|---|---|---|
| Sunucu | `public_daily_puzzles`'ta satır yok → `logError` + **404 `NO_PUZZLE`** ("Today's puzzle is not ready yet") — Sentry'ye **yazmıyor** (yalnız log) | `supabase/functions/get-daily-challenge/index.ts:84-97` |
| `gameApi` | `functions.invoke` hata → `Sentry.captureException` (tag `game_id`, `puzzle_date`) + throw | `services/gameApi.ts:144-154` |
| Bonus kartı | `status: 'error'` (önceki `ready` yoksa) → kart **görünür kalır**, alt metin `subtitleNeutral` ("Guess the film from a blurred frame"), kare yok, fiil yok, **dokunulabilir** → oyun ekranına gider | `useSpotlightCardState.ts:55-68`, `SpotlightBonusCard/index.tsx:111-134` |
| Oyun ekranı | `loadError` → `GameStateView state="error"`: "The puzzle couldn't load / … Check your connection and try again later." + Retry | `components/games/Spotlight/index.tsx:275-278, 440-446`; `locales/en.json:1202-1203` |

Not: kullanıcıya bağlantı sorunu söyleniyor; gerçek neden sunucuda bulmaca
yokluğu. Kart, oynanamayan bir oyuna davet etmeye devam ediyor.

---

## 2. 12 Ağu – 29 Eyl boşluğu

| Hipotez | Kanıt | Sonuç |
|---|---|---|
| Cron durduruldu | `cron.job_run_details` 2026-05-17'den beri; `generate-puzzles` URL'ini çağıran koşum yalnız **5**: jobid 15 (×3, 08-09 13:40–13:42) ve 16 (×2, 08-09 14:04–14:05), ikisi de tek seferlik test job'ları (`generate-global-slot` + `generate-puzzles?force=1`, timeout 30 s). Bugün `cron.job`'da yoklar. Kalıcı bir `generate-puzzles` cron'u bu tarihçede **hiç yok**. | Durdurulan bir cron yok — **hiç kurulmamıştı** |
| Function hata verdi | 08-09 koşumlarının HTTP sonucu `net._http_response` saklama süresi dışında → **bulunamadı**. O tarihte Spotlight satırı oluşmadı (batch tarihleri §1a). Edge Function logları bu tarihler için erişilebilir değil (saklama). | 08-09 denemeleri bulmaca üretmedi; nedeni **bulunamadı** |
| Feature flag ile donduruldu | `app_config.games_enabled = {"games":["spotlight"],"roulette":false}`, `updated_at` 2026-07-28 22:08 | **Hayır** — Spotlight boşluk boyunca açıktı |
| Takvim bitmişti | Boşluk döneminde Spotlight `fetchFilms` (genel havuz) kullanıyordu; editoryal takvime geçiş 09-30 (`1adc164`). Havuz boyutu ölçümü o tarih için yok. | Kanıt yok — ama havuz tükenmesi için önce koşum gerekir; koşum yok |
| Kod değişikliği | `git log --since=2026-08-09 --until=2026-09-30 -- supabase/functions/generate-puzzles supabase/functions/get-daily-challenge supabase/migrations/*cron*` → yalnız 09-30 commit'leri + 08-13 `6e65c81` (profile-missing-films cron) | Boşluğu açan commit yok |

**Belgelenmiş neden** (repo, 30 Eyl): migration 120 `:8-10` — "generate-puzzles'ın
cron'u hiç yoktu (README 'elle tetiklenir'), son elle koşum 29 Tem. Şampiyon
ekranındaki bonus kartı 50 gün boyunca NO_PUZZLE (404) açtı." Ölçümler bununla
tutarlı.

---

## 3. Boşlukta Spotlight'ı açan kullanıcı

| Kaynak | Sonuç |
|---|---|
| PostHog `game_daily_opened` (`game_id='spotlight'`) | **Sorgulanamadı.** Yalnız proje (yazma) anahtarı mevcut (`EXPO_PUBLIC_POSTHOG_KEY`); personal API key Supabase secret'ta. Ayrıca event **yalnız başarılı yüklemede** atılıyor (`Spotlight/index.tsx:274`, `utils/gameAnalytics.ts:12-13`) — boşlukta yapısal olarak 0 olurdu; doğru ölçü değil. |
| PostHog `spotlight_card_viewed` | Aynı erişim kısıtı. Kart repoya 2026-09-20'de girdi (`da83d52`). |
| Sentry `game_id:spotlight` (90 g, errors) | Toplam **2** olay, ikisi de **2026-09-30 13:18–13:19 UTC**, tek kullanıcı (`99E50FA9-…`), release `chosy-ai@2.1.0`, `puzzle_date=2026-09-30`, "Edge Function returned a non-2xx status code". 2026-08-12 → 2026-09-29 arası **0**. |
| `game_scores` (Spotlight) | Tüm zamanlarda 6 satır: 07-25, 07-26, 07-30, 09-30, 10-01, 10-03 (her biri 1). |
| Boşlukta gauntlet oynayan | `daily_gauntlets` `scope='personal'`, 08-12..09-29: 15 satır, **12 kullanıcı** (potansiyel maruz kalan üst sınır; kartın o build'lerde olup olmadığı bilinmiyor). |

**Ne gördüler:** Sentry 0 olay → boşlukta `getDailyChallenge('spotlight')`
çağrısı **ya hiç yapılmadı ya Sentry'ye ulaşmadı**. Hangisi olduğu
**doğrulanamadı** (cihazlardaki build'de giriş noktası olup olmadığı repo'dan
okunamaz). 09-30'daki 2 olay, 13:55'teki elle üretimden ~37 dk önce 404 alan
bir açılış — boşluğun son günü görülen tek kanıt.

---

## 4. Acil durum havuzu

| Soru | Cevap | dosya:satır |
|---|---|---|
| Nerede tanımlı | `daily_puzzles.is_emergency_pool boolean default false` (051) + `date NULL` izni yalnız acil satırda (119 CHECK `daily_puzzles_date_required_unless_emergency`) | `supabase/migrations/051_daily_puzzles_game_system.sql:16`, `119_daily_puzzles_date_nullable.sql:28-29` |
| Hedef boyut | `EMERGENCY_PER_GAME = 15` | `generate-puzzles/index.ts:92` |
| Doldurma | Her koşumun sonunda `fillEmergency` — Spotlight için tarihli bulmacalardan **sonraki** editoryal filmler, takvim sırasıyla | `:1576-1664`, çağrı `:1931-1934` |
| Devreye girme | **Yalnız üretim koşumu içinde:** bir tarih için `genOne` başarısızsa `useEmergency` bir acil satırı o tarihe atar (`date` set, `is_emergency_pool=false`) | `:1913-1928`, `:1666-1694` |
| Okuma yolu | `get-daily-challenge` acil havuza **bakmaz**; view acil satırları dışlar | `get-daily-challenge/index.ts:84-97`; `064_puzzle_view_strip_solution.sql:63` |
| Boşken | Üretim koşumunda: Sentry **fatal** "ACİL HAVUZ BOŞ: spotlight/<tarih>" + rapor hatası; tarih boş kalır | `:1677-1684, 1927` |
| Şu an | **0 satır** (`is_emergency_pool=true` 0, `date is null` 0) | ölçüm |
| Neden boş | 30 Eyl koşumu (13:55 UTC = 16:55 +03) `320e2c5`'ten (21:19 +03; "acil havuz ekleme hatası artık yutulmuyor + 119 date NULL") **önce** — o hâliyle her acil insert 23502 ile reddediliyor ve yutuluyordu (kod yorumu `:1646-1649`). 30 Eyl'den sonra koşum yok. | çıkarım, commit saatleri |

**Sonuç:** acil havuz cron'un çalışmadığı senaryoya karşı koruma **değil**;
yalnız "koşum var ama tek tarih üretilemedi" senaryosunu kapsar. Cron 401
alırsa havuz dolu olsa bile kullanılmaz. Boşken okuma yolunda sessiz null yok
— 404 + istemci Sentry; üretim yolunda fatal.

---

## 5. Ham path kök nedeni

### 5a. Yazan kod

`grep (poster_url|backdrop_url)\s*[:=].*(poster_path|backdrop_path)`:

| Dosya:satır | Yazdığı | Ham mı |
|---|---|---|
| **`scripts/seed-database.ts:283-284`** | `poster_url: film.poster_path`, `backdrop_url: film.backdrop_path` → `upsert(..., { onConflict: 'tmdb_id' })` `:296-298` | **Ham** |
| `supabase/functions/sync-trending/index.ts:254-255` | `${TMDB_IMAGE_BASE}${poster_path}` | Tam URL |
| `scripts/add-missing-films.ts:163-164` | aynı | Tam URL |
| `scripts/fetch-films.ts:335-336` | aynı | Tam URL |
| `scripts/seed-films-to-db.ts:158-159` | JSON'dan geçiriyor (`film.poster_url`) | Kaynağa bağlı |

`gauntletCore.ts` ve `generate-gauntlet/index.ts:314` yorumu da kaynağı
`seed-database.ts` olarak adlandırıyor.

### 5b. Ne zaman, hâlâ yazıyor mu

```sql
select created_at::date, count(*) from films
where poster_url like '/%' or backdrop_url like '/%' group by 1;
```

| created | n |
|---|---|
| 2026-03-09 | 255 |
| 2026-03-20 | 693 |

- Son ham satır oluşturma: 2026-03-20 15:14 UTC. Sonrasında **0** yeni ham satır.
- `seed-database.ts` repoya 2026-03-29'da girdi (`34c42f2`, tek commit) — veri
  yazımından sonra; hangi koşumun yazdığı git'ten **doğrulanamaz**, kod eşleşmesi
  ve yorumlar bu script'i gösteriyor.
- Ham satırların `updated_at`'i: 08-15 (936), 08-31 (1), 09-19 (11) — bu
  güncellemeler poster/backdrop'u **düzeltmemiş**; hangi alanı yazdıkları
  okunamaz.
- **Risk sürüyor:** `package.json:31` `"seed-database": "tsx scripts/seed-database.ts"`;
  upsert `tmdb_id` çakışmasında mevcut satırı **günceller** → script yeniden
  koşarsa listesindeki filmlerin tam URL'lerini ham yola çevirir.

### 5c. Sayılar (count=exact, sunucu)

```sql
select count(*) filter (where poster_url like '/%')  raw_poster,
       count(*) filter (where backdrop_url like '/%') raw_backdrop,
       count(*) filter (where poster_url like '/%' and backdrop_url like '/%') both_raw,
       count(*) filter (where poster_url like '/%' and backdrop_url not like '/%') poster_only,
       count(*) filter (where backdrop_url like '/%' and (poster_url is null or poster_url not like '/%')) backdrop_only
from films;
```

| ham poster | ham backdrop | ikisi | yalnız poster (backdrop tam URL) | yalnız backdrop |
|---|---|---|---|---|
| **948** | **911** | 911 | 0 | 0 |

(948 − 911 = 37 film: poster ham, backdrop NULL.) Tier: 945 archive,
2 trending, 1 core (P-1 §3e).

---

## 6. 33 film — tam liste ve tahmini üretim tarihi

**Yöntem (yaklaşık):** `editorial_calendar_films` sırası `position ASC,
day_number DESC`; çıkarılanlar: şimdiye kadarki Spotlight çözümleri, backdrop/
poster NULL, maske filtresi SQL yaklaşığıyla (A-Z harf sayısı 3..30, A-Z/rakam/
noktalama dışı harf yok). `eff_rank` = 10-13'ten sonraki kuyruk sırası.
`buildTitleMask`'ın birebir kopyası değildir — **yaklaşık**.

**Tarih modeli** (kod okumasıyla, `generate-puzzles/index.ts:1913-1934`): her
haftalık koşum önce eksik tarihleri (LOOKAHEAD 14), **sonra** acil havuzu 15'e
tamamlar; acil satırlar sonraki koşumda havuzdan dışlanır (`:604-622`). Cron
**5 Eki'den itibaren çalışırsa**:

| Koşum | Tarihli | Kuyruk (eff_rank) | Acil havuz |
|---|---|---|---|
| 10-05 | 10-14..10-18 | 1–5 | 6–20 |
| 10-12 | 10-19..10-25 | 21–27 | (dolu) |
| 10-19 | 10-26..11-01 | 28–34 | |

→ eff_rank 27 = **2026-10-25**, 28 = 10-26, 29 = 10-27. Sonrası haftada 7
sıra ilerler: tahmini tarih ≈ `2026-10-25 + (eff_rank − 27)` gün.
`naive` sütunu acil havuz tüketimi olmadan (`2026-10-13 + eff_rank`).
Cron 5 Eki'de 401 alırsa tüm tarihler, onarımdan sonraki ilk koşuma göre kayar.

| eff_rank | tahmini (acil havuzlu) | naive | id | title | tier | day/pos |
|---|---|---|---|---|---|---|
| 27 | **2026-10-25** | 11-09 | `ddf32d20-9c85-4f78-98db-ca0cfb417d8d` | Ocean's Eleven | archive | 57/1 |
| 28 | 2026-10-26 | 11-10 | `4ee7f4f4-41aa-4113-858d-11a54e3b9751` | The Quiet Girl | archive | 56/1 |
| 29 | 2026-10-27 | 11-11 | `4ebd2e6d-960e-465f-b9c4-26656a3a7ef4` | The Princess Bride | archive | 55/1 |
| 57 | 2026-11-24 | 12-09 | `2c5a608f-5cb1-45ba-94c6-dd9355337305` | Mission: Impossible - Fallout | archive | 22/1 |
| 79 | 2026-12-16 | 12-31 | `f81715cf-84ec-4cd2-907d-b9269ea2bf7a` | Scott Pilgrim vs. the World | archive | 99/2 |
| 90 | 2026-12-27 | 2027-01-11 | `21acbc8e-d76c-418e-85d1-5154596adb6d` | The Worst Person in the World | archive | 88/2 |
| 93 | 2026-12-30 | 2027-01-14 | `542925e1-ece4-40f6-95e7-d5acf43c832c` | Lethal Weapon | archive | 85/2 |
| 106 | 2027-01-12 | 2027-01-27 | `58e965db-c419-4a90-a183-7496ffe5e292` | X-Men: Days of Future Past | archive | 71/2 |
| 123 | 2027-01-29 | 2027-02-13 | `6fbf049a-86a4-498b-a26e-f35ca18f427b` | This Is Spinal Tap | archive | 54/2 |
| 128 | 2027-02-03 | 2027-02-18 | `121918a7-1ad4-4c7d-9086-9e62d12b16ed` | Once | archive | 49/2 |
| 135 | 2027-02-10 | 2027-02-25 | `f806fed3-4e69-47d7-a2bf-f1d75d16420f` | The Farewell | archive | 42/2 |
| 142 | 2027-02-17 | 2027-03-04 | `c9bad052-079c-4196-b4ca-5fee393c9d11` | The Book of Life | archive | 34/2 |
| 143 | 2027-02-18 | 2027-03-05 | `74ebfc5e-10a8-48d4-9b33-9da6c03dadeb` | Twelve Monkeys | archive | 33/2 |
| 147 | 2027-02-22 | 2027-03-09 | `e7360d83-4261-4c35-b573-3d84674ef1fb` | King Kong | archive | 29/2 |
| 169 | 2027-03-16 | 2027-03-31 | `aa01a9c2-558c-4143-8ba7-59ea2da83b8d` | The Banshees of Inisherin | archive | 4/2 |
| 174 | 2027-03-21 | 2027-04-05 | `c6d6654f-ea18-4635-a876-49294e295076` | Free Guy | archive | 99/3 |
| 186 | 2027-04-02 | 2027-04-17 | `8b75b450-8f43-40c7-aa88-49f5063cae26` | Children of Men | archive | 87/3 |
| 190 | 2027-04-06 | 2027-04-21 | `dd0803f3-57fc-4ef4-bc80-ade33542da88` | The Hundred-Foot Journey | archive | 83/3 |
| 228 | 2027-05-14 | 2027-05-29 | `dc7bd17f-80a2-4f43-bad3-17657e4ce894` | Still Alice | archive | 45/3 |
| — | elenir (0 harf) | — | `d9b27171-757c-4087-a804-0699b5186c1c` | 300 | archive | 36/3 |
| 239 | 2027-05-25 | 2027-06-09 | `63c9942f-fc1e-4d0d-aac1-ee3275d1d4dd` | Brazil | archive | 33/3 |
| 241 | 2027-05-27 | 2027-06-11 | `89d7cf26-1b41-441c-b726-2a683e7d69d3` | Midnight in Paris | archive | 31/3 |
| 250 | 2027-06-05 | 2027-06-20 | `043911e2-307b-4092-b4df-8f062b5df800` | The Bourne Ultimatum | **core** | 22/3 |
| 262 | 2027-06-17 | 2027-07-02 | `10f3c8c0-c094-4c2a-bfb4-6f65587cd986` | Casino Royale | archive | 8/3 |
| 269 | 2027-06-24 | 2027-07-09 | `80f59a4d-3560-4363-82ce-53006befe6f9` | Baby Driver | archive | 1/3 |
| 278 | 2027-07-03 | 2027-07-18 | `f7455189-ccff-4004-a268-08ad3ad0442b` | Hot Fuzz | archive | 92/4 |
| 281 | 2027-07-06 | 2027-07-21 | `7fb1905c-676c-423f-887e-2ee9153494a2` | Ferris Bueller's Day Off | archive | 89/4 |
| 305 | 2027-07-30 | 2027-08-14 | `f8d6fa68-f2ce-411f-9338-a9ce2b426bc9` | Contact | archive | 64/4 |
| 306 | 2027-07-31 | 2027-08-15 | `b5a975e6-a3b9-4e22-8c42-f5669c823432` | Wind River | archive | 63/4 |
| 310 | 2027-08-04 | 2027-08-19 | `c294c9b2-7bbb-4d1e-b806-ecf5fb70311f` | Boyhood | archive | 59/4 |
| — | elenir (39 harf) | — | `3a214e4e-9438-4e81-96c7-5ba990d06565` | Birdman or (The Unexpected Virtue of Ignorance) | archive | 17/4 |
| 350 | 2027-09-13 | 2027-09-28 | `47c331c3-d808-4fda-b0fd-8c9f301fbea9` | Edge of Tomorrow | archive | 15/4 |
| 359 | 2027-09-22 | 2027-10-07 | `9688fcab-7307-43e7-8c30-4a8d316b15fe` | Paddington 2 | archive | 6/4 |

Acil havuza düşen eff_rank 6–20 aralığında ham-yollu film **yok** (ilk ham
27). Bir acil satır kullanılırsa (`useEmergency`) o satırın `puzzle_data`'sı
da aynı ham sorunu taşıyabilir — şu an 0 satır.

---

## Öneriler (UYGULANMADI — karar CTO'nun)

Öncelik sırasıyla; her biri DUR noktası:

1. **[P0, 5 Eki 02:00 UTC'den önce] Vault sırrı.** `cron_service_role_key`'in
   geçerli 41 karakterlik yeni kuşak anahtarla güncellenmesi (Dashboard,
   kurucu). Etki alanı 4 aktif job (6, 7, 18, 19). Doğrulama: 5 Eki 02:00
   sonrası `net._http_response` → 200 + gövdede `"spotlight":{"generated":5`.
   Alternatif: sır düzelince `generate-puzzles?game=spotlight` elle bir kez
   tetiklenir (lookahead + acil havuz dolar).
2. **[P0 eki] Kuyruk ucunu izleme.** Bugün kuyruğun bittiğini ve cron'un
   başarısız olduğunu gösteren **hiçbir sinyal yok** (`job_run_details`
   `succeeded` yazıyor, `NO_PUZZLE` sunucuda Sentry'ye gitmiyor). Seçenekler:
   `get-daily-challenge` NO_PUZZLE'ı Sentry'ye yazsın · üretim koşumu
   "en ileri tarih < bugün+7" ise Sentry error · haftalık `net._http_response`
   kontrolü. Yeni pattern → CTO.
3. **[P1, ~10-25'ten önce] Ham path.** P-1 EK seçenekleri geçerli; ek
   seçenek: editoryal havuzda (`fetchSpotlightEditorialPool`) ham yolu reddet
   ya da `spotlightData` (`generate-puzzles/index.ts:844-849`) backdrop'u
   üretimde tam URL'e normalize etsin. İlk etkilenen bulmaca 10-12 koşumunda
   üretilir → karar **10-12'den önce** gerekir.
4. **[P1] `seed-database.ts` ezme riski.** Script'in `package.json`'dan
   kaldırılması / arşive alınması ya da `poster_path` normalizasyonu. Kod
   değişikliği → onay.
5. **[P2] İstemci metni.** NO_PUZZLE'da "bağlantını kontrol et" yerine
   "bugünün bulmacası hazırlanıyor" (`games.spotlight.preparing_*` zaten var,
   `Spotlight/index.tsx:433-434`); kartın oynanamayan oyuna davet etmesi.
   Ürün kararı.

---

## Doğrulanamayanlar

- Vault sırrını 2026-10-01 06:23 UTC'de kimin/nasıl değiştirdiği.
- 5 Eki koşumunun gerçek sonucu (çıkarım: 401).
- 08-09 tek seferlik job'ların (15/16) HTTP yanıtları ve neden bulmaca
  üretmedikleri.
- PostHog: boşlukta Spotlight/kart açan kullanıcı sayısı (personal API key
  bu oturumda yok; `game_daily_opened` zaten başarısız yüklemede atılmıyor).
- Boşlukta cihazlardaki build'lerde Spotlight giriş noktası olup olmadığı.
- Ham path'leri yazan koşumun kesin kimliği (script repoya veriden 9 gün
  sonra girdi).
- §6 tarihleri: maske filtresi SQL yaklaşığı, cron'un 5 Eki'den itibaren
  çalıştığı varsayımı.
