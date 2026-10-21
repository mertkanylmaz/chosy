# PRO-FIX-2 KEŞİF — match_films_v3 + rerank-films gecikmesi

Tarih: 22 Eki 2026 · Mod: salt okunur (yalnız SELECT / EXPLAIN ANALYZE, `supabase db query --linked`)

## Yönetici özeti

1. `match_films_v3`'ün **iki overload'u canlıda var** (15 arg: oid 59036, 16 arg: oid 59199). 16 argümanlı olan 050'nin
   `CREATE OR REPLACE`'inin yeni imza eklemesinin sonucu; 043'teki 15 argümanlı eski fonksiyon düşürülmedi. İstemci
   16 argümanlıyı çağırıyor (`exclude_archive` gönderiyor). `send-daily-pick` ikisini de eşleştirebilecek bir argüman
   kümesiyle çağırıyor (aşağıda, doğrulanamadı).
2. Keyword maliyeti ölçüldü: aynı vektör, `match_count=20` → keyword'süz **116 ms**, 5 keyword'lü **3779 ms**
   (≈ +3,66 sn). `match_count=50` keyword'lü: 3272 ms. Maliyet aday sayısına değil, **tüm havuz üzerindeki
   keyword skoruna** bağlı (3581 vektörlü film × ~12,3 tmdb_keyword × her search_keyword × çift yönlü ILIKE).
3. Keyword skoru `scored` CTE'sinde **tüm adaylar** için hesaplanıyor (`050:129-141`); `LIMIT` ancak `oversampled`'da
   (`050:170`) uygulanıyor. `match_reason` ise sonuç satırları için aynı ILIKE alt sorgusunu bir kez daha çalıştırıyor
   (`050:206-216`, yalnız ≤match_count satır, ucuz).
4. **"rerank 50 aday" varsayımı kodla uyuşmuyor:** istemci rerank'a `limit` kadar film gönderiyor ve `limit` = 8
   (`recommendationPreload.ts:106`, `useFeedManager.ts:31`, `recommendations.ts:1130`). 50, yalnız Edge Function'daki
   üst sınır (`rerank-films/index.ts:115`). Yani 50→20 değişikliği bugünkü trafikte hiçbir şeyi değiştirmez.
5. rerank-films 3162–3680 ms ölçümü **8 adayla** gelmiş olmalı; gecikme aday sayısından değil Haiku çağrısı
   (+ olası cold start) kaynaklı görünüyor. Canlı doğrulanamadı (aşağıda).

## Bulgular tablosu

| Dosya:satır | Açıklama | Büyüklük |
|---|---|---|
| canlı `pg_proc` oid 59036 / 59199 | İki overload: 15 arg (043) ve 16 arg (050, `exclude_archive`). Her ikisi SECURITY DEFINER | S |
| `supabase/migrations/043_keyword_boost.sql:19-25` | 15 argümanlı sürümü `DROP`+`CREATE` ile kurdu | — |
| `supabase/migrations/050_exclude_archive_match.sql:20-37` | Yeni parametre eklenince `CREATE OR REPLACE` yeni imza yarattı; eski imza `DROP` edilmedi | S |
| `services/recommendations.ts:626-640` | İstemci 16 arg'lı overload'u çağırıyor (`exclude_archive: true`, `search_keywords` koşullu) | — |
| `supabase/functions/send-daily-pick/index.ts:268-276` | `search_keywords` ve `exclude_archive` göndermiyor; iki overload'a da uyan argüman kümesi → belirsiz çağrı riski (PGRST203 / `function is not unique`). **Doğrulanamadı** (çağrı üretimde denenmedi) | S |
| `050:129-141` | `keyword_match_count`: `unnest(search_keywords) × unnest(tmdb_keywords)`, `lower(tk) ILIKE '%'||lower(sk)||'%' OR lower(sk) ILIKE '%'||lower(tk)||'%'`; tüm `candidates` için | M |
| `050:162-171` | `ORDER BY adjusted_sort_key LIMIT match_count*per_director_cap*3` — sıralama keyword boost'a bağlı olduğundan keyword hesabı LIMIT'ten önce zorunlu | — |
| `050:157` | `random() * 0.12` `sort_key`'te; `ORDER BY` `adjusted_sort_key` kullandığı için bu kolon fiilen kullanılmıyor | S |
| `050:206-216` | `match_reason` aynı ILIKE sorgusunu yalnız çıktı satırlarında tekrar ediyor | S |
| `recommendations.ts:1130`, `recommendationPreload.ts:106` | Rerank'a giden aday sayısı = `limit` = 8 | — |
| `rerank-films/index.ts:114-115` | `count` 1–30, adaylar `slice(0, 50)`; üst sınır sunucuda, parametre istemcide (`body.candidates`) | — |
| `rerank-films/index.ts:137-142` | `claude-haiku-4-5`, `max_tokens: 512`, tek çağrı; zaman aşımı yok (istemcide 8 sn AbortController, `recommendations.ts:765`) | S |
| `recommendations.ts:1119-1126` | Rerank yalnız `searchKeywords.length > 0` iken çalışıyor; yani keyword'lü yol hem yavaş RPC hem rerank'ı birlikte tetikliyor | — |

## Ölçülmüş sayılar

Tümü `supabase db query --linked -f <dosya>` ile, salt okunur.

