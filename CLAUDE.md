# MoodFlix — Proje Kuralları (v4)

> App store adı: `Chosy.ai` (`app.config.ts`). Kod ve iletişimde: `MoodFlix`.
> Build: `expo-dev-client` kullan — Expo Go değil.

---

## Kod Kuralları (Her Session'da Geçerli)
- TypeScript strict — `any` YASAK
- Fonksiyonel component — class component YASAK
- Her component: `ComponentName/index.tsx` + `styles.ts` (ayrı klasör)
- `StyleSheet.create` zorunlu — inline style YASAK
- `Theme.xxx` kullan — `Radius`, `Spacing`, `Typography`, `Shadows` **@deprecated**
- Tüm metinler i18n üzerinden: `t('key')` — hardcoded string YASAK
- `console.log` bırakma — `utils/logger.ts` kullan
- JSDoc: her fonksiyon ve component üstüne yorum
- Import sırası: React → kütüphaneler → yerel (aralarında boş satır)

## Kritik Import Kuralları
```typescript
import { Colors } from '@/constants/Colors'          // Büyük C — küçük c crash!
import { Theme } from '@/constants/theme'
import * as watchlist from 'services/watchlist'       // watchlistService.ts DEĞİL
import { encodeVector } from 'services/vectorEncoder' // Tek kaynak — başka yerde YASAK
// expo-localization doğrudan import YASAK → LanguageContext kullan
```

## Mimari Kurallar
- `app/(tabs)/index.tsx` = Home dashboard (GreetingWidget + ArchetypeCard + LastFilmCard + QuickNavGrid)
- `app/discover.tsx` = Film swipe feed STACK screen (tab değil — mood → browse movies veya home → discover ile açılır)
- AI/Mood Result AYRI SAYFA DEĞİL — `mood.tsx` içinde conditional render
- Provider zinciri: GestureHandlerRootView → SafeAreaProvider → LanguageProvider → MoodProvider → ThemeProvider → Stack
- Vector kodlama: sadece `services/vectorEncoder.ts` (384 boyut)
- Her ekranda `paddingBottom: 83` — tab bar floating pill (bottom:10 + height:64 + 9px buffer)
- Supabase auth: `signInAnonymously()` root layout'ta; `user_id` her zaman `users` tablosundan al

## Aktif Sorunlar (Çözülmemiş)
| Sorun | Durum |
|-------|-------|
| `match_films` overload çakışması | ⚠️ Kontrol gerekebilir — yeni overload oluşturma |
| Pre-existing TS hataları | ⚠️ `scripts/`, `supabase/functions/`, `ExternalLink.tsx`, `SkeletonLoader`, `watchlist.tsx:122,144` — dokunma |

