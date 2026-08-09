# generate-puzzles Edge Function

14 gün ilerisine kadar günlük bulmacaları üretir.
Acil havuzu (oyun başına 15) her koşumda tamamlar.

**Elle tetiklenir — cron'u YOKTUR.** Bu README eskiden "haftalık cron ile
çalışır" diyordu; 8 Ağu 2026'da `cron.job` listesi doğrulandı, böyle bir job
kurulmamış. `daily_puzzles`'ın dolu olması elle çalıştırmalardan geliyor.

## Auth — service-role zorunlu

Fonksiyon `_shared/auth.ts` → `requireServiceRole` ile korunuyor. Bearer
token'ı `SUPABASE_SERVICE_ROLE_KEY` ile sabit-zamanlı karşılaştırır;
eşleşmeyen her çağrı **401**. Gerekçe: her koşum ücretli Claude çağırıyor.

`verify_jwt = false` bilerek korunuyor (`supabase/config.toml`) — doğrulama
gateway'de değil, fonksiyonun içinde.

### ⚠️ Hangi anahtar — `.env`'deki İSME GÜVENME

Bu projede iki anahtar kuşağı yan yana yaşıyor ve **ikisi aynı şey değil**:

| Kuşak | Biçim | Uzunluk | Kapıyı açar mı |
|---|---|---|---|
| Legacy `service_role` | `eyJ…` (JWT) | 219 | **Hayır** |
| Yeni secret key | `sb_secret_…` | 41 | Runtime'ın enjekte ettiğiyle **birebir aynı** olan açar |

Fonksiyonun içindeki değer **yeni biçim** olandır. Legacy JWT ile çağrı 401
alır — geçersiz olduğu için değil, farklı bir anahtar olduğu için. (CTO kararı,
8 Ağu 2026: kapı tek anahtara bakar. Legacy JWT'yi `SUPABASE_JWKS` ile
doğrulayıp kabul etme seçeneği değerlendirildi ve reddedildi.)

⚠️ **`sb_secret_` olması yetmez.** 9 Ağu 2026 rotasyonundan sonra `.env` içinde
iki AYRI `sb_secret_` değeri bulundu — ikisi de 41 karakter, biri
`SUPABASE_SECRET_KEY` biri `SUPABASE_SERVICE_ROLE_KEY` adı altında — ve
yalnızca `SUPABASE_SECRET_KEY` kapıyı açtı. `requireServiceRole` eşitlik
karşılaştırması yapar; "doğru kuşak" olmak değil, "runtime'daki değerin ta
kendisi" olmak gerekir. Bu yüzden anahtarı adına bakarak seçme — **kapıya
sorarak seç** (aşağıdaki test).

Doğru değeri almak: **Dashboard → Project Settings → API Keys → `default`
(secret)**. `supabase projects api-keys` CLI komutu secret değerleri
`·····` ile **maskeler**, oradan kopyalanamaz.

### Ölçüldü (9 Ağu 2026, service_role rotasyonundan sonra, canlı deploy üzerinde)

| Çağrı | Sonuç |
|---|---|
| Authorization header yok | 401 `SERVICE_ROLE_REQUIRED` |
| Anon key | 401 `SERVICE_ROLE_REQUIRED` |
| Uydurma/imzasız token | 401 `SERVICE_ROLE_REQUIRED` |
| `.env` → `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_…`) | 401 `SERVICE_ROLE_REQUIRED` — runtime'dakiyle aynı değil |
| **`.env` → `SUPABASE_SECRET_KEY` (`sb_secret_…`)** | **400 `FORCE_WITHOUT_DATE`** — auth geçti |

Legacy `service_role` JWT satırı (8 Ağu ölçümünde 401'di) bu koşumda **yeniden
ölçülemedi**: rotasyondan sonra `.env`'de legacy JWT kalmadı. Aynı korumayı
"uydurma/imzasız token" satırı zaten kanıtlıyor; uydurma bir JWT üretip o satırı
doldurmak ölçüm değil, ölçüm taklidi olurdu.

Son satır kapının açıldığının kanıtı: `force=1` doğrulaması auth'tan hemen
sonra, herhangi bir DB/LLM işinden önce çalışır. Yani pozitif yolu ücretsiz
ve yan etkisiz test edebilirsin — beklenen 400'dür, 200 değil.

**Anahtar her rotasyonda bu tablo yeniden koşulmalı.** Beş çağrı sınıfını
sırayla deneyen betik geçici (scratchpad) tutulur; özü tek satır: `?force=1` ile
POST at, 400 dönen anahtar doğru anahtardır.

## Deploy

```bash
supabase functions deploy generate-puzzles --no-verify-jwt
```

## Manuel Çalıştırma

⚠️ `supabase functions invoke generate-puzzles` **artık 401 döner** — CLI anon
key gönderir. Yukarıdaki `sb_secret_…` değeriyle çağır:

```powershell
$env:SERVICE_KEY = "sb_secret_..."   # Dashboard → API Keys → default (secret)
curl.exe -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/generate-puzzles" `
  -H "Authorization: Bearer $env:SERVICE_KEY" `
  -H "Content-Type: application/json" `
  -d '{}'
```

Tek oyun / onarım modu aynı şekilde query param ile:
`...\generate-puzzles?game=spotlight&date=2026-08-12&force=1`

## Cron kurulacaksa

Cron **migration ile** kurulur, SQL Editor'den değil (049 deseni). Header'sız
`net.http_post` 401 alır ve pg_net fire-and-forget olduğu için
`cron.job_run_details` yine `succeeded` yazar — yani sessizce ölür.
`Authorization` header'ı zorunludur:

```sql
SELECT net.http_post(
  url := '<SUPABASE_URL>/functions/v1/generate-puzzles',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || '<service_role_key>',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);
```

## Env Gereksinimleri

| Key | Zorunlu | Açıklama |
|-----|---------|----------|
| `SUPABASE_URL` | Evet | Otomatik (Supabase runtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | Otomatik (Supabase runtime) |
| `ANTHROPIC_API_KEY` | Evet | Logline sansür haritası için Claude Haiku |
| `POSTHOG_API_KEY` | Hayır | Telemetri (yoksa atlanır, uyarı loglanır) |
| `POSTHOG_HOST` | Hayır | Default: https://us.i.posthog.com |
| `SENTRY_DSN` | Hayır | Hata raporlama (yoksa atlanır) |

## Film Havuzu Kriterleri

Yalnızca tanınan, popüler filmler seçilir:
- `curation_tier IN ('core', 'extended')`
- `metadata_json->>'vote_count' >= 3000` (IMDb 250 eşiği civarı)
- Tüm metadata alanları dolu (year, genres, runtime, director, country, vote_average)
- Son 365 günde solution_ref olarak kullanılmamış
- Aynı yönetmen son 14 günde kullanılmamış

## Zorluk Eğrisi

| Gün | Difficulty | Açıklama |
|-----|-----------|----------|
| Pazartesi | 1 | Kolay — haftaya yumuşak giriş |
| Salı | 2 | Kolay-orta |
| Çarşamba | 3 | Orta |
| Perşembe | 3 | Orta |
| Cuma | 4 | Zor |
| Cumartesi | 5 | En zor — hafta sonu sinefil challange |
| Pazar | 3 | Orta — rahat kapanış |
