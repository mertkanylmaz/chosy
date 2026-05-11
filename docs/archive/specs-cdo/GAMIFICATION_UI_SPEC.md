# SPEC HAZIR: Gamification UI

**CDO:** MoodFlix Design System Owner
**Tarih:** 2026-03-28
**Bagimliliklar:** `services/gamification.ts` (backend hazir), `services/history.ts` (backend hazir), `constants/animations.ts`
**Once incelenmesi gereken:** Mevcut `components/Profile/DiscoveryStats/` (badge sistemi zaten var, streak eklenmeli)

---

## Genel Bakis

3 yeni UI component:
1. **StreakBadge** — Feed ekraninda daima gorunen streak sayaci
2. **MilestoneCelebration** — Full-screen overlay, milestone kazanildiginda
3. **StreakCard** — Profile ekraninda streak detay karti

Ek olarak:
4. Mevcut `DiscoveryStats` componentine streak entegrasyonu

---

## Component 1: StreakBadge

### Gorsel
```
  ┌─────────────┐
  │ 🔥  7       │
  └─────────────┘
```
Kompakt pill seklinde badge, ates emojisi + gun sayisi.

### Kullanim Yeri
- **Feed ekrani** (`app/(tabs)/index.tsx`): Sag ust kose, SafeArea icinde
- **Her zaman gorunen** — scroll, swipe ne olursa olsun ustunde
- Tab bar gibi `position: absolute`, ama ustte

### Boyutlar
- Genislik: hug content (min 52px)
- Yukseklik: 32px
- Border radius: `Theme.borderRadius.full` (9999 — pill)
- Ic padding: yatay `Theme.spacing.sm` (8px), dikey `Theme.spacing.xs` (4px)

### Renkler

