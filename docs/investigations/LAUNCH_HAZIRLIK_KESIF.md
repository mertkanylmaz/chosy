# LAUNCH HAZIRLIK DENETİMİ — Keşif Raporu

**Tarih:** 7 Ekim 2026 (sunucu saati 6 Eki 2026 21:06 UTC)
**Mod:** READ ONLY — kod/DB değişikliği yok. Canlı ölçümler `supabase db query --linked` ile, yalnız SELECT.
**Dal:** `feat/spotlight-ritual-teaser` @ `cb7acc6` · **Bible:** `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` v1.45

---

## Yönetici özeti

1. **K-52'nin altı kapısının kabul kriteri hiçbir yerde tanımlı değil.** Bible yalnız kapıların adlarını sayıyor (`7_…KILIDI.md:243`). Ölçülebilir eşikleri olan tek liste §7.4'teki marketing kapısı G-1…G-8 (`:1068-1084`). Bu yüzden "Product kapısı geçti" denebilecek bir tanım bugün yok.
2. **Cihaz kanıtı sıfır.** `V1_TESTFLIGHT_CHECKLIST.md` bölüm A–O'daki maddelerin hiçbiri işaretlenmemiş, sonuç dosyası da yok. K-42 (E-11), K-49, K-54 ve G-6 doğrulamalarının hepsi bu oturuma bağlı.
3. **K-49 (RevenueCat 6 durumlu matris) için test kanıtı bulunamadı.** Bible'daki son kayıt v1.9'da (31 Ağu): "Kalan: K-49 sandbox durum matrisi." K-49 "test edilmeden release yok" diyor.
4. **Tek paywall tetiğini (`missed_day_archive`) uzaktan kapatan bir bayrak yok.** `VARIANT_CONFIG_KEYS` yalnız `streaming_link` ve `lifetime_soldout`'u kapsıyor; eşlemesi olmayan varyant her zaman aktif (`services/conversion/triggerOrchestrator.ts:119-135`).
5. **Mağaza paketi dokümanı Nisan 2026 tarihli ve mood-search dönemine ait** (`docs/LAUNCH_CHECKLIST.md:3`). Fiyatlar, IAP listesi, inceleme notu ve ekran görüntüsü planı bugünkü ürünle çelişiyor.

---

## Bulgular tablosu

Boyut: S (< 1 gün) · M (1–2 gün) · L (2+ gün ya da dış bağımlılık)

### 1. K-52 — altı release kapısı

| Kapı | Kanıtla geçen | Bekleyen / kanıt yok | Referans | Boyut |
|---|---|---|---|---|
| **Tanım** | — | Altı kapının hiçbirinin kriteri yazılı değil. `V1_DESIGN_OS_UYUM_SPRINT.md:557` adları tekrarlıyor. `G5_EDITORYAL_DONEM_KAPI_TASLAGI.md:43` G-5'i "altı release gate'ten biri" diye anıyor, yani K-52 ile G-x karışmış durumda. | `7_…KILIDI.md:243`, `:1068-1084` | S (CTO kararı) |
| Product | Yalnız birim test seviyesi: K-60, K-61 ve K-62 kuralları Deno testli (`tests/gauntlet/championFold.test.ts`, `spotlightTeaser.test.ts`; bible `:74`, `:87`, `:88`) | Cihaz akışında kanıt yok: checklist A–O'nun hepsi `[ ]` | `docs/05_SPRINTS/ACTIVE/V1_TESTFLIGHT_CHECKLIST.md` | L |
| Data | Çekirdek 20 event'in 19'u kodda çağrılıyor (bkz. §6) | Canlı doğrulama kaydı yok (G-6 0/20 kayıtlı). `provider_clicked` ateşlenmiyor. `auth.tsx:96-105` kimlik uzayı uyuşmazlığı açık (bible §9 `:1148`) | `docs/analytics/G6_CEKIRDEK_EVENTLER.md:150-170` | M |
| Reliability | K-16 hesap silme cascade'i canlıda doğrulanmış (E-20.1, bible `:73`, `:753`). Global slot 6 Eki'de HTTP 200 ile yazılmış (ölçüm aşağıda) | K-42'nin 8 senaryosu cihazda koşulmadı (E-11, checklist J1). G-1 crash-free ölçülmedi (Sentry erişimi yok). Hesap silmede 207 sonrası "dirilen hesap" açık (`TEKNIK_BORC.md` "🔴 Hesap silme 207", ~satır 3386) | bible `:537-543` | L |
| Monetization | E-09 event'leri kodda (`purchaseService.ts:370,380,488,500`, `triggerOrchestrator.ts:275,312`, `ContextualPaywall.tsx:47`). Fiyat ASC ile senkron (K-59, `:137`) | K-49 matrisi için kanıt yok. Arşiv paywall'ının kill switch'i yok. Arşiv içeriği 1 Eyl–5 Eki arası `unavailable` (§9 `:245`; bugünkü durum §9'daki "Ek bulgular"da) | `triggerOrchestrator.ts:119-135` | M |
| Accessibility | K-54 keşif raporu var (`docs/a11y/K54_KESIF_RAPORU.md`, 1 Eyl 2026, `b7eefb8`) | Rapordaki bulguların kapanışı bu turda doğrulanmadı. Cihaz maddeleri (J2, O3–O5, A5–A6, L4) işaretsiz | — | M |
| Store | — | Bkz. §7: metadata, ekran görüntüleri, inceleme notu ve IAP tablosu bayat | `docs/LAUNCH_CHECKLIST.md` | M |

