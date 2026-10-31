# Pro Mode Faz 2-0 — İstemci Envanteri (SALT OKUNUR)

> **Tarih:** 31 Ekim 2026 · **Kapsam:** yalnız okuma, kod/commit yok.
> **Taban:** `release/cold-start-ota` @ `9571931` (app 2.1.2, build 905). Okuma yolu:
> `C:\Users\mertk\chosy-cold-start-ota` (temiz, `git status` boş). Aşağıdaki tüm
> `dosya:satır` referansları BU ağaca aittir.
> **Dosya konumu:** yerelde, commit edilmedi.

## 0. Önce bilinmesi gerekenler (plan varsayımlarıyla çelişenler)

| # | Bulgu | Etki |
|---|---|---|
| 0.1 | Bu görevin çalıştırıldığı worktree (`moodflix-money-1c`) `feat/mood-vec-2e` @ `77352f8`, **9571931'in atası değil** (cwd, tabandan 104 commit ayrık hatta). İstenen taban başka worktree'de; envanter oradan okundu. | `moodQualityGate`, parse önbelleği, kişisel tekrar dışlama, parse v2 gibi şeyler **tabanda yok** (§3). |
| 0.2 | `pro-mode-faz2-plan-2026-10-31.md` diskte bulunamadı (repo + `~` 4 seviye). | Plan §4'teki yeni olayları okuyamadım; §7'de yalnız mevcut olaylar + yerleşim önerisi var. Belgeyi verirsen eşlerim. |
| 0.3 | **"rerank 60/gün" kodda yok.** `rerank-films` yalnız `requireUser` + **10 istek/dk** (`supabase/functions/_shared/rateLimit.ts:49`); günlük üst sınır, yetki ve token loglama yok. `TEKNIK_BORC.md:4113` bunu P1 borç olarak kayda almış (R-5 ertelenen). | Plan 60/gün varsayıyorsa o sınır henüz yazılmamış demektir (§6). |
| 0.4 | `ShellState` kodda **4 değer**: `bootstrapping｜ready｜in_progress｜completed_today` (`GauntletShell/index.tsx:211`). Planın 6'lı enum'u (`waiting/ready/in_progress/completed/watch_feedback/error_recovery`) **yok**. `watch_feedback` = state değil, ShellState'in ÜSTÜNE binen overlay (`pendingFeedbackVisible`, :1690); `error_recovery` = `bootstrapping` + `loadError` (:1701); `waiting` = ayrı dal değil, şampiyon/exhausted dalındaki `CycleRow` sayacı (:1819, :1874). | K-03 enum'u bir **refactor** gerektirir; "yeni state ekle" değil (§5). |
| 0.5 | Paywall'da **RevenueCat placement yok.** Orkestratör özel "variant" adlarıyla çalışır; RC tarafında tek offering `default` (`constants/subscriptionPlans.ts:133`), tek entitlement `chosy_plus` (:130). | §1. |
| 0.6 | Deste sağa kaydırma **otomatik watchlist'e yazar** + slot kotası tüketir (`app/discover.tsx:194-243`). "Watchlist manuel" kilidiyle çelişir. | §2. |
| 0.7 | **Canlı `app_config` değerleri doğrulanamadı.** `use_hybrid_recommendation` / `use_llm_reranker` kod varsayılanı `false` (`services/remoteConfig.ts:28-29`); prod'daki gerçek değer için salt-okunur `SELECT` denedim, izin sınıflandırıcısı reddetti, dolanmadım. | Prod'da v3+rerank'in açık olup olmadığı **bilinmiyor**; MCP izni ya da sen `select key,value from app_config` ile doğrula. |

---

## 1. Pro Mode rotaları, giriş noktaları, paywall tetikleyicileri

