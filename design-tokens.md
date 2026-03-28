# MoodFlix Design System — Claude Code Reference

## Brand Identity
- **Vibe:** Cinematic, dark, immersive — Netflix meets Tinder meets Letterboxd
- **Primary mood:** Moody, elegant, slightly playful

## Color Palette
```
background-primary:    #0A0A0A   (almost black)
background-card:       #18181B   (zinc-900)
background-elevated:   #27272A   (zinc-800)
surface-subtle:        #3F3F46   (zinc-700)

text-primary:          #FAFAFA   (zinc-50)
text-secondary:        #A1A1AA   (zinc-400)
text-muted:            #71717A   (zinc-500)

accent-primary:        #8B5CF6   (violet-500, mood/brand color)
accent-secondary:      #6D28D9   (violet-700)

swipe-right:           #22C55E   (green-500, watchlist/like)
swipe-left:            #EF4444   (red-500, skip/dislike)
swipe-up:              #3B82F6   (blue-500, super like/watched)

rating-star:           #FACC15   (yellow-400)
```

## Typography
```
font-family:           "Inter" (primary), "System" (fallback)
title-large:           24px, font-weight: 700, letter-spacing: -0.5
title-medium:          20px, font-weight: 600
body:                  16px, font-weight: 400, line-height: 1.5
caption:               13px, font-weight: 400, color: text-secondary
label:                 11px, font-weight: 600, text-transform: uppercase, letter-spacing: 1
```

## Spacing Scale
```
xs:    4px
sm:    8px
md:    16px
lg:    24px
xl:    32px
2xl:   48px
```

## Border Radius
```
sm:    8px    (buttons, chips)
md:    12px   (input fields, small cards)
lg:    16px   (cards, modals)
xl:    24px   (large cards, bottom sheets)
full:  9999px (pills, avatar)
```

## Component Patterns

### Film Card (SwipeCard)
- Full-bleed poster image, 3:4 aspect ratio
- Gradient overlay bottom 40% (transparent → background-primary)
- Title: title-large, white, bottom-left over gradient
- Meta row: year • rating ★ • genre chips
- Subtle border: 1px surface-subtle with 0.3 opacity
- Shadow: 0 8px 32px rgba(0,0,0,0.6)
- Border radius: xl (24px)

### Mood Selector
- Horizontal scroll of mood chips
- Active: accent-primary bg, white text
- Inactive: background-elevated bg, text-secondary
- Pill shape (border-radius: full)
- Emoji + label format: "😢 Sad" "🔥 Excited"

### Bottom Navigation
- background-primary with top border 1px surface-subtle
- 4-5 tabs max
- Active: accent-primary icon + label
- Inactive: text-muted icon, no label
- Icons: 24px, outline style (Lucide or Phosphor)

### Watchlist Item
- Horizontal layout: poster thumbnail (60x90) + info
- Poster: border-radius md
- Title: body weight 600
- Subtitle: caption, text-secondary (year, genre)
- Right side: rating or action icon

### Stats/Profile Cards
- background-card, border-radius lg
- Inner padding: lg (24px)
- Stat number: title-large, accent-primary
- Stat label: caption, text-muted

## Animation & Interaction
- Card transitions: 300ms, ease-out
- Swipe threshold: 120px horizontal, 100px vertical
- Haptic feedback: light on swipe start, medium on threshold cross
- Micro-interactions: scale(0.98) on card press, spring back
- Page transitions: fade + slight translateY (200ms)

## Shadows
```
card:      0 4px 24px rgba(0, 0, 0, 0.5)
elevated:  0 8px 32px rgba(0, 0, 0, 0.6)
glow:      0 0 20px rgba(139, 92, 246, 0.3)  (accent glow)
```

## Dark Mode Notes
- This IS the dark mode — no light mode variant needed
- All backgrounds should be true dark, never gray-ish
- Text contrast ratio minimum 4.5:1 for body, 3:1 for large text
- Avoid pure white (#FFFFFF) for text — use zinc-50 (#FAFAFA)

## Icon Style
- Library: Lucide React Native or Phosphor Icons
- Style: outline/light weight
- Size: 20px (inline), 24px (nav), 32px (feature)
- Color: inherits from text color context

## Do's and Don'ts
✅ Use gradients over images for text readability
✅ Generous spacing — let content breathe
✅ Consistent border radius per component type
✅ Subtle borders (0.3 opacity) to separate layers
✅ Use accent-primary sparingly — for CTAs and active states

❌ No light/white backgrounds anywhere
❌ No thin 1px borders at full opacity
❌ No more than 2 font weights in one component
❌ No shadows on dark-on-dark (only on elevated elements)
❌ No generic blue for interactive elements (use violet)
