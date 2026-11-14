# 145 — Güvenlik P0: yayın sırası ve doğrulama

Bu belge Adım 2 (yayın) içindir. Her madde: **ne yayınlanır → doğrulama → uygulamanın bozulmadığının kanıtı → geri alma**.
Yayın sırası: önce migration, sonra fonksiyonlar. Her adımdan sonra durulur.

Proje: `xpcwihldlnlmyopjubdc`. Aşağıdaki SQL'lerin hepsi **salt okunur**dur (`BEGIN … ROLLBACK` içinde rol değiştirir).
HTTP denemelerinde `$URL` = proje URL'si, `$ANON` = anon key (uygulamada gömülü olan).

## 0. Yayından önce — kuru koşu

`supabase/tests/145_dryrun.sql` canlıya karşı çalıştırılır. Tek işlemdir, sonunda bilerek istisna fırlatır; kalıcı
değişiklik bırakmaz. Beklenen: `DRYRUN_RESULTS (18/18 PASS)` (sessions boşsa T8 `SKIP`, 17/18).
PASS olmayan satır varsa **migration yayınlanmaz**.

## 1. Migration 145 — `supabase db push`

**Doğrulama**

```sql
-- 1.1 anon: dört görünüm de 42501 (permission denied) vermeli
begin; set local role anon; select count(*) from public.mood_history; rollback;
begin; set local role anon; select count(*) from public.user_stats; rollback;
begin; set local role anon; select count(*) from public.v_posterle_daily_stats; rollback;
begin; set local role anon; select count(*) from public.public_daily_puzzles; rollback;

-- 1.2 authenticated: user_stats / v_posterle 42501; mood_history JWT'siz 0 satır
begin; set local role authenticated; select count(*) from public.user_stats; rollback;            -- 42501
begin; set local role authenticated; select count(*) from public.mood_history; rollback;          -- 0

-- 1.3 public_daily_puzzles: istemciye üç kolon; puzzle_data kapalı
begin; set local role authenticated;
  select id, game_id from public.public_daily_puzzles where puzzle_date = current_date; rollback;  -- çalışır
begin; set local role authenticated; select puzzle_data from public.public_daily_puzzles limit 1; rollback;  -- 42501

-- 1.4 get-daily-challenge yolu: service_role `select *` çalışır, bugünün spotlight satırı okunur
begin; set local role service_role;
  select game_id, puzzle_date, (puzzle_data is not null) as has_data
    from public.public_daily_puzzles where game_id = 'spotlight' and puzzle_date = current_date; rollback;

-- 1.5 yetki ve seçenek tablosu
select c.relname, c.reloptions, c.relacl
  from pg_class c where c.relnamespace = 'public'::regnamespace
   and c.relname in ('mood_history','user_stats','v_posterle_daily_stats','public_daily_puzzles');
select has_function_privilege('anon', 'public.grant_streak_rewards(uuid,integer)', 'execute') as anon_x,
       has_function_privilege('authenticated', 'public.grant_streak_rewards(uuid,integer)', 'execute') as auth_x,
       has_function_privilege('service_role', 'public.grant_streak_rewards(uuid,integer)', 'execute') as svc_x;  -- f, f, t
select proname, proconfig from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('activate_referral','grant_bonus_searches');
```

HTTP (anon key ile, uygulama dışından):

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/mood_history?select=*&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"   # 401/403
curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/user_stats?select=*&limit=1"   -H "apikey: $ANON" -H "Authorization: Bearer $ANON"   # 401/403
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/rest/v1/rpc/grant_streak_rewards" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' -d '{"p_user_id":"00000000-0000-0000-0000-000000000000","p_streak_days":100}'                        # 401/403/404
```

**Uygulama bozulmadı kanıtı** (yayından sonraki ilk Spotlight oturumunda)

```sql
-- query_logs: get-daily-challenge 200 dönmeye devam ediyor; public_daily_puzzles'a Edge runtime isteği 200
select log_attributes['request.pathname'] as p, log_attributes['response.status_code'] as st, count(*) as n
  from logs where source = 'function_edge_logs'
   and log_attributes['request.pathname'] in ('/functions/v1/get-daily-challenge','/functions/v1/submit-guess')
 group by p, st;
select log_attributes['request.path'] as p, log_attributes['response.status_code'] as st, count(*) as n
  from logs where source = 'edge_logs'
   and match(log_attributes['request.path'], 'mood_history|user_stats|public_daily_puzzles|grant_streak_rewards')
 group by p, st;
```

Beklenen: `get-daily-challenge` 200; `public_daily_puzzles` 200 (Edge runtime). `mood_history`'ye Chosy istemcisinden istek
gelirse 200 olmalı (eski build'ler); 401/403 görülürse → geri alma "Kısmi A".

**Geri alma:** `docs/rollback/145_rollback.sql` (kısmi A/B blokları ya da tam).

## 2. parse-taste ve recommend — yayından kaldırma

```bash
supabase functions delete parse-taste --project-ref xpcwihldlnlmyopjubdc
supabase functions delete recommend   --project-ref xpcwihldlnlmyopjubdc
```

**Doğrulama:** `supabase functions list` çıktısında ikisi de yok;

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/functions/v1/parse-taste" -H 'Content-Type: application/json' -d '{"raw_input":"test test"}'   # 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/functions/v1/recommend" -H "Authorization: Bearer $ANON" -d '{}'                                 # 404
```

