# V-1 TestFlight Checklist — toplu cihaz oturumu

> Oluşturma: 28 Eyl 2026 (V-1 Tur 8). Sahip: Kurucu (cihaz). Karar kaydı:
> `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` v1.31 §5 E-22.
> **28 Eyl 2026 (V-3 Tur G3) eki:** K ve L bölümleri — V-3 gauntlet + şampiyon
> görsel retrofiti, karar kaydı bible **v1.32 §5 E-23** (V3-D1…V3-D7).
> **30 Eyl 2026 eki:** M bölümü — Cinema DNA v1'de gizli (`isCinemaDnaEnabled`,
> bible v1.33 K-47). E1, F2, F4 bu karar ile geçersizleşti (üstü çizili).
> Kaynak: V-1 turlarının commit'leri + bible §9'daki cihaz bekleyen kalemler.
> Senaryolar **gerçekte uygulanan** davranışa göre yazıldı; sprint v1'de planlanıp
> uygulanmayanlar (bildirim CTA'sı, Settings tek switch, dünkü şampiyon kartı,
> Streak) **test edilmez** — en altta listelidir.

## Ön koşullar

- [ ] Build: `eas build --platform ios --profile preview --auto-submit` — **preview /
      preview-store**. `__DEV__` ve `preview-e2e` build'lerinde 18:00 kapısı hep açık,
      `before_18` **oluşmaz** (bible §9, E-19/P0-1 satırı).
- [ ] Build `f8f2e6d` ve sonrasını içeriyor (geri sayım, E-21, P0-1 `3fd787f`).
- [ ] K/L için build `9dd6b34` ve sonrasını içeriyor (V-3 G1 + G2).
- [ ] Auth: Supabase Email provider açık + `{{.Token}}` şablonları eklenmiş (yoksa
      K-14 testi kırmızı çıkar).
- [ ] Test için iki cihaz saati penceresi: yerel **18:00 öncesi** ve **sonrası**.

Her madde: ✅ geçti · ❌ kırmızı (ekran görüntüsü + saat + build no) · ⏭ yapılamadı.

---

## A. Bekleme ekranı + geri sayım (V-1 Tur 6, `f8f2e6d`, V1-D7, V1-D9)

Mevcut kullanıcı, yerel 18:00 öncesi.

- [ ] A1. Ekran: "18:00'de hazır" metni + altında Martian Mono geri sayım. Başka
      buton/link yok (arşiv, Pro Mode, keşif, dünkü şampiyon **yok** — V1-D7).
- [ ] A2. Sayaç saniye saniye akıyor, Home'un geri kalanı titremiyor.
- [ ] A3. Uygulamayı arka plana al, ≥2 dk bekle, geri dön → sayaç duvar saatine
      atlıyor (geride kalmıyor).