**Aktif streak (currentStreak >= 1):**
- Arka plan: `Colors.accentDim` (rgba(139,92,246,0.12))
- Kenarlik: 1px `Colors.accentPrimary` (#8B5CF6)
- Emoji: 🔥 (Unicode, dokunmatik ekranda native render)
- Sayi: `Colors.textPrimary` (#FAFAFA), `Theme.typography.h3` (fontSize:16, semibold)

**Sifir streak (currentStreak === 0):**
- Arka plan: `Colors.white05` (rgba(255,255,255,0.05))
- Kenarlik: 1px `Colors.bgSubtle` (#3F3F46)
- Emoji: 🔥 (ama soluk — opacity 0.4)
- Sayi: `Colors.textTertiary` (#71717A)

**Yeni streak kazanildiginda (ilk kez 1'e gectiginde veya arttiginda):**
- 1x pulse animasyonu: scale 1→1.2→1, 0.4s, BOUNCE_CONFIG
- Glow: `Theme.shadow.glow` (violet) 0.5s fade in/out
- Haptic: light

### Konum
```
position: absolute
top: insets.top + Theme.spacing.sm (8px)
right: Theme.spacing.md (16px)
zIndex: 100
```

### Spacing (icindekiler arasi)
- Emoji ile sayi arasi: `Theme.spacing.xs` (4px)

### Durumlar (States)
- `loading`: SkeletonLoader, 52x32px, pill seklinde
- `zero`: Soluk gorunum (yukarida aciklandi)
- `active`: Parlak gorunum
- `incrementing`: Pulse animasyonu (1x, sonra active'e don)

### Props
```typescript
interface StreakBadgeProps {
  /** Mevcut streak gun sayisi */
  currentStreak: number;
  /** Yukleniyor mu */
  loading?: boolean;
  /** Badge'e basildiginda (profil streak detayina navigate) */
  onPress?: () => void;
}
```

### Erisilebilirlik
- `accessibilityLabel`: `"${currentStreak} day streak"`
- `accessibilityRole`: "button" (onPress varsa)
- Minimum dokunma alani: 44x44px (padding ile saglanir)

---

## Component 2: MilestoneCelebration

### Gorsel
```
┌──────────────────────────────────┐
│                                  │
│         ✦  ✦  ✦  ✦  ✦          │  ← Konfeti
│            ✦  ✦  ✦              │
│                                  │
│          ┌──────────┐            │
│          │  Flick   │            │  ← 120px, happy/excited state
│          │  (mascot)│            │
│          └──────────┘            │
│                                  │
│          🏆                      │  ← Milestone icon (32px)
│                                  │
│       Film Connoisseur           │  ← Title
│                                  │
│   100 films! Legendary explorer. │  ← Description
│                                  │
│     ┌──────────────────────┐     │
│     │     Keep Going!      │     │  ← CTA button
│     └──────────────────────┘     │
│                                  │
└──────────────────────────────────┘
```

### Kullanim Yeri
- **Feed ekrani** (`app/(tabs)/index.tsx`) — swipe sonrasi tetiklenir
- `getUnseenMilestones()` sonucu > 0 ise gosterilir
- Ayni anda birden fazla milestone varsa sirayla gosterilir (biri kapaninca sonraki)

### Boyutlar
- **Full screen overlay** — `Dimensions.get('window')` width x height
- Arka plan: `Colors.overlay` (rgba(10,10,10,0.95))
- Icerik alani: yatay `Theme.spacing.xl` (32px) padding

### Icerik Hiyerarsisi (yukaridan asagiya)

#### 1. Konfeti Alani
- Ust %30'luk alan
- 20-30 parcacik
- Renkler: `Colors.accentPrimary` (#8B5CF6), `Colors.gold` (#D4A843), `Colors.success` (#22C55E)
- Animasyon: yukari firlama + gravity dusme, 2.5s, rastgele X pozisyonlari
- Her parcacik: 8x8px kare veya 6px daire, rastgele rotasyon

#### 2. Flick Mascot
- Boyut: 120px
- State: `happy` (normal milestone) veya `excited` (films_100+, streak_30)
- `celebration: true` input'u (konfeti overlay Flick'in kendi efekti degil, disardan)
- Konum: yatay merkez, konfeti alaninin hemen altinda
- **Flick hazir degilse:** Lumi componenti `mood="happy"` `size="large"` fallback

#### 3. Milestone Icon
- DB'deki `icon` alani (emoji string)
- Boyut: 32px fontSize
- Konum: Flick'in `Theme.spacing.lg` (24px) altinda, yatay merkez
- Giris animasyonu: scale 0→1, BOUNCE_CONFIG, 0.3s delay (Flick'ten sonra)

#### 4. Milestone Title
- Tipografi: `Theme.typography.h1` (fontSize:24, bold, Inter)
- Renk: `Colors.textPrimary` (#FAFAFA)
- Konum: icon'un `Theme.spacing.md` (16px) altinda, yatay merkez
- Text align: center
- Giris animasyonu: FadeInDown, 0.4s delay

#### 5. Milestone Description
- Tipografi: `Theme.typography.body` (fontSize:14, Inter)
- Renk: `Colors.textSecondary` (#A1A1AA)
- Konum: title'in `Theme.spacing.sm` (8px) altinda, yatay merkez
- Text align: center
- Max genislik: ekran genisligi - 2 * Theme.spacing.xl (64px)
- Giris animasyonu: FadeInDown, 0.5s delay

#### 6. CTA Butonu — "Keep Going!"
- Genislik: ekran genisligi - 2 * Theme.spacing.xl (64px) = fill
- Yukseklik: 52px
- Border radius: `Theme.borderRadius.lg` (16px)
- Arka plan: `Colors.accentPrimary` (#8B5CF6)
- Metin: "Keep Going!" — `Colors.textOnAccent` (#FFFFFF), Inter semibold 16px
- Konum: description'in `Theme.spacing.xl` (32px) altinda
- Press efekti: scale(0.95) + `Colors.accentHover` (#7C3AED) arka plan
- Golge: `Theme.shadow.glow` (violet)
- Giris animasyonu: FadeInDown, 0.6s delay

### Animasyon Zamanlama Sekansi
```
t=0.0s  — Overlay fade in (TIMING_CONFIG, 300ms)
t=0.1s  — Konfeti baslar (2.5s sure)
t=0.2s  — Flick girer (scale 0→1, BOUNCE_CONFIG)
t=0.3s  — Milestone icon bounce in
t=0.4s  — Title fade in down
t=0.5s  — Description fade in down
t=0.6s  — CTA button fade in down
t=0.7s  — Haptic: heavy (strong)
```

### Kapatma
- **Manuel:** CTA butonuna bas → overlay kapanir
- **Manuel:** Arka plana (overlay'e) bas → overlay kapanir
- **Otomatik kapatma YOK** — kullanici gorene kadar ekranda kalir
- Kapanis animasyonu: FadeOut, FAST_TIMING (150ms)
- Kapandiginda: `markMilestoneSeen(userMilestoneId)` cagrilir

### Ozel Milestone Varyantlari

| Milestone | Fark |
|-----------|------|
| `films_100`, `films_250` | Flick `excited` state, ekstra konfeti (40 parcacik), altin glow |
| `streak_30` | Flick `excited` state, arka plan gradient eklenir: `Colors.accentDim` → `Colors.overlay` |
| Diger tumu | Standart gorunum |

"Ekstra konfeti" olan milestone'larda CTA metni degisir:
- `films_100`: "Legendary! 🏆"
- `films_250`: "Unstoppable! ⭐"
- `streak_30`: "Incredible! 👑"

### Props
```typescript
interface MilestoneCelebrationProps {
  /** Kutlanacak milestone bilgisi */
  milestone: {
    userMilestoneId: string;
    slug: string;
    title: string;
    description: string | null;
    icon: string | null;
    category: 'films' | 'streak' | 'watchlist' | 'mood';
    threshold: number;
  };
  /** Overlay gorunur mu */
  visible: boolean;
  /** Kapatma callback'i — markMilestoneSeen cagrilir, sonraki milestone kontrol edilir */
  onDismiss: () => void;
}
```

---

## Component 3: StreakCard

### Gorsel
```
┌────────────────────────────────────────┐
│ 🔥 Daily Streak                       │  ← Header
├────────────────────────────────────────┤
│                                        │
│   ┌──────┐  ┌──────┐  ┌──────┐       │
│   │  7   │  │  14  │  │  42  │       │
│   │ days │  │ best │  │total │       │
│   │current│ │record│  │active│       │
│   └──────┘  └──────┘  └──────┘       │
│                                        │
│   ┌──────────────────────────────┐    │
│   │ ○ ○ ● ● ● ● ● ● ● ○ ○ ○ ○ │    │  ← Son 14 gun (aktif/pasif dot)
│   │ M T W T F S S M T W T F S S │    │
│   └──────────────────────────────┘    │
│                                        │
│   Next milestone: Week Warrior (7)     │  ← Sonraki hedef
│   ████████████░░░░  5/7                │  ← Progress bar
│                                        │
└────────────────────────────────────────┘
```

### Kullanim Yeri
- **Profile ekrani** (`app/(tabs)/profile.tsx`) — DiscoveryStats'in USTUNE eklenir
- Ayri component: `components/Profile/StreakCard/index.tsx` + `styles.ts`

### Boyutlar
- Genislik: fill parent (ekran genisligi - 2 * Theme.spacing.md (32px))
- Yukseklik: hug content (~200px icerge gore)
- Border radius: `Theme.borderRadius.lg` (16px)
- Ic padding: `Theme.spacing.lg` (24px)

### Renkler
- Kart arka plan: `Colors.bgCard` (#18181B) — opak `Colors.cardSolid` ile ayni
- Kenarlik: 1px `Colors.cardBorder` (rgba(139,92,246,0.15))
- Header icon: 🔥 emoji
- Header text: `Colors.textPrimary` (#FAFAFA)

### Icerik Detaylari

#### A) Header
- Sol: 🔥 emoji (20px) + `Theme.spacing.sm` (8px) + "Daily Streak"
- Tipografi: `Theme.typography.h3` (fontSize:16, semibold, Inter)
- Renk: `Colors.textPrimary`

#### B) 3-Stat Row
Her stat kutusu:

| Ozellik | Deger |
|---------|-------|
| Genislik | esit 3'e bol (flex: 1) |
| Arka plan | `Colors.white05` (rgba(255,255,255,0.05)) |
| Border radius | `Theme.borderRadius.md` (12px) |
| Ic padding | `Theme.spacing.sm` (8px) |
| Aralarindaki bosluk | `Theme.spacing.sm` (8px) |

Stat degerleri:
1. **Current Streak**
   - Sayi: `Theme.typography.h2` (fontSize:20, semibold), `Colors.accentPrimary` (#8B5CF6)
   - Etiket: `Theme.typography.caption` (fontSize:12), `Colors.textTertiary` (#71717A)
   - Alt etiket: "days" — `Colors.textSecondary`

2. **Best Record**
   - Sayi: `Theme.typography.h2`, `Colors.gold` (#D4A843)
   - Etiket: "best" + alt etiket "record"

3. **Total Active**
   - Sayi: `Theme.typography.h2`, `Colors.textPrimary` (#FAFAFA)
   - Etiket: "total" + alt etiket "active"

Stat row ile dot row arasi: `Theme.spacing.lg` (24px)

#### C) 14-Gun Dot Row (Streak Takvimi)
- 14 daire, yatay, esit aralikli
- Her daire: 10px cap

**Aktif gun (streak'e dahil):**
- Dolgu: `Colors.accentPrimary` (#8B5CF6)
- Golge: ince violet glow (shadowColor: accentPrimary, opacity: 0.3, radius: 4)

**Bugun (aktif ve ozel):**
- Dolgu: `Colors.accentPrimary` (#8B5CF6)
- Kenarlik: 2px `Colors.gold` (#D4A843)

**Pasif gun:**
- Dolgu: `Colors.bgSubtle` (#3F3F46)
- Kenarlik: yok

**Gun etiketleri (altinda):**
- Tek harf: M, T, W, T, F, S, S (tekrar)
- Tipografi: fontSize 9, Inter
- Renk: `Colors.textTertiary` (#71717A)
- Konum: dot'un `Theme.spacing.xs` (4px) altinda

Dot row ile progress bar arasi: `Theme.spacing.lg` (24px)

#### D) Sonraki Milestone + Progress Bar

**Baslik satiri:**
- "Next: " + milestone title + " (" + threshold + ")"
- Tipografi: `Theme.typography.caption` (fontSize:12)
- "Next: " rengi: `Colors.textTertiary`, milestone title: `Colors.textSecondary`

**Progress bar:**
- Konum: basligin `Theme.spacing.sm` (8px) altinda
- Yukseklik: 6px
- Border radius: `Theme.borderRadius.sm` (8px) — pill
- Arka plan (bos): `Colors.bgSubtle` (#3F3F46)
- Dolgu (progress): `Colors.accentPrimary` (#8B5CF6)
- Dolgu animasyonu: genislik 0→hedef, TIMING_CONFIG (300ms), mount'ta
- Deger etiketi: saga yasli, baslik satirinda, `Colors.textSecondary`
  - Format: "5/7" (current/threshold)

**Tum milestone'lar kazanilmissa:**
- Progress bar yerine: "All streak milestones achieved! 🏆"
- Tipografi: `Theme.typography.caption`, `Colors.gold`

### Durumlar (States)
- `loading`: 3 SkeletonLoader kutusu (stat boyutlarinda)
- `zero`: "Start your streak by discovering movies today!" mesaji, dot row tamamen pasif
- `active`: Normal gorunum
- `broken`: `lastActiveDate` dunden onceyse, current_streak 0 olsa bile son aktif gun gosterilir

### Props
```typescript
interface StreakCardProps {
  /** Streak bilgisi (gamification servisinden) */
  streakInfo: {
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
    lastActiveDate: string | null;
  } | null;
  /** Yukleniyor mu */
  loading: boolean;
  /** Sonraki milestone bilgisi (opsiyonel) */
  nextMilestone?: {
    title: string;
    threshold: number;
    currentProgress: number;
  } | null;
}
```

---

## Component 4: DiscoveryStats Entegrasyonu

### Degisiklik
Mevcut `DiscoveryStats` componentindeki `BadgesSection`'a streak milestone'lari da eklenir.

**Yeni badge tanimlari eklenecek (ALL_BADGES array'ine):**

```typescript
// Streak bazli badge'ler
{
  id: 'streak_3',
  label: 'Getting Started 🔥',
  check: (s) => /* streakInfo.longestStreak >= 3 */,
  hint: 'Maintain a 3-day streak to unlock!',
},
{
  id: 'streak_7',
  label: 'Week Warrior 💪',
  check: (s) => /* streakInfo.longestStreak >= 7 */,
  hint: 'Maintain a 7-day streak to unlock!',
},
{
  id: 'streak_14',
  label: 'Two Week Titan 🌟',
  check: (s) => /* streakInfo.longestStreak >= 14 */,
  hint: 'Maintain a 14-day streak to unlock!',
},
{
  id: 'streak_30',
  label: 'Monthly Master 👑',
  check: (s) => /* streakInfo.longestStreak >= 30 */,
  hint: 'Maintain a 30-day streak to unlock!',
},
```

**Not:** `DiscoveryStats` suan `UserStats` tipini `types/profile.ts`'ten aliyor. `services/gamification.ts`'teki `StreakInfo` tipini de props'a eklemek gerekebilir. CTO karar verir.

---

## Entegrasyon Haritasi

### Feed Ekraninda (index.tsx)

```
┌─────────────────────────────────┐
│  [SafeArea Top]                 │
│              ┌──────────┐       │
│              │ StreakBadge│ ←──── position: absolute, sag ust
│              └──────────┘       │
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │      SwipeableCard        │  │
│  │                           │  │
│  │                           │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│    [New Mood Button]            │
│                                 │
│  ──────── Tab Bar ────────────  │
│                                 │
│  ┌───────────────────────────┐  │  (modal overlay, gerektiginde)
│  │  MilestoneCelebration     │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Akis:**
1. Feed mount → `getStreakInfo()` cagir → StreakBadge'e streak bilgisini ver
2. Her swipe sonrasi → `recordActivity()` zaten cagriliyor
3. `recordActivity()` sonucu `newMilestones.length > 0` ise → `MilestoneCelebration` goster
4. Milestone dismiss → `markMilestoneSeen()` + sonraki unseen milestone kontrol
5. Streak degisirse → StreakBadge'e yeni deger, pulse animasyonu

### Profile Ekraninda (profile.tsx)

**Yeni Section sirasi:**
1. Profile Header
2. Taste DNA
3. Tonight's Pick
4. **StreakCard** ← YENI (DiscoveryStats'in USTUNDE)
5. Discovery Stats (streak badge'leri eklenmis)
6. Swipe Intelligence
7. Mood Timeline
8. Watchlist Preview
9. Settings

**Veri akisi:**
- Profile mount → `getStreakInfo()` + `getUserMilestones()` (streak milestone'larini filtrele)
- `StreakCard`'a streak info + sonraki streak milestone'u hesapla

---

## Animasyon Ozeti

| Animasyon | Config | Kullanim |
|-----------|--------|----------|
| StreakBadge pulse | BOUNCE_CONFIG (damping:12, stiffness:200), scale 1→1.2→1 | Streak arttiginda |
| StreakBadge glow | TIMING_CONFIG (300ms), opacity 0→0.4→0 | Pulse ile birlikte |
| MilestoneCelebration overlay | TIMING_CONFIG (300ms), opacity 0→1 | Overlay acilis |
| MilestoneCelebration konfeti | Custom gravity (2.5s), yukari firlama + dusme | Kutlama |
| MilestoneCelebration Flick giris | BOUNCE_CONFIG, scale 0→1 | Karakter giris |
| MilestoneCelebration icon | BOUNCE_CONFIG + 0.3s delay | Icon giris |
| MilestoneCelebration title/desc | FadeInDown + staggered delay (0.4s, 0.5s) | Metin giris |
| MilestoneCelebration CTA | FadeInDown + 0.6s delay | Buton giris |
| MilestoneCelebration dismiss | FAST_TIMING (150ms), FadeOut | Overlay kapanis |
| StreakCard progress bar | TIMING_CONFIG (300ms), genislik 0→hedef | Mount animasyonu |
| StreakCard dot row | Stagger: STAGGER_DELAY_MS (50ms) * index, scale 0→1 | Mount animasyonu |

---

## Yeni Token Gereksinimleri

Mevcut token'lar yeterli. Ek token gerekmez.

Kullanilan token'lar:
- Backgrounds: `Colors.bgCard`, `Colors.bgSubtle`, `Colors.white05`, `Colors.overlay`, `Colors.accentDim`
- Accents: `Colors.accentPrimary`, `Colors.accentHover`, `Colors.gold`, `Colors.success`
- Text: `Colors.textPrimary`, `Colors.textSecondary`, `Colors.textTertiary`, `Colors.textOnAccent`
- Borders: `Colors.cardBorder`
- Typography: `Theme.typography.h1`, `.h2`, `.h3`, `.body`, `.caption`
- Spacing: `Theme.spacing.xs`, `.sm`, `.md`, `.lg`, `.xl`
- Radius: `Theme.borderRadius.sm`, `.md`, `.lg`, `.full`
- Shadow: `Theme.shadow.glow`, `Theme.shadow.card`
- Animation: `BOUNCE_CONFIG`, `TIMING_CONFIG`, `FAST_TIMING`, `STAGGER_DELAY_MS`

---

## Dosya Yapisi (CTO Olusturacak)

```
components/
├── Gamification/
│   ├── StreakBadge/
│   │   ├── index.tsx
│   │   └── styles.ts
│   ├── MilestoneCelebration/
│   │   ├── index.tsx
│   │   ├── ConfettiEffect.tsx    ← Konfeti parcacik sistemi
│   │   └── styles.ts
│   └── index.ts                  ← barrel export
├── Profile/
│   ├── StreakCard/
│   │   ├── index.tsx
│   │   └── styles.ts
│   └── DiscoveryStats/           ← mevcut, streak badge'ler eklenir
│       ├── index.tsx
│       └── styles.ts
```

---

## QA Checklist

- [ ] Tum renkler `Colors.*` token'larindan (hex hardcode yok)
- [ ] Tum spacing `Theme.spacing.*` token'larindan
- [ ] Tum tipografi `Theme.typography.*` token'larindan
- [ ] PlayfairDisplay kullanilmiyor (tum metinler Inter)
- [ ] Tum animasyonlar `constants/animations.ts`'ten config kullaniyor
- [ ] StreakBadge touch target >= 44px
- [ ] MilestoneCelebration arka plana basinca kapaniyor
- [ ] MilestoneCelebration kapatildiginda `markMilestoneSeen()` cagriliyor
- [ ] Birden fazla unseen milestone sirayla gosteriliyor
- [ ] StreakCard loading state'inde skeleton gorunuyor
- [ ] StreakCard zero state'inde bos mesaj gorunuyor
- [ ] Progress bar animasyonlu dolgu yapiyor
- [ ] iPhone SE (375px) → 15 Pro Max (430px) arasinda responsive
- [ ] Tab bar (83px) ile cakisma yok
- [ ] Reduced motion: konfeti + pulse animasyonlari devre disi, sadece fade
