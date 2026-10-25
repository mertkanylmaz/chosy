# MONEY-1C — iki günlük uygulama runbook'u: 26 Eki (139, 140, parse-mood v43) + 27 Eki (141, 142) (HAZIRLANDI — HİÇBİR ADIM ÇALIŞTIRILMADI)

Durum: yazıldı 25 Eki 2026, 12:05 kararına göre iki güne bölündü. **Her adım ayrı onay ister; sonraki adıma geçmeden önce doğrulama sorguları yeşil olmalı.**
Proje: `chosy ai` (`xpcwihldlnlmyopjubdc`). Diğer proje (`shit`) ile ilgisi yok. Komutlar PowerShell; sorgular `supabase db query --linked` ya da Dashboard SQL editor (SADECE salt-okunur doğrulama — migration'lar yalnız `supabase db push`, CLAUDE.md kural 3).

**Pencere:** TR **12:00–14:00** (ABD sabahı; Türkiye öğlen). Bu saatler Sentry/PostHog akışının izlenebildiği ve ABD trafiğinin henüz tepede olmadığı aralıktır. (Önceki taslaktaki "04:00–08:00" ifadesi GEÇERSİZDİR.) Pencere dışında uygulama yapılmaz.

| Gün | Kapsam | Koşul |
|---|---|---|
| **26 Eki** | **139** (idempotency + istemci INSERT/UPDATE daraltma) → **140** (mood_searches 4 yetki) → **parse-mood v43 deploy** → smoke test **A** | Bölüm 0 ön kontrolleri yeşil |
| **27 Eki** | **141** (tüm tablolarda 3 yetki + 4 tabloda yazma) → **142** (`increment_promo_usage` EXECUTE daraltma + `claim_lifetime_spot` `search_path`) | **26 Eki doğrulaması temiz** (Bölüm B ön koşulu) |
| build sonrası (29–30 Eki preview build + cihaz testi) | istemci build + bayrak + smoke test **B** (claim-first) | Bu runbook'un dışında, ayrı onay |

Beklenen ürün etkisi: yeni istemci yok iken kullanıcıya görünür değişiklik YOK (eski istemciler `client_search_id` göndermez → eski akış).

**Bölüm A = 26 Eki** (aşağıda Bölüm 0, Adım 1–3, A geri alma tetikleyicileri). **Bölüm B = 27 Eki** (Adım 5, B geri alma tetikleyicileri). Her bölümün kendi doğrulaması ve geri alma tetikleyicisi vardır.

---

# BÖLÜM A — 26 EKİ (139, 140, parse-mood v43)

---

## 0. Ön kontroller (hepsi tamam olmadan Adım 1'e geçme)

| # | Kontrol | Nasıl | Beklenen |
|---|---|---|---|
| 0.1 | **Mantıksal export kapısı** (Supabase Free: yedek/PITR YOK — karar 25 Eki 12:20) | `powershell -NoProfile -File scripts\backup\export-logical.ps1 -OutDir C:\Users\mertk\moodflix-rollback\backup-2026-10-26` (salt-okunur; mevcut CLI oturumu, anahtar gerekmez; klasör repo dışı, git'e EKLENMEZ — kişisel veri) | `MANIFEST.txt` son satırı `SONUC: TUM TABLOLAR TAMAM`; 10 tablonun hepsi `OK`; md5'ler ve satır sayıları kayıt tablosuna yazılır. **Export yok / eksik / MANIFEST kırmızı → apply YOK.** Beklenen sayılar (25 Eki ölçümü): mood_searches 121, users 337, subscriptions 8, user_daily_quotas 81, watchlist 360, app_config 30, subscription_limits 5, promo_codes 1, lifetime_sales 0, deletion_requests 0. Büyük sapma (örn. users azalmış) → DUR, nedenini bul. **Bölüm B (27 Eki) öncesi export yeniden alınır** (`-OutDir ...\backup-2026-10-27`). |
| 0.2 | Dal ve temizlik | `git switch feat/money-1c; git status --short; git rev-parse HEAD` | dal `feat/money-1c`, çıktı BOŞ. **Kirli/yanlış dal → DUR.** SHA'yı kaydet — **25 Eki 2026, Bölüm A ön kontrolleri sırasında HEAD: `070606982ef9c9f742c8e785ab300c5f9dd8d627`** (`0706069`; migration 139–142 ve parse-mood bu SHA'daki hâliyle uygulanır; bu satırı ekleyen runbook commit'i yalnız belge farkıdır) (bu belgeyi içeren commit: `git log -1 -- docs/investigations/MONEY-1C_DEPLOY_RUNBOOK.md`) |
| 0.3 | Migration durumu | `supabase migration list` | Local 139, 140, 141, 142 — Remote en yüksek **138**. Remote'ta 138'den büyük bir sürüm varsa DUR (CLAUDE.md "migration numaralandırma") |
| 0.4 | Ön durum kaydı | aşağıdaki sorgu P0 | `rows=121`, `md5=923ac0b9cc5ffabc4fa62e1f5056e657`, `legacy_md5=dee4b541c8401acc4553fa4a56f72935` (created_at ≤ 2026-10-25 03:56:25.671135+00), `acl_md5=7547c9658ede91689da90ed8bc374d4f`, son migration `138`. **Yeni satır girmişse** (rows>121) yalnız `legacy_md5` (≤ sınır) ve `acl_md5` karşılaştırılır; `md5` (tüm satır) 139'dan sonra kolon eklendiği için ZATEN değişir |
| 0.5 | Dosya kayıtları | `Test-Path C:\Users\mertk\moodflix-rollback\139_rollback.sql, ...\140_rollback.sql, ...\141_rollback.sql, ...\142_rollback.sql, ...\139_pre_state_snapshot.txt, ...\141_pre_state.txt, ...\142_pre_state.txt` | hepsi `True` |
| 0.6 | parse-mood canlı sürüm | `supabase functions list` | `parse-mood` VERSION **42**, UPDATED 2026-10-24 19:30 UTC |
| 0.7 | Canlı = depodaki önceki kaynak | boş bir geçici proje dizininde (`mkdir $env:TEMP\pm42; cd $env:TEMP\pm42; supabase init; supabase link --project-ref xpcwihldlnlmyopjubdc; supabase functions download parse-mood --use-api`) indir; `git worktree add $env:TEMP\pm-prev 71d32e0` ile aynı commit'in `supabase/functions/parse-mood` + `_shared` dizinleriyle `git diff --no-index` karşılaştır. (Çalışma kopyasını bozmamak için ana depoda indirme YAPMA.) | fark yok. Fark varsa DUR (geri alma hedefi belirsiz — `project_deploy_durumu_bibledan_okunmaz`) |
| 0.8 | Testler | `npm run typecheck` (baseline 14), `npm run test:mood-offer` (94), `npm run test:mood-claim` (9) | yeşil |
| 0.9 | Dry-run'lar canlıda yeşil | `supabase db query --linked -f supabase\tests\139_dryrun.sql` ve `...\140_dryrun.sql` (BEGIN…RAISE, kalıcı değişiklik yok) | `zz_summary \| ALL PASS` (139: 15/15, 140: 4/4) |

**0.1 — 26 Eki 11:30 export tekrarı (tek satır, salt-okunur):**
```powershell
powershell -NoProfile -File scripts\backup\export-logical.ps1 -OutDir C:\Users\mertk\moodflix-rollback\backup-2026-10-26-1130; powershell -NoProfile -File scripts\backup\verify-export.ps1 -BackupDir C:\Users\mertk\moodflix-rollback\backup-2026-10-26-1130
```
(25 Eki'de alınan `backup-2026-10-26` klasörü ilk denemedir; üstüne yazılmaz, 11:30 export'u ayrı klasöre gider. Pencere TR 12:00–14:00, export bir saat öncesi.)
`verify-export.ps1` şunları yapar ve **kırmızı varsa çıkış kodu 1 (apply YOK)**:
1. **Bulut senkronu kapısı (OneDrive vb.):** klasör yolu `%OneDrive%` (bu makinede `C:\Users\mertk\OneDrive`) ya da `OneDrive/Dropbox/Google Drive/iCloud/Box/pCloud/MEGA` adlı bir üst klasörün altındaysa, yol üzerinde yeniden-ayrisim noktası (junction/symlink) ya da dosyalarda bulut öznitelikleri (RECALL/PINNED/UNPINNED) varsa KIRMIZI. Beklenen: `C:\Users\mertk\moodflix-rollback\…` OneDrive altında değil (25 Eki'de doğrulandı: OK). Kişisel veri bulutta olmamalı.
2. **MANIFEST karşılaştırması:** her tablo için dosya satır sayısı = MANIFEST satır sayısı ve dosya md5 = MANIFEST md5 (dosya export'tan sonra değişmedi).
3. **Canlı kıyas:** dosya satır sayısı ile **canlı `count(*)`**. Fark `SAPMA(±n)` olarak yazılır; export ile kontrol arasında yazma olabileceğinden hata değil, bilgidir (yeni mood_searches/users satırı normaldir). Beklenmedik azalma (örn. users düşmüş) → DUR, nedenini bul.
Yarınki sayılar bugünküyle (121/337/8/81/360/30/5/1/0/0) birebir aynı olmak zorunda DEĞİL; kapı MANIFEST'in dosyayla tutarlılığı + canlıyla makul kıyastır.

**P0 — ön durum sorgusu (salt-okunur):**
```sql
select
  (select count(*) from public.mood_searches) as rows,
  (select md5(string_agg(t::text,'|' order by id)) from public.mood_searches t) as md5,
  (select md5(string_agg(concat_ws('|', id, user_id, search_date, searches_used, created_at, searched_at, mood_text, parsed_profile, rpc_version, error_code, recommended_film_ids), E'\n' order by id))
     from public.mood_searches where created_at <= '2026-10-25 03:56:25.671135+00') as legacy_md5,
  (select md5(string_agg(c.relname||coalesce(c.relacl::text,''), '|' order by c.relname))
     from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','p')) as acl_md5,
  (select max(version) from supabase_migrations.schema_migrations) as mig;
```

**Migration dosyalarını tek tek itmek:** `supabase db push` bekleyen TÜM migration'ları uygular. Bu yüzden henüz itilmeyecek dosyalar geçici olarak klasörün DIŞINA alınır (commit'lenmez, işi bitince geri konur) ve `--dry-run` ile liste doğrulanır.

---

## Adım 1 — 139 (idempotency + istemci INSERT/UPDATE daraltma)

```powershell
New-Item -ItemType Directory -Force $env:TEMP\mig-hold | Out-Null
Move-Item supabase\migrations\140_*.sql, supabase\migrations\141_*.sql, supabase\migrations\142_*.sql $env:TEMP\mig-hold\
supabase db push --dry-run          # YALNIZ 139 listelenmeli; başka dosya varsa DUR
supabase db push                    # onay: y
Move-Item $env:TEMP\mig-hold\140_*.sql, $env:TEMP\mig-hold\141_*.sql, $env:TEMP\mig-hold\142_*.sql supabase\migrations\
git status --short                  # BOŞ olmalı
```

**Doğrulama (hepsi geçmeli):**
```sql
-- V1.1 migration sürümü: son = 139
select max(version) from supabase_migrations.schema_migrations;

-- V1.2 kolonlar (5 yeni) + CHECK + kısmi UNIQUE
select column_name, data_type, column_default from information_schema.columns
 where table_schema='public' and table_name='mood_searches'
   and column_name in ('client_search_id','status','claimed_at','quota_consumed','claim_attempts') order by 1;   -- 5 satır
select conname from pg_constraint where conrelid='public.mood_searches'::regclass and conname in ('mood_searches_status_check','mood_searches_claim_attempts_check');  -- 2 satır
select indexname from pg_indexes where schemaname='public' and indexname='mood_searches_user_client_search_uq';  -- 1 satır

-- V1.3 fonksiyonlar: DEFINER, search_path='', EXECUTE yalnız service_role
select proname, prosecdef, proconfig,
       has_function_privilege('anon', oid, 'EXECUTE') as anon_x,
       has_function_privilege('authenticated', oid, 'EXECUTE') as auth_x,
       has_function_privilege('service_role', oid, 'EXECUTE') as svc_x
  from pg_proc where pronamespace='public'::regnamespace
   and proname in ('claim_mood_search','finish_mood_search','mood_quota_snapshot') order by 1;
-- beklenen: 3 satır; prosecdef=true; proconfig={search_path=""}; anon_x=false, auth_x=false, svc_x=true

-- V1.4 istemci yetkileri (K-1)
select grantee, privilege_type, string_agg(column_name, ',' order by column_name) as cols
  from information_schema.column_privileges
 where table_schema='public' and table_name='mood_searches'
   and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE')
 group by 1,2 order by 1,2;
-- beklenen: YALNIZ authenticated|INSERT|user_id  ve  authenticated|UPDATE|error_code,recommended_film_ids,rpc_version  (anon satırı YOK)

-- V1.5 eski veri değişmedi
select count(*) as n, md5(string_agg(concat_ws('|', id, user_id, search_date, searches_used, created_at, searched_at, mood_text, parsed_profile, rpc_version, error_code, recommended_film_ids), E'\n' order by id)) as legacy_md5
  from public.mood_searches where created_at <= '2026-10-25 03:56:25.671135+00';
-- beklenen: n=121, legacy_md5=dee4b541c8401acc4553fa4a56f72935
```
**Hızlı canlı istemci testi (parse-mood HENÜZ eski):** 2.1.3 cihazından bir mood araması yap → çalışmalı (recordMoodSearch INSERT `{user_id}` ve sonuç UPDATE'i `recommended_film_ids/rpc_version` yeni yetkilerle geçmeli). Sentry'de `QUOTA_SEARCH_RECORD_FAILED` / `mood_searches UPDATE failed` çıkmamalı (bkz. geri alma tablosu R1).

## Adım 2 — 140 (mood_searches DELETE/TRUNCATE/REFERENCES/TRIGGER)

```powershell
Move-Item supabase\migrations\141_*.sql, supabase\migrations\142_*.sql $env:TEMP\mig-hold\
supabase db push --dry-run          # YALNIZ 140
supabase db push
Move-Item $env:TEMP\mig-hold\141_*.sql, $env:TEMP\mig-hold\142_*.sql supabase\migrations\
git status --short                  # BOŞ
```
**Doğrulama:**
```sql
select max(version) from supabase_migrations.schema_migrations;   -- 140
select r, p, has_table_privilege(r,'public.mood_searches',p) as has
  from (values ('anon'),('authenticated')) a(r), (values ('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) b(p);   -- hepsi false
select has_table_privilege('service_role','public.mood_searches','DELETE') as svc_delete;   -- true (delete-account)
```

## Adım 3 — parse-mood deploy

```powershell
supabase functions deploy parse-mood        # verify_jwt=false supabase/config.toml'dan gelir
supabase functions list                      # parse-mood VERSION 43, UPDATED_AT şimdi
```
**Doğrulama:**
- 0.7'deki gibi geçici proje dizininde `supabase functions download parse-mood --use-api` → depodaki `supabase/functions/parse-mood` ve `_shared/moodClaim.ts` ile fark yok.
- Kimliksiz çağrı canlı mı: `Invoke-WebRequest -Method Post https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/parse-mood -Body '{}' -ContentType 'application/json'` → **401** (fonksiyon ayakta ve auth istiyor; 5xx/boot hatası olmamalı).

**Smoke test A — eski istemci yolu (2.1.3 cihazı, `client_search_id` GÖNDERMEZ):**
Önce tester'ın bugünkü sayacını kaydet:
```sql
select searches_used, bonus_searches_used from public.user_daily_quotas
 where user_id = '<users.id>' and date = current_date;   -- öncesi: ____
```
Cihazdan bir arama yap, sonra:
```sql
-- A.1 yeni satır, ESKİ AKIŞ imzası
select id, created_at, client_search_id, status, quota_consumed, claim_attempts,
       recommended_film_ids is not null and cardinality(recommended_film_ids) > 0 as has_ids, rpc_version, error_code
  from public.mood_searches where user_id = '<users.id>' order by created_at desc limit 3;
-- beklenen (en yeni satır): client_search_id NULL, status NULL, quota_consumed false, claim_attempts 0, has_ids true
--   (eski akışta kota check_and_consume_quota ile düşer; yeni kolonlar BOŞ kalır — "eski istemci davranışı değişmedi" kanıtı)
-- A.2 kota tam 1 arttı
select searches_used from public.user_daily_quotas where user_id = '<users.id>' and date = current_date;   -- öncesi + 1
```
**Eski istemci invaryantı (genel, parse-mood sonrası ilk saat):** `client_search_id` göndermeyen çağrıların satırları yeni kolonları doldurmaz:
```sql
select count(*) filter (where client_search_id is null and status is not null) as legacy_with_status,   -- beklenen 0
       count(*) filter (where client_search_id is null and quota_consumed) as legacy_consumed_flag,     -- beklenen 0
       count(*) filter (where client_search_id is not null) as claim_path_rows                          -- bu adımda ~0 (istemci henüz yok)
  from public.mood_searches where created_at > '<deploy zamanı UTC>';
```

**Sentry / edge log (ilk 30 dk, sonra 2 sa):**
- Sentry (org `chosy`, ortam production), son 1 sa: `function:parse-mood` etiketli hatalar; özellikle **`MOOD_FINISH_FAILED`, `QUOTA_CLAIM_FAILED`, `QUOTA_REFUND_FAILED`, `PARSE_FAILED`**; ayrıca 2.1.x istemcilerinde `QUOTA_SEARCH_RECORD_FAILED` ve "`mood_searches UPDATE failed`" (izin hatası 42501 = R1).
- Edge log: Dashboard → Edge Functions → parse-mood → Logs (5xx oranı, `BOOT_ERROR`, süre). Beklenen: deploy öncesiyle aynı hata oranı.

**26 Eki sonu — 27 Eki kapısı (24 sa):** 26 Eki Adım 3'ten itibaren 24 saat boyunca R1–R7 tetikleyicilerinden hiçbiri çalışmamış, Sentry'de `parse-mood` / `42501` / `QUOTA_*` yeni hata yok, eski istemci invaryantı sorgusu (yukarıda) hâlâ 0/0 ise kapı "temiz"dir. Kapı temiz değilse Bölüm B yapılmaz; 141/142 ertelenir.

---

## Adım 4 — smoke test B (claim yolu) — **BUILD SONRASI** (29–30 Eki preview build + cihaz testi; 26 Eki'de YAPILMAZ)

Bu runbook'un 26/27 Eki kapsamı dışında kalan adım; kayıt amaçlı. 2.1.3 build'inde `client_search_id` yoktur (claim-first istemci içinde değil), bu yüzden claim imzası (`status=completed`, `quota_consumed=true`) ancak yeni build ile görülür. Build, `2e4314b` ve sonrasını içeren commit'ten alınır. Bayrak yalnız `mood_offer_testers`.
**Smoke test B — yeni istemci (tester):** bir arama yap → 
```sql
select client_search_id is not null as has_id, status, quota_consumed, claim_attempts,
       cardinality(recommended_film_ids) as n_ids, error_code
  from public.mood_searches where user_id = '<users.id>' order by created_at desc limit 1;
-- beklenen: has_id true, status 'completed', quota_consumed true, claim_attempts 0, n_ids > 0 (istemci UPDATE'i yeni kolon yetkisiyle geçti), error_code NULL
```
Aynı aramayı ağı keserek tekrar dene → ikinci satır OLUŞMAZ, `searches_used` artmaz (idempotency).

## Geri alma tetikleyicileri — BÖLÜM A (26 Eki: R1–R7)

Rollback dosyaları repo dışı: `C:\Users\mertk\moodflix-rollback\`. Veritabanı geri alması da `supabase db push` ile **yeni numaralı migration** olarak uygulanır (numara: `supabase migration list` Local+Remote'un en yükseğinden +1; 142 dosyası depoda olduğu için ilk boş numara **143**, örn. `143_rollback_139.sql`; dosyadaki `BEGIN/COMMIT` satırları çıkarılır). Önce fonksiyon, sonra şema geri alınır (139'u geri almadan önce parse-mood eski sürüme dönmeli).

R1–R7 aşağıdadır; R8 ve R9 Bölüm B'dedir.

### Veri bozulursa: mantıksal export'tan geri yükleme (yedek yok — Supabase Free)

Export klasörü: `C:\Users\mertk\moodflix-rollback\backup-2026-10-26\` (`<tablo>.jsonl`, satır başına bir `to_jsonb(satır)`; `schema-2026-10-26.sql.txt` yalnız karşılaştırma/yeniden kurma referansı, doğrudan çalıştırılmaz). **Önce şemayı geri al** (ilgili `*_rollback.sql`), çünkü JSONL kolonları export anındaki şemaya aittir; 139 sonrası eklenen kolonlar eski şemada yoktur. Geri yükleme **önce bozulan satırların hangileri olduğunu** karşılaştırarak yapılır (tüm tabloyu körlemesine ezme):
Geri yükleme SQL'i `scripts\backup\restore-rows.ps1` ile ÜRETİLİR (çalıştırmaz); SQL dosyası gözle kontrol edilip `supabase db query --linked -f` ile çalıştırılır. `db query --linked` Management API üzerinden postgres olarak çalışır; service_role anahtarı GEREKMEZ, kullanılmaz, yazılmaz.
```powershell
# tek anahtar:
powershell -NoProfile -File scripts\backup\restore-rows.ps1 -BackupDir C:\Users\mertk\moodflix-rollback\backup-2026-10-26 `
  -Table mood_searches -KeyColumns id -Keys '<uuid-1>','<uuid-2>' -OutFile $env:TEMP\restore_mood_searches.sql
# bileşik anahtar (user_daily_quotas: user_id + date):  -KeyColumns user_id,date -Keys '<uuid>|2026-10-25'
# anahtar kolonları: app_config=key, subscription_limits=tier, deletion_requests=auth_uid, diğerleri=id (user_daily_quotas=user_id,date)
Get-Content $env:TEMP\restore_mood_searches.sql -TotalCount 12      # gözle kontrol
supabase db query --linked -f $env:TEMP\restore_mood_searches.sql
```
- **Semantik UPSERT'tir (`INSERT … ON CONFLICT (anahtar) DO UPDATE`), DELETE+INSERT DEĞİL.** Neden: `users` silinirse `ON DELETE CASCADE` ile `subscriptions`, `mood_searches`, `watchlist`, `user_daily_quotas`, `lifetime_sales` satırları da silinir (test S5 kanıtladı). Bu yüzden `users` satırı asla silinerek geri yüklenmez.
- Betik tek işlemde çalışır; sonunda hedef anahtarların hepsinin tabloda olduğunu doğrular, değilse `RAISE` ile işlemi geri alır. Export'ta olmayan anahtar verilirse SQL üretmez.
- Geri yükleme kapsamı yalnız bozulan satırlar; export'tan sonra eklenen satırlara dokunmaz.
- **Restore testi (25 Eki 12:40, gömülü PostgreSQL 18.4, canlı şemayla birebir DEĞİL — aşağıdaki "kanıt" bölümüne bak):** 10/10 geçti.

**Kanıt (restore testi, `restore.mjs`, scratchpad; çalıştırıldı, canlıya dokunmadı):**

| Test | Senaryo | Sonuç |
|---|---|---|
| R0 | Şemayı kur (canlı kolon tipleri), 10 JSONL'yi yükle | satır sayısı + md5 MANIFEST ile aynı (10 tablo) |
| S1 | `mood_searches`'ten rastgele 3 satır sil + 2 satırın `recommended_film_ids` bozulur → `restore-rows.ps1` → çalıştır | 121 satır, 10 tablo md5 MANIFEST ile aynı |
| S2 | `users` satırı bozulur (`display_name`) + `user_daily_quotas` bileşik anahtar (`user_id\|date`) bozulur → geri yükle | 10 tablo md5 MANIFEST ile aynı |
| S3 | Export'ta olmayan anahtar | betik hata verir, SQL üretmez |
| S4 | Doğrulama bloğuna yanlış sayı | `RAISE` eder, işlem geri alınır, veri bozulmaz |
| S5 | `users` satırını silmek | `mood_searches` 2 → 0 (CASCADE) — DELETE+INSERT yöntemi bu yüzden yasak |

Testte bulunup düzeltilen hata: `powershell -File` ile `-Keys 'a','b'` dizi olarak değil virgüllü tek dize gelir; betik artık virgülden böler (ilk koşuda 5 anahtarın hepsi "export'ta yok" dedi).
Testin sınırları: md5 karşılaştırması dosya sırasıyla yeniden kurulmuş satır metni üzerinden yapılır (canlı sıralama collation'ı gömülü `--locale=C` ile farklı); `users.preferences_vector` gömülü PG'de `text` (pgvector yok, `to_jsonb` çıktısı aynı dizge); `films`/`sessions` FK'leri ve RLS/trigger yok; canlıya karşı çalıştırılmadı.
Kurallar:
- **FK sırası:** `users` → `subscriptions`, `user_daily_quotas`, `watchlist`, `mood_searches`, `deletion_requests`, `lifetime_sales` → `app_config`, `subscription_limits`, `promo_codes` (bağımsız). Silme ters sırada.
- Küçük sapma için yalnız etkilenen satırlar (anahtar listesiyle) geri yüklenir; tüm tablo yalnız tablo boşaldıysa (o durumda tüm anahtarlar `-Keys` ile verilir).
- **Bilinen sınır — `auth.users` export DIŞI:** Kimlik/oturum verisi (`auth.users`, `auth.identities`, parola/OAuth bağları, oturumlar) bu export'ta YOK. Hesap/kimlik felaketinde `public.users` satırları geri dönse bile kullanıcıların **girişleri dönmez** (`users.auth_id` ile eşleşen auth kaydı yoksa satır yetim kalır). Auth tarafı için Free planda kurtarma yolu yoktur; bu risk Pro geçişinin (yedek/PITR) gerekçelerinden biridir.
- `lifetime_sales` ve sequence: `lifetime_sale_number` export'ta `last_value` olarak kayıtlı (`schema-*.sql.txt` "sequence durumu"); satış verisi geri yüklenirse `setval` ile sayaç manuel hizalanır — **DUR ve sor** (sayaç ve fiyat/limit kararı kurucuya aittir).
- Geri yükleme sonrası MANIFEST'teki satır sayıları ve (değişmemiş tablolar için) md5'ler yeniden alınan export ile karşılaştırılır.
- Gizli veri: bu klasör kişisel veri içerir; repo dışında kalır, paylaşılmaz, işi bitince saklama süresine karar verilir (öneri: 30 gün, sonra güvenli sil).

| # | Belirti | Tetik eşiği | Geri alma |
|---|---|---|---|
| R1 | Eski (2.1.x) istemciler `mood_searches` yazamıyor: Sentry `QUOTA_SEARCH_RECORD_FAILED` / "`mood_searches UPDATE failed`" `42501` | ≥ 3 olay / 10 dk ya da tester aramasının sonuç satırı yazılmaması | **Dar geri alma:** `GRANT INSERT, UPDATE ON public.mood_searches TO anon, authenticated;` (139_rollback.sql'in yetki kısmı). Fonksiyonlar/kolonlar kalır |
| R2 | parse-mood 5xx / `BOOT_ERROR` / eski istemci aramaları başarısız | 5xx oranı deploy öncesinin >2 katı, ya da smoke test A başarısız | parse-mood'u eski kaynağa döndür: `git worktree add $env:TEMP\pm-prev 71d32e0; supabase functions deploy parse-mood --workdir $env:TEMP\pm-prev` → `functions list` VERSION 44 ve içerik 71d32e0 ile eşit. Şema (139) kalabilir (eski kod yeni kolonları kullanmaz) |
| R3 | Kota yanlış: eski istemci aramasında `searches_used` +1 değil (0 ya da +2) | tek örnek bile | R2 + 139 incelemesi; veri düzeltmesi gerekirse DUR ve sor |
| R4 | `MOOD_FINISH_FAILED` / `QUOTA_REFUND_FAILED` ≥ 1, ya da `takili_pending` (pending ve 5 dk'dan eski satır) sürekli > 0 | ilk saat | Yeni istemci henüz yoksa etkisi yok: R2'yi uygula, nedeni incele |
| R5 | `claim_mood_search` çağrılabilir (anon/auth `EXECUTE`) görünüyor ya da V1.3 sonuçları beklenenden farklı | herhangi biri | DUR; `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` (migration olarak) — güvenlik kaçağı olarak ele al |
| R6 | 139 doğrulamalarından biri (V1.1–V1.5) kırmızı | herhangi biri | Adım 2/3'e GEÇME. Tam geri alma: `139_rollback.sql` (kolonlar düşer; 139 sonrası oluşan idempotency verisi kaybolur — henüz istemci yok, kayıp ≈ 0) |
| R7 | 140 sonrası `delete-account` ya da başka service_role akışı `mood_searches` silemiyor | herhangi biri | `140_rollback.sql` (4 yetkiyi geri verir; veri etkisi yok) |

### Kayıt tablosu — Bölüm A (26 Eki, uygularken doldur)
| Adım | Zaman (UTC) | Sonuç | Doğrulama | Notlar |
|---|---|---|---|---|
| 0 ön kontroller | | | | export MANIFEST md5'leri (25 Eki 09:09 UTC denemesi: mood_searches `dfb14062…`, users `b2aa7762…`; apply günü export YENİDEN alınır), SHA |
| 1 — 139 | 2026-10-25 ~10:00 UTC (TR ~13:00) | UYGULANDI (`supabase db push`, dry-run yalnız 139) | V1.1–V1.5 yeşil; legacy_md5 `dee4b541…` ve 121 satır aynı; yeni kolonlar eski satırlarda boş (0/121); simülasyon (insert user_id, update 3 kolon, status/client_search_id 42501) 4/4; Sentry son 24 sa: ilgili hata yok | rollback `139_rollback.sql` hazır; 140/141/142 uygulanmadı |
| 2 — 140 | | | | |
| 3 — parse-mood v43 | | | smoke A, Sentry | |
| 24 sa kapısı | | temiz / değil | R1–R7 + invaryant sorgusu | Bölüm B'ye geçiş kararı |

---

# BÖLÜM B — 27 EKİ (141 + 142) — YALNIZ "26 Eki doğrulaması temiz" ise

**Ön koşul (hepsi):**
1. 26 Eki doğrulaması temiz: Bölüm A kayıt tablosunda "24 sa kapısı = temiz"; R1–R7 tetiklenmedi; Sentry'de 26 Eki 12:00'den beri `42501` / RLS / `permission denied` / `QUOTA_*` yeni hata yok.
2. Aynı pencere: TR 12:00–14:00. Bölüm A'dan en az 24 sa geçmiş.
3. Dal/temizlik (0.2) tekrar: `feat/money-1c`, `git status --short` BOŞ. **Taze mantıksal export** (0.1, `-OutDir ...\backup-2026-10-27`) alınmış ve MANIFEST `TUM TABLOLAR TAMAM`; yoksa apply YOK.
4. `supabase migration list` → Remote en yüksek **140**, Local 141 ve 142 bekliyor. Başka sürüm varsa DUR.
5. Canlı dry-run'lar yeşil (bugün tekrar): `supabase db query --linked -f supabase\tests\141_dryrun.sql` (5/5) ve `...\142_dryrun.sql` (5/5), `zz_summary | ALL PASS`.
6. 142 ön durumu `C:\Users\mertk\moodflix-rollback\142_pre_state.txt` ile aynı (aşağıdaki P1 sorgusu): `increment_promo_usage` ACL'sinde `anon`/`authenticated` var (daraltılacak), `claim_lifetime_spot` `proconfig` boş (`search_path` yok), `lifetime_sale_number` last_value 4, `lifetime_sales` 0 satır. **Farklıysa DUR** (biri arada satış yapmış / ACL değişmiş olabilir; yeniden değerlendir).
7. Rollback dosyaları var: `141_rollback.sql`, `142_rollback.sql`, `141_pre_state.txt`, `142_pre_state.txt`.

**P1 — 142 ön durum sorgusu (salt-okunur):**
```sql
select p.proname, p.prosecdef, p.proacl::text as acl, p.proconfig::text as cfg, md5(p.prosrc) as src_md5, pg_get_userbyid(p.proowner) as owner
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('increment_promo_usage','claim_lifetime_spot') order by 1;
select (select last_value from public.lifetime_sale_number) as seq_last, (select count(*) from public.lifetime_sales) as sales;
```

## Adım 5 — 141 (tüm tablolarda TRUNCATE/REFERENCES/TRIGGER + 4 tabloda yazma)

`app_config` okuma (uygulama açılışında `remoteConfig`) etkilenmemeli.
```powershell
New-Item -ItemType Directory -Force $env:TEMP\mig-hold | Out-Null
Move-Item supabase\migrations\142_*.sql $env:TEMP\mig-hold\
supabase db push --dry-run          # YALNIZ 141 listelenmeli; başka dosya varsa DUR
supabase db push                    # onay: y
Move-Item $env:TEMP\mig-hold\142_*.sql supabase\migrations\
git status --short                  # BOŞ
```
**Doğrulama (141):**
```sql
select max(version) from supabase_migrations.schema_migrations;   -- 141
-- bütün public tablolarda anon/authenticated için TRUNCATE/REFERENCES/TRIGGER = 0
select count(*) from pg_class c, (values ('anon'),('authenticated')) a(r), (values ('TRUNCATE'),('REFERENCES'),('TRIGGER')) b(p)
 where c.relnamespace='public'::regnamespace and c.relkind in ('r','p') and has_table_privilege(r, c.oid, p);   -- 0
-- 4 tabloda yazma yok
select c.relname, r, p from pg_class c, (values ('anon'),('authenticated')) a(r), (values ('INSERT'),('UPDATE'),('DELETE')) b(p)
 where c.relnamespace='public'::regnamespace and c.relname in ('app_config','subscription_limits','promo_codes','lifetime_sales') and has_table_privilege(r, c.oid, p);   -- 0 satır
```
Smoke: uygulamayı soğuk aç (remoteConfig `app_config` SELECT), bir satın alma ekranı aç (limits/promo okuma), bir arama (eski akış, A imzası).

## Adım 6 — 142 (`increment_promo_usage` EXECUTE daraltma + `claim_lifetime_spot` `search_path=''`)

141 doğrulaması yeşil olmadan başlama. Önkoşul taraması (25 Eki): `increment_promo_usage` için istemci/edge çağrısı YOK; `claim_lifetime_spot` yalnız service_role istemcili `process-lifetime-purchase`, `revenuecat-webhook` ve DB fonksiyonu `activate_referral` (DEFINER, owner postgres) tarafından çağrılıyor — authenticated JWT'li çağıran yok.
```powershell
supabase db push --dry-run          # YALNIZ 142 listelenmeli
supabase db push
git status --short                  # BOŞ
```
**Doğrulama (142):**
```sql
select max(version) from supabase_migrations.schema_migrations;   -- 142
-- V6.1 ACL: PUBLIC/anon/authenticated EXECUTE yok, service_role var — iki fonksiyonda da
select p.proname,
       exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type='EXECUTE') as public_x,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_x,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_x,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as svc_x
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('increment_promo_usage','claim_lifetime_spot') order by 1;
-- beklenen: ikisinde de public_x=false, anon_x=false, auth_x=false, svc_x=true
-- V6.2 claim_lifetime_spot: DEFINER + search_path=""
select proname, prosecdef, proconfig, pg_get_userbyid(proowner) as owner from pg_proc
 where pronamespace='public'::regnamespace and proname='claim_lifetime_spot';   -- prosecdef=true, proconfig={search_path=""}, owner=postgres
-- V6.3 gerçek veri ve sayaç dokunulmadı
select (select last_value from public.lifetime_sale_number) as seq_last, (select count(*) from public.lifetime_sales) as sales;   -- P1 ile aynı (4, 0)
```
Smoke 142: canlı satış akışı (`process-lifetime-purchase` / `revenuecat-webhook` → `claim_lifetime_spot`) bu pencerede gerçek satın alma gerektirir; **gerçek satış tetiklenmez**. Bunun yerine: Sentry'de `process-lifetime-purchase` / `revenuecat-webhook` edge hatalarını izle (bir sonraki gerçek satın almada `permission denied for function` veya `relation ... does not exist` çıkmamalı) ve dry-run T4'ün (tam yol, geçici sequence) canlıda 5/5 geçtiğini referans al.

**Sentry / edge log (ilk 30 dk, sonra 2 sa):** `permission denied for function`, `increment_promo_usage`, `claim_lifetime_spot`, `process-lifetime-purchase`, `revenuecat-webhook`; 42501 sayısı 141 öncesine göre artmamalı.

## Geri alma tetikleyicileri — BÖLÜM B (27 Eki: R8–R9)

Numara kuralı Bölüm A ile aynı: DB geri alması yeni numaralı migration olarak (ilk boş numara **143**; `BEGIN/COMMIT` satırlarını çıkar).

| # | Belirti | Tetik eşiği | Geri alma |
|---|---|---|---|
| R8 | 141 sonrası uygulama açılışında `app_config` okunamıyor / satın alma ekranı limitleri okuyamıyor / Sentry `permission denied for table` | herhangi biri | `141_rollback.sql` (yalnız 141 öncesi durumu birebir kurar; ön durum `141_pre_state.txt`). 142 de uygulandıysa 142'yi ayrıca geri alma gerekmez |
| R9 | 142 sonrası V6.1–V6.3'ten biri kırmızı; ya da `process-lifetime-purchase` / `revenuecat-webhook` / `activate_referral` `permission denied for function` ya da `claim_lifetime_spot` hata veriyor; ya da bir kod yolunun `increment_promo_usage`'ı authenticated/anon ile çağırdığı ortaya çıkıyor | herhangi biri | `142_rollback.sql` (EXECUTE'u eski haline getirir ve eski gövdeyi `search_path`'siz geri koyar; ön durum `142_pre_state.txt`). Satış/sayaç verisi etkilenmez. Geri almadan sonra nedeni bulunana kadar 142'yi yeniden uygulama |

### Kayıt tablosu — Bölüm B (27 Eki, uygularken doldur)
| Adım | Zaman (UTC) | Sonuç | Doğrulama | Notlar |
|---|---|---|---|---|
| B0 ön koşullar | | | P1, dry-run 141/142 | 26 Eki kapısı temiz mi: ____ |
| 5 — 141 | | | 141 doğrulaması, smoke | |
| 6 — 142 | | | V6.1–V6.3, Sentry | |

> **Not (eski istemci):** `client_search_id` göndermeyen çağrılar `claim_mood_search`'e HİÇ girmez; `check_and_consume_quota` + `logMoodSearch` ile mevcut davranışla çalışır. Tek davranış farkı Anthropic isteğinin `timeout 25 sn, maxRetries 0` olmasıdır (bu eski yolu da etkiler; onaylı karar).