### 2. K-56 — TMDB ticari lisansı ve poster/still hakları

| Durum | Referans |
|---|---|
| **Kurucu kararıyla ertelendi** (E-13, 1 Eyl 2026). Yeniden değerlendirme tetiği: "ilk gerçek satış". | `7_…KILIDI.md:553-559` |
| **Çelişki:** sprint dokümanı aynı kalemi "Evet — blocker, hemen başlat" diye yazıyor. | `V1_DESIGN_OS_UYUM_SPRINT.md:548`, `:567` |
| Lisans başvurusu, TMDB yazışması ya da poster/still hakkı yazışması **repoda yok** (kanıt yok). | `grep` taraması: `docs/` |
| Uygulama içi TMDB atıf metni var. Görünürlüğü cihazda doğrulanmadı (checklist L7). | `locales/en.json:326` `tmdbAttribution` |
| JustWatch atfı (`V1_DESIGN_OS_UYUM_SPRINT.md` "lisans şartı" diyor) bu turda doğrulanmadı. | — |
| Not: K-62 teaser'ı TMDb `/original/` backdrop'unu indiriyor (bible `:249`); still kullanımı lisans kapsamına giriyor. | — |

Boyut: **L** (dış bağımlılık, süre bizim kontrolümüzde değil)

### 3. R-B / R-C / R-D sprint durumu

| Sprint / kalem | Bible'daki kayıt | Bu turda ölçülen | Referans |
|---|---|---|---|
| **R-B** | Kapanış kaydı **yok**. §8 satırı yalnız tanım içeriyor, karar günlüğünde de "R-B kapandı" satırı yok. | — | `:1106` |
| **R-C** | **Açık.** v1.9 (31 Ağu): K-46 ve E-09 tamam, G-6 listesi yazıldı; "Kalan: K-49". Sonrasında R-C kapanış kaydı yok. | — | `:1191` |
| **R-D** | **Açık.** Kalemleri §9'a dağılmış ("R-D kalemi" etiketli 10+ satır). | — | `:1108`, `:1124-1162` |
| K-42 / E-11 cihaz doğrulaması | TestFlight'a ertelendi, R-D ön koşulu | Checklist J1 `[ ]`. **Kanıt yok.** | `:537-543`, checklist `:152` |
| Migration 107 | Sprint dokümanı: "Yarım — `event.id` NULL kontrolü bekliyor" | **Canlıda uygulanmış** (`schema_migrations` 107). `winback_queue.rc_event_id` kolonu var. NULL-id Sentry uyarısı kodda (`supabase/functions/revenuecat-webhook/index.ts:344-365`). Partial unique index'in canlıda varlığı ayrıca sorgulanmadı. Sprint dokümanındaki "yarım" ifadesi bayat. | `V1_DESIGN_OS_UYUM_SPRINT.md:544`, `107_winback_queue_rc_event_id.sql:33-35` |
| K-37 | D-13 ile 9 durumlu makine yerine türetme modeli konmuş (5 konum, yeni kolon yok) | Karar kaydı var. Kapanış kaydı yok. | `:117`, `:409` |
| K-43 | — | Hata metni ürün dilinde, kod içermiyor: `gauntlet.loadError` "Today's films couldn't load. Try again." Bible'daki örnek cümle birebir kullanılmamış. "Error 503" kalıbı locale'de yok. | `locales/en.json` (`gauntlet.loadError`) |
| `8_CHOSY_DURUM_DEVRI.md` | 18 Ağu 2026'dan beri güncellenmemiş; R-A…R-D'nin hepsi "⬜ Bekliyor" | Devir dokümanı bayat | `8_…DEVRI.md:3`, `:299-302` |

