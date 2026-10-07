# S0 — Spotlight Yeniden Tasarım Keşfi (salt okunur)

Tarih: 7 Ekim 2026 · Dal: `feat/spotlight-ritual-teaser` · Mod: SALT OKUNUR (bu rapor dışında dosya değişmedi)
Kapsam: Sprint 0 — A–I bölümleri. Mimari karar alınmadı; yalnızca mevcut durum raporlandı.
Satır numaraları çalışma ağacındaki dosyalardan okundu. Cihaz, TestFlight ve canlı veritabanı bu turda kullanılmadı.

## Yönetici özeti

1. **Oyun mantığı tamamen sunucuda; ekran onu yalnızca çiziyor.** 6 hak, yanlış harf ve yanlış film tahmini için tek havuz (`submit-guess/index.ts:506`, `:677`, `:695`). Başlık istemciye inmiyor. Yeniden tasarım ekranı değiştirir, mekaniğe dokunmaz.
2. **İstemci hak sayısını sunucudan okumuyor.** Sunucu `puzzle.max_attempts` döndürüyor (`get-daily-challenge/index.ts:394-395`) ama ekran `SPOTLIGHT_MAX_ATTEMPTS = 6` sabitini kullanıyor (`Spotlight/index.tsx:65`). Şu an değerler eşit; kayma riski var.
3. **Mor, `GAME_THEMES.spotlight` üzerinden her yere akıyor** (`gameThemes.ts:158-168`): GameShell'in segmentli ilerleme çubuğu, ambient `beam`, klavye vurgusu, maske çizgileri, kare kenarlığı. Ayrıca şampiyon ekranındaki `SpotlightBonusCard` kare kenarı da aynı değeri okuyor (`SpotlightBonusCard/styles.ts:18,43`). Tek satır tema değişikliği bu kartı da etkiler.
4. **"Altın" için iki farklı hex var:** `Colors.gold #D4A843` (`Colors.ts:41`) ve `palette.marquee #D4A72C` (`primitives.ts:15`, `semantic.ts:43`). Talimat "marquee altını (Colors.gold ailesi)" diyor ve ikisi aynı değil. Karar gerekli (Soru 1).
5. **En riskli parça cevap sheet'i.** `FilmSearchInput` listeyi input'un ÜSTÜNE açıyor ve ekranın altında durduğunu varsayıyor (`index.tsx:149-150`, `dropdownHeight.ts`). Repodaki sheet deseni RN `Modal` (`ProvidersSheet.tsx:57`, `ContextBar/index.tsx:260`). Sheet içinde bu geometri bozulur. Ayrıca K-43 gereği arama hataları kullanıcıya gösterilmiyor (`FilmSearchInput/index.tsx:181-191`); bu, "sessiz fallback yok" protokolüyle çelişiyor (Soru 5).

## 1. Güncel mimari

**A. Giriş ve navigasyon**
- Tek giriş: şampiyon ekranının altındaki `SpotlightBonusCard`. `router.push('/games/spotlight')` (`SpotlightBonusCard/index.tsx:123`). Kart, `games_enabled` içinde `spotlight` varsa mount ediliyor (`GauntletShell/index.tsx:1432`).
- Eski hub rotası `app/games/index.tsx` kodda duruyor (`FALLBACK_ENABLED_GAMES = ['spotlight']`, `:52`). IA kararı §2.6 hub yok diyor. Bu rotaya hangi yoldan gidildiği doğrulanmadı.
- Rota `app/games/spotlight.tsx:16-18` yalnızca `<SpotlightGame />` render ediyor.
- Geri: GameShell geri butonu `router.back()` çağırıyor, `canGoBack` kontrolü yok (`GameShell/index.tsx:302-306`). Sonuç ekranındaki "Back" kontrol ediyor ve yoksa `/(tabs)`'e gidiyor (`Spotlight/index.tsx:535-538`). Soğuk açılışta oynanış ekranından geri davranışı doğrulanmadı.
- Durum kalıcılığı: sunucuda. `useFocusEffect` her odakta yerel durumu sıfırlayıp `getDailyChallenge`'ı yeniden çağırıyor (`:278-288`, `:208-276`). Dışarı çıkıp dönmek yeniden yükleme + `loading` ekranı demek.

