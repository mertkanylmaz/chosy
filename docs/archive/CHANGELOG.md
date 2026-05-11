# MoodFlix — Changelog

## P0 — App Store Blockers (Tamamlandı: 2026-03-30)

### Task 1: Design Token Migration ✅ (2026-03-27)
- `constants/Colors.ts` — violet + zinc + gold hybrid palette, gradient ve glow token'lar
- `constants/theme.ts` — Theme objesi (spacing, borderRadius, typography, shadow)
- Tüm ekranlar yeni token'larla render ediliyor

### Task 2: SwipeCard Polish ✅ (2026-03-27)
- Stack effect (2 arka kart, scale 0.95 + 0.90)
- Swipe overlay'lar (green "+", red "✕", blue "👁")
- Bottom gradient, daire match score, Share/Save label'lı aksiyon butonları

### Task 3: Error Handling & Edge Cases ✅ (2026-03-28)
- Tüm ekranlarda `ErrorState` componenti
- Network failure, empty state, auth recovery senaryoları

### Task 4: Loading States ✅ (2026-03-30)
- Feed skeleton: gradient overlay + match circle + watchlist btn placeholder
- `AIProcessingOverlay`: i18n desteği (t prop)
- Pull-to-refresh: `RefreshControl` (feed + watchlist)
- Loading more: premium pill indicator (shimmer + text)

## P0.5 — i18n Migration (Tamamlandı: 2026-03-30)
- Tüm hardcoded stringler `t()` ile sarıldı
- ~80+ i18n key eklendi (`locales/en.json` + `locales/tr.json`)
- Türkçe özel karakterler düzeltildi
- `constants/i18n.ts` + `contexts/LanguageContext.tsx` altyapısı

## P1 — Competitiveness Features (Tamamlandı: 2026-03 öncesi)

### Task 5: Film Detail Bottom Sheet ✅
- 80% yükseklik, drag handle
- Poster blur arka plan + metadata
- "Why this film?" AI explanation
- Watchlist add from detail

### Task 6: Onboarding Flow ✅
- 4 adımlı ilk kullanım (`app/onboarding.tsx`)
- `app/entry.tsx` + `app/gate.tsx` — onboarding kontrolü
- `components/Entry/` — EmotionalHook, InstantGratification, InteractiveStart

### Task 7: Tab Bar Redesign ✅ (2026-03-27)
- 4 tab, gold aktif state, bounce animasyonu
- Lumi mascot → mood tab'ında aktifken animasyon
- `expo-symbols` (`SymbolView`) icon sistemi

### Task 8: Search/Discover Tab ⏭️ DEFERRED → P3
- Karar: App Store blocker değil, P2 kapasitesiyle çakışıyor
- Genre browsing + curated mood collections (sonra)

## P2 Backend (Tamamlandı: 2026-03-28)

### Task 9: Gamification Backend ✅
- `supabase/migrations/009_gamification.sql`
- `user_streaks`, `milestones`, `user_milestones` tabloları + RLS
- `update_streak()` + `check_milestones()` RPC
- `services/gamification.ts` — recordActivity, getStreakInfo, getUserMilestones, markMilestoneSeen
- Feed entegrasyonu: `recordActivity()` her swipe'da çağrılır + milestone toast i18n
- 15 seed milestone kaydı

### Task 11: Watch History Backend + Liste UI ✅
- `supabase/migrations/010_watch_history.sql`
- `user_swipe_history` view + `get_user_stats` / `get_swipe_history` / `get_mood_timeline` RPC
- `services/history.ts` — getUserStats, getSwipeHistory (paginated), getMoodTimeline
- `components/Profile/WatchHistory/` — filter tabs, pagination, mini stats

## UI Redesign (Mart 2026)
- `app/splash.tsx` — 4 halka, altın glow merkez, "MoodFlix" logo
- `app/onboarding.tsx` — altın başlık, buton gölge
- `app/(tabs)/mood.tsx` — history kartı horizontal layout (poster sol)
- `app/(tabs)/watchlist.tsx` — Lumi kaldırıldı, clean header, rounded icon butonlar
- `app/(tabs)/profile.tsx` — mavi gradient header, altın gradient avatar border
- `app/(tabs)/index.tsx` — new mood butonu glow efekti
- `app/(tabs)/_layout.tsx` — tab bar hairline border, label font
- `app/film/[id].tsx` — warm tint backdrop, büyük match dairesi, footer border
- `components/AIProcessingOverlay/` — Lumi kaldırıldı, 4 halkalı spiral animasyon
- `components/MoodProfileResult/` — icon badge, yeni tipografi, gelişmiş spacing
- `components/SwipeCard/SwipeableCard.tsx` — daire match score, Share/Save label'lı butonlar