### 4. Paywall — uzaktan kapatma ve K-49

| Soru | Bulgu | Referans | Boyut |
|---|---|---|---|
| Tetiği kapatan `app_config` bayrağı var mı? | **Yok.** `missed_day_archive` için config anahtarı yok, bu yüzden `isVariantEnabled` her zaman `true` dönüyor. Canlıda arşivle ilgili bir `app_config` anahtarı da yok (ölçüm aşağıda). Tetik `components/gauntlet/ArchiveTrigger/index.tsx:127`'de. | `triggerOrchestrator.ts:119-135` | S (yeni bayrak = DUR NOKTASI) |
| `paywall_profile_upgrade` | DB'de `false`, ama kod bu anahtarı okumuyor (`VARIANT_CONFIG_KEYS` dışında, `remoteConfig.ts:31` SAFE_DEFAULTS'ta kalıntı). Profile CTA'sı bu bayrakla kapanmaz. | `remoteConfig.ts:31`, `triggerOrchestrator.ts:119-122` | — |
| K-49: restore | Kanıt yok. Kodda `restore_attempted`'ın 3 dalı var. | `purchaseService.ts:488,500` | M |
| K-49: expiration / grace / billing issue / refund / revoked | **Kanıt yok.** Sandbox ya da cihaz kaydı bulunamadı. `docs/qa/C0d_webhook_entitlement_audit.sql` bir denetim sorgusu, test sonucu değil. `winback_queue` 0 satır, yani EXPIRATION webhook'u hiç işlenmemiş. | ölçüm aşağıda | M |
| Paywall'da geri gezinme yok | E-11: "R-D öncesi çözülecek". Kapanış kaydı yok, kod bu turda doğrulanmadı. | `TEKNIK_BORC.md` "Unlock the full experience" (~satır 2228) | S |

### 5. Sentry

| Soru | Bulgu | Referans |
|---|---|---|
| Native source map | Sentry Expo plugin üzerinden otomatik geliyor (M1 kaydı). | `app.json:52`, `8_…DEVRI.md:95-96` |
| **OTA bundle source map** | **Otomatik yükleme yok.** Elle çalıştırılan bir script var (`npx sentry-expo-upload-sourcemaps dist`). `.eas/workflows/` altında yalnız `e2e-test.yml` var. Son OTA olan P-6a (`dca2f71`, 6 Eki) için yükleme yapıldığına dair kanıt yok. Borç kaydı açık. | `package.json:64`, `TEKNIK_BORC.md:1895-1906` |
| OTA release eşlemesi | `release = slug@version`, `dist = nativeBuildVersion`. OTA bundle'ı native build ile aynı release/dist'i taşıyor; ayrı bir OTA tanımlayıcısı yok. | `app/_layout.tsx:71-83` |
| Release health | Kodda açık: `enableAutoSessionTracking: true`. Sentry panelinde session verisi geliyor mu, doğrulanmadı. | `app/_layout.tsx:78` |
| Son 7 günde fatal sayısı | **Ölçülemedi — bu oturumda Sentry erişimi yok** (Sentry MCP doğrulanmamış). | — |

### 6. PostHog — G-6 çekirdek 20

Kod taraması (`app components services hooks contexts utils`):