**B. Oyun durumu (tek gerçek kaynak: `game_scores.progress_json`)**
- İstemci state'i: `puzzleId`, `puzzleNo`, `puzzleData` (`backdrop_url`, `title_mask`, `letter_count` — `types/game.ts:369-376`), `triedLetters`, `revealed`, `attempts`, `guessedFilmIds`, `won`, `screenState` (`Spotlight/index.tsx:171-200`).
- Resume alanları (`spotlight_letters`, `spotlight_revealed`, `attempts`, `spotlight_guesses`) sunucudan geliyor (`:236-254`). Eksikse `logger.error` yazılıyor (`:243-250`).
- "FILM 026" kaynağı: `puzzle_no`. Sunucuda `daily_puzzles` içinde `game_type` eşleşen, `date <= puzzleDate`, `is_emergency_pool = false` satır SAYISI (`get-daily-challenge/index.ts:180-193`). Saklanan bir kimlik değil, sıra sayısı. Sayım hatasında sessizce `0` dönüyor (`:190-193`, "Non-fatal").
- Gün anahtarı: `new Date().toLocaleDateString('en-CA')` (`Spotlight/index.tsx:215`). Kart ve askCoordinator başka yardımcılar kullanıyor (`useSpotlightCardState.ts:56`, `askCoordinator.ts:68`); üçünün aynı sonucu verdiği doğrulanmadı.
- Hak havuzu (doğrulandı):
  - Yanlış harf: `attemptsAfter = hit ? attempts : attempts + 1` (`submit-guess/index.ts:506`). Doğru harf bedava.
  - Film tahmini: `newAttempts = attempts + 1` (`:677`), `completed = isCorrect || newAttempts >= max_attempts` (`:695`).
  - Harf dalı hak bitince oyunu kapatıyor (`:507`, `:512`). Tüm harfler açılsa bile harf dalı kazanma üretmiyor (`won: false`).
  - İstemci hakkı `SPOTLIGHT_MAX_ATTEMPTS - attempts` ile hesaplıyor (`Spotlight/index.tsx:423`).
  - **Sapma yok**; tek not 2. özet maddesi (istemci sabiti).
- Harfler yalnızca A–Z (`spotlightProgress.ts` `LETTER_RE`, `_shared/spotlightLetters.ts`); rakam/ayraç `sep` token'ı olarak görünür (`Spotlight/index.tsx:622-633`).

