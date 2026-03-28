# MoodFlix Yeniden Tasarım — Adım Adım Uygulama Planı

---

## 📅 HAFTA 1: HAZIRLIK & REFERANS TOPLAMA

### Gün 1: Referans Toplama (Bugün Yap!)

**Adım 1 — Bumble Screenshot'ları (30 dk)**
1. Bumble'ı telefonuna indir (App Store / Google Play)
2. Hesap oluştur (Apple/Google ile hızlı giriş yeterli)
3. Şu 6 ekranın screenshot'ını al:
   - ✅ Ana swipe ekranı (kart görünümü, stack hissi)
   - ✅ Sağa swipe anı (yeşil overlay/ikon görünürken)
   - ✅ Sola swipe anı (kırmızı overlay/ikon görünürken)
   - ✅ Profil detay (karta tıklayıp aşağı scroll ettiğindeki ekran)
   - ✅ Bottom navigation (alt tab bar)
   - ✅ Filter/tercih ekranı
4. Screenshot'ları bilgisayarına aktar

**Adım 2 — Duolingo Screenshot'ları (20 dk)**
1. Duolingo'yu aç (zaten yüklüyse gir, yoksa indir)
2. Şu ekranları screenshot'la:
   - ✅ Ana ekran (Duo maskotun göründüğü yer)
   - ✅ Ders tamamlama kutlama ekranı (confetti + XP bar)
   - ✅ Streak ekranı (ateş ikonu + gün sayısı)
   - ✅ Boş state ekranı (Duo üzgün/bekliyor)
   - ✅ Loading ekranı (Duo'nun fun fact gösterdiği)
3. Screenshot'ları bilgisayarına aktar

**Adım 3 — Proje Klasör Yapısı (10 dk)**
Terminal'de (veya dosya yöneticisinde):
```bash
cd moodflix   # (senin proje root'un)

# Referans klasörleri oluştur
mkdir -p design-references/bumble
mkdir -p design-references/duolingo
mkdir -p design-references/mascot
mkdir -p assets/animations

# Screenshot'ları ilgili klasörlere kopyala
# bumble screenshot'larını → design-references/bumble/
# duolingo screenshot'larını → design-references/duolingo/
```

**Adım 4 — Figma Kitleri Duplicate Et (15 dk)**
1. figma.com'a gir (ücretsiz hesap yeterli)
2. Şu linkleri aç ve "Duplicate" butonuna bas:
   - Bumble UI Kit: figma.com/community/file/1429553897830419251
   - Duolingo UI Kit: figma.com/community/file/1279168389289425844
3. Her iki dosyayı Figma'da aç, şunlara bak:
   - Kart padding/margin değerleri
   - Border radius değerleri  
   - Font size'lar
   - Buton boyutları
   - Tab bar yüksekliği
4. Gördüklerini not al (telefonuna veya bir txt dosyasına)

---

### Gün 2: Dokümanları Projeye Yerleştir

**Adım 1 — Önceki Dokümanları Projeye Koy (10 dk)**

Daha önce hazırladığımız 4 dosyayı proje root'una koy:
```
moodflix/
├── CLAUDE.md                          (zaten var)
├── design-tokens.md                   (yeni — renk/font/spacing)
├── moodflix-ui-prompting-guide.md     (yeni — Claude Code prompt rehberi)
├── bumble-to-moodflix-reference.md    (yeni — Bumble adaptasyon)
├── moodflix-mascot-animation-strategy.md (yeni — Flick + animasyon planı)
├── design-references/
│   ├── bumble/      (screenshot'lar)
│   ├── duolingo/    (screenshot'lar)
│   └── mascot/      (Flick sketch'leri)
└── assets/
    └── animations/  (rive dosyaları gelecek)
```

**Adım 2 — CLAUDE.md'yi Güncelle (15 dk)**

CLAUDE.md'nin sonuna şu bloğu ekle (Claude Code her oturum başında okuyacak):
```markdown
## Design System

Bu projenin tasarım referansları:
- `design-tokens.md` → Renk, tipografi, spacing, shadow kuralları
- `bumble-to-moodflix-reference.md` → Bumble UX adaptasyon rehberi
- `moodflix-mascot-animation-strategy.md` → Flick maskot + animasyon planı
- `design-references/` → Bumble ve Duolingo screenshot referansları

### Tasarım Kuralları (Kısa Özet)
- Tema: Koyu (zinc-950 bg), accent: violet-500
- Kart: Bumble tarzı tam ekran, 3:4 poster, gradient overlay
- Swipe: Sağ=watchlist (yeşil), Sol=skip (kırmızı), Aşağı=izledim (mavi)
- Bottom nav: 4 tab, aktif=violet-500, pasif=zinc-500
- Animasyonlar: react-native-reanimated, 300ms ease-out
- Maskot: "Flick" kedi karakteri, Rive animasyonlu
- Her değişiklikte design-tokens.md'deki değerleri kullan
```

---

### Gün 3: Rive Hesabı + Flick İlk Çizim

**Adım 1 — Rive Hesabı (5 dk)**
1. rive.app adresine git
2. "Get Started Free" ile ücretsiz hesap oluştur
3. Editor'ü aç, arayüzü tanı (YouTube'da "Rive beginner tutorial" izle, 15 dk)

