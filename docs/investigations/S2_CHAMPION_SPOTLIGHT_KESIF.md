# S-2 — Champion layout + Spotlight kartı · ADIM 0 keşif raporu

Tarih: 3 Eki 2026 · Temel: `master @ 6a5e6b9` · Mod: READ-ONLY (yalnız bu dosya yazıldı)

---

## Yönetici özeti

1. **Kart bugün yalnızca ≥ ~902pt pencerede tamamen görünüyor.** Dikey bütçe hesabına
   göre (aşağıda §5) 844/852pt'de kartın %46–54'ü, 812pt'de %16'sı görünüyor, SE'de
   (667pt) hiç görünmüyor. S-1 dwell tetiği (`isCardFullyVisible`) bu cihazlarda
   kullanıcı kaydırmadan **hiç kurulmuyor**.
2. **Brief'teki "Where to Watch" butonu kodda yok.** 26 Eyl'de (TestFlight 2.1.0)
   kaldırıldı; bugünkü birincil eylem koşullu **Watch Now**. Sağlayıcı/link yoksa
   render edilmiyor ve "Sonraya bırak" dolgulu birincil oluyor. "Tek primary"
   kuralının Watch Now yokken ne olacağı CTO kararı (DUR-1).
3. **Spotlight deneme sayısı istemciye ulaşmıyor.** `get-daily-challenge`
   `game_scores.attempts`'ı seçiyor ama response'a koymuyor; Spotlight'ta
   `progress.guesses` hep `[]`. Bu yüzden `attempt_count` ve "kalan hak" kart
   üzerinde mevcut veriyle doğrudan okunamıyor (DUR-2). Yan bulgu: Spotlight ekranı
   app kill sonrası resume'da deneme sayısını 0 gösteriyor (mevcut hata, kapsam dışı).
4. **720ms reveal için bitiş callback'i yok.** `ChampionReveal` yalnız
   `withDelay`+`withTiming` kuruyor; dışarıya "reveal bitti" sinyali vermiyor.
   Spotlight kartına özel bir dissolve/gecikme token'ı da `motion.ts`'te yok (DUR-3).
