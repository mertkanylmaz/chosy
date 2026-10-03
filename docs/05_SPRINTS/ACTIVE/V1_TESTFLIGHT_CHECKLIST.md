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
