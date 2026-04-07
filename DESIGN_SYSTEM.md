# MoodFlix — Design System ("Premium Bumble")

## Philosophy
Bumble's addictive swipe UX + cinema-grade premium aesthetics. Think: a luxury movie theater in your pocket, not a dating app.

## Color Palette

### Core
| Token | Hex | Name | Usage |
|-------|-----|------|-------|
| bg-primary | #0A0A0A | zinc-950 | App background |
| bg-card | #18181B | zinc-900 | Card surfaces |
| bg-elevated | #27272A | zinc-800 | Modals, sheets, elevated UI |
| bg-subtle | #3F3F46 | zinc-700 | Dividers, inactive elements |

### Accent — Dual System
| Token | Hex | Name | Usage |
|-------|-----|------|-------|
| accent-primary | #8B5CF6 | violet-500 | Primary CTA, active tabs, main interactions |
| accent-hover | #7C3AED | violet-600 | Pressed states, Flick body color |
| accent-gold | #D4A843 | gold | Ratings, premium badges, special highlights |
| accent-gold-dim | #B8922E | gold-dark | Gold pressed state |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| swipe-right | #22C55E | Watchlist add (green) |
| swipe-left | #EF4444 | Skip (red) |
| swipe-down | #3B82F6 | Watched/seen (blue) |
| success | #22C55E | Confirmations |
| warning | #F59E0B | Alerts |
| error | #EF4444 | Errors |

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| text-primary | #FAFAFA | Headings, main content (zinc-50) |
| text-secondary | #A1A1AA | Meta info, subtitles (zinc-400) |
| text-tertiary | #71717A | Timestamps, hints (zinc-500) |
| text-on-accent | #FFFFFF | Text on violet/green/red buttons |

## Typography
| Style | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| Display | PlayfairDisplay | 28-32 | Bold | Film detail title, special headings |
| H1 | Inter | 24 | Bold | Screen titles |
| H2 | Inter | 20 | SemiBold | Section headers |
| H3 | Inter | 16 | SemiBold | Card titles, list headers |
| Body | Inter | 14 | Regular | Main content |
| Caption | Inter | 12 | Regular | Meta info, timestamps |
| Tab Label | Inter | 11 | Bold | Active tab label |
| Rating | PlayfairDisplay | 16 | Bold | Film scores (gold colored) |

**Rule:** Inter is the workhorse. PlayfairDisplay is the "premium sprinkle" — use it ONLY for film titles in detail view and rating numbers. Never for buttons, labels, or body text.

## Spacing & Radius
| Token | Value |
|-------|-------|
| spacing-xs | 4px |
| spacing-sm | 8px |
| spacing-md | 16px |
| spacing-lg | 24px |
| spacing-xl | 32px |
| radius-sm | 8px |
| radius-md | 12px |
| radius-lg | 16px |
| radius-xl | 24px |
| radius-full | 9999px |

## Component Specs

### SwipeCard (Target)
- Full-bleed poster, 3:4 aspect ratio, fills ~85% of screen height
- Bottom 40% gradient: transparent → bg-primary
- Film title: bottom-left, H2 white, bold
- Meta line: year · genre · duration in text-secondary
- Stack: 2 cards behind, scale(0.95) + scale(0.90), blur(2px)
- Swipe overlays: green "+" / red "✕" / blue "👁" at 0→0.3 opacity
- Flick mascot: 48px, bottom-right corner (when built)

### Action Buttons (Below Card)
- 3 circular buttons in a row, centered
- Skip: ✕ icon, red border, 48px diameter
- Surprise: ★ icon, violet filled, 56px diameter (larger = emphasis)
- Watchlist: ♡ icon, green border, 48px diameter
- Press: scale(0.9) + haptic light

### Bottom Tab Bar
- 4 tabs: Home / Search / Watchlist / Profile
- Active: violet-500 icon (filled variant) + label (11px bold)
- Inactive: zinc-500 icon (outline variant), no label
- Tab height: 83px, position: absolute
- Transition: outline→filled icon morph, 200ms ease

### Film Detail (Bottom Sheet)
- Drag handle at top (zinc-700, 40x4px, radius-full)
- 80% screen height, bg-elevated background
- Poster: blurred background + sharp thumbnail
- Title: PlayfairDisplay Bold (Display style)
- Rating: PlayfairDisplay Bold, gold colored

### Empty States
- Flick mascot centered, 120px
- Message below in text-secondary
- CTA button in accent-primary