### 1.1 Rota ve girişler
- **Tek rota:** `app/pro-mode.tsx` (stack, `(tabs)` değil). Dört durum: loading / error / locked / allowed (:125, :138, :159, :182). `allowed` → `<MoodSearchScreen />` (:185).
- **Tek giriş:** Profil > "Pro" bölümü, `proModeRow` → `router.push('/pro-mode')` — `app/(tabs)/profile.tsx:2027-2042` (kilit ikonu yalnız görsel, :2038).
- **Gate:** `hooks/useProModeAccess.ts:59-124` — `allowed = isPremium || legacy_mood_access` (:117), fail-closed, `reason: premium|legacy|none`, `quotaExempt = legacy` (:119). `legacy_mood_access` `readUserRow` ile (60 sn önbellek, `services/userCache`).
- **Şampiyon daveti: YOK.** `ChampionReveal` ve Shell'de Pro Mode'a giden hiçbir CTA yok (`router.push` yalnız `/film/:id`, `/archive`, `/games/spotlight`: `ChampionReveal:349,383`, `ArchiveTrigger:42`, `SpotlightBonusCard:127`).
- **Deep link:** `app.json` `"scheme": "chosy"`. Açık bir pro-mode eşlemesi yok. Push tıklaması `getDeepLinkFromNotification` (`services/pushNotifications.ts:513-541`): `mood→'/(tabs)'` (artık Home/gauntlet; isim bayat), `profile`, `games`, `film`, `paywall→'/paywall'` (deprecated stub, `router.back()` yapar — pro-mode.tsx:102 yorumu). `pro-mode` case'i **yok**. Dosya-tabanlı yönlendirme `chosy://pro-mode`'u çözmesi beklenir ama cihazda doğrulanmadı.
- Diğer MoodSearchScreen girişleri: eski `onboarding=1` param'ı (`MoodSearchScreen:129`, `discover.tsx:82`) — bugün bunu `/pro-mode`'a basan bir çağıran bulamadım (kalıntı).

### 1.2 Paywall tetikleyicileri (tamamı)
Hepsi `useContextualPaywall().triggerPaywall(event)` → `shouldShowPaywall` (`services/conversion/triggerOrchestrator.ts:204`). Premium/trial → `null` (:210).

| Çağrı yeri | Olay | Yaşıyor mu |
|---|---|---|
| `app/pro-mode.tsx:113` (kilitli ekran CTA) | `profile_upgrade` | ✅ IMMEDIATE |
| `profile.tsx:1233` ("Chosy Pro" CTA, `handleUpgradePress`) | `profile_upgrade` | ✅ |
| `MoodSearchScreen:261` (`showQuotaWall`), :560, :758 | `quota_exhausted{quota:'search'}` | ✅ (24 sa cooldown, ilk 24 saat grace) |
| `discover.tsx:211` (sağ kaydırma slot kotası) | `quota_exhausted{quota:'slot'}` | ✅ |
| `profile.tsx:1847` (TasteDNA, yalnız `isCinemaDnaEnabled()` iken) | `mood_history_tap` | ⚠️ v1'de gizli |
| `roulette.tsx:365…505` | `roulette_limit` | ☠️ `triggerToVariant → null` (:71) |
| `hooks/useGamePaywall.ts:50` | `game_perfect_streak` | ☠️ null |
| (tip var, çağıran yok) `lifetime_soldout`, `streaming_link_tap`, `share_card_generated`, `missed_day_archive` | — | `missed_day_archive`: tip + varyant var, çağıran yok (`ArchiveTrigger:12` yorumu) |

- **Kural motoru:** aynı trigger 24 sa'te 1 (`COOLDOWN_MS` :41), 3 dismiss → 7 gün (:44-45), yeni kullanıcı ilk 24 sa yok (:48), `IMMEDIATE_TRIGGERS = profile_upgrade, lifetime_soldout` cooldown'ı atlar (:90).
- **Yeni "Mood Gauntlet kota/limit" paywall'ı** için: `TriggerEvent` (`services/conversion/types.ts:32`) + `PaywallVariantName` (:52) + `triggerToVariant` (:52) + `ContextualPaywall.tsx` switch (:65) birlikte genişler → **sözleşme/pattern değişikliği, onay ister.**
- **RevenueCat:** `getOfferings()` `offerings.current` okur (`services/purchaseService.ts:505-535`), `RC_OFFERING_ID='default'`, `RC_ENTITLEMENT_ID='chosy_plus'`. `lifetime_founding` offering RC'de duruyor ama UI'da yok (`profile.tsx:2000-2004`). Paketler: monthly/annual/lifetime (`subscriptionPlans.ts:17`).

---

## 2. Mood Search ekran zinciri

Zincir: **Profil → `/pro-mode` → `MoodSearchScreen` (input → processing → result) → `router.push('/discover')` (deste) → `MoodDeckSummary`.** (`app/discover.tsx` = canlı stack route; `(tabs)/mood.tsx` = donmuş Discover tab, ilgisiz — `MoodSearchScreen:476-486` uyarısı.)

