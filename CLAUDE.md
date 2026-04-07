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
- `discover.tsx` YOKTUR — film kartları `app/(tabs)/index.tsx`'te
- AI/Mood Result AYRI SAYFA DEĞİL — `mood.tsx` içinde conditional render
- Provider zinciri: GestureHandlerRootView → SafeAreaProvider → LanguageProvider → MoodProvider → ThemeProvider → Stack
- Vector kodlama: sadece `services/vectorEncoder.ts` (384 boyut)
- Her ekranda `paddingBottom: 83` — tab bar absolute
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
- Sonraki: P7 (Onboarding) veya P8 (Payment)

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
