# generate-puzzles Edge Function

Haftalık cron ile çalışır. 14 gün ilerisine kadar CineMetrics ve Logline bulmacaları üretir.
Acil havuzu (oyun başına 15) her koşumda tamamlar.

## Deploy

```bash
supabase functions deploy generate-puzzles --no-verify-jwt
```

## Cron Kurulumu

Supabase Dashboard → Database → Extensions → `pg_cron` aktif olmalı.

SQL Editor'de (tek seferlik):

```sql
SELECT cron.schedule(
  'generate-puzzles-weekly',
  '0 6 * * 1',  -- Her Pazartesi 06:00 UTC
  $$
  SELECT net.http_post(
    url := (SELECT value FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/generate-puzzles',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT value FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Alternatif (vault yoksa, doğrudan key ile):

```sql
SELECT cron.schedule(
  'generate-puzzles-weekly',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-puzzles',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

## Manuel Çalıştırma

```bash
supabase functions invoke generate-puzzles
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