| Adım | Dosya:satır | Davranış |
|---|---|---|
| Giriş (input) | `components/Home/MoodSearchScreen/index.tsx:587-741` | arama çubuğu :608, `FilterBottomSheet` :666, `MoodCardGrid` :674, Recent :680, sabit "Find Movies" :703 |
| Quick mood (`MOOD_CARDS`) | `components/Home/MoodCardGrid/index.tsx:45-110`, tıklama :131 | 8 kart; `onSelect(t(queryKey))` → `handleMoodCardSelect` (`MoodSearchScreen:518`) **yalnız metni doldurur + buton flash**; gönderim yok. Önbellek/hızlı yol tabanda yok. |
| Rıza kapısı | `MoodSearchScreen:456-471`, `services/aiConsent.ts` | rıza yoksa `handleFindMovies` hiçbir şey yapmaz; inline "Enable and find" (:706-715) |
| Kota | `MoodSearchScreen:387-396` | `!isOnboarding && !quotaExempt` → `consumeQuota('search')` → reddedilirse `showQuotaWall` (:260) → paywall ya da `QuotaExhausted` (:754) |
| İşleme | :743 `AIProcessingOverlay`, min 1500 ms (:114) | `runAiSearch` :321 |
| **Mood Profile Result** | `components/MoodProfileResult/index.tsx` (402 sat.); sahne :552-581 | 4 boyut kartı, **film içermez**. Geri: `onBack`→`setPhase('input')` (:565; bileşen :261). "Browse Movies" :385 → `handleBrowseMovies` :493 |
| Deste | `app/discover.tsx` | `useFeedManager(currentProfile, filters)` :112; snapshot :143; 8 film; ilerleme :380 |
| Kart detayı | `components/SwipeCard/SwipeableCard.tsx:244` | `router.push('/film/${id}')` |
| Sağ/sol | `discover.tsx:194` / :245 | **sağ = slot kotası (:202-222) + `addToWatchlist` (:238) otomatik**; sol = `tasteSignals.recordSwipeLeft` |
| **X** | `discover.tsx:402-413` → `handleNewMood` :261 | `clearMood()` + `router.navigate('/(tabs)')` → **Pro Mode'a değil Home'a** düşer |
| Deste sonu | `discover.tsx:280` → `MoodDeckSummary` (`components/MoodDeckSummary/index.tsx`) | `onNewMood`(:94 → Home), `onClose` (:99 → `dismissTo('/(tabs)')` :270), `onGoWatchlist` (:104 → Profil) |
| Recent Searches | yükleme `MoodSearchScreen:182-201` (`getMoodHistory`, son 3); liste :680; tıklama :540 | ⚠️ `handleRecentTap` yalnız metni doldurur; içindeki `setTimeout` boş (:545-548) — otomatik gönderim yok |

**Plan (mood → 4 film → 3 ikili → şampiyon) ile çatışma noktaları:** (a) deste 8 film/swipe — 4 film + ikili düello değil; (b) sağ-kaydırma watchlist yazımı; (c) X ve deste sonu çıkışları Home'a gidiyor; (d) Result ekranı film göstermiyor, filmler yalnız `/discover`'da; (e) `onboarding=1` kolu (`discover.tsx:85-108`) paywall onDismiss'te `router.replace('/(tabs)')` yapar.

---

## 3. Öneri hattı (istemci)

Sıra (`services/recommendations.ts`, `getRecommendations` :1041):

