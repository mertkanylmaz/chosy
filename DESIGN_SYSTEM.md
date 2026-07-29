# MoodFlix — Design System

## Philosophy
Bumble's addictive swipe UX + cinema-grade premium aesthetics. Think: a luxury movie theater in your pocket, not a dating app.

Oyun ekranları bunun üstüne ayrı bir kimlik katmanı bindirir — bkz. **"Festival Layer — Games"**.

> **Kaynak:** Bu dosya `constants/Colors.ts` ve `constants/theme.ts`'i tarif eder, onların
> yerine geçmez. Çelişki varsa kod doğrudur ve bu dosya düzeltilir.

## Color Palette

Yön: **"Cinematic Dark"** — sıcak derin zemin + sinematik amber vurgu (v4, 2026-06-23).
Eski violet/zinc paleti terk edildi.

### Core — Backgrounds (Warm Deep)
| Token | Hex | Usage |
|-------|-----|-------|
| `background` / `bgPrimary` | #0A0A0F | App background |
| `bgCard` | #12121A | Card surfaces |
| `bgElevated` | #1A1A24 | Modals, sheets, elevated UI |
| `bgSubtle` | #22222E | Dividers, inactive elements |

### Accent — Dual System
| Token | Hex | Usage |
|-------|-----|-------|
| `accentPrimary` | #E8A838 | Primary CTA, active tabs, main interactions (cinematic amber) |
| `accentHover` | #C48820 | Pressed states |
| `accentDim` | rgba(232,168,56,0.15) | Muted amber fill — chips, icon wells |
| `gold` | #D4A843 | Ratings, premium badges, prestige |
| `goldDark` | #B8922E | Gold pressed state |
| `goldLight` / `goldMid` / `goldDim` | — | Decorative gold scale |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `swipeRight` | #34D399 | Watchlist add (green) |
| `swipeLeft` | #EF4444 | Skip (red) |
| `swipeDown` | #3B82F6 | Watched/seen (blue) |
| `success` | #34D399 | Confirmations |
| `warning` | #FBBF24 | Alerts |
| `error` | #EF4444 | Errors |
| `info` | #60A5FA | Informational highlights |

### Text (Warm Scale)
| Token | Hex | Usage |
|-------|-----|-------|
| `textPrimary` / `textWhite` | #F0F0F5 | Headings, main content (soft off-white) |
| `textSecondary` / `textGrey` | #8888A0 | Meta info, subtitles |
| `textTertiary` / `textLightGrey` | #55556A | Timestamps, hints, eyebrow |
| `textOnAccent` | #0A0A0F | Text on amber buttons (dark for contrast) |

## Typography

Ölçek `Theme.typography` içinde tanımlı. Font: sistem fontu (iOS System / Android sans-serif)
+ PlayfairDisplay (6 ağırlık).

| Token | Font | Size/LH | Weight | Usage |
|-------|------|---------|--------|-------|
| `display` | PlayfairDisplay Bold | 32/38 | 700 | Hero text, archetype reveal |
| `h1` | System | 24/30 | 700 | Screen titles |
| `h2` | System | 22/28 | 600 | Section headers |
| `h3` | System | 17/22 | 600 | Card titles, film names |
| `body` | System | 15/22 | 400 | Main content |
| `caption` | System | 13/18 | 400 | Meta info, timestamps |
| `micro` | System | 11/14 | 500 | Badges, chips, tags |
| `tabLabel` | System | 11 | 700 | Active tab label |
| `rating` | PlayfairDisplay Bold | 16 | 700 | Film scores (gold) |

**Rule (v3 — 2026-07-29):** Sistem fontu, kullanıcının *üzerine bastığı* her şeyin fontudur:
buton, etiket, input, sayaç, meta. PlayfairDisplay **otoritenin sesidir** — ekranın "yayın"
öğeleri: film adı, dava başlığı, oyun adı, tema adı, logline/alıntı gövdesi, sonuç anı.
Butonda, chip'te veya form etiketinde serif hâlâ **yasak**.

