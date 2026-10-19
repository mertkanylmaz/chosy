# SPOT-1 — Spotlight harf dokunuşu gecikmesi: sunucu denetimi (KEŞİF)

**Mod:** READ-ONLY. Kod, migration, deploy yok. SQL yalnız SELECT.
**Denetlenen commit:** `6b4b0fed41af69c3d1bf912ee86d31a6e513de92` · dal `chore/rename-chosy-2.1.1`
**Proje:** `xpcwihldlnlmyopjubdc` ("chosy ai", us-west-1) — `supabase/.temp/project-ref` ve `.env:2` ile eşleşti.
**Durum:** DUR 1 tetiklendi. Bölüm 1 sonunda duruldu; plan (S1/C1/C2/M1) YAZILMADI.

## Yönetici özeti

1. `submit-guess` 15 Eki 15:07'de **eu-central-1**'de koşmuş (`x-sb-edge-region`); DB **us-west-1**'de. Harf isteği sunucuda **3152 ms** sürmüş. İstemcinin gördüğü ~3.4 s ile aynı büyüklük: gecikmenin ana kısmı sunucu içinde, istemci tarafı değil.
2. `gameApi.ts` Spotlight çağrılarında `region` vermiyor (`services/gameApi.ts:384,420,450`; dosyada "region" geçmiyor). Gauntlet çağrıları `GAUNTLET_EDGE_REGION` (`us-west-1`) ile sabitli (`services/gauntletService.ts:295`, `constants/edgeRegion.ts:25`) ve aynı pencerede 0.6–2.7 s. `constants/edgeRegion.ts:5-9` aynı kök nedeni submit-choice için 29 Eyl'de zaten ölçmüş ("her biri FRA ↔ us-west-1 gidiş-dönüşü ödüyor, toplam ~3 s").
3. Harf yolunda **6 ardışık ağ awaitʼi** var (auth `getUser`, `users`, `game_scores`, `daily_puzzles`, `films`, `game_scores` update). Hepsi bölgeler arası: 6 × yaklaşık 0.5 s ≈ 3.2 s ile ölçüm uyumlu.
4. Eksik indeks yok: 5 sorgunun hepsi unique/pkey indeksle karşılanıyor. Sorgu planı bir sebep değil.
5. Sınır: harf isteği için **yalnız 1 örnek**, tek kullanıcı, tek oturum. Dağılım çıkarılamaz (aşağıda).

## 1. Sunucu zaman dökümü

### 1.1 Harf yolundaki awaitʼler (sırayla)

| # | Dosya:satır | Çağrı | Ağa gider mi | Bağımlılık |
|---|---|---|---|---|
| 0 | `index.ts:242` | `req.json()` | hayır (yerel) | — |
| 1 | `index.ts:213` → `_shared/gameUtils.ts:92` | `userClient.auth.getUser()` | **evet** — GoTrue `/auth/v1/user`; JWT'yi yerelde çözmüyor | — |
| 2 | `index.ts:215` → `gameUtils.ts:104-108` | `users` select `id` where `auth_id` (`.single()`) | evet | #1'in `authUid`'ine bağlı |
| 3 | `index.ts:273-278` | `game_scores` select where `user_id`,`puzzle_id` | evet | #2'nin `userId`'ine bağlı |
| 3b | `index.ts:291-310` | `game_scores` insert (yalnız satır yoksa; ilk hamle) | evet (koşullu) | #3 |
| 4 | `index.ts:372-376` | `daily_puzzles` select 7 kolon where `id` (`.single()`) | evet | yalnız `puzzleId` (girdi) — #3'ten bağımsız |
| 5 | `index.ts:479-483` | `films` select `title` where `id = puzzle.solution_ref` | evet | #4'ün `solution_ref`'ine bağlı |
| 6 | `index.ts:544-547` | `game_scores` update where `id` | evet | #3, #5 sonuçlarına bağlı |

Her istek: 6 ağ gidiş-dönüşü (ilk hamlede 7). Sentry/log yazımı happy path'te yok (`logInfo` yalnız konsola, `index.ts:602`).

Oyun biterken (`outOfAttempts`) ek awaitʼler: `app_config` (`index.ts:532` → `gameUtils.ts:122`), `user_streaks` ×2 (`index.ts:534` → `:152`; `:535` → `:185`), `films` tam satır (`index.ts:561`), `recompute-cinema-dna` fetch (`index.ts:581`). Hepsi ardışık. Bu dal yalnız hakları bitiren harfte çalışır; ölçülen örnek bu dalda değil.

Harf yolunda **gereksiz görünen** çağrı: `index.ts:479` yalnız `title` alıyor; kod başlık dışında `films`ten bir şey kullanmıyor (`:491-492`). Başka kaynaktan alınabilir mi sorusu mimari karar → bu raporda cevaplanmadı.

Aynı istekte `users` ve `game_scores` kontrolleri #2→#3 zincirinde sıralı; #4 bunlardan bağımsız olduğu halde `index.ts:372`de #3'ün ve oran-sınırı kontrolünün **arkasında** bekliyor (kod sırası, veri bağımlılığı değil).