1. `MoodSearchScreen.runSearch` → `parseMood(trimmed)` (`services/tasteParser.ts:1441`): istemci hız sınırı 5/dk (:54-72) → `callEdgeFunction` (:91; rıza son kapısı :95; `POST /functions/v1/parse-mood`, 15 sn zaman aşımı :107, bölge sabitleme :114) → `validateAndNormalize` (:173). Dönüş `{profile, searchId, searchKeywords}`.
2. `applySearchResult` (`MoodSearchScreen:270`): modül-seviyesi store'lar (`services/moodSearchState.ts`: `setPendingSearchId`, `setSearchKeywords`, `setPendingMoodText`, `setSearchModeState`) → `startPreload` (`services/recommendationPreload.ts:90`) → `getRecommendations(profile, 8, [], filters, searchId, true)` arka planda.
3. Dışlama (`buildFirstBatchExclusions` :1004): watchlist + izlenmiş (sert) + son 3 deste (yumuşak, `getRecentDeckIds`).
4. `getFilmsWithRelaxation` (:900) → `callMatchFilms` (:681): `use_hybrid_recommendation` → `match_films_v3` (:614), hata → v2 (:589) → v1 (:650). Gevşetme zinciri: (0.45, rating) → (0.42, 6.0) → (0.40, 5.5, eraYok) → (0.38, yok). İlk batch aday = **30** (:762), sonraki 12.
5. Rerank (:1252-1312): yalnız `isFirstBatch && use_llm_reranker && hasAiConsent`; `callRerankFilms` (:784) → `POST /functions/v1/rerank-films`, 6 sn (:759); başarısızlık `llm_rerank_fallback` olayı + RPC sırasıyla devam.
6. **Kalite kapısı (tabanda satır içi, "Adım 4.8", :1314-1347):** en iyi benzerliğin %55'i altı elenir, 8'e kesilir. `moodQualityGate` adlı modül **tabanda yok**; `feat/mood-vec-2e`'de var.
7. Boş/hata → `getFallbackFromSupabase` (:528, :1349-1443).
8. Başarı: `rowToFilm` + `injectUnexpectedTypes` (:1447) → **`mood_searches.update({recommended_film_ids, rpc_version}).eq('id', searchId)`** (:1479-1486, 0 satır → `reportMoodSearchWriteIssue` :1491) → `recordShownDeck` (:1548).
9. Teslim: `useFeedManager` preload'u tüketir (`hooks/useFeedManager.ts:422`).

**v2'ye geçişte değişecek noktalar (taban ağacına göre):**
- `ParseMoodResult`/`EdgeResponse` (`tasteParser.ts:76-89`) — v2 alanları (planın "B çağrısı") için genişler; `validateAndNormalize` yeni alanları taşımalı.
- `moodSearchState` store'ları: yeni v2 verisi için aynı modül-seviyesi desen mi, yoksa parametre mi → **mimari karar**.
- `callMatchFilmsV3` imzası (:614) ve `callMatchFilms` (:681) — vektör/filtre argümanları.
- Rerank bloğu (:1252) ve kalite kapısı (:1314) — gerekçe (tek cümle) üretimi için, `whyFromDimensions` (:298) / `Film.why` yoluyla mı yeni alanla mı belirsiz.
- `recommended_film_ids` yazımı (:1479) — Mood Gauntlet'te 4 film + gerekçe saklanacaksa alan/tablo kararı.
- `MoodDeckSummary`/`discover.tsx` tüketicisi — yeni modda kullanılmayacak.
- Not: `feat/mood-vec-2e` (2d/2e: parse önbelleği, kısaltma, kişisel tekrar dışlama, TR gerekçe, iki paralel `tool_use`) tabanın **dışında**; Faz 2 başlarken iki hat birleştirilmeli (merge-base ayrık). Bu dalın içeriğini okumadım.

---

## 4. Günlük gauntlet bileşenleri — Mood Gauntlet'te yeniden kullanılabilirlik

Tüm mantık `components/gauntlet/GauntletShell/index.tsx` (**2040 satır**) içinde; bileşenler ince.

| Bileşen | Props / bağımlılık | Yeniden kullanım |
|---|---|---|
| `PosterTile` | `film: GauntletFilm, selected, disabled, animationState, onPress, titleLines, onTitleLines` | ✅ saf sunum |
| `RoundIndicator` | `current:1|2|3, total?, showLabel?` | ✅ |
| `OutlineAction / QuietAction / PrimaryAction / ChampionActionButton` | label/onPress/disabled | ✅ |
| `LightBleed` | `dominantColor` | ✅ |
| `ContextBar` | `GauntletContext`, `onCorrect` | ❌ günlük bağlam; Mood Gauntlet'te anlamsız |
| `ChampionReveal` | `champion, animateReveal, date, rounds, gauntletId, onRevealSettled, belowHeight`; içinde `saveChampionForLater(gauntletId, id)` (:296), `watch_now_tapped`, `useWatchProviders`, paylaş | ⚠️ kısmen: `gauntletId` **günlük gauntlet kaydıyla** `submit-choice` Edge Function'a gider (`gauntletService.ts:494-528`) → mood oturumu id'si aynı tabloda yoksa kaydetme çalışmaz. Sunucu tarafını okumadım; doğrula. |
| `CycleRow / UnlockCountdown` | günlük cycle sınırı | ❌ |
| `SpotlightBonusCard` | `cycleDate`, günlük | ⚠️ planda "yalnız şampiyon altında" — günlük şampiyonda kalır |
| `PendingWatchFeedbackCard` | `film, onRespond, watchedOtherEnabled` | ⚠️ "dün izledin mi" günlük; mood için gerekirse ayrı karar |
| `GauntletShell` (state, `submit` :1089, `handleChoice` :1178, `handleNeither` :1361, `handleSeenPick` :1474) | sıkı bağlı: `getTodayGauntletWithFallback` (:647/:842), `gauntletCache`, `enqueuePendingChoice/flushPendingChoice` (offline, K-42), `nextChallengerForRound` (pozisyonel `films[round]` aynası :163), `CycleGauntlet`/`next_cycle_at`, `refreshesRemaining`, `ChoiceResult.next` | ❌ olduğu gibi kullanılamaz. Tur/ikili/animasyon/kilit mantığı çıkarılabilir ama bir **çıkarma refactor'ı** (ortak `useDuelRounds` benzeri) gerekir. |