## Spacing & Radius
| Token | Value |
|-------|-------|
| spacing-xs | 4px |
| spacing-sm | 8px |
| spacing-md | 16px |
| spacing-lg | 24px |
| spacing-xl | 32px |
| spacing-xxl | 48px |
| radius-sm | 8px |
| radius-md | 12px |
| radius-lg | 16px |
| radius-xl | 24px |
| radius-full | 9999px |

---

# Festival Layer — Games

Oyun ekranlarının kimlik katmanı. Kaynak: `docs/referans/` mockup'ları (2026-07-29).

## Direktif

> Design Chosy Games as if it were the official companion app of an elite international film
> festival. Every screen should feel curated, intellectual and premium. Avoid playful mobile
> game aesthetics. Use the visual language of Cannes Film Festival, Criterion Collection,
> Letterboxd and modern luxury editorial design. Users should feel like cinephiles building
> cultural prestige, not players collecting points. XP, levels and progression must exist,
> but always be presented as mastery, reputation and cinematic expertise rather than gaming rewards.

Tek cümlelik ölçüt: **kullanıcı Wordle oynayan biri gibi değil, Cannes'da jüri üyesi gibi hissetmeli.**

## 6 Kural

1. **Tek altın.** Oyun başına ayrı vurgu rengi YOK. `accentPrimary` = etkileşim, `gold` = prestij.
   Semantik renk (`success`/`error`) yalnız geri bildirim anında ve yalnız metin/ikon/kenarlık
   olarak; kart yüzeyi asla semantik renge boyanmaz.
   *Reddedilen yön: oyun başına neon renk (mor Spotlight, kırmızı Imposter, teal CineMetrics).*
2. **Serif = otorite.** Ekranın "yayın" öğeleri serif: oyun adı, dava başlığı, tema adı,
   logline/alıntı gövdesi, film adı, sonuç anı. Buton/etiket/sayaç sistem fontu kalır.
3. **Eyebrow sistemi.** Her bölümün üstünde `Theme.typography.eyebrow` mikro etiket —
   11px, `letterSpacing: 1.6`, uppercase, `textTertiary`.
   Örnek: `TODAY'S THEME`, `CLUE 01`, `ACTIVE CLUES`, `YOUR CINEMA IDENTITY`, `HINT CREDITS`.
4. **Afiş büyür.** Poster/still ekranın kahramanıdır. Detective şüpheli grid'i 3 sütun ve
   tam kanamalı; Spotlight/FadeIn görseli ekran yüksekliğinin ≥%45'i.
5. **Kenarlık, gölge değil.** Kart = düz `bgCard` + 1px `goldHairline`. Neon glow yok;
   `Theme.shadow.goldGlow` yalnız zafer anında, tek seferlik.
6. **Az hareket.** Ekran başına en fazla **bir** anlamlı animasyon (perde açılışı, eleme solması,
   harf açılışı). Geri kalan her şey 200–300ms fade/translate.

## Ekran Anatomisi

```
eyebrow  →  serif başlık  →  kahraman görsel  →  aksiyon  →  meta
```

Meta (streak, XP, ipucu sayacı) ekranın ortasından çıkar, alt bara iner.

## Token Ekleri

### Renk (`constants/Colors.ts`)
| Token | Değer | Usage |
|-------|-------|-------|
| `goldHairline` | rgba(212,168,67,0.22) | Kart kenarlığı — festival katmanının imzası |
| `goldSeal` | rgba(212,168,67,0.10) | "Tamamlandı" mührü zemini |
| `scrim` | rgba(10,10,15,0.72) | Afiş/backdrop üstü metin okunurluğu |

