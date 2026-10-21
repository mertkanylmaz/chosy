# PERF-1 Keşif Raporu — İlk kullanım yavaşlıkları + küçük hatalar

Tarih: 22 Eki 2026 · Dal: `release/2.1.1` (görev metni `fix/pro-mode-vital` diyor — dal farkı not edildi)
Mod: SALT OKUNUR. Kod yazılmadı. Canlı veri / Sentry / Supabase log sorgusu ÇALIŞTIRILMADI (bkz. Doğrulanamayanlar).

## Yönetici özeti

1. **Sağa kaydırma başına ~9 istek, 3'ü aynı `users` satırına yazıyor** (`touch_user_activity` UPDATE, client `PATCH users.preferences_vector`, `mark_user_vector_dirty` trigger UPDATE'i). Hepsi aynı tick'te ateşleniyor. Sola kaydırma ~4 istek. `update_streak`/`check_milestones` her kaydırmada çağrılıyor (`hooks/useFeedManager.ts:635`).
2. **`updateUserVector` iki yerden çağrılabiliyor ve her seferinde GET users + GET film_profiles + PATCH users yapıyor** (`services/watchlist.ts:481`, `hooks/useFeedManager.ts:592`); `/users` okumaları için ortak oturum önbelleği YOK (yalnız `hasAiConsent` ve kimlik eşlemesi önbellekli).
3. **Profil açılışı iki kez yükleniyor**: `loading` `useFocusEffect` bağımlılığında (`app/(tabs)/profile.tsx:1080-1086`) → ilk yükleme biter bitmez `loadAll` ikinci kez çalışıyor. İlk yükleme zinciri sıralı: users GET → (push_enabled için ikinci users GET) → getWatchlist. Saved posterleri RN `Image` ile, 4 küçük karo için `w780` boyutunda, tüm watchlist çekilerek yükleniyor.
4. **Pro durumu RC-öncelikli çözülüyor ama `premiumStatus` DB okuması bitene kadar yazılmıyor** (`contexts/SubscriptionContext.tsx:187-191`: RC → DB sıralı). Ek olarak `useProModeAccess` her mount'ta ayrı `users` GET'i atıyor (4 tüketici).
5. **`reportTimeout` AppState'e bakmıyor** (`services/supabase.ts:94-103`); `in_foreground` etiketi kodda yok — Sentry'deki değerin kaynağı doğrulanamadı.

## Bulgular tablosu

### Madde 1 — Kaydırma başına çağrılar

| dosya:satır | açıklama | boyut |
|---|---|---|
| `app/discover.tsx:197`, `:219` | Her sağ/sol kaydırma `onSwipeFilm`'i çağırıyor | — |
| `hooks/useFeedManager.ts:635` | `recordActivity()` → `update_streak` + `check_milestones` paralel RPC (`services/gamification.ts:80-83`). Await edilmiyor (fire-and-forget), her kaydırmada | S |
| `hooks/useFeedManager.ts:640` | `touchActivity()` → `touch_user_activity` RPC (`services/pushNotifications.ts:578`); her kaydırmada, `UPDATE users` (`supabase/migrations/109_...sql:702`) | S |
| `services/gamification.ts:118-146` | Streak güncellendiyse `earnSlotToken` + `grant_streak_rewards` ek RPC'ler (yalnız `streak_updated` true iken) | — |
| `app/discover.tsx:207` → `services/watchlist.ts:453` | Sağ kaydırma: watchlist upsert (await edilmiyor, arka planda) | — |
| `services/watchlist.ts:481` → `services/userProfile.ts:148-170` | `updateUserVector`: GET users + GET film_profiles + PATCH users (await edilmiyor). Sağ kaydırma başına 3 istek | M |
| `services/watchlist.ts:484` → `services/tasteSignalService.ts:346` | `user_taste_signals` INSERT (tek tek, kuyruksuz; hata olursa offline kuyruğa) | M |
| `app/discover.tsx:220` | Sola kaydırma: `recordSwipeLeft` INSERT | — |
| `app/discover.tsx:175` | Ücretsiz kullanıcıda sağ kaydırma `checkAndConsumeQuota` RPC'sini **await** ediyor — kartı bu RPC bloklar (tek bloklayan çağrı) | M |
| `supabase/migrations/039_user_vector_dirty_trigger.sql:15-31` | Taste signal INSERT → `|strength| ≥ 0.2` ve `dirty=false` iken `UPDATE users` (SECURITY DEFINER) | — |
| `supabase/migrations/109_...sql:711-` | `update_streak` içinde `users` UPDATE'i görünmedi (`user_streaks`'e yazıyor); `CURRENT_DATE` = UTC günü — "yerel tarih anahtarı" önerisi sunucu imzasını değiştirir | — |