- **choice_events yazımı:** istemcide yok; `submitChoice` (`gauntletService.ts:412`) → Edge `submit-choice`; idempotency `(gauntlet_id, round) WHERE outcome IN ('choice','timeout')` (hafıza notu). Mood Gauntlet kendi `gauntlet_id` uzayı ve sunucu ucu ister. **`types/gauntlet.ts` KİLİTLİ** (`GauntletContext`, `DailyGauntlet`, `ChoiceSubmission`…) — mood moduna uyarlama CTO onayı ister.
- **Watch-feedback:** `submitWatchFeedback(pendingGauntletId, filmId, response)` (`gauntletService.ts:545`, Shell :1409) günlük `pendingWatchFeedback`'e bağlı.
- **Saf yeniden kullanılabilir yardımcılar:** `GauntletShell/cycleRules.ts`, `useBelowHeight`, `useChampionAsk` (günlük ask), `prefetchUpcomingChallengers` (Shell :179, dışa açık değil).

---

## 5. Home waiting / completed state — yeni kart/satır yeri

- `app/(tabs)/index.tsx` yalnız `<GauntletShell/>` mount eder (22 sat., "burada mantık olmaz", K-03).
- **Tamamlandı (şampiyon) dalı** `GauntletShell:1756-1865`, `ScrollView` sırası: `ChampionReveal` (:1783) → Spotlight kartı/rezerv (:1800-1813) → `CycleRow` sayacı (:1819) → `ArchiveTrigger` (:1837).
- **Mevcut CTA'lar:** Watch now (`ChampionReveal:376`), Save for later (:291), Share (:320), Spotlight kartı, CycleRow "Remind me", ArchiveTrigger, tek-modal ask (auth/notif, `useChampionAsk` + `askCoordinator`, günde en fazla bir, Spotlight'ı örtmez — Shell :1850-1859).
- **"Waiting" yok:** exhausted dalı (:1867-1884) metin + `CycleRow`; sayaç Shell'de `countdownTarget` (:1820).
- **Uygun yer (Pro Mode daveti):** Spotlight kartı ile `CycleRow` arasında (:1813↔:1819) yeni bir `View`. ⚠️ Hero yüksekliği alttaki içeriğin ölçümüyle hesaplanır: `useBelowHeight` `BelowPart = 'card'|'cycle'|'archive'` (:12) + `below.total({...})` (:1565) + `ChampionReveal/heroHeight.ts`. Yeni satır eklenirse `BelowPart`'a `'pro'` eklenmeli, yoksa hero yüksekliği yanlış hesaplanır ve tab bar altı taşar. Ayrıca ask dwell'i Spotlight kartına çapalı (`cardlessDwell`, :1560) — yeni kart ask zamanlamasını bozabilir.
- **Daveti hangi state'te:** yalnız `completed_today && champion` (tek yer). `ready/in_progress`'te eklemek ritüeli bölüyor (kilit: Spotlight/bonus ritüelin çıkışında).

---

## 6. Kota / limit

**İstemci (`services/quotaEngine.ts`, 470 sat.):**
- `checkAndConsumeQuota(userId, 'search'|'refine'|'slot')` :154 — `getTierFromRevenueCat` → `TIER_LIMITS[tier]` (`constants/subscriptionPlans.ts:78-119`) → **AsyncStorage sayacı** (`storageKey`/`getUsedCount`/`incrementCount`). **Hata → fail-open** (:196-208) + Sentry.
- `SubscriptionContext.consumeQuota` (:471-500) bunu sarar; userId yoksa `allowed:false`; ağ hatasında fail-open (:491).
- Limitler (istemci tablosu): free search **3**, refine 1, slot **8**, game 1/oyun, watchlist 30; paid tier'larda search `-1` (sınırsız) (`subscriptionPlans.ts:86-119`; `FREE_DAILY_LIMIT=3` :125). İstemci tablosunda 14/5 değerli tier satırı da var (:93-96, legacy weekly).
- **Slot kotası YALNIZ istemcide** (`discover.tsx:196-201` yorumu).

