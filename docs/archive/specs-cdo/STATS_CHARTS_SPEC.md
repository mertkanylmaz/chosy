# SPEC HAZIR: Stats Charts (Mood Pattern + Genre Distribution)

**CDO:** MoodFlix Design System Owner
**Tarih:** 2026-03-29
**Bagimliliklar:** `services/history.ts` (getUserStats, getMoodTimeline), `types/profile.ts` (GenreDistribution, MoodHistoryItem)
**Once incelenmesi gereken:** Mevcut `components/Profile/TasteDNA/` (duygu barlari pattern'i), `components/Profile/SwipeIntelligence/` (insight kart pattern'i)

---

## Genel Bakis

2 yeni chart component, Profile ekraninda mevcut section'larin icine veya yanina yerlesiyor:

1. **MoodPatternChart** — Son 14 gunun baskil duygu trendleri (horizontal bar timeline)
2. **GenreDonutChart** — Kaydedilen filmlerin genre dagilimi (donut chart)

**Kutuphane notu:** Grafik kutuphanesi secimi CTO'nun teknik karari. Oneriler: `react-native-svg` + elle cizim (en hafif), `victory-native` veya `react-native-chart-kit`. Spec piksel boyutlari ve renkleri tanimlar, implementation CTO'da.

---

## Component 1: MoodPatternChart

### Gorsel
```
┌──────────────────────────────────────────┐
│ 🎭 Mood Patterns                         │  ← Header
├──────────────────────────────────────────┤
│                                          │
│  Mar 16  ██████████░░░░░░  joy 72%       │
│  Mar 17  ████████░░░░░░░░  sadness 54%   │
│  Mar 18  ██████████████░░  trust 89%     │
│  Mar 19  ████████████░░░░  joy 78%       │
│  Mar 20  ██████░░░░░░░░░░  fear 41%      │
│  Mar 21  ████████████████  anticipation   │
│  Mar 22  ██████████░░░░░░  joy 68%       │
│  ·                                       │
│  · (son 14 gun, scroll)                  │
│                                          │
│  ┌─────────────────────────────────┐     │
│  │ 😄 joy   😢 sad   🤝 trust    │     │  ← Legend
│  │ 😨 fear  ⚡ antic  😲 surprise │     │
│  └─────────────────────────────────┘     │
│                                          │
└──────────────────────────────────────────┘
```

### Konsept
Her gun icin **en baskil duygu** gosterilir (8 duygudan en yuksek skor). Yatay bar o duygunun yogunlugunu (0-1 → 0-100%) gosterir. Bar rengi duyguya ozel.

### Neden Bu Format?
- 12 boyutlu profilin tamami karisik olur — kullanici tek bakista anlamaz
- Gunluk "baskil duygu" sezgisel: "Bugun neyle yukluydum?" sorusuna cevap verir
- Yatay bar + emoji: TasteDNA'daki duygu barlarina gorsel tutarlilik

### Kullanim Yeri
- **Profile ekrani** — MoodTimeline section'inin USTUNE eklenir
- Ayri component: `components/Profile/MoodPatternChart/index.tsx` + `styles.ts`

### Boyutlar
- Genislik: fill parent (ekran - 2 * Theme.spacing.md = 32px)
- Yukseklik: hug content (~280px, 14 satir icin)
- Kart border radius: `Theme.borderRadius.lg` (16px)
- Ic padding: `Theme.spacing.lg` (24px)

### Renkler