| # | Event | Kodda | Canlı doğrulama (G-6) |
|---|---|---|---|
| 1 | `gauntlet_viewed` | `GauntletShell/index.tsx:472` | kanıt yok |
| 2 | `gauntlet_started` | `:567` | kanıt yok |
| 3 | `choice_submitted` | `:1122` | kanıt yok |
| 4 | `gauntlet_completed` | `:1229` | kanıt yok |
| 5 | `choice_rejected` | `:1284` | kanıt yok |
| 6 | `watched_prompted` | `PendingWatchFeedbackCard/index.tsx:53` | kanıt yok |
| 7 | `watched_confirmed` | `:38` | kanıt yok |
| 8 | `watched_not_yet` | `:40` | kanıt yok |
| 9 | `provider_clicked` | **YOK** — 26 Eyl'den beri gönderilmiyor; ikame kararı CTO'da | **ölçülemez** |
| 10 | `save_for_later` | `ChampionReveal/index.tsx:276` | kanıt yok |
| 11 | `app_launched` | `app/_layout.tsx:365` | kanıt yok |
| 12 | `auth_prompt_completed` | `components/auth/AuthPromptSheet.tsx:74,83` | kanıt yok |
| 13 | `notification_prompt_answered` | `GauntletShell/index.tsx:983`, `NotificationPromptSheet.tsx:65` | kanıt yok |
| 14 | `archive_viewed` | `app/archive.tsx:66` | kanıt yok |
| 15 | `paywall_triggered` | `triggerOrchestrator.ts:275` | kanıt yok |
| 16 | `paywall_viewed` | `ContextualPaywall.tsx:47` | kanıt yok |
| 17 | `paywall_dismissed` | `triggerOrchestrator.ts:312` | kanıt yok |
| 18 | `purchase_started` | `purchaseService.ts:370` | kanıt yok |
| 19 | `purchase_completed` | `purchaseService.ts:380` | kanıt yok |
| 20 | `restore_attempted` | `purchaseService.ts:488,500` | kanıt yok |

**Sonuç:** kodda 19/20 var, doğrulanmış 0/20 (kayıtlı kanıt yok). Prosedür `G6_CEKIRDEK_EVENTLER.md` §3'te tanımlı ama koşulmamış. #9 ölçülemediği sürece 20/20 matematiksel olarak imkânsız; sözleşme değişikliği ya da ikame kararı gerekiyor (CTO). Not: G-6, K-52 değil §7.4 marketing kapısı. K-52 "Data" kapısının bunu kapsayıp kapsamadığı tanımsız (bkz. §1).

### 7. Mağaza

| Kalem | Bulgu | Referans |
|---|---|---|
| App Store Connect durumu (build, inceleme) | **Doğrulanamadı — ASC erişimi yok.** Repoda: `app.json` sürüm 2.1.0, buildNumber 905. Bible: App Store'daki canlı sürüm v1.1.0 build 31 (20 May 2026); 2.1.0 TestFlight'ta (build 902/903 anılıyor). OTA P-6a production kanalı, runtime 2.1.0. | `app.json:5,18`, bible `:1153`, `:1220`, checklist `:382-385` |
| Gizlilik politikası | Notion URL'i (`abalone-dracopelta-382.notion.site/…Privacy-Policy…`). **Sürümü ve tarihi repoda yok.** İçeriğin anonim auth, PostHog, Sentry, K-16 ve RC'yi kapsayıp kapsamadığı doğrulanamadı. | `app/(tabs)/profile.tsx:643`, `components/paywalls/PaywallBase/index.tsx:62-63` |
| Şartlar (Terms) | `www.notion.so/…Terms-of-Service…` (yayımlanmış `notion.site` alanı değil). Herkese açık erişimi doğrulanmadı. Uygulama içinde Terms linki bu taramada bulunamadı. | `docs/LAUNCH_CHECKLIST.md:47-49` |
| Support URL | Geçici olarak gizlilik sayfası kullanılıyor. | `LAUNCH_CHECKLIST.md:49-53` |
| Ekran görüntüleri | Plan mood-search dönemine ait (Mood Input, Swipe Feed, Archetype); bugünkü ürünü göstermiyor. Gauntlet dönemi ekran görüntüsü: **kanıt yok**. R-10 "6 ekranlık anlatı" diyor. | `LAUNCH_CHECKLIST.md:251-259`, bible `:14` (R-10) |
| İnceleme notu | **Bayat ve çelişkili:** "Users sign in with Apple… 6-question taste calibration… Mood tab". K-12 (anonim ilk açılış), K-11 (quiz yok) ve K-01 (2 tab) ile çelişiyor. | `LAUNCH_CHECKLIST.md:297-320` |
| Demo hesap | Yok. "Apple Sign-In kullanılır" varsayımı K-12 sonrası geçersiz. | `LAUNCH_CHECKLIST.md:286-295` |
| IAP | Doküman: weekly $1.99 / monthly $4.99 / yearly $39.99. Bible K-59 (ASC ölçümü, 24 Eyl): $6.99 / $39.99 / $89.99 (lifetime approved, satılmıyor — D-08). Doküman bayat. | `LAUNCH_CHECKLIST.md:32-41`, bible `:137`, `:227-231` |
| Kademeli dağıtım (E-06) | Bible'da tek paragraf. Somut plan (TestFlight alt kümesi, ASC Phased Release, durdurma kriteri): **kanıt yok**. | bible `:509-511` |

