# MoodFlix — Design System

## Philosophy
Bumble's addictive swipe UX + cinema-grade premium aesthetics. Think: a luxury movie theater in your pocket, not a dating app.

Oyun ekranları bunun üstüne ayrı bir kimlik katmanı bindirir — bkz. **"Festival Layer — Games"**.

> **Kaynak:** Bu dosya `constants/Colors.ts` ve `constants/theme.ts`'i tarif eder, onların
> yerine geçmez. Çelişki varsa kod doğrudur ve bu dosya düzeltilir.

## Color Palette

Yön: **"Cinematic Dark"** — sıcak derin zemin + sinematik amber vurgu (v4, 2026-06-23).
Eski violet/zinc paleti terk edildi.

### Core — Backgrounds (Warm Deep)
| Token | Hex | Usage |
|-------|-----|-------|
| `background` / `bgPrimary` | #0A0A0F | App background |
| `bgCard` | #12121A | Card surfaces |
| `bgElevated` | #1A1A24 | Modals, sheets, elevated UI |
| `bgSubtle` | #22222E | Dividers, inactive elements |

### Accent — Dual System
| Token | Hex | Usage |
|-------|-----|-------|
| `accentPrimary` | #E8A838 | Primary CTA, active tabs, main interactions (cinematic amber) |
| `accentHover` | #C48820 | Pressed states |
| `accentDim` | rgba(232,168,56,0.15) | Muted amber fill — chips, icon wells |
| `gold` | #D4A843 | Ratings, premium badges, prestige |
| `goldDark` | #B8922E | Gold pressed state |
| `goldLight` / `goldMid` / `goldDim` | — | Decorative gold scale |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `swipeRight` | #34D399 | Watchlist add (green) |
| `swipeLeft` | #EF4444 | Skip (red) |
| `swipeDown` | #3B82F6 | Watched/seen (blue) |
| `success` | #34D399 | Confirmations |
| `warning` | #FBBF24 | Alerts |
| `error` | #EF4444 | Errors |
| `info` | #60A5FA | Informational highlights |

### Text (Warm Scale)
| Token | Hex | Usage |
|-------|-----|-------|
| `textPrimary` / `textWhite` | #F0F0F5 | Headings, main content (soft off-white) |
| `textSecondary` / `textGrey` | #8888A0 | Meta info, subtitles |
| `textTertiary` / `textLightGrey` | #55556A | Timestamps, hints, eyebrow |
| `textOnAccent` | #0A0A0F | Text on amber buttons (dark for contrast) |

## Typography

Ölçek `Theme.typography` içinde tanımlı. Font: sistem fontu (iOS System / Android sans-serif)
+ PlayfairDisplay (6 ağırlık).

| Token | Font | Size/LH | Weight | Usage |
|-------|------|---------|--------|-------|
| `display` | PlayfairDisplay Bold | 32/38 | 700 | Hero text, archetype reveal |
| `h1` | System | 24/30 | 700 | Screen titles |
| `h2` | System | 22/28 | 600 | Section headers |
| `h3` | System | 17/22 | 600 | Card titles, film names |
| `body` | System | 15/22 | 400 | Main content |
| `caption` | System | 13/18 | 400 | Meta info, timestamps |
| `micro` | System | 11/14 | 500 | Badges, chips, tags |
| `tabLabel` | System | 11 | 700 | Active tab label |
| `rating` | PlayfairDisplay Bold | 16 | 700 | Film scores (gold) |

**Rule (v3 — 2026-07-29):** Sistem fontu, kullanıcının *üzerine bastığı* her şeyin fontudur:
buton, etiket, input, sayaç, meta. PlayfairDisplay **otoritenin sesidir** — ekranın "yayın"
öğeleri: film adı, dava başlığı, oyun adı, tema adı, logline/alıntı gövdesi, sonuç anı.
Butonda, chip'te veya form etiketinde serif hâlâ **yasak**.