**Adım 2 — Rive Community'den İlham Al (15 dk)**
1. rive.app/community adresine git
2. Şu aramaları yap: "cat", "mascot", "character", "pet"
3. Beğendiklerini "Remix" yaparak nasıl yapıldıklarını incele
4. Özellikle State Machine yapılarına bak

**Adım 3 — Flick'in Kağıt Sketch'i (20 dk)**
Kağıda veya tablette Flick'in temel halini çiz:
```
Çizim kontrol listesi:
□ Yuvarlak baş (gövdeden biraz büyük)
□ Oval gövde (dikey)
□ İki üçgen kulak (yuvarlatılmış uçlu)
□ Büyük gözler (beyaz daire + amber pupil)
□ Küçük pembe burun (üçgen)
□ Küçük 3D sinema gözlüğü (başın üstünde veya gözlerde)
□ 4 küçük pati
□ Uzun kıvrık kuyruk
□ 8 farklı duygu durumu (basit yüz ifadeleri)
```

Mükemmel olması gerekmiyor! Önemli olan oranları ve genel hissi belirlemek.
Bu sketch'i `design-references/mascot/` klasörüne fotoğrafla koy.

---

### Gün 4: Rive'da Flick'i Oluşturmaya Başla

**Adım 1 — Yeni Rive Dosyası (5 dk)**
1. Rive Editor'ü aç
2. Yeni dosya: "flick-mascot"
3. Artboard boyutu: 256 x 256 px
4. Arka plan: transparent

**Adım 2 — Temel Şekilleri Çiz (45 dk)**
Rive'ın çizim araçlarıyla:
```
1. Gövde: Ellipse tool → dikey oval, fill: #7C3AED (violet-600)
2. Baş: Ellipse tool → daire, gövdenin üstüne, fill: #7C3AED
3. Kulaklar: Pen tool → 2 üçgen, fill: #7C3AED, iç kısım: #A78BFA
4. Gözler: 
   - Beyaz daire (büyük): fill: #FAFAFA
   - Amber pupil (küçük): fill: #F59E0B
   - Siyah göz bebeği (çok küçük): fill: #000
5. Burun: Küçük üçgen/daire, fill: #EC4899
6. Gözlük: Rectangle tool → 2 küçük dikdörtgen + bağlantı çizgisi
   - Çerçeve: stroke #D4D4D8, fill: #93C5FD opacity 30%
7. Kuyruk: Pen tool → bezier curve, stroke: #7C3AED, kalınlık: 8px
8. Patiler: 4 küçük oval, fill: #7C3AED
```

**ÖNEMLİ**: Her parçayı AYRI bir grup/layer olarak isimlendir:
- "body", "head", "ear_left", "ear_right", "eye_left", "eye_right"
- "pupil_left", "pupil_right", "nose", "glasses", "tail"
- "paw_front_left", "paw_front_right", "paw_back_left", "paw_back_right"

