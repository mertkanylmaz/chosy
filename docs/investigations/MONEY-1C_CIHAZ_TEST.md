# MONEY-1C — Cihaz test listesi (Faz 2, istemci)

Tarih: 25 Eki 2026 · Dal: `feat/money-1c` · Elle test içindir; render altyapısı olmadığı için
davranışsal doğrulama yalnız cihazda yapılır (testler kaynak-regresyon düzeyinde).

## 0. Hazırlık

- **Build:** `preview-store` profili (kanal `preview`, TestFlight internal) — production'a ulaşmaz.
  Ayrıntı için rapora bak (kanal → branch eşlemesi `eas channel:view preview` ile doğrulanmalı).
- **Bayrak:** bu dalda `mood_offer_enabled` satırı `app_config`'te YOKTUR → kapalı sayılır.
  Yalnız kendi hesabın için açmak: `app_config.mood_offer_testers` = jsonb dizi, içinde
  **`auth.users.id`** (Supabase Auth → Users, ya da PostHog/RevenueCat'te görünen kimlik).
  Anonim hesap kullanma: yeniden kurulumda kimlik değişir (D8). Değer en geç 5 dk'da yansır;
  hızlandırmak için uygulamayı tamamen kapatıp aç.
  ```sql
  INSERT INTO app_config (key, value, description)
  VALUES ('mood_offer_testers', '["<AUTH_USER_ID>"]'::jsonb, 'MONEY-1C test kimlikleri')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  ```
  Geri alma: `UPDATE app_config SET value = '[]'::jsonb WHERE key = 'mood_offer_testers';`
- **Hesap durumları:** (a) ücretsiz gerçek hesap, (b) Pro/premium hesap, (c) `legacy_mood_access`
  hesabı, (d) varsa anonim hesap. Her bölümde ilgili hesapla tekrarla.
- **Gözlem:** PostHog Live events (kendi kimliğin), gerekirse Sentry.

## A. Bayrak KAPALI (tester listesi boş/kimlik dışında) — regresyon

Hiçbir MONEY-1C yüzeyi görünmemeli, eski davranış aynen sürmeli.

- [ ] Gauntlet: açılış, 4 film, 3 tur, şampiyon — akış eskisi gibi.
- [ ] Şampiyon ekranı: **davet kartı YOK**; Spotlight kartı yerinde.
- [ ] Spotlight oyunu + sonuç ekranı: **davet kartı YOK**, eylemler eskisi gibi.
- [ ] Deste (discover) çıkış ×: teklif/paywall YOK, doğrudan tabs'e dönüyor.
- [ ] Deste özeti → kapat: teklif YOK.
- [ ] Deste özeti → "yeni mood": teklif YOK.
- [ ] Sistem geri tuşu (Android) / iOS kenar kaydırma: teklif YOK, çıkış normal.
- [ ] Pro Mode girişi: ücretsiz hesapta eski kilitli ekran; premium/legacy hesapta doğrudan giriş.
- [ ] Mood arama: ücretsiz sayaç eski AsyncStorage kotasıyla çalışıyor; hak bitince eski kota duvarı.
- [ ] Mood arama: **1 karakter** yazınca gönder pasif (bayraktan bağımsız yeni kural, bilinçli).
- [ ] Profil ekranı açılıyor, Pro durumu doğru, "Chosy Pro" CTA'sı eskisi gibi.
- [ ] Uçak modu + soğuk açılış: gauntlet/profil takılmıyor; Sentry'de `REMOTE_CONFIG_HYDRATE_FAILED`
      mount başına DEĞİL, en fazla birkaç kez (geri çekilme: 30 sn → 5 dk).
- [ ] PostHog: hiçbir `mood_invite_*`, `mood_offer_*`, `mood_search_free_*` olayı YOK.

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
- [ ] Hak bittikten sonra aramada `mood_offer` paywall'ı (entry `quota_exhausted`) açılır; deneme vaadi
      yalnız uygun kullanıcıda ("7 gün ücretsiz"), değilse fiyatlı teklif.
- [ ] **503** (kota servisi): çevrilmiş "tekrar dene" mesajı, paywall YOK, hak harcanmadı.
- [ ] **400** (geçersiz girdi): çevrilmiş mesaj.
- [ ] **429**: teklif açılır; premium kullanıcıda açılmazsa eski kota duvarı.
- [ ] AI rızasını reddet/geri çek: arama yapılmaz; `mood_search_free_started` ATILMAZ.
- [ ] Erişim yüklenirken (uygulamayı yeni açıp hemen ara) premium/legacy hesapta `mood_search_free_*` ATILMAZ (B-3).
- [ ] Onboarding aramasında teklif/ücretsiz arama olayı yok.

### B3. Teklif zamanlaması (deste)
- [ ] **Deste sonu:** son kart kaydırılınca ~700 ms sonra teklif açılır (`deck_end`).
- [ ] **Deste ortası ×:** teklif açılır (`deck_exit`), kapatınca çıkış devam eder, ekran takılı kalmaz.
- [ ] Deste sonunda teklif görüldüyse sonra çıkışta **ikinci teklif YOK**; aynı arama için tek teklif.
- [ ] Teklifi kapat → çıkış sürer. Teklif üzerinden satın alma → çıkış sürer (premium).
- [ ] **Çift dokunuş (B-2):** teklif açılırken × / geri tuşuna hızlıca ikinci kez bas — ikinci çıkış yok
      sayılır, çift pop/çift `dismissTo` olmaz, ekran açıldıktan sonra beklenmedik geri gitme olmaz.
- [ ] **Sistem geri / iOS kenar kaydırma:** tek teklif, çift pop yok. `beforeRemove` + `dismissTo`
      cihazda DOĞRULANMADI — özellikle bu yolu dikkatle izle.
- [ ] **Yükleniyor / hata / boş deste (B-1):** iskelet ekranda, hata ekranında ve boş sonuçta geri/× →
      çıkış NORMAL geçer, teklif açılmaz ve harcanmaz; sonra aynı aramanın gerçek destesinde teklif hâlâ çıkar.
- [ ] **Yeni mood (B-4):** teklif açıkken arka planda ek yükleme/hata/titreşim olmuyor; teklif kapanınca
      yeni mood ekranına geçiliyor.
- [ ] Deste kaydetme: ücretsiz arama destesinde sağa kaydırma slot kotası duvarına takılmaz (C8).
- [ ] PostHog: `mood_offer_shown`/`mood_offer_dismissed` teklif başına **bir** çift; `mood_offer_cta`
      yalnız satın alma dokunuşunda (hata sonrası tekrar denemede tekrar atılır — B-8, bilinen).
      `paywall_shown` çift gelirse not et (B-7).

### B4. Bayrak geri kapatma
- [ ] Listeden kimliği çıkar, uygulamayı kapat-aç (5 dk bekle ya da yeniden başlat): tüm yüzeyler
      kaybolur, bölüm A'daki davranışa dönülür.

## Sonuç notları

Her madde için: geçti / kaldı / not. Başarısızlıkta ekran görüntüsü + PostHog olay zamanı + varsa
Sentry linki ekle.