Notlar:
- Sıralı (await'li) zincir yalnız quota RPC; diğerleri fire-and-forget ama aynı anda 4-5 bağlantı açıyor.
- `users` satırına eşzamanlı üç yazar (touch RPC, client PATCH, trigger) kod olarak doğrulandı. 11,8 sn bekleme nedeni **doğrulanamadı** (kilit mi, bağlantı havuzu mu, RPC içi başka kilit mi — canlı `pg_locks`/log ölçümü yapılmadı).
- `hooks/useFeedManager.ts:581-604` `onSwipe` içinde de `updateUserVector` var; `discover.tsx` yalnız `onSwipeFilm` kullanıyor, `onSwipe`'in canlı tüketicisi doğrulanmadı. Çift tetik riski yalnız o yol kullanılıyorsa.
- Önerinin uygulanabilirliği: günde 1 `update_streak`/`check_milestones` ve oturum başı 1 `touch_user_activity` — istemci tarafı kapılama (AsyncStorage anahtarı) JS-only yapılabilir; **yerel tarih anahtarı** ile sunucunun UTC `CURRENT_DATE`'i farklı gün sınırı üretir → davranış farkı riski. Taste signal'lar için kuyruk + 2 sn/5 adet batch: `tasteSignalService.ts` içinde mevcut offline kuyruk (`:153`, `:193`) yeniden kullanılabilir, ama "yeni pattern" sayılırsa DUR (bkz. aşağı). Risk: batch içinde tek geçersiz satır (permanent hata) — flush mantığı satır-satır kurtarmayı zaten yapıyor (`:244-283`).

### Madde 2 — `/users` okumaları

| tetikleyici | dosya:satır | alan | not |
|---|---|---|---|
| `useProModeAccess` her mount (discover, MoodSearchScreen, profile, pro-mode) | `hooks/useProModeAccess.ts:78-82`; tüketiciler `app/discover.tsx:79`, `components/Home/MoodSearchScreen/index.tsx:139`, `app/(tabs)/profile.tsx:767`, `app/pro-mode.tsx:87` | `legacy_mood_access` | Önbellek yok (dosya başlığı bilinçli "modül cache yok" diyor, `:50-56`) |
| `readUserFlags` | `services/userFlags.ts:61-65` (çağıran `services/askCoordinator.ts:104`) | `legacy_mood_access` dahil 3 bayrak | Aynı `legacy_mood_access` ikinci yoldan |
| Profil `loadAll` (her odak) | `app/(tabs)/profile.tsx:930-934` | `id, display_name, username, archetype_id, created_at` | |
| Profil `loadAll` → `getNotificationStatus` | `services/pushNotifications.ts:343-347` | `push_enabled` | Yukarıdakinden sonra sıralı; aynı satır |
| `hasAiConsent` | `services/aiConsent.ts:113-117` | `ai_consent_*` | Modül önbelleği var (`:110`); yalnız başarılı okuma yazılıyor |
| `updateUserVector` | `services/userProfile.ts:149` | `preferences_vector` | Her sağ kaydırmada |
| `getFreshUserVector` | `services/userVectorRefresh.ts:79-83` | vektör + dirty | Her öneri çağrısında |
| `recommendations.ts` | `services/recommendations.ts:1424-1427` | `preferences_vector, total_interactions` | |
| diğer | `services/dailyMatch.ts:340`, `services/feedback.ts:122`, `services/slotService.ts:228`, `services/homeService.ts:46`, `components/Home/DailyPickSection/index.tsx:59`, `app/gate.tsx:202` | çeşitli | |
| kimlik | `services/auth-utils.ts:145-150`, `:213-217` | `id` | `identityCache` ile önbellekli — kimlik çözümü için ek istek yok |

6 dakikada 83 GET `/users` için **kod okuması** olası ana kaynakları gösteriyor (sağ kaydırma başına 1 GET + profil açılışı başına 4 GET + her `useProModeAccess` mount'u). Sayımı doğrulayan ölçüm yapılmadı.

Ortak oturum önbelleği (stale-while-revalidate, odakta 60 sn): mevcut desenlerin yanına yeni bir modül (ör. `services/` altında kullanıcı-satırı önbelleği) girer. `identityCache` (`utils/identityCache.ts`) kimlik eşlemesi içindir; `remoteConfig.ts` `app_config` içindir. Bu **yeni pattern** → DUR NOKTASI D-1.

### Madde 3 — Profil açılış zinciri ve Saved posterleri

Sıralı zincir (`app/(tabs)/profile.tsx:915-1064`):
1. `supabase.auth.getSession()` (yerel) → `:920`
2. `users` GET → `:930` (bloklayıcı; sonraki her şey `userId`'ye bağlı)
3. `Promise.all([getLastParsedProfile (Cinema DNA kapalı → null), getNotificationStatus()])` → `:1007`; `getNotificationStatus` içeride ikinci `users` GET'i atıyor (`pushNotifications.ts:343`) — `userId` zaten elde, ama fonksiyon kendi `getAppUserId` çağrısını yapıyor
4. Non-blocking: `getLastChampion`, `getChampionDatesSince`, watched count, `getWatchlist` (`:952`, `:962`, `:1029`, `:1047`)

`loading` spinner'ı yalnız adım 1-3 (+ DNA açıksa `getSwipeInsights`, `:1017`) bitince kapanıyor (`:1067-1077`). Adım 3 paralelleştirilebilir: `getNotificationStatus` 2'den bağımsız başlatılabilir (kendi kimliğini çözüyor). Adım 2'nin `select`'i ile `push_enabled` aynı satırdan tek istekte alınabilir (`users` GET'ine alan eklemek yeterli) — `getNotificationStatus` imzası/başka çağıranları (`pushNotifications.ts:622`) etkilenir.

**Çift yükleme**: `useFocusEffect` `[loading, loadAll]` bağımlılığıyla (`:1080-1086`); `loading` true→false olunca callback yenileniyor ve odaktaki ekranda yeniden çalışıyor → ilk açılışta tüm `loadAll` ikinci kez (users ×2, watchlist, champion, ritual, watched count). Bu davranışın cihazda gerçekten ikinci kez tetiklendiği ölçülmedi; React Navigation semantiğinden okunan beklenti.

**Saved posterleri 15 sn+ gri**:
- Kaynak: `getWatchlist()` (`services/watchlist.ts:534-590`) tüm watchlist'i `sessions` + `films` join'iyle çekiyor, sonra `readPendingOverlay` — yalnız ilk 4 poster ve sayı için (`profile.tsx:1047-1054`).
- URL: `toTmdbUrl(row.films.poster_url)` varsayılan boyut **`w780`** (`watchlist.ts:517`, `:569`) — 4 küçük karo için.
- Bileşen: `react-native` `Image` (`profile.tsx:24`, kullanım `:1865`), `expo-image` DEĞİL — disk önbelleği/`cachePolicy`/geçiş yok. Aynı ekranda şampiyon posteri de RN `Image` (`:1814-1816`).
- Poster URL'i yalnız `getWatchlist` bittikten sonra bilinir → `watchlistPosters` `[]` iken satır "özet" yerleşimi (`:1885-1902`), dolunca poster ızgarası (`:1849`) — bkz. 8c.
- 15 sn+ gecikmenin ağ mı yoksa decode mu olduğu **doğrulanamadı** (cihazda ölçüm yok). Kodun gösterdiği: sıralı zincir + büyük görsel + RN Image önbelleksizliği.

### Madde 4 — Pro durumu

- Kapı: `useProModeAccess` → `allowed = !stillLoading && (isPremium || legacyAccess)` (`hooks/useProModeAccess.ts:109-113`); `isPremium` `SubscriptionContext`'ten (`:141`).
- `refreshSubscription` (`contexts/SubscriptionContext.tsx:173-301`): `getAppUserId` → `getSubscriptionStatus()` (RC, `:187`) → `getUserSubscription()` (DB, `:188`) **sıralı**; `setPremiumStatus` yalnız ikisi de bittikten sonra çağrılıyor. RC aktif + DB satırı yok → premium (D3, `:210-231`; `utils/premiumStatus.ts:56-58`). REACT-NATIVE-9 bu dalın `captureMessage`'ı (`:227`) — tasarım gereği uyarı.
- Yani RC aktifken premium çözülüyor; **gecikme** DB okumasının RC'ye zincirlenmesinden. İki okuma birbirine bağımlı değil (`userId` zaten elde) → `Promise.all` mümkün (mantık değişmez).
- RC `not_initialized`/hata + DB satırı yok + `previous === 'loading'` → `free` (`:246-267`): SDK henüz hazır değilken açılışta free'ye düşüp paywall tetiklenebilir. Bu senaryonun 21:16:47 olayıyla ilişkisi **doğrulanamadı**.
- RC listener premium görünce anında premium yapıyor (`:510-516`) ve `users.subscription_tier` yazıyor (`:530-539`); sonra tam `refreshSubscription` (`:559`).
- `useProModeAccess` ayrıca `users.legacy_mood_access` okumasının bitmesini bekliyor (`loading` birleşik) — premium kullanıcı için gereksiz bekleme (premium isPremium=true olunca legacy gerekmiyor).

### Madde 5 — REACT-NATIVE-H (searchId yok)

Kodda zincir:
- `MoodSearchScreen.applySearchResult`: `setPendingSearchId(searchId)` (`components/Home/MoodSearchScreen/index.tsx:297`) → `startPreload` (`:311`).
- `startPreload` (`services/recommendationPreload.ts:86-133`): dedupe anahtarı `profileKey(profile, text, mode, peekPendingSearchId())` (`:91`); aynı anahtar + promise varsa `return` (`:94`), sonra `consumePendingSearchId()` (`:102`) ve `getRecommendations(..., searchId, true)`.
- `useFeedManager` ilk batch: önce `consumePreloadedRecommendations()` (`hooks/useFeedManager.ts:418`); preload yoksa `consumePendingSearchId()` (`:473`).
- Uyarı yeri: `services/recommendations.ts:970-981` — `!searchId && isFirstBatch && mode !== 'basic'`.

Statik okumadan çıkan **aday senaryolar** (hiçbiri doğrulanmadı):
- (a) `consumePendingSearchId` tek-okumalık modül store'u. Preload başlamadan önce `useFeedManager`'ın `initial_load` efekti (`useFeedManager.ts:540-547`) çalışırsa searchId'yi tüketir, `startPreload` `null` ile başlar → `search_id_missing`. Efektin ne zaman çalıştığı (feed ekranı `startPreload`'dan önce mount'lu mu) ekran akışına bağlı; doğrulanmadı.
- (b) `isRerun` yolunda (`:306`) `clearPreload()` + yeni `searchId`; ilk basic arama `searchId: null` yazmış, 2. AI aramada yeni id geliyor — bu yol kodda tutarlı görünüyor.
- (c) 7ab9949 ile eklenen dedupe anahtarı (`searchId` bileşeni): `startPreload` anahtarı hesaplarken `peekPendingSearchId()` kullanıyor; anahtar eşleşirse `return` consume'dan önce — searchId store'da kalır, tüketilmez, sonraki aramada üstüne yazılır. Doğrudan "kayıp" üretmiyor, ancak aynı anahtarla ikinci çağrı preload'u yeniden başlatmadığı için ikinci `setPendingSearchId` değeri ilk batch'te tüketilir (`useFeedManager:473`) — preload zaten `ready` ise `searchId` boşa kalır (mood_searches UPDATE'i zaten preload içinde yapıldı).
- Kesin neden için olay (REACT-NATIVE-H) ayrıntısı + `feed_batch_search_id_debug` / `mood_search_debug_entry` PostHog olayları gerekir (kodda bu telemetri zaten yazılıyor: `useFeedManager.ts:476`, `recommendations.ts:957`).

### Madde 6 — Champion posteri prefetch

Evet: son tur başlarken (`newRound === 3`) iki finalistin `w780` posteri `ExpoImage.prefetch` ile ısıtılıyor (`components/gauntlet/GauntletShell/index.tsx:1241-1252`); watch providers da (`:1242-1243`). Ayrıca kalan rakipler için `prefetchUpcomingChallengers` (`:178-183`, çağrı `:566`). Bu yol için ek boşluk bulunmadı. Profil'deki şampiyon posteri bu önbellekten yararlanmıyor (RN `Image`, `profile.tsx:1814-1816`).

### Madde 7 — Film detay oyuncu fotoğrafları

- Fotoğraf URL'i `w185` (`app/film/[id].tsx:394`, `:818`); bileşen `expo-image`, `cachePolicy="memory-disk"`, `placeholder`/`transition` yok (`:198-203`).
- Yükleme sırası: `films` + `film_profiles` paralel (`:356-366`) → ardından TMDb `fetchMovieDetails` + providers (`:402-407`; istemciden doğrudan TMDb, `services/tmdb.ts:241-252`) → `setFilm` (`:425`) **TMDb cevabı gelene kadar**; iskelet (`:690-716`) `loading`'e bağlı ve `loadFilm` `finally`'de kapanıyor (`:450-452`). Yani iskelet süresini belirleyen ikinci aşama olan TMDb isteği (zaman aşımı `fetchWithTimeout` süresi `services/tmdb.ts` içinde; değeri okunmadı).
- Gri kalma nedeni (CDN gecikmesi / prefetch yok / `FlatList` sanallaştırması) **doğrulanamadı**. Kod düzeyinde: oyuncu görselleri için prefetch yok, `placeholder` yok; liste elemanları görünür olunca yüklenmeye başlıyor.
- İlgili ek: `app/film/[id].tsx:491` yalnız "bu film kayıtlı mı" için tüm `getWatchlist()`'i çekiyor.

### Madde 8 — Küçük UI

| kalem | dosya:satır | bulgu |
|---|---|---|
| 8a "Where to Watch" etiketi boş | `components/games/Spotlight/SpotlightResult.tsx:302-307`; `components/gauntlet/ChampionActionButton/index.tsx:75-84`, `styles.ts:29-31,39-44` | i18n anahtarı mevcut (`locales/en.json:1211`, `tr.json:1211`). Etiket `Text`'i `marquee` dolgu üstünde `color.surface.base` (ink) renginde, `numberOfLines={1}` + `adjustsFontSizeToFit`. Neden boş göründüğü statik okumada **bulunamadı** (aday: `adjustsFontSizeToFit` ile satır içi genişlik çözümü; renk/kontrast). Cihazda gözlem gerekir. |
| 8b Home Spotlight satırı ~1 sn "PLAY · 6 tries" | `components/gauntlet/SpotlightBonusCard/useSpotlightCardState.ts:46-93`; `SpotlightBonusCard/index.tsx:134-144` | Hook odakta yeniden okuyor ama önceki `ready` durumu yenileme bitene kadar korunuyor (`:77`, `:86`; `data` sıfırlanmıyor). Oyundan dönüşte `getDailyChallenge` cevabı gelene kadar eski `not_started` → "Play · N tries" görünür. (Eski durumu tutma bilinçli: hata durumunda kart nötr kalmasın diye.) |
| 8c Profil iki yerleşim arasında zıplıyor | `app/(tabs)/profile.tsx:1849-1903`; state `:849-850` | Yerleşim `watchlistPosters.length > 0` ile seçiliyor; başlangıç `[]` → önce "özet satırı", `getWatchlist` dönünce "poster ızgarası". Ayrıca çift `loadAll` (Madde 3) yeniden set ediyor. `watchlistCount`/`posters` için "yüklenmedi" durumu yok (0 ve `[]` ile "boş" aynı). |

### Madde 9 — `reportTimeout`

- `services/supabase.ts:94-103`: oturum başına yol başına 1 `captureMessage('network_request_timeout')`; AppState kontrolü yok. Çağrı yeri `:141` — timer `controller.abort()` yapınca `timedOut`, `catch`'te raporlanıyor.
- Zaman aşımı sayacı arka planda da işliyor (iOS arka planda JS/ağ askıya alınır; geri dönüşte zamanlayıcı "dolmuş" görünüp `abort` tetikleyebilir). Bu mekanizma **doğrulanmadı**, Sentry olayının `in_foreground:false` etiketinin kaynağı da kodda bulunamadı (etiket yok: `:98-102` yalnız `path`, `method`, `timeout_ms`). Etiket Sentry SDK'sından geliyorsa kaynak: doğrulanamadı.
- `AppState` zaten kodda kullanılıyor (`app/film/[id].tsx:592`); `services/supabase.ts` içinde import yok.

## Ölçülmüş sayılar

Bu turda canlı sorgu çalıştırılmadı. Görev metnindeki rakamlar (220 ms, 11,8 sn, 83 GET /users, 4–5 istek/kaydırma) CTO ölçümü olarak alındı; bu raporda yeniden üretilmedi. Rapordaki "sağa kaydırma ≈ 9 istek / sola ≈ 4" **kod sayımıdır** (ölçüm değil): sağ = recordActivity 2 RPC + touch 1 RPC + watchlist upsert 1 + updateUserVector 3 + taste INSERT 1 + (ücretsizde) quota RPC 1.

## DUR NOKTASI gerektiren maddeler

- **D-1 (Madde 2)**: `/users` için ortak oturum önbelleği = yeni modül/pattern (stale-while-revalidate + odak TTL). Yetki sınırı: yeni pattern → CTO onayı.
- **D-2 (Madde 1)**: Taste signal'lar için kuyruk + 2 sn/5 adet batch: mevcut offline kuyruk mantığının çevrimiçi yolda kullanımı yeni pattern sayılabilir; `update_streak` için "yerel tarih anahtarı" sunucudaki UTC `CURRENT_DATE` ile gün sınırı uyuşmazlığı doğurur (istemci kapısı yalnız çağrıyı seyreltir, sunucu semantiği değişmez — karar CTO'nun).
- **D-3 (Madde 1)**: 11,8 sn `users` kilidi için gerçek çözüm (trigger'ın `UPDATE users`'ı, `touch_user_activity`) SQL/migration gerektirir → görev JS-only kapsamının dışında.
- **D-4 (Madde 9/4)**: `getNotificationStatus` imzası veya `useProModeAccess` davranışı (premium iken legacy beklememe) başka çağıranları etkiler; kapsam/sözleşme kararı.
- `types/gauntlet.ts` ve gauntlet/oyun mantığına dokunan bir öneri yok.

## Doğrulanamayanlar

- 11,8 sn bekleyişin kök nedeni (kilit/havuz) — `pg_locks`, Supabase logları, `query_logs` çalıştırılmadı.
- REACT-NATIVE-H / -E / -9 olay ayrıntıları ve `in_foreground:false` etiketinin kaynağı — Sentry organizasyon slug'ı bilinmeden sorgulanmadı; yalnız kod okundu.
- Madde 3/7 görsel gecikmelerinin ağ mı decode mu olduğu — cihaz/profiler ölçümü yok.
- Madde 5'in hangi aday senaryodan çıktığı — feed ekranının `startPreload`'a göre mount zamanlaması akış üzerinden doğrulanmadı.
- Madde 8a etiketin neden boş çizildiği.
- 83 GET `/users` dağılımı — Supabase API logu çekilmedi.
- `tsc` = 14 baseline'ı bu turda çalıştırılmadı (kod değişikliği olmadığı için gerekmedi).
