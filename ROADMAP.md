# MoodFlix (Chosy.ai) — Roadmap v3

## Durum Özeti (2026-04-07)
- P0–P5: **TAMAMLANDI**
- P6 Social/Share: **TAMAMLANDI**
- MVP core flow çalışıyor: mood input > AI parsing > vector matching > swipe feed > watchlist save
- **Aktif: P7** — Landing Page / Home Screen
- Sonraki: P8 (Onboarding Revamp) → P9 (Payment)

> ⚠️ **Not:** Orijinal ROADMAP'te P6=Landing Page, P7=Onboarding, P8=Payment idi.
> Share Cards sprint'i P6 numarası aldı; eski P6/P7/P8 → yeni P7/P8/P9 olarak kaydırıldı.

---

## P3 — Stability & Cleanup ✅ TAMAMLANDI

### P3.1 Mascot Temizliği ✅
- [x] Flick (Rive) kaldırıldı, Lumi korundu
- [x] Dead deps: rive-react-native, three, expo-gl, @types/three

### P3.2 Curated Collections Kaldırma ✅
- [x] mood.tsx — CURATED_COLLECTIONS kaldırıldı

### P3.3 Mood History Kaldırma ✅
- [x] mood.tsx — MoodSession, fetchMoodSessions, PosterStack kaldırıldı

### P3.4 Profile Crash Fix ✅
- [x] GenreDonutChart (react-native-svg crash) kaldırıldı
- [x] Olmayan RPC'ler kaldırıldı (MoodPatternChart, WatchHistory, TonightPick vb.)
- [x] Minimum çalışır profil ekranı sağlandı

---

## P4 — Watchlist Redesign ✅ TAMAMLANDI

### P4.1 Watchlist Backend ✅
- [x] `addToWatchlist(film, sessionId)` — session bağlantısı
- [x] `get_watchlist_grouped` RPC — migration 011
- [x] `saveSession()`, `MoodContext.currentSessionId`

### P4.2 Watchlist UI ✅
- [x] ViewMode: 'list' | 'grouped' chip satırı
- [x] WatchlistCard + SessionAccordion components
- [x] Chevron animasyonu (Reanimated withTiming)
- ⚠️ Migration 011 Supabase'de deploy edilmeli

### P4.3 Film Detay → Session Bağlantısı ✅
- [x] `film/[id].tsx` — `addToWatchlist(film, currentSessionId)` güncellendi

---

## P5 — Profile Redesign & Persona Engine ✅ TAMAMLANDI

> Amaç: Profili "Cinephile Hub"a dönüştürmek. 12 Sinefil Arketipi + vektör bazlı kişiselleştirme.

### P5.1 Auth & Identity Foundation ✅
- [x] Apple/Google Sign-in — `services/authService.ts` (signInWithApple, signInWithGoogle)
- [x] `supabase/migrations/012_auth_profile_fields.sql` — username, avatar_url, archetype_id, auth_provider
- [x] `app/auth.tsx` — sign-in ekranı (Apple native btn + Google)
- [x] `app/setup-profile.tsx` — username input + 12 emoji avatar grid
- [x] `app/_layout.tsx` — configureGoogleSignIn + auth listener güncellendi
- ⚠️ Google OAuth client ID hâlâ placeholder — EAS Secrets + Supabase dashboard ayarı gerekli
- ⚠️ Native rebuild zorunlu (expo-apple-authentication, @react-native-google-signin)
- **Owner:** CTO ✅ | CDO spec atlandı (doğrudan implement edildi)

### P5.2 12 Cinephile Archetypes Engine ✅
- [x] `constants/archetypes.ts` — 12 arketip (ID, nameKey, descKey, emoji icon, renk)
- [x] `services/archetypeEngine.ts` — `computeArchetype(profile)`, `computeAllScores()`
- [x] `components/Profile/PersonaBadge/` — dinamik renk + "Discover your type" placeholder
- [x] `components/Profile/TasteDNA/` revamp — arketip banner + i18n
- [x] Profile tab entegrasyonu
- [x] i18n: `archetype.*` (12×2 name+desc) + `tasteDNA.*` EN+TR
- **Owner:** CTO ✅ | CDO spec atlandı

### P5.3 Persona-Driven Daily Match ✅
- [x] `services/dailyMatch.ts` — `getDailyMatch()`, AsyncStorage günlük cache
- [x] `components/Profile/DailyMatchCard/` — 3:4 poster, gradient, arketip badge, match score
- [x] Profile tab başına DailyMatchCard eklendi
- [x] i18n: `dailyMatch.*` — 6 key EN+TR
- **Owner:** CTO ✅