### 8. Kurucu mesajı (63 kişi)

| Bulgu | Referans |
|---|---|
| **Taslak yok.** Kalem v1 kapsamından çıkarıldı: R-19, CTO kararı, 26 Eyl 2026, ikame yok. | bible `:470` (R-19), `:1028` |
| `V1_DESIGN_OS_UYUM_SPRINT.md` hâlâ "R-D öncesi, G-9 için kritik" diyor; bayat (G-9 kapatıldı). | `V1_DESIGN_OS_UYUM_SPRINT.md` §9 tablosu |
| "63" sayısı bayat: bugün anonim olmayan auth kullanıcısı **80** (ölçüm aşağıda). | — |

### 9. Açık P0 / P1 listesi

**Resmî "P0/P1" etiketli tek bir liste yok.** `TEKNIK_BORC.md` renk/öncelik kodu kullanıyor, P0/P1 kullanmıyor. `P0-1` yalnız `BUILD_ONCESI_GAUNTLET_KESIF.md`'de geçiyor ve `3fd787f` ile kod düzeltmesi yapılmış; cihaz doğrulaması (checklist C1) yapılmadı. G-7'nin (açık P0/P1 = 0) sayılabilmesi için önce listenin tanımı gerekiyor.

Yüksek öncelikli (🔴 / 🟠 / "Öncelik: yüksek") açık kayıtlar. Statüleri dokümandan alındı; aksi yazmıyorsa kod bu turda doğrulanmadı:

| Kayıt | Release etkisi | Referans |
|---|---|---|
| 🔴 Hesap silme 207 sonrası "dirilen hesap" — kod değiştirilmedi, CTO kararı bekliyor | App Review 5.1.1(v) riski | `TEKNIK_BORC.md` (~satır 3386) |
| 🟠 RevenueCat webhook fail-open | **Doküman bayat:** kod artık fail-closed (`revenuecat-webhook/index.ts:117-135`). Deploy edilen sürümün bu kodu içerdiği bu turda diff ile doğrulanmadı. | `TEKNIK_BORC.md:1503-1530` |
| Paywall'da geri gezinme yok | "R-D öncesi" denmiş | `TEKNIK_BORC.md` (~2228) |
| 🔴 `slot-mood-filtered` `body.user_id` taklidi | Rulet üç katmanda kapalı (`games_enabled.roulette=false`); fonksiyon canlı mı, doğrulanmadı | `TEKNIK_BORC.md:749` |
| 🔴 `recommend/index.ts:338-346` SCRAM/ASCII | Kapsamı belirsiz diye yazılmış | `TEKNIK_BORC.md:1365` |
| 🔴 `getAppUserId()` INSERT yapabiliyor | — | `TEKNIK_BORC.md:1085` |
| 🔴 75 `.update()` çağrısının 63'ü kör | Bible §9: "v1 sonrası" | `TEKNIK_BORC.md:1129`, bible `:194` |
| 🔴 23 Nis–8 Ağu kohort ölçümleri geçersiz | Tarihsel, release'i etkilemiyor | `TEKNIK_BORC.md:1024` |
| Global slot / Vault anahtarı (bible §9 "Açık, P0 ile bağlı") | **Bible bayat olabilir:** canlıda `global` satırı 2026-10-06'da HTTP 200 ile yazılmış. 1 Eyl–5 Eki boşluğu kalıcı. | bible `:245-247`, ölçüm aşağıda |

---

## Ölçülmüş sayılar

