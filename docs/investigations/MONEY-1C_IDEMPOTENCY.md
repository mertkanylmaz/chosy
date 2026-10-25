# MONEY-1C — parse-mood idempotency tasarımı (migration 139) — TASARIM, KOD YOK

Durum: **onaylandı (25 Eki 2026), uygulandı (kod + migration dosyası; APPLY/DEPLOY YOK).** Tasarım bölümleri 1–10 onay öncesi metindir; uygulama notları 11–13'te.

## 1. Sorun

`parse-mood` kotayı LLM'den ÖNCE tüketir (`check_and_consume_quota`, 115). İstemci aynı
aramayı yeniden gönderirse (timeout 15 sn, ağ hatası, satın alma sonrası otomatik yeniden
arama, 409 yeniden denemesi) her deneme ayrı bir hak yakar ve ayrı bir ücretli LLM çağrısı
yapar. Ücretsiz hak 3 → 1 inince (Faz 3) bu doğrudan "tek hakkın kaybı" demektir.

Gereksinim: kota tüketiminden ÖNCE atomik sahiplenme (claim). Aynı `(user_id, client_search_id)`
için hak ≤ 1 düşer, LLM ≤ 1 çağrılır, başarılı sonuç yeniden kullanılır, çökmüş istek kurtarılır.

## 2. Mevcut durum (canlıda doğrulandı, salt okuma)

- `mood_searches`: `parsed_profile`, `mood_text`, `error_code`, `latency_ms`… **nullable**.
  NOT NULL olanlar (`id`, `user_id`, `search_date`, `searches_used`, `created_at`, `updated_at`)
  hepsi default'lu → **pending satır (profil yok) şema gereği yazılabilir, kolon gevşetme gerekmez.**
- Kısıtlar: yalnız PK ve `user_id → users(id) ON DELETE CASCADE`. 134 günlük UNIQUE'i kaldırdı;
  bu yüzden yeni kısmi UNIQUE çakışmaz.
- RLS: SELECT/INSERT/UPDATE `user_id = auth_user_id()`. İstemci UPDATE'i tüm kolonlara açık
  (aşağıda 6. madde).
- Bugün parse-mood **başarısız denemelerde de satır yazar** (`error_code` dolu, `parsed_profile`
  NULL): `QUOTA_EXCEEDED`, `INVALID_INPUT`, `ANTHROPIC_CREDIT_LOW`, `PARSE_FAILED`, `UNKNOWN_ERROR`.
- `refund_quota` (136) **PARSE_FAILED'i iade etmez** (`_shared/refundPolicy.ts`; migration-guard
  bulgusu 24 Eki): girdi modeli JSON üretmemeye yönlendirip kotayı düşürmeden sınırsız ücretli
  çağrı üretmeyi engeller. Bu politika korunur — bkz. 4. madde, **görev metninden sapma**.
- Anthropic istemcisinde açık timeout yok (SDK varsayılanı); istemci 15 sn'de keser.

## 3. Şema (migration 139)

```sql
ALTER TABLE public.mood_searches
  ADD COLUMN client_search_id uuid,           -- istemcinin ürettiği arama kimliği; eski satırlar NULL
  ADD COLUMN status           text,           -- 'pending' | 'completed' | 'failed'; eski satırlar NULL
  ADD COLUMN claimed_at       timestamptz,    -- son sahiplenme anı (bayat tespiti + sahiplik belirteci)
  ADD COLUMN quota_consumed   boolean NOT NULL DEFAULT false,  -- bu satır şu an 1 hak tutuyor mu
  ADD COLUMN claim_attempts   int     NOT NULL DEFAULT 0;      -- bedava yeniden-sahiplenme sınırı
ALTER TABLE public.mood_searches
  ADD CONSTRAINT mood_searches_status_check
  CHECK (status IS NULL OR status IN ('pending','completed','failed'));
CREATE UNIQUE INDEX mood_searches_user_client_search_uq
  ON public.mood_searches (user_id, client_search_id) WHERE client_search_id IS NOT NULL;
```

