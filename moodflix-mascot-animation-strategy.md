# MoodFlix Maskot & Animasyon Stratejisi
## Bumble UX + Duolingo Gamification + Elegant Maskot

---

## 🎭 MASKOT: "Flick"

### Konsept
MoodFlix'in maskotu bir **sinematik kedi** olmalı. Neden kedi?

- Baykuş (Duolingo) = bilgelik, öğrenme → zaten alınmış
- Arı (Bumble) = sosyallik → zaten alınmış  
- **Kedi** = bağımsız, gizemli, sinematik, zarif
- Kediler filmlerle özdeşleşir (karanlık odalarda oturma, ekran ışığı, meraklı bakış)
- Hem sevimli hem elegant olabilir — Duolingo'nun playful enerjisi + lüks his

### İsim Önerileri
| İsim | Neden |
|------|-------|
| **Flick** | "Film" anlamında slang + kısa/akılda kalıcı |
| **Reel** | Film makarası referansı |
| **Movi** | Movie kısaltması, sevimli |
| **Cine** | Sinema, elegant |
| **Frame** | Film karesi, minimal |

> **Tavsiye: "Flick"** — Kısa, global, telaffuzu kolay, film referansı net.

### Karakter Özellikleri

```
Tür:           Kedi (stilize, gerçekçi değil)
Renk:          Koyu mor/violet (#7C3AED) — marka rengiyle uyumlu
Göz rengi:     Parlak amber/altın (#FACC15) — karanlık temada pop yapar
Beden:         Yuvarlak ama zarif (Duolingo'nun tombulluğu + kedi zarafeti)
Kuyruğu:       Hareketli, duyguları ifade eder
Aksesuar:      Küçük 3D gözlük (sinema referansı, elegant detay)
Boyut:         Compact — UI'da çok yer kaplamamalı
```

### Duygu Durumları (Mood'lara göre)
```
😊 Mutlu:       Gözler ay şeklinde kısılmış, kuyruk yukarı, hafif zıplama
😢 Üzgün:       Gözler büyük ve parlak, kulaklar aşağı, kuyruk sarkık
😱 Gerilim:     Tüyler kabarmış, gözler kocaman, kuyruk dik
😍 Romantik:    Gözler kalp şeklinde, hafif kızarma, yumuşak sallantı  
🔥 Heyecanlı:   Zıplıyor, patikuşlar havada, gözler ışıl ışıl
😴 Sakin:        Kıvrılmış pozisyon, gözler yarı kapalı, hafif nefes animasyonu
😂 Komedi:       Ağız açık gülme, gözlerden yaş, sırt üstü yuvarlanma
🤔 Keşif:        Bir patiyi çenesine koymuş, düşünür pozu, kuyruk soru işareti
```

---

## 🛠 TEKNİK YAPI: Rive Animasyonları

### Neden Rive?

Duolingo'nun tüm karakter animasyonları Rive ile yapılıyor. Sebepleri:

1. **Dosya boyutu**: Bir .riv dosyası birkaç KB — video/GIF'in binde biri
2. **State Machine**: Kullanıcı aksiyonlarına göre animasyon state'leri değişir
3. **60 FPS**: Native rendering (OpenGL/Metal) ile butter-smooth
4. **React Native desteği**: Resmi `rive-react-native` paketi mevcut
5. **Interaktif**: Dokunma, swipe gibi gesture'lara tepki verebilir

### React Native Entegrasyonu

```bash
# Yeni runtime (Nitro tabanlı, daha performanslı)
npm install @rive-app/react-native react-native-nitro-modules

# veya eski stabil versiyon
npm install rive-react-native
```

```jsx
// Temel kullanım
import { RiveView, useRiveFile } from '@rive-app/react-native';

function MascotWidget() {
  const { riveFile } = useRiveFile(
    require('./assets/flick-mascot.riv')
  );
  
  return (
    <RiveView 
      file={riveFile} 
      style={{ width: 120, height: 120 }} 
    />
  );
}
```

### Flick'in Rive State Machine Yapısı