**Adım 3 — İlk Animasyon: Idle (30 dk)**
1. Timeline'a geç
2. "idle" adında yeni animasyon oluştur, loop: on
3. Nefes efekti:
   - Frame 0: body scale 1.0
   - Frame 30 (1 saniye): body scale 1.02 (hafif büyüme)
   - Frame 60: body scale 1.0 (geri dönüş)
   - Easing: ease-in-out
4. Göz kırpma:
   - Frame 0-89: gözler normal
   - Frame 90: eye_left ve eye_right scaleY: 0.1 (kapalı)
   - Frame 95: scaleY: 1.0 (açık)
   - Toplam loop: 120 frame (4 saniye)

---

### Gün 5: Flick'e Ek State'ler + State Machine

**Adım 1 — Happy Animasyonu (20 dk)**
1. Yeni animasyon: "happy"
2. Zıplama: body translateY: 0 → -15 → 0 (spring easing)
3. Kuyruk hızlı sallama: tail rotation: -20° → 20° (hızlı loop)
4. Gözler kısılmış (scaleY: 0.7, gülümseme efekti)

**Adım 2 — Sad Animasyonu (15 dk)**
1. Yeni animasyon: "sad"
2. Kulaklar aşağı: ear rotation: -15°
3. Kuyruk sarkık: tail rotation: -30° (statik)
4. Gözler büyük ve parlak (pupil büyümesi)
5. Gövde hafif eğik (rotation: -3°)

**Adım 3 — Thinking Animasyonu (15 dk)**
1. Yeni animasyon: "thinking"
2. Sağ pati yukarı (çeneye): paw_front_right translateY: -20
3. Kuyruk soru işareti şekli (bezier path değişimi)
4. Gözler yukarı bakıyor (pupil translateY: -3)

**Adım 4 — State Machine Oluştur (20 dk)**
1. State Machine ekle: "flick_controller"
2. Input ekle: "mood" (number, default: 0)
3. State'leri bağla:
   - mood = 0 → idle
   - mood = 1 → happy  
   - mood = 2 → sad
   - mood = 3 → thinking
4. Transition'lar: fade blend, 300ms
5. Göz kırpma'yı ayrı layer olarak ekle (her state'te çalışsın)

**Adım 5 — Export (5 dk)**
1. File → Export → .riv
2. Dosyayı `moodflix/assets/animations/flick-mascot.riv` olarak kaydet

---

## 📅 HAFTA 2: SWIPECARD + BUMBLE UX

### Gün 6: Bağımlılıkları Kur

**Terminal'de çalıştır:**
```bash
cd moodflix

# Animasyon ve gesture kütüphaneleri
npx expo install react-native-reanimated react-native-gesture-handler

# Rive (Expo ile uyumluluk kontrolü önemli!)
# Expo managed workflow'da native modül gerektirir
# Development build gerekebilir
npx expo install rive-react-native
# VEYA yeni Nitro-tabanlı versiyon:
# npm install @rive-app/react-native react-native-nitro-modules

# Haptic feedback
npx expo install expo-haptics
```

**babel.config.js'e reanimated plugin ekle:**
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'], // EN SONA EKLE
  };
};
```

**⚠️ Expo Development Build Gerekebilir:**
Rive native modül kullandığı için Expo Go yerine development build lazım olabilir:
```bash
npx expo prebuild
npx expo run:ios   # veya run:android
```
Bu adımda takılırsan bana sor, çözeriz.

---

### Gün 7-8: Claude Code ile SwipeCard Yeniden Yazımı

**Claude Code'u aç, CLAUDE.md okutulduktan sonra şu prompt'ları sırayla ver:**

**Oturum 1 — Kart Yapısı:**
```
design-references/bumble/ klasöründeki Bumble kart screenshot'larını
ve design-tokens.md dosyasını referans al.

SwipeCard komponentini sıfırdan yaz (src/components/SwipeCard.tsx):

1. Tam ekran kart: ekranın %85'ini kaplasın
2. Film posteri: kartın üst %65'i, edge-to-edge, object-fit cover
3. Altta gradient overlay: transparent → zinc-950 (alt %40)
4. Gradient üzerinde: film adı (22px bold beyaz), altında meta satırı
   (13px zinc-400, format: "2024 • ★ 8.1 • 2h 12m • Drama")
