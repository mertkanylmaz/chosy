# SPEC HAZIR: P8.1 Taste Calibration Flow

**CDO:** MoodFlix Design System Owner
**Tarih:** 2026-04-07
**Hedef dosya:** `app/onboarding.tsx` (mevcut 3-slide akisina 2 yeni adim eklenir)
**Yeni componentler:** `components/Onboarding/` klasoru
**Bagimliliklar:** P5.2 archetypeEngine, P5.1 users.archetype_id, constants/archetypes.ts
**Once incelenmesi gereken:** Mevcut `app/onboarding.tsx`, `services/archetypeEngine.ts`, `constants/archetypes.ts`, `types/index.ts` (TasteProfile)

---

## Genel Bakis

Mevcut onboarding 3 tanitim slide'indan olusuyor (Feel it, Swipe it, Save it). Kullanici arketip kazanmiyor — profil bos basliyor. P8.1 ile onboarding'e **Taste Calibration** adimi ekleniyor: 6 senaryo-bazli soru karti ile kullanicinin TasteProfile boyutlari hesaplanir, `computeArchetype()` calistirilir ve sonuc **Archetype Reveal** animasyonuyla gosterilir.

### Yeni Akis

```
Slide 0: Feel it  (mevcut)
Slide 1: Swipe it (mevcut)
Slide 2: Save it  (mevcut)
   ↓ "Continue" butonuyla gecis
Slide 3: Taste Calibration (6 soru karti) ← YENi
   ↓ Son sorudan sonra otomatik gecis
Slide 4: Archetype Reveal              ← YENi
   ↓ "Let's Go" butonu → finishOnboarding()
```

> Mevcut 3 slide horizontal FlatList KORUNUR. Slide 3-4 ayri ekran degil — ayni FlatList'e eklenir VEYA CTO tercih ederse slide 2 "Continue" butonu yeni bir phase'e gecer (state-based). CTO implementasyonda karar verir.

---

## Ekran Yapisi — Taste Calibration (Slide 3)

```
┌────────────────────────────────────────┐
│                            Skip        │  ← Mevcut skip butonu KORUNUR
│                                        │
│     STEP 4 OF 5                        │  ← Progress indicator
│     ═══════════●══════                 │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │   Friday night. You're alone     │  │  ← Senaryo metni
│  │   with snacks. What's the        │  │
│  │   vibe?                          │  │
│  │                                  │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  ⚡ Heart-pounding action  │  │  │  ← Secenek A
│  │  └────────────────────────────┘  │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  🌀 A mind-bending puzzle  │  │  │  ← Secenek B
│  │  └────────────────────────────┘  │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  💧 A beautiful cry        │  │  │  ← Secenek C
│  │  └────────────────────────────┘  │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  ☀️ Something hilarious    │  │  │  ← Secenek D
│  │  └────────────────────────────┘  │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│         ● ● ● ●○○                      │  ← Mini dot progress (6 soru)
│                                        │
└────────────────────────────────────────┘
```

---

## Component 1: TasteCalibration

Ana container — 6 soru karti arasinda gecis yapar, cevaplari toplar, sonunda `computeArchetype()` calistirir.

### State

```typescript
interface TasteCalibrationProps {
  /** Tum sorular cevaplandiktan sonra cagirilir */
  onComplete: (archetypeId: number | null, answers: CalibrationAnswer[]) => void;
  /** Skip butonu icin — dogrudan onComplete(null, []) cagirir */
  onSkip: () => void;
}

interface CalibrationAnswer {
  questionId: number;
  optionIndex: number;
}
```

### Layout

| Element | Deger |
|---------|-------|
| Container | flex: 1, `Colors.background`, paddingHorizontal: `Theme.spacing.lg` (24px) |
| paddingTop | `useSafeAreaInsets().top + 16` |
| Icerik alignment | center (dikey), merkez |

### Soru Gecis Animasyonu

| Ozellik | Deger |
|---------|-------|
| Cikis | FadeOutLeft, 200ms |
| Giris | FadeInRight, 300ms, springify().damping(18) |
| Tetikleyici | Secenek secildiginde 400ms bekle → sonraki soru |
| Bekle nedeni | Kullanicinin secimini gormesi + haptic geri bildirim |

---

## Component 2: ProgressBar

