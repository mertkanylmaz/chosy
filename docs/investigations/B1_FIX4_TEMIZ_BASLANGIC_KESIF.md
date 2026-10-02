# B-1 / Fix 4 — Hesap silme sonrası temiz başlangıç: KEŞİF

Tarih: 2 Eki 2026 · Mod: salt okunur · Kapsam: yalnız hesap silme akışı
(çıkış yapma `profile.tsx` `handleSignOut` ve `app/auth.tsx` kapsam dışı).

## Yönetici özeti

1. **Mevcut `deleteAccount()` sırası, istenen sıranın tersi.** Sunucu başarısından
   hemen sonra `signOut({scope:'local'})` çalışıyor (`services/authService.ts:767`);
   RC logout, avatar ve kota temizliği ARKASINDAN geliyor (`:780`, `:788`, `:805`).
   `signOut` → `SIGNED_OUT` → `app/_layout.tsx:520-536` yeni anonim oturumu **kendiliğinden**
   açıyor. Yani bugün yeni kimlik, yerel veri silinmeden önce doğuyor.
2. **`_layout.tsx` SIGNED_OUT dinleyicisi otomatik `signInAnonymously()` yapıyor.**
   Görevdeki (v) adımı ("signOut → yeni signInAnonymously()") bu dinleyiciyle yan yana
   çalışırsa iki eşzamanlı anonim kayıt yarışı oluşur (biri orphan auth). DUR maddesi D-1.
3. **`chosy_watched_films` sızıntı yolu cold start'ta.** `syncWatchedFilms` yalnız
   `INITIAL_SESSION`'da ve effect ömründe bir kez koşuyor (`_layout.tsx:471-478`).
   Aynı süreçte yeni anonim oturum `SIGNED_IN` yayınlar → senkron koşmaz. Sızıntı
   **bir sonraki soğuk açılışta** olur. Regresyon testi cold start içermeli.
4. **AsyncStorage envanteri: 25 sabit anahtar + 7 şablon/prefix + Supabase auth anahtarı
   + PostHog kalıcı durumu (doğrulanamadı).** Mevcut silme akışı bunlardan yalnız avatar
   ve bugünkü kota anahtarlarını temizliyor.
5. **Çalışma ağacı kirli:** `services/authService.ts` ve `app/(tabs)/profile.tsx`
   Fix 1 (linkIdentity) değişikliklerini commit'lenmemiş halde taşıyor. Bu iş de aynı iki
   dosyaya dokunacak — explicit per-file add Fix 1 hunk'larını da commit'e alır. DUR maddesi D-4.

## (a) AsyncStorage anahtar envanteri

### Sabit anahtarlar