### P5.4 Stats & Watchlist Progress ✅
- [x] `components/Profile/DiscoveryStats/` — top 2 genre pill + top 1 director satırı (badge sistemi kaldırıldı)
- [x] `components/Profile/WatchlistPreview/` — progress bar "X of Y watched" + ✓ toggle
- [x] AsyncStorage: `moodflix_watched_v1` — izlendi takibi
- [x] i18n: 11 yeni key EN+TR
- **Owner:** CTO ✅ | CDO spec atlandı

---

## P6 — Social / Share Cards ✅ TAMAMLANDI

> Amaç: Viral döngü için film ve mood kartlarını native share sheet ile paylaşmak.

### P6.1 Share Infrastructure ✅
- [x] `components/ShareCards/FilmShareCard` — poster + başlık + meta + mood alıntısı + Chosy.ai branding
- [x] `components/ShareCards/MoodShareCard` — gradient bg + parçacık + mood alıntısı + profil özeti
- [x] `components/ShareCards/useShareCapture` — TurboModuleRegistry + requireOptionalNativeModule güvenli yükleme; graceful fallback
- [x] `components/ShareCards/styles.ts` — tüm stiller, design token uyumlu
- [x] Paketler: `react-native-view-shot@4.0.3` + `expo-sharing~55.0.14`; app.json plugins'te kayıtlı
- **Owner:** CTO ✅

### P6.2 Share Entegrasyonları ✅
- [x] `app/film/[id].tsx` — header'da share ikonu, FilmShareCard offscreen render
- [x] `app/(tabs)/mood.tsx` → `MoodProfileResult` — "Share Your Mood" butonu, MoodShareCard offscreen render
- [x] `app/(tabs)/watchlist.tsx` — long-press modal'a "Share Film" seçeneği (/film/{id}'ye yönlendirme)
- [x] i18n: `share.*` — 5 key EN+TR
- **Owner:** CTO ✅
- ⚠️ **Native rebuild gerekli** — `npx expo run:ios` / `npx expo run:android` çalıştırılmadan share çalışmaz
- ⚠️ **CDO gözden geçirmeli** — FilmShareCard + MoodShareCard sosyal medyada ilk izlenim: görsel kalite kritik

---

## P7 — Landing Page / Home Screen (PLAN)

> Amaç: Feed tab'ı (index.tsx) daha davetkar ve kişiselleştirilmiş bir "Home"a dönüştürmek.
> Şu an saf swipe kartlar var — yeni kullanıcı için bağlam yok.

### P7.1 Home Screen Redesign
- [ ] Karşılama widget'ı — günün saatine göre selamlama + kullanıcı adı (varsa)
- [ ] Hızlı eylem satırı — "How are you feeling today?" CTA → mood tab
- [ ] Son mood session özeti — "Last time you wanted X, here are your picks"
- [ ] Günün önerisi tile'ı — DailyMatchCard'ı feed başına taşı veya kopyala
- [ ] Home spec (CDO) — widget sırası, hero alanı, card hierarchy
- [ ] Copy EN/TR (CMO)
- **Owner:** CDO (spec) → CTO (implement) + CMO (copy)
- **Est:** 1-2 session
- **Bağımlılık:** P5.3 DailyMatchCard hazır ✅, P5.1 kullanıcı adı hazır ✅

---

## P8 — Onboarding Revamp (PLAN)

> Amaç: Mevcut 4-adım onboarding'i archetype engine'e bağlamak.
> Şu an onboarding → sadece favori film seçimi. Yeni kullanıcı arketip kazanmıyor.

### P8.1 Taste Calibration Flow
- [ ] Onboarding 3. adım: 5-6 mood/senaryo sorusu → `computeArchetype()` → anında arketip atama
- [ ] Arketip reveal animasyonu — "You are: The Visual Poet 🎨" reveal kartı
- [ ] `users.archetype_id` ilk girişte yazılır
- [ ] Taste calibration UI spec (CDO) — soru kartları, reveal animasyonu
- [ ] Onboarding copy revamp EN/TR (CMO)
- **Owner:** CDO (spec) → CTO (implement) + CMO (copy)
- **Est:** 2 session
- **Bağımlılık:** P5.2 archetypeEngine ✅, P5.1 users.archetype_id kolonu ✅

---