## Mevcut Durum (2026-04-07)
- MVP core flow calisiyor: mood > AI > swipe > watchlist
- P0 ✅ P1 ✅ P2 ✅ P3 ✅ (tum P3 tamamlandi)
- **Flick Mascot (Rive): KALDIRILDI** — components/Flick/ silindi, rive-react-native + three + expo-gl uninstall edildi
- **Lumi component: KORUNDU** — programatik animasyon orb, calisiyor, 6 yerde kullaniliyor
- **Curated Collections: KALDIRILDI** — mood.tsx'ten temizlendi
- **Mood History: KALDIRILDI** — mood.tsx'ten temizlendi
- **Profile ekrani: STABLE** — P3.4 fix tamamlandi, minimum calisir versiyon aktif
- P4.1 ✅ P4.2 ✅ P4.3 ✅ (P4 tamamlandı)
- P5.1 ✅ P5.2 ✅ P5.3 ✅ P5.4 ✅ (P5 tamamlandı)
- **P6 ✅ TAMAMLANDI** — FilmShareCard + MoodShareCard + useShareCapture; film detay + mood result + watchlist entegre
- **Share paketler:** react-native-view-shot@4.0.3 + expo-sharing~55.0.14 kurulu, app.json'da plugin
- **⚠️ Share native rebuild:** Paylaşım özelliği için `expo run:ios` / `expo run:android` yeniden build gerekli
- **P7 ✅ TAMAMLANDI** — Home Screen Redesign: GreetingWidget + MoodCTA + DailyPickSection + LastSessionCard; MoodContext genişletildi
- **P8.1 ✅ TAMAMLANDI** — Taste Calibration: 6 soru + ArchetypeReveal + phase sistemi (onboarding.tsx); 38 i18n key EN+TR
- **P8.2 ✅ TAMAMLANDI** — Calibration → Recommendation Integration: `initUserPreferenceFromCalibration` + cold-start feed + auth_id bug fix
- **Home Screen ✅ TAMAMLANDI** — `index.tsx` → dashboard; `discover.tsx` → stack screen; ArchetypeCard + LastFilmCard + QuickNavGrid; homeService.ts
- **P10 UX Polish ✅ TAMAMLANDI** — 10 görev: no-scroll home, auth gating, swipe 30-limit, swipe overlap fix, toast cleanup, logo/Lumi kaldırma, 2×2 watchlist grid, Google link btn
- **Auth gating:** `gate.tsx` anonim kullanıcıları `/auth`'a yönlendiriyor — Apple/Google giriş zorunlu
- **SwipeableCard:** `bottomOffset` prop eklendi — discover.tsx `insets.bottom + 80` geçiyor
- **Google Sign-In:** Hala stub (native rebuild gerekli) — profile + auth ekranında UI hazır
- **P9 Session 1 ✅** — Payment altyapısı: RevenueCat SDK (`react-native-purchases`), `purchaseService.ts`, `quotaEngine.ts`, `subscriptionService.ts`, `SubscriptionContext.tsx`, `subscriptionPlans.ts`, Supabase migration 012, auth gating aktif, i18n quota/paywall key'leri (EN+TR)
- **Auth gating AKTIF:** `gate.tsx` anonim kullanıcıları `/auth`'a yönlendiriyor — Apple/Google giriş zorunlu, misafir devam kaldırıldı
- **Provider zinciri:** GestureHandlerRootView → SafeAreaProvider → LanguageProvider → MoodProvider → SubscriptionProvider → ThemeProvider → Stack
- **Kota kuralları:** Free=1/gün, Weekly=2/gün (trial 20 ilk 10 gün, sonra 14/hafta), Monthly/Yearly=3/gün+21/hafta
- **P9 Session 2 ✅** — Quota entegrasyonu: mood.tsx checkQuota + recordSearch, QuotaIndicator (badge), QuotaExhausted (modal overlay), paywall.tsx (tam UI: 3 plan kart + purchase + restore + trial kontrol)
- **P9 Session 3 ✅** — Profile subscription badge (premium/free), Settings modal "Manage Subscription", B hibrit paywall, i18n key'leri
- **P9 Session 4 ✅** — RC identifyUser auth.tsx'te, RC customerInfo listener (expire/renew/cancel), discover session sonu free paywall nudge, offline graceful fallback
- **P9 KOD TAMAM** — Kalan: RevenueCat Dashboard setup + Supabase migration deploy + .env RC key + native rebuild
- **Onboarding Revamp ✅** — feedback2 planı uygulandı: arketip-specific film posters (12×3), "Today's Pick arketibine göre" hint, welcome hook güçlendirme, expo-store-review (App Store review arketip reveal sonrası — dopamin zirvesi). Scoring engine test: 6/6 ✓. Native rebuild gerekli (expo-store-review).

---

## Referans Dokümantasyonu
| Konu | Dosya |
|------|-------|
| Teknik mimari, klasör yapısı, data flow, DB schema | `ARCHITECTURE.md` |
| Tasarım sistemi, renkler, tipografi, component spec | `DESIGN_SYSTEM.md` |
| Sprint planı, P0-P3 görev listesi, CDO bağımlılıkları | `ROADMAP.md` |
| Tamamlanmış task'lar, redesign değişiklikleri | `docs/CHANGELOG.md` |
| Sprint durumu, session notları, blocker'lar | `docs/SESSION_LOG.md` |
| Tasarım görselleri (9 ekran, piksel referans) | `design-reference/` |