## Spacing & Radius
| Token | Value |
|-------|-------|
| spacing-xs | 4px |
| spacing-sm | 8px |
| spacing-md | 16px |
| spacing-lg | 24px |
| spacing-xl | 32px |
| spacing-xxl | 48px |
| radius-xs | 4px |
| radius-sm | 8px |
| radius-md | 12px |
| radius-lg | 16px |
| radius-xl | 24px |
| radius-xxl | 28px |
| radius-full | 9999px |

> Deprecated `Radius` objesi (`card:16, button:14, tag:20, chip:10, input:16, avatar:40`)
> skala dışı değerler taşır. Geriye dönük uyumluluk için duruyor — **yeni kodda kullanılmaz**,
> `Theme.borderRadius` kullanılır.

## Concentric Geometri

Apple 2026 "Harmony" prensibi: iç içe geçmiş yüzeylerin köşeleri **eş merkezli** görünmeli.

```
iç radius = dış radius − padding
```

Kod karşılığı: `Theme.concentric(outer, padding)` (`constants/theme.ts`).
Bağlayıcı olan yukarıdaki radius merdiveni değil, **bu kuraldır** — merdiven yalnız
başlangıç değerlerini verir.

| Dış container | Padding | Doğru iç radius | Yanlış |
|---|---|---|---|
| 16 (`lg`) | 8 (`sm`) | 8 (`sm`) | 12 — köşeler kaçık görünür |
| 24 (`xl`) | 8 (`sm`) | 16 (`lg`) | 8 — iç eleman "yuvarlanmamış" durur |
| 12 (`md`) | 1 (hairline) | 11 | 12 — kenarlık köşede kalınlaşır |

Son satır cam yüzeylerin standart durumudur: dış node radius + 1px kenarlık taşır,
iç node `overflow:'hidden'` ile `outer − borderWidth` radius alır.

## Tracking (letter-spacing)

iOS tipografisi boyuta göre **negatif tracking** uygular; sabit 0 bırakmak "Apple hissi"nin
kaybolmasının en sık sebebidir. Yaklaşık formül: `ls ≈ −size × 0.025`.

| Token | Size | letterSpacing |
|-------|------|---------------|
| `display` | 32 | −0.5 |
| `h1` | 24 | −0.3 |
| `h2` | 22 | −0.3 |
| `h3` | 17 | −0.4 |
| `body` | 15 | −0.2 |
| `caption` | 13 | −0.1 |
| `micro` | 11 | +0.3 *(küçük punto açılır, sıkışmaz)* |
| `eyebrow` | 11 | +1.6 *(uppercase mikro etiket — kasıtlı geniş)* |
| `stat` | 28 | −0.5 |

**Kural:** 11pt altı ve uppercase metin **pozitif** tracking alır; 13pt üstü sentence-case
metin **negatif**. İkisini karıştırma.

## Motion

- **Spring varsayılandır**, sabit ease-in-out değil. Damping oranı ~0.8–0.9.
  Config'ler `constants/animations.ts` içinde; ekranda ham sayı yazılmaz.
- `PRESS_SPRING` — dokunma geri bildirimi (tuş, çip, buton).
- `REVEAL_SPRING` — içerik açılışı (hücre flip, harf açılışı).
- Festival Layer Kural 6 ("ekran başına en fazla bir anlamlı animasyon") **yürürlükte kalır**.
  Spring'e geçmek animasyon *sayısını* değil, mevcut tek animasyonun *kalitesini* değiştirir.
  Geri kalan her şey 200–300ms fade/translate.

## Renk = Etkileşim Sinyali

Bir elemanın renkli olması "buna dokunabilirsin" demektir. Renk dekoratif olarak yayılırsa
bu sinyal ölür.

- `accentPrimary` yalnız etkileşimli elemanda: CTA, aktif tab, seçili durum.
- Archetype rengi (`constants/archetypes.ts` → `colorPrimary`) **accent'tir, tema değildir**.
  Kenarlık / tek ikon / metin / düşük alfa gradyan durağı olarak kullanılır; ekran zemini
  her zaman `Colors.background` kalır. Mevcut kullanım (ArchetypeReveal, PersonaBadge,
  DailyMatchCard, ArchetypeShareCard) bu kurala **zaten uyuyor** — referans olarak korunur.