## P9 — Payment & Subscription (PLAN)

> Amaç: Monetizasyon altyapısı — Free vs. Premium feature ayrımı.

### P9.1 Üyelik Sistemi Tasarımı
- [ ] Free vs Premium özellik listesi — hangi feature'lar paywalled?
- [ ] Fiyatlandırma stratejisi (COO + CMO)
- [ ] RevenueCat vs. native IAP — platform seçimi
- **Owner:** COO (strateji) + CMO (fiyatlama)
- **Est:** 1 workshop session

### P9.2 Paywall & Ödeme Entegrasyonu
- [ ] RevenueCat SDK entegrasyonu
- [ ] Paywall UI spec (CDO)
- [ ] Paywall ekranı (CTO)
- [ ] Abonelik yönetimi (restore, cancel flow)
- **Owner:** CDO (spec) → CTO (implement)
- **Est:** 2-3 session
- **Bağımlılık:** P9.1 strateji kararları

---

## İptal Edilen Görevler

### ~~Flick Mascot (Rive)~~ — İPTAL (2026-04-06)
### ~~Curated Collections~~ — KALDIRILDI (2026-04-06)
### ~~Mood History (mood.tsx)~~ — KALDIRILDI (2026-04-06)

---

## CDO Backlog (Öncelik Sırası)

> P5 ve P6 sprint'leri CDO spec beklemeden CTO tarafından implement edildi.
> Aşağıdaki tasarım borçları + öncelikli spec ihtiyaçları.

### 🔴 Acil — Yayın Öncesi Gözden Geçirme
1. **Share Card Visual QA** — FilmShareCard + MoodShareCard sosyal medyada nasıl görünüyor?
   - 1080×1350 aspect ratio Instagram Story formatında mı?
   - Branding ("Chosy.ai") okunabilir mi?
   - Dark tema social preview'da iyi duruyor mu?
   - Gerekirse CTO'ya tasarım revizyonu ilet

2. **Auth Ekranları (auth.tsx + setup-profile.tsx) Review** — CDO spec olmadan build edildi
   - Apple/Google buton hierarchy doğru mu?
   - Avatar emoji grid (12 seçenek, 4 sütun) — tasarımla uyumlu mu?
   - Marka tutarlılığı kontrol

### 🟡 Öncelikli Spec — P7 için blocker
3. **P7.1 Home Screen Spec** — CTO implement etmeden önce gerekli
   - Widget sırası ve card hierarchy
   - Hero alanı (günün saatine göre selamlama)
   - "Quick mood" CTA tasarımı

4. **P8.1 Taste Calibration UI Spec** — Onboarding soru kartları
   - Soru kartı format ve animasyon
   - Arketip reveal kartı (konfeti? slide? zoom?)
   - Progress indicator (5/6 adım)

### 🟢 Backlog — P9 için
5. **P9.2 Paywall UI Spec** — RevenueCat entegrasyonu için gerekli
   - Feature comparison table tasarımı
   - CTA hierarchy (yıllık vs. aylık)
   - Trial messaging

---

## Agent Görev Dağılımı (Güncel)

| Agent | P5 | P6 | P7 | P8 | P9 |
|-------|----|----|----|----|-----|
| CTO | ✅ Tamamlandı | ✅ Tamamlandı | Implement (spec sonrası) | Implement (spec sonrası) | Implement (spec sonrası) |
| CDO | ⚠️ Spec atlandı → QA borcu var | ⚠️ Share card QA bekliyor | **P7.1 spec — blocker** | P8.1 taste calibration spec | P9.2 paywall spec |
| CMO | Copy yazıldı | — | P7.1 copy | P8.1 copy revamp | P9.1 strateji |
| COO | Sprint tracking ✅ | Sprint tracking ✅ | Sprint tracking | Sprint tracking | P9.1 strateji |

---

## Sprint Cadence
- Her sprint = 1 hafta
- Günlük Claude Code session: 1-3 saat
- Sprint hedefi: aktif priority tier'dan 2-3 görev
- Cuma: full flow test, CLAUDE.md güncelle, sonraki sprint planla

## Definition of Done (Per Task)
- [ ] Feature works in dev build
- [ ] No regression in MVP flow (mood > films > swipe > watchlist)
- [ ] No new TS errors (existing ones in scripts/ are OK)
- [ ] Colors use design tokens (no hardcoded hex)
- [ ] Tüm metinler i18n üzerinden: t('key')
- [ ] CLAUDE.md updated with changes
