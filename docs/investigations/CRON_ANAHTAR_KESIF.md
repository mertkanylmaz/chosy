# CRON_ANAHTAR — Vault cron anahtarı, cron başlıkları, eski anahtar envanteri keşfi

**Tarih:** 30 Eylül 2026 · **Mod:** salt okunur · **Kapsam:** Vault `cron_service_role_key`,
7 HTTP cron'u, hedef fonksiyonların kimlik doğrulaması, legacy anahtar envanteri,
global-slot-daily durmasının kullanıcıya etkisi, yeni anahtar modeline minimum geçiş önerisi.

Hiçbir anahtar değeri yazdırılmadı. Anahtarlar yalnızca biçim, uzunluk ve SHA-256 ilk 16 hex
ile tanımlandı.

---

## Yönetici özeti

1. **Üç aktif cron 31 Ağu'dan beri ölü, `cron.job_run_details` hâlâ `succeeded` yazıyor.**
   Vault'taki anahtar (`sb_secret_`, 41 karakter, son yazım 9 Ağu) bu projeye artık kayıtlı değil:
   son yanıt `401 {"message":"Unregistered API key"}` (29 Eyl 00:05). Yanıt gövdesi fonksiyonun
   kendi 401 biçimi (`{error, code:'SERVICE_ROLE_REQUIRED'}`) DEĞİL — istek gateway'de düşüyor,
   fonksiyon kodu hiç çalışmıyor, dolayısıyla Sentry'ye de hiçbir şey gitmiyor.