**Sunucu:**
- `parse-mood`: `requireUser` → `checkRateLimit('parse-mood')` **10/dk** → `check_and_consume_quota('search')` RPC (`parse-mood/index.ts:184-245, 270-279`); kota RPC hatasında **fail-open** (:243, TEKNIK_BORC:4118). Aşım → `429 QUOTA_EXCEEDED` (:295-313).
- RPC: `115` legacy muafiyeti (`legacy_mood_access` → sınırsız), `117` ücretli tier'larda `daily_search_limit=-1`; free = 3 (tablo `subscription_limits`). Sayaç `user_daily_quotas`. `check-quota` Edge Function ayrı ince sarmalayıcı (429).
- `rerank-films`: `requireUser` + **10/dk**, günlük sınır **yok**, kota/yetki yok, `mood_searches.llm_tokens_*` rerank'i kapsamaz (TEKNIK_BORC:4113, P1).
- Pro Mode kapısı **istemcide** (TEKNIK_BORC:4120): free kullanıcı kapıyı atlarsa günde 3 arama.

**Pro/ücretsiz ayrımı nerede:** (1) `useProModeAccess` (UI kapısı), (2) `premiumStatus` (`SubscriptionContext`/`utils/premiumStatus.ts`; RC + DB `subscription_tier`), (3) orkestratör `isPremium||isInTrial → null`, (4) sunucuda `subscription_limits` + RPC. Mood Gauntlet kotası (günde kaç gauntlet) için: yeni sayaç tipi `check_and_consume_quota`'nun `quota_type` listesine ve `check-quota` doğrulamasına (`['search','refine','slot','game']` :109) girer → migration + Edge değişikliği, onay ister.

---

## 7. PostHog

**Sarmalayıcı:** `services/posthog.ts` (`posthogAnalytics.track/screen/identify/registerSuperProperties/setPersonProperties`). Merkezi sözlük **yok**, 93 serbest-string olay (`docs/analytics/G6_CEKIRDEK_EVENTLER.md`). `services/analytics.ts` ayrı sistem (Supabase `roulette_picks`), karıştırma. Süper özellikler `app/_layout.tsx:134`: `update_id, update_source, runtime_version, timezone`. `identify(authId)` :275, `app_user_id` person prop :168.

**Pro Mode ile ilgili mevcut olaylar (dosya:satır):**
`pro_mode_opened {access_reason}` (`pro-mode.tsx:95`) · `pro_mode_paywall_shown {source}` (:111) · `mood_searched {mood_text_length}` (`MoodSearchScreen:376`) · `mood_card_tapped` (:521) · `discover_recent_search_tapped` (:542) · `mood_search_failed` (:430) · `quota_exhausted {quota_type}` (:391) · `ai_consent_shown/granted/dismissed` (:228/:237/:355; `aiConsent.ts` 222-264) · `mood_deck_started` (`discover.tsx:147`) · `mood_deck_completed` / `mood_deck_summary_action` (`MoodDeckSummary:73-105`) · hat telemetrisi: `mood_relaxation_timing`, `keyword_boost_active`, `reranker_condition_check`, `llm_rerank_applied/fallback/mood_text_null`, `quality_gate_applied`, `insufficient_results`, `mood_search_update_debug*` (`recommendations.ts`) · paywall hunisi: `paywall_triggered` (`triggerOrchestrator:275`), `paywall_viewed` (`ContextualPaywall:47`), `paywall_shown/dismissed/converted` (`trackFunnel` :333), `paywall_plan_selected` (`PaywallBase:464`), `paywall_variant_skipped` (:221).

**Çekirdek (G-6) olaylar — dokunma/kirletme:** `gauntlet_viewed`, `gauntlet_started`, `choice_submitted`, `gauntlet_completed` (North Star), `choice_rejected`, `champion_viewed/revealed`, `watch_now_tapped`, `save_for_later`, `first_cards_visible`.