Ust kisimda kalan, aktif soruyu gosteren ilerleme cubugu.

### Gorsel

```
STEP 4 OF 6
═══════════════●═══════════
```

### Stiller

| Element | Deger |
|---------|-------|
| Etiket | `onboarding.stepOf` → "STEP {{current}} OF {{total}}" |
| Font | Inter Bold 12px, `Colors.accentPrimary`, letterSpacing: 1.5, textTransform: uppercase |
| marginBottom | `Theme.spacing.md` (16px) |
| Bar container | height: 4px, `Colors.bgSubtle`, borderRadius: 2px, tam genislik |
| Dolgu | height: 4px, `Colors.accentPrimary`, borderRadius: 2px |
| Dolgu genisligi | `(currentQuestion / totalQuestions) * 100%` |
| Dolgu animasyonu | `withTiming`, 300ms, Easing.out(Easing.cubic) |
| Dot (aktif nokta) | 12px daire, `Colors.accentPrimary`, dolgunun ucunda, position: absolute |
| Dot glow | shadowColor: `Colors.accentPrimary`, shadowOpacity: 0.6, shadowRadius: 8 |

---

## Component 3: QuestionCard

Tek bir soru ve seceneklerini gosteren kart.

### Stiller

| Element | Deger |
|---------|-------|
| Container | `Colors.bgCard`, borderRadius: `Theme.borderRadius.xl` (24px), padding: `Theme.spacing.lg` (24px) |
| Border | 1px `Colors.cardBorder` |
| Golge | `Theme.shadow.card` |
| Senaryo metni font | Inter SemiBold 20px, `Colors.textPrimary`, lineHeight: 30, textAlign: center |
| Senaryo marginBottom | `Theme.spacing.xl` (32px) |

### Option Button Stiller

| Element | Deger |
|---------|-------|
| Container | `Colors.bgElevated`, borderRadius: `Theme.borderRadius.lg` (16px), padding: 16px dikey / 20px yatay |
| Border | 1px `Colors.white10` |
| marginBottom | `Theme.spacing.sm` (8px) |
| Ikon | Archetype emoji, 20px font, marginRight: `Theme.spacing.sm` (8px) |
| Metin | Inter Medium 15px, `Colors.textPrimary` |
| Min yukseklik | 52px (touch target) |
| flexDirection | row, alignItems: center |

### Secim Animasyonu (Option Pressed)

| Asamak | Deger |
|--------|-------|
| 1. Basma | scale(0.97), 100ms |
| 2. Secildi | border → `Colors.accentPrimary` (1.5px), bg → `Colors.accentDim`, 200ms |
| 3. Ikon pulse | secilen secenek ikonu scale(1.0 → 1.2 → 1.0), 300ms |
| 4. Haptic | hapticLight() aninda, hapticMedium() secim onayinda (200ms sonra) |
| 5. Diger secenekler | opacity: 0.4, 200ms fade |
| 6. Gecis | 400ms bekle → sonraki soru animasyonu |

### Secilmis Durum

| Element | Deger |
|---------|-------|
| Border | 1.5px `Colors.accentPrimary` |
| Arka plan | `Colors.accentDim` |
| Ikon | Orijinal emoji (degismez) |
| Metin renk | `Colors.textPrimary` (degismez) |
| Check isareti | Yok — border rengi yeterli geri bildirim |

---

## Component 4: ArchetypeReveal

Son soru cevaplandiktan sonra gosterilen tam ekran reveal animasyonu.

### Gorsel