- [ ] A4. Sayaç sıfırlanınca (17:59'da aç, bekle) → iskelet/yükleme → bugünün
      gauntlet'i. Hata ekranına düşmüyor, ikinci kez yüklemiyor.
- [ ] A5. **Reduce Motion** açık → saniye hanesi gizli, dakika akıyor.
- [ ] A6. **VoiceOver** → sayaç "2 saat 49 dakika" biçiminde okunuyor.
- [ ] A7. Dil TR ↔ EN → saat biçimi ve metin dile uyuyor.
- [ ] A8. PostHog: `waiting_viewed` bir kez, `minutes_to_unlock` dolu.

## B. Day-0 — yeni kullanıcı 18:00 öncesi (E-21, bible §9 "E-21 istemci cihaz doğrulaması")

- [ ] B1. Temiz kurulum, 18:00 öncesi, onboarding bitir → **önceki döngünün
      gauntlet'i** geliyor; ilk savaş ≤ ~3 sn hedefi (SONHALİ §8). Süreyi not et.
- [ ] B2. Önceki döngüyü 3 tur oyna → şampiyon görünür.
- [ ] B3. Şampiyondan sonra uygulamayı kapat-aç → bekleme ekranı (A1), şampiyon
      tekrar gösterilmez (reveal yalnız o oturumda).
- [ ] B4. Uçak modunda temiz kurulum 18:00 öncesi → bekleme ekranı, **hata ekranı
      değil**.
- [ ] B5. Önceki döngüde 3. turu çevrimdışı seç, bağlantıyı aç → şampiyon görünür.
- [ ] B6. Önceki döngü ortasında çevrimdışı kapat-aç → sunucuya sorar, kaldığı
      yerden devam.
- [ ] B7. 18:00 geçişinde uygulama açıkken → bugünün döngüsüne geçer.
- [ ] B8. Mevcut kullanıcı (cache'i olan) 18:00 öncesi açılış → **ağ çağrısı yok**,
      doğrudan bekleme ekranı.
- Bilinen boşluklar (kırmızı sayılmaz, gözlem yaz): son seçim çevrimdışı + uygulama
  kapatılırsa açılışta şampiyon gösterilmez; cache'i olmayan mevcut kullanıcı bir
  kez iskelet + 409 görür.

## C. P0-1 — bekleme ekranında bağlantı dönüşü (`3fd787f`)

- [ ] C1. 18:00 öncesi bekleme ekranında **elle** uçak modu aç → kapat → ekran
      bekleme ekranında kalır, gauntlet yüklenmez.
- [ ] C2. Gauntlet ortasında (18:00 sonrası) uçak modu aç, seçim yap, kapat →
      bekleyen seçim flush edilir (K-42 korunuyor).

## D. Zaman dilimi — UTC anahtar ayrışması (bible §9, M2 Faz 2b)

- [ ] D1. Cihaz saat dilimi `America/New_York`, 18:00–20:00 EDT arası → gauntlet
      oyna.
- [ ] D2. Aynı akşam 20:00 EDT sonrası uygulamayı kapat-aç → **gözlem:** ikinci
      gauntlet geliyor mu? (Bilinen R-D kalemi — kırmızı değil, sonucu kaydet.)
- [ ] D3. 20:00 EDT sonrası çevrimdışı açılış → "Bu bugünün listesi değil"
      uyarısı çıkıyor mu? (Bilinen — sonucu kaydet.)

## E. Abonelik durumu — `premiumStatus` (V-1 Tur 1, V1-D3)

- [ ] E1. Free kullanıcı: Profile'da Chosy Plus CTA'sı ~~ve Cinema DNA paywall
      sarmalayıcısı~~ görünür. _(30 Eyl: DNA bölümü v1'de gizli — bkz. M1.)_
- [ ] E2. Sandbox abonelik al → Profile'da upsell/CTA **yok**, "Chosy Plus"
      rozeti var.
- [ ] E3. Soğuk açılışta (abonelik çözülürken) Profile'a hızlı gir → upsell
      **anlık bile yanıp sönmüyor**.
- [ ] E4. Ücretli kullanıcı: arşiv tetikleyicisine dokun → paywall açılmaz, arşiv
      açılır. Loading anında dokunuş no-op.
- [ ] E5. Ücretli kullanıcı Pro Mode'da 4+ arama → 429 yok, "N left today" yok
      (sınırsız, migration 117).
- [ ] E6. Görünen ad her yerde **"Chosy Plus"** (Profile, Pro Mode kilitli ekran,
      kota hata metni). "Pro Mode" yalnız özellik adı olarak.

## F. Profile (V-1 Tur 2, K-08 sapması)

- [ ] F1. Kullanıcı adı altında `#XXXXXXXX` ID satırı **yok**.
- [ ] F2. Bölüm sırası: ~~**Cinema DNA →**~~ **Watched → Saved → Üyelik**; Settings
      başlıktaki dişli. _(30 Eyl: DNA bölümü v1'de gizli — bkz. M1.)_ Streak **yok** (bilinçli, E-22). Discovery Stats **yok**.
- [ ] F3. Her bölüm başlığı **bir kez** (çift başlık yok).
- ~~F4. Cinema DNA: başlık "Sinema DNA"/"Cinema DNA"; yetersiz veride
      "Birkaç akşam daha, zevkini tanıyacağım." — "swipe" kelimesi yok.~~
      _(30 Eyl: geçersiz — DNA bölümü v1'de gizli, bkz. M1. Test edilmez.)_
- [ ] F5. Watched: 0 izlenen → davet kopyası; ≥1 → sayı (`loved`/`ok`/`abandoned`
      sayılır, `not_watched`/`skipped` sayılmaz). Uçak modunda açılış → bölüm
      **hiç çizilmiyor** (sahte 0 yok).
- [ ] F6. Arketip adı (varsa) Archivo Expanded; Dynamic Type en büyükte taşma
      gözlemi (bilinen: `maxFontSizeMultiplier` yok — TEKNIK_BORC).
- [ ] F7. "Kurucu Üye"/"Founding Member" rozeti dile göre.

## G. Avatar (V-1 Tur 3, V1-D8)

- [ ] G1. Modal: 9 Phosphor duotone glif, marquee renk, charcoal zemin.
- [ ] G2. Seçili kart beam kenarlı; etiketler kesilmiyor (2 satır).
- [ ] G3. "Seç" butonu mevcut avatarla aynı seçimde **disabled**, farklı seçimde aktif.
- [ ] G4. Build öncesi eski bir avatar seçmiş kullanıcı → güncellemeden sonra aynı
      avatar glif olarak görünür (eski anahtar taşındı).
- [ ] G5. Aynı cihazda hesap değiştir → ikinci hesap birincinin avatarını
      **görmüyor**.
- [ ] G6. Hesap sil → yeniden kurulumsuz yeni hesapta eski avatar yok.
- [ ] G7. Profile başlığında Phosphor (avatar/düzenle/Apple) ile Ionicons
      (abonelik elması) yan yana — **gözlem**, Tur 8 tarama bulgusu.

## H. Pro Mode (V-1 Tur 7, V1-D11)

- [ ] H1. Mood kartları mevcut renk/gradient'lerini koruyor (K-31 istisnası).
- [ ] H2. Kart alt metni okunaklı (bone@70%), en koyu ve en açık kartta.
- [ ] H3. Mood seçilmemiş: CTA graphite zemin + altında "Bir ruh hali seç".
- [ ] H4. Mood seçili: CTA bone dolgu + ink metin, glow/shimmer yok; basışta hafif
      haptik.
- [ ] H5. Free kullanıcı: "N left today" yalnız kalan ≤ 10 iken (free limit 3 →
      her zaman görünür); limit dolunca mevcut kota akışı.
- [ ] H6. Üst arama çubuğu gönder butonu hâlâ eski accent dolgu — **gözlem**
      (bilinen, TEKNIK_BORC).

## I. Tipografi — Playfair tasfiyesi (V-1 Tur 7, V1-D10)

> V-3 notu: V1-D10 **kısmen geri alındı** (V3-D1) — serif gauntlet'teki film
> adlarında geri döndü (K3, L3). Bu bölüm film adı **dışındaki** metinler için
> geçerli.

- [ ] I1. Film detay: başlık ve puan SF Pro (serif yok), puan rakamları hizalı.
- [ ] I2. Watchlist detay, rulet (başlık + puan), boş/hata durumları, yükleme
      ekranı kelime markası: serif yok, ağırlık ince düşmemiş.
- [ ] I3. Paylaşım kartları ve Profile başlıkları 600 ağırlıkta (400'e düşmemiş).
- [ ] I4. Spotlight başlığı SF Pro 600.
- [ ] I5. Açılış süresinde regresyon yok (Playfair 6 ağırlık hâlâ yükleniyor —
      bilinen).

## J. Sprint v1 Tur 8 tablosundan devralınanlar

- [ ] J1. **K-42 / E-11** — offline queue-and-freeze, 8 senaryo (bible E-11).
- [ ] J2. **K-54** — A11y: Reduce Motion, VoiceOver, radio plan kartları (paywall).
- [ ] J3. **R-A** — R-A-1 + R-A-2 bekleyen toplu test.
- [ ] J4. **K-14** — e-posta magic link (ön koşul: Email provider + şablon).
- [ ] J5. **E-19** — `submit-choice` editoryal guard'ı (`editorial_day`) gerçek
      cihazda: editoryal günde ret → açık metin, algoritmik yedek yok.

## K. Tur ekranı retrofiti (V-3 Tur G1, `682b793` `6389234` `2b89338`, V3-D1/D2/D7)

- [ ] K1. Bağlam pill'i: solda ikon + büyük harfli, harf aralıklı özet + chevron;
      kenar **graphite** (altın değil); yükseklik ≥44pt. Dokununca bağlam sheet'i
      eskisi gibi açılıyor.
- [ ] K2. Uzun bağlam (TR, en uzun gün + kiminle) → baştaki kısım kısalıyor, sondaki
      "· süre" **asla kesilmiyor**; süre pill'de kısa karşılıkla.
- [ ] K3. Poster başlıkları **Playfair (serif)**, ortalı, 2 satıra kadar; tek satırlık
      başlıkta iki poster aynı hizada (2 satırlık yer ayrılıyor). Meta
      "1994 · 142 MIN" ortalı, Martian Mono.
- [ ] K4. Tur göstergesi: 3 nokta + altında "1 / 3"; tur ilerledikçe güncelleniyor.
      VoiceOver "Round 1 of 3" / TR karşılığı okuyor.
- [ ] K5. Soru metni SF Pro (serif **değil**), bone@80%.
- [ ] K6. "İkisi de değil" / "İzledim" iki eşit genişlikte outline buton (≥44pt,
      graphite kenar, dolgu yok); "Boşver, yarın" altta metin bağlantısı.
      Disabled kuralları ve haptikler önceki davranışla aynı.
- [ ] K7. Yükleme iskeleti: gerçek ekranla aynı yerleşim — iskelet → içerik
      geçişinde zıplama yok.
- [ ] K8. iPhone SE (<700pt yükseklik): üst boşluk küçülüyor, eylemler tab bar'ın
      üstünde, kaydırma gerekmeden görünüyor.
- [ ] K9. Home tab ikonu **film** (seçiliyken dolu), aktif rengi **marquee**;
      Profile ikonunun aktif rengi değişmemiş. Discover gizli.
- [ ] K10. Mantık regresyonu yok: 3 tur seçim, "ikisi de değil" yedek çekme
      (editoryal günde açık metin), çevrimdışı seçim kuyruğu (K-42) önceki gibi.

## L. Şampiyon ekranı retrofiti (V-3 Tur G2, `0b4de00` `e40cbaf` `9dd6b34`, V3-D1…D6)

- [ ] L1. Poster tam genişlik hero (~ekranın %60'ı), alt yarısı siyaha eriyor;
      etiket + başlık geçişin üstünde okunaklı — **en açık posterli** filmde de
      (ör. beyaz afiş).
- [ ] L2. Etiket "TONIGHT'S FILM"; önceki döngüde (Day-0, B bölümü) "YOUR FIRST
      FILM". VoiceOver aynı ayrımı okuyor.
- [ ] L3. Başlık **Playfair (serif)**; uzun adda 40 → 32 → 28 kademesi, en fazla 3
      satır, taşma yok.
- [ ] L4. **Reduce Transparency** açık → geçiş yok, sert kenar + düz siyah zemin.
- [ ] L5. Poster yüklenemezse (uçak modu + önbelleksiz) → charcoal zemin + yer
      tutucu, boş/çökük ekran yok.
- [ ] L6. Sağlayıcı satırı en fazla **3 logo**; sıralama abonelik (stream) önce,
      sonra ücretsiz/reklamlı, kiralık, satın al. Logolar **dokunulmaz**.
- [ ] L7. >3 sağlayıcıda "See all" / "Tümü" → sheet: Stream / Rent / Buy grupları,
      satırlar dokunulmaz, TMDB atfı görünür; kapatma çalışıyor.
      PostHog: `providers_see_all_opened` (`film_id`, `region`, `provider_count`).
- [ ] L8. **Watch now / Şimdi izle** düz marquee dolgu, siyah metin, gradient yok →
      uygulama içi tarayıcıda TMDB'nin bölge sayfası açılıyor, kapatınca şampiyon
      ekranına dönülüyor. PostHog: `watch_now_tapped` (`film_id`, `cycle`,
      `region`, `provider_count`).
- [ ] L9. Sağlayıcısı olmayan film / bölge belirlenemedi → Watch now **hiç yok**
      (gri buton da yok); "Sonraya bırak" bone dolgulu birincil.
- [ ] L10. Sonraya bırak ve Paylaş önceki gibi çalışıyor (kaydet → Saved'da görünür;
      paylaş → metin/pano). Kapat altta sessiz bağlantı.
- [ ] L11. Marquee ekranda **yalnız** Watch now'da (logo satırı, etiketler, diğer
      butonlar altın değil).
- [ ] L12. "Bugünün bonusu" Spotlight kartı kaydırmanın **sonunda**, satır içi —
      yüzmüyor, içeriğin üstüne binmiyor; kart yalnız şampiyon varken var.
- [ ] L13. Son içerik tab bar'ın altında kalmıyor (alt dolgu); bayat gösterge
      (K-42, çevrimdışı açılış) hero'nun üstünde, durum çubuğunun altında görünüyor.
- [ ] L14. Dil TR ↔ EN: tüm yeni metinler (Watch now, See all, sheet başlığı,
      gruplar, hata mesajı) çevrilmiş.

## M. Cinema DNA v1'de gizli (30 Eyl 2026, `6786031` `e73b1a5` `2ca8365` `aaaaac8` `74208e8`, bible v1.33 K-47)

Build `74208e8` ve sonrasını içermeli.

- [ ] M1. Profile: "Cinema DNA"/"Sinema DNA" başlığı ve kartı **yok**; free
      kullanıcıda o alana dokunuş paywall açmıyor (sarmalayıcı da yok). Sıra:
      arketip kartı (varsa) → Watched → Saved → Üyelik.
- [ ] M2. Profile → Saved: poster şeridi ve "N film" sayısı **hâlâ doluyor**
      (kaynak `getWatchlist()`, DNA getter'ından bağımsız). Boş watchlist'te boş
      durum kopyası. Watched sayısı da hâlâ geliyor.
- [ ] M3. Gauntlet sonrası hesap bağlama sheet'i (anonim kullanıcı): gövde metni
      EN "Your streak and watchlist are saved here — free, no subscription
      needed." / TR "Streak'in ve izleme listen burada kayıtlı — ücretsiz,
      abonelik gerekmez." — "taste profile"/"tat profili" **yok**.
- [ ] M4. Settings, **arketipi olmayan** kullanıcı (temiz kurulum): "Share My
      Archetype" / "Arketipimi Paylaş" satırı **yok**; üst/alt satırlar arasında
      boşluk/çift ayraç kalmıyor.
- [ ] M5. Settings, **arketipi olan** (eski quiz'li) hesap: satır var, dokununca
      paylaşım sayfası açılıyor, "I'm a <arketip adı>" gidiyor (Mystery Cinephile
      **değil**). Gözlem: mesaj dile bakmadan İngilizce — bilinen, ayrı kalem.
- [ ] M6. Spotlight'ı bitir (çözülmüş ve çözülememiş iki durum) → sonuç ekranında
      "+N XP" rozeti var, "Cinema DNA Updated" / "Sinema DNA Güncellendi" ve
      "+ Consistency" çipi **yok**.
- [ ] M7. Paywall (bağlamsal + Profile "Chosy Pro" CTA'sı): "taste evolves" /
      DNA vaadi yok; kaçırılan akşamı arşivden oynama anlatılıyor (`e73b1a5`).
- [ ] M8. Dil TR ↔ EN: M3–M7 metinleri her iki dilde doğru.

## N. Şampiyon CTA + Spotlight kartı (S-2, 3 Eki 2026; S-1 ask sırasıyla birlikte)

Build S-2 commit'ini ve sonrasını içermeli. Geometri Deno testli
(`tests/gauntlet/championFold.test.ts`); **8 sn dwell tetiği cihaz doğrulaması
bekliyor** (N4). Ask'i yeniden görmek için o günün ask kaydı temiz olmalı
(`chosy_ask_state` — yeni kurulum ya da ertesi gün).

- [ ] N1. Eylemler: Watch now tek tam genişlik buton; altında ortalı iki ikon
      (yer imi = Sonraya bırak, paylaş). Watch now yoksa Sonraya bırak bone
      dolgulu birincil, ikon satırında yalnız paylaş. Kaydedince yer imi dolu
      çiziliyor, sönük değil; VoiceOver "Saved/Kaydedildi" okuyor.
- [ ] N2. Canlı final: reveal bitiminden ~1 sn sonra Spotlight kartı **opaklıkla**
      beliriyor (kesme değil). Kart: bugünün karesi bulanık (oyun başındaki
      bulanıklıkla aynı), "TODAY'S BONUS · Spotlight" + "Guess the film from a
      blurred frame · 6 tries" + PLAY. Uygulamayı kapat-aç (resume) → kart
      **gecikmesiz, animasyonsuz** orada.
- [ ] N3. **Reduce Motion** açık → kart reveal biter bitmez anında, geçişsiz.
- [ ] N4. **Dwell (Metro/`__DEV__` log)** 844pt+ cihazda, kaydırmadan bekle →
      log: `[S-2 dwell] spotlight kartı mount edildi` ardından
      `[S-2 dwell] ask gösterildi … msSinceCardMount ≈ 8000`. PostHog
      `ask_shown` `trigger: 'dwell'`. Kart mount olmadan önce sayaç başlamıyor
      (msSinceCardMount reveal süresini içermiyor).
- [ ] N5. SE / mini: kart ilk ekranda kısmen görünüyor (SE ≥ %30); kaydırıp
      bırakınca 8 sn sonra ask (kabul edilen davranış).
- [ ] N6. Spotlight'ı yarıda bırak → champion'a dön → kart CONTINUE + "Yarıda
      bıraktın…"; uygulamayı öldür-aç → hâlâ CONTINUE. Çöz → "Çözdün. Yarın
      yeni bir kare.", fiil yok; dokununca sonuç ekranı, yeniden oynatma yok.
      Kaybet → "Bu sefer olmadı…".
- [ ] N7. Gauntlet turları sırasında ve bekleme ekranında Spotlight'a dair hiçbir
      iz yok.
- [ ] N8. PostHog: `spotlight_card_viewed` (`game_id`, `state`, `resumed`,
      `window_height`) mount başına bir kez; `spotlight_card_pressed`
      (`game_id`, `state`); oyun tarafında `game_daily_opened` /
      `game_daily_completed` `game_id: 'spotlight'` değişmeden geliyor.
- [ ] N9. Dil TR ↔ EN: kart metinleri ve a11y ipucu çevrilmiş; uzun TR alt başlık
      2 satırda, kart yüksekliği değişmiyor.
- [ ] N10. **Spotlight sonuç posteri (P-1a).** Build P-1a commit'ini içermeli.
      Akira günü (2026-10-03) ya da o günün bulmacası: oyunu bitir (kazan ya da
      hakları tüket) → sonuç ekranında poster **yükleniyor**, boş kutu ya da
      film şeridi yer tutucusu değil. Uygulamayı öldür-aç → kart üzerinden
      sonuç ekranı yeniden açılınca poster yine yükleniyor (resume yolu,
      `get-daily-challenge`). Sentry'de `component:ResultCard` uyarısı ve
      `games.result_poster` breadcrumb'ı **yok**. Poster URL'i w780 (canlıda
      sunucu `original` veriyor; Deno testi dönüşümü doğruluyor, cihaz yalnız
      yüklenmeyi doğrular).
      ⚠️ P-2 (`e29d6a1`) içeren build'de Spotlight sonucu poster **çizmez**
      (`hidePoster`, kare çizilir) — bu build'de N10 yerine N11 geçerli. N10'un
      poster kontrolü P-2 öncesi build içindir.
- [ ] N11. **Spotlight 16:9 kare + sonuç reveal + geri (P-2).** Build
      `2155e1a`, `e29d6a1`, `e2518a7` commit'lerini içermeli. Beau Travail
      günü (2026-10-04) ya da o günün bulmacası:
      - Oyun ekranında kutu 16:9; Beau Travail'de sağdaki figür (baş + gövde)
        kutunun **içinde**, kare yanlardan kırpılmıyor.
      - **SE ve büyük ekranda (Pro Max) aynı kare** görünüyor — yalnız ölçek farkı.
      - SE: harf klavyesi + arama kutusu ekranda; iki satırlık başlıkta üst bölge
        ~5pt kayabilir (geometri testi), aksiyon barı itilmiyor.
      - Bitir — üç yol ayrı ayrı: tahminle kazan · harfle hakları tüket · yanlış
        tahminle hakları tüket → sonuç ekranında aynı kutu bitiş anındaki
        bulanıklıktan **netleşerek akıyor** (~600ms), boş kare/flaş yok; poster yok.
        Film adı ResultCard'da önceki gibi beliriyor.
      - Uygulamayı öldür-aç → kart üzerinden sonuç: kare **animasyonsuz net**.
      - **Reduce Motion** açık → bitişte kare anında net.
      - Sonuç ekranında **Watch Tonight** butonu ekran içinde (SE dahil,
        kaydırmadan ya da en az P-2 öncesi kadar yukarıda).
      - Buton etiketi EN "Back" / TR "Geri". Kart girişinde → champion'a dönüyor.
        **Bildirim girişinde** (geçmiş yok) → Home'a (`/(tabs)`) gidiyor, ölü buton yok.
      - Share Score görselinde kare de poster de yok (değişmedi).
- [ ] N12. **GameShell alt payı (P-2e).** Build `87ac952` commit'ini içermeli.
      iOS'ta KAV `padding` modu alt payı eziyordu; pay iç View'a alındı,
      `keyboardVerticalOffset` iOS'ta −bottomPad. Spotlight oyun ekranında:
      - **Face ID'li iPhone:** arama kutusunun alt kenarı ana ekran çubuğundan
        **ayrı** — çubuk kutunun üstünde değil (önce: kutu ekran altına ~9pt).
        SE'de kutu ekran altından ~16pt yukarıda (8 GameShell + 8 ekran payı).
      - Arama kutusuna dokun → **260pt (QuickType açık) ve 216pt (QuickType
        kapalı)** klavyede kutu klavyenin **hemen üstünde**; arada ana ekran
        çubuğu kadar (~34pt) fazladan boşluk yok, kutu klavyenin altında kalmıyor.
      - Ayarlar › Erişilebilirlik › Hareket › **Prefer Cross-Fade Transitions**
        açıkken aynı adım: kutu klavyenin altında kalıyor mu? (RN bu modda
        klavye payını 0 hesaplıyor — B öncesi de aynı; sonucu yaz, düzeltme ayrı iş.)
      - Sonuç ekranında en alta kaydır: içerik ana ekran çubuğunun üstünde
        bitiyor, altta gradyan boşluğu (~34pt) var; kırık/düz renk şerit yok.
      - **Android:** edge-to-edge — arama kutusu gezinme çubuğunun üstünde,
        klavye açılınca klavyenin hemen üstünde; çift boşluk ya da örtüşme yok.
- [ ] N13. **Spotlight arama listesi (P-3).** Build `fix/spotlight-search`
      dalının `d69438f`, `1e4e6e6`, `a3cbee7` ve P-3c `26be223`, `e6adfda`
      commit'lerini içermeli. Her madde
      **SE ve büyük ekranda (Pro Max)** ayrı ayrı; oynanmamış bir günde başla
      (hak harcanır — yeni hesap ya da yeni gün):
      - **Klavye açıkken satıra dokun** → tahmin **gidiyor** (hak sayacı değişir
        ya da oyun biter), liste ve klavye kapanıyor. Tek dokunuş yetiyor; ilk
        dokunuş "yutulup" yalnızca klavyeyi kapatmıyor. (Tuzak — en önemli madde.)
      - **Dışarı dokun** (klavye açık, liste açık) → klavye **ve** liste
        kapanıyor; liste klavyesiz ekranda asılı kalmıyor. Ayrı ayrı dene:
        karenin/maskenin açıkta kalan kısmı · üst bölge ile harf klavyesi
        arasındaki boşluk · "Hangi film?" etiketi · (varsa) hata kutusu ·
        **denenmiş (sönük) harf tuşu**. **Header HARİÇ:** başlık/ilerleme
        çubuğuna dokunmak klavyeyi kapatmaz — bilinçli (GameShell'e dokunulmadı),
        ❌ sayılmaz. Görünür (denenmemiş) harf tuşuna dokunmak harfi gönderir,
        listeyi kapatmaz — beklenen.
      - **Üst bölgeyi sürükle** (kareyi yukarı/aşağı çek, klavye açık) → klavye
        ve liste kapanıyor. **Listeyi kaydırmak** ise listeyi/klavyeyi
        KAPATMIYOR (4+ sonuçla dene).
      - **Kapat** satırı listenin altında (input'a bitişik), EN "Close list" / TR
        "Listeyi kapat"; dokununca liste kapanıyor, yazılan metin ve klavye
        kalıyor. Yazmaya devam → liste yeniden açılıyor.
      - **B3 kararı için gözlem — SE + QuickType (260pt):** 4+ sonuçlu listede
        Kapat satırı **görünüyor mu** (kırpılmış/eksik değil), input'tan ayrı bir
        satır olarak **fark ediliyor mu**? Ekran görüntüsü al; Pro Max'te de.
        Sonuç B3'ü (Kapat'ı listenin üstüne taşıma) belirler.
      - **X + hızlı yazma:** 2 harf yaz ve 300 ms dolmadan X'e bas → liste boş
        input'un üstünde **yeniden açılmıyor**. Aynısını yavaş ağda tekrarla
        (ağ bağlantı koşullandırıcı / zayıf hücresel).
      - 4+ sonuçta **kaydırma göstergesi** görünüyor; liste kaydırılırken satır
        yanlışlıkla seçilmiyor.
      - **Aynı yanlış filme tekrar:** yanlış bir film tahmin et → tekrar ara → o
        film listede **soluk** ve "Denendi"/"Tried" etiketli; dokununca hiçbir
        şey olmuyor, **hak düşmüyor**, liste açık kalıyor. Uygulamayı öldür-aç
        → aynı film hâlâ "Denendi" (sunucu geçmişinden).
      - **Harf tuşlarına dönüş:** liste açıkken harf tuşları örtülü (bilinen,
        TEKNIK_BORC). Kapat ya da dışarı dokunuşla liste kapanınca 26 tuşun
        hepsi dokunulabilir; harf tahmini çalışıyor.
      - VoiceOver: denenmiş satır "<film>, Tried" okunuyor, düğme devre dışı.
      - Dondurulmuş oyun yok (app_config); FilmSearchInput'un eski davranışı
        yalnız birim testiyle (`npm run test:film-search` regresyon bloğu) korunuyor.
- [ ] N14. **Spotlight "NEXT PUZZLE" sayacı sonraki 18:00'e (P-4a).** Build
      `fix/spotlight-search` dalının P-4a commit'ini içermeli. Bitmiş bir
      Spotlight'ın sonuç ekranını aç (kazan ya da kaybet; yeniden açılan bitmiş
      oyun da olur):
      - 18:00 **sonrası** (ör. 21:30): sayaç ≈ `20:30:xx` — ertesi gün 18:00'e
        sayıyor. Gece yarısına (≈ `02:30`) sayıyorsa ❌.
      - 18:00 **öncesi** (ör. 10:00): sayaç ≈ `08:00:xx` — aynı gün 18:00.
      - Saniye her saniye azalıyor; uygulamayı arka plana alıp 1 dk sonra dön →
        sayaç duvar saatine göre doğru (1 dk düşmüş).
      - Bilinen (TEKNIK_BORC "Spotlight gün sınırı"): bulmaca hâlâ **00:00'da**
        değişir. 00:00 sonrası Spotlight'ı açınca yeni bulmaca gelmesi bu maddede
        ❌ sayılmaz.
- [ ] N15. **Spotlight yarıda bırak → geri dön (P-3d).** Sunucu `get-daily-challenge`
      v32 canlıda (4 Eki 2026); build `78fd0c9`'u içermeli. Oynanmamış bir günde:
      - 2–3 harf dene (en az 1 isabet, 1 ıska), 1 yanlış film tahmin et → kalan hakkı
        not al (ör. "3 left"). Uygulamayı **öldür**, yeniden aç, Spotlight'a gir:
        - **Maske:** isabet harfleri doğru pozisyonlarda açık, diğer kutular boş.
        - **Tuşlar:** denenmiş harfler işaretli (isabet altın, ıska sönük).
        - **Kalan hak:** öldürmeden önceki sayıyla aynı (6 değil).
        - **Bulanıklık:** öldürmeden önceki seviyede (açılan harf oranına göre).
        - Yanlış tahmin edilen film aramada "Denendi" (N13).
      - **Denenmiş harfe bas** → tuş devre dışı, hiçbir şey olmuyor; **hata kutusu
        ÇIKMIYOR** (eskiden LETTER_ALREADY_TRIED → hata kutusu).
      - Yeni bir harf dene → sayaç ve maske kaldığı yerden devam ediyor.
      - Harfle **kazan**, sonuç ekranındaki "Found it with N letters" sayısını not al;
        öldür-aç → **aynı N** (eskiden 0). Hiç harf denemeden filmi bilirsen EN
        "Got it without trying a single letter!" / TR "Hiç harf denemeden buldun!".
      - Sentry: bu akışta `SPOTLIGHT_PROGRESS_FIELDS_MISSING` ve
        `spotlight_progress_malformed` olayı **yok**.
- [ ] N16. **Spotlight sonuç ekranı + arama ipucu (P-6a).** OTA: `production` / iOS /
      runtime 2.1.0, grup `12d91cec-0fd9-4d2a-9de4-c626e153db6b`, commit `dca2f71`
      (6 Eki 2026). Geri dönüş hedefi: `c2068ed1-8153-484c-a64e-1eebb6baa171`
      (P-3c/P-3d, `3f8ce18`). Uygulamayı iki kez soğuk aç (ilk açılış indirir, ikinci
      uygular). ⚠️ P-5 bu güncellemeyi içermiyor: P-5 yalnız `fix/spotlight-result`
      merge edilmiş daldan yayınlanmalı, yoksa P-6a geri alınır.
      **SE, iPhone 15 Pro ve Pro Max**'te ayrı ayrı:
      - **Sayaç ilk ekranda:** oyunu bitir → sonuç ekranında, kaydırmadan, "Next puzzle"
        etiketi **ve** saat (hh:mm:ss) görünüyor; durum satırının ("Great Guess!" /
        "Found it with N letters") hemen altında. Film adı **iki satır** olan bir günde de
        aynı (geometri testi: 15 Pro'da ~571pt'de biter).
      - Sayaç saniye saniye akıyor; öldür-aç sonrası sonuç ekranında da üstte.
      - **Butonlar:** dolu "Watch Tonight" **yok**; yerine çerçeveli **"Where to watch"**
        (TR "Nerede izlenir") ve altında "Add to List". Where to watch → film sayfası
        açılıyor, nerede izlenir bölümü orada. Açılır başlık **"About this film"**
        (TR "Film hakkında"); açınca künye + tagline (metin İngilizce kalabilir — sunucu
        locale'i ayrı iş, P-6 F8).
      - **Diğer oyunlar değişmedi** (dondurulmuş oyun açılabiliyorsa): sayaç altta, dolu
        "Watch Tonight", başlık "Why This Movie?".
      - **Arama ipucu:** arama kutusuna yalnız `The` (ya da `An`) yaz, bekle → sonuç yerine
        tek satır: EN "Keep typing — "The" matches hundreds of films." / TR "Yazmaya devam
        et, "The" yüzlerce filme uyuyor."; Kapat satırı altta. `The K` yazınca ipucu gidiyor,
        sonuçlar geliyor; arada ipucu bir an yanıp sönmüyor. Tek `A` → hiçbir şey (2 karakter
        kapısı).
      - **Liste başı:** 4+ sonuçlu bir sorguda listeyi aşağı kaydır, bir harf daha yaz →
        yeni sonuçlar **en üstten** çiziliyor (ilk satır tam görünüyor). Altta yarım satır
        görünmesi beklenen (kaydırma ipucu).

---

## O. Bekleyiş ekranında Spotlight teaser'ı (P-5, K-62)

Build `feat/spotlight-ritual-teaser`'ı içermeli. **Yayın, `fix/spotlight-search`
OTA'sı doğrulanana kadar YASAK.** 18:00 öncesi, oynanmamış bir günde.

- [ ] O1. **Bekleyiş ekranı.** Metin + sayaç altında bulanık kare, ortasında kilit;
      altında TR "Bugünün karesi seni bekliyor. Dörtlünden sonra açılır." /
      EN "Today's frame is waiting. It opens after your four." Karenin kenarı
      **mor değil** (nötr). Kareye ve metne dokun → **hiçbir şey olmuyor**
      (opaklık değişimi, haptik, gezinme yok). Son şampiyon afişi hâlâ dokunulabilir.
- [ ] O2. **Gizlenme.** (a) Bugünün Spotlight'ı başlamışsa/bitmişse teaser yok.
      (b) `games_enabled.games`'ten `spotlight` çıkarılınca en geç 5 dk içinde
      (uygulamayı arka plana al/aç) teaser yok. (c) Bulmaca yoksa (NO_PUZZLE) teaser
      yok, hata metni de yok. (d) 18:00 sonrası gauntlet ve champion'da teaser yok.
- [ ] O3. **VoiceOver.** Teaser tek öğe olarak okunuyor, "düğme" denmiyor; kare ve
      kilit ayrıca okunmuyor.
- [ ] O4. **Reduce Motion açık/kapalı:** teaser animasyonsuz beliriyor (iki durumda
      aynı).
- [ ] O5. **Dynamic Type AX5** (Ayarlar → Erişilebilirlik → Daha Büyük Metin, en
      büyük): içerik kesilmiyor, aşağı kaydırılabiliyor; metin, sayaç, CTA, teaser
      ve son şampiyon sırayla erişilebilir.
- [ ] O6. **Küçük ekran (SE / mini):** standart yazı boyutunda düzen ortalı, taşma
      yok; bildirim CTA'sı + teaser + son şampiyon birlikteyken kaydırma çalışıyor.
- [ ] O7. **Bildirim metni.** Bildirim izni açık bir cihazda uygulamayı aç (yeniden
      planlama tetiklenir); 18:00 bildirimi gövdesi TR "Üç tur, tek film. Sonra
      bugünün karesi." / EN "Three rounds, one film. Then today's frame." **Tek**
      bildirim geliyor (çift yok).
- [ ] O8. **PostHog:** `spotlight_teaser_viewed` günde bir kez (ekrana ikinci
      girişte yeniden atılmıyor; ertesi gün tekrar atılıyor).

---

## Test edilmeyecekler (uygulanmadı — E-22)

| Plan maddesi | Durum |
|---|---|
| Bekleme ekranı bildirim CTA'sı + `waiting_notify_tapped` | Ertelendi — K-15 yerel planlama uygulanmadı |
| Settings: tek native switch, dil action sheet, native Apple butonu, destructive grup | Sprint v1 Settings turu koşmadı |
| Dünkü şampiyon kartı / backdrop blur | V1-D7 ile düştü |
| Profile Streak bölümü | K-08 sapması, ertelendi |

## Çıkış kriteri

A–N'de ❌ yok (gözlem maddeleri hariç). ❌ → CTO oturumunda triyaj → düzeltme turu →
yeni build.
