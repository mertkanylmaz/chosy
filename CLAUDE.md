# Chosy — Proje Anayasası

Bu dosya KISA tutulur. Bağlama özel bilgi `.claude/skills/` altına taşınır.
Ürün kararları için tek doğruluk kaynağı: `docs/os/1_CHOSY_PRODUCT_OS.md`.

## Ürün (özet)

Chosy günlük bir film ritüelidir: her akşam 4 film, 3 turluk eleme, 1 şampiyon.
Serbest metin girdisi yok — bağlam tahmin edilir ve düzeltilebilir.
Detay: `docs/os/1_CHOSY_PRODUCT_OS.md`.

Bonus oyun olarak yalnızca **Spotlight** aktiftir. Diğer 6 oyun `app_config` ile
dondurulur, kodları silinmez. Yeni oyun eklenmez.

## Yetki sınırı

Claude Code'un **mimari karar yetkisi yoktur**. Yeni tablo, yeni pattern,
yeni bağımlılık, sözleşme değişikliği gerekiyorsa **DUR ve sor**.
Onaysız alınan mimari karar protokol ihlalidir.

## Değişmez kod kuralları

1. Sessiz fallback yasak. Hata Sentry'ye ve/veya kullanıcıya yansımalı.
2. Boş catch bloğu yasak.
3. Migration'lar sadece `supabase db push`. SQL editor migration takibini bozar.
4. Film verisinde DELETE yok — `curation_tier` ile arşivle.
5. Feature flag'ler lazy getter ile okunur. Modül seviyesi sabit yasak.
6. `app_config` değerleri istek başına lazy okunur, modül seviyesinde cache yok.
7. Tüm string'ler `t()` üzerinden. `en.json` + `tr.json` tam parite.
8. `types/gauntlet.ts` KİLİTLİ sözleşmedir. Değişimi CTO onayı ister.
9. Tasarım: token dosyaları tek kaynak. Görseller implementasyon girdisi değil.
10. Görsel retrofit işlerinde oyun/gauntlet **logic'i değişmez**.
11. Spotlight'ta çözüm istemciye inmez — detay: `chosy-conventions` skill'i.

## Kritik import kuralları

```typescript
import { Colors } from '@/constants/Colors'          // Büyük C — küçük c CRASH!
import { Theme } from '@/constants/theme'
import * as watchlist from 'services/watchlist'      // watchlistService.ts DEĞİL
import { encodeVector } from 'services/vectorEncoder' // Tek kaynak — başka yerde YASAK
// expo-localization doğrudan import YASAK → LanguageContext kullan
```

Bunlar tip kontrolünün yakalamadığı runtime hatalarıdır.

## Komutlar

```powershell
npm run test:founder         # kurucu kabul testleri (5 case)
npm run typecheck            # → tam 14 hata, hepsi scripts/ altında
npm run typecheck:functions  # → 32 hata (deno check)
npx expo start               # cihaz testi
supabase db push             # migration deploy
supabase db diff             # değişiklik kontrolü
```

`typecheck` 14'ten fazlaysa veya `scripts/` dışında hata varsa **yeni regresyon
vardır — dur.**

## Ortam

Windows / PowerShell. Komut örnekleri PowerShell sözdiziminde olmalı.

## İş akışı

- Her task yeni `/clear` ile başlar.
- İzin modu her zaman Manual. Bypass yok.
- Doğrulama komutu yeşil gelmeden sonraki adıma geçilmez.
- Maliyet gerektiren işte onay iste.
- Bitince: hangi dosyalar değişti, hangi doğrulama çalıştırıldı, ne çıktı verdi.
- `AskUserQuestion` ile alınan onay geçerli onaydır; raporda hangi soruya hangi
  cevabın verildiği açıkça listelenir.

## Proje yapısı

**`src/` klasörü YOKTUR.** Düz kök yapısı:
`app/` (Expo Router ekranları) · `components/` · `services/` · `constants/` ·
`hooks/` · `contexts/` · `utils/` · `types/` · `locales/` · `supabase/`

OS dokümanları: `docs/os/` (1_PRODUCT · 2_BUSINESS_MODEL · 3_DESIGN · 4_CLAUDE_CODE)

## Sürümler

Expo ~54.0.34 · React Native 0.81.5 · Reanimated ~4.1.1 · expo-router ~6.0.23
**Kurulu DEĞİL:** `@shopify/react-native-skia`, `expo-secure-store`
(yerel depolama için `@react-native-async-storage/async-storage` kullanılır)

## Şema notları

- `films` kolonları: `poster_url` (`poster_path` DEĞİL), `imdb_votes` ve
  `vote_average` (`vote_count` DEĞİL), `director`, `country text[]`,
  `genres text[]`, `runtime`, `curation_tier`, `dimensions_json`
- `profile_vector` → `film_profiles` tablosunda (`films`'te değil)
- İzlenmiş film: ayrı tablo yok — `watchlist.watched_at`
- Oyun temaları: `constants/gameThemes.ts` (`gameTokens.ts` YOKTUR)
- Oyun kabuğu: `GameShell` (`GameScreenShell` YOKTUR)

## Migration numaralandırma

En yüksek mevcut numara **090**. Yeni migration 091'den başlar.
Yine de eklemeden önce `supabase/migrations/` klasörünü listele ve doğrula.
