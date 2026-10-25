# MONEY-1C — 26 Ekim sabahı uygulama runbook'u (HAZIRLANDI — HİÇBİR ADIM ÇALIŞTIRILMADI)

Durum: yazıldı 25 Eki 2026. **Her adım ayrı onay ister; sonraki adıma geçmeden önce doğrulama sorguları yeşil olmalı.**
Proje: `chosy ai` (`xpcwihldlnlmyopjubdc`). Diğer proje (`shit`) ile ilgisi yok. Komutlar PowerShell; sorgular `supabase db query --linked` ya da Dashboard SQL editor (SADECE salt-okunur doğrulama — migration'lar yalnız `supabase db push`, CLAUDE.md kural 3).

Kapsam: **139** (idempotency + istemci INSERT/UPDATE daraltma) → **140** (mood_searches 4 yetki) → **parse-mood deploy** → (sonra, AYRI) istemci build → (sonra, AYRI) **141**.
Beklenen ürün etkisi: yeni istemci yok iken kullanıcıya görünür değişiklik YOK (eski istemciler `client_search_id` göndermez → eski akış).

---

## 0. Ön kontroller (hepsi tamam olmadan Adım 1'e geçme)

| # | Kontrol | Nasıl | Beklenen |
|---|---|---|---|
| 0.1 | Yedek tarihi | Dashboard → Database → Backups | Son yedek < 24 sa. (CLI tarihi göstermiyor: `WALG=true`, `PITR=false`). Tarihi not et: `____` |
| 0.2 | Dal ve temizlik | `git switch feat/money-1c; git status --short; git rev-parse HEAD` | dal `feat/money-1c`, çıktı BOŞ. **Kirli/yanlış dal → DUR.** SHA'yı kaydet: `____` (bu belgeyi içeren commit: `git log -1 -- docs/investigations/MONEY-1C_DEPLOY_RUNBOOK.md`) |
| 0.3 | Migration durumu | `supabase migration list` | Local 139, 140, 141 — Remote en yüksek **138**. Remote'ta 138'den büyük bir sürüm varsa DUR (CLAUDE.md "migration numaralandırma") |
| 0.4 | Ön durum kaydı | aşağıdaki sorgu P0 | `rows=121`, `md5=923ac0b9cc5ffabc4fa62e1f5056e657`, `legacy_md5=dee4b541c8401acc4553fa4a56f72935` (created_at ≤ 2026-10-25 03:56:25.671135+00), `acl_md5=7547c9658ede91689da90ed8bc374d4f`, son migration `138`. **Yeni satır girmişse** (rows>121) yalnız `legacy_md5` (≤ sınır) ve `acl_md5` karşılaştırılır; `md5` (tüm satır) 139'dan sonra kolon eklendiği için ZATEN değişir |
| 0.5 | Dosya kayıtları | `Test-Path C:\Users\mertk\moodflix-rollback\139_rollback.sql, ...\140_rollback.sql, ...\141_rollback.sql, ...\139_pre_state_snapshot.txt, ...\141_pre_state.txt` | hepsi `True` |
| 0.6 | parse-mood canlı sürüm | `supabase functions list` | `parse-mood` VERSION **42**, UPDATED 2026-10-24 19:30 UTC |
| 0.7 | Canlı = depodaki önceki kaynak | boş bir geçici proje dizininde (`mkdir $env:TEMP\pm42; cd $env:TEMP\pm42; supabase init; supabase link --project-ref xpcwihldlnlmyopjubdc; supabase functions download parse-mood --use-api`) indir; `git worktree add $env:TEMP\pm-prev 71d32e0` ile aynı commit'in `supabase/functions/parse-mood` + `_shared` dizinleriyle `git diff --no-index` karşılaştır. (Çalışma kopyasını bozmamak için ana depoda indirme YAPMA.) | fark yok. Fark varsa DUR (geri alma hedefi belirsiz — `project_deploy_durumu_bibledan_okunmaz`) |
| 0.8 | Testler | `npm run typecheck` (baseline 14), `npm run test:mood-offer` (94), `npm run test:mood-claim` (9) | yeşil |
| 0.9 | Dry-run'lar canlıda yeşil | `supabase db query --linked -f supabase\tests\139_dryrun.sql` ve `...\140_dryrun.sql` (BEGIN…RAISE, kalıcı değişiklik yok) | `zz_summary \| ALL PASS` (139: 15/15, 140: 4/4) |

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
Move-Item supabase\migrations\140_*.sql, supabase\migrations\141_*.sql $env:TEMP\mig-hold\
supabase db push --dry-run          # YALNIZ 139 listelenmeli; başka dosya varsa DUR
supabase db push                    # onay: y
Move-Item $env:TEMP\mig-hold\140_*.sql, $env:TEMP\mig-hold\141_*.sql supabase\migrations\
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
Move-Item supabase\migrations\141_*.sql $env:TEMP\mig-hold\
supabase db push --dry-run          # YALNIZ 140
supabase db push
Move-Item $env:TEMP\mig-hold\141_*.sql supabase\migrations\
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

## Adım 4 — (AYRI GÜN/ONAY) istemci build + bayrak + smoke test B (claim yolu)

Bu runbook'un kapsamı dışında kalan adım; kayıt amaçlı. Build, `2e4314b` ve sonrasını içeren commit'ten alınır. Bayrak yalnız `mood_offer_testers`.
**Smoke test B — yeni istemci (tester):** bir arama yap → 
```sql
select client_search_id is not null as has_id, status, quota_consumed, claim_attempts,
       cardinality(recommended_film_ids) as n_ids, error_code
  from public.mood_searches where user_id = '<users.id>' order by created_at desc limit 1;
-- beklenen: has_id true, status 'completed', quota_consumed true, claim_attempts 0, n_ids > 0 (istemci UPDATE'i yeni kolon yetkisiyle geçti), error_code NULL
```
Aynı aramayı ağı keserek tekrar dene → ikinci satır OLUŞMAZ, `searches_used` artmaz (idempotency).

## Adım 5 — (AYRI, EN SON) 141 (tüm tablolarda TRUNCATE/REFERENCES/TRIGGER + 4 tabloda yazma)

Ön koşul: Adım 1–3 en az 24 sa sorunsuz; Sentry'de yeni 42501 / RLS hatası yok. `app_config` okuma (uygulama açılışında `remoteConfig`) etkilenmemeli.
```powershell
supabase db push --dry-run          # YALNIZ 141
supabase db push
```
```sql
select max(version) from supabase_migrations.schema_migrations;   -- 141
-- bütün public tablolarda anon/authenticated için TRUNCATE/REFERENCES/TRIGGER = 0
select count(*) from pg_class c, (values ('anon'),('authenticated')) a(r), (values ('TRUNCATE'),('REFERENCES'),('TRIGGER')) b(p)
 where c.relnamespace='public'::regnamespace and c.relkind in ('r','p') and has_table_privilege(r, c.oid, p);   -- 0
-- 4 tabloda yazma yok
select c.relname, r, p from pg_class c, (values ('anon'),('authenticated')) a(r), (values ('INSERT'),('UPDATE'),('DELETE')) b(p)
 where c.relnamespace='public'::regnamespace and c.relname in ('app_config','subscription_limits','promo_codes','lifetime_sales') and has_table_privilege(r, c.oid, p);   -- 0 satır
```
Smoke: uygulamayı soğuk aç (remoteConfig `app_config` SELECT), bir satın alma ekranı aç (limits/promo okuma), bir arama.

---

## Geri alma tetikleyicileri

Rollback dosyaları repo dışı: `C:\Users\mertk\moodflix-rollback\`. Veritabanı geri alması da `supabase db push` ile **yeni numaralı migration** olarak uygulanır (örn. `142_rollback_139.sql`; dosyadaki `BEGIN/COMMIT` satırları çıkarılır). Önce fonksiyon, sonra şema geri alınır (139'u geri almadan önce parse-mood eski sürüme dönmeli).

| # | Belirti | Tetik eşiği | Geri alma |
|---|---|---|---|
| R1 | Eski (2.1.x) istemciler `mood_searches` yazamıyor: Sentry `QUOTA_SEARCH_RECORD_FAILED` / "`mood_searches UPDATE failed`" `42501` | ≥ 3 olay / 10 dk ya da tester aramasının sonuç satırı yazılmaması | **Dar geri alma:** `GRANT INSERT, UPDATE ON public.mood_searches TO anon, authenticated;` (139_rollback.sql'in yetki kısmı). Fonksiyonlar/kolonlar kalır |
| R2 | parse-mood 5xx / `BOOT_ERROR` / eski istemci aramaları başarısız | 5xx oranı deploy öncesinin >2 katı, ya da smoke test A başarısız | parse-mood'u eski kaynağa döndür: `git worktree add $env:TEMP\pm-prev 71d32e0; supabase functions deploy parse-mood --workdir $env:TEMP\pm-prev` → `functions list` VERSION 44 ve içerik 71d32e0 ile eşit. Şema (139) kalabilir (eski kod yeni kolonları kullanmaz) |
| R3 | Kota yanlış: eski istemci aramasında `searches_used` +1 değil (0 ya da +2) | tek örnek bile | R2 + 139 incelemesi; veri düzeltmesi gerekirse DUR ve sor |
| R4 | `MOOD_FINISH_FAILED` / `QUOTA_REFUND_FAILED` ≥ 1, ya da `takili_pending` (pending ve 5 dk'dan eski satır) sürekli > 0 | ilk saat | Yeni istemci henüz yoksa etkisi yok: R2'yi uygula, nedeni incele |
| R5 | `claim_mood_search` çağrılabilir (anon/auth `EXECUTE`) görünüyor ya da V1.3 sonuçları beklenenden farklı | herhangi biri | DUR; `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` (migration olarak) — güvenlik kaçağı olarak ele al |
| R6 | 139 doğrulamalarından biri (V1.1–V1.5) kırmızı | herhangi biri | Adım 2/3'e GEÇME. Tam geri alma: `139_rollback.sql` (kolonlar düşer; 139 sonrası oluşan idempotency verisi kaybolur — henüz istemci yok, kayıp ≈ 0) |
| R7 | 140 sonrası `delete-account` ya da başka service_role akışı `mood_searches` silemiyor | herhangi biri | `140_rollback.sql` (4 yetkiyi geri verir; veri etkisi yok) |
| R8 | 141 sonrası uygulama açılışında `app_config` okunamıyor / satın alma ekranı limitleri okuyamıyor / Sentry `permission denied for table` | herhangi biri | `141_rollback.sql` (yalnız 141 öncesi durumu birebir kurar; ön durum `141_pre_state.txt`) |

## Kayıt tablosu (uygularken doldur)
| Adım | Zaman (UTC) | Sonuç | Doğrulama | Notlar |
|---|---|---|---|---|
| 0 ön kontroller | | | | yedek tarihi, SHA |
| 1 — 139 | | | V1.1–V1.5 | |
| 2 — 140 | | | | |
| 3 — parse-mood v43 | | | smoke A, Sentry | |
| 5 — 141 | | | | |

> **Not (eski istemci):** `client_search_id` göndermeyen çağrılar `claim_mood_search`'e HİÇ girmez; `check_and_consume_quota` + `logMoodSearch` ile mevcut davranışla çalışır. Tek davranış farkı Anthropic isteğinin `timeout 25 sn, maxRetries 0` olmasıdır (bu eski yolu da etkiler; onaylı karar).