- Semantik renk (`success`/`error`) yalnız geri bildirim anında ve yalnız
  metin/ikon/kenarlık olarak. Kart yüzeyi asla semantik renge boyanmaz (Kural 1).

---

# Festival Layer — Games

Oyun ekranlarının kimlik katmanı. Kaynak: `docs/referans/` mockup'ları (2026-07-29).

## Direktif

> Design Chosy Games as if it were the official companion app of an elite international film
> festival. Every screen should feel curated, intellectual and premium. Avoid playful mobile
> game aesthetics. Use the visual language of Cannes Film Festival, Criterion Collection,
> Letterboxd and modern luxury editorial design. Users should feel like cinephiles building
> cultural prestige, not players collecting points. XP, levels and progression must exist,
> but always be presented as mastery, reputation and cinematic expertise rather than gaming rewards.

Tek cümlelik ölçüt: **kullanıcı Wordle oynayan biri gibi değil, Cannes'da jüri üyesi gibi hissetmeli.**

## 6 Kural

1. **Oynanış oyunun temasıdır, ödül Chosy'nin altınıdır.** *(1 Ağu 2026'da yeniden yazıldı —
   aşağıya bkz.)*

   Her oyunun bir accent rengi vardır; tek kaynak `constants/gameThemes.ts`. Ekran içinde
   ham renk yazılmaz, `useGameTheme()` okunur. Accent yalnız **oynanış** katmanında yaşar:
   ambiyans, progress, seçim, kart kenarı, aksiyon butonu.

   **Ödül/prestij katmanı altın kalır** — XP, rank, streak, `ResultCard`, `GameShareCard`.
   Chosy kimliği bu sabitle taşınır; altı oyun ayrışırken uygulama tek bir uygulama kalır.

   Semantik renk (`success`/`error`) ve **oyun mekaniğinin dili** temadan bağımsızdır:
   CineMetrics'in yeşil/altın/gri geri bildirimi, Detective'in doğru/yanlış işaretleri
   accent değişse de değişmez. Kart yüzeyi asla semantik renge boyanmaz.

   > **Neden değişti.** Bu kural 29 Tem 2026'da "Tek altın — oyun başına ayrı vurgu rengi
   > YOK, *reddedilen yön: mor Spotlight, kırmızı Imposter, teal CineMetrics*" diyordu.
   > Imposter'da denenen oyuna-özel dil cihazda test edildi ve tek altın doktrininin
   > gerçek kullanımda altı oyunu birbirinden ayırmadığı, kimliği güçlendirmek yerine
   > düzleştirdiği görüldü. Karar tersine çevrildi; kimlik sabiti renk yerine **katman**
   > oldu (ödül = altın). Tarihçe: `.claude/apple-design-standard-2026.md` §6.4.
2. **Serif = otorite.** Ekranın "yayın" öğeleri serif: oyun adı, dava başlığı, tema adı,
   logline/alıntı gövdesi, film adı, sonuç anı. Buton/etiket/sayaç sistem fontu kalır.
3. **Eyebrow sistemi.** Her bölümün üstünde `Theme.typography.eyebrow` mikro etiket —
   11px, `letterSpacing: 1.6`, uppercase, `textTertiary`.
   Örnek: `TODAY'S THEME`, `CLUE 01`, `ACTIVE CLUES`, `YOUR CINEMA IDENTITY`, `HINT CREDITS`.
4. **Afiş büyür.** Poster/still ekranın kahramanıdır. Detective şüpheli grid'i 3 sütun ve
   tam kanamalı; Spotlight/FadeIn görseli ekran yüksekliğinin ≥%45'i.
