# Pro Mode Faz 0 — Cihaz Test Listesi (PRO-0)

Kapsam: B1–B10 (B11 kod değişikliği yok, kapandı). Build: **preview #915**, kurucu 29–30 Ekim.
Bu belge test zamanlamasını belirlemez; build ve test zamanı kurucu kararıdır.

Commit'ler (başlangıç `57abf15` üstü): `b38b9d6` filtre · `01c9386` sahte sinyaller · `75a8bc1` akış · `7f1e953` deste kenarları.

## 0. Hazırlık: iki hesap

| Hesap | Neyi sınar | Notlar |
| --- | --- | --- |
| **Pro** (annual veya lifetime; `subscriptions.status=active`) | Tüm B maddeleri, deste kilitsiz, 8 kart | B1–B9 bu hesapla koşulur |
| **Ücretsiz** (abonelik yok; `mood_offer_enabled` açıksa ücretsiz hak, kapalıysa kota) | Kilit kartı, ücretsiz görünür kart sayısı, B10 paywall | B10 yalnız bu hesapta; kilit kartı davranışı DEĞİŞMEDİ, bozulmadığını gözle |

Her turdan önce: `Ayarlar → dil` (EN ve TR'de bir tur). Her aramadan sonra PostHog'da kendi kişinin olaylarına bak (aşağıdaki tablo). **Mood metni, anahtar kelime ve kimlik PostHog'da görünmemeli**; görünürse hata say.

## 1. PostHog'da bakılacaklar (madde bazında)

| Madde | Olay / özellik | Beklenen |
| --- | --- | --- |
| B1 | `mood_searched.filter_min_rating`, `.filter_era` | Seçilen eşik (ör. `8`); filtre yoksa `null` |
| B1 | `mood_relaxation_timing.origin` | `preload` (normal arama), `retry` / `filter_reset` yalnız o eylemlerde |
| B1 | `mood_relaxation_timing.min_rating`, `.min_ratings_sent` | `min_rating=8`; `min_ratings_sent` dizisinde HER eleman `8` (ör. `8,8,8,8`). `6.5` / `6.0` görünürse filtre yine düşüyor |
| B1 | `mood_relaxation_timing.relaxation_attempts` | 1-tabanlı: 1 = ilk deneme yetti; 2+ = benzerlik gevşedi (puan/dönem DEĞİL). Filtre varken `min_ratings_sent` sabit kalmalı |
| B1 | `mood_relaxation_timing.result_count` | Deste 8'den azsa < 8 ve destede bilgi satırı |
| B1 | `mood_preload_skipped` | Filtre değiştirip aynı mood'u aratınca atılMAMALI (atılırsa eski önbellek kullanılmış demektir; `profileKey` filtreyi içeriyor) |
| B2 | `mood_relaxation_timing.min_ratings_sent`, `.era_from/.era_to` | Dönem seçiliyse tüm denemelerde aynı |
| B2 | `mood_filters_removed` | "Filtreleri kaldır" dokunuşunda; ardından `origin=filter_reset` |
| B3–B5 | (olay yok, görsel kontrol) | — |
| B6 | `mood_deck_started.ms_since_submit` | "Ara"dan desteye süre. Eski ölçü ≈ 6,7 sn boş iskelet + profil ekranı; hedef: tek kesintisiz bekleme |
| B6 | `mood_relaxation_timing.ms_exclusions`, `.ms_to_chain_start`, `.total_ms`, `.attempt_ms` | `ms_exclusions` küçük (dışlama okumaları kullanıcı vektörüyle paralel); `ms_to_chain_start` eski ≈ 12 sn öncesinden belirgin düşük |
| B6 | `mood_searched` → `mood_relaxation_timing` aralığı | Rerank artık profil ekranı beklemeden başlar |
| B7 | `mood_card_tapped.mood_card_id` | Kartın sabit kimliği (`rainy`, `cozy`…); metin YOK |
| B7 | `discover_recent_search_tapped.mood_text_length` | Yalnız uzunluk |
| B8 | (olay yok) | — |
| B9 | `tonight_pick_action.action` | `watch_now` / `where_to_watch` / `new_mood` / `watchlist`; `film_id`, `has_liked` |
| B9 | `mood_deck_completed`, `mood_deck_summary_action` | Eskisi gibi atılmaya devam eder |
| B10 | Sentry: `SLOT_PAYWALL_NOT_SHOWN` (uyarı) | Yalnız paywall AÇILMAYINCA; açılıyorsa görünmemeli |

## 2. Senaryolar (adım → beklenen)

### B1 — Filtre aramaya ulaşır (ZORUNLU SENARYO)
Filtre etiketi artık **TMDB `vote_average`** üzerinde ("RATING"/"PUAN"; çipler Any / 7+ / 8+ / 8.5+). Kartta "IMDb" yazısı yoktur.

1. Pro Mode aç → Filter → **8+** seç → **Apply**.
2. Beklenen: trigger etiketi `Filter · ★ 8+` (dönem seçiliyse `· 2010s` eklenir).
3. Aynı mood'u yaz (veya hızlı mood dokun) → ara.
4. **Beklenen: destedeki tüm filmlerin kartındaki ★ değeri ≥ 8.0 VEYA destede (8'den az film varsa) bilgi satırı görünür** ("N films match your filters." / TR karşılığı). Hiçbir kartta ★ 8.0 altı olmamalı.
5. PostHog: `min_ratings_sent` içinde yalnız `8`.
6. Varyant: arama kutusuna odaklan → Recent Searches açılsın → kaydır → hızlı mood dokun. Filtre (`★ 8+`) korunmalı. (Odak/Recent filtreyi sıfırlamıyor; yine de bu sıra gerçek olayda yaşandı.)
7. Varyant: filtre Apply → bir arama yap → geri dön → **filtreyi değiştir** (7+) → AYNI mood'u tekrar ara. Eski sonuç dönmemeli (`mood_preload_skipped` atılmaz, yeni `min_ratings_sent=7`).
8. **B1 kök neden hâlâ AÇIK** (914'te `relaxation_attempts=1`, 8 filmden 7'si < 8: istek `min_rating=8` ile gitmemiş). F0-1 `profileKey` kusurunu kapattı ve ölçüm ekledi; bu senaryo sonucu kök nedeni kesinleştirir. Başarısız olursa `min_ratings_sent` değerini rapora yaz.

### B2 — Gevşetme filtreyi düşürmez
1. 8+ ve bir dönem (ör. 2010s) seç; dar bir mood ara (az film dönecek).
2. Beklenen: deste < 8 film, **hiçbir kart 8 altı veya dönem dışı değil**; tek satır bilgi ("N films match your filters."). PostHog: tüm denemelerde `8`; `era_from/to` sabit.
3. Hiç sonuç dönmeyecek kadar dar bir filtre (8.5+ ve 1950'ler): boş durum + **"Filtreleri kaldır"**.
4. "Filtreleri kaldır" → deste filtresiz yüklenir. **Kota harcanmaz** (arama hakkı sayacı değişmez; `parse-mood` çağrısı yok). PostHog: `mood_filters_removed` → `origin=filter_reset`.
5. RPC hata durumu (uçak modu ile ara): hata ekranı + **"Tekrar dene"**; bağlantıyı aç, "Tekrar dene" → deste gelir. Kota harcanmaz.

### B3 — Uydurma eşleşme sinyali yok
1. Bir deste aç. **8 kartın hiçbirinde** "AI Pick", "Hidden Gem", "Unexpected" rozeti, renkli kenarlık, "% match" dairesi veya yüzde olmamalı.
2. 6. karta gelince **titreşim yok**.
3. Watchlist sekmesinde poster üstünde yüzde rozeti yok.
4. Deste sonu özetinde yüzde / "match" yok.

### B4 — Tek puan kaynağı
1. Kart meta satırı: `yıl · ★ 6.8 · tür` (TMDB). "IMDb" kelimesi hiçbir yerde yok (kart, filtre başlığı, özet).
2. Filtre eşiği ile kartın ★ değeri aynı kaynaktan: 8+ filtresi → hiçbir kartta < 8.0.
3. Puanı olmayan film (varsa): ★ satırı gizli, boş "★ 0.0" yok.

### B5 — "Matches your mood" satırı yok
1. Kartlarda alt metin (açıklama satırı) yok; yalnız başlık, meta satırı ve iki buton.
2. Deste sonu hero'sunda açıklama yok; yalnız poster, ad, yıl, ★ puan.

### B6 — Profil ekranı yok, arka planda hazırlanma
1. Metin yaz → **ara**. Beklenen: işleme ekranı → **doğrudan deste** (Mood Profile Result ve "Share Your Mood" ekranları HİÇ çıkmaz).
2. Deste açılırken kısa iskelet olabilir; eski ≈ 6,7 sn boş iskelet kalkmış olmalı. PostHog: `mood_deck_started.ms_since_submit` kaydet.
3. `ms_exclusions` ve `ms_to_chain_start` değerlerini rapora yaz (eski ≈ 12 sn pre-chain gecikmesi düşmeli).
4. Onboarding akışı (varsa): aynı yol, `onboarding=1` ile deste, 5 film sınırı eskisi gibi.
5. Not: işleme overlay adımları hâlâ zamanlayıcıya bağlı (Faz 2); gerçek aşamayı göstermeyebilir, bu bilinen durumdur.

### B7 — Hızlı mood tek dokunuşla arar; ekranda etiket
1. **Hızlı mood kartına dokun** (ör. "Rainy Night"). Beklenen: arama **hemen** başlar (Find'a basmak gerekmez), kutuda **kart başlığı** görünür, uzun/robotik prompt görünmez.
2. Desteden dön → Recent Searches'ta kayıt **etiket** olarak ("Rainy Night"), "…not comedy" metni değil.
3. Recent'teki etikete dokun → arama başlar (veya bugünün aramasıysa bugünkü deste açılır; yeni kota harcanmaz).
4. **Eski kayıt**: Faz 0 öncesi robotik prompt olarak kaydolmuş bir Recent satırı varsa dokun → aynı kart olarak aranır (iki dilin başlık/prompt'u eşleşir).
5. Dil değiştir (EN ↔ TR), aynı kartı dokun: etiket yeni dilde, arama sonucu mantıklı.
6. Rıza yokken (AI rızası kapalı hesap): kart dokununca **arama başlamaz**, inline rıza bloğu açılır; "Enable and find" aynı kartla aramayı başlatır.
7. Tam prompt kontrolü: kartla aranan destede **"Filtreleri kaldır"** (filtre aktifken) rerank için tam prompt'u kullanır — deste anlamlı kalmalı (etiketle sorulmuş gibi saçmalamamalı).
8. Bugünkü desteyi yeniden aç (Today kartı) → "Filtreleri kaldır" hâlâ anlamlı sonuç verir (tam prompt etiketten çözülür).
9. PostHog: `mood_card_tapped.mood_card_id` sabit kimlik; metin yok.

### B8 — X, Pro Mode girişine döner
1. Deste ortasında sağ üst **X** → Pro Mode **girdi ekranı** (Home değil). Seçili filtre çipi (`★ 8+`) ve kutudaki etiket/metin **korunmuş**.
2. Deste sonu özetinde **X** → aynı yer.
3. Özette **Try New Mood** → aynı yer (mood bağlamı temizlenir ama ekran girdisi durur).
4. Geri gelince hızlı mood/Recent hâlâ çalışır; Home'a hiç gidilmemiş olmalı (geri tuşuyla Pro Mode, sonra Profil).

### B9 — Deste sonu "Tonight's pick"
1. **≥ 2 film beğen**, desteyi bitir. Beklenen: başlık "Tonight's pick" (TR "Bu akşamın filmi"), alt satır "From the N you liked." / "Beğendiğin N film arasından."
2. Hero'da poster, ad, yıl, gerçek ★ puan. "match" / yüzde / "TOP MATCH" yok.
3. Birincil **Watch now** (TR "Şimdi izle") → uygulama içi film detayı açılır.
4. İkincil **Where to watch** (TR "Nerede izlenir") → hero altında sağlayıcı logo satırı yüklenir; tekrar dokun → kapanır. 3'ten fazla sağlayıcıda "See all" sheet'i açılır. Bölge yoksa / sağlayıcı yoksa dürüst tek satır.
5. Altta **Try New Mood** ve **Go to Watchlist** ikincil görünümde (vurgu rengi yalnız Watch now'da).
6. **Tam 1 film beğen**: alt satır tekil "From the one you liked." / "Beğendiğin tek film arasından."
7. **Hiç beğenme**: hero YOK, Watch now / Where to watch YOK; "No matches this time" + "Try New Mood" tek ve vurgulu eylem.
8. PostHog: `tonight_pick_action` dört eylem için ayrı ayrı (`watch_now`, `where_to_watch`, `new_mood`, `watchlist`).

### B10 — Slot kotası ve paywall (ücretsiz hesap)
1. Ücretsiz hesapta slot kotasını doldur (kaydet, kaydet…); kota biter bitmez sağa kaydır.
2. Beklenen (paywall AÇILIYORSA): paywall açılır, deste donar, kart yerine yaylanır; paywall kapanınca deste çözülür / akış eskisi gibi.
3. Paywall AÇILMAYAN durum (orkestratör bastırıyorsa; bayrak/deneme koşulları): **deste donmaz**, kart ilerler ve film kaydedilir. Sentry'de `SLOT_PAYWALL_NOT_SHOWN` uyarısı görünür.
4. Ücretsiz arama destesinde (`mood_offer_enabled` açık, ücretsiz hak): slot kotası muaf, kaydetme paywall ile KESİLMEZ (C8). Kilit kartı ve `free_visible_count` davranışı değişmemiş olmalı.
5. Pro hesapta: kota/paywall hiç tetiklenmez.

## 3. Genel regresyon (kısa)
- 8 kart + sol/sağ kaydırma eskisi gibi; kart tıklayınca film detayı.
- Kilit kartı (ücretsiz): ilk `free_visible_count` kart sonrası kilit kartı, davranış aynı.
- `mood_offer_enabled`, peek kodu, gauntlet Home (günlük ritüel) etkilenmemiş.
- EN ve TR'de yeni metinlerin tamamı çevrili; hardcoded İngilizce yok (deste sonu, filtre bilgi satırı, boş durum).
- Görünen ad "Pro Mode" kalır.
