# Chosy.ai (MoodFlix) — Project Rules v5

> **App Store:** `Chosy.ai - Mood Movie Finder` | **Code/comms:** `MoodFlix`
> **Status:** V1.0.2 App Store'da live | **Aktif:** Oyun Sistemi Faz 1 Sprint
> **Build:** `expo-dev-client` — Expo Go degil

---

## VİZYON (v2 — 23 Temmuz 2026, CTO onaylı)

Chosy, **"sinefil olmak için kullanılan günlük antrenman uygulaması"**dır. Çekirdek döngü: her gün herkese aynı günlük görevler (CineMetrics, The Logline) → her cevap Cinema DNA'ya sinyal yazar → sonuç paylaşılabilir film şeridi kartı üretir → streak + rank ilerler.

- Rakip konumlandırma: NYT Games'in sinema versiyonu; **Letterboxd kullanıcılarının açacağı ikinci uygulama.** Letterboxd ile loglama/inceleme alanında REKABET ETMEYİZ.
- Mood search / öneri motoru SİLİNMEDİ: "Pro katman" olarak yaşıyor (Faz 2'de Tonight sekmesine taşınacak). Bu koda dokunan işlerde mevcut davranış korunur.
- Geçiş kademeli ve kapı metriklerine bağlı: Faz 1 kapısı (D7 farkı ≥ +10 puan, haftalık tamamlama medyanı ≥ 3/7) geçilmeden Faz 2 vitrin/tab değişikliği YAPILMAZ.

**Karar hiyerarşisi:** Mimari kararlar CTO'ya (Claude chat) aittir. Claude Code implementasyon yapar; spec'te belirsizlik varsa varsayım üretmek yerine sorar. Kaynak sıralaması: (1) sprint planındaki task prompt'u → (2) `docs/CHOSY_OYUN_SISTEMI_TASARIM_RAPORU.md` → (3) `.claude/game-system-brief.md`.

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

## Agent Briefleri (Aktif Sprint)

| Brief | Dosya |
|-------|-------|
| CDO: Mini Games UI Specs | `.claude/briefs/CDO_MINI_GAMES_SPECS.md` |
| CTO: Mini Games Implementation | `.claude/briefs/CTO_MINI_GAMES_IMPL.md` |
| CMO: Mini Games Copy | `.claude/briefs/CMO_MINI_GAMES_COPY.md` |

---

## OYUN SİSTEMİ HARD RULES (ihlal = diff reddedilir)

1. **Çözüm istemciye asla inmez.** `solution_ref`, sansür kelimeleri ve her türlü cevap verisi yalnızca sunucuda yaşar. İstemci `daily_puzzles` tablosuna DEĞİL, yalnızca `public_daily_puzzles` view'ına erişir. Herhangi bir response, log veya cache'te çözüm sızıntısı release-blocker'dır.
2. **Tahmin doğrulama sunucuda.** Feedback hesabı (renk kuralları) Edge Function'dadır; istemcide feedback mantığı kopyası yazılamaz.
3. **Oyun durumu sunucuda.** `game_scores.progress_json` tek gerçek kaynak; istemci restart'ı durumu sıfırlayamaz.
4. **Config'ler lazy getter ile.** XP katsayıları, DNA ağırlıkları, feature flag'ler `app_config`'ten her kullanımda okunur. Module-level constant'a atamak YASAK (hydration race dersi).
5. **Silent fallback yasak** (genel kural, oyunlarda da geçerli): her hata Sentry'ye düşer, kullanıcıya görünür durum/retry sunulur. Boş catch bloğu yazılamaz.
6. **Migration'lar yalnızca `supabase db push`** (Rule 10). SQL editor kullanılmaz.
7. **Replik Tahmin havuzu DONMUŞTUR.** `movieQuotes.ts`'e yeni replik eklenmez (telif taban çizgisi kararı, 23 Tem 2026).
8. **Telif taban çizgisi:** TMDB poster/backdrop/metadata dışında görsel-işitsel materyal (film karesi, ses, gerçek eleştirmen alıntısı) hiçbir oyuna eklenemez.
9. **Paylaşım kartlarında film adı ve açılmış sansür kelimeleri asla görünmez** (spoiler yasağı = viral mekaniğin kendisi).
10. **Günlük bulmaca herkes için aynıdır** ve cihaz yerel tarihine anahtarlıdır; kullanıcıya özel bulmaca üretilmez.

## OYUN SİSTEMİ KOD KURALLARI

- API çağrılarının tek kaynağı: `services/gameApi.ts` (her çağrı `ensureAuthSession()` ile sarılı).
- Film arama tek component: `components/games/FilmSearchInput/` — kopyalanmaz, genişletilir.
- DNA/skor yazımı yalnızca Edge Function üzerinden; istemciden `cinema_dna`'ya yazma yolu yoktur.
- Oyun ekranlarında Phosphor duotone kullanılır; Ionicons ile aynı ekranda karışmaz.
- Tüm UI metinleri `t()` üzerinden (en.json + tr.json); bulmaca içerik metni (overview) İngilizce kalır, çevrilmez.
- Telemetri taksonomisi: `game_*` prefix, snake_case — event listesi brief'te. Yeni event adı uydurulmaz, brief'e eklenmeden kullanılmaz.
- Yeni oyun eklemek = ortak 5 sisteme (Daily Engine, Cinema DNA, XP/Rank, Streak, ShareCard) mekanik katmanı eklemek. Ortak sistemleri bypass eden oyun kodu yazılamaz.

## REFERANS DOSYALAR

| Konu | Dosya |
|------|-------|
| Teknik mimari, folder map, data flow, DB schema | `ARCHITECTURE.md` |
| Tasarim sistemi, renkler, tipografi, component spec | `DESIGN_SYSTEM.md` |
| V1.1+ roadmap, gelecek planlar | `ROADMAP.md` |
| App Store listing, ASO, launch checklist | `docs/LAUNCH_CHECKLIST.md` |
| Eski changelog, session log, specs | `docs/archive/` |
| RevenueCat offerings, webhooks, entitlements | `docs/REVENUECAT_FINAL_SETUP.md` |
| Yatirimci metrikleri (SQL queries) | `docs/INVESTOR_METRICS.md` |
| Oyun sistemi tasarim raporu (kaynak dokuman) | `docs/CHOSY_OYUN_SISTEMI_TASARIM_RAPORU.md` |
| Faz 1 sprint plani (siralı task'lar) | `docs/CHOSY_FAZ1_SPRINT_PLANI.md` |
| Oyun sistemi hizli referans (brief) | `.claude/game-system-brief.md` |