**C. Bulanıklık**
- `SPOTLIGHT_MAX_BLUR = 40` (`Spotlight/constants.ts:12`). Aynı değeri `SpotlightBonusCard` da kullanıyor (`SpotlightBonusCard/index.tsx:165`).
- Hesap tamamen istemcide: `Math.round(40 * (1 - min(1, açılanPozisyon / letter_count)))` (`Spotlight/index.tsx:77-80`, `:424`). Oran **açılan harf değil açılan POZİSYON** sayısı: "E" harfi üç yerde varsa üç slot sayılır. Çıktı 0–40 arası 41 kademe.
- Görsel: `expo-image` `Image`, `blurRadius` prop'u, `contentFit="cover"`, `transition={300}` (`SpotlightStill.tsx:78-84`). Kutu 16:9, genişlik `SCREEN_W - 32` (`styles.ts:27-35`, `:85-94`; `Dimensions.get` modül yüklenirken, `:25`).
- Animasyon: `blurRadius` düz prop; bileşenin kendi notu "animasyonlu değil" diyor (`SpotlightStill.tsx:8-9`). Mevcut netleşme yalnızca SONUÇTA: net kat `opacity` ile 600 ms çapraz geçiş (`:86-98`, `motion.ts:67-69`). Oynanış sırasında `blurRadius` değişiminin `transition={300}` ile yumuşayıp yumuşamadığı **cihazda doğrulanmalı**.
- Yükleme/hata: oynanış karesinde `onLoad`/`onError`/placeholder yok. `backdrop_url` boşsa `uri=''` ile boş kutu çiziliyor (`Spotlight/index.tsx:587`; bayat-format koruması yalnızca `title_mask` ve `v`'ye bakıyor, `:221`). Sonuç karesinin hatası loglanıyor (`SpotlightStill.tsx:62-70`).
- Reduce Motion: yalnızca sonuç geçişinde (`SpotlightStill.tsx:46-47`).

**D. Harf etkileşimi**
- Akış: `KeyButton.onPress` → `hapticLight()` + `handleLetter` (`:691-694`) → `submitSpotlightLetter` (`gameApi.ts:444-465`, `ensureAuthSession()` ile sarılı) → `setTriedLetters/Revealed/Attempts` yanıttan (`:299-302`).
- Tekrar önleme: `triedLetters.includes` (`:294`) + tuş `disabled` (`:689`) + sunucu `LETTER_ALREADY_TRIED 400` (`submit-guess/index.ts:475-477`).
- Optimistik güncelleme yok. Bekleme sırasında 26 tuş `isBusy` ile devre dışı (`:689`) ama görsel bir bekleme durumu yok.
- Tuş stilleri: isabet = accent kenar + `accentDim` zemin + accent yazı; ıska = `opacity 0.35` (`styles.ts:168-181`). İsabet/ıska ayrımı sunucunun `hit` bayrağından değil, `revealed`'dan türetilen `hitLetters` kümesinden (`:409`).
- Geri bildirim: isabet `hapticSuccess`, ıska `hapticWarning` (`:329-330`); yeni slot `FadeInUp 250ms` (`:642-643`).
- Hata: tek genel kutu, `games.result.error_subtitle` (`:665-670`). 409 (tamamlanmış/hak bitti) ile ağ hatası ayırt edilmiyor.
- Gecikme: ölçülmedi. Son hakta sunucu yanıtı `recompute-cinema-dna` çağrısını bekliyor (`submit-guess/index.ts:124-145`, `await fetch`); son harf/tahmin diğerlerinden yavaş olabilir.
- Geri alma/backspace yok; yazılan kelime tamponu yok, dokunuş anında gönderiliyor. Görsellerdeki silme tuşu mevcut mekanikle uyuşmuyor.

**E. Film arama**
- Kullanım: `<FilmSearchInput onSelect={handleGuess} disabled={isBusy} catalogOnly listControls triedFilmIds={guessedFilmIds} />` (`Spotlight/index.tsx:704-710`).
- Veri: `searchFilms(query, catalogOnly)` → `searchFilmsDb(q, 10)` (`services/gameService.ts:718-754`); UI ilk 6 sonucu gösteriyor (`FilmSearchInput/index.tsx:231`).
- Debounce 300 ms (`:164,192`), en az 2 karakter (`:156`), bayat yanıt kapısı (`searchGate.ts`), yalnız-artikel sorgu ipucu (`:166-172`).
- Seçim: `handleSelect` klavyeyi kapatır, sorguyu temizler, `onSelect` çağırır (`:195-207`). Denenmiş film satırı soluk ve dokunulamaz (`:233-252`).
- Çift gönderim: `handleGuess` başında `isBusy` state kontrolü (`Spotlight/index.tsx:344`); input `disabled={isBusy}`. `isBusy` state olduğu için aynı render karesinde iki dokunuşun ikisinin de geçip geçmediği cihazda doğrulanmadı (ref koruması yok).
- Durumlar: yükleme göstergesi yok (dosyada `ActivityIndicator` yok), boş sonuç metni yok (liste açılmıyor, `listState.ts` `results` count>0), arama hatası kullanıcıya gösterilmiyor (K-43; yalnızca `logger.error`, `index.tsx:181-191`; servis `reportFilmSearchFailure`, `gameService.ts:756+`).

**F. Görsel sistem**
- Spotlight teması: `gameThemes.ts:158-168` — `accent #8B5CF6`, `accentOn #F0F0F5`, `accentDim/Glow` mor, `ambientBase ['#180F2E','#100C1D','#07080F']`, `ambientGlowA/B` mor, `ambientVariant 'beam'`, `progressGradient ['#8B5CF6','#A78BFA']`. Gerekçe yorumu `:146-157` ("mor huzme gerekçeyi güçlendirir") 07.10 kararıyla çelişiyor.
- Moru okuyan yerler:
  - GameShell segment çubuğu `theme.progressGradient` (`GameShell/index.tsx:327-353`); oynanışta `hideProgress` verilmiyor (`Spotlight/index.tsx:549-555`).
  - `GameBackdrop` `beam` dalı (`GameBackdrop/index.tsx:36-58`) yalnızca Spotlight için.
  - `styles.ts`: kare kenarı `accentHairline` (`:52`, `:85-94`), `keyHit` (`:168-172`), `keyTextHit` (`:181+`), maske çizgisi `slot`/`slotRevealed`/`slotText` (`:254-270`).
  - `FilmSearchInput` ve `GameStateView` `useGameTheme()` ile aynı accent'i okuyor.
  - `SpotlightBonusCard/styles.ts:18,43` kare kenarı `GAME_THEMES.spotlight.accent`. Yorum "mor YALNIZ bu kartta" (`SpotlightBonusCard/index.tsx:34-36`).
- Ham hex: `components/games/Spotlight/*`, `SpotlightBonusCard/*`, `SpotlightTeaser/*` içinde ham hex/rgba YOK (grep). Hex'ler yalnızca `gameThemes.ts` token dosyasında. Ham sayılar: tuş `fontSize: 15`, `height: 42` (`styles.ts:158-166,177`).
- Altın token'ları: `Colors.gold #D4A843`, `goldDim`, `goldGlow`, `goldHairline`, `goldSeal` (`Colors.ts:41-55`); `palette.marquee #D4A72C` → `color.reward.primary` (`semantic.ts:43`); `Colors.accentPrimary #E8A838` (`DEFAULT_GAME_THEME`, `gameThemes.ts:91`). `semantic.ts:6` `gameThemes`'ten `withAlpha` import ediyor; `gameThemes` `semantic`'i import ederse döngü oluşur.
- Tipografi: `type.meta` / `meta-strong` Martian Mono (`semantic.ts:100-101`), `label-caps` (`:108`), `type.title`. Maske harfleri `Theme.typography.serifTitle` (ad tarihsel; değer SF Pro, `theme.ts:41,205-211`). GameShell eyebrow stili bu turda satır satır incelenmedi.
- Boşluk/boyut: `Theme.spacing` xs4–xxl48 (`theme.ts:45-52`), `space`, `radius`, `size.touchTarget 44`, `size.progressDot 6` (`semantic.ts:122-134`); `RoundIndicator` aynı nokta ölçüsünü kullanıyor (`gauntlet/RoundIndicator/styles.ts:28-30`).
- Hareket: `DISSOLVE_DURATION` 320/280/360/600, `EASE_OUT_QUART`, `REDUCED_MOTION_DURATION.crossFade 100` (`motion.ts:12-83`).
- Yüzey/buton: `GlassSurface` (`expo-blur`, iOS `blur`, Android `solid`, `GlassSurface/index.tsx:34-40`), `GameStateView` (yükleme/hata + retry). Tasarım sistemine ait genel buton bileşeni bu turda aranmadı.
- Haptik: `utils/haptics.ts:35-60` (`Light/Medium/Heavy/Selection/Success/Warning/Impact`).
- Reduce Motion: yardımcı `useReducedMotion` (Reanimated), 10 dosyada.
- Sheet altyapısı: RN `Modal transparent animationType="slide"` + backdrop deseni — `ProvidersSheet.tsx:57`, `ContextBar/index.tsx:260`, `AuthPromptSheet.tsx:122`, `NotificationPromptSheet.tsx:83`. `package.json`'da bottom-sheet kütüphanesi yok (`expo-blur`, `react-native-gesture-handler`, `reanimated` var). Cevap sheet'i Modal deseniyle kurulabilir; GameShell'in `KeyboardAvoidingView`'ı Modal'ı kapsamaz, sheet kendi klavye yönetimini taşımalı.

**G. Analytics**

| Olay | Payload | Yer | Anlamı kayabilecek nokta |
|---|---|---|---|
| `game_daily_opened` | `game_id, puzzle_no, source:'hub'` | `Spotlight/index.tsx:266` | Yalnız `playing` yolunda; her odakta yeniden tetikleniyor. `source` sabit `'hub'` (hub yok). |
| `game_guess_submitted` | `game_id, guess_no=attempts_used, latency_ms` | `:361` | Yalnız FİLM tahmininde; harfte yok. `latency_ms` son film tahmininden/açılıştan beri geçen süre, harf dokunuşlarını da kapsıyor. Tahmin sheet'i açılınca `guessStartRef` sıfırlanırsa anlam değişir. |
| `game_daily_completed` | `game_id, won, guesses_used=attempts_used, time_to_solve_s, xp, letters_tried, ended_by?` | `:315-325`, `:374-381` | `ended_by:'letters'` yalnız harfle kayıpta var. `time_to_solve_s` `openTimeRef`'ten; `openTimeRef` her odakta sıfırlanıyor (`:264`), yani devam edilen oyunda süre devam anından başlıyor. `guesses_used` kapı metriği (`gameAnalytics.ts:49-51`). |
| `spotlight_card_viewed` | `game_id, state, resumed, window_height` | `SpotlightBonusCard/index.tsx:111` | Tasarımdan etkilenmez. |
| `spotlight_card_pressed` | `game_id, state` | `:121` | Aynı. |
| `spotlight_teaser_viewed` | — | `SpotlightTeaser/index.tsx:44` | Aynı. |
| `game_result_card_viewed`, `game_why_this_movie_viewed`, `game_film_page_opened`, `game_share_*` | tanımlı (`gameAnalytics.ts:73-112`) | `QuickResult` çağırıyor; `ResultCard` içinde çağrı bulunamadı | Spotlight sonuç yolundaki emisyon doğrulanmadı. |

Harf dokunuşu için olay yok. Sheet açma/kapama için olay yok. Yeni olay eklemek eklemeli ama bu turda karar verilmedi.

**H. Erişilebilirlik**
- Tuşlar: `accessibilityRole="button"`, `accessibilityLabel={letter}`, `accessibilityState={{disabled}}` (`:125-127`). İsabet/ıska durumu VoiceOver'a iletilmiyor (yalnız `disabled`).
- Tuş hedef boyutu: genişlik `floor((STILL_W - 16 - 36) / 10)` (`styles.ts:41-43`), yükseklik 42 (`:158-166`). Hesap (cihazda ölçülmedi): 390 pt ekranda 30 pt, 375 pt'de 29 pt, 430 pt'de 34 pt genişlik. §14 "≥44×44" eşiğinin altında. `Pressable`'da `hitSlop` yok. Satırlar arası 4 pt boşluk dikeyde 46 pt etkili alan veriyor; yatayda komşu tuş sınırı var.
- Maske: slotlara ve maskeye erişilebilirlik etiketi yok (`:637-651`). Açılan harf `Animated.Text` olarak tek tek okunur; boş slot okunmaz; maskenin özeti yok.
- Kare: oynanış karesinde `accessible`/etiket verilmemiş (`SpotlightStill.tsx:78-84`); sonuçtaki net kat `accessible={false}` (`:93`).
- Rozet: "6 left" metni bağlamsız okunur (`:604-606`). Hata kutusu canlı bölge değil (`:665-670`).
- Progress: GameShell `progressbar` rolü + `games.common.progress_label` "Attempt %{current} of %{total}" (`GameShell/index.tsx:329-336`).
- Geri butonu: etiket var, `hitSlop` 12 (`:299-301`), alan 44×44 (`GameShell/styles.ts`, `headerSlot`).
- Dynamic Type: tuş, maske slotu ve arama input'u `maxFontSizeMultiplier = 1.3` (`theme.ts:95`; `Spotlight/index.tsx:132,628,645`, `FilmSearchInput/index.tsx:311`). Etiket metinleri tam ölçekleniyor. AX boyutlarında düzenin kırılıp kırılmadığı cihazda doğrulanmadı.
- Reduce Motion: yalnız sonuç karesi korumalı. Tuş spring'i (`:109-123`), slot `FadeInUp` (`:642`), hata kutusu `FadeIn` (`:666`), kare `FadeIn` (`SpotlightStill.tsx:74`) için Reduce Motion davranışı kodda açıkça yok; Reanimated'ın varsayılanına bağlı (doğrulanmadı).

## 2. Güncel kurallar (doğrulanmış)

- 6 hak; yanlış harf ve yanlış film tahmini aynı havuz (`submit-guess:506,677,695`). Doğru harf bedava.
- Kazanma yolu yalnız film tahmini. Harf dalı `won:false` yazıyor.
- Başlık `puzzle_data`'da yok; istemci tipi yalnız `backdrop_url`, `title_mask`, `letter_count` (`types/game.ts:369-376`). Cevap `public_daily_puzzles` view'ından geliyor (`get-daily-challenge/index.ts:141-148`). `puzzle_data` olduğu gibi aktarılıyor (`:394`); sunucu tarafı içeriğin başlık içermediği bu turda satır satır doğrulanmadı.
- Resume alanları beyaz listeyle üretiliyor (`spotlightProgress.ts`).
- Bulanıklık istemcide, açılan pozisyon oranına göre, 0–40, tam sayı.
- `puzzle.max_attempts` sunucudan geliyor ve istemci tarafından kullanılmıyor.

## 3. Dosya haritası

| Alan | Dosya |
|---|---|
| Rota / ekran | `app/games/spotlight.tsx`, `components/games/Spotlight/index.tsx` (716 satır) |
| Stil / yerleşim | `Spotlight/styles.ts`, `maskLayout.ts`, `stillLayout.ts`, `constants.ts`, `SpotlightStill.tsx`, `nextPuzzleClock.ts` |
| Kabuk / tema | `components/games/GameShell/{index,styles}.tsx`, `GameBackdrop/index.tsx`, `constants/gameThemes.ts` |
| Arama | `components/games/FilmSearchInput/*`, `services/gameService.ts:718+`, `services/searchFilms` |
| API | `services/gameApi.ts:196,414-465` |
| Sunucu | `supabase/functions/submit-guess/index.ts`, `get-daily-challenge/index.ts`, `_shared/spotlightLetters.ts`, `_shared/spotlightProgress.ts`, `generate-puzzles/index.ts:1547-1552,1644-1648` |
| Giriş | `components/gauntlet/SpotlightBonusCard/*`, `SpotlightTeaser/*`, `GauntletShell/index.tsx:1432` |
| Ortak sonuç (değişmez) | `components/games/ResultCard/index.tsx`, `QuickResult/index.tsx` |
| Token | `constants/Colors.ts`, `constants/design/{primitives,semantic,motion}.ts`, `constants/theme.ts`, `constants/gameLayout.ts` |
| Analytics / haptik | `utils/gameAnalytics.ts`, `utils/haptics.ts` |
| i18n | `locales/en.json` (spotlight bloğu `:1104-1135`), `locales/tr.json` (`:1119-1121` civarı) |
| Testler | `tests/games/spotlightLayout.test.ts`, `tests/games/filmSearchList.test.ts`, `tests/game-system/spotlight.test.ts`, `supabase/functions/_shared/spotlightProgress.test.ts`, `tests/gauntlet/spotlightTeaser.test.ts` |

## 4. Boşluk tablosu (görsel yön: `docs/referans/02-target-screen.png`, bible: `docs/referans/ChatGPT Görseli 7 Eki 2026 11_20_06-3.png`)

| # | ÖĞE | MEVCUT | HEDEF (yazılı spec) | DEĞİŞİKLİK | RİSK | DOSYALAR |
|---|---|---|---|---|---|---|
| 1 | Üst segmentli ilerleme | GameShell'de 6 segment, dolu = HARCANAN, mor gradyan (`GameShell:327-353`) | Çubuk yok; ilerleme = netlik, risk = nokta | Oynanışta `hideProgress` ver | Düşük; ama GameShell paylaşımlı, `hideProgress` zaten prop | `Spotlight/index.tsx:549-555` |
| 2 | "6 LEFT" rozeti | Görsel üstünde GlassSurface + Eye ikon, "6 left"/"6 hak" (`:596-607`) | "CHANCES"/"HAK" etiketli nokta satırı; dolu = kalan, boş = harcanan | Rozeti kaldır, yeni nokta satırı; yeni i18n anahtarı; kalan hak kaynağı karar bekliyor | Orta: anlam tersine döner (mevcut çubuk dolu = harcanan) | `Spotlight/index.tsx`, `styles.ts:108-125`, `locales/*.json` |
| 3 | Hero | 16:9 kare, accent kenarlık, `FadeIn 400` (`styles.ts:85-94`) | Ekranın en doygun öğesi, arayüz geri çekilir | Kenarlığı sakinleştir; `onLoad/onError` ekle | Orta: boş `uri` sessiz boş kutu; `blurRadius` yumuşaklığı cihazda | `SpotlightStill.tsx`, `styles.ts` |
| 4 | Bulanıklık | 0–40, pozisyon oranı, adım adım | "Orta" bulanıklık, netleşme ilerleme | MAX_BLUR değeri karar bekliyor; kart da aynı sabiti kullanıyor | Orta: `constants.ts:12` değişirse kart görünümü de değişir | `constants.ts`, `SpotlightBonusCard/index.tsx:165` |
| 5 | Üst etiket | "FILM #26" / "FİLM #26", GameShell eyebrow (`en.json:1104+`) | "FILM 026" Martian Mono | `case_label` biçimi + font; sıfır dolgu | Düşük; `puzzle_no=0` sessiz durumu görünür olur | `locales/*.json`, `GameShell/styles.ts` (eyebrow) |
| 6 | "THE TITLE" etiketi | `title_label` eyebrow, maskenin üstünde (`:612`) | Bible'da yok; yardımcı metin "Reveal letters. Bring the film into focus." | Etiketi kaldır/yardımcı metinle değiştir; yeni i18n | Düşük | `Spotlight/index.tsx:611-612`, `locales/*.json` |
| 7 | Boşluk kontrastı | Boş slot çizgisi accent@%22 (mor), dolu = accent (`styles.ts:52,254-264`) | Yüksek kontrastlı boşluklar | Çizgi rengi/kalınlığı token'dan | Düşük | `styles.ts:222-290` |
| 8 | Ölü alan | `topRegion` flex:1, kısa başlıkta maske ile aksiyon barı arası boş (`styles.ts:62-80`) | Dikey ritim: kare → noktalar → maske → klavye → CTA | Yerleşim sırası | Orta: uzun başlıkta kayan bölge davranışı korunmalı (B-1/Fix 8) | `styles.ts`, `maskLayout.ts` |
| 9 | Harf tahtası | 26 tuş, accent isabet / %35 ıska, 30×42 pt (hesap) | Premium, kullanılan harf sönük | Tuş stilleri, token | Orta: 44 pt eşiği 10 sütunda sağlanamıyor (Soru 11) | `styles.ts:41-43,158-181`, `Spotlight/index.tsx:106-139` |
| 10 | Backspace | Yok; dokunuş anında gönderiliyor | Yok (görseldeki tuş hata) | Yok | — | — |
| 11 | Kalıcı arama | Klavye ile aynı barda sürekli görünür (`:702-711`) | Ana ekranda arama yok; ayrı sheet | Sheet + `FilmSearchInput` yerleşimi | **Yüksek:** paylaşılan bileşen, dropdown geometrisi, klavye, odak | `Spotlight/index.tsx`, `FilmSearchInput/*` |
| 12 | Mor | `gameThemes.ts:158-168`, `GameBackdrop` beam, GameShell çubuğu, kart kenarı | Mor yok; altın seyrek | Tema değerleri + beam; kart kararı | **Yüksek:** `GAME_THEMES.spotlight` kart ve Teaser'a da akıyor; altın hex belirsiz | `gameThemes.ts`, `GameBackdrop`, `SpotlightBonusCard/styles.ts` |
| 13 | CTA | Yok; bitiş = film seçmek | Birincil altın CTA "I KNOW THE FILM" → sheet | Yeni bileşen/metin | Orta: ortak buton bileşeni aranmadı | `Spotlight/index.tsx`, `locales/*.json` |
| 14 | Arama durumları | Yükleme/boş/hata yok | Hata gerçek mesaj, boş durum | Sheet içi satırlar | K-43 ile çelişir (Soru 5) | `FilmSearchInput/index.tsx` |
| 15 | Sonuç ekranı | `ResultCard` altın (XP/streak/paylaş) (`ResultCard:279,309,332,368`) | Muaf, değişmez | Yok | Doktrin "Risk" notu: sonuç anında iki altın art arda | — |

## 5. Riskler

1. **Tema paylaşımı:** `GAME_THEMES.spotlight` hem oyun ekranını hem şampiyon ekranı kartını besliyor. Değer değişikliği kart kenarını da değiştirir; kartın kendi "mor tek yer" doktrini (`SpotlightBonusCard/index.tsx:34-36`) kodda yorum olarak duruyor.
2. **Altın belirsizliği:** `#D4A843` vs `#D4A72C`. `gameThemes.ts` ile `semantic.ts` arasında import döngüsü riski.
3. **Cevap sheet'i / FilmSearchInput:** paylaşılan bileşen beş dondurulmuş oyun tarafından kullanılıyor; `listControls` opt-in öncülüğü var (`index.tsx:12-19`). Modal içinde `measureInWindow` ve `useGameShellContentTop` sınırları yanlış yorumlanır.
4. **Anlam tersliği:** mevcut ilerleme çubuğu dolu = harcanan; hedef nokta dolu = kalan. Aynı veriden iki ters gösterim.
5. **Analytics anlam kayması:** `latency_ms`, `time_to_solve_s`, `game_daily_opened` tetik noktası (bkz. G).
6. **Sessiz boş durumlar:** boş `backdrop_url`, `puzzle_no=0`, arama hatası (§1 C, B, E).
7. **Dokunma hedefi:** 10 sütunlu QWERTY ≤34 pt genişlik; Design OS §14 ile çelişiyor.
8. **`Dimensions.get` modül düzeyinde** (`styles.ts:25`): ekran boyutu değişirse (split view) kare genişliği güncellenmez; iPad davranışı doğrulanmadı.
9. **Dokümantasyon:** 07.10 kararı Design OS / `gameThemes.ts` yorumlarında henüz işlenmemiş; `bible` süreci (sürüm artışı + karar günlüğü) gerekir.
10. **Bayat referans:** `tests/game-system/spotlight.test.ts` yorumu `blurForProgress()`'u `index.tsx:84`'te gösteriyor; gerçek konum `:77`.

## 6. Önerilen sıra (karar bekleyen kısım hariç)

1. **S1 — Tema:** `GAME_THEMES.spotlight` altına, `beam` kaldırma/nötrleme, kart kenarı kararı (Soru 1–3).
2. **S2 — Başlık + hak göstergesi:** `FILM 026`, segment çubuğunu kaldırma, "CHANCES/HAK" nokta satırı, i18n (Soru 6, 8, 12).
3. **S3 — Maske + harf tahtası:** boşluk kontrastı, tuş stilleri, dokunma hedefi kararı (Soru 11).
4. **S4 — Cevap sheet'i:** CTA + Modal + `FilmSearchInput` sheet uyumu + arama durumları (Soru 4, 5, 7).
5. **S5 — Hero:** `onLoad/onError`, boş `uri` durumu, bulanıklık parametreleri.
6. **S6 — Erişilebilirlik ve Reduce Motion geçişi, cihaz kontrol listesi.**

Mantık dosyaları (`handleLetter`, `handleGuess`, `loadPuzzle`, `gameApi.ts`, `submit-guess`) bu sıranın hiçbir adımında değişmek zorunda değil.

## 7. Karar bekleyen sorular

1. **Altın hangisi?** `Colors.gold #D4A843` mı, `palette.marquee #D4A72C` (`color.reward.primary`) mı? `gameThemes.ts` `semantic`'i import edemez (döngü); `Colors`'tan mı, `primitives`'ten mi okunacak?
2. **Ambient:** `beam` tamamen kalkıp nötr ink zemin mi, yoksa altın tonlu `beam` mi? `AmbientVariant` tipinden `beam` silinsin mi, kalsın mı?
3. **`SpotlightBonusCard` kenarı:** şampiyon ekranındaki kart kare kenarı da altına mı geçsin, nötr mü olsun? Kapsam "Spotlight ekranı" mı, "Spotlight görsel kimliği" mi?
4. **Sheet sahibi:** mevcut RN `Modal` deseni mi (yeni bağımlılık yok) yoksa bottom-sheet kütüphanesi mi (yeni bağımlılık → onay gerekir)? Yanlış tahminde sheet açık mı kalır, kapanır mı?
5. **Arama hatası:** K-43 ("kullanıcıya hata metni gösterilmez") sheet içinde de geçerli mi, yoksa protokolün "gerçek mesaj" kuralı mı kazanır?
6. **`puzzle_no`:** biçim `FILM 026` (sıfır dolgu, `#` yok) ve `puzzle_no=0` durumu (sayım hatası) nasıl görünsün?
7. **Metinler:** "I KNOW THE FILM" EN/TR karşılığı ve yardımcı metin (`Design OS §15` tonu) kurucu onayı.
8. **Hak kaynağı:** nokta sayısı sunucudaki `puzzle.max_attempts`'tan mı okunsun (mevcut alan), sabit 6 mı kalsın?
9. **Reduce Motion:** tuş spring'i ve slot girişi §7.5 kapsamında 100 ms cross-fade'e mi çevrilsin, "dokunma geri bildirimi" olarak muaf mı?
10. **Sonuç anı:** oynanış altını ile ödül altını art arda görünme riski (karar notundaki "Risk") bu sprintte izlenecek mi, yoksa ayrı bir iş mi?
11. **Dokunma hedefi:** 10 sütunlu QWERTY'de 44 pt sağlanamıyor. Kabul, `hitSlop` ya da farklı yerleşim?
12. **Nokta konumu:** hedef görselde noktalar karenin altında; mevcut rozet karenin üstünde yüzüyor. Altında mı olacak?
13. **Referans yolu:** talimat `docs/references/spotlight/` diyor; klasör yok. Görseller `docs/referans/` altında (`01-current-audit.png`, `02-target-screen.png`, `ChatGPT Görseli … -3.png`), `docs/referans/spotlight/` boş. Çalışma ağacında üç eski PNG silinmiş (`D`), üç yenisi izlenmiyor (`??`); bunlar bu turun değişikliği değil.

## Ölçülmüş sayılar

- Canlı veritabanı sorgusu **çalıştırılmadı**; bu keşif için gerekmedi.
- Hesaplanan (cihazda ölçülmedi): tuş genişliği 29 / 30 / 34 pt (375 / 390 / 430 pt ekran); 41 bulanıklık kademesi (0–40, tam sayı); `Spotlight/index.tsx` 716 satır.
- Çalıştırılmadı: `npm run typecheck`, `npm run typecheck:functions`, testler, lint. PRE-EXISTING / INTRODUCED ayrımı için baseline ölçümü bu turda yapılmadı.

## DUR NOKTASI gerektiren / adayı olan maddeler

Şu an mimari, şema veya API değişikliği gerektiren madde **tespit edilmedi**. Aşağıdakiler CTO onayı gerektirebilecek adaylar:

1. Bottom-sheet kütüphanesi istenirse: yeni bağımlılık (Soru 4).
2. `FilmSearchInput` için sheet kipi: paylaşılan bileşene yeni opt-in prop (`listControls` öncülüğü var); beş dondurulmuş oyunu etkilememeli.
3. K-43 kararının değişmesi (Soru 5).
4. `GameTheme` arayüzüne alan eklenmesi ya da `AmbientVariant`'tan `beam` silinmesi: yalnızca değer değişikliğinin ötesine geçerse.
5. Yeni analytics olayı (harf/sheet) istenirse: mevcut olayların anlamı korunmalı (Bölüm G).
6. 07.10.2026 doktrin revizyonunun Design OS / karar günlüğüne işlenmesi (`bible` süreci).

## Doğrulanamayanlar

- Cihaz davranışı: `blurRadius` değişiminin yumuşaklığı, Dynamic Type AX düzeni, VoiceOver okuma sırası, gerçek dokunma hedefi, çift dokunuşla çift gönderim, Reduce Motion'da Reanimated `entering` davranışı, gecikme.
- `get-daily-challenge` yanıtındaki `puzzle_data`'nın başlık içermediği (view'dan `select('*')` ile geliyor; içerik denetimi yapılmadı).
- `app/games/index.tsx` rotasına erişim yolu var mı.
- Üç gün anahtarı yardımcısının (`en-CA`, `localDayKey`, `askCoordinator`) aynı sonucu verdiği.
- GameShell eyebrow stili (`GameShell/styles.ts` eyebrow bloğu), `FilmSearchInput/styles.ts`, `GameStateView/styles.ts` içindeki tema kullanımı satır satır okunmadı.
- `ResultCard` içinde `game_result_card_viewed` emisyonu.
- Canlı veri: sorgulanmadı.
