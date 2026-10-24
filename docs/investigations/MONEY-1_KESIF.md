# MONEY-1 — Gelir planı keşfi (SALT OKUNUR)

Tarih: 24 Eki 2026 · Dal: `release/2.1.1` (HEAD `89bde78`) · Proje: `chosy ai` (linked).
Yapılan: kod okuma + `supabase db query --linked` (yalnız SELECT). Kod/migration/deploy/`test:founder` YOK.
Plan dokümanı `claude/money-1-gelir-plani.md` repoda yok (Glob: eşleşme yok); görev metni esas alındı.

---

## Yönetici özeti

1. **Gauntlet'te paywall tetikleyicisi yok.** `GauntletShell` ve `useChampionAsk` içinde `triggerPaywall`/`ContextualPaywall` geçmiyor (grep). Canlı paywall girişleri: `quota_exhausted` (mood arama/discover), `mood_history`, `profile_upgrade`, arşiv. İlk şampiyon sonrası paywall için hazır yol yok; üstelik orkestratör yeni kullanıcıya ilk 24 saat paywall göstermiyor (`triggerOrchestrator.ts:47-48,229-235`) — ilk şampiyon normalde bu pencerede.
2. **Paywall'ın deneme/3.1.2 mekaniği büyük ölçüde hazır**: deneme metni StoreKit intro offer + `checkTrialOrIntroductoryPriceEligibility`'den okunuyor, yalnız `eligible` ise ve yalnız Annual'da vaat ediliyor; sonraki fiyat, otomatik yenileme, iptal, Terms/Privacy/Restore metinleri var. Ürün/offering bileşimi RC panelinde — **doğrulanamadı**.
3. **Webhook trial'ı tanımıyor**: `period_type` hiç okunmuyor; INITIAL_PURCHASE/RENEWAL hep `subscriptions.status='active'` yazıyor (`revenuecat-webhook/index.ts:606-615`). Erişim doğru (tier yazılıyor, EXPIRATION düşürüyor) ama DB'de trial ile ücretli ayrışmıyor. Canlı: 1 PRODUCTION abonelik (annual/active), 2 `trial` satırı da SANDBOX/legacy weekly.
4. **Puan istemi gerçekten çağrılıyor** (`StoreReview.requestReview`, `reviewPrompt.ts:122`) ama koşul ≥3 ayrı şampiyon günü; canlıda 29 şampiyonlu kullanıcıdan yalnız **2'si** bu eşikte. Ayrıca paywall korumasi route tabanlı (`pathname.includes('paywall')`) ve paywall bir Modal olduğundan fiilen işlemiyor.
5. **send-daily-pick ölü ve yerine geçeni var**: cron #3 `active=false`, son koşum 9 Ağu 13:00 `failed` (GUC `app.supabase_functions_url`). Kod tarafında sunucu push'u K-15 ile yerel 18:00 hatırlatıcısına devredilmiş (`pushNotifications.ts:272-275`). Canlıda 333 kullanıcıdan **17**'sinde push token, bunların **0**'ı son 14 günde aktif; `notification_log` boş.
6. **W5 zaten kodda**: `react-native-purchases` 10.0.1, `enableAdServicesAttributionTokenCollection` JS (`purchases.d.ts:432`) + native (`RNPurchases.m:230`) mevcut ve `purchaseService.ts:273,291-304`'te çağrılıyor (commit `55c78b1`, 20 Eki; ADS0'daki "çağrılmıyor" bulgusu bayat).

---

## W1 — Paywall

### Bulgular

