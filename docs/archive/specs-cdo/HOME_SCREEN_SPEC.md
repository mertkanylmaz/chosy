# SPEC HAZIR: P7.1 Home Screen Redesign

**CDO:** MoodFlix Design System Owner
**Tarih:** 2026-04-07
**Hedef dosya:** `app/(tabs)/index.tsx` (mevcut FeedScreen donusturulecek)
**Bagimliliklar:** P5.1 auth/username, P5.2 archetypes, P5.3 DailyMatchCard, MoodContext
**Once incelenmesi gereken:** Mevcut `app/(tabs)/index.tsx`, `components/Profile/DailyMatchCard/`, `contexts/MoodContext.tsx`

---

## Genel Bakis

Feed tab (index.tsx) su anda saf swipe kartlardan olusuyor. Yeni kullanici icin baglam yok — nereye dogru kaydirmasi gerektigini bilmiyor. Home Screen redesign ile tab, kisisellestirilmis bir "Home" deneyimine donusuyor.

**Temel fikir:** Swipe feed KALMAYA DEVAM EDIYOR. Ustteki alana scroll edilebilir bir "Home Header" ekleniyor. Kullanici asagi scroll edince kart feed'ine ulasiyor.

### Iki Durum

1. **Profil yok (ilk acilis / mood secilmemis):** Home Header gorunur — selamlama + CTA + daily pick
2. **Profil var (mood secildi, filmler yuklendi):** Home Header gizlenir, saf swipe feed (mevcut davranis)

> Bu yaklasim mevcut swipe UX'i bozmaz ve sadece "bos" durumu zenginlestirir.

---

## Ekran Yapisi — Profil Yok Durumu

```
┌────────────────────────────────────────┐
│  [Logo]            [Streak]  [New Mood] │  ← Mevcut header overlay
│                                         │
│                                         │
│  Good evening, Mert                     │  ← GreetingWidget
│  What are you in the mood for?          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ✦  Set Your Mood               │    │  ← MoodCTA (primary)
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     Daily Pick                  │    │  ← DailyPickCard
│  │     [Film Poster]               │    │
│  │     Film Title                  │    │
│  │     2024 · Drama · 8.4          │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Last time you felt nostalgic   │    │  ← LastSessionCard
│  │  ┌────┐ ┌────┐ ┌────┐          │    │    (son mood session ozeti)
│  │  │ 🎬 │ │ 🎬 │ │ 🎬 │  +2 more │    │
│  │  └────┘ └────┘ └────┘          │    │
│  │  Continue exploring →           │    │
│  └─────────────────────────────────┘    │
│                                         │
│        ↕ Pull down or tap CTA          │
│                                         │
└─────────────────────────────────────────┘
```

### Ekran Yapisi — Profil Var Durumu

Mevcut swipe feed aynen korunur. Home Header gorunmez.

---

## Component 1: GreetingWidget

Gunun saatine gore selamlama + kullanici adi.

### Saat Dilimi Kurallari

| Saat | Selamlama Key |
|------|---------------|
| 05:00-11:59 | `home.greetingMorning` → "Good morning" |
| 12:00-16:59 | `home.greetingAfternoon` → "Good afternoon" |
| 17:00-20:59 | `home.greetingEvening` → "Good evening" |
| 21:00-04:59 | `home.greetingNight` → "Late night cinema" |

### Layout

| Element | Deger |
|---------|-------|
| Container | paddingHorizontal: `Theme.spacing.lg` (24px), paddingTop: `Theme.spacing.xl` (32px) |
| Selamlama satiri | Inter Bold 28px, `Colors.textPrimary` |
| Kullanici adi | Selamlama icinde, ayni stil. Yoksa atla ("Good evening" tek basina) |
| Alt metin | Inter Regular 16px, `Colors.textSecondary`, marginTop: `Theme.spacing.xs` (4px) |
| Alt metin icerigi | `home.subtitle` → "What are you in the mood for?" |

### Animasyon
- FadeInDown (Reanimated), 400ms, springify().damping(18)
- Selamlama ve alt metin 100ms stagger

### Props
```typescript
interface GreetingWidgetProps {
  /** Kullanici adi — yoksa sadece selamlama gosterilir */
  username: string | null;
}
```

---

## Component 2: MoodCTA

