# MONEY-1C — Cihaz test listesi (Faz 2, istemci)

Tarih: 25 Eki 2026 · Dal: `feat/money-1c` · Elle test içindir; render altyapısı olmadığı için
davranışsal doğrulama yalnız cihazda yapılır (testler kaynak-regresyon düzeyinde).

## 0. Hazırlık (bu build için)

### 0.1 Build
- **Profil:** `preview-store` (kanal `preview`, dağıtım store → TestFlight internal). Production
  kanalına/branch'ine hiçbir şey gitmez; OTA gerekmez (build JS'i içinde taşır).
- **ÖNCE `eas.json` düzeltmesi gerekir:** `preview-store` / `preview` profillerinde `autoIncrement`
  yok. `appVersionSource: remote` olduğundan sayaç tek ve ortak: şu an iOS buildNumber **912**
  (production 2.1.2'nin son gönderilen numarası). Düzeltme yapılmadan alınan build 912'yi yeniden
  kullanır ve App Store Connect yüklemeyi reddeder. Öneri: `preview-store` bloğuna
  `"autoIncrement": true` (sonraki numara 913). `preview-e2e` kendi `autoIncrement: false`'ını korur.
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
- Bu dalda `mood_offer_enabled` satırı `app_config`'te YOKTUR → kapalı; `mood_offer_testers` de yoktur.
  İki satır bayrak değil veri: SQL editor / service role ile (migration DEĞİL):
  ```sql
  INSERT INTO app_config (key, value, description)
  VALUES ('mood_offer_testers', '["<AUTH_USER_ID>"]'::jsonb, 'MONEY-1C test kimlikleri')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  ```
- Değer en geç 5 dk'da yansır; hızlandırmak için uygulamayı tamamen kapatıp aç. Aynı cihazda iki test
  hesabı kullanacaksan ikisini de listeye koy (dizi).
- **Genel açma YAPMA:** `mood_offer_enabled` satırını `true` yapmak production'daki herkese açar.
  Bu test için dokunulmaz.
- Geri alma: `UPDATE app_config SET value = '[]'::jsonb WHERE key = 'mood_offer_testers';`

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

## Sonuç notları

Her madde için: geçti / kaldı / not. Başarısızlıkta ekran görüntüsü + PostHog olay zamanı + varsa
Sentry linki ekle.
