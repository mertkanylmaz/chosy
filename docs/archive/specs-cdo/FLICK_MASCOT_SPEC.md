# SPEC HAZIR: Flick Mascot (Rive Animation)

**CDO:** MoodFlix Design System Owner
**Tarih:** 2026-03-28
**Bagimliliklar:** `rive-react-native` paketi, `constants/Colors.ts`, `constants/animations.ts`
**Once incelenmesi gereken:** Mevcut `components/Lumi/index.tsx` component API'si (props uyumu icin)

---

## 1. Karakter Tasarimi — "Flick"

### Konsept
Sinematik kedi. Minimalist, geometric, butun boyutlarda okunabilir. Film seridi kuyrugu ile sinema temasini tasir. Violet govde ile MoodFlix marka rengini sahiplenir.

### Canvas
- **Master artboard:** 256x256px
- **Export boyutlari:** 48, 96, 120, 256px (Rive runtime'da scale)
- **Background:** Transparent (her yerde kullanilabilmesi icin)

### 4 Layer Yapisi

#### Layer 1: `body`
- **Sekil:** Yuvarlatilmis kedi silueti, kafa govdeden buyuk (chibi oran ~60/40)
- **Renk:** `Colors.accentHover` (#7C3AED) — govde dolgusu
- **Kenar:** 2px `Colors.accentPrimary` (#8B5CF6) — hafif parlak kenar
- **Kafa formu:** Yuvarlak, iki sivri kulak (uc nokta: accentPrimary'nin %80 opak versiyonu)
- **Govde formu:** Oval, alta dogru daralan, kuyrukla birlesik
- **Oturuyor pozu:** Varsayilan idle pozu, onden gorunum

#### Layer 2: `eyes`
- **Konum:** Kafanin yatay merkezinde, dikeyde %40 yukarida
- **Boyut:** Her goz 36x28px (256px canvas'ta)
- **Varsayilan:** Buyuk yuvarlak gozler, amber/gold iris
  - Iris rengi: `Colors.gold` (#D4A843)
  - Pupil: `Colors.bgPrimary` (#0A0A0A), dikey kedi pupili
  - Highlight: `Colors.goldLight` (#F0D78C), sag ust 6px daire
- **Expression varyantlari** (bone/shape key ile):
  - `normal` — tam acik, yuvarlak pupil
  - `happy` — alt kapak yukari (gulmece gozleri, "^  ^" seklinde)
  - `sad` — ust kapak yari kapali, pupil asagi
  - `surprised` — pupil genisledi (2x), gozler %120 boyut
  - `love` — iris yerine kalp seklinde pupil (`Colors.error` #EF4444)
  - `sleepy` — gozler %20 acik, yavas kirpma
  - `thinking` — gozler saga yukari bakiyor, tek kas kalkmis

#### Layer 3: `tail`
- **Sekil:** Film seridi motifi — kuyruk gercek 35mm film seridi gibi
  - Govdeden sola/saga cikiyor (poza gore)
  - Kenarlarinda kucuk film kareleri (perforation delikleri)
  - Kare delikleri: `Colors.bgElevated` (#27272A)
- **Renk:** `Colors.accentPrimary` (#8B5CF6) govde, film kareleri `Colors.bgCard` (#18181B)
- **Idle animasyon:** Yavas sallama (sinusoidal, 3s period, +/-15deg)
- **Boyut:** Kuyruk uzunlugu govde yuksekliginin %70'i

#### Layer 4: `effects`
- Karakter etrafinda opsiyonel partikul/glow efektleri
- **Sparkle:** 3-5 kucuk yildiz, `Colors.gold` (#D4A843), rastgele fade in/out
  - Her sparkle: 4-kollu yildiz, 8px (256px canvas'ta)
  - Ömur: 0.8-1.5s arasi rastgele
  - Pozisyon: Karakterin 120% bounding box'i icinde rastgele
- **Glow:** Karakterin arkasinda yumusak hale
  - Renk: `Colors.accentDim` (rgba(139,92,246,0.12))
  - Boyut: Karakter boyutunun %140'i
  - Animasyon: Yavas pulse, 2s period, opacity 0.08-0.15
- **Kalpler:** `love` state'inde 3 kalp yukari uciyor
  - Renk: `Colors.error` (#EF4444) + `Colors.gold` (#D4A843) karisik
  - Yol: Bezier yukari+hafif saga/sola, 1.2s, fade out
- **Soru isareti:** `thinking` state'inde kafanin ustunde
  - Renk: `Colors.gold` (#D4A843)
  - Animasyon: Bounce in (BOUNCE_CONFIG), 0.5s bekle, fade out 0.3s
- **Konfeti:** `celebration` input true oldugunda
  - 12 parcacik, `Colors.accentPrimary` + `Colors.gold` + `Colors.success` karisik
  - Yukari firlama + gravity ile dusme, 2s toplam

---

## 2. State Machine

### 8 Emotion State

| # | State | Tetikleyici | Body | Eyes | Tail | Effects | Dongu |
|---|-------|-------------|------|------|------|---------|-------|
| 0 | `idle` | Varsayilan, hicbir sey olmuyorken | Yavas nefes (scale 0.98-1.02, 2s period) | Normal, yavas kirpma (her 3-5s) | Yavas sallama (+/-15deg, 3s) | Glow pulse | Sonsuz |
| 1 | `happy` | Watchlist ekleme (sag swipe), basarili islem | Kucuk bounce (scale 1→1.15→1, 0.4s) | Happy squint ("^ ^") | Hizli sallama (+/-25deg, 0.8s period) | 3 sparkle burst | Bounce 1x → idle'a don |
| 2 | `sad` | Skip (sol swipe) | Hafif cukulme (scale 1→0.95, 0.3s) | Sad, yavas bakis asagi | Sarkilma, yavas (1x sallama sonra durma) | Glow kararir (opacity 0.05) | 1x → 2s bekle → idle'a don |
| 3 | `thinking` | AI processing, mood analizi | Hafif yana yatma (rotate 0→5→-5→0, 2s) | Thinking, saga yukari bakis | Yavas ritmik sallama (1.5s period) | Soru isareti bounce | Sonsuz (processing bitene kadar) |
| 4 | `excited` | Mood girildi, "Find Movies" basildi | 3x ziplama (translateY 0→-20→0, her biri 0.25s) | Surprised buyuk gozler → happy squint | Cok hizli sallama (+/-30deg, 0.5s) | Sparkle rain (5-8 sparkle) | 3 bounce → idle'a don |
| 5 | `surprised` | Surprise card goruntulendi | Geri cekilis (scale 1→0.9→1.1→1, 0.5s) | Surprised — pupil 2x, gozler %120 | Dik duruyor (momentlik freeze) → hizli sallama | 1 buyuk sparkle pop | 1x → 1s bekle → idle'a don |
| 6 | `love` | Film detay acildi, yuksek match score (>85%) | Hafif one egilme (rotate 3deg, 0.3s) | Love kalp pupiller | Kalp seklinde kivirma (uca dogru) | 3 kalp yukari uciyor | Kalpler 1x → idle'a don |
| 7 | `sleepy` | 30+ saniye kullanici etkilesimi yok | Yavas oturma/yaslanma (rotate 0→8deg, 2s) | Sleepy, gozler kapaniyor | Govdeye yakin sarkilma, neredeyse hareketsiz | Glow minimum (0.03) | Sonsuz (etkilesim gelene kadar) |

### State Gecis Kurallari
- Her state'ten herhangi baska state'e gecilebilir (tam bagli graf)
- Gecis suresi: **TIMING_CONFIG** (300ms, ease bezier) — opacity crossfade
- `celebration` input true olursa: o anki state'in uzerine konfeti efekti eklenir (state degismez)
- `sleepy`'den cikis: herhangi bir input degisikligi → once kisa "uyanma" (gozler aciliyor, 0.3s) → hedef state

---

## 3. State Machine Inputs (CTO'nun Set Edecegi)

| Input | Tip | Deger Araligi | Aciklama |
|-------|-----|---------------|----------|
| `mood` | Number | 0-7 | State index: 0=idle, 1=happy, 2=sad, 3=thinking, 4=excited, 5=surprised, 6=love, 7=sleepy |
| `is_swiping` | Boolean | true/false | Swipe gesture aktifken true — idle animasyon durur, karakter hafif "takip" yapar |
| `swipe_direction` | Number | 0-3 | 0=none, 1=left, 2=right, 3=down — swipe yonune gore karakter tepkisi |
| `celebration` | Boolean | true/false | true olunca konfeti + buyuk bounce overlay efekti |

### Input → State Mapping (Uygulama Tarafinda)

```
Olay                          → mood input → Ek input
─────────────────────────────────────────────────────────
Uygulama acildi               → 0 (idle)
Mood metin yaziliyor           → 0 (idle)
"Find Movies" basildi         → 4 (excited)
AI processing devam ediyor    → 3 (thinking)
AI sonuc geldi                → 1 (happy)
Feed'de kart gosteriliyor     → 0 (idle)    → is_swiping degisir
Saga swipe (watchlist)        → 1 (happy)   → swipe_direction=2
Sola swipe (skip)             → 2 (sad)     → swipe_direction=1
Asagi swipe (next)            → 0 (idle)    → swipe_direction=3
Surprise card cikti           → 5 (surprised)
Film detay acildi             → 6 (love)
30s hareketsizlik             → 7 (sleepy)
Milestone ulasildi            → 1 (happy)   → celebration=true
Streak kazanildi              → 4 (excited)  → celebration=true
```

### `is_swiping` Davranisi
Swipe gesture aktifken:
- Idle animasyonlar durur (nefes, kuyruk normal ritmini kaybeder)
- Karakter hafifce swipe yonune dogru egilir (max 8deg rotate)
- Gozler swipe yonune bakar
- Swipe bitince (release): yondeki state'e gec (happy/sad/idle)

---

## 4. Boyut Varyantlari

### 48px — Card Corner

| Ozellik | Deger |
|---------|-------|
| **Kullanim** | SwipeCard sag alt kose |
| **Detay seviyesi** | Minimal — govde silueti + gozler, kuyruk yok, efekt yok |
| **Aktif state'ler** | idle, happy, sad (diger state'ler idle'a fallback) |
| **Padding:** | 0 — kart kenarinda oturur |
| **Konum:** | `position: absolute`, `bottom: Theme.spacing.sm (8px)`, `right: Theme.spacing.sm (8px)` |
| **Overlay:** | Poster gradient'inin uzerine (zIndex: 10) |
| **Animasyon kisitlamasi** | Sadece scale + opacity, translate/rotate yok (performans) |
| **Goz detayi** | Sadece iris + pupil, highlight yok |

### 96px — Loading / AI Processing

| Ozellik | Deger |
|---------|-------|
| **Kullanim** | `AIProcessingOverlay` icinde, mevcut spiral animasyonun merkezinde |
| **Detay seviyesi** | Orta — govde + gozler + kuyruk (basitlestirilmis, film kareleri yok) |
| **Aktif state'ler** | thinking (varsayilan), excited (sonuc geldiginde) |
| **Konum:** | Yatay ve dikey merkez, spiral halkalarin icinde |
| **Efektler:** | Kendi glow'u yerine spiral animasyonun glow'unu kullanir |
| **Gecis:** | thinking → excited (0.3s TIMING_CONFIG), 1s bekle → overlay kapanir |

### 120px — Empty State

| Ozellik | Deger |
|---------|-------|
| **Kullanim** | `EmptyState` component icinde, mesajin ustunde |
| **Detay seviyesi** | Tam — govde + gozler + kuyruk (film seridi detayli) + sparkle efekti |
| **Aktif state'ler** | sad (varsayilan — "henuz mood yok"), idle (genel bos durumlar) |
| **Konum:** | Yatay merkez, dikeyde ekranin %35'inde |
| **Alt mesaj:** | Flick'in Theme.spacing.lg (24px) altinda, `Theme.typography.body`, `Colors.textSecondary` |
| **CTA buton:** | Alt mesajin Theme.spacing.md (16px) altinda |

### 256px — Onboarding

| Ozellik | Deger |
|---------|-------|
| **Kullanim** | `onboarding.tsx` tanitim ekrani |
| **Detay seviyesi** | Tam + ekstra — tum layer'lar, zengin efektler, film seridi kuyruk detayli |
| **Aktif state'ler** | Tumu — onboarding sekansinda state'ler arasi gezinir |
| **Konum:** | Yatay merkez, dikeyde ekranin %25'inde (ustlerde) |
| **Giris animasyonu:** | scale 0→1 (BOUNCE_CONFIG, ~0.5s) + fade in (FAST_TIMING) |
| **Onboarding sekansi:** |
|   | Adim 1: `excited` (tanitim) |
|   | Adim 2: `thinking` (mood aciklamasi) |
|   | Adim 3: `happy` (swipe aciklamasi) |
|   | Adim 4: `love` (basla butonu) |
| **Sparkle:** | Surekli 3-5 sparkle, idle'da bile |

---

## 5. Lumi → Flick Gecis Plani

Mevcut `components/Lumi/index.tsx` silinmeyecek, wrapper'a donusecek:

### Faz 1 — Component Iskeleti (CTO hemen baslayabilir)
```typescript
// components/Flick/index.tsx
export interface FlickProps {
  /** Piksel boyutu — Rive runtime scale eder */
  size: 48 | 96 | 120 | 256;
  /** Emotion state index (0-7) */
  mood: FlickMood;
  /** Swipe gesture aktif mi */
  isSwiping?: boolean;
  /** Swipe yonu (0=none, 1=left, 2=right, 3=down) */
  swipeDirection?: 0 | 1 | 2 | 3;
  /** Milestone/streak kutlama efekti */
  celebration?: boolean;
  /** Sparkle efektleri (varsayilan: size >= 120) */
  showEffects?: boolean;
  /** Dis container stili */
  style?: ViewStyle;
}

export type FlickMood =
  | 'idle'      // 0
  | 'happy'     // 1
  | 'sad'       // 2
  | 'thinking'  // 3
  | 'excited'   // 4
  | 'surprised' // 5
  | 'love'      // 6
  | 'sleepy';   // 7
```

### Faz 2 — Rive Dosyasi Entegrasyonu
- `.riv` dosyasi `assets/flick/flick.riv` konumunda
- `rive-react-native` paketi ile yukleme
- State machine inputlari Rive editor'deki isimlerle eslesecek

### Faz 3 — Lumi Deprecation
- `components/Lumi/index.tsx` → iceride `<Flick>` render eder, eski props'lari map eder
- Tum mevcut Lumi kullanim yerlerinde calismaya devam eder
- 1 sprint sonra dogrudan Flick'e gecis tamamlanir

### Props Mapping (Lumi → Flick)

| Lumi Prop | Flick Prop | Donusum |
|-----------|------------|---------|
| `size: 'small'` | `size: 48` | Direkt |
| `size: 'medium'` | `size: 96` | Direkt |
| `size: 'large'` | `size: 120` | 140→120 (yeni spec) |
| `mood: 'idle'` | `mood: 'idle'` | Ayni |
| `mood: 'thinking'` | `mood: 'thinking'` | Ayni |
| `mood: 'happy'` | `mood: 'happy'` | Ayni |
| `mood: 'excited'` | `mood: 'excited'` | Ayni |
| `mood: 'calm'` | `mood: 'idle'` | Fallback |
| `mood: 'searching'` | `mood: 'thinking'` | Fallback |
| `showParticles` | `showEffects` | Rename |
| `showGlow` | (Rive icinde) | Kaldirildi — Rive kendi glow'unu yonetir |

---

## 6. Rive Dosya Yapisi (Rive Editor Icin)

### Artboard: `FlickMain` (256x256)

### State Machine: `FlickController`

**Inputs:**
- `mood` — Number (0-7)
- `isSwiping` — Boolean
- `swipeDirection` — Number (0-3)
- `celebration` — Boolean

**Layers (alttan uste):**
1. `EffectsBack` — Glow hale (arkadaki)
2. `Tail` — Film seridi kuyruk
3. `Body` — Govde + kulaklar
4. `Eyes` — Gozler + pupiller + kapaklar
5. `EffectsFront` — Sparkle, kalp, soru isareti, konfeti (ondeki)

**Animations (Timeline):**
- `idle_loop` — 4s, loop
- `happy_burst` — 0.8s, one-shot → blend to idle_loop
- `sad_droop` — 0.6s, one-shot → 2s hold → blend to idle_loop
- `thinking_loop` — 3s, loop
- `excited_bounce` — 1s, one-shot → blend to idle_loop
- `surprised_pop` — 0.8s, one-shot → blend to idle_loop
- `love_hearts` — 1.5s, one-shot → blend to idle_loop
- `sleepy_loop` — 4s, loop
- `wake_up` — 0.5s, one-shot (sleepy'den cikis gecisi)
- `celebration_confetti` — 2s, one-shot (additive, state'in uzerine)
- `blink` — 0.3s, one-shot (rastgele tetiklenir, her 3-5s)
- `swipe_lean` — 0.2s, blended (is_swiping aktifken)

---

## 7. Yeni Token Gereksinimleri

Mevcut token'larla buyuk olcude kapsaniyor. Ek gereksinimler:

| Token | Hex | Eklenecek Yer | Kullanim |
|-------|-----|---------------|----------|
| `Colors.flickBody` | `#7C3AED` | `Colors.ts` | = accentHover, semantik alias |
| `Colors.flickEyes` | `#D4A843` | `Colors.ts` | = gold, semantik alias |
| `Colors.flickHighlight` | `#F0D78C` | `Colors.ts` | = goldLight, semantik alias |

**Not:** Bunlar mevcut token'larin alias'lari. CTO ister direkt mevcut token'lari kullanir, ister alias ekler. Fonksiyonel fark yok, ama kod okunabilirligi icin alias onerilir.

---

## 8. Performans Gereksinimleri

| Kural | Deger |
|-------|-------|
| 48px instance max draw call | 2 (govde + gozler) |
| 96px instance max draw call | 4 (govde + gozler + kuyruk + 1 efekt) |
| Frame rate hedefi | 60fps tum boyutlarda |
| Ayni anda max Flick instance | 2 (ornegin tab bar + kart kosesi) |
| Rive dosya boyutu hedefi | < 150KB |
| Memory limiti | < 5MB runtime |
| Lazy load | 48px ve 96px on-demand, 120/256px ekrana girdiginde |

---

## 9. Erisilebilirlik

| Ozellik | Deger |
|---------|-------|
| `accessibilityLabel` | "Flick, MoodFlix mascot" |
| `accessibilityRole` | "image" |
| `accessibilityState` | `{ busy: mood === 'thinking' }` |
| Reduced motion | `useReducedMotion()` true ise: statik gorsel, animasyon yok |
| Minimum dokunma alani | 48px instance bile 44x44 hit area (padding ile) |

---

## 10. QA Checklist

- [ ] Tum renkler `Colors.*` token'larindan (hex hardcode yok)
- [ ] PlayfairDisplay kullanilmiyor (Flick'te tipografi yok)
- [ ] 48px boyut 44px minimum touch target'i karsilar
- [ ] 8 state'in her biri dogru tetiklenip idle'a donuyor
- [ ] `celebration` overlay tum state'lerin ustunde calisiyor
- [ ] `sleepy` → baska state gecisinde "uyanma" animasyonu var
- [ ] `is_swiping` aktifken idle loop duruyor
- [ ] Reduced motion modunda statik gorsel
- [ ] iPhone SE (375px) → 15 Pro Max (430px) arasinda sorunsuz
- [ ] 2 simultane instance'da 60fps korunuyor
- [ ] `.riv` dosya boyutu < 150KB