2. **Global slot satırı 30 gündür yok** (son `date` = 2026-08-31). `launch_date` = 2026-09-18'den
   bu yana 13 editoryal günün hiçbirinde global satır yok. Doğrudan etkilenen akış **Arşiv**
   (`get-archive-status` → ücretli `missed_day_archive` paywall'ı): kaçırılan her gün
   `unavailable` döner. Fonksiyon yalnızca "bugün" için üretir; kaçırılan 30 gün geriye dönük
   üretilemez.
3. **Mevcut `Authorization: Bearer sb_secret_…` deseni Supabase dokümanına göre desteklenmiyor.**
   Doküman `pg_net` için `apikey` başlığını şart koşuyor. Buna rağmen desen 17–31 Ağu arasında
   ölçülebilir şekilde çalıştı. Yani bugünkü kırılmanın nedeni biçim değil anahtar rotasyonu;
   biçim ise ayrıca kırılgan bir bağımlılık.
4. **Mobil istemci legacy `anon` JWT ile derleniyor** (`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `eyJ…`,
   208 karakter, REST'te 200). Doküman legacy anahtarların "2026 sonuna kadar" çalışacağını
   söylüyor. Kullanıcı elindeki her binary bu tarihe bağımlı.
5. **`profile-missing-films` config.toml'da beyan edilmemiş, sunucuda `verify_jwt = true`.**
   `config.toml`'un "sb_secret JWT değildir, verify_jwt=true cron'u öldürür" iddiasına rağmen
   bu fonksiyon 17/24/31 Ağu 08:00'de film_profiles yazdı. İddia bu ölçümle çelişiyor.

---

## 1. Vault `cron_service_role_key`

| Alan | Değer | Kaynak |
|---|---|---|
| Biçim | `sb_secret_…` (legacy JWT değil) | `vault.decrypted_secrets`, `left(…,6)` = `sb_sec` |
| Uzunluk | 41 | aynı sorgu |
| SHA-256 ilk 16 hex | `965bfa1c8a316494` | aynı sorgu |
| `created_at` | 2026-08-08 15:50:47 UTC | aynı sorgu |
| `updated_at` | **2026-08-09 13:21:25 UTC** | aynı sorgu |
| Vault'taki tek secret mı | Evet (1 satır) | aynı sorgu |

`.env` karşılaştırması (aynı hash yöntemi):

| `.env` anahtarı | Biçim | Uzunluk | sha16 | REST `GET /rest/v1/app_config` (`apikey` başlığı) |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | legacy JWT | 208 | `e9522d4d14e19778` | **200** |
| `SUPABASE_SERVICE_ROLE_KEY` | sb_secret | 41 | `c957f8bc5216e4a7` | **401** Unregistered API key |
| `SUPABASE_SECRET_KEY` | sb_secret | 41 | `cbe14464c57a642a` | **200** |

Vault değeri üç `.env` değerinin hiçbiriyle eşleşmiyor. Çalışan tek sb_secret anahtar
`.env` → `SUPABASE_SECRET_KEY`.

## 2. Cron işleri — başlıklar, hedefler, durum

Kaynak: `cron.job` (canlı), komutlardaki sırlar sorguda regex ile maskelendi.
Repo kaynağı: `supabase/migrations/077_cron_pattern_repair.sql:148,172,195` (Bearer deseni),
`supabase/migrations/080_profile_missing_films_cron.sql`.

| jobid | jobname | aktif | zamanlama | hedef | başlık |
|---|---|---|---|---|---|
| 7 | global-slot-daily | ✅ | `5 0 * * *` | `generate-global-slot` | `Authorization: Bearer <vault>` |
| 6 | weekly-trending-sync | ✅ | `0 6 * * 1` | `sync-trending` | `Authorization: Bearer <vault>` |
| 18 | profile-missing-films | ✅ | `0 8 * * 1` | `profile-missing-films` | `Authorization: Bearer <vault>` |
| 1 | posterle-daily-curation | ❌ | `0 23 * * *` | `curate-posterle` | `Authorization: Bearer <vault>` |
| 3 | send-daily-pick-hourly | ❌ | `0 * * * *` | `send-daily-pick` | `Authorization: Bearer <vault>` |
| 4 | watchlist-activation-weekend | ❌ | `0 15 * * 5` | `watchlist-activation` | `Authorization: Bearer <vault>` |
| 5 | watchlist-activation-mood-recall | ❌ | `0 17 * * 3` | `watchlist-activation` | `Authorization: Bearer <vault>` |
| 2 | cleanup-rate-limits | ✅ | `0 * * * *` | SQL fonksiyonu (HTTP yok) | — |

Yedi HTTP cron'unun **hiçbiri `apikey` başlığı göndermiyor.** Hepsi aynı Vault sırrını okuyor.

### Pasif işlerdeki "GUC hatası" — tam metin

`cron.job_run_details`'ten, iş başına gruplanmış:

| jobid | tam hata metni | adet | ilk | son |
|---|---|---|---|---|
| 1 | `ERROR:  unrecognized configuration parameter "app.settings.supabase_url"` | 84 | 2026-05-17 23:00 | 2026-08-08 23:00 |
| 3 | `ERROR:  unrecognized configuration parameter "app.supabase_functions_url"` | 1408 | 2026-06-11 22:00 | 2026-08-09 13:00 |
| 4 | `ERROR:  unrecognized configuration parameter "app.supabase_functions_url"` | 9 | 2026-06-12 15:00 | 2026-08-07 15:00 |
| 5 | `ERROR:  unrecognized configuration parameter "app.supabase_functions_url"` | 8 | 2026-06-17 17:00 | 2026-08-05 17:00 |

Bu hatalar **tarihsel**: dördü de 077'nin komutları sabit URL + Vault desenine çevirdiği
9 Ağu'dan önceye ait. Bugünkü `cron.job.command` hiçbir GUC okumuyor ve işler pasif olduğu için
o tarihten beri hiç koşmadı. Yeniden aktive edilirlerse GUC hatası vermezler, aktif üçlüyle aynı
`401 Unregistered API key`'e düşerler (çıkarım — aynı Vault sırrı, aynı başlık; ölçülmedi).

Ek not: jobid 15/16/17 `job_run_details`'te var (9 Ağu, 2–3 koşum) ama `cron.job`'da yok —
silinmiş test işleri.

### Ölüm tarihinin ölçümü

`film_profiles.updated_at` saatlik dağılımı (Pazartesi 08:00 = profile-missing-films):

| saat (UTC) | satır |
|---|---|
| 2026-08-17 08:00 | 9 |
| 2026-08-24 08:00 | 10 |
| 2026-08-31 08:00 | 15 |
| 2026-09-07, 14, 21, 28 08:00 | **0** |

`daily_gauntlets` global: son satır `date = 2026-08-31`, `generated_at = 2026-08-31 00:05:04`.
İkisi birlikte kırılmanın **31 Ağu 08:00 ile 1 Eyl 00:05 UTC** arasında olduğunu gösteriyor.
`films`: `curation_tier='trending'` ve `created_at >= 2026-09-01` → **0** (sync-trending de ölü).

`net._http_response` 6 saatlik TTL'e sahip; yalnızca son koşum görülebildi:
`401 {"message":"Unregistered API key","hint":"Double check the provided API key as it is not registered for this project."}` — 2026-09-29 00:05:00 UTC (global-slot-daily).

## 3. Hedef fonksiyonlar çağıranı nasıl doğruluyor

Canlı `verify_jwt` (`supabase functions list -o json`):

| fonksiyon | canlı verify_jwt | config.toml | son deploy | kod içi kapı |
|---|---|---|---|---|
| generate-global-slot | false | `config.toml:49-50` false | 16 Ağu v25 | `index.ts:163` `requireServiceRole` |
| sync-trending | false | `config.toml:52-53` false | 13 Ağu v25 | `index.ts:309` `requireServiceRole` |
| profile-missing-films | **true** | **beyan yok** | 13 Ağu v13 | `index.ts:269` `requireServiceRole` |
| curate-posterle | false | `config.toml:55-56` false | 9 Ağu v26 | `index.ts:61` |
| send-daily-pick | false | `config.toml:58-59` false | 9 Ağu v23 | `index.ts:135` |
| watchlist-activation | false | `config.toml:61-62` false | 9 Ağu v23 | `index.ts:127` |

Kapı: `supabase/functions/_shared/auth.ts:184-224` `requireServiceRole()`:
- Yalnızca `Authorization` başlığını okur (`auth.ts:207-209`, regex `^Bearer\s+(\S+)$`).
  **`apikey` başlığına bakmaz.**
- Karşılaştırdığı değer `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` (`auth.ts:192`) — tek değer,
  sabit zamanlı SHA-256 eşitliği. `SUPABASE_SECRET_KEYS` okunmuyor.
- Kod yorumu (`auth.ts:164-166`) runtime'daki `SUPABASE_SERVICE_ROLE_KEY`'in bu projede
  `sb_secret_` biçiminde olduğunu söylüyor (8 Ağu ölçümü). **Bugünkü değeri doğrulanamadı**
  (bkz. Doğrulanamayanlar).

Gözlem: `profile-missing-films` sunucuda `verify_jwt = true` iken Bearer sb_secret ile 3 kez
başarıyla çalıştı. `config.toml:37-40`'taki "`verify_jwt = true` olan bir fonksiyona cron'un
header'ı gateway'de reddedilir" iddiası bu ölçümle çelişiyor. Supabase dokümanı da "platformun
verify_jwt kontrolü yalnızca legacy JWT anahtarları anlar" diyor; gateway'in sb_secret'i nasıl
kabul ettiği (dahili JWT'ye çevirme vb.) belgelenmemiş davranış.

## 4. Eski anahtar kullanım envanteri

Yalnızca **okuma noktaları** (`process.env` / `Deno.env.get`); yorum satırları hariç.
`docs/`, `_archive/`, `node_modules/`, `*.md` taranmadı.

### 4a. İstemci (binary'ye gömülü) — `EXPO_PUBLIC_SUPABASE_ANON_KEY`

| dosya:satır | kullanım |
|---|---|
| `constants/config.ts:12` | `SUPABASE_ANON_KEY` export'u → `services/supabase.ts:95` `createClient` |
| `app.config.ts:21` | `extra.supabaseAnonKey` |
| `services/authService.ts:667` | `delete-account` çağrısında `apikey` başlığı |
| `scripts/check-env.ts:45` | build ön koşulu (REQUIRED listesi) |
| `.env.example:10` | şablon |

`services/tasteParser.ts:14,107,120`, `services/recommendations.ts:24,732,756` → `constants/config`
üzerinden aynı değeri kullanıyor (dolaylı).

### 4b. Edge Functions — `SUPABASE_SERVICE_ROLE_KEY` (runtime enjekte)

| dosya:satır |
|---|
| `_shared/gameUtils.ts:71` (`getServiceClient` — çoğu fonksiyonun ortak yolu) |
| `_shared/auth.ts:192` (**kapı karşılaştırması**) |
| `_shared/posterleUtils.ts:83` |
| `check-quota/index.ts:46,126` · `delete-account/index.ts:173` · `generate-puzzles/index.ts:103` |
| `lifetime-counter/index.ts:43` · `parse-mood/index.ts:26` · `parse-taste/index.ts:299` |
| `process-lifetime-purchase/index.ts:105` · `process-referral/index.ts:36` |
| `profile-missing-films/index.ts:278` · `recompute-user-vector/index.ts:123` |
| `revenuecat-webhook/index.ts:254` · `schedule-notifications/index.ts:127` |
| `send-daily-pick/index.ts:142` · `send-notifications/index.ts:62` |
| `slot-mood-filtered/index.ts:42,194` · `slot-pure-random/index.ts:38,139` · `slot-triple/index.ts:57,157` |
| `submit-guess/index.ts:580,759,982,1158,1261,1525` |
| `sync-trending/index.ts:162` · `watchlist-activation/index.ts:155` · `winback-sequencer/index.ts:168` |

### 4c. Edge Functions — `SUPABASE_ANON_KEY` (runtime enjekte)

`_shared/gameUtils.ts:59` (`getUserClient`) · `_shared/posterleUtils.ts:71` · `check-quota/index.ts:49` ·
`delete-account/index.ts:174` · `parse-taste/index.ts:298` · `slot-mood-filtered/index.ts:41` ·
`slot-pure-random/index.ts:37` · `slot-triple/index.ts:56`

### 4d. Yerel script'ler ve testler — `.env` → `SUPABASE_SERVICE_ROLE_KEY` (**bugün 401**)

Scripts: `add-missing-films.ts:47` · `ai-profile-films.ts:280` · `audit-film-metadata-gaps.ts:41` ·
`backfill-cast.ts:12` · `backfill-film-metadata.ts:140` · `backfill-imposter-characters.ts:61` ·
`backfill-imposter-photos.ts:34` · `compute-dominant-colors.ts:526` · `enrich-films.ts:80` ·
`enrich-films-metadata.ts:55` · `ingest-editorial-films.ts:80` (yorumda `:28-33` elle override
talimatı var) · `profile-films.ts:852` · `seed-database.ts:97` · `seed-films-to-db.ts:85` ·
`verify-ai-profiles.ts:172` · `verify-db-state.ts:24`

Testler: `tests/game-system/e2e-api.test.ts:34` (`.env` dosyasını doğrudan parse ediyor, `:35`
anon da) · `tests/founder-acceptance/runner.ts:27` · `tests/recommendation-quality/run-quality-test.ts:29`
· `tests/recommendation-quality/adversarial-runner.ts:30` (son üçü anon).

### 4e. Değişiklik tablosu (yeni anahtar karşılıkları)

| Grup | Bugün | Doküman karşılığı | Etki alanı | Boyut |
|---|---|---|---|---|
| İstemci anon | `EXPO_PUBLIC_SUPABASE_ANON_KEY` (legacy JWT) | `sb_publishable_…` (örn. `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | 4 okuma noktası + EAS env + **yeni binary**; eski binary'ler legacy devre dışı kalana kadar legacy'ye bağlı | M |
| Edge service client | `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` | `JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default']` | ~35 okuma, 24 fonksiyon + 2 shared modül; hepsi redeploy | L |
| Edge user client | `Deno.env.get('SUPABASE_ANON_KEY')` | `JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)['default']` | 8 okuma; kullanıcı JWT'si `Authorization`'da kalır | M |
| Servis kapısı | `auth.ts:192,207` Bearer ↔ `SUPABASE_SERVICE_ROLE_KEY` | `apikey` başlığını `SUPABASE_SECRET_KEYS` değer(ler)iyle karşılaştır (ya da `@supabase/server` `auth:'secret'`) | 1 dosya + 6 cron hedefi + `generate-puzzles` redeploy | S kod / M deploy |
| Cron başlıkları | `Authorization: Bearer <vault>` × 7 | `apikey: <vault>` | 7 `cron.job` komutu (migration) + Vault değeri | S |
| Script/test | `.env` `SUPABASE_SERVICE_ROLE_KEY` (401) | `.env` `SUPABASE_SECRET_KEY` (200) | 16 script + 1 test | S (env adı) |
| `profile-missing-films` verify_jwt | sunucuda `true`, beyansız | doküman: yeni anahtarla `verify_jwt = false` | `config.toml` + redeploy | S |

## 5. global-slot-daily durursa kullanıcıya etkisi

**Global satırı okuyan yerler (canlı kod):**

| dosya:satır | ne yapıyor | etki |
|---|---|---|
| `supabase/functions/get-archive-status/index.ts:206-213` `fetchGlobalSelections` | Kaçırılan günlere o günün global dörtlüsünü ekler | satır yoksa `day.unavailable = true` (`:297`) |
| `supabase/functions/_shared/gauntletCore.ts:482` `fetchGlobalExclusions` | Son 21 günün global filmlerini dışlar | yalnız `generate-global-slot` kullanıyor; satır yokken dışlama kümesi boş |

**Global satırı OKUMAYAN yerler:** `generate-gauntlet` (`index.ts:280-285` yorumu: "Bu dosya onu
HENÜZ OKUMUYOR … `global` burada yalnızca bir ETİKETTİR"). Günlük ritüelin kendisi (kişisel ve
editoryal dörtlü) global satırdan bağımsız.

**Editoryal takvimle ilişki:**
- `app_config.launch_date` = `2026-09-18` (ölçüldü). Editoryal dönem gün 1–100; bugün gün 13.
- Editoryal günde kullanıcı dörtlüsü `editorial_calendar_films`'ten gelir
  (`_shared/editorialCalendar.ts:166`, `generate-gauntlet/index.ts:21-25` DAL A). Global slot
  cron'u bundan etkilenmez, onu etkilemez de.
- `generate-global-slot` editoryal takvime bakmıyor (dosyada `editorial` geçmiyor): cron
  çalışsaydı bile editoryal günlerde global satır, o gün kullanıcıya gösterilen editoryal
  dörtlüden **farklı**, algoritmik bir dörtlü olurdu. Arşiv o günü "herkese gösterilen seçki"
  diye sunuyor (`app/archive.tsx:11-13`). Bu, cron'dan bağımsız ayrı bir tutarsızlık.

**Somut kullanıcı etkisi (bugün):**
- `ARCHIVE_WINDOW_DAYS = 7` (`get-archive-status/index.ts:76`). 1 Eyl'den beri global satır
  olmadığı için pencere içindeki **her kaçırılan gün `unavailable`**.
- `ArchiveTrigger` (`components/gauntlet/ArchiveTrigger/index.tsx:71-72,103-106`) kaçırılan gün
  sayısını ve uygunluğu bu fonksiyondan alır; uygun ve premium olmayan kullanıcıda bağlantı
  `missed_day_archive` paywall'ını açar. Yani kullanıcı, içeriği `unavailable` olan bir arşiv
  için paywall görebilir.
- Kayıp kalıcı: `generate-global-slot/index.ts:166` `date = utcDateString()` — yalnızca bugün
  üretilir, tarih parametresi yok. 1–30 Eyl arası global satırlar anahtar düzeltilse de geri gelmez.

## 6. Minimum çözüm ÖNERİSİ (uygulanmadı)

Kaynak: Supabase dokümanı "Migrating to publishable and secret API keys" → *Database Webhooks and
`pg_net`* ve *Known limitations*; "Securing Edge Functions" → *Service-to-service calls*.
Doküman özetle: sb_ anahtarları `Authorization: Bearer` ile gönderilemez, `apikey` başlığıyla
gönderilir; platform yeni anahtarlar için `apikey`'i doğrulamaz, `verify_jwt = false` + kod içi
doğrulama gerekir; anahtar Vault'ta tutulur.

İki katman var, sırayla:

**A — Anahtarı canlandır (çekirdek sorun bu).** Vault `cron_service_role_key` değeri, şu an
kayıtlı olan bir secret anahtarla değiştirilir (`.env` `SUPABASE_SECRET_KEY` ile aynı değer ya da
cron'a özel yeni isimli bir secret anahtar). Bu tek başına bugünkü deseni Ağustos'taki çalışır
hâline döndürür **ancak ve ancak** runtime'daki `SUPABASE_SERVICE_ROLE_KEY` o değere eşitse
(bkz. Doğrulanamayanlar #1). Desen dokümana aykırı kalır.

**B — Dokümana uygun desen.** 
1. `auth.ts` `requireServiceRole`: `apikey` başlığını oku; `SUPABASE_SECRET_KEYS` JSON'undaki
   değer(ler)le sabit zamanlı karşılaştır. Geçiş penceresi için Bearer yolunu da kabul etmek
   bir seçenek (CTO kararı).
2. 7 cron komutunda `'Authorization', 'Bearer ' || …` → `'apikey', …` (migration, 077 deseni).
3. `profile-missing-films`'i `config.toml`'a `verify_jwt = false` ile ekle.
4. Deploy sırası: önce kapıyı iki başlığı da kabul edecek şekilde deploy et (tüketici), sonra
   cron başlığını değiştir (üretici) — `chosy-conventions` §"tüketici önce" ile aynı gerekçe.

Her iki katman da doğrulama olarak `net._http_response`'u koşumdan sonraki 6 saat içinde okumayı
gerektirir; `job_run_details.succeeded` kanıt değildir.

---

## DUR NOKTASI gerektiren maddeler

| # | Madde | Neden DUR |
|---|---|---|
| D1 | Vault sırrının değerini değiştirmek (A) | Üretim sırrı; hangi anahtarın (default mu, cron'a özel yeni isimli mi) kullanılacağı karar |
| D2 | 7 cron komutunu `apikey`'e çevirmek (B.2) | Migration — `supabase db push` + onay |
| D3 | `requireServiceRole` sözleşmesini değiştirmek (B.1) | `auth.ts:167-170` "kapı tek anahtara bakar (CTO kararı, 8 Ağu 2026)"; `SUPABASE_SECRET_KEYS` okumak yeni desen |
| D4 | `@supabase/server` SDK'sına geçiş | Yeni bağımlılık |
| D5 | `profile-missing-films` verify_jwt beyanı + redeploy | Deploy |
| D6 | İstemcinin publishable anahtara geçişi | Yeni binary + EAS env; legacy devre dışı bırakma takvimi (doküman: 2026 sonu) ürün kararı |
| D7 | Kaçırılan 30 günlük global satır boşluğu | Geri üretim `generate-global-slot`'a tarih parametresi ister (sözleşme/davranış değişikliği) |
| D8 | Editoryal günde global satırın editoryal dörtlüden farklı olması | Arşiv kopyasının doğruluğu — ürün kararı |

## Bulgular tablosu

| dosya:satır | açıklama | boyut |
|---|---|---|
| `vault.decrypted_secrets` (`cron_service_role_key`) | sb_secret, 41 kr., 9 Ağu'dan beri değişmedi, projeye kayıtlı değil (401) | S |
| `supabase/migrations/077_cron_pattern_repair.sql:148,172,195` | Bearer deseni; dokümana göre sb_ anahtarları için desteklenmiyor | S |
| `supabase/functions/_shared/auth.ts:192,207` | Kapı yalnız `Authorization` + `SUPABASE_SERVICE_ROLE_KEY`; `apikey`/`SUPABASE_SECRET_KEYS` yok | S |
| `supabase/config.toml` (beyan yok) | `profile-missing-films` sunucuda verify_jwt=true | S |
| `supabase/config.toml:37-40` | "verify_jwt=true cron'u öldürür" iddiası 17/24/31 Ağu ölçümüyle çelişiyor | S |
| `supabase/functions/get-archive-status/index.ts:206-213,297` | 1 Eyl'den beri her kaçırılan gün `unavailable`; ücretli arşiv boş içerik sunuyor | M |
| `supabase/functions/generate-global-slot/index.ts:166` | Yalnızca bugün üretir; 30 günlük boşluk geri doldurulamaz | M |
| `supabase/functions/generate-global-slot/index.ts` (editoryal kontrol yok) | Editoryal günlerde global satır ≠ gösterilen dörtlü | M |
| `constants/config.ts:12`, `app.config.ts:21`, `services/authService.ts:667` | İstemci legacy anon JWT'ye bağlı | M |
| §4b listesi (~35 okuma) | Edge Functions `SUPABASE_SERVICE_ROLE_KEY` okuyor | L |
| §4d listesi (16 script + 1 test) | `.env` `SUPABASE_SERVICE_ROLE_KEY` → 401 | S |

## Ölçülmüş sayılar ve sorgular

Tüm sorgular `supabase db query --linked`, salt okunur.

```sql
-- Vault meta (değer yazdırılmadan)
select name, left(decrypted_secret,6), length(decrypted_secret),
       left(encode(sha256(convert_to(decrypted_secret,'UTF8')),'hex'),16),
       created_at, updated_at
from vault.decrypted_secrets;
-- → 1 satır: sb_sec, 41, 965bfa1c8a316494, 2026-08-08 15:50, 2026-08-09 13:21

-- Cron komutları (sırlar regex ile maskelendi)
select jobid, jobname, schedule, active, command from cron.job;          -- 8 iş

-- Koşum geçmişi
select jobid, status, left(return_message,400), count(*), min(start_time), max(start_time)
from cron.job_run_details group by 1,2,3;
-- → job 7: 53 succeeded (8 Ağu–29 Eyl); job 6: 13; job 18: 7; job 1/3/4/5: GUC hataları (yukarıda)

-- pg_net son yanıtlar (TTL 6 saat)
select status_code, left(content::text,120), count(*), max(created)
from net._http_response group by 1,2;
-- → 401 Unregistered API key × 1, 2026-09-29 00:05

-- Global slot kapsamı
select count(*), count(*) filter (where date >= '2026-09-01'),
       count(*) filter (where date >= '2026-09-18'), min(date), max(date)
from daily_gauntlets where scope='global';
-- → toplam 25 · Eylül 0 · launch sonrası 0 · 2026-08-07 … 2026-08-31

-- profile-missing-films izi
select date_trunc('hour', updated_at), count(*) from film_profiles
where updated_at >= '2026-08-15' and updated_at < '2026-09-02' group by 1;
-- → 08-17 08:00 = 9 · 08-24 08:00 = 10 · 08-31 08:00 = 15
-- (10 Ağu sonrası tüm günler: yalnız 13 Ağu, 17/24/31 Ağu ve 19 Eyl = 94 [editoryal ingest])

-- Vektörsüz havuz filmi (bugün)
select count(*) filter (where p.profile_vector is null), count(*)
from film_profiles p join films f on f.id = p.film_id
where f.curation_tier in ('core','extended','trending');                 -- 0 / 1962

-- sync-trending izi
select max(created_at), count(*) filter (where created_at >= '2026-09-01' and curation_tier='trending')
from films;                                                              -- 2026-09-19 14:12 · 0

select value from app_config where key = 'launch_date';                  -- 2026-09-18
```

REST canlılık ölçümü (Node `fetch`, `GET /rest/v1/app_config?select=key&limit=1`, yalnız `apikey`
başlığı): anon JWT 200 · `.env` `SUPABASE_SERVICE_ROLE_KEY` 401 · `.env` `SUPABASE_SECRET_KEY` 200.

`supabase functions list -o json` → verify_jwt tablosu (§3).

## Doğrulanamayanlar

1. **Runtime'daki `SUPABASE_SERVICE_ROLE_KEY`'in bugünkü değeri.** 8 Ağu'da `sb_secret_` (41)
   olarak ölçülmüştü; rotasyon sonrası `.env` `SUPABASE_SECRET_KEY`'e (`cbe1…`) eşit mi, yoksa
   legacy JWT'ye mi döndü bilinmiyor. Doğrulamanın tek yolu servis kapılı bir fonksiyonu
   çağırmak — cron hedeflerinin hepsi yazma yapıyor, salt okunur turda çağrılmadı. Öneri A'nın
   işe yarayıp yaramayacağı buna bağlı.
2. **Rotasyonun kaynağı.** Vault anahtarının hangi olayla geçersizleştiği (Dashboard'da secret
   silme/yenileme) — Dashboard audit log'una erişim yok. Hafıza notu `.env` mtime 31 Ağu 17:02
   UTC diyor; bu tur tekrar ölçülmedi.
3. **Gateway'in Bearer sb_secret'i neden Ağustos'ta kabul ettiği** (hem verify_jwt=false hem
   true fonksiyonlarda). Doküman bunu desteklenmeyen desen olarak tanımlıyor; platformun bu
   davranışı koruyacağına dair kanıt yok.
4. **Pasif 4 işin bugünkü davranışı.** Aktive edilmedikleri için bugünkü başlıklarıyla ne
   döneceği ölçülmedi (çıkarım: aynı 401).
5. **Sentry'de iz.** `profile-missing-films` her koşumda Sentry'ye sinyal bırakıyor
   (`index.ts:22-27`); sinyalin 7 Eyl'den beri kesildiği Sentry'de kontrol edilmedi.
6. **Legacy anahtarların proje düzeyinde devre dışı bırakma tarihi.** Doküman genel olarak
   "2026 sonu" diyor; bu proje için Dashboard'da planlanmış bir tarih olup olmadığı görülmedi.