### Tipografi (`Theme.typography`)
| Token | Font | Size/LH | Usage |
|-------|------|---------|-------|
| `eyebrow` | System 600 | 11/14, ls 1.6, uppercase | Bölüm üstü mikro etiket |
| `serifTitle` | PlayfairDisplay Bold | 26/32 | Oyun adı, dava başlığı |
| `serifHero` | PlayfairDisplay Black | 34/40 | Tema adı, sonuç anı, film adı |
| `serifQuote` | PlayfairDisplay Italic | 22/32 | Logline ve alıntı gövdesi |
| `stat` | System 700, tabular | 28/32 | Skor, DNA, level sayıları |

## GameShell (ortak kabuk)

`components/games/GameShell/` — tüm oyunlar bunun içinde yaşar.

- **Header:** geri oku (44×44) · ortada [eyebrow + serif 20/26 başlık] · sağ slot (44×44).
  Sağ slot boş olsa bile yer tutar — başlık optik olarak ortalı kalsın diye.
- **Progress:** nokta değil **altın segment çubuğu**. `maxAttempts` kadar `flex:1` segment,
  3px yükseklik, 4px aralık. Harcanan `gold`, kalan `white05`.
  `accessibilityRole="progressbar"` + `games.common.progress_label`.
- **Content:** `paddingHorizontal: spacing.md`, `paddingBottom: 83` (tab bar clearance).
- Props genişletilebilir, daraltılamaz: `title`, `subtitle?`, `headerRight?`,
  `currentAttempt`, `maxAttempts`, `hideProgress?`.

## Kod Kuralları (oyun ekranları)

- Yalnız Phosphor **duotone**; Ionicons aynı ekranda karışmaz.
- `index.tsx` + `styles.ts` ayrımı zorunlu — inline `StyleSheet` bırakılmaz.
- Tüm metin `t()` üzerinden; eyebrow metinleri de çeviri anahtarıdır.
- i18n interpolasyonu **`%{name}`** sözdizimiyle (i18n-js) — `{{name}}` çalışmaz.
- Yeni telemetri event'i uydurulmaz; önce `.claude/game-system-brief.md`'ye eklenir.

---

## Component Specs

### SwipeCard (Target)
- Full-bleed poster, 3:4 aspect ratio, fills ~85% of screen height
- Bottom 40% gradient: transparent → bg-primary
- Film title: bottom-left, H2 white, bold
- Meta line: year · genre · duration in text-secondary
- Stack: 2 cards behind, scale(0.95) + scale(0.90), blur(2px)
- Swipe overlays: green "+" / red "✕" / blue "👁" at 0→0.3 opacity
- Match score badge: bottom-right corner

### Action Buttons (Below Card)
- 3 circular buttons in a row, centered
- Skip: ✕ icon, red border, 48px diameter
- Surprise: ★ icon, accentPrimary filled, 56px diameter (larger = emphasis)
- Watchlist: ♡ icon, green border, 48px diameter
- Press: scale(0.9) + haptic light

