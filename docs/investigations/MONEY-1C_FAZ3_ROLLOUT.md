# MONEY-1C — Faz 3 yayın planı (TASLAK — hiçbir komut çalıştırılmadı)

Durum: yazıldı 25 Eki 2026. Bu belge plandır; **push, OTA, build, migration apply, Edge deploy ve
`app_config`/`subscription_limits` değişikliği içermez ve yapmaz.** Her adım ayrıca onay ister.

## 0. Karar kapısı — Faz 3 bayrağı 1 Kasım'da OTOMATİK AÇILMAZ

Faz 3 (ücretsiz hak 3 → 1, Mood Search kilidi herkese) bir tarihe bağlı değildir; **31 Eki karar kapısına** bağlıdır:

| Kapı girdisi | Kaynak | Ne zaman |
|---|---|---|
| Hard paywall: `paywall_viewed` → trial başlangıcı dönüşümü | PostHog (`paywall_viewed`, `purchase_completed`, `trial` başlangıçları) | 31 Eki'ye kadar toplanan veri |
| Trial → ücretli dönüşüm sonucu | RevenueCat / `subscriptions` (`status`, `period_type`) | **1 Kas** (ilk trial'ların bitişi) |

- Kapı açıkça "geç" demedikçe `mood_offer_enabled` genel açılışı ve `free_visible_count` / hak değişikliği **yapılmaz**.
- 1 Kas'taki trial→paid sonucu kapının ikinci yarısıdır: 31 Eki kararı bu sonuç gelmeden verilirse "koşullu" kabul edilir
  ve 1 Kas'ta yeniden doğrulanır. Tester listesiyle (`mood_offer_testers`) sınırlı pilot bu kapıdan bağımsız sürebilir.
- Otomasyon yok: takvim hatırlatıcısı veya zamanlanmış `app_config` yazımı kurulmaz.

## 1. Ön koşullar (hepsi yeşil olmadan Faz 3 konuşulmaz)

1. `MONEY-1C_CIHAZ_TEST.md` bölüm A (bayrak kapalı regresyon) ve B (açık) cihazda geçmiş.
2. ~~migration-guard K-1~~ **ÇÖZÜLDÜ** (INSERT yetkisi yalnız `user_id`, 139'a işlendi; 26 Eki) — bkz. `MONEY-1C_IDEMPOTENCY.md` §14.
3. 139 dry-run **canlı şemaya karşı** (onayla) ALL PASS; gerçek eşzamanlılık testi yerel `supabase start` ile geçmiş (Docker gerekir).
4. `pg_dump` yedeği: `public.mood_searches`, `public.user_daily_quotas` + `\dp public.mood_searches` çıktısı.
5. Sentry/PostHog alarm panelleri hazır (bölüm 5).

## 2. Dağıtım sırası (her adım ayrı onay; ters sıra çalışmaz)

| # | Adım | Not |
|---|---|---|
| 1 | `supabase db push` (139) | Eski parse-mood ile uyumlu. İstemci UPDATE yetkisi daralır; mevcut build'ler yalnız üç kolonu yazıyor (doğrulandı). |
| 2 | `supabase functions deploy parse-mood --no-verify-jwt` | `client_search_id` yoksa eski akış. Anthropic `timeout 25 sn, maxRetries 0` legacy isteği de etkiler. |
| 3 | İstemci build/OTA (g dahil) | Kimlik yalnız `mood_offer_enabled` açıkken gider. |
| 4 | Bayrak: yalnız `mood_offer_testers` | Pilot. Genel açılış ayrı karar (bölüm 0). |
| 5 | Faz 3: hak 3 → 1 | `subscription_limits.daily_search_limit` — **bu çalışma dokunmadı**; ayrı onaylı migration/SQL. Yalnız `free` satırı. |
| 6 | `free_visible_count` | Varsayılan 3 (kod + `SAFE_DEFAULTS`); `app_config` anahtarı ayrı onay. Yalnız `services/remoteConfig.ts` üzerinden okunur. |

Her adımdan sonra bölüm 5 panelleri 30 dk izlenir; eşik aşılırsa bölüm 4.

## 3. Faz 3'te doğrulanacak açık noktalar

- **Eski kota duvarı kopyası:** `app/pro-mode.tsx` → `moodOffer.offerCta` = "Unlimited with Pro". Pro'nun gerçek günlük limiti
  `subscription_limits`'ten gelir; "Unlimited" doğruysa kalır, değilse kopya düzeltilir (kopya kararı sizin).
- **Hak göstergesi:** "Today's free search · N picks included" ipucu kalan hakkı bilmiyor (kota tükenmişken de görünür). Faz 3'te hak
  1 olunca yanıltıcı olabilir → `get_quota_status` ile gizle/doğrula.
- **Bugünkü deste kurtarma:** `mood_deck_started` kurtarılan destede yeniden atılıyor (analitikte çift sayım); `clientSearchId`
  artık snapshot'a yazılıyor mu (g) kontrol et.
- **İade politikası:** PARSE_FAILED iadesiz → hak 1 iken tek hatalı LLM çıktısı hakkı yakar. `parse_failed_pct` sorgusu
  (`MONEY-1C_IDEMPOTENCY.md` §11) Faz 3 öncesi bir hafta izlenir; eşik aşılırsa politika yeniden karara bağlanır.
- **Satın alma sonrası bekleme:** sunucu tier gecikmesi > 30 sn ise `mood_activation_timeout` olayı; oran izlenir.
- **Sandbox TRANSFER gürültüsü** (`CHOSY-EDGE-FUNCTIONS-14`): kullanıcı etkisi yok (sync-entitlement bağımsız yazar); RevenueCat
  "transfer behavior" ayarı doğrulanmadan Faz 3'e geçilmez (cihaz testi B3d).

## 4. Geri alma

| Katman | Geri alma | Veri etkisi |
|---|---|---|
| Bayrak | `mood_offer_testers` boşalt / `mood_offer_enabled` kapat (5 dk içinde yansır) | yok |
| İstemci | Bayrak kapalıyken yeni davranış yok; build geri çekmek gerekmez | yok |
| parse-mood | önceki sürüme deploy (claim kullanmaz) | pending satırlar bayatlar, zararsız |
| Migration 139 | `C:\Users\mertk\moodflix-rollback\139_rollback.sql` (repo dışı; `db push` ile yeni migration olarak) | 5 kolon düşer (idempotency verisi kaybolur); önce parse-mood geri alınmalı |
| Hak 1 → 3 | `subscription_limits.free` eski değere | yok |

## 5. İzleme (açılıştan sonra ilk hafta)

- Sentry etiketleri: `MOOD_FINISH_FAILED`, `QUOTA_REFUND_FAILED`, `QUOTA_CLAIM_FAILED`, `PARSE_FAILED`, `ENTITLEMENT_SYNC_FAILED`.
- PostHog: `mood_lock_viewed → mood_lock_tapped → paywall_viewed → purchase_completed` dönüşümü; `mood_deck_unlocked`;
  `mood_activation_timeout`; `paywall_plan_selected.source` dağılımı.
- SQL: `parse_failed_pct`, `takili_pending` (IDEMPOTENCY §11); günlük `quota_denied` oranı.
- Uyarı eşiği önerisi (karar sizin): `takili_pending` > 0 sürekli; `parse_failed_pct` > %3 iki gün; `QUOTA_REFUND_FAILED` ≥ 1.

## 6. Bu belgenin DIŞINDA kalanlar

Fiyatlandırma/trial süresi, hard paywall tasarımı (31 Eki kapısının girdisi), Android, App Store metinleri.

## 7. Refine etkisi (Faz 3'te search 3 → 1)

**Soru:** `subscription_limits.free` = `daily_search_limit 3`, `daily_refine_limit 1`. Search 1'e inince refine arama kotasından mı sayılır, ayrı mı? Ücretsiz kullanıcı günde kaç arama yapar?

**Cevap (kod + canlı veri, 25 Eki):**
- **Ayrı sayaç.** `check_and_consume_quota(p_quota_type)` (021/115/136): `'search'` → `user_daily_quotas.searches_used` (limit `daily_search_limit`); `'refine'` → `refines_used` (limit `daily_refine_limit`). Biri diğerini düşmez/artırmaz. `bonus_searches_*` yalnız `'search'` dalında.
- **parse-mood yalnız `'search'` tüketir.** Doğrudan (`p_quota_type: 'search'`, `index.ts:313`) ve 139 sonrası `claim_mood_search` içinden (`check_and_consume_quota(p_user_id, 'search')`, migration satır 219). Refine çağrısı yok.
- **Refine'ı tüketen hiçbir yol yok.** İstemcide `consumeQuota('search')` dışında çağrı yok (`MoodSearchScreen`); `check-quota` Edge Function'ı `'refine'` kabul eder ama hiçbir istemci çağırmaz; `parse-taste` `'search'` tüketir ama istemci çağıranı yok (eski). `daily_refine_limit` bugün **ölü bir limit**: UI'da refine özelliği yok.
- **Faz 3 sonrası fiili günlük arama:** ücretsiz kullanıcı = **1 arama** (+ varsa `bonus_searches` kadar ekstra). Refine bunu 2'ye çıkarmaz çünkü erişilemiyor. Gelecekte refine özelliği eklenirse ayrı sayaçtan 1 hak daha verir (1 arama + 1 refine); bu bilinçli bir ürün kararı olmalı, bugün öyle değil.
- **Sayaç etkilemeyenler:** rerank-films günlük limit (free 15, ayrı `api_rate_limits` sayacı), slot (free 100), oyunlar — hepsi search'ten bağımsız.
- **Eski istemci notu (bayrak-öncesi sürümler):** 2.1.2 ve altı kendi AsyncStorage sayacıyla (`FREE_DAILY_LIMIT` = 3) kapı kurar; sunucu limiti 1 olunca 2. aramada sunucudan `QUOTA_EXCEEDED` alır ve eski kota duvarını gösterir. Hak daha erken biter ama yanlış sayım olmaz; bu kullanıcılar yeni arayüzü (kilit kartı, bugünkü deste) görmez. Faz 3'ten önce eski sürüm payı Sentry/PostHog release dağılımından ölçülmeli.
- **Not:** `weekly_legacy` (search 14) satırı ve `legacy_mood_access` muafiyeti (115) bu değişiklikten etkilenmez; limit yalnız `free` satırında değişir.

## 8. Faz 3 öncesi uygulama sürümü payı (app_version) ölçümü

**Karar notu (25 Eki):** 2.1.2 ve sonrası ücretsiz kullanıcı Pro Mode'a girmeye çalışınca **hard paywall** görüyor; yeni
"kilit kartı / bugünkü ücretsiz arama" deneyimi yalnız `mood_offer` bayrağı açıkken, yeni istemcide çalışır. **Etkilenen grup 2.1.0 ve
2.1.1** (eski kota duvarı, yerel AsyncStorage sayacı — bkz. §7 "eski istemci notu").

**Faz 3 kararından ÖNCE ölç (PostHog, çalıştırılmadı):**
```sql
-- son 14 gün, benzersiz kullanıcı payı: sürüm dağılımı
SELECT properties.$app_version AS app_version, count(DISTINCT person_id) AS users
FROM events
WHERE timestamp > now() - INTERVAL 14 DAY
GROUP BY app_version ORDER BY users DESC
```
- Ücretsiz kullanıcıya daraltılmış payı ayrıca çıkar (aynı sorguya `is_pro`/`tier` kişi özelliği süzgeci; özellik adı PostHog'da doğrulanmalı).
- Eşik önerisi (karar sizin): 2.1.0/2.1.1'in ücretsiz aktif kullanıcılar içindeki payı **> %20** ise Faz 3 hak değişikliğinden önce zorunlu
  güncelleme/uyarı (ya da bu grubun hakkını ayrıca değerlendir) planı yapılır; çünkü bu grup arama hakkı 3→1 olduğunda 2. aramada sunucudan
  `QUOTA_EXCEEDED` alır ve yeni teklifi hiç görmez.
- Sonuç bu bölüme yazılır. 31 Eki karar kapısının (bölüm 0) girdilerinden biridir.

### 8.1 Ölçüm sonucu (25 Eki 2026, PostHog, son 14 gün)

Aktif = `app_launched` / `Application Opened` / `Application Became Active` olayı atan benzersiz kişi. OTA = `ota_update_found` / `ota_update_fetched`.

| app_version / runtime | aktif | OTA found | OTA fetched | son görülme |
|---|---|---|---|---|
| 2.1.1 / 2.1.1 | 25 | 19 | 19 | 24 Eki |
| 2.1.0 / 2.1.0 | 12 | 2 | 2 | 20 Eki |
| 2.1.2 / 2.1.2 | 5 | 2 | 2 | 25 Eki |
| 2.1.3 / 2.1.3 | 2 | 0 | 0 | — |
| 2.1.1 / (runtime boş) | 1 | 0 | 0 | — |

- **Etkilenen grup (2.1.0 + 2.1.1): 38 / 45 aktif kişi ≈ %84** (2.1.1 = 25+1 runtime'ı boş satır, 2.1.0 = 12). Runtime'ı boş satır hariç tutulursa 37/44 ≈ %84. Eşiğin (%20) çok üstünde.
- **Sınır 1 — ücretsiz süzgeci yapılamadı:** PostHog kişi özelliklerinde tier/is_pro alanı YOK (yalnız `app_user_id` ve `$` özellikleri). Ücretsiz payı için `app_user_id` → Supabase `users.subscription_tier` birleştirmesi gerekir (PostHog dışı, ayrı ölçüm). Ücretli kullanıcı payı küçük olduğundan ücretsiz payın da benzer yüksek olması beklenir ama KANITLANMADI.
- **Sınır 2 — örneklem küçük:** toplam 45 aktif kişi. Yüzdeler yön gösterir, kesin değil.
- **OTA erişimi:** 2.1.1'de 19/25 (%76) OTA'yı bulup indirmiş (13'ü `embedded` kaynaklı başlangıç kaydı, 14 ayrı `ota` update_id). **2.1.0'da yalnız 2/12 (%17)** güncelleme bulmuş; OTA olayı atan 2.1.0 kullanıcılarının son güncellemesi 9 Eki. 2.1.0 grubunun çoğu OTA ile yeni istemci koduna ULAŞMIYOR görünüyor (kanal/runtime farkı ya da olay hiç atılmıyor — hangisi olduğu doğrulanmadı).

### 8.2 KURAL — OTA erişimi doğrulanmadan açma

Etkilenen grup (2.1.0/2.1.1) aktif kullanıcıların **> %20**'sidir (ölçülen ≈ %84). Bu yüzden:

1. **Faz 3 hak değişikliği (`free` search 3 → 1) ve `mood_offer` bayrağı, aşağıdakiler doğrulanmadan AÇILMAZ:**
   - (a) 2.1.0 ve 2.1.1 runtime'ına yayımlanmış OTA'nın bu sürümlerde gerçekten indirildiği gösterilmeli: test cihazında 2.1.0 ve 2.1.1 ile `ota_update_fetched` + yeni `update_id` ile açılış; PostHog'da bu iki sürüm için son 7 günde `found ≥ %70` ve `fetched ≥ %70` (aktife göre).
   - (b) OTA ile gelen kodun yeni kota/paywall akışını gerçekten çalıştırdığı doğrulanmalı (`mood_deck_*` / `mood_offer_*` olayları o sürümlerde görülmeli).
2. (a) sağlanamıyorsa seçenekler (karar sizin): zorunlu güncelleme/uyarı, ya da bu grubun hakkını ayrıca değerlendirme. Sağlanmadan hak 3→1 yapılırsa grup 2. aramada sunucudan `QUOTA_EXCEEDED` alır ve yeni teklifi hiç görmez (§7).
3. Ücretsiz payı, `app_user_id` ↔ `users.subscription_tier` birleştirmesiyle ayrıca ölçülür; sonuç ve tarih bu bölüme eklenir. Birleştirme yapılmadan kural, tüm aktif kullanıcı payına göre uygulanır.
4. Bu ölçüm 31 Eki karar kapısında (bölüm 0) yeniden alınır; sayılar 25 Eki anlık görüntüsüdür.