| # | Anahtar | Tanım dosya:satır | Kapsam (kimin verisi) |
|---|---|---|---|
| 1 | `moodflix_language` | `contexts/LanguageContext.tsx:36` | Cihaz tercihi (dil) |
| 2 | `chosy_tabbar_inset_reported_v1` | `components/gauntlet/TabBarInsetTelemetry/index.tsx:34` | Cihaz telemetrisi |
| 3 | `referral_prompt_shown` | `components/ReferralPromptSheet/index.tsx:29` | Kullanıcı |
| 4 | `chosy_watched_films` | `services/watchlist.ts:21` | **Kullanıcı — sızıntı vektörü** |
| 5 | `chosy_gauntlet_pending_choice` | `services/gauntletOfflineQueue.ts:44` | Kullanıcı (bekleyen seçim) |
| 6 | `chosy_gauntlet_cache_last` | `services/gauntletCache.ts:42` | Kullanıcı (`chosy_gauntlet_cache_` prefix'ine dahil) |
| 7 | `taste_signal_offline_queue` | `services/tasteSignalService.ts:146` | Kullanıcı (bekleyen sinyal) |
| 8 | `chosy_game_migration_v6` | `services/gameService.ts:35` | Cihaz (migration işareti) |
| 9 | `chosy_sessions_count` | `services/entryService.ts:9` | Cihaz sayacı (yazan tek yer `gate.tsx:115`) |
| 10 | `chosy_last_entry_date` | `services/entryService.ts:16` | Cihaz/UX |
| 11 | `chosy_onboarded` (legacy v2) | `services/entryService.ts:12`, `app/gate.tsx:78-81` | Legacy |
| 12 | `moodflix_onboarding_done` (legacy v1) | `services/entryService.ts:13` | Legacy (yalnız okunur) |
| 13 | `remote_config_cache` | `services/remoteConfig.ts:6` | Uygulama yapılandırması |
| 14 | `paywall_cooldowns` | `services/conversion/triggerOrchestrator.ts:34` | Kullanıcı |
| 15 | `paywall_dismissals` | `services/conversion/triggerOrchestrator.ts:35` | Kullanıcı |
| 16 | `paywall_first_open` | `services/conversion/triggerOrchestrator.ts:36` | Kullanıcı |
| 17 | `ab_test_overrides` | `services/conversion/abTesting.ts:35` | Kullanıcı/dev |
| 18 | `chosy_push_permission_asked` | `services/pushNotifications.ts:33` | Cihaz (OS izni cihaz başına, `:436-441`) |
| 19 | `chosy_push_token` | `services/pushNotifications.ts:36` | Cihaz token'ı |
| 20 | `chosy_cached_archetype_id` | `services/offlineQueue.ts:23` | Kullanıcı |
| 21 | `chosy_cached_calibration_vector` | `services/offlineQueue.ts:26` | Kullanıcı |
| 22 | `chosy_offline_queue` | `services/offlineQueue.ts:29` | Kullanıcı (bekleyen işlem) |
| 23 | `chosy_ai_preferences` | `services/recommendations.ts:100` | Kullanıcı (yalnız okuma bulundu, yazan yok) |
| 24 | `chosy_user_avatar` (legacy) | `utils/avatarStorage.ts:20` | Legacy cihaz anahtarı |
| 25 | `chosy_last_known_auth_id_suffix` | `utils/identityReset.ts:31` | E-08 ölçüm izi |

### Şablon / prefix anahtarlar

| Şablon | Tanım dosya:satır |
|---|---|
| `chosy_onboarded_${userId}` | `app/gate.tsx:75`, `app/onboarding.tsx:54` |
| `chosy_gauntlet_cache_${userId}_${date}` | `services/gauntletCache.ts:36,117` |
| `chosy_game_v6_{puzzle\|result\|streak}_…` | `services/gameService.ts:32,80-91` |
| `daily_match_v1_${userId}_${date}` | `services/dailyMatch.ts:25,74` |
| `chosy_prev_cycle_${userId}` | `services/previousCycle.ts:22,109` |
| `quota_${userId}_${type}_${date}`, `quota_bonus_${userId}_search_${date}` | `services/quotaEngine.ts:62,341` |
| `chosy_user_avatar_${publicUserId}` | `utils/avatarStorage.ts:23` |

### Kütüphane anahtarları

- Supabase oturumu: `storage: AsyncStorage` (`services/supabase.ts:97`) → `sb-<ref>-auth-token`
  (+ PKCE için `-code-verifier`). Allowlist modelinde bu anahtar da "silinecek" sınıfına düşer;
  `signOut({scope:'local'})`'tan önce silinirse istemci bellekte oturumu hâlâ tutar. Sıra D-3'te.
- PostHog: `new PostHog(key, { host, flushAt, flushInterval })` (`services/posthog.ts:54`),
  özel storage verilmemiş. SDK'nın AsyncStorage'a mı dosya sistemine mi yazdığı ve anahtar adı
  **doğrulanamadı** — cihazdaki `getAllKeys` çıktısında görülecek.
- RevenueCat: native SDK, AsyncStorage kullanmıyor (kod tabanında iz yok).

### Mevcut silme akışının temizlediği

`clearStoredAvatar` (`authService.ts:788`) ve `clearQuotaCache(publicUserId)` (`authService.ts:805`)
— ikincisi yalnız **bugünün** 8 kota anahtarını siler (`quotaEngine.ts:338-342`), önceki
günlerinkini değil. `clearGauntletCache` (`gauntletCache.ts:212`) hiçbir yerden çağrılmıyor (ölü).

## (b) Bellekteki state — silme sonrası sıfırlanmayanlar

| Yer | Durum | dosya:satır |
|---|---|---|
| `SubscriptionContext` (`premiumStatus`, `tier`, `status`, `planId`, `quota`…) | Auth dinleyicisi YOK. `refreshSubscription` yalnız mount'ta (`:490-492`) ve RC listener'da (`:500-551`). RC `logOut` customerInfo güncellemesi yayınlarsa listener `refreshSubscription`'ı tetikler — yayınlamazsa eski premium state kalır. Zamanlamaya bağlı. | `contexts/SubscriptionContext.tsx:132-156,490,500` |
| `GauntletShell` | `SIGNED_IN` + farklı auth id → `restartForNewIdentity()` (bd7ac25). Yeni anonim oturum `SIGNED_IN` yayınladığı için **kendiliğinden sıfırlanıyor**. `router.replace('/onboarding')` sonrası shell unmount olabilir; o durumda konu değil. | `components/gauntlet/GauntletShell/index.tsx:770-821` |
| `useWatchProviders` `memo` (Map) | Film-bazlı sağlayıcı cache'i, kullanıcıya bağlı değil. | `components/gauntlet/WatchProviders/useWatchProviders.ts:44` |
| `remoteConfig` `memoryCache` | Uygulama yapılandırması, kullanıcıya bağlı değil. | `services/remoteConfig.ts:24` |
| `gauntletOfflineQueue` `inFlight` | Uçuşta flush promise'i; temizlik sırasında flush koşuyorsa eski kimliğin isteği tamamlanır. | `services/gauntletOfflineQueue.ts:160` |
| `tasteSignalService` `recentDetailViews` | filmId→timestamp dedupe, kullanıcıya bağlı ama zararsız. | `services/tasteSignalService.ts:125` |
| `recommendationPreload`, `moodSearchState`, `matchExplanation`, `tasteParser`, `userVectorRefresh` | Mood-search dönemi modül state'i; emekli akış. | `services/recommendationPreload.ts:24-30` vb. |
| `MoodContext` | In-memory, emekli akış. | `contexts/MoodContext.tsx:6` |
| `posthog.ts` `superProperties` | `reset()` sonrası bilinçli yeniden kaydediliyor (sürüm bağlamı). | `services/posthog.ts:29,100-102` |
| react-query / SWR / zustand / redux | **Yok** (`package.json`'da bulunmadı). | — |
| RC `logOutPurchases` | Hata `logger.warn` ile yutuluyor — görevdeki "logger.warn DEĞİL" kuralına aykırı. Ayrıca RC, anonim RC kullanıcısında `logOut` çağrısını hata ile reddeder; Apple ile hiç giriş yapmamış (RC'ye `logIn` olmamış) kullanıcıda bu **beklenen** bir hata. | `services/purchaseService.ts:503-520` |

## (c) Oturum olayları ve senkron sırası

| Tetikleyici | Ne koşar | dosya:satır |
|---|---|---|
| `_layout` mount | `tasteSignals.flushOfflineQueue()` | `app/_layout.tsx:287-291` |
| `_layout` mount | `processOfflineQueue()` | `app/_layout.tsx:335-339` |
| `SIGNED_IN` / `INITIAL_SESSION` | `bootstrapAppUser()` (public.users upsert) | `app/_layout.tsx:465-467` |
| `INITIAL_SESSION` (effect ömründe 1 kez) | `syncWatchedFilms()` — `chosy_watched_films` → watchlist | `app/_layout.tsx:471-478` |
| `TOKEN_REFRESHED` | `processOfflineQueue()` | `app/_layout.tsx:481-490` |
| `SIGNED_OUT` | `getSession()` boşsa **otomatik `signInAnonymously()`** + `identity_reset_detected` (trigger `signed_out_recovery`) | `app/_layout.tsx:520-560` |
| her çözülmüş oturum | `noteResolvedIdentity` → `chosy_last_known_auth_id_suffix` yazımı | `app/_layout.tsx:362-389,445` |
| GauntletShell `SIGNED_IN` (farklı id) | `restartForNewIdentity()` → `flushThenLoad` | `GauntletShell/index.tsx:799-812` |

**Sıra garantisi bugün yok.** Yeni oturumu `signOut`'un kendisi (dinleyici üzerinden) başlattığı
için "temizlik bitmeden yeni session açılmaz" koşulu ancak tüm AsyncStorage temizliği `signOut`'tan
**önce** tamamlanırsa sağlanır. Temizlik → `await` → `signOut` sırası yeterli; `signOut` sonrası
ikinci bir explicit `signInAnonymously` dinleyiciyle yarışır (D-1).

Sızıntı vektörleri (temizlik olmazsa):
- `chosy_watched_films` → sonraki cold start `INITIAL_SESSION` → yeni kimliğin watchlist'ine yazılır.
- `chosy_offline_queue`, `taste_signal_offline_queue` → sonraki mount / `TOKEN_REFRESHED`'te yeni kimlikle gönderilir.
- `chosy_gauntlet_pending_choice` → GauntletShell flush'ında gönderilir (sunucunun gauntlet sahipliği
  doğrulaması bu turda incelenmedi — doğrulanamadı).

## Allowlist önerisinin keşifle karşılaştırması

| Anahtar | Gözlem |
|---|---|
| `chosy_push_permission_asked` | Önerildi. Tutulursa ve OS izni verilmişse, yeni kullanıcıya sheet gösterilmez (`pushNotifications.ts:446-453`) → `registerForPushNotifications` hiç koşmaz → **yeni kimliğin sunucu push token satırı oluşmaz**. Yerel 18:00 hatırlatıcısı etkilenmez. |
| `chosy_sessions_count` | Önerildi. Okuyan yer bulunamadı (yalnız `gate.tsx:115` artırıyor). |
| `moodflix_language` | Önerilmedi. Silinirse kullanıcı Türkçe seçtiyse cihaz diline döner. |
| `chosy_tabbar_inset_reported_v1` | Önerilmedi. Cihaz telemetrisi; silinirse tek seferlik rapor tekrar gider. |
| `chosy_push_token` | Önerilmedi. Cihaz token'ı; silinirse `toggleNotifications` yeniden üretir. |
| `chosy_game_migration_v6` | Silinirse migration yeniden koşar (`gameService.ts:46-54`), zararsız. |
| `chosy_last_known_auth_id_suffix` | Silinirse sonraki cold start "önceki kimlik yok" görür — ölçüm etkisi D-5. |
| `sb-*-auth-token` | D-3. |

## DUR NOKTASI gerektiren maddeler

- **D-1 — Yeni anonim oturumu kim açar?** `_layout.tsx:520-536` zaten açıyor. Seçenekler:
  (A) `resetToFreshSession` yalnız `signOut` yapar, yeni oturumu dinleyici açar, fonksiyon
  `SIGNED_IN`'i bekler (layout'a dokunulmaz); (B) explicit `signInAnonymously` + layout
  dinleyicisine "reset sürüyor" bastırma bayrağı — `_layout.tsx`'e dokunur, kapsam genişler.
- **D-2 — `deleteAccount` gövdesi değişmek zorunda.** Sunucu-sonrası adımlar (`authService.ts:759-807`)
  `signOut`'u temizlikten önce yapıyor. Görev "profile.tsx dışında değişiklik yok" diyor ama
  bu adımlar `resetToFreshSession`'a taşınmadan sıra sağlanamaz. Çağrı yeri: `deleteAccount`
  içinden mi, `profile.tsx`'ten mi?
- **D-3 — Supabase auth anahtarı.** Allowlist dışı kalıp `multiRemove` ile mi silinecek,
  yoksa `sb-` prefix'i temizlikten hariç tutulup `signOut({scope:'local'})`'a mı bırakılacak?
- **D-4 — Kirli çalışma ağacı.** `authService.ts` + `profile.tsx` Fix 1 hunk'ları commit'lenmemiş.
  Explicit add bunları da alır.
- **D-5 — Ölçüm kirliliği.** Hesap silme, `_layout.tsx:537-542` üzerinden `identity_reset_detected`
  (`signed_out_recovery`) event'i üretir — kasıtlı silme, kimlik kaybı olarak sayılır
  (orphan auth teşhisi bu event'i kullanıyor). `_layout.tsx` kapsam dışı; yalnız raporlanıyor.
- **D-6 — RC `logOut` anonim RC kullanıcısında hata fırlatır.** Görev "hata → Sentry
  captureException" diyor; Apple ile hiç giriş yapmamış her silen kullanıcı Sentry event'i üretir.

## Ölçülmüş sayılar

Bu tur canlı veri ölçümü gerektirmedi; tüm bulgular kod referanslıdır.

## Doğrulanamayanlar

- PostHog RN SDK'nın kalıcı depolama yeri ve anahtar adı (`services/posthog.ts:54`, custom storage yok).
- RC `Purchases.logOut()`'un `addSubscriptionListener`'ı tetikleyip tetiklemediği (SubscriptionContext sıfırlanması buna bağlı).
- `submit-choice`'ın başka kullanıcıya ait `gauntlet_id`'yi reddedip reddetmediği (`chosy_gauntlet_pending_choice` sızıntısının sunucu tarafı).
- Cihazdaki gerçek `getAllKeys` çıktısı — yalnız cihaz testiyle.