Ana aksiyona yonlendiren birincil buton. Tum ekranin gorev odagi.

### Gorsel

```
┌──────────────────────────────────────┐
│   ✦  Set Your Mood                   │
└──────────────────────────────────────┘
```

### Stiller

| Element | Deger |
|---------|-------|
| Container marginTop | `Theme.spacing.lg` (24px) |
| Container marginHorizontal | `Theme.spacing.lg` (24px) |
| Arka plan | LinearGradient: `Colors.accentPrimary` → `Colors.accentHover` (soldan saga) |
| Kose radius | `Theme.borderRadius.lg` (16px) |
| Padding | 18px dikey, 24px yatay |
| Golge | `Theme.shadow.glow` (violet glow) |
| Ikon | "✦" karakter, 18px, `Colors.textOnAccent`, marginRight: `Theme.spacing.sm` (8px) |
| Metin | Inter Bold 17px, `Colors.textOnAccent`, letterSpacing: 0.5 |
| Touch target | minimum 56px yukseklik |
| Press efekti | scale(0.97) + haptic light |
| Animasyon | FadeInDown.delay(200).springify().damping(18) |

### Idle Pulse (Dikkat Cekme)
- Violet glow shadowOpacity: 0.3 → 0.6 → 0.3, 2s infinite loop
- Reanimated `withRepeat(withTiming(...))`
- Performans: `useNativeDriver: true` (shadow animasyonu sadece iOS; Android'de statik)

### Props
```typescript
interface MoodCTAProps {
  onPress: () => void;
  /** i18n label — varsayilan: t('home.setMood') */
  label?: string;
}
```

---

## Component 3: DailyPickCard (Home versiyonu)

Mevcut `components/Profile/DailyMatchCard` yeniden kullanilir, ANCAK Home icin hafif farkliliklar:

### Farklar (Profile vs Home)

| Ozellik | Profile DailyMatchCard | Home DailyPickCard |
|---------|------------------------|---------------------|
| Section baslik | Yok | "Today's Pick" ust baslik |
| Aspect ratio | 3:4 | 2.5:4 (daha kisa — scroll alanini korumak icin) |
| Margin | paddingHorizontal: 0 | marginHorizontal: `Theme.spacing.lg` (24px) |
| marginTop | 0 | `Theme.spacing.lg` (24px) |
| Animasyon | Yok | FadeInDown.delay(300).springify() |

### Section Baslik

| Element | Deger |
|---------|-------|
| Metin | `home.dailyPick` → "Today's Pick" |
| Font | Inter SemiBold 14px (`Theme.typography.body` + fontWeight 600) |
| Renk | `Colors.textTertiary` |
| letterSpacing | 1.5px |
| textTransform | uppercase |
| marginBottom | `Theme.spacing.sm` (8px) |
| marginHorizontal | `Theme.spacing.lg` (24px) |

### Strateji
- **Yeni component OLUSTURMA.** Mevcut `DailyMatchCard`'i import et, wrapper ile sar.
- Wrapper: section baslik + margin + aspect ratio override (style prop ile)

### Veri Kaynagi
- `getDailyMatch()` servisi (`services/dailyMatch.ts`) — AsyncStorage cache (gunluk)
- Kullanici arketipi: `users` tablosundan `archetype_id`
- Film verisi yoksa: DailyMatchCard'in kendi EmptyCard'i gorunur (mevcut davranis)

---

## Component 4: LastSessionCard

Son mood session'ini ozet olarak gosteren kart. Kullaniciyi mevcut oneri listesine donmeye tesvik eder.

### Gorsel

```
┌─────────────────────────────────────────┐
│  Last time you felt nostalgic...        │  ← Baslik
│                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │poster│ │poster│ │poster│  +2 more    │  ← Film mini posterleri
│  └──────┘ └──────┘ └──────┘             │
│                                         │
│  Continue exploring →                   │  ← CTA link
└─────────────────────────────────────────┘
```

### Stiller

| Element | Deger |
|---------|-------|
| Container | marginHorizontal: `Theme.spacing.lg` (24px), marginTop: `Theme.spacing.lg` (24px) |
| Arka plan | `Colors.bgCard` |
| Kose radius | `Theme.borderRadius.lg` (16px) |
| Border | 1px `Colors.cardBorder` |
| Ic padding | `Theme.spacing.md` (16px) |
| Animasyon | FadeInDown.delay(400).springify() |

### Baslik Satiri

| Element | Deger |
|---------|-------|
| Metin | `home.lastSession` → "Last time you felt {{mood}}..." |
| Font | Inter SemiBold 15px, `Colors.textPrimary` |
| `{{mood}}` kelimesi | `Colors.accentPrimary` renkte (ayni font) |
| numberOfLines | 1, ellipsize |
| marginBottom | `Theme.spacing.sm` (8px) |

### Mini Poster Satiri

| Element | Deger |
|---------|-------|
| Layout | flexDirection: 'row', gap: `Theme.spacing.sm` (8px) |
| Her poster | 56x80px (yatay dikdortgen, ~film poster orani) |
| Poster radius | `Theme.borderRadius.sm` (8px) |
| Max gosterilen | 3 poster |
| "+N more" metin | Inter Regular 13px, `Colors.textSecondary`, alignSelf: 'center' |
| Poster yoksa | `Colors.bgElevated` placeholder + film-outline ikonu 20px |

### CTA Satiri

| Element | Deger |
|---------|-------|
| Metin | `home.continueExploring` → "Continue exploring" |
| Font | Inter SemiBold 14px, `Colors.accentPrimary` |
| Ikon | Ionicons `arrow-forward`, 16px, `Colors.accentPrimary`, marginLeft: 4px |
| marginTop | `Theme.spacing.sm` (8px) |
| Touch | Tum karta dokunulabilir (TouchableOpacity, activeOpacity: 0.85) |
| Aksiyon | `router.push('/(tabs)/mood')` — mood tab'a gider, session devam eder |

### Veri Kaynagi
- `MoodContext.currentProfile` — son mood session'inin mood metni
- `MoodContext.lastSessionFilms` veya watchlist'ten son session filmleri (CTO implementasyonda karar verir)
- Session yoksa: **LastSessionCard TAMAMEN GIZLENIR** (bos state yok)

### Durumlar

| Durum | Davranis |
|-------|----------|
| Session var, 1+ film | Tam gorunum |
| Session var, 0 film | Sadece baslik + "Start swiping" CTA |
| Session yok | Kart gizli |

---

## Home Header Container

Tum widget'lari saran ana container. `!currentProfile` durumunda gorunur.

### Layout

```typescript
// Pseudo-code — CTO implement edecek
if (!currentProfile) {
  return (
    <ScrollView>
      <GreetingWidget username={username} />
      <MoodCTA onPress={handleNewMood} />
      <DailyPickSection />
      <LastSessionCard />
      <View style={{ height: Theme.spacing.xxl }} /> {/* bottom padding */}
    </ScrollView>
  );
}

// Profil varsa → mevcut FlatList swipe feed (degisiklik yok)
return <FlatList ... />;
```

### Container Stiller

| Element | Deger |
|---------|-------|
| Arka plan | `Colors.background` |
| paddingTop | `useSafeAreaInsets().top + 52` (logo/streak badge alaninin altinda) |
| paddingBottom | 83px (tab bar) + `Theme.spacing.xl` (32px) |
| ScrollView | showsVerticalScrollIndicator: false |
| contentContainerStyle | paddingBottom: 83 + 32 = 115px |

### Mevcut Overlay'lar Korunur
- Chosy.ai logo (ust merkez)
- StreakBadge (sol ust)
- "New Mood" floating butonu (sag ust) — Home Header durumunda GIZLENIR (MoodCTA zaten var)

---

## Animasyon Zamanlama (Stagger)

| Widget | Delay | Animasyon |
|--------|-------|-----------|
| GreetingWidget | 0ms | FadeInDown, springify, damping(18) |
| GreetingWidget subtitle | 100ms | FadeInDown |
| MoodCTA | 200ms | FadeInDown, springify, damping(18) |
| DailyPickCard | 300ms | FadeInDown, springify |
| LastSessionCard | 400ms | FadeInDown, springify |

Toplam stagger suresi: ~700ms (son widget gorunur hale gelir)

---

## i18n Keys (Yeni)

```json
{
  "home": {
    "greetingMorning": "Good morning",
    "greetingAfternoon": "Good afternoon",
    "greetingEvening": "Good evening",
    "greetingNight": "Late night cinema",
    "subtitle": "What are you in the mood for?",
    "setMood": "Set Your Mood",
    "dailyPick": "Today's Pick",
    "lastSession": "Last time you felt {{mood}}...",
    "continueExploring": "Continue exploring",
    "startSwiping": "Start swiping",
    "plusMore": "+{{count}} more"
  }
}
```

TR karsiliklari:

```json
{
  "home": {
    "greetingMorning": "Gunaydin",
    "greetingAfternoon": "Iyi gunler",
    "greetingEvening": "Iyi aksamlar",
    "greetingNight": "Gece sineması",
    "subtitle": "Bugun ne izlemek istersin?",
    "setMood": "Ruh Halini Sec",
    "dailyPick": "Gunun Onerisi",
    "lastSession": "Son seferinde {{mood}} hissetmistin...",
    "continueExploring": "Kesfetmeye devam et",
    "startSwiping": "Kaydirmaya basla",
    "plusMore": "+{{count}} film daha"
  }
}
```

---

## Dosya Yapisi

```
components/
├── Home/
│   ├── index.ts               ← barrel export
│   ├── GreetingWidget/
│   │   ├── index.tsx
│   │   └── styles.ts
│   ├── MoodCTA/
│   │   ├── index.tsx
│   │   └── styles.ts
│   ├── DailyPickSection/
│   │   ├── index.tsx           ← DailyMatchCard wrapper
│   │   └── styles.ts
│   └── LastSessionCard/
│       ├── index.tsx
│       └── styles.ts
```

**Mevcut dosya degisiklikleri:**
- `app/(tabs)/index.tsx` — Home Header eklenir (conditional render)
- `locales/en.json` — `home.*` keys eklenir
- `locales/tr.json` — `home.*` keys eklenir

---

## Edge Case'ler

| Durum | Davranis |
|-------|----------|
| Kullanici adi yok (anonim auth) | Selamlama: "Good evening" (adsiz, username kelimesi yok) |
| DailyMatch yukleniyor | DailyMatchCard'in mevcut SkeletonCard'i gorunur |
| DailyMatch servisi hata | DailyMatchCard EmptyCard gorunur (mevcut fallback) |
| Son session yok | LastSessionCard tamamen gizli |
| Profil secildiginde | Home Header → swipe feed gecisi: FadeOut(200ms) + mevcut FlatList FadeIn |
| Cihaz: iPhone SE (375px) | MoodCTA tam genislik, posterler 56px genislikte kalir, 3 poster sigar |
| Cihaz: iPhone 15 Pro Max (430px) | Ayni layout, daha genis marginler |

---

## Performans Notlari

- Home Header sadece `!currentProfile` durumunda mount edilir
- DailyMatch verisi AsyncStorage'dan gelir (agir DB sorgusu degil)
- LastSessionCard filmleri lokal state'ten gelir (MoodContext veya AsyncStorage)
- Stagger animasyonlari Reanimated (native thread) — JS thread bloke etmez
- Profil secildiginde Home Header unmount olur, FlatList mount olur (ayni anda ikisi render EDILMEZ)

---

## QA Checklist

- [ ] Tum renkler `Colors.*` token'larindan (hardcoded hex YOK)
- [ ] Tum metinler `t()` uzerinden (hardcoded string YOK)
- [ ] PlayfairDisplay kullanilmiyor (Home Header'da film basligi yok — DailyMatchCard icindeki haric)
- [ ] Inter tum UI metinlerinde
- [ ] Touch target >= 44px (MoodCTA >= 56px, LastSessionCard tam kart)
- [ ] Animasyonlar Reanimated ile, native thread
- [ ] Dark mode only (acik tema yok)
- [ ] iPhone SE (375px) → 15 Pro Max (430px) responsive
- [ ] paddingBottom: 83 tab bar icin
- [ ] SafeAreaInsets.top header overlay icin
- [ ] Profil var → mevcut swipe feed AYNEN korunur (regresyon yok)
- [ ] "New Mood" floating butonu Home Header'da gizli (MoodCTA yerine)
- [ ] Streak badge Home Header'da gorunur
- [ ] Chosy.ai logo Home Header'da gorunur
- [ ] Stagger animasyonlari 0-400ms araliginda, dogal hissettiriyor
- [ ] MoodCTA violet glow pulse calisiyor (iOS)
