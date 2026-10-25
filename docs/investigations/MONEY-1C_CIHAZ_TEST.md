# MONEY-1C — Cihaz test listesi (Faz 2, istemci)

Tarih: 25 Eki 2026 · Dal: `feat/money-1c` · Elle test içindir; render altyapısı olmadığı için
davranışsal doğrulama yalnız cihazda yapılır (testler kaynak-regresyon düzeyinde).

## 0. Hazırlık (bu build için)

### 0.1 Build
- **Profil:** `preview-store` (kanal `preview`, dağıtım store → TestFlight internal). Production
  kanalına/branch'ine hiçbir şey gitmez; OTA gerekmez (build JS'i içinde taşır).
- **`eas.json` (güncel, 25 Eki):** `preview-store` `autoIncrement: true` taşıyor (71f592f ile geldi; bu dalda da var).
  `appVersionSource: remote` olduğundan sayaç tek ve ortak: uzaktaki son iOS buildNumber **914**
  (`eas build:version:get -p ios -e preview-store`), sonraki build **915** olur. `preview-e2e` kendi `autoIncrement: false`'ını korur.
- **SÜRÜM SORUNU (karar bekler):** bu dalın `app.json` sürümü **2.1.2**; 2.1.2 App Store'a çıktı (production #912), bu yüzden
  aynı sürüm için TestFlight build'i reddedilir (kapanmış train). 24 Eki'de bu yüzden #913 (2.1.2 preview-store) sonrası geçici
  **2.1.3** (#914, `build/preview-2.1.3`, `44849a9`) alındı; o commit bu dalın atası DEĞİL. Build'den önce sürüm 2.1.3 (veya üstü)
  olmalı — bkz. `MONEY-1C_BUILD_PREP.md` §3. runtimeVersion politikası `appVersion` → runtime = sürüm; 2.1.3 için hiçbir kanalda OTA yok,
  yani build kendi gömülü JS'ini çalıştırır (istenen durum).
- **Aynı uygulama:** bundle id `com.chosy.ai`, ASC uygulaması 6761782987 — production ile aynı. TestFlight
  build'i cihazdaki App Store sürümünün yerine geçer (build numarası daha yüksek olduğu için).
- **Aynı backend ve servisler:** EAS `preview` ortamındaki tüm `EXPO_PUBLIC_*` değerleri (Supabase URL/anon
  key, PostHog host/key, Sentry DSN, RevenueCat iOS key, Google client id'leri, TMDb) `production`
  ortamıyla **birebir aynı**. Yani test production verisi üzerinde koşar: gerçek kota, gerçek kullanıcı
  tablosu, production PostHog ve Sentry projeleri. RevenueCat satın almaları TestFlight'ta sandbox'tır.
- Kanal doğrulaması: `preview` kanalı yalnız `preview` branch'ine (son update `release/2.1.0-rc5`,
  runtime 2.1.0), `production` kanalı yalnız `production` branch'ine bağlı; ikisi %100 eşli, farklı branch
  id'leri, ikisi de duraklatılmamış. Yeni 2.1.2 preview build'i production update'lerini almaz.

### 0.2 Kimliğini (`auth.users.id`) bulmak
Tester listesi `auth.users.id` ister. Uygulamada bu id'yi gösteren ekran YOK; Sentry'de `setUser`
çağrılmıyor (Sentry user.id yok). PostHog `distinct_id` yalnız anonim OLMAYAN hesaplarda auth id'ye
eşittir; anonim hesapta rastgele PostHog id'sidir — güvenilir yol değil.

**En kolay yol (gerçek hesap):**
1. Profil ekranında hesabının e-postasına bak (Apple "Hide My Email" ise yönlendirme adresi görünür).
2. Supabase → Authentication → Users → e-postayla ara → **User UID** (= `auth.users.id`). Ya da SQL:
   ```sql
   select id, email, is_anonymous, created_at from auth.users where email = '<EPOSTA>';
   ```
3. Doğrula: `select auth_id, id as app_user_id from public.users where auth_id = '<UID>';` satırı dönmeli
   (`public.users.id` değil, `auth_id` olan listeye girer).
Anonim hesapla test etme: yeniden kurulumda kimlik değişir (D8).

### 0.3 Bayrağı yalnız kimliğin için açmak
- **Güncel canlı durum (25 Eki export'u):** `mood_offer_enabled = false` ve `mood_offer_testers = ["a25917c2-7476-41ea-a7fb-3ffecccf03e6"]`
  satırları ZATEN VAR (bu belgenin önceki hali "satır yok" diyordu — eskimiş). Aşağıdaki `ON CONFLICT … SET value = EXCLUDED.value`
  mevcut listeyi EZER; önce mevcut değeri oku, kimliğini EKLE:
  ```sql
  select value from app_config where key = 'mood_offer_testers';
  UPDATE app_config SET value = value || '["<AUTH_USER_ID>"]'::jsonb WHERE key = 'mood_offer_testers';  -- ekleme; yinelenen kimlik zararsız
  ```
  Satır silinmişse (nadir) şu form: 
  ```sql
  INSERT INTO app_config (key, value, description)
  VALUES ('mood_offer_testers', '["<AUTH_USER_ID>"]'::jsonb, 'MONEY-1C test kimlikleri')
  ON CONFLICT (key) DO NOTHING;
  ```
- Değer en geç 5 dk'da yansır; hızlandırmak için uygulamayı tamamen kapatıp aç. Aynı cihazda iki test
  hesabı kullanacaksan ikisini de listeye koy (dizi).
- **Genel açma YAPMA:** `mood_offer_enabled` satırını `true` yapmak production'daki herkese açar.
  Bu test için dokunulmaz.
- Geri alma: yalnız EKLEDİĞİN kimliği çıkar: `UPDATE app_config SET value = value - '<AUTH_USER_ID>' WHERE key = 'mood_offer_testers';`
  (`'[]'` ile sıfırlama başka testerın kimliğini de siler — `a25917c2-…` mevcut girdidir, dokunma.)

### 0.4 Hesap durumları ve gözlem
- **Hesaplar:** (a) ücretsiz gerçek hesap, (b) Pro/premium hesap, (c) `legacy_mood_access` hesabı,
  (d) varsa anonim hesap. Her bölümde ilgili hesapla tekrarla.
- **Gözlem:** PostHog Live events (production projesi — kendi kimliğinle filtrele), gerekirse Sentry
  (production projesi; aynı DSN). Bu build'in olayları gerçek metriklere karışır: test olaylarını
  tarih/saat ve kimlikle ayırt et.

## A. Bayrak KAPALI (tester listesi boş/kimlik dışında) — regresyon

Hiçbir MONEY-1C yüzeyi görünmemeli, eski davranış aynen sürmeli.

- [ ] Gauntlet: açılış, 4 film, 3 tur, şampiyon — akış eskisi gibi.
- [ ] Şampiyon ekranı: **davet kartı YOK**; Spotlight kartı yerinde.
- [ ] Spotlight oyunu + sonuç ekranı: **davet kartı YOK**, eylemler eskisi gibi.
- [ ] Deste (discover) çıkış ×: teklif/paywall YOK, doğrudan tabs'e dönüyor.
- [ ] Deste özeti → kapat: teklif YOK.
- [ ] Deste özeti → "yeni mood": teklif YOK.
- [ ] Sistem geri tuşu (Android) / iOS kenar kaydırma: teklif YOK, çıkış normal.
- [ ] **Kilit kartı YOK:** 8 filmlik deste tamamen açık, sayaç "n / 8" normal ilerler; 4.–8. poster önceden yüklenir.
- [ ] **"Today's search" kartı ve "Today's free search · N picks" satırı YOK.**
- [ ] Görünen metinde "Pro Mode" yerine "Mood Search" (profil/pro-mode başlığı); rota ve davranış aynı.
- [ ] Pro Mode girişi: ücretsiz hesapta eski kilitli ekran; premium/legacy hesapta doğrudan giriş.
- [ ] Mood arama: ücretsiz sayaç eski AsyncStorage kotasıyla çalışıyor; hak bitince eski kota duvarı.
- [ ] Mood arama: **1 karakter** yazınca gönder pasif (bayraktan bağımsız yeni kural, bilinçli).
- [ ] Profil ekranı açılıyor, Pro durumu doğru, "Chosy Pro" CTA'sı eskisi gibi.
- [ ] Uçak modu + soğuk açılış: gauntlet/profil takılmıyor; Sentry'de `REMOTE_CONFIG_HYDRATE_FAILED`
      mount başına DEĞİL, en fazla birkaç kez (geri çekilme: 30 sn → 5 dk).
- [ ] PostHog: hiçbir `mood_invite_*`, `mood_offer_*`, `mood_search_free_*`, `mood_lock_*`, `mood_deck_unlocked` olayı YOK.

## B. Bayrak AÇIK (kimliğin tester listesinde)

### B1. Davet kartları
- [ ] Şampiyon ekranında Spotlight kartının ALTINDA davet kartı görünür; Spotlight kartı yerinden oynamadı.
- [ ] Spotlight sonuç ekranında kart eylemlerin altında görünür.
- [ ] **Küçük ekran** (iPhone SE/mini ya da eşdeğeri): hero sıkışmıyor, kart sığmıyorsa gizleniyor
      (taşma/kesilme yok). `CHAMPION_BODY_ESTIMATE=260` KALİBRE DEĞİL — burada ölçülen yüksekliği not et.
- [ ] Yazı boyutu büyütülünce (fontScale > 1.3) Spotlight kartı gizleniyor.
- [ ] Premium hesapta kart HİÇ görünmez; legacy hesapta görünür (`access: legacy`, politika açık soru).
- [ ] Karta dokununca `/pro-mode`'a gidiyor.
- [ ] PostHog: `mood_invite_shown` oturumda yüzey başına **bir kez** (ekranı kapat-aç, sığma değişimi,
      geri gel → tekrar atılmıyor); `mood_invite_tapped` her dokunuşta.

### B2. Arama ve kota
- [ ] Giriş: 1 karakter gönderilemez; 2 karakter gönderilir.
- [ ] Ücretsiz arama başarılı: sonuç gelir, deste açılır.
- [ ] Hak bitince: Pro Mode "Bugünlük ücretsiz aramaların bitti" ekranı; süre biliniyorsa
      "… sonra yeniden ücretsiz arama" metni; limit sayısı metinde YOK.
- [ ] Hak bittikten sonra aramada `mood_offer` paywall'ı (entry `quota_exhausted`, başlık "Ready for another
      search?") açılır; deneme vaadi yalnız uygun kullanıcıda ("7 gün ücretsiz"), değilse fiyatlı teklif.
- [ ] **503** (kota servisi): çevrilmiş "tekrar dene" mesajı, paywall YOK, hak harcanmadı.
- [ ] **400** (geçersiz girdi): çevrilmiş mesaj.
- [ ] **429**: teklif açılır; premium kullanıcıda açılmazsa eski kota duvarı.
- [ ] AI rızasını reddet/geri çek: arama yapılmaz; `mood_search_free_started` ATILMAZ.
- [ ] Erişim yüklenirken (uygulamayı yeni açıp hemen ara) premium/legacy hesapta `mood_search_free_*` ATILMAZ (B-3).
- [ ] Onboarding aramasında teklif/ücretsiz arama olayı yok.

### B3. Deste kilidi ve kilit kartı (Faz 2b — deste sonu/çıkış teklifi KALDIRILDI)
Deste sonu ve çıkış teklifi artık YOK: × / geri / yeni mood / özet kapat hiçbir koşulda teklif açmaz.

- [ ] Ücretsiz hesap, `free_visible_count` = 3 (varsayılan), 8 filmlik deste: ilk 3 kart normal kaydırılır;
      3. karttan sonra **kilit kartı** ("There's more to this mood." · "3 of 8" ·
      "See all 8 with Chosy Pro" · "Your first 3 are yours to keep.").
- [ ] Sayaç kilitte **"3 / 8" olarak donar**; kilit kartında kaydırma yok (swipe tepki vermez).
- [ ] **Gizli poster YOK:** kilit kartında gerçek poster görünmüyor, yalnız stilize silüetler; arkadaki
      katmanda 4. filmin posteri sızmıyor (kilide yaklaşırken, hızlı kaydırınca da).
      Ağ izleme (Charles/Proxyman) mümkünse: 4.–8. filmin poster URL'leri **indirilmedi**.
- [ ] `free_visible_count` = 1 ve = 7 dene (app_config; ≤5 dk gecikme): 1 → 1 kart + kilit; 7 (hidden 1) →
      **kilit YOK**, deste tamamen açık. Geçersiz değer (`"x"`, 0, 99) → güvenli aralığa çekilir.
- [ ] Kalite süzgeci 8'den az film bıraktığında (ör. 6): `hidden = 6 − 3 = 3 ≥ 2` → kilit, metin "6" der;
      5 filmde `hidden = 2` → kilit; 4 filmde `hidden = 1` → kilit yok.
- [ ] Kilit CTA → `mood_offer` paywall'ı (başlık "Keep exploring this mood."); kapatınca **kilit kartına
      dönülür**, deste kaybolmaz, ekran çıkışı yok.
- [ ] Paywall metni: "Every pick in every search" / "Search again, whenever you want" / "Explore films for any
      mood" / "Your nightly 4 films stay free."; **sabit "8" ve "Unlimited" yok**; deneme vaadi yalnız uygun hesapta.
- [ ] Satın alma (sandbox) veya **Restore** sonrası kilit **kendiliğinden** açılır (4. kart kaydırılabilir);
      `mood_deck_unlocked` search_id başına **bir kez** (kapat-aç, tekrar restore → ikinci olay YOK).
- [ ] Yetki okunurken (uygulamayı yeni açıp hemen desteye gir): kilit yerinde kısa **iskelet**, kilit kartı
      yanlış çakmıyor; premium hesapta kilit hiç görünmüyor.
- [ ] Premium/legacy hesap: kilit YOK, tüm deste açık (bayrak açık olsa da).
- [ ] Mood arama girişinde ücretsiz hesapta: "Today's free search · 3 picks included" satırı; premiumda yok.
- [ ] Deste kaydetme: ücretsiz arama destesinde sağa kaydırma slot kotası duvarına takılmaz (C8).
- [ ] PostHog: `mood_lock_viewed` (kilit ekrana gelince), `mood_lock_tapped` (CTA), `mood_deck_unlocked`;
      hepsinde `search_id`, `entry_point`, `is_pro`, `consent`. `mood_deck_started`'ta `film_ids` (≤8, sıralı) +
      `deck_size`. Hiçbir olayda **mood metni / anahtar kelime metni** yok.

### B3b. Bugünkü deste kurtarma (P0, yalnız cihaz)
- [ ] Başarılı aramadan sonra Mood Search'e dön (× ile çıkış): üstte **"Today's search"** kartı (metin + film sayısı).
- [ ] Karta dokun: deste **aynı sırayla** açılır, yükleme/AI işlemi ekranı YOK; hesabı etkileyen yeni arama
      sayılmaz (kota düşmez — `get_quota_status` ile doğrula; PostHog/Supabase'de yeni `mood_searches` satırı YOK).
- [ ] Uygulamayı **tamamen kapat-aç**: aynı gün kart hâlâ orada.
- [ ] "Son aramalar"da bugünkü aramaya dokun: **yeni arama başlamaz**, aynı deste açılır.
- [ ] Gün değişimi (cihaz saatini ertesi güne al) veya hesap değişimi: kart görünmez, eski deste açılmaz.
- [ ] Kurtarılan destede kilit durumu premiumStatus'a göre yeniden hesaplanıyor (ücretsiz: kilit; premium: açık).
- [ ] Bayrak KAPALI: kart HİÇ görünmez, AsyncStorage'a deste yazılmaz.
- [ ] Karta dokunup deste açılınca PostHog'da **`mood_deck_resumed`** (search_id, entry_point=`today_deck`, deck_size) atılır; **`mood_deck_started` ATILMAZ**. Yeni arama yapınca `mood_deck_started` yine atılır.
- [ ] **"Today's free search" ipucu** yalnız kalan hak ≥ 1 iken görünür: ücretsiz hak kullanıldıktan sonra Mood Search'e dönünce ipucu KAYBOLUR (hak 0); ağ yokken / hak okunamazken görünmez.
- [ ] Hak bitince Pro kilit ekranında "Unlimited with Pro" yalnız bayrak AÇIKKEN; bayrak KAPALIYKEN eski "Chosy Pro" düğmesi aynen durur.

### B3c. Aynı arama kimliği ve satın alma sonrası arama (Faz 2b-g; sunucu 139 + parse-mood DEPLOY EDİLMİŞ olmalı)
> Sunucu tarafı deploy edilmeden bu bölüm koşulmaz: eski parse-mood `client_search_id`'yi yok sayar (kota her istekte düşer).
- [ ] Aynı metni art arda 2 kez ara (ilk arama başarılı bitsin): iki arama da ayrı hak sayılır (yeni kimlik). Kota `get_quota_status` ile 2 düşer.
- [ ] Ağı kes, ara (timeout/ağ hatası), ağı aç, AYNI metinle tekrar ara: hak yalnız 1 düşer (`mood_searches` tek satır, `status=completed`).
- [ ] Hızlı çift dokun / iki cihaz: ikinci istek "Aramanın hazırlanması sürüyor" (409 IN_PROGRESS) görür ya da otomatik beklenip aynı sonucu alır; ikinci hak düşmez.
- [ ] Ücretsiz hak bitince ara: Pro teklifi açılır (`mood_offer_shown`, entry `quota_exhausted`). Satın al → arama **otomatik** çalışır,
      "Pro etkinleştiriliyor…" görünür (en çok ~30 sn), sonuç gelir; teklif ikinci kez AÇILMAZ.
- [ ] Hız sınırı (1 dk içinde 10+ istek) ve rerank günlük sınırı: paywall AÇILMAZ; hız sınırında "bekle" mesajı, rerank sınırında deste rerank'siz gelir.
- [ ] Satın alma ekranında Apple "zaten satın alınmış" derse: hata gösterilmez, otomatik restore çalışır, "Purchases restored" görünür.
- [ ] Satın alma sırasında Sentry'de `REACT-NATIVE-C` / `REACT-NATIVE-16` türü hata ÇIKMAZ (istemci tabloya yazmaz; 2.1.3 ve sonrası).
- [ ] `paywall_plan_selected.source`: Mood Search kilit ekranından açılan paywall'da `pro_mode_locked`, Profil sekmesinden `profile_tab`,
      kilit kartından `lock_card`, hak duvarından `quota_exhausted`.

### B3d. Sil-yeniden-kur + Restore (g3; yalnız TestFlight/Sandbox hesabıyla)
Risk: trial/abone kullanıcı uygulamayı siler, yeniden kurar → yeni anonim Supabase kimliği → Restore → RevenueCat aboneliği eski
kimlikten yeniye TRANSFER eder. Sandbox'ta webhook "TRANSFER hedefi çözülemedi (rc_anonymous)" görüldü (CHOSY-EDGE-FUNCTIONS-14).
- [ ] Sandbox hesabıyla trial başlat → uygulamayı SİL → yeniden kur → onboarding/anonim giriş → paywall → **Restore**.
- [ ] Beklenen: "Purchases restored"; birkaç sn içinde Mood Search açık (Pro). Supabase'de YENİ kimliğin `users.subscription_tier` ve `subscriptions`
      satırı dolu (sync-entitlement yazar; webhook'a bağlı DEĞİL).
- [ ] Restore'u kimlik hazır olmadan çok erken bas: "Account not ready" mesajı (anonim RC kimliğinde restore ÇALIŞMAZ); biraz bekleyip tekrar → başarılı.
- [ ] RevenueCat dashboard → Project settings → **"Restore behavior / transfer"**: "Transfer to new App User ID" olmalı. "Keep with original" ise
      yeni kimlik aboneliği ALAMAZ ("restoreEmpty") — kodla çözülemez, ayar değişmeli.
- [ ] Sentry'de bu testte `RC_ACTIVE_DB_MISSING` / `ENTITLEMENT_SYNC_*` çıkarsa not al.

### B4. Bayrak geri kapatma
- [ ] Listeden kimliği çıkar, uygulamayı kapat-aç (5 dk bekle ya da yeniden başlat): tüm yüzeyler
      kaybolur, bölüm A'daki davranışa dönülür.

## C. ESKİ İSTEMCİ (2.1.2 App Store / 2.1.3 TestFlight) + sunucu 139–142 sonrası regresyon

Sunucu değişiklikleri (139 şema/yetki, 140, parse-mood v43, 141, 142) eski istemciyi bozmamalı. **Sıra önemli:** bu bölüm yeni
TestFlight build'ini kurmadan ÖNCE, cihazda hâlâ eski sürüm varken koşulur (TestFlight build'i App Store sürümünün yerine geçer, geri
dönüş zor). 26 Eki smoke A (Bölüm A, runbook) bunun ilk ayağıdır; aşağıdakiler cihazda tamamlayıcıdır. Her madde için `<users.id>` =
test hesabının `public.users.id`'si.

### C1. Arama (parse-mood v43, 139/140) — eski akış imzası
- [ ] Ücretsiz hesapla bir mood araması yap: sonuç gelir, deste açılır, hata yok.
- [ ] `mood_searches` en yeni satırı: `client_search_id` NULL, `status` NULL, `quota_consumed` false, `claim_attempts` 0, öneri listesi dolu
      (runbook smoke A.1). Eski istemci yeni kolonları DOLDURMAZ.
- [ ] `user_daily_quotas.searches_used` tam **+1** (A.2). 0 ya da +2 görülürse R3: DUR.
- [ ] Aynı aramayı hemen tekrar yap: ikinci ayrı satır + searches_used +1 daha (eski istemcide idempotency YOK, beklenen davranış; çift düşmeyi hata sayma).
- [ ] Sonuç satırı UPDATE'i yazıldı (`recommended_film_ids`, `rpc_version` dolu): istemcinin `mood_searches` INSERT'i yalnız `{user_id}`,
      UPDATE'i `{recommended_film_ids, rpc_version[, error_code]}` — K-1 ile daraltılmış kolon yetkisinin içinde. Sentry'de
      `QUOTA_SEARCH_RECORD_FAILED` / "mood_searches UPDATE failed" / 42501 **çıkmamalı** (R1).
- [ ] Anthropic zaman aşımı: yavaş ağda arama 25 sn civarında "tekrar dene" mesajıyla biter (maxRetries 0, onaylı davranış değişikliği); takılı kalmaz.
- [ ] Ücretsiz hak (eski istemci yerel sayacı, 3) bitince eski kota duvarı; 2.1.2'de ücretsiz hesap Pro Mode'a girince **hard paywall** (bilinen, FAZ3 §8).

### C2. Sunucu kotası ile uyum (bayrak KAPALI iken sunucu limiti hâlâ 3)
- [ ] `subscription_limits.free.daily_search_limit` hâlâ **3** (Faz 3 öncesi): eski istemci 3 arama yapabilir; 4.'de sunucudan `QUOTA_EXCEEDED` / istemci duvarı.
      (Limit 1'e inmişse C2 koşulmaz — Faz 3 başlamıştır; bkz. FAZ3_ROLLOUT §7.)
- [ ] Kota satırı gece yarısı (UTC) sıfırlanır; cihaz saati değiştirilince sunucu günü değişmez.

### C3. 141 sonrası (tablo yetkileri) — okuma yolları sağlam
- [ ] Soğuk açılış: `app_config` okunur (bayrak/`remoteConfig` hydrate; Sentry `REMOTE_CONFIG_HYDRATE_FAILED` YOK).
- [ ] Paywall/abonelik ekranı: planlar ve limitler yüklenir (`subscription_limits`, `promo_codes` SELECT), "permission denied" yok.
- [ ] Profil → Pro durumu, ücretli (premium) hesapta doğru; satın alma/Restore (sandbox) hâlâ çalışır (istemci `subscriptions`/`lifetime_sales`'e yazmıyor).
- [ ] Gauntlet, watchlist ekleme/çıkarma, izlendi işareti: hata yok (141 yalnız TRUNCATE/REFERENCES/TRIGGER'ı kaldırır; DML etkilenmez).

### C4. 142 sonrası (promo/lifetime fonksiyonları)
- [ ] Promo kodu girme/uygulama akışı (varsa ekran): eski istemci `increment_promo_usage`'ı doğrudan ÇAĞIRMAZ (tarama: çağıran yok); kod uygulanır, hata yok.
- [ ] `paywall_lifetime_enabled` kapalı olduğundan lifetime satın alma yüzeyi görünmez; görünüyorsa DUR (142 `claim_lifetime_spot`'ı yalnız service_role çağırır).
- [ ] Sentry'de `permission denied for function` YOK.

### C5. Hesap silme (R7: 140 sonrası service_role DELETE)
- [ ] Test hesabıyla hesabı sil (Ayarlar): işlem tamamlanır; `mood_searches`/`user_daily_quotas`/`watchlist` o kullanıcının satırları kalkar
      (`select count(*) from mood_searches where user_id='<users.id>'` → 0). `delete-account` edge log'unda hata YOK.

### C6. OTA'lı eski çalışma zamanları (2.1.0 / 2.1.1)
- [ ] (Cihaz varsa) 2.1.1 App Store build'i: açılışta OTA bulunur/indirilir (`ota_update_found`/`ota_update_fetched`), ikinci soğuk açılışta uygulanır;
      arama eski akışla çalışır. 2.1.0 için aynı. (Bkz. `MONEY-1C_BUILD_PREP.md` §5; OTA ilk açılışta uygulanmaz.)

## Sonuç notları

Her madde için: geçti / kaldı / not. Başarısızlıkta ekran görüntüsü + PostHog olay zamanı + varsa
Sentry linki ekle.