- `quota_consumed NOT NULL DEFAULT false` PG 11+ metadata-only; 119 satırlık tabloda sorun yok.
- `claim_attempts` yeni bir kolon: görev metnindeki listede yok. **Gerekçe 4.3'te;** istenmezse
  bayat-yeniden-sahiplenme sınırsız bedava LLM çağrısı olur (kabul edilebilir bir alternatif
  için 4.3'ün sonuna bakın).
- Eski satırlar: `status`/`client_search_id`/`claimed_at` NULL, `quota_consumed=false` kalır.
  Backfill yok, NULL "idempotency öncesi" demektir.
- **status ↔ error_code ilişkisi** (CHECK değil, sözleşme; eski satırlar NULL olduğu için):

| status | error_code | parsed_profile | quota_consumed |
|---|---|---|---|
| NULL (eski/legacy istemci) | serbest (bugünkü gibi) | serbest | false |
| `pending` | NULL | NULL | true |
| `completed` | NULL | dolu | true |
| `failed` | dolu (`QUOTA_EXCEEDED`, `PARSE_FAILED`, `UNKNOWN_ERROR`, `ANTHROPIC_CREDIT_LOW`, `SERVICE_UNAVAILABLE`) | NULL | iade edildiyse false; iade edilmediyse (PARSE_FAILED, QUOTA_EXCEEDED hariç) true |

`INVALID_INPUT` claim'den ÖNCE reddedilir ve idempotent satır üretmez (bugünkü gibi legacy
biçimde loglanır: `status` NULL).

## 4. Akış

### 4.1 RPC'ler (SECURITY DEFINER, `SET search_path = ''`, EXECUTE yalnız `service_role`)

Tüm referanslar şema nitelikli (`public.mood_searches`, `public.check_and_consume_quota(...)`).
`REVOKE … FROM PUBLIC, anon, authenticated; GRANT … TO service_role` (136 deseni).

1. `claim_mood_search(p_user_id uuid, p_client_search_id uuid, p_mood_text text, p_stale_seconds int)` → jsonb
2. `finish_mood_search(p_search_id uuid, p_claimed_at timestamptz, p_status text, p_profile jsonb, p_error_code text, p_refunded boolean, p_latency_ms int, p_tokens_in int, p_tokens_out int)` → boolean

`INSERT … ON CONFLICT DO NOTHING RETURNING` RPC içinde SQL; supabase-js `upsert` kullanılmaz
(kısmi indeks + PostgREST `onConflict` 42P10 — hafıza notu).

### 4.2 Durum makinesi (`claim_mood_search`)

Tek işlemde: `INSERT … ON CONFLICT (user_id, client_search_id) WHERE client_search_id IS NOT NULL DO NOTHING RETURNING id`.
Satır dönmediyse mevcut satır `SELECT … FOR UPDATE` ile kilitlenir (yeniden sahiplenmeler seri çalışır).

| Mevcut satır | Sonuç | Kota | LLM |
|---|---|---|---|
| yok (yeni claim) | `claimed` — satır `pending`, `claimed_at=now()` | **bir kez tüket**; yetersizse satır `failed`/`QUOTA_EXCEEDED`/`quota_consumed=false`, sonuç `quota_exceeded` | evet |
| `completed` | `replay` — kayıtlı yanıt (`parsed_profile` + `search_id`) + **güncel** `remaining/limit/resets_at` | yok | yok |
| `pending`, taze (`claimed_at` > now − stale) | `in_progress`, `retry_after` | yok | yok |
| `pending`, bayat | yeniden sahiplen (`claimed_at=now()`, `claim_attempts+1`); `quota_consumed=true` ve `claim_attempts ≤ 2` ise **tüketme**, aksi halde tüket | bkz. sol | evet |
| `failed` | yeniden sahiplen ve **tüket** (satın alma sonrası bekleyen arama bu yoldan geçer); `claim_attempts=0` | tüket | evet |

Not: `failed` + yeniden tüket kuralı PARSE_FAILED'de de geçerlidir: o hata hakkı zaten yakmıştı
(iade yok) ve yeni deneme yeni bir hak ister — bugünkü davranışın aynısı, bedava LLM açığı yok.