```
┌────────────────────────────────────────┐
│                                        │
│                                        │
│              ✦  ·  ✦                   │  ← Dekoratif parcaciklar
│           ·        ·                   │
│                                        │
│            ┌──────────┐                │
│            │          │                │
│            │   🎨     │                │  ← Arketip emoji, 80px
│            │          │                │
│            └──────────┘                │
│        Archetype circle                │
│                                        │
│        The Visual Poet                 │  ← Arketip adi
│                                        │
│   Aesthetics, wonder, artistry.        │  ← Arketip aciklamasi
│   Cinema is your canvas.               │
│                                        │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │        Let's Go ★                │  │  ← CTA butonu
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

### Reveal Animasyon Sirasi (Stagger)

| Asamak | Delay | Animasyon | Sure |
|--------|-------|-----------|------|
| 1. Arka plan fade | 0ms | `Colors.background` → arketip `colorDim` gradient | 600ms |
| 2. Parcaciklar | 200ms | 8-12 kucuk yildiz (✦ · ✧), rastgele pozisyon, FadeIn + scale(0→1) | 800ms |
| 3. Emoji dairesi | 400ms | scale(0 → 1.15 → 1.0) spring bounce | 500ms |
| 4. Glow ring | 500ms | opacity(0→1), scale(0.8→1.0) | 400ms |
| 5. Arketip adi | 700ms | FadeInUp, springify | 400ms |
| 6. Aciklama | 900ms | FadeInUp, opacity(0→1) | 300ms |
| 7. CTA butonu | 1200ms | FadeInUp, springify | 300ms |
| 8. Haptic | 400ms | hapticSuccess() (emoji gozuktugu an) | — |

Toplam reveal suresi: ~1.5s (CTA gorunur hale gelir)

### Stiller

| Element | Deger |
|---------|-------|
| Container | flex: 1, justifyContent: center, alignItems: center |
| Arka plan | LinearGradient: `Colors.background` (top) → arketip `colorDim` (bottom, %40 noktasi) → `Colors.background` (bottom) |
| Emoji dairesi | 120px, borderRadius: 60px, border: 2px arketip `colorPrimary`, bg: arketip `colorDim` |
| Emoji boyut | 56px font |
| Glow ring | 160px, borderRadius: 80px, border: 1px arketip `colorPrimary` opacity 0.3, position: absolute |
| Arketip adi | PlayfairDisplay Bold 32px, `Colors.textPrimary`, textAlign: center, marginTop: `Theme.spacing.lg` (24px) |
| Aciklama | Inter Regular 16px, `Colors.textSecondary`, textAlign: center, maxWidth: 280px, marginTop: `Theme.spacing.sm` (8px), lineHeight: 24 |
| Parcaciklar | Text "✦" ve "·", arketip `colorPrimary`, 8-18px boyut, rastgele top/left, opacity: 0.3-0.8 |

> **Not:** Arketip adi PlayfairDisplay kullanir — bu ozel bir reveal ani, film basligi gibi premium hissettirmeli.

### CTA Butonu

| Element | Deger |
|---------|-------|
| Stil | Mevcut onboarding CTA ile AYNI (LinearGradient violet, 56px yukseklik, 14px radius) |
| Metin | `onboarding.letsGo` → "Let's Go" |
| Ikon | "★" karakter, 16px, marginLeft: 8px |
| Aksiyon | `finishOnboarding()` — AsyncStorage flag + router.replace('/(tabs)') |
| Press | scale(0.97) + hapticLight |

### Arketip null Durumu (Esik Alti)

Eger `computeArchetype()` null donerse (skor < 0.35 — cok nadir):

| Element | Degisiklik |
|---------|-----------|
| Emoji dairesi | "✦" sparkle emoji, `Colors.accentPrimary` |
| Baslik | `onboarding.mysteryType` → "Mystery Cinephile" |
| Aciklama | `onboarding.mysteryDesc` → "Your taste is unique! Watch more films and we'll figure you out." |
| Arka plan gradient | `Colors.accentDim` (varsayilan violet) |

---

## 6 Soru Tasarimi

Her soru bir senaryo ve 4 secenek. Secenekler TasteProfile boyutlarina MAP edilir.

### Soru 1: Duygu Durumu (emotional_state ana eksen)

**Senaryo:** `onboarding.q1` → "Friday night. You're alone with snacks. What's the vibe?"

| Secenek | Emoji | i18n Key | Map Edilen |
|---------|-------|----------|------------|
| A | ⚡ | `onboarding.q1a` → "Heart-pounding action" | energy_level: 0.9, fear: 0.6, anticipation: 0.7 |
| B | 🌀 | `onboarding.q1b` → "A mind-bending puzzle" | thematic_depth: 0.85, surprise: 0.7, anticipation: 0.6 |
| C | 💧 | `onboarding.q1c` → "A beautiful cry" | sadness: 0.8, trust: 0.5, thematic_depth: 0.7 |
| D | ☀️ | `onboarding.q1d` → "Something hilarious" | joy: 0.9, energy_level: 0.6 |

### Soru 2: Gorsel Tercih (visual_style)

**Senaryo:** `onboarding.q2` → "Pick your dream movie look:"

| Secenek | Emoji | i18n Key | Map Edilen |
|---------|-------|----------|------------|
| A | 🎨 | `onboarding.q2a` → "Stunning, every frame a painting" | visual_style: 'lush' |
| B | 📷 | `onboarding.q2b` → "Raw and gritty, like real life" | visual_style: 'raw' |
| C | 🌌 | `onboarding.q2c` → "Weird and experimental" | visual_style: 'experimental' |
| D | 🎬 | `onboarding.q2d` → "Big-budget cinematic" | visual_style: 'cinematic' |

### Soru 3: Tempo (pace_preference + energy_level)

**Senaryo:** `onboarding.q3` → "Your perfect movie pace?"

| Secenek | Emoji | i18n Key | Map Edilen |
|---------|-------|----------|------------|
| A | 🚀 | `onboarding.q3a` → "Fast — no time to breathe" | pace_preference: 'fast', energy_level += 0.3 |
| B | 🎭 | `onboarding.q3b` → "Medium — a nice rhythm" | pace_preference: 'medium' |
| C | 🍃 | `onboarding.q3c` → "Slow and meditative" | pace_preference: 'slow', energy_level -= 0.2 |

> **Not:** Bu soru 3 secenek — daha az secenek, daha net sinyal. 4. secenege gerek yok.

### Soru 4: Bitis Tercihi (ending_preference)

**Senaryo:** `onboarding.q4` → "The credits roll. How do you want to feel?"

| Secenek | Emoji | i18n Key | Map Edilen |
|---------|-------|----------|------------|
| A | 🌅 | `onboarding.q4a` → "Hopeful — everything will be okay" | ending_preference: 'hopeful' |
| B | 💔 | `onboarding.q4b` → "Bittersweet — beauty in the pain" | ending_preference: 'bittersweet' |
| C | ❓ | `onboarding.q4c` → "Open — let me decide" | ending_preference: 'open' |
| D | 🏆 | `onboarding.q4d` → "Triumphant — the hero wins" | ending_preference: 'triumphant' |

### Soru 5: Izleme Ortami (social_context)

**Senaryo:** `onboarding.q5` → "Who's watching with you tonight?"

| Secenek | Emoji | i18n Key | Map Edilen |
|---------|-------|----------|------------|
| A | 🎧 | `onboarding.q5a` → "Just me — headphones on" | social_context: 'alone' |
| B | 💑 | `onboarding.q5b` → "Date night" | social_context: 'couple' |
| C | 🍿 | `onboarding.q5c` → "Friends — the more the merrier" | social_context: 'friends' |
| D | 🏠 | `onboarding.q5d` → "Family movie night" | social_context: 'family' |

### Soru 6: Anlatim Tercihi (narrative_style + thematic_depth)

**Senaryo:** `onboarding.q6` → "What grabs you in a story?"

| Secenek | Emoji | i18n Key | Map Edilen |
|---------|-------|----------|------------|
| A | 🗣️ | `onboarding.q6a` → "Sharp dialogue, real conversations" | narrative_style: 'dialogue-driven', thematic_depth += 0.2 |
| B | 🔀 | `onboarding.q6b` → "Timelines that twist and overlap" | narrative_style: 'nonlinear', thematic_depth += 0.3 |
| C | ➡️ | `onboarding.q6c` → "A clean, powerful A-to-B arc" | narrative_style: 'linear' |
| D | 📖 | `onboarding.q6d` → "Short stories woven together" | narrative_style: 'anthology' |

---

## Cevap → TasteProfile Donusumu

CTO tarafindan implement edilecek `buildCalibrationProfile(answers)` fonksiyonu:

```typescript
/** 6 sorunun cevabindan yaklasik bir TasteProfile uretir */
function buildCalibrationProfile(answers: CalibrationAnswer[]): TasteProfile {
  // Baslangic profil — tum degerler notr
  const profile: TasteProfile = {
    emotional_state: { joy: 0.3, sadness: 0.3, anger: 0.2, fear: 0.2,
                       surprise: 0.3, disgust: 0.1, anticipation: 0.3, trust: 0.3 },
    energy_level: 0.5,
    pace_preference: 'medium',
    visual_style: 'cinematic',
    thematic_depth: 0.5,
    ending_preference: 'hopeful',
    era_preference: { from: 1990, to: 2026 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'alone',
    rewatch_tolerance: true,
  };

  // Her cevap profili modifiye eder (yukaridaki "Map Edilen" kolonlari)
  // Detay: CTO implementasyonda
  return profile;
}
```

Sonra:
```typescript
const profile = buildCalibrationProfile(answers);
const archetypeId = computeArchetype(profile);
// → ArchetypeReveal ekranina gec
// → users.archetype_id = archetypeId (Supabase update)
```

---

## Skip Davranisi

| Durum | Davranis |
|-------|----------|
| Tanitim slide'larinda Skip | Tum onboarding atlanir → `finishOnboarding()` (mevcut davranis) |
| Calibration sirasinda Skip | Sorular atlanir → ArchetypeReveal gosterilMEZ → dogrudan `finishOnboarding()` |
| Skip sonrasi arketip | null — profil bos baslar, normal mood akisiyla daha sonra kazanilir |

Skip butonu metin degisikligi:
- Slide 0-2: `common.skip` (mevcut)
- Slide 3 (calibration): `onboarding.skipCalibration` → "Skip for now"

---

## Dosya Yapisi

```
components/
├── Onboarding/
│   ├── index.ts                ← barrel export
│   ├── TasteCalibration/
│   │   ├── index.tsx           ← 6 soru akisi, state yonetimi
│   │   ├── styles.ts
│   │   └── questions.ts        ← Soru tanimlari + mapping config
│   ├── QuestionCard/
│   │   ├── index.tsx           ← Tek soru render
│   │   └── styles.ts
│   ├── ProgressBar/
│   │   ├── index.tsx
│   │   └── styles.ts
│   └── ArchetypeReveal/
│       ├── index.tsx           ← Reveal animasyonu
│       └── styles.ts
```

**Mevcut dosya degisiklikleri:**
- `app/onboarding.tsx` — Calibration + Reveal phase eklenir
- `locales/en.json` — `onboarding.q*` + `onboarding.stepOf` + `onboarding.letsGo` + `onboarding.mystery*` keys
- `locales/tr.json` — Ayni key'lerin Turkce karsiliklari

---

## i18n Keys (Yeni)

### EN

```json
{
  "onboarding": {
    "stepOf": "STEP {{current}} OF {{total}}",
    "skipCalibration": "Skip for now",
    "letsGo": "Let's Go",
    "mysteryType": "Mystery Cinephile",
    "mysteryDesc": "Your taste is unique! Watch more films and we'll figure you out.",
    "q1": "Friday night. You're alone with snacks. What's the vibe?",
    "q1a": "Heart-pounding action",
    "q1b": "A mind-bending puzzle",
    "q1c": "A beautiful cry",
    "q1d": "Something hilarious",
    "q2": "Pick your dream movie look:",
    "q2a": "Stunning, every frame a painting",
    "q2b": "Raw and gritty, like real life",
    "q2c": "Weird and experimental",
    "q2d": "Big-budget cinematic",
    "q3": "Your perfect movie pace?",
    "q3a": "Fast — no time to breathe",
    "q3b": "Medium — a nice rhythm",
    "q3c": "Slow and meditative",
    "q4": "The credits roll. How do you want to feel?",
    "q4a": "Hopeful — everything will be okay",
    "q4b": "Bittersweet — beauty in the pain",
    "q4c": "Open — let me decide",
    "q4d": "Triumphant — the hero wins",
    "q5": "Who's watching with you tonight?",
    "q5a": "Just me — headphones on",
    "q5b": "Date night",
    "q5c": "Friends — the more the merrier",
    "q5d": "Family movie night",
    "q6": "What grabs you in a story?",
    "q6a": "Sharp dialogue, real conversations",
    "q6b": "Timelines that twist and overlap",
    "q6c": "A clean, powerful A-to-B arc",
    "q6d": "Short stories woven together"
  }
}
```

### TR

```json
{
  "onboarding": {
    "stepOf": "ADIM {{current}} / {{total}}",
    "skipCalibration": "Simdilik atla",
    "letsGo": "Baslayalim",
    "mysteryType": "Gizemli Sinefil",
    "mysteryDesc": "Zevkin benzersiz! Daha fazla film izle, seni taniylim.",
    "q1": "Cuma gecesi. Yalnizsin, atistirmaliklarinla. Hava ne?",
    "q1a": "Kalp durduran aksiyon",
    "q1b": "Zihin buken bir bulmaca",
    "q1c": "Guzelce aglamak",
    "q1d": "Kahkaha tufani",
    "q2": "Hayalindeki film goruntusu:",
    "q2a": "Her kare bir tablo gibi",
    "q2b": "Ham ve gercekci, hayatin icinden",
    "q2c": "Tuhaf ve deneysel",
    "q2d": "Buyuk butceli sinematik",
    "q3": "Ideal film tempon?",
    "q3a": "Hizli — nefes alma zamani yok",
    "q3b": "Orta — guzel bir ritim",
    "q3c": "Yavas ve meditatif",
    "q4": "Jenerik akiyor. Nasil hissetmek istersin?",
    "q4a": "Umutlu — her sey duzulecek",
    "q4b": "Aci-tatli — acinin icindeki guzellik",
    "q4c": "Acik uclu — karar benim",
    "q4d": "Zafer — kahraman kazanir",
    "q5": "Bu gece kim izliyor seninle?",
    "q5a": "Sadece ben — kulakliklar takili",
    "q5b": "Romantik bir gece",
    "q5c": "Arkadaslar — ne kadar cok o kadar iyi",
    "q5d": "Aile film gecesi",
    "q6": "Bir hikayede seni ne yakalar?",
    "q6a": "Keskin diyaloglar, gercek sohbetler",
    "q6b": "Birbirine giren zaman cizelgeleri",
    "q6c": "Temiz, guclu bir A'dan B'ye arc",
    "q6d": "Birbirine dokunan kisa hikayeler"
  }
}
```

---

## Edge Case'ler

| Durum | Davranis |
|-------|----------|
| Kullanici geri butonu (Android) | Calibration'da: onceki soruya don (geri animasyonu: FadeInLeft). Slide 0-2'de: mevcut davranis |
| Soru 3 (3 secenek) | Ayni QuestionCard component — options.length dinamik. 3 ve 4 secenek desteklenmeli |
| computeArchetype null | Mystery Cinephile fallback (yukaridaki spec) |
| Supabase offline | archetype_id yazimi BASARISIZ olabilir — AsyncStorage'a kaydet, sonraki acilista retry |
| Animasyon sirasinda dokunma | Reveal animasyonu sirasinda CTA butonu disable — 1.2s sonra enable |
| iPhone SE (375px) | Soru metni maxWidth: 300px, secenekler tam genislik, 4 secenek sigar (52px * 4 + gap = ~240px) |
| iPhone 15 Pro Max | Ayni layout, daha genis card padding |

---

## Performans Notlari

- 6 soru statik veri — API cagrisi YOK
- `computeArchetype()` saf JS hesaplama — <1ms
- Reveal animasyonu Reanimated (native thread)
- Parcacik animasyonu: max 12 Text elementi — performans sorunu olmaz
- users.archetype_id update'i arka planda (await gerekmez, CTA'yi bloklamaz)

---

## QA Checklist

- [ ] Tum renkler `Colors.*` token'larindan (hardcoded hex YOK)
- [ ] Tum metinler `t()` uzerinden (hardcoded string YOK)
- [ ] PlayfairDisplay SADECE ArchetypeReveal basliginda — soru kartlarinda KULLANILMAZ
- [ ] Inter tum UI metinlerinde (soru, secenek, progress, buton)
- [ ] Touch target >= 44px (secenekler >= 52px)
- [ ] Animasyonlar Reanimated ile, native thread
- [ ] Dark mode only
- [ ] iPhone SE (375px) → 15 Pro Max (430px) responsive
- [ ] Skip dogrudan finishOnboarding() cagirir (calibration atlanir)
- [ ] Geri buton (Android) onceki soruya doner
- [ ] Haptic geri bildirim: light (secim), medium (onay), success (reveal)
- [ ] Mevcut 3 slide REGRESYON yok
- [ ] ProgressBar dolgu animasyonu akici
- [ ] Secenek secim animasyonu 400ms icerisinde tamamlanir
- [ ] Reveal stagger toplam ~1.5s
- [ ] archetype_id null fallback calisiyor ("Mystery Cinephile")