5. **Kenarlık, gölge değil.** Pasif kart = düz `bgCard` + 1px hairline.
   `Theme.shadow.goldGlow` yalnız zafer anında, tek seferlik.

   **Cam sınırı yüzey tipine göre değil ETKİLEŞİME göre çizilir** *(1 Ağu 2026)*.
   Chrome zaten cam. İçerik katmanında ise ayrım şu:

   > **İnteraktif** = dokunulduğunda oyun state'ini değiştiren veya seçim yapan element.
   > **Pasif** = salt görüntüleme.
   >
   > Üç soru — **üçüne birden "evet"** gerekir. Biri bile "hayır" ise yüzey düz kalır:
   > 1. Elementin **kendisi** `onPress`/`Pressable` taşıyor mu? *(ebeveyninin taşıması sayılmaz)*
   > 2. Dokunmak **görünür bir state** değiştiriyor mu — seçim, açılma, eleme?
   > 3. Aynı ekranda **seçili / seçili değil** ayrımı var mı?
   >
   > **Geçen:** Imposter aktör kartı · Detective şüpheli ızgarası · Spotlight klavye tuşu.
   > **Geçmeyen:** poster · still · `ResultCard` · tahmin geçmişi kartı · liste satırı ·
   > "tamamlandı" mührü.
   >
   > **Kritik kenar durum:** navigasyon amaçlı `onPress` (karta bas → detaya git)
   > 1'i geçer ama **2 ve 3'ü geçmez** — cam almaz. Bu boşluk kapatılmazsa "bu kart da
   > aslında biraz interaktif sayılır" diye cam her yere sızar.

   Ayrıntı ve gerekçe: "Cam Katmanı" bölümü + `.claude/apple-design-standard-2026.md` §6.2.
6. **Az hareket.** Ekran başına en fazla **bir** anlamlı animasyon (perde açılışı, eleme solması,
   harf açılışı). Geri kalan her şey 200–300ms fade/translate.

7. **Oynanış tek sayfadır — `ScrollView` YASAK.** *(1 Ağu 2026)*

   Oyun ekranı açıldığında oynamak için gereken her şey görünür olmalı. Kaydırmak
   "ne kaçırıyorum?" sorusu doğurur ve günlük oyunun "aç-oyna-çık" ritmini keser.

   **Referans uygulama: Imposter.** `onLayout` ile kullanılabilir yükseklik bir kez
   ölçülür, öğe boyutları kalan alandan pay biçilerek hesaplanır. Ortak mekanizma:
   `hooks/useGameFit.ts`. Ekranlar kendi ölçüm matematiğini kopyalamaz.

   **Kapsam:** yalnız **oynanış**. Sonuç ekranları (`ResultCard`, `QuickResult`)
   `ScrollView`'de kalır — poster + DNA reveal + keşif hunisi + butonlar sığmıyor
   ve scroll oraya zaten bir kırpılma hatasını düzeltmek için eklenmişti.
   `FilmSearchInput`'un arama sonuçları da kapsam dışı: o bir liste, ekran değil.

   **Sığmazsa ne olur — sessiz kırpma YASAK.** Ekran, belgelenmiş bir yoğunluk
   tabanına iner: daha az geçmiş satırı, küçülen poster, gizlenen ikincil meta.
   Taban, desteklenen en küçük cihazda (iPhone SE, 667pt) okunur kalacak şekilde
   seçilir ve kodda yorumla gerekçelendirilir. İçerik ekran dışında bırakılmaz.

   > **Cam üzerindeki sonucu.** Yüzen cam chrome'un gerekçesi "altından içerik
   > akıyor"du. Oynanış artık kaymadığına göre orada cam dekorasyona düşer ve
   > Kural 5'in derinlik testini geçmez — oynanış **yığılmış** chrome kullanır
   > (`GameShell` varsayılanı). `floatingHeader` **sonuç** ekranlarına taşındı:
   > orası hâlâ kayıyor, yani cam orada doğru.

## Cam Katmanı (chrome)

> Karar: 1 Ağu 2026. Tam gerekçe ve ImposterPilot verdict'i:
> `.claude/apple-design-standard-2026.md` §6.

