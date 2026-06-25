# Chosy.ai (MoodFlix) — Project Rules v5

> **App Store:** `Chosy.ai - Mood Movie Finder` | **Code/comms:** `MoodFlix`
> **Status:** V1.0.2 App Store'da live | **Aktif:** Mini Games Sprint (14-20 Mayis)
> **Build:** `expo-dev-client` — Expo Go degil

---

## Proje Durumu

- V1.0.2 iOS App Store'da live
- Aktif sprint: Mini Games & Daily Engagement (3 oyun)
- Core flow calisiyor: onboarding > mood > AI > swipe > watchlist > paywall
- Yatirimci toplantisi: 20 Mayis 2026
- Oyunlar FREE — kota/paywall yok (engagement oncelikli)

## Kod Kurallari

- TypeScript strict — `any` YASAK
- Fonksiyonel component — class component YASAK
- Her component: `ComponentName/index.tsx` + `styles.ts` (ayri klasor)
- `StyleSheet.create` zorunlu — inline style YASAK
- `Theme.xxx` kullan (Theme.spacing, Theme.borderRadius, Theme.typography, Theme.shadow)
- Tum metinler i18n uzerinden: `t('key')` — hardcoded string YASAK
- `console.log` birakma — `utils/logger.ts` kullan
- JSDoc: her fonksiyon ve component ustune yorum
- Import sirasi: React > kutuphaneler > yerel (aralarinda bos satir)

## Kritik Import Kurallari

```typescript
import { Colors } from '@/constants/Colors'          // Buyuk C — kucuk c crash!
import { Theme } from '@/constants/theme'
import * as watchlist from 'services/watchlist'       // watchlistService.ts DEGIL
import { encodeVector } from 'services/vectorEncoder' // Tek kaynak — baska yerde YASAK
// expo-localization dogrudan import YASAK > LanguageContext kullan

// Ikon sistemi — tek kaynak
import { EmotionIcons, ArchetypeIcons, MoodIcons, AvatarIcons, GamificationIcons, CalibrationIcons, TasteDNAIcons } from '@/constants/icons'
// archetype.image kullan (ImageSourcePropType) — archetype.icon MEVCUT DEGIL
```

## Mimari

- `app/(tabs)/index.tsx` = Home — Mood search + AI processing + result (3 state: input/processing/result)
- `app/discover.tsx` = Film swipe feed (STACK screen, tab degil)
- `app/(tabs)/mood.tsx` = Discover placeholder (gelecek: browse/explore)
- `app/(tabs)/watchlist.tsx` = Izleme listesi (2x2 grid + grouped view)
- `app/(tabs)/profile.tsx` = Profil, arketip, stats, settings
- `app/film/[id].tsx` = Film detay
- `app/onboarding.tsx` = Taste calibration + archetype reveal
- `app/gate.tsx` = Auth guard (anonim > /auth'a yonlendir)
- `app/auth.tsx` = Apple Sign-In (zorunlu)
- `app/paywall.tsx` = 3 plan (weekly/monthly/yearly) + purchase + restore
- `app/games/_layout.tsx` = Games stack navigator (YENİ)
- `app/games/index.tsx` = Games Hub — oyun listesi (YENİ)
- `app/games/imposter.tsx` = Imposter oyunu (YENİ)
- `app/games/pinpoint.tsx` = 5 Ipucu oyunu (YENİ)
- `app/games/roast.tsx` = Acimasiz Elestiri oyunu (YENİ)
- `app/lifetime.tsx` = Founding Member ozel satis (modal, scarcity counter)
- `app/referral.tsx` = Davet programi (milestone rewards, share)
- Provider zinciri: GestureHandlerRootView > SafeAreaProvider > LanguageProvider > MoodProvider > SubscriptionProvider > ThemeProvider > Stack
- Vector kodlama: sadece `services/vectorEncoder.ts` (384 boyut)
- Her ekranda `paddingBottom: 83` — tab bar floating pill

## Teknoloji

- React Native 0.83.2 + Expo SDK 55 + Expo Router v7
- Supabase (PostgreSQL + pgvector + Edge Functions)
- RevenueCat (subscriptions)
- Claude API (mood parsing)
- TMDb API (film data)
- react-native-reanimated v4 + gesture-handler
- i18n-js + expo-localization (EN + TR)
- 69 custom PNG icon (assets/icons/, constants/icons.ts)

## Subscription & Kota

- Free: 3 mood search/gun
- Monthly ($6.99/m): 15/gun, sinirsiz slot/game
- Annual ($39.99/y): 25/gun, sinirsiz slot/game
- Lifetime ($89.99): 50/gun, sinirsiz her sey, Founding Member (ilk 1000)
- Auth gating AKTIF — Apple Sign-In zorunlu
- Referral: 1/3/5/10 milestone rewards (free months, slot tokens, lifetime upgrade)

## Bilinen Sorunlar

| Sorun | Not |
|-------|-----|
| `match_films` overload | Yeni overload olusturma |
| Pre-existing TS hatalari | `supabase/functions/`, `ExternalLink.tsx`, `SkeletonLoader`, `watchlist.tsx:122,144` — dokunma |
| Google Sign-In | Stub — native rebuild gerekli, V1.1'de degerlendirilecek |

## Referans Dokumantasyonu

| Konu | Dosya |
|------|-------|
| Teknik mimari, folder map, data flow, DB schema | `ARCHITECTURE.md` |
| Tasarim sistemi, renkler, tipografi, component spec | `DESIGN_SYSTEM.md` |
| V1.1+ roadmap, gelecek planlar | `ROADMAP.md` |
| App Store listing, ASO, launch checklist | `docs/LAUNCH_CHECKLIST.md` |
| Eski changelog, session log, specs | `docs/archive/` |
| RevenueCat offerings, webhooks, entitlements | `docs/REVENUECAT_FINAL_SETUP.md` |
| Yatirimci metrikleri (SQL queries) | `docs/INVESTOR_METRICS.md` |

## Agent Briefleri (Aktif Sprint)

| Brief | Dosya |
|-------|-------|
| CDO: Mini Games UI Specs | `.claude/briefs/CDO_MINI_GAMES_SPECS.md` |
| CTO: Mini Games Implementation | `.claude/briefs/CTO_MINI_GAMES_IMPL.md` |
| CMO: Mini Games Copy | `.claude/briefs/CMO_MINI_GAMES_COPY.md` |