### Bottom Tab Bar
- 4 tabs: Home / Search / Watchlist / Profile
- Active: accentPrimary (#E8A838) icon (filled variant) + label (11px bold)
- Inactive: tabInactive (#55556A) icon (outline variant), no label
- Tab height: 83px, position: absolute
- Transition: outline→filled icon morph, 200ms ease

### Film Detail (Bottom Sheet)
- Drag handle at top (bgSubtle, 40x4px, radius-full)
- 80% screen height, bg-elevated background
- Poster: blurred background + sharp thumbnail
- Title: PlayfairDisplay Bold (Display style)
- Rating: PlayfairDisplay Bold, gold colored

### Empty States
- Lumi orb or illustration centered
- Message below in text-secondary
- CTA button in accent-primary

## Mascot / Animated Element
- **Flick (Rive): IPTAL EDILDI** — kaldirildI, dependency'ler uninstall edildi
- **Lumi:** Programatik animasyon orb, mood ekraninda aktif, korunuyor

## Gamification UI
- Implemented and live in V1.0
- **StreakBadge:** Pill badge, Feed sag ust, Colors.accentPrimary border, pulse on increment
- **MilestoneCelebration:** Full-screen overlay, konfeti + Flick 120px + staggered content
- **StreakCard:** Profile ekrani, 3-stat row + 14-gun dot takvim + progress bar
- Konfeti renkleri: Colors.accentPrimary + Colors.gold + Colors.success
- Kutlama kapatma: sadece manuel (CTA veya backdrop tap)
- Special milestones (films_100+, streak_30): extra confetti + FilmSeridi

## Stats Charts
- Implemented in V1.0 (DiscoveryStats component)
- **MoodPatternChart:** Horizontal bar timeline, son 14 gun, baskil duygu rengiyle
  - Duygu renkleri TasteDNA'daki EMOTION_COLORS ile ayni (import et)
  - Staggered bar animasyonu (50ms * index)
- **GenreDonutChart:** 180px donut, max 5 dilim + Other, merkez toplam sayi
  - Dilim paleti: accentPrimary → gold → success → info → warning → bgSubtle
  - Saat yonunde cizilme animasyonu (~800ms)
- Her iki chart Profile ekraninda, mevcut section'lar arasina yerlesir

## Home Screen (P7.1)
- Implemented in V1.0
- **GreetingWidget:** Saat bazli selamlama + kullanici adi, Inter Bold 28px
- **MoodCTA:** Tam genislik amber gradient buton, glow pulse (idle), scale(0.97) press
- **DailyPickSection:** DailyMatchCard wrapper, 2.5:4 aspect, "Today's Pick" ust baslik
- **LastSessionCard:** Son mood session ozeti, 3 mini poster + CTA link
- Sadece `!currentProfile` durumunda gorunur — profil secilince swipe feed'e gecis
- Stagger animasyon: 0→400ms FadeInDown, springify

## Social Share Cards
- Implemented in V1.0
- **FilmShareCard:** 360x450px (3x→1080x1350 PNG), poster + title + mood text + branding
  - Poster blur ambient arka plan efekti (blurRadius:25, opacity:0.15)
  - PlayfairDisplay sadece film title + tirnak isareti
- **MoodShareCard:** 360x450px, mood text + AI profil ozeti + dekoratif parcaciklar
  - Gradient bg: bgPrimary → bgCard
  - Gold tirnak isaretleri, uppercase "TODAY I FEEL" etiket
- Offscreen render + react-native-view-shot + expo-sharing

## Taste Calibration (P8.1)
- Implemented in V1.0
- **TasteCalibration:** 6 senaryo-bazli soru karti, FadeOutLeft/FadeInRight gecis, 400ms bekleme
- **QuestionCard:** bgCard kart, 24px radius, 4 secenek (veya 3), secim → accentPrimary border + accentDim bg
- **ProgressBar:** 4px bar (bgSubtle → accentPrimary dolgu), 12px glow dot, animated genislik
- **ArchetypeReveal:** Tam ekran, arketip colorDim gradient bg, 120px emoji dairesi, parcaciklar
  - PlayfairDisplay Bold 32px arketip adi (tek istisna — premium reveal ani)
  - Stagger: bg(0ms) → parcacik(200ms) → emoji(400ms) → ad(700ms) → desc(900ms) → CTA(1200ms)
  - Null fallback: "Mystery Cinephile" + amber tema
- Mevcut 3 intro slide KORUNUR, calibration + reveal SONRASINA eklenir

## Auth Screens QA
- Implemented in V1.0
- auth.tsx + setup-profile.tsx CDO spec'siz build edildi, QA fix spec hazirlandi
- 3 critical (PlayfairDisplay ihlali x2, hardcoded hex), 4 medium, 2 minor
- Yeni token gerekli: `Colors.pink: '#EC4899'`

## Animation Standards
- Swipe card follow: 1:1 with finger, rotation = distance x 0.08 (max +/-12deg)
- Swipe threshold: 120px horizontal, 100px vertical
- Card transition: 0.3s spring
- Tab morph: 200ms ease
- Haptic: light on swipe start, medium on threshold cross, heavy on action complete
- Skeleton shimmer: 1.5s infinite pulse
- Milestone confetti: particle rain + FilmSeridi animation