Cam **fonksiyonel bir katmandır, dekorasyon değil.** Kontroller içeriğin üstünde yüzer ve
görsel olarak geri çekilir; içerik her zaman öncelikli kalır.

| Katman | Cam | Örnekler |
|--------|-----|----------|
| **Chrome** — kontrol/navigasyon | ✅ | `GameShell` header (yalnız **sonuç** ekranlarında yüzer), yüzen rozetler (`attemptsBadge`) |
| **İnteraktif içerik** — Kural 5'in üç sorusunu geçen | ✅ | Imposter aktör kartı, Detective şüpheli ızgarası, Spotlight klavye tuşu |
| **Pasif içerik** | ❌ | `ResultCard`, tahmin geçmişi kartları/çipleri, still/poster, mask row, film listeleri |

> **Tab bar istisnası (C.9a-2, 17 Ağu 2026, K-04):** Tab bar artık `expo-router/unstable-native-tabs`
> ile native — `GlassSurface`/`BlurView` tabanlı custom cam taklidinden çıktı. Pill şekli, custom
> shadow, Reanimated bounce ve dot indicator bilinçli olarak bırakıldı; native API bunları expose
> etmiyor. Sistemin kendi Liquid Glass davranışı kullanılıyor (K-04: "custom glass taklidi yok").

Pasif içerik yüzeyi = düz `bgCard` + 1px hairline.

**İki sağlama, ikisi de geçilmeli:**

1. **Etkileşim testi** — Kural 5'in üç sorusu. Element gerçekten kontrol mü?
2. **Derinlik testi** — *bu yüzeyin altında gerçekten kayan/duran bir içerik var mı?*
   Hayırsa cam anlamsızdır: bulanıklaştıracak bir şey yoktur, düz yüzey kullanılır.
   Cam, arkasında bir şey olduğu için vardır.

### Token ve component

| Token (`constants/Colors.ts`) | Değer | Usage |
|---|---|---|
| `chromeGlassSurface` | rgba(255,255,255,0.06) | BlurView üstüne binen ince beyaz yıkama — camın kalınlığı |
| `chromeGlassBorder` | rgba(255,255,255,0.16) | Cam kenarı — üstten gelen ışığın yakaladığı hat |
| `chromeGlassFallback` | rgba(18,18,26,0.92) | BlurView yokken düşülen opak zemin (`bgCard` tabanlı) |

- Tek kaynak: **`components/games/GlassSurface/`**. Kopyalanmaz, genişletilir
  (`FilmSearchInput` konvansiyonu).
- İki node zorunlu: dış node radius + 1px `chromeGlassBorder` + gölge; iç node
  `overflow:'hidden'` + `chromeGlassSurface`, radius'u `Theme.concentric(dış, 1)`.
- Fallback **prop ile açıkça kontrol edilir, sessizce gerçekleşmez** —
  CLAUDE.md Oyun Sistemi Hard Rule 5 ("silent fallback yasak").
- **Camın kendisi nötr kalır** — beyaz yıkama + beyaz kenar, oyuna göre değişmez.
  Renk camdan değil, üstüne binen tema katmanından gelir: seçili interaktif kart
  `theme.accent` kenar + `theme.accentGlow` hale alır, cam yüzeyi aynı kalır.
  Böylece altı oyunda cam aynı materyal, tema aynı materyalin üstündeki ışık olur.

## Oyun Temaları

> Karar: 1 Ağu 2026. Kural 1'in yeni hâli. Tek kaynak: `constants/gameThemes.ts`.

**Tek cümle:** *oynanış oyunun temasıdır, ödül Chosy'nin altınıdır.*

### Palet — tür kodlu

Her rengin gerekçesi oyunun sinema türünden gelir, keyfi atanmaz.