`quota_exceeded` dönüşü kota yanıtının tamamını içerir (`error`, `used`, `limit`, `tier`) →
parse-mood bugünkü 429 yanıtını aynen üretir (`QUOTA_EXCEEDED`, `upgrade_url`).

### 4.3 Bayat eşiği ve `claim_attempts`

- Stale = LLM zaman aşımı + pay. Öneri: Anthropic istemcisine **açık `timeout: 25_000`, `maxRetries: 0`**
  (şu an açık değil; bu küçük bir `parse-mood` değişikliği, deploy ile birlikte gider) ve
  `p_stale_seconds = 45`. İstemci 15 sn'de keser, sonra aynı id ile yeniden dener → çoğu zaman
  `in_progress` (409, `retry_after: 5`) alır; bu sırada ilk çağrı tamamlanırsa üçüncü deneme `replay` olur.
- `claim_attempts ≤ 2`: çökmüş isteğin (hak tüketilmiş, `pending` takılı) 2 kez bedava kurtarılmasına
  izin verir; üçüncü bayat yeniden-sahiplenme yeniden tüketir. Bu olmazsa sabit bir `client_search_id`
  ile her 45 sn'de bir kotasız ücretli LLM çağrısı yapılabilirdi.
  Alternatif (kolonsuz): bayat yeniden-sahiplenmeyi her zaman tüket + `finish` başarısızlığında iade et.
  Daha basit ama çökme kurtarma kullanıcıya bir hak yakar. **Tercih: `claim_attempts`.**

### 4.4 `finish_mood_search` — sahiplik doğrulamalı

`UPDATE … WHERE id = p_search_id AND status = 'pending' AND claimed_at = p_claimed_at`.
Yeniden sahiplenilmiş (zombi) bir istek geç dönerse 0 satır etkiler → `false`; sonuç yazılmaz,
çağıran bunu Sentry'ye yazar (kullanıcı yine de kendi yanıtını alır).

### 4.5 parse-mood sırası (idempotent yol)

```
requireUser → rate limit → girdi doğrulama → CONFIG kontrolü
→ (client_search_id yoksa) bugünkü akış, DEĞİŞMEDEN
→ claim_mood_search
    quota_exceeded → 429 QUOTA_EXCEEDED (bugünkü yanıt)
    in_progress    → 409 IN_PROGRESS { retry_after }
    replay         → 200 kayıtlı yanıt (+ güncel kota alanları)
    claimed        → LLM
        başarı → finish(completed) → 200 { ...parsed, search_id, kota alanları }
        hata   → refund (shouldRefundOnError ise) → finish(failed, error_code, refunded) → bugünkü hata yanıtı
```

LLM/parse hatası: `shouldRefundOnError` doğruysa (5xx/529/429/408/ağ/kredi) `refund_quota` +
`quota_consumed=false`. **PARSE_FAILED ve sınıflandırılamayan hatalarda iade YOK**, `quota_consumed=true`
kalır — görev metnindeki "LLM/parse hatası → refund" ifadesinden bilinçli sapma (2. madde gerekçesi).
İade ile `finish` iki ayrı çağrıdır; arada çökme olursa satır `pending` kalır, bayat yoluyla kurtarılır.

### 4.6 Replay yanıtı

`parsed_profile` (LLM JSON'u, `search_keywords` dahil) + `search_id = satır id`. `remaining/limit/resets_at`
`check_and_consume_quota`'yı TÜKETMEDEN okunur: `get_quota_status` kullanılabilir (B-10: okurken INSERT yapıyor,
TEKNIK_BORC) — bu yüzden replay kota alanlarını `user_daily_quotas` + `subscription_limits` okuyan
RPC içi salt okuma ile üretir. (Yeni tablo yok.)

## 5. Hata kodları (istemci sözleşmesi)