```
State Machine: "flick_main"
├── Layer: "body"
│   ├── idle (nefes + göz kırpma loop)
│   ├── happy (zıplama + kuyruk sallama)
│   ├── sad (kulak düşme + üzgün bakış)
│   ├── excited (hızlı zıplama + parıltı)
│   ├── thinking (pati çeneye + kuyruk soru işareti)
│   └── sleeping (kıvrılma + zzz)
│
├── Layer: "eyes" 
│   ├── blink (rastgele 3-5 saniyede bir)
│   ├── look_left (sola swipe sırasında)
│   ├── look_right (sağa swipe sırasında)
│   └── wide (sürpriz anında)
│
├── Layer: "tail"
│   ├── slow_wag (idle)
│   ├── fast_wag (heyecan)
│   ├── question_mark (düşünme)
│   └── droopy (üzgün)
│
├── Layer: "effects"
│   ├── sparkle (başarı anları)
│   ├── hearts (romantik mood)
│   ├── confetti (watchlist milestone)
│   └── sweat_drop (gerilim)
│
└── Inputs:
    ├── mood (number: 0-7, hangi duygu)
    ├── is_swiping (boolean)
    ├── swipe_direction (number: -1 sol, 0 nötr, 1 sağ)
    └── celebration (trigger: milestone anlarında)
```

---

## 📍 FLICK NEREDE GÖRÜNECEK?

### Bumble'dan Alınan UX Pattern + Duolingo Maskot Entegrasyonu

| Ekran | Flick'in Rolü | Animasyon |
|-------|--------------|-----------|
| **Onboarding** | Her adımda farklı pozu, kullanıcıyı yönlendiriyor | Duolingo tarzı: el sallama → işaret etme → alkış |
| **Mood Seçimi** | Seçilen mood'a göre duygu değiştiriyor | Mood chip'e tap → Flick o duyguyu taklit eder |
| **Swipe Kartı (köşe)** | Sağ alt köşede küçük (48px), kartı "izliyor" | Swipe yönüne bakıyor, sağa swipe'ta sevinç |
| **Boş Watchlist** | Ortada büyük, kitap okuyor | Duolingo empty-state tarzı: "Henüz film eklemedin!" |
| **Watchlist Milestone** | Confetti + dans | 10/25/50/100 film → kutlama animasyonu |
| **Streak** | Arka arkaya günlük kullanım | "3 gündür film keşfediyorsun! 🔥" + ateş efekti |
| **Loading** | Patisiyle ekranı "siliyor" | Duolingo loading screen tarzı: fun fact gösterme |
| **Hata/Boş Sonuç** | Kafası karışmış, kuyruk soru işareti | "Bu mood'da film bulamadım 🤔 Başka dene?" |
| **Push Notification** | (Gelecekte) Duo tarzı passive-aggressive | "Flick seni bekliyor... 🐱 Film keşfetmedin bugün" |