### 1.2 Bölge — ölçüm

Sorgu (`function_edge_logs`, son 24 sa; pencere fiilen 18 Eki 22:56 → 19 Eki 15:08 UTC arası kayıt içeriyor):

```sql
select log_attributes['request.pathname'] as path,
       log_attributes['response.headers.x_sb_edge_region'] as edge_region,
       count() as n,
       round(avg(toFloat64OrZero(log_attributes['execution_time_ms']))) as avg_ms
from logs where source='function_edge_logs' group by path, edge_region order by path
```

| path | edge_region | n | avg_ms |
|---|---|---|---|
| generate-gauntlet | us-west-1 | 11 | 1394 |
| submit-choice | us-west-1 | 14 | 1220 |
| get-archive-status | us-west-1 | 3 | 672 |
| submit-watch-feedback | us-west-1 | 1 | 719 |
| **get-daily-challenge** | **eu-central-1** | 9 | **2637** |
| **submit-guess** | **eu-central-1** | 2 | **3396** |
| recompute-cinema-dna | eu-central-1 | 1 | 189 |

`x_region` istek başlığı: bölge sabitleyen çağrılarda `us-west-1`, `get-daily-challenge`/`submit-guess`te boş. İstemci kolo: IST/TR (15:07). `deployment_id` hepsinde proje öneki aynı; `version`: submit-guess 39.

Yüzdelikler (n küçük, kaba): submit-choice p50 1040 / p90 2138 · generate-gauntlet p50 1479 / p90 1737 · get-daily-challenge p50 2602 / p90 3492 · submit-guess p50 3396.

### 1.3 Harf mi film mi

`function_logs`:

| zaman (UTC) | olay | edge ms |
|---|---|---|
| 15:07:43.840 | `submit-guess.spotlight_letter` (hit=true, attempts=0) | **3152** (kenar log 15:07:43.863) |
| 15:07:52.517 | `submit-guess.processed` (film tahmini, correct=true) | 3641 (kenar log 15:07:52.539) |

Yani yalnızca **bir** harf örneği (3152 ms) var; ikinci istek film tahmini. Kenar logu istek gövdesini taşımıyor, ayrım yalnız `function_logs` ile mümkün oldu. Kullanıcı (maskeli): `b46213c3` (auth), uygulama kullanıcısı `10342171`.

### 1.4 Indeksler (`pg_indexes`)

```sql
select tablename, indexname, indexdef from pg_indexes
where schemaname='public' and tablename in ('game_scores','daily_puzzles','films','users','user_streaks','app_config');
```

| Sorgu | Karşılayan indeks | Sonuç |
|---|---|---|
| `game_scores (user_id, puzzle_id)` | `game_scores_user_id_puzzle_id_key` UNIQUE | var |
| `game_scores id` (update) | `game_scores_pkey` | var |
| `daily_puzzles id` | `daily_puzzles_pkey` | var |
| `films id` | `films_pkey` | var |
| `users auth_id` | `users_auth_id_key` UNIQUE | var |
| `user_streaks user_id` | `user_streaks_user_id_key` | var |
| `app_config key` | `app_config_pkey` | var |

Eksik indeks bulgusu yok. (EXPLAIN çalıştırılmadı; `edgeRegion.ts:7-8` aynı projede sorguların <1 ms olduğunu `pg_stat_statements` ile kaydetmiş — bu turda yeniden ölçülmedi.)

### 1.5 Sıralı neden tahmini

| Sıra | Neden | Güven | Dayanak | Teyit için en ucuz ölçüm |
|---|---|---|---|---|
| 1 | Fonksiyon DB'den ayrı bölgede (eu-central-1 ↔ us-west-1) × 6 ardışık ağ çağrısı | **Yüksek** | Aynı pencerede bölge-sabit fonksiyonlar 0.6–1.4 s, bölgesizler 2.6–3.4 s; `edgeRegion.ts:5-9` aynı mekanizmayı ölçmüş | Aynı istek `region: us-west-1` ile (ham `fetch` + `x-region` başlığı) → `x-sb-edge-region` ve `execution_time_ms` karşılaştır. Kod yazmadan, curl ile yapılabilir |
| 2 | Auth `getUser` ağ atlaması (GoTrue us-west-1) | Orta | `gameUtils.ts:92`; JWT yerelde çözülmüyor (`auth.ts:9-16` bilerek yasak). Bölgeyle birlikte etki eder | Fonksiyon içinde `performance.now()` ile adım adım zaman (deploy gerektirir → bu turda yapılmadı) |
| 3 | Ardışık DB çağrıları (her biri ayrı HTTPS isteği) | Orta | Bölge sabitlenince bile submit-choice (8-9 çağrı) ort. 1.2 s → çağrı başına ~100-150 ms | Aynı yöntem (adım zamanları) |
| 4 | Soğuk başlangıç | **Düşük** | Log alanı yok. 15:07:32 ve :37'de aynı bölgede `get-daily-challenge` koşmuş (6 sn önce); harf isteği ilk değil | `function_logs`ta isolate başlangıç satırı yok → UNVERIFIED |
| 5 | Sorgu planı / eksik indeks | **Çok düşük** | §1.4 | — |
| 6 | İstemci tarafı (`ensureAuthSession`, `supabaseFetch`, `invoke`) | Düşük | Sunucu tek başına 3152 ms; istemcinin gördüğü ~3.4 s ile ~250 ms fark | Cihazda M1 zaman damgaları |

