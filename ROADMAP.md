# MoodFlix — Roadmap & Sprint Plan

## MVP Status: ~80% Complete
Working: mood input → AI parsing → vector matching → swipe feed → watchlist save
P0 shipped. P1 shipped (Task 8 deferred → P3). Now entering P2.

---

## Priority Matrix

### P0 — Must Ship ✅ SHIPPED
These blocked App Store submission — all complete as of March 2026.

1. ✅ **Design Token Migration** — Colors.ts + theme.ts yeni palette, tab bar güncellemesi
2. ✅ **SwipeCard Polish** — stack effect, swipe overlay'leri, gradient, action butonlar
3. ✅ **Error Handling & Edge Cases** — network failure, empty state, auth recovery
4. ✅ **Loading States** — skeleton shimmer, AI processing overlay, pull-to-refresh

---

### P1 — Should Ship ✅ SHIPPED (Task 8 Deferred)
These made the app competitive — shipped March 2026.

5. ✅ **Film Detail Bottom Sheet** — drag handle, poster blur, AI explanation, watchlist add
6. ✅ **Onboarding Flow** — 3 adım entry, first mood guided experience
7. ✅ **Tab Bar Redesign** — 4 tab, gold active state, animasyonlu geçiş, Lumi mood tab
8. ⏭️ **Search/Discover Tab** — DEFERRED TO P3 (P2 kapasitesiyle çakışır, App Store blocker değil)

---

### P2 — Growth Features 🚧 ACTIVE (Weeks 5-8)
These drive retention. **CDO bağımlılıkları var — aşağıya bak.**

#### Sprint Durumu (2026-03-29)
- Kullanıcı: Flick Rive dosyasını hazırlıyor
- CTO: Task 9 gamification UI ✅ + Task 11 liste view ✅ tamamlandı
- CDO: P2 UI spec'leri → `.claude/briefs/CDO_P2_SPECS_NEEDED.md`

#### CDO Bağımlılık Haritası

| Görev | CTO Bağımsız Başlayabilir mi? | CDO Deliver Etmeden Bloke Olan Kısım |
|-------|-------------------------------|--------------------------------------|
| 9. Gamification | ✅ Backend/Supabase kısmı | Badge UI, milestone ekranı, Flick dance |
| 10. Flick Mascot | ❌ Tamamen bloke | Rive dosyası kullanıcı hazırlıyor |
| 11. Watch History & Stats | ✅ Liste view — CTO başladı | Chart/grafik tasarımları |
| 12. Social Features | ❌ Tamamen bloke | Share kart template CDO'ya ait |

> **Kural:** CDO spec'i teslim etmeden CTO UI implement etmez.
> CDO brief için bkz: `.claude/P2_CDO_BRIEF.md`
> İşbirliği kuralları için bkz: `.claude/CTO_CDO_COLLABORATION.md`

---

9. **Gamification System** — Owner: CTO (backend) + CDO (UI)
   - [x] Supabase: `user_streaks` + `milestones` + `user_milestones` tabloları + RLS (009_gamification.sql)
   - [x] Daily streak backend logic — `update_streak()` + `check_milestones()` RPC
   - [x] `services/gamification.ts` — recordActivity, getStreakInfo, getUserMilestones, markMilestoneSeen
   - [x] Feed entegrasyonu — `recordActivity()` her swipe'da çağrılır + milestone toast i18n
   - [ ] Streak badge UI — CDO spec sonrası CTO implement eder
   - [ ] Milestone celebrations (10/25/50/100 film) — CDO spec sonrası
   - [ ] Confetti animasyonu — CDO spec sonrası
   - [ ] Flick dance — Task 10 tamamlanmadan başlanmaz
   - Sessions: 2-3

10. **Flick Mascot (Rive)** — Owner: CDO (tasarım) → CTO (implement)
    - [ ] CDO: Rive editor'da 256x256 tasarım, 8 emotion state
    - [ ] CDO: 4 layer tanımı (body, eyes, tail, effects)
    - [ ] CDO: State machine inputs spec
    - [ ] CTO: FlickMascot.tsx component (CDO deliver sonrası)
    - [ ] CTO: Entegrasyon — kart köşesi, empty state, loading, celebrations
    - Sessions: 3-5 (Rive tasarım süresi dahil)
    - ⚠️ En uzun lead time — CDO bu görevi ÖNCE başlatmalı

11. **Watch History & Stats** — Owner: CTO (liste) + CDO (grafikler)
    - [x] Supabase: `user_swipe_history` view + `get_user_stats` / `get_swipe_history` / `get_mood_timeline` RPC (010_watch_history.sql)
    - [x] `services/history.ts` — getUserStats, getSwipeHistory (paginated), getMoodTimeline
    - [x] "Films you've seen" liste view UI — `components/Profile/WatchHistory/` (filter tabs, pagination, stats)
    - [ ] Mood pattern visualization — CDO chart spec sonrası CTO
    - [ ] Genre distribution chart — CDO chart spec sonrası CTO
    - Sessions: 2

12. **Social Features** — Owner: CDO (template) → CTO (implement)
    - [ ] CDO: Share kart template tasarımı
    - [ ] CDO: "Mood of the day" paylaşım kartı tasarımı
    - [ ] CTO: `react-native-view-shot` ile share implementasyonu (CDO deliver sonrası)
    - Sessions: 1-2

---

### P3 — Scale Features (Post-Launch)
13. **Search/Discover Tab** ← P1'den defer edildi (2026-03-28)
    - Genre browsing
    - Curated mood collections ("Rainy Day", "Date Night")
    - Sessions: 2-3
14. Real Claude API film profiling (replace rule-based)
15. User accounts (email/social sign-in, migrate from anonymous)
16. Personalized recommendations (learn from swipe history)
17. Push notifications (daily mood check-in, streak reminders)
18. Multi-language support (TR/EN at minimum)
19. iPad/tablet layout
20. Revenue: premium tier with unlimited AI explanations

---

## Sprint Cadence
- Her sprint = 1 hafta
- Günlük Claude Code session: 1-3 saat
- Sprint hedefi: mevcut priority tier'dan 2-3 görev tamamlama
- Cuma: full flow test, CLAUDE.md güncelle, sonraki sprint planla

## Definition of Done (Per Task)
- [ ] Feature works in dev build
- [ ] No regression in MVP flow (mood → films → swipe → watchlist)
- [ ] No new TS errors (existing ones in scripts/ are OK)
- [ ] Colors use design tokens (no hardcoded hex)
- [ ] CLAUDE.md updated with changes