| Ölçüm | Değer | Sorgu |
|---|---|---|
| Uygulanmış migration'lar ≥ 104 | 104…**126** dahil hepsi uygulanmış (107 dahil) | `select version, name from supabase_migrations.schema_migrations where version >= '104' order by version` |
| ⚠️ Bu dalın `supabase/migrations/` klasörü | en yüksek **124**. 125 (`game_scores_user_fk`) ve 126 (`search_films_ranking`) canlıda var, bu dalda dosyası yok (başka dallarda: `fix/game-scores-fk`, `fix/search-ranking`) | `ls supabase/migrations` |
| `winback_queue` kolonları | `id, user_id, churned_at, processed, processed_at, created_at, rc_event_id` | `information_schema.columns` |
| `winback_queue` satır | **0** | `select count(*), max(created_at) from public.winback_queue` |
| `auth.users` toplam / anonim / anonim olmayan | **314 / 234 / 80** | `select count(*) … from auth.users [where is_anonymous]` |
| `subscriptions` dağılımı | `active/annual` ×2 (1'i `expires_at` geçmiş, 1'i NULL), `active/monthly` ×1 (`expires_at` NULL), `trial/weekly` ×2 (NULL). Hepsi `chosy_plus` | `select status, plan, entitlement_id, expires_at > now(), count(*) from public.subscriptions group by 1,2,3,4` |
| `choice_events` son 7 gün | **8** | `count(*) where created_at > now()-interval '7 days'` |
| `daily_gauntlets` son tarih | personal **2026-10-06**, global **2026-10-06** | `select scope, max(date) from public.daily_gauntlets group by scope` |
| `net._http_response` son 3 gün | 1 satır, 2026-10-06 00:05 UTC, **200**, `"created":true` | `select status_code, left(content::text,80), created from net._http_response where created > now()-interval '3 days'` |
| `app_config` paywall/arşiv anahtarları | `paywall_lifetime_enabled=false`, `paywall_lifetime_soldout=false`, `paywall_profile_upgrade=false`, `paywall_roulette_limit=false`, `paywall_streak_milestone=false` (çıktının devamı kesildi). `games_enabled={"games":["spotlight"],"roulette":false}`. Arşiv kill switch anahtarı yok. | `select key, value, updated_at from app_config where key ilike '%paywall%' or key ilike '%archive%' or key ilike '%games_enabled%'` |

Not: aktif abonelik satırlarının gerçek satış mı, test mi, eski kohort mu olduğu ayrıştırılmadı. E-13'ün "ilk gerçek satış" tetiğinin gerçekleşip gerçekleşmediği bu veriyle söylenemez.

---

## DUR NOKTASI gerektiren maddeler

1. **K-52 kapı tanımları.** Altı kapının her biri için kabul kriteri ve G-1…G-8 ile ilişkisi (bible değişikliği, CTO).
2. **Arşiv paywall'ı için kill switch.** Yeni `app_config` anahtarı + okuyucu = yeni bayrak, mimari karar.
3. **K-56.** E-13 ertelemesi ile sprint dokümanının "blocker" ifadesi çelişiyor. Hangisinin geçerli olduğu kurucu/CTO kararı.
4. **G-6 #9 `provider_clicked`.** İkame (`watch_now_tapped`?) ya da sözleşmeyi 19'a indirme; 20/20 sözleşme değişikliği.
5. **Hesap silme 207.** Bekleyen-silme bayrağı çözüm yönü auth koduna dokunuyor; CTO kararı bekliyor.
6. **OTA source map pipeline.** Yeni workflow pattern (`TEKNIK_BORC.md:1903` "ayrı DUR NOKTASI").
7. **P0/P1 tanımı.** G-7'nin sayılabilmesi için resmî liste ve sınıflandırma.

## Doğrulanamayanlar

- **Sentry:** 7 günlük fatal sayısı, crash-free oranı (G-1), release health verisi, OTA source map yüklemesi. Bu oturumda Sentry erişimi yok.
- **App Store Connect:** canlı build, inceleme durumu, IAP durumu, Phased Release ayarı, App Privacy etiketleri. Erişim yok.
- **PostHog:** event'lerin canlı gelişi (G-6). Erişim yok.
- **RevenueCat dashboard:** K-49 matrisi, webhook teslim geçmişi. Erişim yok.
- **Gizlilik politikası ve Terms içeriği:** dış Notion sayfaları okunmadı.
- `revenuecat-webhook` deploy edilen sürümünün repo koduyla aynı olup olmadığı (download diff yapılmadı).
- Migration 107 partial unique index'inin canlıda varlığı (yalnız kolon sorgulandı).
- `docs/a11y/K54_KESIF_RAPORU.md` bulgularının sonradan kapanıp kapanmadığı.
- Paywall geri gezinme eksikliğinin bugünkü kodda sürüp sürmediği.