**Yeni olaylar için önerilen yerler (plan §4 okunamadığı için tür bazında):**
- Giriş/aç: `pro-mode.tsx:95` (mevcut) — `mode:'mood_gauntlet'` ekle ya da yeni ad.
- Mood gönderildi: `MoodSearchScreen.runSearch :376`.
- 4 film üretildi / gerekçe geldi: `applySearchResult :270` sonrası ya da `getRecommendations` dönüşü (`recommendations.ts:1550`).
- Tur seçimi/şampiyon: yeni Mood Gauntlet shell'inde. ⚠️ `choice_submitted/gauntlet_completed` adlarını **yeniden kullanma**: North Star "Daily Gauntlet Completion"ı Mood Gauntlet ile karışır. Ya `mood_gauntlet_*` ön ekli ayrı adlar ya da zorunlu `mode` özelliği + G-6 sorgularının `mode` filtresi → **ürün kararı**.
- Davet gösterildi/tıklandı: Home şampiyon dalı (Shell yeni satır, §5); `champion_viewed` (Shell :1540) yanına bağlama.
- Paywall: mevcut `trackFunnel` otomatik; yeni variant eklenirse alanlar bedava gelir.

---

## 8. Bayrak deseni (`mood_gauntlet_enabled`)

Mevcut yol (CLAUDE.md kural 5-6):
1. Satır: `app_config(key,value jsonb)`. Seed migration örneği `supabase/migrations/091_discover_tab_flag.sql`. Tabandaki son migration **135** — gerçek numara için `supabase migration list` (Local+Remote) bakılmalı; yalnız `supabase db push`.
2. Okuma: tek kaynak `services/remoteConfig.ts` (5 dk TTL, bellek + AsyncStorage, tek `select key, value`, stale-while-error). İki yöntem: tipli `remoteConfig.get(key)` → `SAFE_DEFAULTS`'a anahtar eklemek gerekir (:26-36); ya da tipsiz `remoteConfig.getRaw(key)` (:112) — son-eklenen bayraklar bunu kullanıyor.
3. Lazy getter: `services/appConfigFlags.ts` desenine uy (`isDiscoverTabEnabled` :20, `isGauntletContextBarEnabled` :33, `isWatchedOtherEnabled` :46): `await remoteConfig.hydrate(); return remoteConfig.getRaw('…') === true;` → eksik/hata/önbelleksiz = `false` (fail-closed).
4. Tüketim: ekranlarda `useEffect` + `cancelled` bayrağı (örnek `(tabs)/_layout.tsx:102-110`, `mood.tsx:148-157`). Modül-seviyesi sabit yasak.
5. Uyarılar: değişiklik en geç 5 dk'da yansır; güvenlik bayrağı değil — **Mood Gauntlet'in sunucu uçları (varsa) yetkiyi kendisi doğrulamalı** (kapıyı atlayan free kullanıcı bugün 3 parse alıyor, TEKNIK_BORC:4120). Navigator remount riski: `hidden` prop'a async bayrak bağlama (`_layout.tsx:11-13` yorumu) — Home'daki giriş noktası için bayrağı render-time `useState(false)` ile oku, tab yapısına bağlama.
6. Yeni ilgili bayrak adayları: `mood_gauntlet_enabled` (giriş), gerekirse `mood_gauntlet_invite_enabled` (şampiyon daveti) ayrı kapanabilsin.

---

## 9. ÖNERİLEN EKRAN/BİLEŞEN PLANI (uygulama yok — mimari kararlar onay bekler)

> CLAUDE.md "yetki sınırı": yeni tablo/pattern/sözleşme değişikliği gerektiren her kalem **DUR ve sor**. Aşağıda onay gerektirenler 🔴 ile.

### 9.1 Akış
`Home (completed_today, şampiyon)` → davet satırı → `/pro-mode` (gate değişmeden: loading/error/locked/allowed) → **allowed:** `MoodGauntletEntry` → `MoodGauntletReveal` (4 film + gerekçe) → `MoodGauntletDuel` ×3 → `MoodGauntletChampion` ("Bu akşamın filmi") → çıkış Pro Mode'a / Home'a **tutarlı**.