| Oyun | Accent | Gerekçe |
|------|--------|---------|
| Detective | `#0D9488` petrol | noir, sorgulama |
| Imposter | `#22D3EE` camgöbeği | mevcut dilinden geldi, değişmedi |
| Spotlight | `#E8A838` amber | projektör ışığı — base'in kendisi |
| FadeIn | `#FB7185` gül | karanlık oda kırmızısı |
| Logline | `#8B5CF6` mor | senaryo, edebiyat |
| CineMetrics | `#6366F1` indigo | veri/analiz |
| Quoted | — | `DEFAULT_GAME_THEME` (altın/base) |

**CineMetrics neden zümrüt değil indigo:** aynı ekranda `greenBright #22C55E` "doğru bilgi"
geri bildirim sinyali. İki yeşil yan yana accent'i mekanik sinyalle karıştırırdı; renk
körlüğü açısından da yeşil/yeşil ayrımı riskliydi.

**Spotlight neden base rengiyle "temasız" görünmüyor:** accent amber ama ambiyans
geometrisi farklı — diğerleri iki köşeye yerleşmiş küre gradyanı (`orbs`) kullanırken
Spotlight yanal projektör huzmesi (`beam`) kullanır. Ayrışma renkten değil ışıktan gelir,
metafor da korunur.

### Katman ayrımı — neyin rengi tema, neyin rengi altın

| Katman | Renk | Kapsam |
|--------|------|--------|
| **Oynanış** | `theme.accent` | Ambiyans, progress, seçim, kart kenarı, aksiyon butonu, `FilmSearchInput`, `GameStateView`, `HintBoard` |
| **Ödül / prestij** | `gold` | XP, rank, streak, `ResultCard`, `QuickResult`, `DnaXpReveal`, `GameShareCard`, `ConfidenceSelector`, `WhyThisMovie`, `PlayNextBridge` |
| **Mekanik sinyal** | sabit semantik | CineMetrics yeşil/altın/gri, Detective doğru/yanlış — temadan **bağımsız** |

> `ConfidenceSelector`, `WhyThisMovie` ve `PlayNextBridge` oynanış ekranında da görünür
> ama **ödül katmanında da** kullanılıyorlar (`ResultCard` / `QuickResult` içinden).
> Temaya bağlanmaları tema'yı ödül katmanına sızdırırdı — bu yüzden altında kalırlar.

### Şema ve kullanım

```ts
// constants/gameThemes.ts
interface GameTheme {
  accent, accentDim, accentGlow           // vurgu üçlüsü
  ambientBase: [string, string, string]   // dikey gece gradyanı
  ambientGlowA, ambientGlowB              // parıltı → şeffaf
  ambientVariant: 'orbs' | 'beam'
  progressGradient: [string, string]
}
```

- Ekran içinde ham renk **yazılmaz**: `const theme = useGameTheme()`.
- `GameShell` `gameType` prop'undan temayı çözer, `GameBackdrop`'u kendisi render eder —
  oyun ekranı ambiyanstan haberdar değildir.
- Provider dışında `useGameTheme()` çağrılırsa `DEFAULT_GAME_THEME` döner **ve**
  `__DEV__` altında `logger.warn` atar. Sessiz `undefined` tema render edilmez
  (CLAUDE.md Hard Rule 5).

## Ekran Anatomisi

```
eyebrow  →  serif başlık  →  kahraman görsel  →  aksiyon  →  meta
```

Meta (streak, XP, ipucu sayacı) ekranın ortasından çıkar, alt bara iner.

## Token Ekleri

### Renk (`constants/Colors.ts`)
| Token | Değer | Usage |
|-------|-------|-------|
| `goldHairline` | rgba(212,168,67,0.22) | Kart kenarlığı — festival katmanının imzası |
| `goldSeal` | rgba(212,168,67,0.10) | "Tamamlandı" mührü zemini |
| `scrim` | rgba(10,10,15,0.72) | Afiş/backdrop üstü metin okunurluğu |