| Kod | HTTP | Anlam | İstemci davranışı |
|---|---|---|---|
| `IN_PROGRESS` | 409 | aynı id taze `pending` | `retry_after` sonra AYNI id ile yeniden dene |
| `QUOTA_EXCEEDED` | 429 | günlük kota (değişmedi) | paywall (yalnız bu kod) |
| `SERVICE_UNAVAILABLE`, `PARSE_FAILED`, `UNKNOWN_ERROR` | 503/500 | değişmedi | yeniden dene mesajı |
| diğerleri | — | değişmedi | — |

Eski istemci `client_search_id` göndermez → 409 hiç görmez.

## 6. Güvenlik / yetki notu (karar gerektirir)

- Yeni kolonlar (`status`, `client_search_id`, `claimed_at`, `quota_consumed`, `claim_attempts`)
  istemci UPDATE policy'siyle **yazılabilir kalırsa** kullanıcı kendi satırını `completed`/`quota_consumed=false`
  yapabilir → kota hilesi mümkün olmasa da (kota ayrı tabloda) idempotency durumu bozulur.
  Çözüm: `REVOKE UPDATE ON mood_searches FROM anon, authenticated; GRANT UPDATE (recommended_film_ids, rpc_version, error_code) …`.
  İstemci bugün yalnız bu üç kolonu yazıyor (`recommendations.ts`). Bu bir yetki değişikliğidir —
  **onay istiyorum** (137'nin `user_daily_quotas` kilidi deseni).
- `client_search_id` kullanıcıya özeldir (UNIQUE `(user_id, …)`); başka kullanıcının kimliği çakışmaz.

## 7. Kabul testleri

Hepsi dry-run betiğinde (BEGIN…ROLLBACK, 135/136 yöntemi) ve deno testlerinde:

1. Aynı `(user, id)` 10 ardışık claim: yalnız biri `claimed`, 9'u `in_progress`; kota **tam 1** düşer.
2. **Gerçek eşzamanlılık** (dry-run tek işlemde test edemez): deno testi 10 paralel `claim_mood_search`
   çağrısı (ayrı bağlantılar, **geçici test kullanıcısı**, sonunda silinir) — kota net ≤ 1, `claimed` sayısı = 1.
   Bu test canlıya karşı koşar → açık onay ister; yerel `supabase start` varsa orada koşulur.
3. LLM ≤ 1: parse-mood deno testinde sahte Anthropic istemcisi çağrı sayar (10 paralel istek → 1).
4. `completed` → `replay`: kota/LLM yok, `remaining` güncel.
5. Bayat `pending`: `quota_consumed=true` ise tüketmeden sahiplenir; `claim_attempts` 3'te tüketir.
6. `failed` (QUOTA_EXCEEDED) → satın alma sonrası aynı id: yeniden sahiplen + tüket.
7. Zombi `finish`: yeniden sahiplenilmiş satıra geç dönen `finish` → `false`, veri değişmez.
8. İade yolu: 5xx → `quota_consumed=false`, kota geri; PARSE_FAILED → `quota_consumed=true`, iade yok.
9. Eski istemci (alan yok) → bugünkü akış, satır `status` NULL.
10. Yetki: `authenticated` ve `anon` RPC'leri çağıramaz; yeni kolonları UPDATE edemez (6. madde onaylanırsa).

## 8. Bilinen sınırlar

- UTC gün sınırı: tüketim dünün, iade bugünün satırına bakabilir (136'daki sınırın aynısı, ~4 sn/gün).
- `mood_text` bugünkü gibi 500 karakterde kesilip satıra yazılır (değişmedi).
- Smoke testleri (anon sign-in) yeni satırları da cascade'le silinen hesaplarda bırakır (TEKNIK_BORC #11).
- `failed`+`QUOTA_EXCEEDED` satırı kullanıcı başına id başına 1 satır: spam büyümesi rate limiter ile sınırlı.

## 9. İş kırılımı ve süre tahmini (f maddesi, onay sonrası)

| İş | Tahmin |
|---|---|
| Migration 139 + iki RPC + rollback dosyası (repo dışı) | 0,3 gün |
| Dry-run betiği (135/136 yöntemi) + migration-guard turu | 0,2 gün |
| parse-mood entegrasyonu + Anthropic timeout + yanıt sözleşmesi | 0,3 gün |
| Deno testleri (10 paralel senaryo dahil) | 0,3 gün |
| **Toplam** | **≈ 1,1 gün** |

Apply/deploy bu tahmine dahil değil (talimat: APPLY/DEPLOY YOK).

## 10. Onay beklenen kararlar

1. `claim_attempts` kolonu (4.3) — evet / kolonsuz alternatif.
2. PARSE_FAILED'de iade yok (mevcut politika) — onay.
3. İstemci UPDATE yetkisini üç kolona daraltma (6. madde) — onay.
4. Anthropic istemcisine `timeout: 25_000, maxRetries: 0` — onay.
5. Gerçek eşzamanlılık testinin hangi ortamda koşacağı (yerel `supabase start` mı, canlıda geçici kullanıcıyla mı).

## 11. Onaylanan kararlar ve uygulama notları (25 Eki 2026)

1. `claim_attempts` kolonu: **eklendi.** Bayat-pending için 2 ücretsiz yeniden sahiplenme, üçüncüde normal tüketim.
2. PARSE_FAILED iadesiz: **onaylandı**, `refundPolicy` değişmedi. İzleme: aşağıdaki sorgu + Sentry etiketi `error_code:PARSE_FAILED`.
3. İstemci UPDATE yetkisi: **`recommended_film_ids, rpc_version, error_code`** (139 sonunda REVOKE + sütun GRANT).
   **INSERT yetkisi bilerek açık bırakıldı** (onay kapsamı dışı): istemci kendi adına satır ekleyebilir. Bir
   kullanıcı kendine `completed` + uydurma profilli bir satır yazıp aynı `client_search_id` ile claim ederse
   `replay` ile kendi uydurduğu profili geri alır — LLM çağrısı ve kota olmadan; ama profili istemci tarafında
   zaten üretebilir (eşleştirme RPC'leri kotasız), yani kazanç yok. Kota tablosu 137 ile kilitli. Kapatmak
   istenirse INSERT'i de `(user_id, mood_text)` sütunlarına daraltmak ayrı bir onay ister.
4. Anthropic istemcisi `timeout: 25_000, maxRetries: 0`: **uygulandı.** Not: `maxRetries: 0` `client_search_id`'siz
   (legacy) isteklerin davranışını da değiştirir (SDK varsayılanı 2 yeniden denemeydi). Bayat eşiği (45 sn)
   bu değere dayanır, parse-mood deploy'u migration ile birlikte gitmeli.
5. Eşzamanlılık: yerel `supabase start` gerekir. **Bu makinede Docker yok** (`docker` bulunamadı, Docker Desktop
   kurulu değil) → gerçek eşzamanlılık testi YAZILDI ama KOŞMADI. Canlıda koşturulmadı.

### İzleme sorgusu: PARSE_FAILED oranı

PARSE_FAILED hakkı yakar (iade yok); oran yükselirse prompt/regresyon ya da kötüye kullanım göstergesidir.
Salt okuma; haftalık veya deploy sonrası:

```sql
select date_trunc('day', searched_at) as gun,
       count(*) filter (where status in ('completed','failed'))              as biten,
       count(*) filter (where error_code = 'PARSE_FAILED')                  as parse_failed,
       round(100.0 * count(*) filter (where error_code = 'PARSE_FAILED')
             / nullif(count(*) filter (where status in ('completed','failed')), 0), 1) as parse_failed_pct,
       count(*) filter (where status = 'pending' and claimed_at < now() - interval '45 seconds') as takili_pending
from public.mood_searches
where client_search_id is not null and searched_at >= now() - interval '14 days'
group by 1 order by 1 desc;
```

Eşik önerisi (karar sizin): `parse_failed_pct` > %3 iki gün üst üste → inceleme. `takili_pending` sürekli > 0 ise
`finish_mood_search` yazılamıyor demektir (Sentry `MOOD_FINISH_FAILED`).

## 12. Doğrulama durumu

| Kontrol | Sonuç |
|---|---|
| Migration 139 gerçek Postgres motoruna (pglite) uygulanır, 115/136 fonksiyonlarıyla | geçti |
| `supabase/tests/139_dryrun.sql` (14 test + K1_open bilgi satırı: 10 ardışık claim, replay, bayat, quota_denied→yeniden sahiplen, zombi finish, iade/PARSE_FAILED, NULL satırlar, 42501, sütun yetkisi, katalog) | 14/14 geçti — **stub şemada**, canlı DB'de koşmadı |
| `npm run test:mood-claim` (saf yardımcılar + index.ts sözleşmesi) | 9/9 geçti |
| `npm run test:mood-claim-concurrency` (10 paralel, gerçek) | yazıldı, **koşmadı** (Docker yok); env yoksa ATLANIR |
| `npm run typecheck:functions` | 29 hata (baseline 32), parse-mood / _shared altında yeni hata yok |

Stub şemanın sınırı: `users`, `subscription_limits`, `user_daily_quotas`, `mood_searches` sadeleştirilmiş; 135 yazma
koruyucusu, RLS ve `auth_user_id()` yok. Canlıdaki gerçek şemayla ilk koşu dry-run betiğiyle yapılmalı
(onay gerekir).

## 13. Dağıtım sırası (apply/deploy talimatı DEĞİL — plan)

1. `supabase db push` (139) — eski parse-mood ile uyumlu: yeni kolonlar nullable/default'lu, eski satır akışı değişmez.
   Yetki daraltması da bu adımda devreye girer: eski istemci build'leri yalnız üç kolonu UPDATE ediyor (doğrulandı).
2. `supabase functions deploy parse-mood --no-verify-jwt` — `client_search_id` yoksa eski akış.
3. İstemci (g) `client_search_id` gönderir.
Ters sıra (önce fonksiyon) çalışmaz: claim RPC yok → fail-closed 503, ama yalnız `client_search_id` gönderen istemcilerde.

## 14. migration-guard bulguları (25 Eki 2026) ve durum

| Bulgu | Durum |
|---|---|
| **K-1 KRİTİK** — istemci INSERT yetkisi açık: kullanıcı `status='pending', claimed_at='2000-01-01', quota_consumed=true` ile satır ekleyip parse-mood'u çağırırsa bayat-pending yolu hakkı TÜKETMEDEN ücretli LLM çağırır (ve LLM 5xx'te var olmayan hakkı iade ettirir). §11.3'teki "kazanç yok" değerlendirmem yalnız `completed`/replay yolunu kapsıyordu; **yanlıştı**. | **AÇIK — onay bekliyor.** Öneri: `REVOKE INSERT ... FROM anon, authenticated; GRANT INSERT (user_id) ... TO authenticated` (istemci yalnız `user_id` ekliyor: `services/quotaEngine.ts:464`). Dry-run `K1_open` satırı bunu gösterir. **Bu çözüm uygulanmadan 139 deploy EDİLMEMELİ.** |
| O-1 — iade sahiplik doğrulamasından önce, çift iade mümkün | **Düzeltildi.** İade `finish_mood_search` içinde, sahiplik doğrulanınca aynı işlemde; zombi iade edemez (T13). `p_refunded` → `p_refund`, dönüş jsonb `{finished, refunded}`. |
| O-2 — `quota_consumed` hak sayısı değil | **Belgelendi** (kolon COMMENT'i): "en son deneme hak tutuyor mu". Karar mantığı bayrağa tek başına dayanmıyor. |
| D-1..D-3 | D-1 kabul. D-2 (farklı metinle aynı id → eski profil): istemci her yeni aramada yeni id üretir, (g) bunu yapar; sunucu karşılaştırması eklenmedi. D-3 K-1 ile kapanır. |
| D-4 — rollback BEGIN/COMMIT | `db push` ile uygulanacaksa BEGIN/COMMIT satırları çıkarılmalı (not). |
| Ek: `CHECK (claim_attempts >= 0)` | **Eklendi** (T14). |
| Deploy öncesi `pg_dump` (`mood_searches`, `user_daily_quotas`, `\dp`) | Deploy planına eklendi. |