5. Kart: bg zinc-900, rounded-2xl, shadow (0 8px 32px rgba(0,0,0,0.5))
6. Stack efekti: arkada 2 kart daha (scale 0.95 + 0.90, blur 2px)
7. Sağ alt köşeye 60x60px boş alan bırak (maskot buraya gelecek)

react-native-reanimated ve react-native-gesture-handler kullan.
Prop olarak film datası (title, year, rating, duration, genre, posterUrl) alsın.
```

**Oturum 2 — Swipe Mekanizması:**
```
SwipeCard.tsx dosyasına swipe mekanizması ekle:

1. PanGesture ile yatay + dikey swipe algıla
2. Kart parmağı 1:1 takip etsin
3. Hafif rotation: swipe mesafesi * 0.08 derece (max ±12°)
4. Swipe overlay'ları:
   - Sağ (>0): yeşil (#22C55E) overlay + "+" ikonu (opacity: mesafe/threshold)
   - Sol (<0): kırmızı (#EF4444) overlay + "✕" ikonu
   - Aşağı (>0): mavi (#3B82F6) overlay + "👁" ikonu
5. Threshold: 120px yatay, 100px dikey
6. Threshold aşılınca: expo-haptics medium impact tetikle
7. Bırakıldığında threshold aşılmışsa: kart ekran dışına fırlasın (300ms ease-out)
8. Threshold aşılmamışsa: kart merkeze spring bounce ile dönsün
9. Kart çıkınca arka kart scale 0.95 → 1.0 animasyonu
10. Callback prop'ları: onSwipeRight, onSwipeLeft, onSwipeDown
```

**Oturum 3 — Alt Butonlar:**
```
SwipeCard'ın altına Bumble tarzı 3 aksiyon butonu ekle:

1. Horizontal flex, center, gap 24px
2. Sol buton: ✕ ikonu, 48px daire, border zinc-700, kırmızı ikon
3. Orta buton: ★ ikonu, 56px daire (büyük), bg violet-500, beyaz ikon
4. Sağ buton: ♡ ikonu, 48px daire, border zinc-700, yeşil ikon
5. Press state: scale(0.9) + shadow azalma (100ms)
6. Her buton kendi swipe yönünü tetiklesin
7. Buton tap'ında hafif haptic (light impact)
8. İkonlar: Lucide React Native'den (@lucide/react-native veya mevcut ikon lib)
```

---

### Gün 9-10: Bottom Navigation + Ekran Layoutları

**Oturum 4 — Bottom Tab Bar:**
```
Bumble tarzı bottom navigation oluştur (src/navigation/BottomTabs.tsx):

1. 4 tab: Home, Discover, Watchlist, Profile
2. İkonlar: Film (clapperboard), Search (büyüteç), Bookmark, User
3. Aktif state: violet-500 renk + label (11px, font-weight 600)
4. Pasif state: zinc-500, label yok
5. Tab değişiminde ikon outline→filled morph (200ms)
6. Bar: bg zinc-950, üst border 1px zinc-800 opacity 50%
7. Safe area bottom padding
8. Aktif tab'ın üstünde küçük violet dot indicator
9. @react-navigation/bottom-tabs kullan
```

**Oturum 5 — Home Screen Layout:**
```
HomeScreen'i düzenle (src/screens/HomeScreen.tsx):

Layout yukarıdan aşağı:
1. Status bar: transparent, light content
2. Header: sol "MoodFlix" logo text (title-medium, violet-500),
   sağ streak counter (🔥 + gün sayısı)
3. Mood selector: yatay scroll chip listesi
   - Her chip: emoji + label ("😢 Sad", "🔥 Excited", vb.)
   - Aktif: bg violet-500 + beyaz text
   - Pasif: bg zinc-800 + zinc-400 text
   - Pill shape, gap 8px, horizontal padding 16
4. SwipeCard (ekranın ana kısmı, %85)
5. Aksiyon butonları (SwipeCard'ın altında)
6. Bottom Tab Bar

Tüm renk ve spacing değerlerini design-tokens.md'den al.
```

---

## 📅 HAFTA 3: FLİCK ENTEGRASYONU + GAMİFİCATİON

### Gün 11-12: Flick'i Uygulamaya Ekle

**Oturum 6 — Flick Komponenti:**
```
Flick maskot komponenti oluştur (src/components/FlickMascot.tsx):

1. Rive kullanarak assets/animations/flick-mascot.riv dosyasını yükle
2. Props:
   - mood: number (0=idle, 1=happy, 2=sad, 3=thinking)
   - size: number (default: 48)
   - onTap: callback (opsiyonel)
3. State Machine input'u "mood" değerini props'tan al
4. Tap'te küçük bounce animasyonu (scale 1 → 1.15 → 1, spring)
5. Eğer Rive dosyası henüz yoksa, placeholder olarak emoji koy:
   - mood 0: "🐱", mood 1: "😸", mood 2: "😿", mood 3: "🤔"
   (Rive dosyası hazır olunca placeholder kaldırılacak)
```

**Flick'i Ekranlara Yerleştir:**
```
FlickMascot'u şu yerlere ekle:

1. SwipeCard sağ alt köşe: size 48, mood kullanıcının seçtiği mood'a göre
   - Swipe sırasında:
     sağa → mood=1 (happy)
     sola → mood=0 (idle)
     bırakıldığında → mood=0 (idle)

2. Boş Watchlist ekranı: size 120, ortada, mood=2 (sad)
   Altında text: "Henüz film eklemedin. Keşfe çık! 🎬"

3. Loading/splash: size 96, ortada, mood=3 (thinking)
   Altında rastgele film fun-fact
```

---

### Gün 13-14: Gamification Sistemi

**Oturum 7 — Milestone Kutlama:**
```
Duolingo tarzı milestone kutlama overlay'ı oluştur
(src/components/MilestoneOverlay.tsx):

Tetikleme: 10, 25, 50, 100 film keşfedildiğinde

Layout:
1. Full-screen overlay: bg rgba(0,0,0,0.85), fade in 300ms
2. Üstte confetti rain animasyonu (2 saniye)
3. Ortada FlickMascot: size 120, mood=1 (happy)
4. Başlık: "🎬 [sayı] Film Keşfettin!" (24px bold beyaz)
5. Alt başlık: motivasyonel mesaj (14px zinc-400)
6. Progress bar: mevcut/hedef, dolma animasyonu (violet-500)
7. "Devam Et" butonu: bg violet-500, rounded-full, beyaz text
8. Overlay dışına tap = kapat
9. Giriş animasyonu: scale(0.8) → scale(1) spring bounce

Confetti: react-native-reanimated ile 30-40 renkli küçük kare,
rastgele x pozisyonu, yukarıdan aşağı düşme + hafif sallanma.
```

**Oturum 8 — Streak Sistemi:**
```
Film keşif streak sistemi oluştur:

Backend (Supabase):
- user_streaks tablosu: user_id, current_streak, longest_streak,
  last_activity_date, streak_started_at
- Veya mevcut bir tabloya streak alanları ekle

Frontend:
1. src/components/StreakBadge.tsx:
   - Ateş emoji + gün sayısı (🔥 3)
   - Sayı animasyonlu (artarken yukarı sayma efekti)
   - Aktif streak: amber/turuncu glow efekti
   - Kırılmış streak: gri, soluk

2. Streak mantığı:
   - Her film swipe'ında (sağ veya aşağı) günlük aktivite kaydet
   - Ertesi gün giriş → streak +1
   - 1 gün atlanırsa → streak sıfırlanır
   - Milestone'lar: 3, 7, 14, 30 gün → FlickMascot kutlama

3. HomeScreen header'ının sağ üst köşesine StreakBadge koy
```

---

## 📅 HAFTA 4: POLİSH & MİKRO-ETKİLEŞİMLER

### Gün 15-16: Ekran Geçişleri + Loading States

**Oturum 9:**
```
Tüm ekranlara polish ekle:

1. Skeleton Loading:
   - Film kartı yüklenirken shimmer efektli placeholder
   - Poster alanı: gri dikdörtgen + shimmer (soldan sağa parlama)
   - Text alanları: gri çizgiler + shimmer

2. Screen Transitions:
   - Tab değişimi: crossfade (200ms ease-out)
   - Kart tap → Film detay: shared element (poster büyür)
   - Modal açılma: slide up + spring bounce

3. Pull-to-Refresh:
   - Custom indicator: FlickMascot yukarı uzanıyor
   - Bırakınca: Flick zıplıyor + yeni kartlar yükleniyor

4. Watchlist İşlemleri:
   - Ekleme: bookmark ikonu scale(1→1.3→1) + confetti mini-burst
   - Silme: sola swipe → shrink → gap kapanma animasyonu
```

### Gün 17-18: Film Detay Ekranı

**Oturum 10:**
```
Bumble profil detay pattern'ını film detayına adapte et
(src/screens/FilmDetailScreen.tsx):

Bumble'da karta tap → profil genişler. MoodFlix'te:

1. Karta tap → bottom sheet yukarı kayar (ekranın %80'i)
2. Üstte: poster (blur arka plan + gradient overlay)
3. Film bilgileri:
   - Başlık (title-large, beyaz)
   - Meta: yıl • rating ★ • süre • genre chips
   - Synopsis (body, zinc-300, max 4 satır, "devamını oku" butonu)
   - Cast: yatay scroll, yuvarlak thumbnail + isim
   - Genre tags: pill chip'ler (bg zinc-800, text zinc-300)
4. Aksiyon butonları:
   - "Watchlist'e Ekle" (primary, violet-500)
   - "İzledim" (secondary, outline)
5. Drag handle: üstte 40px gri çizgi
6. Gesture ile aşağı kapatılabilir
7. Flick sağ alt: mood=thinking → "Bu film ilginç görünüyor!"
```

### Gün 19-20: Son Kontroller + Test

**Checklist:**
```
□ Tüm ekranlar dark theme (zinc-950 arka plan)
□ Renklerin tamamı design-tokens.md ile tutarlı
□ Swipe her yönde düzgün çalışıyor
□ Haptic feedback doğru anlarda tetikleniyor
□ Flick doğru mood'larda doğru animasyonu gösteriyor
□ Milestone overlay 10 filmde tetikleniyor
□ Streak doğru hesaplanıyor
□ Bottom nav tüm tab'larda çalışıyor
□ Loading state'leri var (skeleton/shimmer)
□ Boş state'lerde Flick görünüyor
□ Film detay bottom sheet açılıp kapanıyor
□ Animasyonlar 60fps'de akıcı
□ Android + iOS'ta test edildi
```

---

## 🔑 HER GÜN CLAUDE CODE OTURUM BAŞLATMA ŞABLONU

Her gün Claude Code'u açtığında şu template'i kullan:

```
Bugünkü görev: [Yukarıdaki ilgili oturumun açıklaması]

Oku:
- CLAUDE.md
- design-tokens.md
- [ilgili referans dosyası]

Referans screenshot: design-references/[bumble veya duolingo]/[dosya adı]

Mevcut dosyalar: [üzerinde çalışacağın dosya yolları]

Kurallar:
- design-tokens.md'deki renkleri kullan
- react-native-reanimated kullan (Animated API kullanma)
- TypeScript strict
- Her komponente Props interface yaz
- Console.log bırakma
```

---

## ⚠️ TAKILDIYSAN

| Sorun | Çözüm |
|-------|-------|
| Expo + Rive uyumsuzluk | Development build'e geç: `npx expo prebuild` |
| Reanimated hata | babel.config.js'e plugin eklendiğinden emin ol, cache temizle: `npx expo start -c` |
| Rive dosyası yüklenmiyor | Dosya yolunu kontrol et, require() ile kullan |
| Swipe jank yapıyor | useAnimatedStyle içinde JS thread'e düşme, worklet kullan |
| Figma açılmıyor | Tarayıcıda aç (Chrome önerilir), hesap gerekiyor |
| Claude Code çok genel cevap veriyor | Dosya yollarını ver, screenshot ekle, design-tokens'a referans ver |
| Streak Supabase hatası | RPC veya trigger kullan, direkt tablo update yerine |