### Tipografi (`Theme.typography`)
| Token | Font | Size/LH | Usage |
|-------|------|---------|-------|
| `eyebrow` | System 600 | 11/14, ls 1.6, uppercase | Bölüm üstü mikro etiket |
| `serifTitle` | PlayfairDisplay Bold | 26/32 | Oyun adı, dava başlığı |
| `serifHero` | PlayfairDisplay Black | 34/40 | Tema adı, sonuç anı, film adı |
| `serifQuote` | PlayfairDisplay Italic | 22/32 | Logline ve alıntı gövdesi |
| `stat` | System 700, tabular | 28/32 | Skor, DNA, level sayıları |

## GameShell (ortak kabuk)

`components/games/GameShell/` — tüm oyunlar bunun içinde yaşar.

- **Header:** geri oku (44×44) · ortada [eyebrow + serif 20/26 başlık] · sağ slot (44×44).
  Sağ slot boş olsa bile yer tutar — başlık optik olarak ortalı kalsın diye.
- **Progress:** nokta değil **altın segment çubuğu**. `maxAttempts` kadar `flex:1` segment,
  3px yükseklik, 4px aralık. Harcanan `gold`, kalan `white05`.
  `accessibilityRole="progressbar"` + `games.common.progress_label`.
- **Content:** `paddingHorizontal: spacing.md`, `paddingBottom: 83` (tab bar clearance).
- Props genişletilebilir, daraltılamaz: `title`, `subtitle?`, `headerRight?`,
  `currentAttempt`, `maxAttempts`, `hideProgress?`.

## Kod Kuralları (oyun ekranları)

- Yalnız Phosphor **duotone**; Ionicons aynı ekranda karışmaz.
- `index.tsx` + `styles.ts` ayrımı zorunlu — inline `StyleSheet` bırakılmaz.
- Tüm metin `t()` üzerinden; eyebrow metinleri de çeviri anahtarıdır.
- i18n interpolasyonu **`%{name}`** sözdizimiyle (i18n-js) — `{{name}}` çalışmaz.
- Yeni telemetri event'i uydurulmaz; önce `.claude/game-system-brief.md`'ye eklenir.

---

## Component Specs

### SwipeCard (Target)
- Full-bleed poster, 3:4 aspect ratio, fills ~85% of screen height
- Bottom 40% gradient: transparent → bg-primary
- Film title: bottom-left, H2 white, bold
- Meta line: year · genre · duration in text-secondary
- Stack: 2 cards behind, scale(0.95) + scale(0.90), blur(2px)
- Swipe overlays: green "+" / red "✕" / blue "👁" at 0→0.3 opacity
- Match score badge: bottom-right corner

### Action Buttons (Below Card)
- 3 circular buttons in a row, centered
- Skip: ✕ icon, red border, 48px diameter
- Surprise: ★ icon, accentPrimary filled, 56px diameter (larger = emphasis)
- Watchlist: ♡ icon, green border, 48px diameter
- Press: scale(0.9) + haptic light