| Ölçüm | Sorgu | Sonuç |
|---|---|---|
| Overload listesi | `select oid, pg_get_function_identity_arguments(oid), pronargs, prosecdef from pg_proc ... proname='match_films_v3'` | 2 satır: pronargs 15 ve 16, ikisi de prosecdef=true |
| Vektörlü film | `select count(*) from film_profiles where profile_vector is not null` | 3581 |
| tmdb_keywords dolu film | `count(*) from films where tmdb_keywords is not null and cardinality(tmdb_keywords)>0` | 2867 |
| Ort. keyword sayısı | `avg(cardinality(tmdb_keywords))` | 12,3 |
| Keyword'lü, `match_count=20` | `EXPLAIN (ANALYZE, BUFFERS) select * from match_films_v3(<ilk vektör>, null, 1.0, 0.0, 20, ..., 0.2, 1, false, array['thailand','beach','travel','backpacking','island'], true)` | Execution **3779 ms**, buffers hit=87717 |
| Keyword'süz, `match_count=20` | Aynı, `search_keywords = null` | Execution **116 ms**, buffers hit=85149 |
| Keyword'lü, `match_count=50` | Aynı, 50 | Execution **3272 ms** |
| `pg_stat_user_functions` | `track_functions` = `none` | Çağrı sayacı boş; hangi overload'un kaç kez çağrıldığı DB'den okunamıyor |

Notlar: tek vektör / tek keyword kümesiyle tek ölçüm (soğuk/sıcak ayrımı yapılmadı). İstemci ölçümünüzdeki
4132–4796 ms ile aynı mertebede, sunucu tarafı ≈3,3–3,8 sn. Fonksiyon `LANGUAGE sql` ama SECURITY DEFINER
olduğu için planlayıcı tarafından inline edilmiyor; `EXPLAIN` yalnız "Function Scan" gösteriyor, CTE içi plan
görünmüyor. İçerideki ILIKE maliyeti doğrudan EXPLAIN'le ayrıştırılmadı; fark (3779 − 116 ms) keyword
kolonlarının toplam etkisi olarak okunmalı.

## Soru bazında yanıtlar

1. **Overload'lar:** İkisi de canlıda. İstemci 16 argümanlıyı kullanıyor (`exclude_archive` göndererek). 15
   argümanlıyı **tek başına** çağıran kod bulunamadı (grep: `services/`, `components/`, `supabase/functions/`).
   `send-daily-pick` iki imzaya da uyabilen argümanlarla çağırıyor; hangisine gittiği veya hata verdiği
   doğrulanamadı. Diğer çağıranlar (dış script, Dashboard) taranmadı.
2. **Keyword skoru:** yukarıda. "Önce vektörle top-N, keyword yalnız onlara" önerisi için mevcut sıralama
   (`adjusted_sort_key`) keyword boost'u içeriyor; top-N'i yalnız vektörle seçmek **sıralama/sonuç
   semantiğini değiştirir** (keyword'le yukarı çıkacak, vektörde ~100'ün dışında kalan film kaybolur). Bu bir
   davranış kararı → DUR noktası.
3. **Rerank 50→20:** İstemci zaten 8 gönderiyor; parametre **istemcide** (`body.candidates`), fonksiyonda yalnız
   50'lik tavan var. 8 adayla ölçüm yapıldıysa 3,1–3,7 sn'nin aday sayısıyla ilgisi görünmüyor. Kalite etkisi
   ölçülmedi (rerank sonrası sıra değişimi/telemetri okunmadı).

## DUR NOKTASI gerektiren maddeler

- **D-1 — match_films_v3 yeniden yazımı** (yeni migration, imza/davranış değişikliği): vektörle top-N sonra keyword
  skoru. Sıralama semantiği değişir. CTO onayı + `supabase db push`.
- **D-2 — Eski 15 argümanlı overload'un `DROP`'u:** yeni migration; `send-daily-pick` çağrısı önce doğrulanmalı.
- **D-3 — rerank-films'in rolü:** istemci yalnız 8 adayı yeniden sıralıyor; adayı artırmak (ör. RPC'den 20–30 çekip
  rerank sonrası 8'e kesmek) veya rerank'ı kaldırmak ürün/mimari kararı.
- **D-4 — Edge Function değişikliği** (zaman aşımı, model, cold start) deploy gerektirir; bu turda deploy yok.

## Doğrulanamayanlar

- rerank-films canlı gecikmesinin dökümü (Haiku süresi vs. cold start vs. ağ): çağrı Anthropic'e gider, maliyetli
  ve kullanıcı rızası kapısı (`aiConsent.ts`) altında; Edge Function log/metrik erişimi bu turda kullanılmadı.
- İstemcinin gerçekte kaç aday gönderdiği: kod 8 diyor; canlı istek gövdesi gözlenmedi.
- `send-daily-pick`'in iki overload ile çalışıp çalışmadığı (belirsiz çağrı hatası) — çağrı denenmedi.
- 15 argümanlı overload'un son kullanım zamanı: `track_functions=none`, istatistik yok.
- Keyword ILIKE maliyetinin CTE içinde ayrıştırılması (auto_explain/plan görünmüyor).
- Birden fazla vektör/keyword kombinasyonu ve soğuk-sıcak ayrımı ölçülmedi.
