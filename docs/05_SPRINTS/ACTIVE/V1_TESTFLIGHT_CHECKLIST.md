# V-1 TestFlight Checklist — toplu cihaz oturumu

> Oluşturma: 28 Eyl 2026 (V-1 Tur 8). Sahip: Kurucu (cihaz). Karar kaydı:
> `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` v1.31 §5 E-22.
> Kaynak: V-1 turlarının commit'leri + bible §9'daki cihaz bekleyen kalemler.
> Senaryolar **gerçekte uygulanan** davranışa göre yazıldı; sprint v1'de planlanıp
> uygulanmayanlar (bildirim CTA'sı, Settings tek switch, dünkü şampiyon kartı,
> Streak) **test edilmez** — en altta listelidir.

## Ön koşullar

- [ ] Build: `eas build --platform ios --profile preview --auto-submit` — **preview /
      preview-store**. `__DEV__` ve `preview-e2e` build'lerinde 18:00 kapısı hep açık,
      `before_18` **oluşmaz** (bible §9, E-19/P0-1 satırı).
- [ ] Build `f8f2e6d` ve sonrasını içeriyor (geri sayım, E-21, P0-1 `3fd787f`).
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

- [ ] E1. Free kullanıcı: Profile'da Chosy Plus CTA'sı ve Cinema DNA paywall
      sarmalayıcısı görünür.
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
- [ ] F2. Bölüm sırası: **Cinema DNA → Watched → Saved → Üyelik**; Settings
      başlıktaki dişli. Streak **yok** (bilinçli, E-22). Discovery Stats **yok**.
- [ ] F3. Her bölüm başlığı **bir kez** (çift başlık yok).
- [ ] F4. Cinema DNA: başlık "Sinema DNA"/"Cinema DNA"; yetersiz veride
      "Birkaç akşam daha, zevkini tanıyacağım." — "swipe" kelimesi yok.
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

---

## Test edilmeyecekler (uygulanmadı — E-22)

| Plan maddesi | Durum |
|---|---|
| Bekleme ekranı bildirim CTA'sı + `waiting_notify_tapped` | Ertelendi — K-15 yerel planlama uygulanmadı |
| Settings: tek native switch, dil action sheet, native Apple butonu, destructive grup | Sprint v1 Settings turu koşmadı |
| Dünkü şampiyon kartı / backdrop blur | V1-D7 ile düştü |
| Profile Streak bölümü | K-08 sapması, ertelendi |

## Çıkış kriteri

A–J'de ❌ yok (gözlem maddeleri hariç). ❌ → CTO oturumunda triyaj → düzeltme turu →
yeni build.