**Kart:**
- Arka plan: `Colors.cardSolid` (#18181B)
- Kenarlik: 1px `Colors.cardBorder` (rgba(139,92,246,0.15))

**Duygu barlari (mevcut TasteDNA'dan — AYNI renkler):**
| Duygu | Renk | Emoji |
|-------|------|-------|
| joy | #4ADE80 (≈ Colors.success) | 😄 |
| sadness | #60A5FA | 😢 |
| fear | #F87171 | 😨 |
| anger | #EF4444 (= Colors.error) | 😠 |
| trust | #A78BFA | 🤝 |
| anticipation | #FBBF24 | ⚡ |
| surprise | #FB923C | 😲 |
| disgust | #6B7280 | 😒 |

**Not:** Bu renkler TasteDNA'da `EMOTION_COLORS` olarak tanimli. Ayni constant'i import et, tekrar tanimlama.

**Bar arkaplan (bos):** `Colors.bgSubtle` (#3F3F46)

### Icerik Detaylari

#### Header
- Sol: 🎭 emoji (18px) + `Theme.spacing.sm` (8px) + "Mood Patterns"
- Tipografi: `Theme.typography.h3` (fontSize:16, semibold, Inter)
- Renk: `Colors.textPrimary`

#### Bar Row (her gun)
- **Tarih:** `Theme.typography.caption` (fontSize:12), `Colors.textTertiary` (#71717A)
  - Format: "Mar 16" (ay 3 harf + gun)
  - Genislik: sabit 52px (hizalama icin)
- **Bar:** Tarihin saginda, `Theme.spacing.sm` (8px) aralik
  - Yukseklik: 16px
  - Border radius: `Theme.borderRadius.sm` (8px)
  - Arka plan: `Colors.bgSubtle`
  - Dolgu: ilgili duygunun rengi, genislik = skor * max genislik
  - Max genislik: kart genisligi - padding - tarih alani - etiket alani (~60%)
- **Etiket:** Barin saginda, `Theme.spacing.xs` (4px) aralik
  - Duygu adi: `Theme.typography.caption`, duygu rengiyle
  - Skor: ayni satirda, `Colors.textTertiary`, "%72" formatinda
- **Satir aralik:** `Theme.spacing.sm` (8px)

#### Legend (altta)
- Konum: son barin `Theme.spacing.lg` (24px) altinda
- Layout: flex-wrap row, 3 sutun
- Her item: emoji (14px) + `Theme.spacing.xs` (4px) + duygu adi
- Tipografi: fontSize 11, Inter, `Colors.textTertiary`
- Item arasi: `Theme.spacing.md` (16px) yatay, `Theme.spacing.xs` (4px) dikey

### Animasyon
- Bar dolgu: mount'ta soldan saga animasyon
  - Stagger: `STAGGER_DELAY_MS` (50ms) * row index
  - Duration: `TIMING_CONFIG` (300ms)
  - Her bar 0 genislikten hedef genislige buyur

### Durumlar
- `loading`: 7 satir SkeletonLoader (bar boyutunda)
- `empty`: "Start exploring to see your mood patterns!" — `Theme.typography.body`, `Colors.textSecondary`, yatay merkez
- `insufficient`: < 3 gun veri varsa: "Keep exploring! Patterns appear after 3+ days." + mevcut verileri goster

### Veri Kaynaklari
- `getMoodTimeline(14)` → son 14 session
- Her session'in `profile` field'i → `parsed_profile_json.emotional_state`
- Ayni gunde birden fazla session varsa: o gunun duygu ortalamasi alinir

### Props
```typescript
interface MoodPatternChartProps {
  /** Mood timeline verileri (services/history.ts'ten) */
  timeline: Array<{
    createdAt: string;
    profile: Record<string, unknown> | null;
  }>;
  /** Yukleniyor mu */
  loading: boolean;
}
```

---

## Component 2: GenreDonutChart

### Gorsel
```
┌──────────────────────────────────────────┐
│ 🎬 Genre DNA                             │  ← Header
├──────────────────────────────────────────┤
│                                          │
│           ┌─────────────┐                │
│          ╱   ╱  Drama    ╲               │
│        ╱   ╱   34%     ╱  ╲              │
│       │  Thriller ╱  Action  │           │
│       │   22%   ╱    18%    │            │
│        ╲       ╱     ╱    ╱              │
│          ╲   Sci-Fi  ╱  ╱               │
│           ╲  14%   ╱╱                   │
│            └──────┘                      │
│         Total: 47 films                  │  ← Merkez metin
│                                          │
│  ● Drama 34%  ● Thriller 22%            │  ← Legend
│  ● Action 18% ● Sci-Fi 14%             │
│  ● Other 12%                             │
│                                          │
└──────────────────────────────────────────┘
```

### Konsept
Kaydedilen filmlerin (sag swipe) genre dagilimi. Donut chart, ortasinda toplam film sayisi. Max 5 dilim + "Other" grubu.

### Kullanim Yeri
- **Profile ekrani** — DiscoveryStats section'inin ALTINA eklenir
- Ayri component: `components/Profile/GenreDonutChart/index.tsx` + `styles.ts`

### Boyutlar
- Genislik: fill parent
- Yukseklik: hug content (~300px)
- Kart border radius: `Theme.borderRadius.lg` (16px)
- Ic padding: `Theme.spacing.lg` (24px)

### Renkler

**Kart:**
- Arka plan: `Colors.cardSolid` (#18181B)
- Kenarlik: 1px `Colors.cardBorder`

**Donut dilimleri (sabit 6 renk paleti):**
| Siralama | Renk | Token/Hex |
|----------|------|-----------|
| 1. genre | `Colors.accentPrimary` | #8B5CF6 (violet) |
| 2. genre | `Colors.gold` | #D4A843 |
| 3. genre | `Colors.success` | #22C55E |
| 4. genre | `Colors.swipeDown` | #3B82F6 (blue) |
| 5. genre | `Colors.warning` | #F59E0B |
| Other | `Colors.bgSubtle` | #3F3F46 |

**Not:** Renk sirasi genre'ye gore degil, yuzde buyuklugune gore atanir. En buyuk dilim her zaman violet.

### Icerik Detaylari

#### Header
- Sol: 🎬 emoji (18px) + `Theme.spacing.sm` (8px) + "Genre DNA"
- Tipografi: `Theme.typography.h3`
- Renk: `Colors.textPrimary`

#### Donut Chart
- **Dis cap:** 180px
- **Ic cap (delik):** 100px (oranla: ~55%)
- **Stroke genisligi:** 40px (= (180-100)/2)
- **Konum:** Yatay merkez, header'in `Theme.spacing.lg` (24px) altinda
- **Baslangic acisi:** -90deg (saat 12 yonu)
- **Dilimler arasi bosluk:** 2px (veya 2deg gap)

#### Merkez Metin (donut'un ortasinda)
- Ust satir: toplam film sayisi — `Theme.typography.h2` (fontSize:20, semibold), `Colors.textPrimary`
- Alt satir: "films" — `Theme.typography.caption` (fontSize:12), `Colors.textTertiary`

#### Legend (donut'un altinda)
- Konum: donut'un `Theme.spacing.lg` (24px) altinda
- Layout: 2 sutun grid (flex-wrap)
- Her item:
  - Renkli daire: 10px cap, ilgili dilim rengi
  - `Theme.spacing.sm` (8px) aralik
  - Genre adi: `Theme.typography.body` (fontSize:14), `Colors.textPrimary`
  - Yuzde: `Theme.typography.caption` (fontSize:12), `Colors.textSecondary`
  - Format: "● Drama 34%"
- Sutunlar arasi: `Theme.spacing.md` (16px)
- Satirlar arasi: `Theme.spacing.sm` (8px)

### Animasyon
- Donut dolgu: mount'ta saat yonunde cizilme animasyonu
  - Her dilim: 0 acidan hedef aciya
  - Stagger: dilimler arasinda 100ms gecikme
  - Duration: toplam ~800ms (SLOW_TIMING benzeri)
  - Easing: ease-out
- Merkez metin: FadeIn, 0.4s delay (donut cizildikten sonra)
- Legend: FadeInDown, stagger `STAGGER_DELAY_MS` * index

### Durumlar
- `loading`: 180px daire SkeletonLoader + 3 satir legend skeleton
- `empty`: Bos donut (tamami `Colors.bgSubtle`), merkez metin "0 films", altinda "Start swiping to see your genre DNA!"
- `single_genre`: Tek dilim tum daireyi kaplar, legend'da tek satir
- `active`: Normal gorunum

### Veri Kaynaklari
- `getUserStats()` → `topGenres: Record<string, number>` (services/history.ts)
- VEYA `getSwipeInsights()` → `saved_genre_distribution: GenreDistribution[]` (services/profileService.ts)
- CTO hangisi daha pratikse onu secsin — her ikisi de genre + count verir

### Genre Gruplama Kurali
- Top 5 genre dilim olarak gosterilir
- Kalan genre'ler "Other" altinda toplanir
- Yuzde hesabi: (genre count / toplam) * 100, yuvarlanmis tam sayi
- Yuzdelerin toplami 100 olmayabilir (yuvarlama) — sorun degil

### Props
```typescript
interface GenreDonutChartProps {
  /** Genre dagilimi: { "Drama": 15, "Action": 8, ... } */
  genres: Record<string, number>;
  /** Toplam film sayisi (donut merkez metin) */
  totalFilms: number;
  /** Yukleniyor mu */
  loading: boolean;
}
```

---

## Profile Ekranindaki Yerlesimleri

**Guncellenmis section sirasi:**
1. Profile Header
2. Taste DNA
3. Tonight's Pick
4. StreakCard (Gamification spec'ten)
5. Discovery Stats
6. **GenreDonutChart** ← YENI
7. **MoodPatternChart** ← YENI
8. Swipe Intelligence
9. Mood Timeline
10. Watchlist Preview
11. Settings

**Neden bu sirada?**
- GenreDonutChart, DiscoveryStats'in hemen altinda — ikisi de "ne kadar kesfettin" ailesinden
- MoodPatternChart, MoodTimeline'in hemen ustunde — ikisi de mood tarihcesi ailesinden
- SwipeIntelligence ikisinin arasinda — gecis gorevi gorur

---

## Dosya Yapisi

```
components/Profile/
├── MoodPatternChart/
│   ├── index.tsx
│   └── styles.ts
├── GenreDonutChart/
│   ├── index.tsx
│   └── styles.ts
└── (mevcut componentler ayni kalir)
```

---

## QA Checklist

- [ ] Tum renkler `Colors.*` token'larindan
- [ ] Duygu renkleri TasteDNA'daki `EMOTION_COLORS` ile ayni (import et, tekrar tanimlama)
- [ ] Donut dilim renkleri spec'teki sabit palete uygun
- [ ] Tum spacing `Theme.spacing.*` token'larindan
- [ ] Tum tipografi `Theme.typography.*` token'larindan
- [ ] PlayfairDisplay kullanilmiyor (tum metinler Inter)
- [ ] Bar animasyonlari staggered, donut saat yonunde cizilme
- [ ] Loading state'lerde skeleton gorunuyor
- [ ] Empty state'lerde anlamli mesaj + bos gorsel
- [ ] 0 film durumunda crash yok (sifira bolme korunmasi)
- [ ] iPhone SE (375px) → 15 Pro Max (430px) arasinda responsive
- [ ] Tab bar (83px) ile cakisma yok (paddingBottom)
- [ ] Reduced motion: animasyonlar devre disi, sadece statik gorunum
