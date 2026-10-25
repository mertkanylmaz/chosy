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
2. **migration-guard K-1 çözülmüş** (`mood_searches` INSERT yetkisi daraltması onaylı ve 139'a işlenmiş) — bkz. `MONEY-1C_IDEMPOTENCY.md` §14.
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