5. **Gecikmeli giriş dwell ile çakışabilir.** Kart opaklık 0 ile baştan mount
   edilirse `onCardLayout` hemen ateşlenir ve 8 sn sayaç görünmez kart üzerinde
   başlar. S-1 hook'una dokunmadan çözüm: kart sarmalayıcısını giriş anına kadar
   **mount etmemek** (handler'lar aynen kalır). Ayrıntı: §6.

---

## 1. Champion ekranı bileşen ağacı

| # | Konum (dosya:satır) | Öğe | Not |
|---|---|---|---|
| 1 | `components/gauntlet/GauntletShell/index.tsx:262-268` | `TabBarInsetProvider` → `GauntletShellContent` | Alt pay ölçümü kabuğun dışında |
| 2 | `GauntletShell/index.tsx:1737-1757` | `root` → `LightBleed` → `insetLayer` (champion'da dolgusuz, :1750-1752) | |
| 3 | `GauntletShell/index.tsx:1533-1546` | `ScrollView` — `onLayout/onScroll/onTouchStart/onScrollEndDrag/onMomentumScrollEnd` → `championAsk.*` | **KORU** (S-1) |
| 4 | `GauntletShell/index.tsx:1537` | `paddingBottom: tabBarInset + space.lg` | |
| 5 | `GauntletShell/index.tsx:1547-1555` | `ChampionReveal` | `onDismiss` tab'da verilmiyor (`app/(tabs)/index.tsx:25`) → "Kapat" yok |
| 6 | `GauntletShell/index.tsx:1559` | `ArchiveTrigger` | Yalnız `missedCount > 0` ise 30pt ekler (`ArchiveTrigger/index.tsx:89,121-126`) |
| 7 | `GauntletShell/index.tsx:1566-1568` | `<View style={bonusCardInline} onLayout={championAsk.onCardLayout}>` → `SpotlightBonusCard onPress={championAsk.onSpotlightPress}` | **KORU** (S-1) |
| 8 | `GauntletShell/index.tsx:1574-1593` | Bayat gösterge, `AuthPromptSheet`, `NotificationPromptSheet`, `TabBarInsetTelemetry` | ScrollView dışında |

### ChampionReveal iç düzeni (`components/gauntlet/ChampionReveal/index.tsx`)

| Öğe | Satır | Yükseklik kaynağı |
|---|---|---|
| Hero (poster) | :482-525 | `windowHeight × 0.46` (`heroScrim.ts:29`) |
| Body (marginTop −72) | :529 | `TITLE_OVERLAP = 72` (`heroScrim.ts:57`), `gap: space.md` (`styles.ts:63-67`) |
| Kicker + başlık | :530-551 | 16 + 8 + 44/satır (kademe 36/32) |
| Meta | :553-555 | 16 |
| `actionsWrapper` (gap 16) | :558 | `styles.ts:109-113` |
| `WatchProvidersRow` | :564-569 | label 16 + 8 + logo 60 + 8 + atıf 18 = **110** ("See all" varsa +46) |
| Watch Now (`marquee`) | :575-582 | 48 (`size.actionHeight`), **koşullu** (:313) |
| Sonraya bırak | :585-600 | 48; Watch Now yoksa `filled` (:593) |
| Paylaş | :602-609 | 48 |
| Yığın aralığı | `styles.ts:115-118` | `space.sm` = 8 |

İkon seti: ChampionReveal **Phosphor** (`:58`); gauntlet klasöründe Ionicons kullanımı yok
(yalnız `PosterTile/index.tsx:216` yorumunda "Ionicons → Phosphor" geçişi). Yeni ikon satırı
Phosphor ile tutarlı kalır.

## 2. Spotlight kartı ve backdrop erişimi

| Konu | Bulgu | Referans |
|---|---|---|
| Render yeri | Yalnız champion dalı, ScrollView'ın son öğesi | `GauntletShell/index.tsx:1566-1568` |
| Bugünkü görünüm | Mor kenar + "Today's bonus" / "Spotlight", min 44pt, kart ≈ 58pt | `SpotlightBonusCard/index.tsx:50-66`, `styles.ts:20-56` |
| `onPress` | Haptik → `onPress?.()` → `router.push('/games/spotlight')` | `SpotlightBonusCard/index.tsx:44-48` — **KORU** |
| `gameType` prop | **Yok** — kural 8 "zorunlu" diyor | `SpotlightBonusCard/index.tsx:35-38` |
| Analytics | Yok ("YENİ EVENT YOK (M1)") | `SpotlightBonusCard/index.tsx:21-23` |
| Backdrop alanı | `puzzle.puzzle_data.backdrop_url` (`public_daily_puzzles` view'ından) | `types/game.ts:364-371`, `get-daily-challenge/index.ts:84-89,299-307` |
| Client erişimi | Var: `getDailyChallenge('spotlight', YYYY-MM-DD)` | `services/gameApi.ts:138-157` |
| Bulanıklık | **İstemci tarafı** `blurRadius` (expo-image); `MAX_BLUR = 40` modül sabiti, export edilmemiş | `components/games/Spotlight/index.tsx:69,89-92,536-539` |
| `max_attempts` | Response'ta var (`puzzle.max_attempts`); ekran ayrıca `SPOTLIGHT_MAX_ATTEMPTS = 6` sabiti kullanıyor | `get-daily-challenge/index.ts:306`, `Spotlight/index.tsx:63` |

Not: keskin `backdrop_url` istemciye zaten iniyor (oyun ekranı aynı URL'yi bulanıklaştırıyor);
kartın aynı URL'yi `MAX_BLUR` ile göstermesi yeni bir sızıntı yüzeyi açmıyor. Kart paylaşım
görseli değil (Spotlight kuralı 5 etkilenmiyor). `MAX_BLUR`'u kart için tek kaynaktan okumak
export ya da ortak sabite taşıma gerektiriyor — bu Spotlight dosyasında bir değişiklik.

## 3. Spotlight attempt durumu

| Durum | Türetme | Kaynak | App kill'e dayanıklı mı |
|---|---|---|---|
| not_started | `progress === null` (game_scores satırı yok) | `get-daily-challenge/index.ts:134-161`, `utils/askDecision.ts:143-148` | Evet — sunucu |
| in_progress | `progress.completed === false` | aynı | Evet — `game_scores.progress_json` |
| solved | `completed && won` | `get-daily-challenge/index.ts:137-138` (`won = solved`) | Evet |
| failed | `completed && !won` | aynı | Evet |
| **attempt sayısı** | **Response'ta yok.** `attempts` kolonu seçiliyor (:103) ama dönmüyor; Spotlight'ta `progress.guesses` her zaman `[]` (`submit-guess/index.ts:514,699`) | — | — |

- `SpotlightState` tipi bugün **üç değerli** (`not_started | in_progress | completed`,
  `askDecision.ts:26`); solved/failed ayrımı yok. Kart için `won` aynı response'tan okunabilir;
  `askDecision.ts` değişmeden kalabilir (KORU).
- Gün anahtarı iki yerde de YEREL: `askCoordinator` `localDayKey` (`askDecision.ts:151-155`),
  Spotlight ekranı `toLocaleDateString('en-CA')` (`Spotlight/index.tsx:241`). Uyumlu.
- **Yan bulgu (kapsam dışı, ayrı iş):** `Spotlight/index.tsx:262` resume'da
  `setAttempts(progress?.guesses?.length ?? 0)` → Spotlight için daima 0. App kill sonrası
  "kalan hak" 6 görünüyor; sunucu `max_attempts`'ta 409 ile durduruyor (`submit-guess/index.ts:470-472`).

## 4. Reveal zamanlaması ve motion token'ları

| Konu | Bulgu | Referans |
|---|---|---|
| Sekans | blackout 120 + pause 400 → poster; +200 başlık; +200 meta. "720ms" = başlığın başladığı an | `constants/design/motion.ts:38-47`, `ChampionReveal/index.tsx:433-459` |
| Fade süresi | `DISSOLVE_DURATION.newContender` = 360 (reduced: 100) | `motion.ts:22`, `ChampionReveal/index.tsx:440-443` |
| Görsel olarak tamamlanma | meta fade bitişi ≈ 520+400+360 = **1280ms** (mount'tan; poster geç gelirse 1500ms tavana kadar kayar) | `ChampionReveal/index.tsx:135,445-457` |
| **Bitiş callback'i** | **Yok.** Prop listesi: `champion, animateReveal, onDismiss, date, rounds, gauntletId, cycle` | `ChampionReveal/index.tsx:150-177` |
| Resume yolu | `animateReveal: false` → sekans yok, her şey anında görünür | `GauntletShell/index.tsx:499`, `ChampionReveal/index.tsx:429-436` |
| Spotlight kartı için token | Yok. En yakın: `DISSOLVE_DURATION.newContender` (360). "~1–1.5 sn gecikme" için token yok | `motion.ts:16-25` |
| Reduced motion | `useReducedMotion()` Shell'de ve Reveal'da zaten var | `GauntletShell/index.tsx:272`, `ChampionReveal/index.tsx:193` |

## 5. Dwell ölçütü — dikey bütçe

### Formül

`isCardFullyVisible` (`utils/askDecision.ts:168-173`):
`cardY ≥ scrollY` **ve** `cardY + cardHeight ≤ scrollY + viewportHeight − bottomInset`.
`bottomInset = tabBarInset` (`GauntletShell/index.tsx:1385-1388`).

Champion'da `insetLayer` dolgusuz → ScrollView viewport ≈ pencere yüksekliği `H`.
scrollY = 0'da kartın alt kenarı:

```
cardBottom = 0.46·H + C
C = −72 (overlap) + body + archive + 24 (bonusCardInline.marginTop) + cardHeight
Tam görünür ⇔ 0.46·H + C ≤ H − T   ⇔   H ≥ (C + T) / 0.54
```

### Bugünkü C değerleri (kod sabitlerinden hesap, cihazda ölçülmedi)

| Senaryo | body | C |
|---|---|---|
| A — 1 satır başlık, "See all" yok, 3 buton, arşiv yok | 394 | **404** |
| A + arşiv bağlantısı | 394 | 434 |
| B — 2 satır başlık | 438 | 448 |
| C — "See all" var | 440 | 450 |
| D — Watch Now yok (2 buton) | 338 | 348 |

### Cihaz tablosu — senaryo A, bugünkü düzen

`T` = 49pt tab bar + alt güvenli alan (**varsayım**, iOS standart değerleri; bkz. Doğrulanamayanlar).

| Cihaz sınıfı | H (pt) | T | Kart üstü Y | Görünür alt | Görünen pay | Tam görünür? |
|---|---|---|---|---|---|---|
| SE 2/3 | 667 | 49 | 653 | 618 | **%0** | Hayır |
| 12/13 mini | 812 | 83 | 720 | 729 | %16 | Hayır |
| 12–14 / 16e | 844 | 83 | 734 | 761 | %46 | Hayır |
| 15 / 16 | 852 | 83 | 738 | 769 | %54 | Hayır |
| 16 Pro / 17 Pro | 874 | 83 | 748 | 791 | %74 | Hayır |
| Plus / Pro Max | 932 | 83 | 775 | 849 | %100 | **Evet** |
| 16 Pro Max | 956 | 83 | 786 | 873 | %100 | **Evet** |

Tam görünürlük eşiği (A, T=83): **H ≥ 902pt**.

### Önerilen CTA düzeniyle (Watch Now 48 + 8 + ikon satırı 44 = 100; bugün 160 → −60)

Kart görselli olacağı için yüksekliği 72pt varsayıldı (öneri; tasarım kararı).
C' = −72 + 334 + 24 + 72 = **358** → eşik **H ≥ 817pt** (T=83).

| Cihaz | Görünen pay (A') | Tam görünür? | 2 satır başlık (+44) |
|---|---|---|---|
| SE 667 | %35 (peek ≥%30 ✓) | Hayır | %0 |
| mini 812 | %97 | Hayır (2.5pt eksik) | Hayır |
| 844 | %100 | **Evet** | Hayır (H ≥ 899 gerekir) |
| 852 / 874 | %100 | **Evet** | 874: Hayır, 852: Hayır |
| ≥ 932 | %100 | **Evet** | Evet |

Sonuç: CTA sıkıştırması tek başına 844pt+ sınıfında **1 satırlık başlık + See all yok**
durumunda yeterli; 2 satır başlık, "See all", arşiv bağlantısı veya 812pt ve altı cihazlarda
dwell kaydırmasız kurulmuyor. Ek kazanç seçenekleri (hepsi DUR-4 kapsamında):
hero oranı (0.46 → ör. 0.40 = 844'te −51pt; `heroScrim.test.ts` kontrastı yeniden koşar),
`WatchProvidersRow` atıf/etiket satırları, `bonusCardInline.marginTop` (24).

## 6. Dwell + gecikmeli giriş etkileşimi

- `onCardLayout` her layout'ta `evaluateDwell()` çağırır (`useChampionAsk.ts:187-195`);
  zamanlayıcı kart **ölçüldüğü anda** kurulur (`:128-137`).
- Kart opaklık 0 ile baştan render edilirse: 8 sn sayaç görünmez kartta başlar →
  ask, kart görünür olduktan ~6.5–7 sn sonra gelir (dwell "kart görünür" semantiğinden sapar).
- Hook'a dokunmadan çözüm: sarmalayıcı `<View onLayout={championAsk.onCardLayout}>`
  giriş anına kadar **hiç mount edilmez**; mount ile birlikte `onCardLayout` ateşlenir,
  sayaç o an başlar. Sarmalayıcı ve handler bağlantısı birebir korunur.
  Kart içerikte en sonda olduğu için geç mount yukarıdaki içeriği kaydırmaz.
- `cardHeight === 0` iken `isCardFullyVisible` false döner (`askDecision.ts:169`) →
  kart mount olmadan dwell kurulmaz. Doğrulanmış (test: `askDecision.test.ts:176`).
- Kart görünür değilse kullanıcı kaydırınca: `onTouchStart` silahsızlandırır,
  `onScrollEndDrag`/`onMomentumScrollEnd` yeniden kurar (`useChampionAsk.ts:214-222`).
  Yani < eşik cihazlarda dwell yalnız kaydırma sonrasında başlar.

### Dwell kanıtı — mevcut test altyapısı

- Testler Deno, saf modüller (`package.json:12-26`); `useChampionAsk` `react-native` ve
  `expo-router` import ediyor → Deno'da koşamaz. Jest kurulu değil.
- `isCardFullyVisible` için Deno testi var (`tests/gauntlet/askDecision.test.ts:170-177`).
- Mevcut altyapıyla **geometri** (kart layout'u eşik altında tam görünür mü) Deno testiyle
  kanıtlanabilir; **8 sn zamanlayıcının ateşlenmesi** ancak (a) hook'u saf bir zamanlayıcı
  modülüne ayırarak (S-1 dosyasına dokunur — KORU ihlali) ya da (b) `__DEV__` log /
  Sentry breadcrumb ile cihazda kanıtlanabilir (DUR-5).

## 7. Diğer kontroller

| Konu | Bulgu | Referans |
|---|---|---|
| Gauntlet/Home'da Spotlight ipucu | `app/(tabs)` altında "spotlight" geçmiyor; kart yalnız champion dalında | Grep `app/(tabs)` → 0 eşleşme; `GauntletShell/index.tsx:1566` |
| i18n mevcut | `gauntlet.bonus.label/title` en+tr | `locales/en.json:1477-1480`, `locales/tr.json:1477-1480` |
| i18n yeni (tahmin) | alt başlık (`{{count}}` ile `max_attempts`), continue, solved, failed, a11y label/hint → ~6 anahtar/dil | — |
| PostHog sözlüğü | `docs/analytics/G6_CEKIRDEK_EVENTLER.md` §2 "Çekirdek dışı" tablosu | `G6_CEKIRDEK_EVENTLER.md:122-132` |
| S-1 event'leri sözlükte | `ask_shown`, `ask_accepted`, `ask_dismissed` docs'ta **geçmiyor** | Grep `docs/` → 0 |
| Mevcut Spotlight event'leri | `game_daily_opened`, `game_completed` (oyun ekranında) — `spotlight_completed` ile çift sayım riski | `utils/gameAnalytics.ts:12-14,53`, `Spotlight/index.tsx:273,315,372` |
| `posthogAnalytics.track` imzası | `string` event adı, tip birliği yok | `services/posthog.ts:72` |
| Ağ çağrısı sayısı | Kart durumu için yeni `getDailyChallenge` çağrısı; ask yolu da ayrıca çağırıyor (`askCoordinator.ts:59-60,106,139-141`) → champion'da 2–3 çağrı | — |
| Yan bulgu | `ArchiveTrigger/index.tsx:80-83` catch bloğu yalnız yorum içeriyor (kural 2 sınırında) | kapsam dışı |

---

## Önerilen bileşen değişikliği listesi (onay bekliyor)

| # | Dosya | Değişiklik | Büyüklük |
|---|---|---|---|
| 1 | `components/gauntlet/ChampionReveal/index.tsx` + `styles.ts` | Watch Now tek primary; Sonraya bırak + Paylaş → Phosphor ikon satırı (yeni küçük bileşen ya da `ChampionActionButton` `icon` varyantı). Mantık (save/share/watch handler'ları) aynen | M |
| 2 | `components/gauntlet/ChampionReveal/index.tsx` | Opsiyonel `onRevealSettled?: () => void` prop'u (sekans bitişi; resume'da hemen) | S |
| 3 | `constants/design/motion.ts` | `BONUS_CARD_ENTRY` token'ı: gecikme (1000–1500) + süre (`DISSOLVE_DURATION` ailesine) | S |
| 4 | `components/gauntlet/SpotlightBonusCard/{index,styles}.ts` | `gameType` zorunlu prop; MAX_BLUR backdrop küçük görseli; 3 durum (Play / Continue / Solved·Failed); dissolve giriş + reduced-motion guard; a11y; `onPress` aynen | M |
| 5 | Yeni hook `components/gauntlet/SpotlightBonusCard/useSpotlightCardState.ts` | `getDailyChallenge('spotlight', localDayKey)` → `{state, won, backdropUrl, maxAttempts}`; odakta yeniden okuma (K-22) | S |
| 6 | `components/games/Spotlight/index.tsx` | `MAX_BLUR`'u export et (ya da ortak sabite taşı) — mekanik değişmez | S |
| 7 | `components/gauntlet/GauntletShell/index.tsx` | Kart sarmalayıcısını giriş anına kadar mount etmeme; `onCardLayout`/`onSpotlightPress` bağlantısı birebir | S |
| 8 | `locales/en.json`, `locales/tr.json` | ~6 anahtar, parite | S |
| 9 | `docs/analytics/G6_CEKIRDEK_EVENTLER.md` | 3 yeni event (+ S-1'in 3 ask event'i eksik) | S |
| 10 | `tests/gauntlet/` (Deno) | Champion bütçe hesabını saf modüle alıp `isCardFullyVisible` ile cihaz sınıfı testleri | S |

---

## DUR NOKTASI gerektiren maddeler

- **DUR-1 · Watch Now yokken birincil eylem.** Sağlayıcı/link yoksa Watch Now render
  edilmiyor (`ChampionReveal/index.tsx:313,575`). Seçenekler: (a) Sonraya bırak dolgulu
  primary kalır, Paylaş ikon; (b) primary yok, yalnız ikon satırı; (c) başka.
- **DUR-2 · `attempt_count` kaynağı.** Seçenekler: (a) `get-daily-challenge` response'una
  `attempts` alanı ekle — additive, Edge Function değişikliği + deploy (CTO onayı, kural 10);
  (b) istemcide `spotlight_letters/spotlight_revealed/spotlight_guesses`'tan türet — sunucu
  sayımının istemci kopyası, Spotlight kuralı 2'nin ruhuna aykırı; (c) `spotlight_completed`'ı
  Spotlight ekranında `res.attempts_used` ile ateşle — ama `ms_since_champion` için champion
  zaman damgasının bir yerde tutulması gerekir (resume'da bilinmiyor); (d) kartta deneme
  sayısı gösterme, event'te `attempt_count: null`.
- **DUR-3 · Yeni motion token'ı.** `motion.ts`'e kart giriş gecikmesi/süresi eklenmesi
  (token dosyası tek kaynak, ekleme tasarım kararı). Resume yolunda (animasyonsuz champion)
  kart gecikmeli mi yoksa anında mı girer?
- **DUR-4 · Fold hedefi ile dwell ölçütü çelişkisi.** §5: önerilen CTA ile 844pt+ sınıfta
  yalnız temel senaryo tam görünür; 812pt ve SE'de, 2 satır başlıkta, "See all"/arşiv
  varken dwell kaydırmasız kurulmaz. Seçenekler: hero oranı küçültme (heroScrim kontrast
  testi yeniden koşar), ek boşluk sıkıştırma, ya da "küçük cihazda dwell yalnız kaydırma
  sonrası" kabulü.
- **DUR-5 · Dwell kanıt yöntemi.** S-1 hook'u dokunulmaz ve Deno'da koşmaz. Öneri:
  geometri Deno testi + 8 sn tetiği `__DEV__` log/breadcrumb ile cihaz oturumunda.
  Hook birim testi isteniyorsa hook'un saf zamanlayıcı çekirdeğe ayrılması gerekir
  (S-1 dosyasına dokunur).
- **DUR-6 · Event çift sayımı.** `spotlight_started/completed` mevcut `game_daily_opened` /
  `game_completed` ile örtüşüyor; hangi yüzeyden ateşleneceği (kart dönüşü mü oyun ekranı mı).

---

## Doğrulanamayanlar

- **Tab bar payı (T).** `TabBarInsetTelemetry` Sentry'ye `captureMessage('tab bar inset olcumu')`
  gönderiyor (`TabBarInsetTelemetry/index.tsx:108-112`); Sentry'de (org `chosy`, 90 gün)
  `"tab bar inset olcumu"` ve `component:TabBarInsetTelemetry` aramaları **0 issue** döndü.
  Tablodaki T değerleri iOS standart varsayımıdır (49 + alt güvenli alan), ölçüm değildir.
  iOS 26 yüzen tab bar'ı farklı olabilir.
- **ScrollView viewport = pencere yüksekliği** varsayımı (champion'da `insetLayer` dolgusuz,
  `GauntletShell/index.tsx:1750-1752`); native tabs altında ekran yüksekliği cihazda ölçülmedi.
- Yükseklikler font metriklerinden (lineHeight) hesaplandı; Dynamic Type büyük ayarlarda
  bütçe büyür. Cihazda ölçülmedi.
- `blurRadius = 40`'ın 72pt küçük görselde oyun ekranındaki 150–380pt karesiyle aynı
  görsel bulanıklığı verip vermediği (expo-image blur'ü kaynak piksel tabanlı olabilir) —
  cihaz doğrulaması gerekir.