**DUR 1 gerekçesi:** gecikmenin ana kalemi `submit-guess` kodundaki bir hata değil; **çağrının bölge sabitlenmemesi** (bölge = kodun dışındaki ortam kararı). Plan yazılmadı.

## DUR NOKTASI gerektiren maddeler (CTO)

1. **Bölge kararı:** Spotlight (`submit-guess`, `get-daily-challenge`) çağrılarını `GAUNTLET_EDGE_REGION`'a bağlamak, `constants/edgeRegion.ts:17-21`deki "bu bölgeyle çağrılanlar" listesine ekleme anlamına gelir. Liste bilinçli bir CTO kararı; Spotlight o listede yok. Bu mimari bir karar → raporlandı, uygulanmadı.
2. `submit-guess` birden çok oyunun giriş noktası. Bölge OTA'yla (istemci) sabitlenirse eski istemciler etkilenmez; sunucu tarafı `config.toml`de bölge beyanı yok. Hangi yolun seçileceği CTO'da.
3. Plan A (sunucu hızlandırma) ve B (istemci kuyruk) bu bulguyla yeniden ölçeklenmeli: bölge sabitlenirse beklenen süre ~1 s civarı (submit-choice emsali), o zaman kuyruk/pending ihtiyacı başka ağırlıkta.

## Doğrulanamayanlar

- Harf isteği için tek örnek (n=1). Dağılım, p90, soğuk/sıcak ayrımı yok. Log penceresi 24 sa ile sınırlı ve fiilen yalnız ~16 saatlik kayıt içeriyor (en yeni kayıt 19 Eki 15:08).
- Soğuk başlangıç göstergesi log alanlarında yok (`log_attributes` anahtar listesi alındı; `execution_id`, `version`, `deployment_id` var, "cold" yok).
- Fonksiyon içi adım zamanları: ölçülemedi (enstrümantasyon deploy ister).
- Bölge sabitlenince gerçek süre: ölçülemedi (yazma/çağrı yok).
- Cihazdaki (istemci) gecikme kırılımı: cihaz çalıştırılmadı.
- EXPLAIN ANALYZE: kapsam gereği çalıştırılmadı.

## Bölüm 2-4 için toplanan ham girdi (ANALİZ EDİLMEDİ, plan değil)

Yalnız bir sonraki turda tekrar okunmasın diye yer işareti:

- `components/games/Spotlight/index.tsx:384-448` `handleLetter`: `letterLockRef` + `isBusy` kilidi, tek uçuş (single-flight) zaten var; klavye `disabled={used || isBusy}` (`:898`); istek hatasında `setActionError(true)` (`:441`), kilit `finally`de açılıyor (`:443-444`).
- `:371-381` `useFocusEffect` odak alınca state'i sıfırlayıp `loadPuzzle()` çağırıyor; uçuştaki istek iptal edilmiyor.
- `FocusStill.tsx:134-139, 222-233` bulanıklık yalnız `blurRadius` değişince katman değiştiriyor; `focus.ts:16-26` `Math.round(maxBlur*(1-progress))` → art arda harfler aynı yarıçapa düşebilir (`SPOTLIGHT_MAX_BLUR=24`, `constants.ts:14`); yeni yarıçap `onLoad` bekliyor, 1200 ms emniyet (`constants.ts:32`). Cihazda doğrulanmadı.
- Sunucu idempotency: aynı harf ikinci kez → `LETTER_ALREADY_TRIED` 400 (`index.ts:474-477`). `progress_json` oku-değiştir-yaz, tek `update`, koşul/sürüm yok (`index.ts:273`, `:544-547`); iki eşzamanlı istek aynı `spotlight_letters` listesini okuyup birbirinin yazısını ezebilir. İstemci kilidi şu an bunu tek uçuşla engelliyor. Sunucuda kilit/atomik yok. (Doğrulama gerekli: yarış gerçekten üretildi mi → denenmedi.)

## Kapsam dışı bulgular

- `submit-guess/index.ts:166-168` boş yorum-catch (`catch { // Streak sorgusu başarısız — base XP kullan }`): sessiz fallback (kural 1/2). Düzeltilmedi.
- `submit-guess/index.ts:315-321` yarış yolunda `refetched` hatası okunmuyor (`error` alınmıyor).
- `submit-guess/index.ts:597-599` DNA yeniden hesaplama hatası yalnız `logError`; Sentry yok (`dna_updated:false` olarak dönüyor).
- `services/authSession.ts:84` `getSession()` hatası yutulmuyor (Sentry'ye gidiyor) — sorun yok; yalnız not.