### Önemli Kural: Flick ASLA Rahatsız Edici Olmamalı
- Duolingo'nun "guilt-trip" stratejisini HAFIF kullan
- Flick elegant ve arkadaş canlısı, agresif değil
- Kapatılabilir olmalı (Settings'te "Maskotu gizle" seçeneği)

---

## 🎬 BUMBLE + DUOLINGO ANİMASYON SİSTEMİ

### 1. Swipe Card Animasyonları (Bumble'dan)

```
Kart Hareketi:
├── Swipe başladığında
│   ├── Kart parmağı takip eder (1:1 pan gesture)
│   ├── Hafif rotation (swipe mesafesi * 0.1 derece, max ±15°)
│   ├── Overlay opacity: swipe mesafesi / threshold
│   └── Flick gözleri swipe yönüne döner
│
├── Threshold aşıldığında (120px)
│   ├── Haptic: medium impact
│   ├── Overlay ikonu scale: 0 → 1 (spring bounce)
│   ├── Arka kart scale: 0.95 → 1.0 (hazırlanıyor)
│   └── Flick state değişir: happy (sağ) / neutral (sol)
│
├── Bırakıldığında (threshold aşılmış)
│   ├── Kart ekran dışına fırlar (300ms ease-out)
│   ├── Yeni kart arkadan gelir (spring physics)
│   ├── Flick mini kutlama (sağa swipe) veya omuz silkme (sola)
│   └── Haptic: light impact
│
└── Bırakıldığında (threshold aşılmamış)
    ├── Kart merkeze döner (spring bounce, 250ms)
    ├── Overlay fade out (150ms)
    └── Flick idle'a döner
```

### 2. Gamification Animasyonları (Duolingo'dan)

```
Başarı Sistemi:
├── İlk Swipe
│   ├── Flick alkışlıyor
│   ├── "+1 Film Keşfedildi" toast (slide up, 2s, fade out)
│   └── Küçük confetti burst
│
├── 10 Film Keşfedildi
│   ├── Full-screen overlay (yarı-saydam koyu)
│   ├── Flick büyük boyutta, dans ediyor
│   ├── "🎬 10 Film Keşfettin!" başlık
│   ├── Confetti rain (2 saniye)
│   ├── XP bar animasyonu
│   └── "Devam Et" butonu
│
├── Günlük Streak
│   ├── Flick ateş efektli
│   ├── "🔥 3 Gün Üst Üste!" 
│   ├── Streak counter animasyonu (sayı yukarı sayar)
│   └── Duolingo tarzı: streaki kaybetme korkusu (hafif)
│
├── Mood Master (bir mood'da 20+ film)
│   ├── Flick o mood'un kostümünde (romantik: kravat, korku: pelerin)
│   ├── Badge unlock animasyonu
│   └── Profile'da rozet görünür
│
└── Watchlist Milestones (10, 25, 50, 100)
    ├── Flick farklı kutlama animasyonları
    ├── Büyüyen ödül görseli
    └── Share butonu (opsiyonel)
```

### 3. Mikro-Etkileşimler (Her İkisinden)

```
Her Yerde Olan İnce Animasyonlar:
├── Tab değişimi: ikon morph (outline → filled, 200ms)
├── Pull-to-refresh: Flick yukarı uzanıyor, bırakınca zıplıyor
├── Scroll: paralaks efekt (poster hafif kayar)
├── Chip seçimi: scale(0.95) → scale(1.0) + renk geçişi (150ms)
├── Buton press: scale(0.97) + shadow azalma (active state)
├── Kart yükleme: shimmer/skeleton (Bumble tarzı)
├── Rating yıldızları: soldan sağa dolma animasyonu
├── Watchlist ekleme: kalp/bookmark ikonu "pop" efekti
├── Liste item silme: sola kaydırma + shrink + gap kapanması
└── Screen transition: shared element (poster karttan detaya geçiş)
```

---

## 📐 TASARIM OLUŞTURMA PLANI

### Faz 1: Flick Maskot Tasarımı (Hafta 1)

#### Adım 1: Rive Editör'de Tasarla (Ücretsiz)
1. **rive.app** adresinden ücretsiz hesap aç
2. Yeni dosya oluştur, artboard: 256x256px
3. Flick'i çiz:
   - Basit geometri kullan (Duo gibi: daire + yarım daireler)
   - Gövde: dikey oval (violet-600)
   - Baş: yuvarlak, gövdeden biraz büyük
   - Gözler: büyük beyaz daireler + amber pupil
   - Kulaklar: üçgen, hafif yuvarlak
   - Kuyruk: bezier curve
   - 3D gözlük: küçük dikdörtgenler (aksesuar)
4. Her parçayı ayrı layer'a koy (animasyon için)

#### Adım 2: Rigging & Animasyon
1. Bones ekle (kuyruk, kulaklar, gözler için)
2. İlk 3 state'i oluştur:
   - **idle**: nefes (scale 1.0 ↔ 1.02) + göz kırpma (3-5s aralık)
   - **happy**: zıplama (translateY -10px) + kuyruk hızlı sallama
   - **thinking**: pati yukarı + kuyruk soru işareti şekli
3. State Machine oluştur, input olarak `mood` (number) ekle

#### Adım 3: Export & Entegre
1. .riv dosyasını export et
2. `assets/animations/flick-mascot.riv` olarak projeye ekle
3. RiveView komponenti ile test et

### Faz 2: Bumble Swipe UX (Hafta 2)

#### Referans Toplama
1. Bumble'ı telefonuna indir, şu ekranları screenshot'la:
   - Ana kart ekranı (kart stack görünümü)
   - Swipe overlay'ları (like/dislike)
   - Alt butonlar (X, star, heart)
   - Profil detay (karta tap sonrası)
   - Bottom navigation
   - Filter/preference ekranı
2. Screenshot'ları `design-references/bumble/` klasörüne koy

#### Claude Code'a Verilecek Promptlar (Sırayla)

**Prompt 1 — SwipeCard:**
```
design-references/bumble/ klasöründeki Bumble kart ekranını referans al.
Film kartı oluştur: tam ekran poster (3:4), altta gradient overlay,
film adı + yıl + rating + süre. Bumble'ın kart stack efektini koru
(arkada 2 kart, scale 0.95 ve 0.90). Renkleri design-tokens.md'den al.
Sağ alt köşeye 48px alan bırak (Flick maskotu buraya gelecek).
react-native-reanimated + react-native-gesture-handler kullan.
```

**Prompt 2 — Swipe Overlay:**
```
SwipeCard'a Bumble tarzı swipe overlay ekle:
- Sağ: yeşil (#22C55E) yarı-saydam + ➕ ikonu
- Sol: kırmızı (#EF4444) yarı-saydam + ✕ ikonu  
- Aşağı: mavi (#3B82F6) yarı-saydam + 👁 ikonu
Overlay opacity swipe mesafesine orantılı (0 → 0.3).
Threshold: 120px. Threshold aşılınca hafif haptic.
```

**Prompt 3 — Bottom Nav:**
```
Bumble tarzı bottom navigation oluştur. 4 tab:
Home (film ikonu), Search (büyüteç), Watchlist (bookmark), Profile (user).
Aktif: violet-500, pasif: zinc-500. Aktif tab'da ikon filled olsun.
Tab değişiminde ikon morph animasyonu (outline → filled, 200ms).
Safe area padding, bg-zinc-950, üst border 1px zinc-800 opacity 50%.
```

### Faz 3: Duolingo Gamification (Hafta 3)

**Prompt 4 — Milestone Overlay:**
```
Duolingo'nun ders tamamlama kutlama ekranını referans al.
MoodFlix versiyonu: kullanıcı 10 film keşfettiğinde:
- Yarı-saydam koyu overlay
- Ortada Flick maskotu (RiveView, happy state)
- "🎬 10 Film Keşfettin!" başlık (title-large, beyaz)
- Confetti rain animasyonu (2 saniye)
- Progress bar: XP dolma animasyonu
- "Devam Et" butonu (violet-500, rounded-full)
Overlay dışına tap = kapatma. Spring animasyonu ile açılsın.
```

**Prompt 5 — Streak System:**
```
Duolingo streak sistemini MoodFlix'e adapte et:
- Günlük en az 1 film keşfet = streak devam
- Streak counter: Home ekranının üst sağ köşesinde
- Ateş emojisi + gün sayısı (animasyonlu sayaç)
- Streak kaybedilince: Flick üzgün state + "Streak'in bitti 😿"
- Streak milestone'ları: 3, 7, 14, 30 gün → özel badge
Supabase'de user_streaks tablosu gerekecek.
```

### Faz 4: Mikro-Etkileşimler (Hafta 4)

**Prompt 6 — Polish:**
```
Tüm ekranlara mikro-etkileşim katmanı ekle:
- Pull-to-refresh: custom animasyon (Flick uzanıyor)
- Skeleton loading: shimmer efekti (film kartları yüklenirken)
- Watchlist ekleme: bookmark ikonu pop + scale bounce
- Tab değişimi: crossfade (200ms)
- Kart tap → detay: shared element transition (poster büyür)
- Rating yıldızları: soldan sağa dolma (her yıldız 100ms delay)
react-native-reanimated layout animations kullan.
```

---

## 🎨 FLICK TASARIM REHBERİ (Claude Code / Rive İçin)

### Geometri Kuralları (Duo'dan öğrenilen)

Duolingo'nun art director'ü Greg Hartman'ın önemli prensibi:
"Basit geometri kullanıyoruz. Kanatları sadece yarım daireler.
Karakteri herhangi bir açıdan çevirdiğinizde şekli tahmin edilebilir."

Bu prensibi Flick'e uygulanması:
```
Gövde:     Dikey oval (basit ellipse)
Baş:       Daire (gövdeden %20 büyük)
Kulaklar:  Üçgen + rounded corners  
Patiler:   Küçük oval (4 adet)
Kuyruk:    Bezier curve (3 control point)
Gözler:    Büyük beyaz daire + küçük amber daire (pupil)
Gözlük:    İki dikdörtgen + ince bridge line
```

### Neden Basit Geometri?
- Animasyon süresi düşer (daha az complexity)
- Her boyutta okunabilir (48px'den 256px'e)
- State'ler arası geçiş pürüzsüz olur
- Dosya boyutu küçük kalır (.riv < 50KB)

### Renk Paleti (Flick-Specific)
```
Gövde:           #7C3AED (violet-600) — ana renk
Gövde shadow:    #6D28D9 (violet-700) — karın/iç kısım
Kulak içi:       #A78BFA (violet-400) — açık vurgu
Gözler (beyaz):  #FAFAFA
Pupil:           #F59E0B (amber-500) — parlak, dikkat çekici
Burun:           #EC4899 (pink-500) — küçük, sevimli
Gözlük çerçeve:  #D4D4D8 (zinc-300) — metalik his
Gözlük cam:      #93C5FD (blue-300) opacity 30% — hafif yansıma
```

---

## 📚 ÜCRETSİZ KAYNAK LİSTESİ

### Referans Toplama
| Kaynak | Link | Ne İçin |
|--------|------|---------|
| Bumble (kendi telefonun) | App Store / Google Play | Gerçek ekran screenshot'ları |
| Figma - Bumble UI Kit | figma.com/community/file/1429553897830419251 | Spacing, radius, renk değerleri |
| Figma - Bumble Redesign | figma.com/community/file/1360260686633958545 | Alternatif layout fikirleri |
| Figma - Duolingo UI Kit | figma.com/community/file/1279168389289425844 | Gamification UI pattern'ları |
| Banani.co | banani.co/references | Ücretsiz, kayıtsız, tüm ekranlar |
| Dribbble | dribbble.com/tags/bumble | Redesign konseptleri |

### Araç & Teknoloji
| Araç | Link | Ne İçin |
|------|------|---------|
| Rive Editor | rive.app (ücretsiz) | Flick maskot tasarımı + animasyon |
| rive-react-native | npm: @rive-app/react-native | RN entegrasyonu |
| react-native-reanimated | npm | Swipe + mikro animasyonlar |
| react-native-gesture-handler | npm | Swipe gesture'ları |
| Expo Haptics | expo-haptics | Dokunsal geri bildirim |

### Eğitim & İlham
| Kaynak | Link | Ne İçin |
|--------|------|---------|
| Duolingo Lip Sync Blog | blog.duolingo.com/world-character-visemes/ | Rive State Machine mantığı |
| Rive RN Docs | rive.app/docs/runtimes/react-native | Entegrasyon rehberi |
| DEV.to Rive Mascot Guide | dev.to (Duolingo-style mascot) | Adım adım maskot oluşturma |
| Duolingo Design Breakdown | medium.com/@assenavseolb | Animasyon pattern'ları |
| Apple - Duo Evolution | developer.apple.com/news/?id=e2e1faj4 | Karakter tasarım felsefesi |

---

## ⚡ HIZLI BAŞLANGIÇ CHECKLIST

### Bu Hafta Yapılacaklar:

- [ ] Bumble'ı indir, 6 ekranın screenshot'ını al
- [ ] Figma'dan Bumble + Duolingo UI Kit'lerini Duplicate et
- [ ] rive.app'de ücretsiz hesap aç
- [ ] Rive Community'den kedi/hayvan animasyonlarını incele (ilham)
- [ ] Flick'in ilk statik çizimini yap (kağıt veya Figma)
- [ ] Bu dokümanı CLAUDE.md'ye ekle veya aynı dizine koy
- [ ] design-tokens.md dosyasını güncelle (Flick renkleri ekle)

### Claude Code İlk Oturum:
```
"CLAUDE.md, design-tokens.md ve bumble-moodflix-reference.md 
dosyalarını oku. Bugünkü görev: SwipeCard komponentini Bumble 
referansına göre yeniden yaz. Sağ alt köşeye maskot alanı bırak.
react-native-reanimated + gesture-handler kullan."
```