**Uygulama:** release/2.2'de ikisinin de çağıranı yok; son 7 günde 0 çağrı.
**Geri alma:** `supabase functions deploy parse-taste --no-verify-jwt` / `supabase functions deploy recommend` (kaynak repoda duruyor).
parse-taste geri alınırsa açık da geri gelir.

## 3. slot-mood-filtered, slot-pure-random, slot-triple

```bash
supabase functions deploy slot-mood-filtered slot-pure-random slot-triple --no-verify-jwt --project-ref xpcwihldlnlmyopjubdc
```

**Doğrulama** (kimliksiz + gövdede geçerli bir kullanıcı id'si → artık 401):

```bash
for f in slot-pure-random slot-triple slot-mood-filtered; do
  curl -s -w ' %{http_code}\n' -X POST "$URL/functions/v1/$f" -H 'Content-Type: application/json' \
    -d '{"user_id":"<gerçek bir users.id>","mood":"calm"}'
done   # üçü de: {"error":"Auth required","code":"NO_USER_CONTEXT"} 401
```

Rate limit (geçerli, ücretli tier'lı test kullanıcısı JWT'siyle 6 istek/dk → 6.'sı 429 `RATE_LIMIT_EXCEEDED`); bu deneme LLM
çağırır, yalnız test hesabıyla ve isteğe bağlı yapılır.

**Uygulama:** rulet `games_enabled.roulette = false` ile kapalı; son 7 günde 0 çağrı. Kanıt: yayın sonrası `function_edge_logs`'ta
Chosy istemcisinden slot-* 401'i yok.
**Geri alma:** önceki sürüme deploy (`git checkout a5c73e2 -- supabase/functions/slot-*` ayrı bir çalışma klasöründe → deploy).

## 4. process-referral

```bash
supabase functions deploy process-referral --no-verify-jwt --project-ref xpcwihldlnlmyopjubdc
```

**Doğrulama**

```bash
curl -s -w ' %{http_code}\n' -X POST "$URL/functions/v1/process-referral" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' -d '{"action":"check_activations"}'
# {"error":"Service role credentials required.","code":"SERVICE_ROLE_REQUIRED"} 401
curl -s -w ' %{http_code}\n' -X POST "$URL/functions/v1/process-referral" -H 'Content-Type: application/json' -d '{"action":"check_activations"}'   # 401
curl -s -w ' %{http_code}\n' -X POST "$URL/functions/v1/process-referral" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' -d '{"action":"apply","invite_code":"X"}'                                                                    # 401 UNAUTHORIZED
```

`supabase functions list`: `process-referral` → `verify_jwt: false`.
Service-role ile olumlu deneme (anahtar terminale yazılmadan, kurucu tarafından): `{"status":"NO_PENDING","activated":0}` 200.

**Uygulama:** çağıran yok (istemci `apply_invite_code` RPC'sini doğrudan çağırıyor; o yol değişmedi).
**Geri alma:** önceki sürüme deploy (`verify_jwt` varsayılanıyla). Açık da geri gelir.

## 5. explain-match

```bash
supabase functions deploy explain-match --no-verify-jwt --project-ref xpcwihldlnlmyopjubdc
```

**Doğrulama**

1. Test hesabıyla film detayını aç → açıklama gelir (200). `function_edge_logs`: `explain-match` 200.
2. Sayaçlar yazılıyor mu (salt okunur):

```sql
select function_name, left(user_id, 3) as bucket_prefix, count(*) as buckets, max(request_count) as max_count
  from public.api_rate_limits
 where function_name in ('explain-match','explain-match-ip','explain-match-daily','explain-match-ip-daily')
 group by 1, 2 order by 1;
-- beklenen: dördü de var; '-ip' adlı satırlarda bucket_prefix = 'ip:'
```

   (Kolon adları `api_rate_limits` şemasına göre Adım 2'de teyit edilir.)
3. IP başlığı geliyor mu: Sentry'de `CLIENT_IP_MISSING` uyarısı **olmamalı**. Olursa IP kovaları devrede değildir
   (kullanıcı tavanı yine çalışır) → başlık adı `_shared/explainLimit.ts → clientIp` içinde düzeltilir.
4. Tavan: test hesabında sayacı elle 50'ye getirmek yazma gerektirir; yapılmaz. Mantık birim testinde kanıtlı
   (`explainLimit.test.ts`: 50. geçer, 51. `EXPLAIN_DAILY_LIMIT`). Canlıda gözlem: `function_logs`'ta
   `explain_daily_limit_exceeded` satırı = tavanı aşan istek (`over` alanı).

**Uygulama:** 429'da istemci şablon açıklamaya düşer. **Yayındaki build (916/917) 429'u Sentry'ye exception olarak
yazmaya devam eder** — breadcrumb'a çeviren istemci değişikliği (`services/matchExplanation.ts`) bu daldadır ve ancak
bir sonraki OTA/build ile ulaşır. Günde 50'den fazla film detayı açan kullanıcı çıkana kadar gürültü beklenmez.
**Geri alma:** önceki sürüme deploy.

## Kapsam dışı bırakılanlar (bilinçli)

- `services/gamification.ts:156` (`grant_streak_rewards` çağrısı) ve `services/slotService.ts`'teki `body.user_id` — Bölüm 4 cleanup.
- `supabase/functions/parse-taste`, `supabase/functions/recommend` kaynakları — Bölüm 4 cleanup.
- Bölüm 1'in P1/P2 bulguları (schedule-notifications, recompute-user-vector, hata detayı sızıntıları, …).
