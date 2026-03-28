# Bumble → MoodFlix: Design Referans & Adaptasyon Rehberi

## 📌 Referans Kaynakları (Hepsini Aç ve Screenshot Al)

### 1. Mobbin (En Önemli Kaynak — Tüm Ekranlar Burada)
- **Bumble iOS tüm ekranlar:** https://mobbin.com/apps/bumble-ios-fefcf818-326e-4549-b2ba-1f440759e5ee/_/screens
- **Bumble Android tüm ekranlar:** https://mobbin.com/apps/bumble-android-92e31d5c-430e-475a-9cbf-909fce0fd486/12324730-b5dc-417e-adcc-f757f8e8d285/screens
- Ücretsiz hesap aç, Bumble'ın her ekranını flow bazında görebilirsin
- İhtiyacın olan ekranları "Collection" olarak kaydet

### 2. Figma Community (Düzenlenebilir UI Kit'ler)
- **Bumble Free UI Kit (Marvilo):** https://www.figma.com/community/file/1429553897830419251/bumble-free-ui-kit-by-marvilo
- **Bumble Redesign:** https://www.figma.com/community/file/1360260686633958545/bumble-redesign
- **Bumble UI Redesign:** https://www.figma.com/community/file/1356195039508852936/bumble-ui-redesign
- **BumbleBee UI Kit (Demo):** https://www.figma.com/community/file/1009100926249441323/bumblebee-ui-kit-demo
- Bu Figma dosyalarını "Duplicate" yaparak kendi spacing, radius, renk kararlarını inceleyebilirsin

### 3. UX Analiz Makaleleri (Bumble'ın Neden İşe Yaradığını Anlamak İçin)
- **Usability Geek - Bumble UX Case Study:** https://usabilitygeek.com/ux-case-study-bumble/
- **UX Planet - 5 Laws of UX Bumble Follows:** https://uxplanet.org/5-laws-of-ux-that-bumble-follows-f9876159a216
- **Tinder vs Bumble UX Comparison:** https://medium.com/design-bootcamp/decoding-ui-ux-quick-comparison-of-tinder-and-bumble-9a3cb2b76f28
- **Behance - Bumble UX/UI Concept:** https://www.behance.net/gallery/114660611/Bumble-Dating-App-UXUI-Concept-Project

---

## 🔄 Bumble → MoodFlix Ekran Eşleştirmesi

| Bumble Ekranı | MoodFlix Karşılığı | Adaptasyon Notu |
|---|---|---|
| Ana swipe kartı (profil fotosu) | Film SwipeCard (poster) | Fotoğraf → Film posteri. İsim/yaş → Film adı/yıl. Bio → Genre + synopsis |
| Kart alt bilgi (isim, yaş, mesafe) | Film meta satırı | → Film adı, yıl, rating ★, süre |
| Swipe right overlay (yeşil check) | Watchlist eklendi overlay | → Yeşil "+" veya watchlist ikonu overlay |
| Swipe left overlay (kırmızı X) | Skip overlay | → Kırmızı "✕" fade overlay |
| Kart stack (arkada görünen kartlar) | Film stack | → Arkada 2-3 kart silüeti (blur + scale down) |
| Profil detay (aşağı scroll) | Film detay (karta tap) | → Poster büyür, synopsis açılır, cast/genre chip'leri |
| Bottom navigation (4 tab) | Bottom navigation (4-5 tab) | → Home / Discover / Watchlist / Profile |
| Match ekranı ("It's a Match!") | MoodFlix karşılığı yok | → Kullanma, dating app hissi verir |
| Filter/Preferences ekranı | Mood selector / Filter | → Yaş/mesafe yerine → Mood, genre, decade, rating filtresi |
| Profile ekranı | User stats/profile | → Avatar, izleme istatistikleri, mood geçmişi |
| Onboarding (4 adım açıklama) | MoodFlix onboarding | → "Mood seç → Film keşfet → Sağa kaydır → Listeye ekle" |
| Settings | Settings | → Tema, bildirim, hesap ayarları |

---

## 🎨 Bumble Tasarım DNA'sı → MoodFlix Adaptasyonu

### Bumble'ın Temel Tasarım Kuralları:
1. **Kart dominant**: Ekranın %80'i kart, geri kalanı minimal UI
2. **Tek el kullanım**: Tüm aksiyonlar başparmakla erişilebilir
3. **Minimal overlay**: Swipe feedback sadece ince ikon + renk
4. **Yumuşak kenarlar**: Her şey rounded, sert köşe yok
5. **Beyaz/açık tema**: Bumble açık tema kullanıyor

### MoodFlix Adaptasyonu:
1. ✅ Kart dominant → Aynı kalsın, poster kartı ekranın %80'i
2. ✅ Tek el kullanım → Swipe zone'ları korunsun
3. ✅ Minimal overlay → Yeşil/kırmızı ince overlay animasyonu
4. ✅ Yumuşak kenarlar → rounded-2xl (24px) her yerde
5. 🔄 Açık tema → **KOYU tema**ya çevir (sinematik his için)

---

## 🎯 Claude Code'a Verilecek Master Prompt

Bu prompt'u Claude Code'a ilk seferde ver, her oturum başında CLAUDE.md'den okuyacak:

```
## MoodFlix Design Reference: Bumble-Adapted

MoodFlix, Bumble'ın card-swipe UX pattern'ını film keşfine adapte eder.
Tüm tasarım kararlarında Bumble'ın minimalist, kart-merkezli yaklaşımını
koyu/sinematik bir palete çevirerek uygula.

### Kart Yapısı (Bumble profil kartı → Film kartı)
- Tam ekran kart: ekranın %85'ini kaplar
- Poster: kartın üst %65'i, edge-to-edge, object-fit cover
- Gradient overlay: altta %40, transparent → bg-zinc-950
- Film adı: gradient üzerinde, 22px bold, beyaz, sol alt
- Meta satırı: film adının altında, 13px, zinc-400
  Format: "2024 • ★ 8.1 • 2h 12m • Drama"
- Kart arka planı: zinc-900, rounded-2xl
- Kart shadow: 0 8px 32px rgba(0,0,0,0.5)
- Stack efekti: arkada 2 kart daha, scale(0.95) ve scale(0.90), blur(2px)

### Swipe Feedback (Bumble overlay → Film overlay)
- Sağa swipe: yeşil(#22C55E) yarı-saydam overlay + "➕" ikonu
  → Watchlist'e eklendi
- Sola swipe: kırmızı(#EF4444) yarı-saydam overlay + "✕" ikonu
  → Skip
- Aşağı swipe: mavi(#3B82F6) yarı-saydam overlay + "👁" ikonu
  → Zaten izledim
- Overlay opacity: 0 → 0.3 (swipe mesafesine orantılı)
- İkon boyutu: 64px, merkez
- Threshold: 120px sonra tetikle

### Swipe Altı Butonları (Bumble like/dislike/superlike butonları)
- 3 yuvarlak buton, alt orta, horizontal flex, gap 24
- Sol: ✕ kırmızı outline (48px circle, border zinc-700)
- Orta: ★ violet-500 filled (56px circle, büyük — superlike)
- Sağ: ♡ yeşil outline (48px circle, border zinc-700)
- Bumble'daki gibi aktif state'te hafif scale(1.1) + glow

### Bottom Navigation (Bumble tab bar)
- 4 tab: Home (film ikonu), Search (büşüteç), Watchlist (bookmark), Profile (user)
- Sabit alt bar, bg-zinc-950, üst border 1px zinc-800/50
- Aktif: violet-500 ikon + label (11px)
- Pasif: zinc-500 ikon, label yok
- Safe area padding alt

### Film Detay (Bumble'da karta tap → profil genişler)
- Karta tap: kart yukarı genişler, bottom sheet tarzı
- İçerik scroll: synopsis, cast chips, genre tags, trailer butonu
- Üstte poster (blur arka plan) + gradient
- Bumble'ın "aşağı scroll = daha fazla bilgi" pattern'ı

### Genel Layout Kuralları
- Ekran padding: horizontal 16px (kartın kendisi edge-to-edge olabilir)
- Status bar: şeffaf, üstüne overlay
- Her interaktif eleman: min 44x44px tap zone
- Animasyonlar: 300ms ease-out, spring physics for swipe
- Haptic: light (swipe start), medium (threshold cross), heavy (action confirm)
```

---

## 📱 Pratik İş Akışı

### Adım 1: Referansları Topla
1. Mobbin.com'a git → Bumble iOS ara → Collection oluştur
2. Şu ekranları kaydet:
   - Ana swipe ekranı (kart görünümü)
   - Profil detay (scroll edilmiş hali)
   - Bottom navigation
   - Filter/preference ekranı
   - Onboarding akışı
   - Profile/settings

### Adım 2: Screenshot'ları Projeye Koy
```
moodflix/
  design-references/
    bumble-swipe-card.png
    bumble-profile-detail.png
    bumble-bottom-nav.png
    bumble-filters.png
    bumble-onboarding.png
```

### Adım 3: Claude Code'a Prompt Ver
```
"design-references/ klasöründeki Bumble ekranlarını referans al.
Bu ekranları MoodFlix'in koyu temasına adapte et.
CLAUDE.md'deki design tokens ve Bumble adaptasyon kurallarını uygula.
Şu ekranla başla: [ekran adı]"
```

### Adım 4: Ekran Ekran İlerle
Önerilen sıra:
1. SwipeCard komponenti (en kritik)
2. Bottom Navigation
3. Home Screen layout
4. Film Detay bottom sheet
5. Mood Selector / Filter
6. Watchlist ekranı
7. Profile / Stats ekranı
8. Onboarding flow

---

## ⚠️ Bumble'dan ALMAMAN Gereken Şeyler

| Bumble Özelliği | Neden MoodFlix'e Uymuyor |
|---|---|
| Match animasyonu ("It's a Match!") | Dating app hissi verir, film app'e yakışmaz |
| Chat/mesajlaşma UI | MoodFlix'te chat yok |
| Premium/boost banner'ları | MVP'de monetizasyon UI'ı gereksiz |
| Sarı/bal rengi palet | MoodFlix koyu/violet tema kullanıyor |
| Cinsiyet/yaş filtresi UI | Bunun yerine mood/genre/decade filtresi |
| Konum tabanlı öneriler | MoodFlix konum kullanmıyor |