| # | dosya:satır | açıklama | boyut |
|---|---|---|---|
| 1.1 | `components/paywalls/ContextualPaywall.tsx:39-68` | Tek paywall yüzeyi: variant router → `PaywallBase` bottom-sheet `Modal` (`PaywallBase/index.tsx:604`). Variantlar: quota_exhausted, mood_history, streaming_link, profile_upgrade, lifetime_soldout, missed_day_archive | — |
| 1.2 | `app/paywall.tsx:19-37` | Eski rota: 100 ms sonra `router.back()`/`replace('/(tabs)')`. `getDeepLinkFromNotification` `'paywall'` → `/paywall` döndürüyor (`pushNotifications.ts:534-535`); yani paywall'a push deep link'i boş ekrana düşer | S |
| 1.3 | çağrı noktaları (`triggerPaywall(`) | `MoodSearchScreen/index.tsx:261,560,758` (quota_exhausted/search) · `discover.tsx:211` (quota_exhausted/slot) · `(tabs)/profile.tsx:1234` ve `pro-mode.tsx:113` (profile_upgrade) · `profile.tsx:1848` (mood_history_tap) · `roulette.tsx` ve `useGamePaywall.ts:50` (→ variant `null`, ölü) | — |
| 1.4 | `triggerOrchestrator.ts:69-72` | `roulette_limit`, `game_perfect_streak`, `streak_milestone` → `null`; `share_card_generated` → `null` | — |
| 1.5 | `triggerOrchestrator.ts:119-122,129-135` | Yalnız `streaming_link` ve `lifetime_soldout` `app_config` anahtarına bağlı (`remoteConfig.get`, `=== true`). Canlı: `paywall_streaming_link=false`, `paywall_lifetime_soldout=false`, `paywall_profile_upgrade=false` (bu sonuncusu **okunmuyor**, `:112-117`) | — |
| 1.6 | `ArchiveTrigger/index.tsx:81-90` | Champion ekranında "kaçırılan gün" bağlantısı; `missed_day_archive` paywall'a bağlandığı `CRON_ANAHTAR_KESIF.md §5`'ten alındı, bu turda `openArchive` zinciri **yeniden doğrulanmadı** | — |

Canlı `paywall_events` (ölçüm): profile_upgrade shown 29 / dismissed 18 / converted 4 (son 24 Eki 10:32); mood_history shown 2 / dismissed 2 (son 26 Eyl). Satırlar test kullanıcılarını da içerebilir — ayrıştırılmadı.

### RevenueCat yapısı

| # | dosya:satır | açıklama |
|---|---|---|
| 1.7 | `purchaseService.ts:513-526` | `offerings.current.availablePackages`; `current` yoksa `RC_NO_ACTIVE_OFFERING` Sentry error |
| 1.8 | `subscriptionPlans.ts:54-75,130-133` | Ürün kimlikleri `com.chosy.monthly` / `com.chosy.annual` / `com.chosy.lifetime`; entitlement `chosy_plus`; offering `default`. `PLANS.*.trialDays` annual 7, monthly 3 |
| 1.9 | `PaywallBase/index.tsx:151,175,203-208` | Gösterilen: annual, monthly (lifetime satılmıyor, D-08). **Varsayılan seçili: annual**. Paket eşleme `product.identifier` ile; RC paket tanımlayıcıları (`$rc_annual` vb.) koda bağlı değil |
| 1.10 | `paywallPricing.ts:45-55,143-190`, `purchaseService.ts:545-592` | Deneme metni StoreKit'ten: `introPrice` (price 0, DAY/WEEK) + `checkTrialOrIntroductoryPriceEligibility`. Vaat koşulu: yalnız Annual, yalnız `eligible`. `unknown` (Android her zaman) → vaat yok; iOS'ta unknown → Sentry warning |

