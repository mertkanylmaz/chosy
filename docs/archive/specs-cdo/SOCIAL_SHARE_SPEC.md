# SPEC HAZIR: Social Share Card Templates

**CDO:** MoodFlix Design System Owner
**Tarih:** 2026-03-29
**Bagimliliklar:** `react-native-view-shot` (CTO yukleyecek), `expo-sharing`
**Once incelenmesi gereken:** Mevcut `components/SwipeCard/` (poster gradient pattern'i), Film tipi (`types/film.ts`)

---

## Genel Bakis

2 paylasim karti template'i, `react-native-view-shot` ile PNG'ye cevrilip native share sheet'e gonderilir:

1. **FilmShareCard** — Tek film paylasimi (Instagram story / post)
2. **MoodShareCard** — "Mood of the Day" paylasimi (filmsiz, mood odakli)

Her iki kart da ekranda gorunmez (offscreen render). Kullanici "Share" butonuna basinca:
1. Template state ile doldurulur
2. `captureRef()` ile PNG'ye cevirilir
3. `Sharing.shareAsync(uri)` ile native share sheet acilir

---

## Component 1: FilmShareCard

### Gorsel (1080x1350px — Instagram Portrait)
```
┌──────────────────────────────────┐
│                                  │
│                                  │
│      ┌──────────────────┐        │
│      │                  │        │
│      │                  │        │
│      │   Film Poster    │        │
│      │   (rounded)      │        │
│      │                  │        │
│      │                  │        │
│      └──────────────────┘        │
│                                  │
│      The Shawshank Redemption    │  ← Film basligi
│      1994 · Drama · ★ 9.3       │  ← Meta satiri
│                                  │
│   ─────────────────────────────  │  ← Ince ayirici cizgi
│                                  │
│   "I was feeling nostalgic and   │  ← Mood metni (italik)
│    wanted something hopeful"     │
│                                  │
│                                  │
│          ┌──────────┐            │
│          │ Chosy.ai │            │  ← Branding
│          └──────────┘            │
│    Discover movies by your mood  │  ← Tagline
│                                  │
└──────────────────────────────────┘
```

### Boyutlar (Piksel — 1080x1350 ciktida, RN'de scale edilir)

RN render boyutu: **360x450px** (3x scale ile 1080x1350 PNG cikar)

| Element | Boyut / Konum |
|---------|---------------|
| Kart | 360x450px |
| Kart padding | 32px her taraf |
| Poster | 240x320px, yatay merkez, ust kenardan 32px |
| Poster radius | `Theme.borderRadius.lg` (16px) |
| Film basligi | Poster'in 20px altinda |
| Meta satiri | Basligin 8px altinda |
| Ayirici | Meta'nin 20px altinda, genislik 200px, yatay merkez |
| Mood metni | Ayiricinin 16px altinda |
| Branding | Kartbin alt kenardan 32px yukarda |
| Tagline | Branding'in 6px altinda |

### Renkler

| Element | Renk |
|---------|------|
| Kart arka plan | `Colors.bgPrimary` (#0A0A0A) |
| Kart kenarlik | 1px `Colors.cardBorder` (rgba(139,92,246,0.15)) |
| Kart kose radius | `Theme.borderRadius.xl` (24px) |
| Poster golge | `Theme.shadow.card` |
| Film basligi | `Colors.textPrimary` (#FAFAFA) |
| Meta satiri | `Colors.textSecondary` (#A1A1AA) |
| Ayirici cizgi | `Colors.bgSubtle` (#3F3F46), yukseklik 1px |
| Mood metni | `Colors.textSecondary` (#A1A1AA) |
| Tirnaklar | `Colors.gold` (#D4A843) — mood metninin basindaki ve sonundaki tirnak |
| Branding text | `Colors.accentPrimary` (#8B5CF6) |
| Tagline | `Colors.textTertiary` (#71717A) |

### Tipografi

| Element | Stil |
|---------|------|
| Film basligi | `Theme.typography.display` (PlayfairDisplay Bold, fontSize yukaridaki 30→20 scale'de: 20px) |
| Meta satiri | `Theme.typography.caption` (Inter 12px), `Colors.textSecondary` |
| Meta format | "1994 · Drama · ★ 9.3" — nokta ayirici, yildiz emojisi |
| Mood metni | Inter 14px, italic, `Colors.textSecondary` |
| Tirnak isaretleri | PlayfairDisplay Bold 24px, `Colors.gold` |
| Branding | Inter Bold 16px, `Colors.accentPrimary` |
| Tagline | Inter Regular 11px, `Colors.textTertiary` |

### Poster Arkaplan Efekti
- Kartbin ust %30'luk alaninda: poster'in blurlu kopyasi (blurRadius: 25)
- Opacity: 0.15
- Gradient overlay: `Colors.bgPrimary` opacity 0→0.8→1.0 (asagiya dogru)
- Bu efekt karti premium hissettiren ambient isik verir

### Durumlar
- `poster_null`: Poster URL yoksa → `Colors.bgElevated` (#27272A) arka planli placeholder, ortada 🎬 emoji (48px)
- `mood_null`: Mood metni yoksa → mood section tamamen gizlenir, ayirici ve altindakiler yukari kayar
- `long_title`: Film basligi 2 satirdan uzunsa → truncate + "..." (max 2 satir)
- `long_mood`: Mood metni 3 satirdan uzunsa → truncate + "..." (max 3 satir)

### Props
```typescript
interface FilmShareCardProps {
  /** Film bilgileri */
  film: {
    title: string;
    year: number | null;
    genres: string[];
    voteAverage: number | null;
    posterUrl: string | null;
  };
  /** Kullanicinin mood metni (opsiyonel) */
  moodText?: string | null;
}
```

---

## Component 2: MoodShareCard

### Gorsel (1080x1350px)
```
┌──────────────────────────────────┐
│                                  │
│          ∴  ✦  ∴  ✦  ∴          │  ← Dekoratif parcaciklar
│                                  │
│                                  │
│           Today I feel           │  ← Ust etiket
│                                  │
│      "Nostalgic and hopeful,     │  ← Mood metni (buyuk)
│       craving something that     │
│       makes me believe in        │
│       second chances"            │
│                                  │
│                                  │
│      ┌───────────────────┐       │
│      │  😌 Calm · 🎭 Deep │      │  ← Mood profil ozeti
│      │  🎬 Hopeful ending │      │
│      └───────────────────┘       │
│                                  │
│                                  │
│                                  │
│          ┌──────────┐            │
│          │ Chosy.ai │            │  ← Branding
│          └──────────┘            │
│    Discover movies by your mood  │
│                                  │
└──────────────────────────────────┘
```

### Boyutlar

RN render boyutu: **360x450px** (3x → 1080x1350)

| Element | Boyut / Konum |
|---------|---------------|
| Kart | 360x450px |
| Kart padding | 32px her taraf |
| Dekoratif alan | Ust 60px |
| "Today I feel" | Dekoratif alanin 24px altinda |
| Mood metni | "Today I feel"in 16px altinda |
| Profil ozeti kartciagi | Mood metninin 32px altinda |
| Profil ozeti ic padding | 16px yatay, 12px dikey |
| Branding | Alt kenardan 32px |

### Renkler

| Element | Renk |
|---------|------|
| Kart arka plan | Gradient: `Colors.bgPrimary` (#0A0A0A) → `Colors.bgCard` (#18181B) (yukaridan asagiya) |
| Kart kenarlik | 1px `Colors.accentDim` (rgba(139,92,246,0.12)) |
| Kart kose radius | `Theme.borderRadius.xl` (24px) |
| Dekoratif parcaciklar | `Colors.gold` (#D4A843), opacity 0.3 |
| "Today I feel" | `Colors.textTertiary` (#71717A) |
| Mood metni | `Colors.textPrimary` (#FAFAFA) |
| Tirnak isaretleri | `Colors.gold` (#D4A843) |
| Profil ozeti arka plan | `Colors.white05` (rgba(255,255,255,0.05)) |
| Profil ozeti kenarlik | 1px `Colors.bgSubtle` (#3F3F46) |
| Profil ozeti radius | `Theme.borderRadius.md` (12px) |
| Profil ozeti metin | `Colors.textSecondary` (#A1A1AA) |
| Branding | `Colors.accentPrimary` (#8B5CF6) |
| Tagline | `Colors.textTertiary` |

### Tipografi

| Element | Stil |
|---------|------|
| "Today I feel" | Inter Regular 14px, `Colors.textTertiary`, letter-spacing 2px, UPPERCASE |
| Mood metni | Inter SemiBold 18px, `Colors.textPrimary`, line-height 26px |
| Tirnak isaretleri | PlayfairDisplay Bold 32px, `Colors.gold` |
| Profil ozeti | Inter Regular 13px, `Colors.textSecondary` |
| Emoji | 16px (profil ozetinde) |
| Branding | Inter Bold 16px, `Colors.accentPrimary` |
| Tagline | Inter Regular 11px, `Colors.textTertiary` |

### Dekoratif Parcaciklar
- 5-7 kucuk sembol: ✦ ve ∴ karisik
- Boyut: 8-12px
- Renk: `Colors.gold` (#D4A843) opacity 0.3
- Konum: ust 60px alanda rastgele yatay dagitim
- Statik (animasyon yok — PNG'ye capture edilecegi icin)

### Mood Profil Ozeti Icerigi
AI profil sonucundan 2-3 anahtar ozellik secilir:
- Enerji: 😌 Calm / ⚡ Energetic / 😊 Balanced
- Derinlik: 🎭 Deep / 🎪 Light / 📖 Moderate
- Bitis tercihi: 🎬 + ending_preference (Hopeful/Bittersweet/Open/Tragic/Triumphant)

Profil yoksa: ozet kartciagi tamamen gizlenir.

### Durumlar
- `with_profile`: Tam gorunum (mood + profil ozeti)
- `without_profile`: Profil ozeti gizli, mood metni daha buyuk alana yayilir
- `long_mood`: Max 5 satir, sonra truncate

### Props
```typescript
interface MoodShareCardProps {
  /** Kullanicinin mood metni */
  moodText: string;
  /** AI profil ozeti (opsiyonel) */
  profile?: {
    energyLevel: number;       // 0-1
    thematicDepth: number;     // 0-1
    endingPreference: string;  // hopeful | bittersweet | open | tragic | triumphant
  } | null;
}
```

---

## Share Akisi (Entegrasyon)

### Tetikleme Noktalari

**FilmShareCard:**
1. `app/film/[id].tsx` → Film detay ekraninda "Share" butonu
2. `components/SwipeCard/SwipeableCard.tsx` → Saga swipe sonrasi toast'ta "Share" linki

**MoodShareCard:**
1. `app/(tabs)/mood.tsx` → MoodProfileResult ekraninda "Share Mood" butonu
2. `app/(tabs)/profile.tsx` → MoodTimeline'da bir entry'ye uzun basma

### Share Flow
```
1. Kullanici "Share" butonuna basar
2. Offscreen View'da ilgili ShareCard render edilir (opacity:0, position:absolute)
3. captureRef(viewRef, { format: 'png', quality: 1, width: 1080, height: 1350 })
4. PNG URI alinir
5. Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' })
6. Native share sheet acilir (Instagram, WhatsApp, Twitter, vb.)
```

### Share Buton Spec

**Film detay ekraninda:**
- Konum: Mevcut buton grubuna eklenir (Watchlist butonunun yanina)
- Ikon: Ionicons `share-outline`, 20px
- Boyut: 44x44px touch target
- Arka plan: `Colors.white05`
- Kenarlik: 1px `Colors.bgSubtle`
- Radius: `Theme.borderRadius.full` (9999)
- Press: scale(0.9) + haptic light

**MoodProfileResult ekraninda:**
- Konum: "Browse Movies" butonunun ustunde
- Tam genislik buton (outline varyant)
- Metin: "Share Your Mood"
- Kenarlik: 1px `Colors.accentPrimary`
- Metin rengi: `Colors.accentPrimary`
- Arka plan: transparent
- Press: `Colors.accentDim` arka plan

---

## Dosya Yapisi

```
components/
├── ShareCards/
│   ├── index.ts               ← barrel export
│   ├── FilmShareCard.tsx      ← 360x450 template
│   ├── MoodShareCard.tsx      ← 360x450 template
│   ├── useShareCapture.ts     ← captureRef + share logic hook
│   └── styles.ts              ← ortak stiller
```

### useShareCapture Hook API
```typescript
interface UseShareCaptureReturn {
  /** Share card'in render edilecegi ref */
  cardRef: React.RefObject<View>;
  /** PNG capture + native share tetikleme */
  share: () => Promise<void>;
  /** Capture islemi devam ediyor mu */
  isCapturing: boolean;
}

function useShareCapture(): UseShareCaptureReturn;
```

---

## QA Checklist

- [ ] Tum renkler `Colors.*` token'larindan
- [ ] PlayfairDisplay sadece film basligi ve tirnak isaretlerinde
- [ ] Inter diger tum metinlerde
- [ ] PNG cikti boyutu 1080x1350px (3x scale)
- [ ] Poster null durumunda placeholder gorunuyor
- [ ] Mood null durumunda ilgili section gizleniyor
- [ ] Uzun basliklar truncate ediliyor (max 2 satir)
- [ ] Uzun mood metinleri truncate ediliyor (max 3-5 satir)
- [ ] Share sheet iOS ve Android'de calisiyor
- [ ] Branding ("Chosy.ai") her kartta gorunuyor
- [ ] Capture sirasinda loading/spinner gosteriliyor
- [ ] Capture sonrasi gecici dosya temizleniyor
- [ ] Kartlar ekranda gorunmuyor (offscreen render)