### Bottom Tab Bar
- 4 tabs: Home / Search / Watchlist / Profile
- Active: accentPrimary (#E8A838) icon (filled variant) + label (11px bold)
- Inactive: tabInactive (#55556A) icon (outline variant), no label
- Tab height: 83px, position: absolute
- Transition: outline→filled icon morph, 200ms ease

### Film Detail (Bottom Sheet)
- Drag handle at top (bgSubtle, 40x4px, radius-full)
- 80% screen height, bg-elevated background
- Poster: blurred background + sharp thumbnail
- Title: PlayfairDisplay Bold (Display style)
- Rating: PlayfairDisplay Bold, gold colored

### Empty States
- Lumi orb or illustration centered
- Message below in text-secondary
- CTA button in accent-primary

## Mascot / Animated Element
- **Flick (Rive): IPTAL EDILDI** — kaldirildI, dependency'ler uninstall edildi
- **Lumi:** Programatik animasyon orb, mood ekraninda aktif, korunuyor

## Gamification UI
- Implemented and live in V1.0
- **StreakBadge:** Pill badge, Feed sag ust, Colors.accentPrimary border, pulse on increment
- **MilestoneCelebration:** Full-screen overlay, konfeti + Flick 120px + staggered content
- **StreakCard:** Profile ekrani, 3-stat row + 14-gun dot takvim + progress bar
- Konfeti renkleri: Colors.accentPrimary + Colors.gold + Colors.success
- Kutlama kapatma: sadece manuel (CTA veya backdrop tap)
- Special milestones (films_100+, streak_30): extra confetti + FilmSeridi

## Stats Charts
- Implemented in V1.0 (DiscoveryStats component)
- **MoodPatternChart:** Horizontal bar timeline, son 14 gun, baskil duygu rengiyle
  - Duygu renkleri TasteDNA'daki EMOTION_COLORS ile ayni (import et)
  - Staggered bar animasyonu (50ms * index)
- **GenreDonutChart:** 180px donut, max 5 dilim + Other, merkez toplam sayi
  - Dilim paleti: accentPrimary → gold → success → info → warning → bgSubtle
  - Saat yonunde cizilme animasyonu (~800ms)
- Her iki chart Profile ekraninda, mevcut section'lar arasina yerlesir

## Home Screen (P7.1)
- Implemented in V1.0
- **GreetingWidget:** Saat bazli selamlama + kullanici adi, Inter Bold 28px
- **MoodCTA:** Tam genislik amber gradient buton, glow pulse (idle), scale(0.97) press
- **DailyPickSection:** DailyMatchCard wrapper, 2.5:4 aspect, "Today's Pick" ust baslik
- **LastSessionCard:** Son mood session ozeti, 3 mini poster + CTA link
- Sadece `!currentProfile` durumunda gorunur — profil secilince swipe feed'e gecis
- Stagger animasyon: 0→400ms FadeInDown, springify

## Social Share Cards
- Implemented in V1.0
- **FilmShareCard:** 360x450px (3x→1080x1350 PNG), poster + title + mood text + branding
  - Poster blur ambient arka plan efekti (blurRadius:25, opacity:0.15)
  - PlayfairDisplay sadece film title + tirnak isareti
- **MoodShareCard:** 360x450px, mood text + AI profil ozeti + dekoratif parcaciklar
  - Gradient bg: bgPrimary → bgCard
  - Gold tirnak isaretleri, uppercase "TODAY I FEEL" etiket
- Offscreen render + react-native-view-shot + expo-sharing

## Taste Calibration (P8.1)
- Implemented in V1.0
- **TasteCalibration:** 6 senaryo-bazli soru karti, FadeOutLeft/FadeInRight gecis, 400ms bekleme
- **QuestionCard:** bgCard kart, 24px radius, 4 secenek (veya 3), secim → accentPrimary border + accentDim bg
- **ProgressBar:** 4px bar (bgSubtle → accentPrimary dolgu), 12px glow dot, animated genislik
- **ArchetypeReveal:** Tam ekran, arketip colorDim gradient bg, 120px emoji dairesi, parcaciklar
  - PlayfairDisplay Bold 32px arketip adi (tek istisna — premium reveal ani)
  - Stagger: bg(0ms) → parcacik(200ms) → emoji(400ms) → ad(700ms) → desc(900ms) → CTA(1200ms)
  - Null fallback: "Mystery Cinephile" + amber tema
- Mevcut 3 intro slide KORUNUR, calibration + reveal SONRASINA eklenir

## Auth Screens QA
- Implemented in V1.0
- auth.tsx + setup-profile.tsx CDO spec'siz build edildi, QA fix spec hazirlandi
- 3 critical (PlayfairDisplay ihlali x2, hardcoded hex), 4 medium, 2 minor
- Yeni token gerekli: `Colors.pink: '#EC4899'`

## Animation Standards
- Swipe card follow: 1:1 with finger, rotation = distance x 0.08 (max +/-12deg)
- Swipe threshold: 120px horizontal, 100px vertical
- Card transition: 0.3s spring
- Tab morph: 200ms ease
- Haptic: light on swipe start, medium on threshold cross, heavy on action complete
- Skeleton shimmer: 1.5s infinite pulse
- Milestone confetti: particle rain + FilmSeridi animation