**Evet: paywall intro offer süresini StoreKit'ten okuyup gösteriyor** (CTA `paywall.ctaTrial`, `en.json:819`). App Store Connect'te ürünlerde intro offer'ın gerçekten tanımlı olduğu ve RC offering'in içeriği bu turda **doğrulanamadı** (kod yorumu `subscriptionPlans.ts:59,65`: 18 May 2026'dan beri canlı).

### Webhook ve trial

| # | dosya:satır | açıklama | boyut |
|---|---|---|---|
| 1.11 | `revenuecat-webhook/index.ts` (grep) | `period_type` / `TRIAL` ifadesi yok; `trial_used` yazılmıyor | M |
| 1.12 | `:497-500,517-526,606-615` | INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE/UNCANCELLATION: `users.subscription_tier` + `subscriptions.status='active'`. **Trial'ı `'trial'` yazmıyor.** İstemci de `'active'` yazıyor (`PaywallBase:357-362`); `'trial'` yalnız bellek durumunda (`SubscriptionContext.tsx:248,264`) | M |
| 1.13 | `:813-959` | Trial iptali (CANCELLATION, gönüllü): yalnız `will_renew=false`; erişim dönem sonuna kadar sürer — davranış doğru | — |
| 1.14 | `:962-1005` | EXPIRATION: `tier='free'`, `subscriptions.status='expired'` (yalnız `.eq('status','active')`); trial hiç `'trial'` yazılmadığı için bugün eşleşiyor. İleride `'trial'` yazılırsa bu filtre onu **atlar** | S |
| 1.15 | `:497-500` | Trial → ücretli dönüşüm RENEWAL olarak işleniyor; `active`/`expires_at` güncelleniyor. Trial ile ücretli ayrımı yapılmadığından dönüşüm DB'den ölçülemez (PostHog `purchase_completed` var, trial ayrımı yok) | M |

Canlı (ölçüm): `subscriptions` → PRODUCTION annual/active **1**; SANDBOX annual/active 3, monthly/active 1, weekly/**trial** 2. `users.subscription_tier`: free 326, annual 3, lifetime 1, monthly 1, weekly_legacy 2. Canlı PRODUCTION trial olayı yok → trial yolu **uçtan uca gerçek olayla hiç gözlenmedi**; sandbox testi bu turda yapılmadı.

### Şampiyon sonrası paywall — en dar müdahale noktası (SEÇENEKLER, karar CTO'nun)

| seçenek | yer | not |
|---|---|---|
| A | `GauntletShell/index.tsx:1295-1309` (canlı final) ve championActive dalı `:1505` | `useContextualPaywall` + yeni `TriggerType`/variant; `maybeRequestReview` ve ask ile aynı anda çakışır |
| B | `askCoordinator`/`askDecision.ts:24,92-104` ile yeni `AskType` | Ask kuralı "günde tek modal" CTO kararı (3 Eki) — değişiklik DUR |
| C | `ChampionReveal` altı sakin bağlantı (ArchiveTrigger deseni) | kullanıcı eylemiyle açılır, modal çakışması yok |

Bayrak: yeni variant `VARIANT_CONFIG_KEYS`'e (`triggerOrchestrator.ts:119`) eklenip `remoteConfig.get` ile (lazy, 5 dk TTL) korunabilir; `isVariantEnabled` `=== true` ister, yani varsayılan kapalı olur. `remoteConfig.get` tipli olduğundan anahtar `remoteConfig.ts` SAFE_DEFAULTS'a eklenmeli (`:133` cast ile okuyor) ve `app_config` satırı gerekir (veri değişikliği).

Çakışmalar (kod): (i) yeni kullanıcı 24 sa kapısı ve cooldown `IMMEDIATE_TRIGGERS` dışındaki her trigger'ı keser (`:90-93,229-252`); (ii) `paywallRouteOpenRef` `pathname.includes('paywall')` (`GauntletShell:279-280`) — `ContextualPaywall` rota değil Modal, bu yüzden review istemi paywall açıkken engellenmiyor; (iii) `useChampionAsk` dwell sayacı sheet açıkken sessizleşiyor (`:22-26`) ama paywall için ayrı koruma yok.

### Guideline 3.1.2 kontrol listesi

| öğe | durum | kaynak |
|---|---|---|
| Deneme süresi | var (CTA `Start %{days}-day free trial`) | `en.json:819` |
| Sonraki fiyat | var (`Nothing due today. Then %{price}/year…`) | `en.json:822` |
| Otomatik yenileme + iptal | var (`Auto-renews unless canceled. Cancel anytime in your App Store account settings.`) | `en.json:822-824` |
| Terms / Privacy / Restore | var, her durumda görünür (yükleme/hata dahil) | `PaywallBase:562-597` |
| Fiyat gösterimi `priceString` (yerelleşmiş) | var | `paywallPricing.ts:166-177` |
| Terms bağlantısı | Notion sayfası (`PaywallBase:73-76`); ASC'deki EULA/Terms alanı ile tutarlılığı **doğrulanamadı** | — |
| Fiyatın görsel baskınlığı (CTA deneme, fiyat `description` satırında) | ekran görüntüsü alınmadı — **doğrulanamadı** | `PaywallBase:518-560` |
| tr.json parite | bu turda kontrol edilmedi | — |
| Monthly: ASC'de 3 günlük deneme tanımlı ama kodda bilinçli vaat edilmiyor | bilgi | `paywallPricing.ts:137-141` |

Tahmini süre: W1 paywall tetikleyici + bayrak + variant: **M** (1-2 gün); trial durumunu DB'ye taşıma: **M** + DUR (aşağıda).

---

## W2 — Puan

| # | dosya:satır | açıklama | boyut |
|---|---|---|---|
| 2.1 | `GauntletShell/index.tsx:1309` | `maybeRequestReview` yalnız canlı final (`result.next==='champion'`) yolunda; yeniden açılışta champion ekranı bunu tetiklemiyor | — |
| 2.2 | `reviewPrompt.ts:59-126` | Akış: yerel ön eleme → `getChampionDatesSince` → `isAvailableAsync` → bayrak yaz → `review_prompt_requested` → **`StoreReview.requestReview()` (`:122`)**. Evet, gerçekten çağrılıyor | — |
| 2.3 | `reviewDecision.ts:13-46` | Koşullar: ≥3 ayrı şampiyon günü, ilk oturum değil, paywall yok (route), uygulama aktif, sürüm başına 1, o gün ask gösterilmediyse | — |
| 2.4 | `reviewPrompt.ts:121-122` | Olay `requestReview`'dan ÖNCE atılıyor; iOS sistem istemini yılda sınırlı gösterir → `review_prompt_requested` = "istendi", "gösterildi" değil | — |
| 2.5 | `GauntletShell:279-280` | Paywall koruması route tabanlı; paywall Modal olduğundan etkisiz | S |

Ölçüm: şampiyonu olan 29 kullanıcıdan ≥2 gün: **3**, ≥3 gün: **2**. `review_prompt_requested` PostHog sayısı **doğrulanamadı** (sorgulanmadı). Son 30 günde oluşan kullanıcı: 68; son 7 günde gauntlet satırı olan kullanıcı: 23.
Tahmini süre: eşik/koşul ayarı **S**; ölçüm genişletme (gösterildi olayı) native API vermediğinden sınırlı.

---

## W3 — Geri çağırma

### send-daily-pick neden çalışmıyor

| # | kanıt | açıklama |
|---|---|---|
| 3.1 | canlı `cron.job` | #3 `send-daily-pick-hourly` `0 * * * *` **`active=false`** (ölçüm) |
| 3.2 | canlı `cron.job_run_details` | Son koşum 2026-08-09 13:00 `failed`: `unrecognized configuration parameter "app.supabase_functions_url"` (ölçüm) |
| 3.3 | `CRON_ANAHTAR_KESIF.md §2` (30 Eyl) | 077 komutu sabit URL + Vault desenine çevirdi ama iş pasif kaldı; aktif 3 iş (#6,#7,#18) Vault anahtarı kayıtsız olduğundan `401 Unregistered API key` alıyor. **Bugün yeniden ölçülmedi** |
| 3.4 | `pushNotifications.ts:272-275` | Kod: sunucu push'u terk — "cron'ları Ağu 2026'dan beri `active=false`"; yerine yerel hatırlatıcı (`:387-436`, `UNLOCK_HOUR`=18, başlık `Tonight's four are ready`, `en.json:1487-1488`) |
| 3.5 | `send-daily-pick/index.ts:147-159,178-184,260-264` | Kod hâlâ `daily_pick_enabled`+`push_enabled`+token + `preferences_vector` ister; saat eşleşmesi kullanıcı TZ; film `match_films_v3` ile gauntlet'ten bağımsız seçilir (ritüel içeriğiyle uyumsuz). Hata yolları yalnız `console.error` (Sentry yok) |
| 3.6 | `133_match_films_v3_vector_first.sql:35-49` | `match_films_v3` imzası değişti (15 argümanlı overload düşürüldü); fonksiyonun çağırdığı 7 adlı argümanın yeni imzayla çözülüp çözülmediği **çalıştırılarak doğrulanmadı** (adlar imzada var, varsayılanlar mevcut) |
| 3.7 | canlı `notification_log` | **0 satır** (ölçüm). Teslimat fonksiyonu `send-notifications` için aktif cron 30 Eyl raporunda yok |

### Bildirim ön-sorusu ve token

| # | dosya:satır | açıklama |
|---|---|---|
| 3.8 | `useChampionAsk.ts:121-142` | `ask_shown` burada; tetik `spotlight_return` veya `dwell` (`ASK_DWELL_MS`=8000, `:45`) — yalnız champion ekranı ve Spotlight yarıda değilken |
| 3.9 | `askDecision.ts:92-104` | Gün 1 → bildirim (sorulmadıysa); gün 2+ → auth uygunsa auth, değilse bildirim; günde en çok 1 ask |
| 3.10 | `NotificationPromptSheet`, `en.json:655-660` | Metin: "Want your four ready every evening?" / "One notification a day, when tonight's four are picked. Nothing else." / "Yes, remind me" · "Not now" |
| 3.11 | `pushNotifications.ts:187-230,236-264` | İzin → yerel hatırlatıcı planlanır → Expo token → `save_push_token` RPC (`users.push_token`, timezone). Açılışta `app/_layout.tsx:750` token'ı yeniden yazar; `(tabs)/_layout.tsx:87` hatırlatıcıyı eşitler |

Ölçüm (sorgular aşağıda): 333 kullanıcı; push_token dolu **17** (hepsi `push_enabled`, `daily_pick_enabled`); bunların **0**'ı son 14 günde `last_activity_at`; token'ı olup gauntlet satırı olan **4**; token+vektör ile send-daily-pick'e uygun **8**. `last_activity_at` ile 14 günde 1 aktif kullanıcı görünüyor, oysa 7 günde 23 kullanıcının gauntlet satırı var → `last_activity_at` aktiflik için güvenilir değil (gauntlet akışında çağrıldığı doğrulanmadı). Token **geçerliliği** (Expo receipt) ölçülemedi.
Önemli: yerel hatırlatıcı OS izni olan cihazda token'dan bağımsız çalışır (`:197-200`); izin verenlerin sayısı sunucuda tutulmuyor (`chosy_push_permission_asked` AsyncStorage) → **PostHog `ask_accepted` olaylarından** çıkarılabilir, sorgulanmadı.
Tahmini süre: sunucu push'unu canlandırmak (anahtar + cron + yeni içerik) **L** ve DUR; yerel hatırlatıcı metni/saat ayarı **S**.

---

## W5 — AdServices

| # | dosya:satır | açıklama |
|---|---|---|
| 5.1 | `package.json:126`, `node_modules/react-native-purchases/package.json` | Sürüm 10.0.1 |
| 5.2 | `dist/purchases.d.ts:432`, `ios/RNPurchases.m:230-234` | `enableAdServicesAttributionTokenCollection` JS ve native tarafta var |
| 5.3 | `purchaseService.ts:273,291-304` | **Zaten çağrılıyor**: `configure` sonrası, yalnız iOS, hata `ADSERVICES_TOKEN_FAILED` Sentry warning. Commit `55c78b1` (20 Eki, `release/2.1.1` içinde) |
| 5.4 | `ADS0_KESIF.md` §2 madde 4 | "Çağrılmıyor" bulgusu 55c78b1'den önceye ait; "JS-only/OTA ile eklenebilir, ilk açılış gömülü paketi çalıştırır (`fallbackToCacheTimeout:0`), OTA 2. açılıştan geçerli" notu orada |

Native değişiklik gerekmeden OTA ile açılabilir mi: API native modülde zaten bulunduğundan **JS-only**; ancak bu commit'in hangi build/EAS update'e girdiği ve canlı binary'nin `react-native-purchases` 10.x içerdiği bu turda **doğrulanamadı** (ADS0: canlı = `release/2.1.0-rc5`, runtime 2.1.0). Atıf verisinin RC'ye ulaştığı RC panelinden doğrulanmadı.
Tahmini süre: **S** (yalnız doğrulama/yayın).

---

## DUR NOKTASI gerektiren maddeler

| # | madde | neden |
|---|---|---|
| D1 | Gauntlet'e yeni ask/modal türü (paywall) eklemek | Ask kuralı CTO kararı (3 Eki); `askDecision.ts` sözleşmesi |
| D2 | `IMMEDIATE_TRIGGERS`'a ekleme veya 24 sa yeni-kullanıcı kapısını / cooldown'u değiştirmek | Ürün kararı; ilk şampiyon paywall'ı bunlara takılır |
| D3 | Yeni variant (bileşen + `PaywallVariantName` + i18n) ve yeni `app_config` satırı | Yeni pattern/veri; `types.ts` genişlemesi |
| D4 | Trial'ı DB'de ayırmak (webhook `period_type`; `subscriptions.status='trial'`/`trial_used`; EXPIRATION filtre değişimi) | Edge Function davranış değişimi + deploy; şema (CHECK 106) zaten `'trial'` kabul ediyor, yeni kolon gerekmiyor ama tüketici etkisi var |
| D5 | Sunucu push'unu canlandırmak (Vault anahtar, cron aktivasyonu, `send-notifications` cron'u) | Üretim sırrı, migration, K-15 kararı (yerel hatırlatıcı) ile çelişir |
| D6 | Review eşiği (3 gün) veya paywall korumasını Modal'a bağlamak | B-211 ürün kuralı |
| D7 | Terms bağlantısı / ASC EULA tutarlılığı | Mağaza metadata kararı |

## Ölçülmüş sayılar ve sorgular

Hepsi `supabase db query --linked`, salt okunur.

```sql
select jobid, jobname, schedule, active from cron.job order by jobid;              -- #3 active=false
select jobid,status,left(return_message,200),start_time from cron.job_run_details
 where jobid=3 order by start_time desc limit 1;                                    -- 2026-08-09 13:00 failed, GUC
select count(*) total,
 count(*) filter (where push_token is not null) with_token,
 count(*) filter (where push_token is not null and push_enabled) token_enabled,
 count(*) filter (where push_token is not null and push_enabled and daily_pick_enabled) dp_enabled,
 count(*) filter (where push_token is not null and push_enabled and preferences_vector is not null and daily_pick_enabled) dp_eligible
 from users;                                                                        -- 333 / 17 / 17 / 17 / 8
select count(*) filter (where push_token is not null and last_activity_at > now()-interval '14 days'),
       count(*) filter (where last_activity_at > now()-interval '14 days') from users; -- 0 / 1
select type,status,count(*),max(created_at) from notification_log group by 1,2;     -- 0 satır
select status,plan,environment,count(*) from subscriptions group by 1,2,3;          -- PROD annual/active 1; SANDBOX: annual/active 3, monthly/active 1, weekly/trial 2
select subscription_tier,count(*) from users group by 1;                            -- free 326, annual 3, lifetime 1, monthly 1, weekly_legacy 2
select action,variant,count(*),max(created_at) from paywall_events group by 1,2;    -- profile_upgrade shown 29/dismissed 18/converted 4; mood_history shown 2/dismissed 2
select key,left(value::text,80) from app_config where key ilike '%paywall%' or key ilike '%review%' or key ilike '%trial%' or key ilike '%notif%';
                                                                                    -- yalnız 6 paywall_* anahtarı, hepsi false; review/trial/notif anahtarı yok
with c as (select user_id,count(distinct date) d from daily_gauntlets
 where scope='personal' and champion_film_id is not null group by 1)
select count(*), count(*) filter (where d>=2), count(*) filter (where d>=3) from c;  -- 29 / 3 / 2
select count(distinct user_id) from daily_gauntlets where scope='personal' and date >= current_date-7;  -- 23
select count(*) from users u where push_token is not null
 and exists (select 1 from daily_gauntlets g where g.user_id=u.id);                  -- 4
select count(*) from users where created_at > now()-interval '30 days';             -- 68
```

## Doğrulanamayanlar

1. `claude/money-1-gelir-plani.md` repoda yok; plan içeriği okunmadı.
2. RevenueCat paneli: offering `default` içeriği, paket tanımlayıcıları, varsayılan paket, webhook teslim geçmişi.
3. App Store Connect: Annual/Monthly intro offer tanımı, Terms/EULA alanı. Sandbox'ta trial → ödeme → iptal akışı çalıştırılmadı.
4. PostHog: `review_prompt_requested`, `ask_shown`/`ask_accepted`, `paywall_*` olay sayıları sorgulanmadı (PostHog skill-first akışı bu turda atlandı).
5. Expo push token geçerliliği (receipt); `last_activity_at`'in gauntlet akışında güncellenip güncellenmediği.
6. Vault anahtarı / aktif cron'ların bugünkü 401 durumu (30 Eyl raporuna dayanılıyor, yeniden ölçülmedi); `send-notifications` için bugünkü cron kaydı.
7. `55c78b1`'in hangi EAS build/update'e girdiği; canlı binary'de AdServices yolunun çalıştığı.
8. `send-daily-pick` → `match_films_v3` çağrısının 133 sonrası çalışıp çalışmadığı (fonksiyon çağrılmadı).
9. `openArchive` → `missed_day_archive` paywall zincirinin kod olarak yeniden doğrulanması; paywall ekran görüntüsü (fiyat baskınlığı); tr.json parite.

## Özet tablo (W başına)

| W | dosya listesi (olası dokunuş) | risk | tahmini süre |
|---|---|---|---|
| W1 | `GauntletShell/index.tsx`, `services/conversion/{types,triggerOrchestrator}.ts`, `components/paywalls/ContextualPaywall.tsx` + yeni variant, `services/remoteConfig.ts`, `locales/{en,tr}.json`, `revenuecat-webhook/index.ts` (trial), `app_config` satırı | orta-yüksek: ask çakışması, 24 sa kapısı, webhook deploy | M–L (1-3 gün) |
| W2 | `reviewPrompt.ts`, `reviewDecision.ts`, `GauntletShell:279-280` | düşük | S |
| W3 | `pushNotifications.ts`, `NotificationPromptSheet`, `locales`; sunucu tarafı için cron migration + `_shared/auth.ts` + Vault | yerel: düşük; sunucu: yüksek (sır, deploy) | S (yerel) / L (sunucu) |
| W5 | `purchaseService.ts` (değişiklik gerekmiyor) | düşük | S (doğrulama) |