## Mascot: Flick
- **Status: SPEC COMPLETE, AWAITING RIVE BUILD** (Lumi is current placeholder)
- **Full spec:** `.claude/specs/FLICK_MASCOT_SPEC.md`
- Cinematic cat, violet body (Colors.accentHover #7C3AED), amber eyes (Colors.gold)
- Film-strip tail (cinema motif)
- Rive animation with state machine (`FlickController`)
- 4 layers: body, eyes, tail, effects
- 8 emotion states: idle, happy, sad, thinking, excited, surprised, love, sleepy
- Inputs: mood (0-7), is_swiping (bool), swipe_direction (0-3), celebration (bool)
- Sizes: 48px (card corner), 96px (AI loading), 120px (empty state), 256px (onboarding)
- Transition plan: Lumi component becomes wrapper, Flick renders inside
- Target .riv file: assets/flick/flick.riv, < 150KB
- **Rive build guide:** `.claude/specs/FLICK_RIVE_BUILD_GUIDE.md`
- **Activation:** Set `USE_RIVE = true` in `components/Flick/index.tsx` after .riv placed
- State machine bindings coded — 4 useEffect syncs for mood/isSwiping/swipeDirection/celebration

## Gamification UI
- **Full spec:** `.claude/specs/GAMIFICATION_UI_SPEC.md`
- **StreakBadge:** Pill badge, Feed sag ust, Colors.accentPrimary border, pulse on increment
- **MilestoneCelebration:** Full-screen overlay, konfeti + Flick 120px + staggered content
- **StreakCard:** Profile ekrani, 3-stat row + 14-gun dot takvim + progress bar
- Konfeti renkleri: Colors.accentPrimary + Colors.gold + Colors.success
- Kutlama kapatma: sadece manuel (CTA veya backdrop tap)
- Special milestones (films_100+, streak_30): excited Flick + extra confetti

## Stats Charts
- **Full spec:** `.claude/specs/STATS_CHARTS_SPEC.md`
- **MoodPatternChart:** Horizontal bar timeline, son 14 gun, baskil duygu rengiyle
  - Duygu renkleri TasteDNA'daki EMOTION_COLORS ile ayni (import et)
  - Staggered bar animasyonu (50ms * index)
- **GenreDonutChart:** 180px donut, max 5 dilim + Other, merkez toplam sayi
  - Dilim paleti: violet → gold → green → blue → warning → bgSubtle
  - Saat yonunde cizilme animasyonu (~800ms)
- Her iki chart Profile ekraninda, mevcut section'lar arasina yerlesir

## Home Screen (P7.1)
- **Full spec:** `.claude/specs/HOME_SCREEN_SPEC.md`
- **GreetingWidget:** Saat bazli selamlama + kullanici adi, Inter Bold 28px
- **MoodCTA:** Tam genislik violet gradient buton, glow pulse (idle), scale(0.97) press
- **DailyPickSection:** DailyMatchCard wrapper, 2.5:4 aspect, "Today's Pick" ust baslik
- **LastSessionCard:** Son mood session ozeti, 3 mini poster + CTA link
- Sadece `!currentProfile` durumunda gorunur — profil secilince swipe feed'e gecis
- Stagger animasyon: 0→400ms FadeInDown, springify

## Social Share Cards
- **Full spec:** `.claude/specs/SOCIAL_SHARE_SPEC.md`
- **FilmShareCard:** 360x450px (3x→1080x1350 PNG), poster + title + mood text + branding
  - Poster blur ambient arka plan efekti (blurRadius:25, opacity:0.15)
  - PlayfairDisplay sadece film title + tirnak isareti
- **MoodShareCard:** 360x450px, mood text + AI profil ozeti + dekoratif parcaciklar
  - Gradient bg: bgPrimary → bgCard
  - Gold tirnak isaretleri, uppercase "TODAY I FEEL" etiket
- Offscreen render + react-native-view-shot + expo-sharing

## Taste Calibration (P8.1)
- **Full spec:** `.claude/specs/TASTE_CALIBRATION_SPEC.md`
- **TasteCalibration:** 6 senaryo-bazli soru karti, FadeOutLeft/FadeInRight gecis, 400ms bekleme
- **QuestionCard:** bgCard kart, 24px radius, 4 secenek (veya 3), secim → violet border + accentDim bg
- **ProgressBar:** 4px bar (bgSubtle → accentPrimary dolgu), 12px glow dot, animated genislik
- **ArchetypeReveal:** Tam ekran, arketip colorDim gradient bg, 120px emoji dairesi, parcaciklar
  - PlayfairDisplay Bold 32px arketip adi (tek istisna — premium reveal ani)
  - Stagger: bg(0ms) → parcacik(200ms) → emoji(400ms) → ad(700ms) → desc(900ms) → CTA(1200ms)
  - Null fallback: "Mystery Cinephile" + violet tema
- Mevcut 3 intro slide KORUNUR, calibration + reveal SONRASINA eklenir

## Auth Screens QA
- **Full spec:** `.claude/specs/AUTH_SCREENS_QA_SPEC.md`
- auth.tsx + setup-profile.tsx CDO spec'siz build edildi, QA fix spec hazirlandi
- 3 critical (PlayfairDisplay ihlali x2, hardcoded hex), 4 medium, 2 minor
- Yeni token gerekli: `Colors.pink: '#EC4899'`

## Animation Standards
- Swipe card follow: 1:1 with finger, rotation = distance × 0.08 (max ±12°)
- Swipe threshold: 120px horizontal, 100px vertical
- Card transition: 0.3s spring
- Tab morph: 200ms ease
- Haptic: light on swipe start, medium on threshold cross, heavy on action complete
- Skeleton shimmer: 1.5s infinite pulse
- Milestone confetti: particle rain + Flick celebration state