### 9.2 Rota ve bileşenler
| Parça | Öneri | Tabana göre |
|---|---|---|
| Rota | `app/pro-mode.tsx` gate'i **korunur**, `allowed` dalı `MoodSearchScreen` yerine bayrakla `MoodGauntletScreen` döndürür (`mood_gauntlet_enabled` kapalıysa eski ekran) | tek satırlık dallanma (:185) — eski akış kaybolmaz |
| `MoodGauntletEntry` | `MoodSearchScreen` input fazından türet: arama çubuğu + rıza bloğu + `MoodCardGrid`. Çıkarılacaklar: Era/Quality `FilterBottomSheet`, Recent'ı koru, deste yönlendirmesi yok | `MoodSearchScreen:587-741` kopya değil **çıkarma** (rıza/kota/hata mantığı :369-471 ortak hook'a: `useMoodSubmit`) |
| `MoodGauntletReveal` | 4 `PosterTile` + tek cümle gerekçe satırı (yeni, `type` token'ları) | `PosterTile` yeniden kullanılır |
| `MoodGauntletDuel` | `PosterTile`×2 + `RoundIndicator` + `OutlineAction`; tur mantığı **yeni hook** | `GauntletShell` içinden kopyalama yerine 🔴 ortak `useDuelRounds` çıkarma; ilk sürümde daha güvenlisi: Shell'e dokunmadan paralel ince hook, sonra birleştirme |
| `MoodGauntletChampion` | `ChampionReveal`'i `gauntletId` yerine `source`/`onSave` callback'iyle genelle | 🔴 `ChampionReveal` props değişir; günlük gauntlet'in görünümü değişmemeli (ui-retrofit-guard) |
| Şampiyon davet satırı | Shell :1813↔:1819 arası yeni `ProModeInviteRow`; `useBelowHeight`'a `'pro'` parçası | hero yüksekliği + ask dwell etkisi test edilmeli |
| Çıkış davranışı | X / deste sonu yerine tek davranış: Mood Gauntlet'ten `router.back()` ile `/pro-mode`; Home'a atlama yok | bugünkü X→Home (`discover.tsx:261`) bilinçli bırakılırsa yazılı karar gerekir |
| Watchlist | Mood Gauntlet'te **otomatik yazım yok**; yalnız şampiyonda manuel "Sonra bırak" | `discover.tsx:238` yolu kullanılmaz |
| Spotlight | yalnız günlük şampiyon altında (değişmez) | |

### 9.3 Onay gerektiren kalemler 🔴
1. **Sunucu:** Mood Gauntlet'in 4 film + gerekçe + 3 tur durumunu nerede tutacağı (yeni tablo mu, `mood_searches` genişletme mi, mevcut `gauntlets`'a `mode` mı) ve seçimlerin hangi uç/yazım yoluyla `choice_events`/benzerine gideceği.
2. **`types/gauntlet.ts` kilidi:** yeniden kullanım için `ChoiceSubmission`/`GauntletFilm` kullanılacaksa CTO onayı.
3. **Paywall:** yeni trigger/variant (`types.ts`, `triggerOrchestrator`, `ContextualPaywall`).
4. **Kota:** Mood Gauntlet günlük hakkı (`check_and_consume_quota` tip listesi) + **rerank/parse maliyet koruması** (rerank günlük sınırı yok → "60/gün" yazılmalı mı?).
5. **v2 hattı:** `feat/mood-vec-2e` ile taban birleştirme sırası ve `moodSearchState` desenini koruyup koruma.
6. **PostHog adlandırma:** `mode` özelliği mi, ayrı ad mı (North Star kirliliği).
7. **Home state enum (K-03):** 6'lı enum'a refactor ayrı iş mi, Mood daveti mevcut 4'lü Shell üstüne mi eklenecek.

### 9.4 Riskler
- `GauntletShell` 2040 satır, K-37/K-42 invariantları (pozisyonel ayna, offline kuyruk) var; Mood Gauntlet'i oraya "mode" bayrağıyla gömmek regresyon yüzeyi büyütür — **ayrı kabuk + ortak sunum bileşenleri** önerilir.
- Free kullanıcı sunucu kapısı eksikliği (§6) Mood Gauntlet'te de aynen geçerli: ücretli çağrılar (parse + rerank) sunucuda yetki kontrolü almadan açılırsa maliyet açığı.
- Prod bayrak değerleri doğrulanmadı (§0.7).

---

## 10. Doğrulananlar / doğrulanmayanlar

**Okundu ve doğrulandı:** §1-§8 satır referansları (taban ağacından). **Çalıştırılmadı:** typecheck/test (salt okunur görev).
**Doğrulanmadı:** prod `app_config` değerleri · `chosy://pro-mode` cihaz davranışı · `submit-choice` sunucu kodunun mood `gauntletId` ile davranışı · `feat/mood-vec-2e` içeriği · plan belgesi §4.
