# P-3c KEŞİF — Spotlight arama listesi kapanmıyor + "Found it with N letters"

- Temel: `fix/spotlight-search` @ `8eddd50` · Tarih: 4 Eki 2026 · Mod: READ-ONLY
- Kaynak: kod okuması + `node_modules/react-native` (RN 0.81.5) ScrollView kaynağı.
  Cihazda ölçüm yok.

## Yönetici özeti

1. **Blur'u yalnız bir ScrollView'ın içindeki dokunuş tetikler.** RN, klavyeyi "dışarı dokunuşta"
   yalnızca ScrollView responder'ı üzerinden kapatır. Spotlight'ta bunu yapan tek yüzey üst bölge
   ScrollView'ı (kare + maske). Header, hata kutusu, bölgeler arası boşluk, "Hangi film?" etiketi ve
   aksiyon barının boş alanları ScrollView içinde değil → dokunuş input'u **blur etmez** → A1 (onBlur)
   hiç tetiklenmez → liste kapanmaz.
2. **Klavye açıkken üst bölgenin büyük kısmı zaten listenin altında.** SE + 216 klavyede üst bölge
   109–211, 3+ sonuçlu liste 173–387: üst bölgeden yalnız ~64pt açıkta. SE + 260'ta üst bölge 58pt ve
   4+ sonuçta tamamen örtülü — **dokunulabilecek, blur üreten boş alan kalmıyor.**
3. **Kapat satırı 4+ sonuçta da görünür olmalı (koddan):** liste kabı `maxHeight` ile sınırlı,
   iç ScrollView'ın varsayılanı `flexShrink: 1`, Kapat satırı sabit 44pt; ScrollView küçülür, Kapat
   input'a bitişik alt kenarda kalır. Cihazda doğrulanmadı.
4. **"Found it with N letter(s)" sayısı = sunucunun `spotlight_letters` dizisinin uzunluğu** — basılan
   farklı harf tuşu sayısı, **isabet + ıska**. Bir harfle otomatik açılan diğer pozisyonlar, rakam ve
   noktalama (baştan görünür ayraçlar) **sayılmıyor**. Iska harfler sayılıyor.
5. N = 0 için metin bugün "Found it with 0 letter(s)!" / "0 harfle buldun!". i18n-js 4.5 `zero`
   anahtarını destekliyor; ayrı metin tek locale değişikliğiyle mümkün.

## 1. Neden kapanmıyor — zincir

### Blur'un tek kaynağı: ScrollView responder'ı
`node_modules/react-native/Libraries/Components/ScrollView/ScrollView.js`:

| Satır | Davranış |
|---|---|
| `:1434-1452` `_handleStartShouldSetResponder` | `keyboardShouldPersistTaps === 'handled'` + klavye kapatılabilir + hedef odaktaki input değilse ScrollView responder olur (bubble fazı: içerideki dokunulabilir çocuk önce sahiplenir) |
| `:1347-1377` `_handleResponderRelease` | Responder ScrollView ise ve kaydırma olmadıysa `TextInputState.blurTextInput(...)` |
| `:1517-1536` `_keyboardIsDismissible` | Odakta TextInput + açık klavye metrikleri şart |
| `:1558-1584` `_handleTouchEnd` | Yalnız "detached" (VR) klavye + `never` modunda — iOS telefonda devre dışı |

RN'de ScrollView dışında "dışarı dokununca klavyeyi kapat" mekanizması yok. Düz `View`'lar
responder olmaz; dokunuş hiçbir şeye bağlanmaz, input odakta kalır.

### Spotlight'ta hangi yüzey blur üretir

| Yüzey | Dosya:satır | Blur? |
|---|---|---|
| Üst bölge ScrollView (kare, maske, aralarındaki boşluk) | `components/games/Spotlight/index.tsx:540-543` (`keyboardShouldPersistTaps="handled"`) | **Evet** — ama çoğu durumda listenin altında |
| GameShell header / ilerleme çubuğu | `components/games/GameShell/index.tsx` (`chrome`, ScrollView değil) | Hayır |
| Hata kutusu | `Spotlight/index.tsx:631` | Hayır |
| Ekran `gap` (16pt) üst bölge ↔ aksiyon barı | `Spotlight/styles.ts` `screen.gap` | Hayır |
| Aksiyon barı boşlukları, "Hangi film?" etiketi | `Spotlight/index.tsx:643-667` | Hayır |
| Görünür harf tuşu | `KeyButton` (Pressable) | Hayır — tuş dokunuşu sahiplenir, **harf gönderilir**, liste açık kalır |
| Liste satırı | `FilmSearchInput/index.tsx:190-242` | Hayır (tasarım gereği: tuzak katman 1) |
| Kapat satırı | `FilmSearchInput/index.tsx:244-` | Blur yok; doğrudan `dismiss` |
| Klavyenin "Search" tuşu | `returnKeyType="search"`, tek satırlı TextInput varsayılan `blurOnSubmit` | **Evet** — tek "dışarıdan" güvenilir yol |

`onBlur` → `dispatchList({ type: 'blur' })` (`FilmSearchInput/index.tsx:273`) → `listState.ts`
`reduceSearchList` `'blur'` dalı listeyi kapatır (satır basılı değilse). Zincir doğru; tetikleyici gelmiyor.

### Geometri — blur üretebilecek açık alan (SE 375×667, içerik üstü 109)
P-3 keşif modeli (`tests/games/spotlightLayout.test.ts`):

| Klavye | Üst bölge (y) | Liste 3 sonuç (y) | Liste 4+ (tavan) | Açıkta kalan üst bölge |
|---|---|---|---|---|
| 216 | 109–211 | 173.5–387 | 109–387 | 3 sonuç: ~64pt · 4+: **0** |
| 260 (QuickType) | 109–167 | 129.5–343 | 109–343 | 3 sonuç: ~20pt · 4+: **0** |

Pro Max'te üst bölge büyük ve kare görünür; orada karenin üstüne dokunmak blur üretmeli
(koddan; cihazda doğrulanmadı). Yani "boş alana dokununca kapanmıyor" gözlemi SE'de geometriyle,
her cihazda header/etiket/boşluk dokunuşlarıyla açıklanıyor.

### Kapat satırı 4+ sonuçta görünür mü
- Kap: `styles.dropdown` `overflow: 'hidden'` (`FilmSearchInput/styles.ts:39-47`), `maxHeight`
  runtime (`index.tsx:185`).
- İç ScrollView temel stili `flexGrow: 1, flexShrink: 1` (`ScrollView.js:1861-1866`).
- Kapat satırı `height: 44` (flexShrink 0).
- Yoga, `maxHeight`'lı otomatik yükseklikli kapta içerik taşınca esnek çocukları küçültür →
  ScrollView `maxHeight − 44 − 2` olur, Kapat alt kenarda kalır. Aynı mekanizma P-3 öncesi
  listenin 6 sonucu 280pt içinde kaydırabilmesinin de koşulu.
- Kapat **input'a bitişik** (y ≈ inputTopY − 4 − 44); sistem klavyesinin üstünde, ekranda.
- **Doğrulanamadı:** cihazda ekran görüntüsü yok. Yoga davranışı bekleneni üretmezse Kapat
  `overflow: hidden` ile kırpılır — N13'te bakılacak.

## 2. Öneri — UYGULAMA YOK

| # | Öneri | Dosya | Büyüklük | Risk / not |
|---|---|---|---|---|
| B1 | **Arka plana dokununca `Keyboard.dismiss()`:** Spotlight `screen` kabına responder (`onStartShouldSetResponder={() => true}` + `onResponderRelease={Keyboard.dismiss}`) ya da `Pressable accessible={false}` sarmalayıcı. Bubble fazında en derin dokunulabilir önce sahiplendiği için liste satırları, Kapat, harf tuşları ve üst bölge ScrollView'ı dokunuşlarını korur; yalnız sahipsiz dokunuşlar (boşluk, etiket, hata kutusu) sarmalayıcıya düşer. `Keyboard.dismiss` → blur → A1 kapatır. | `Spotlight/index.tsx` (oynanış `View style={styles.screen}`) | S | Header GameShell'de, sarmalayıcının dışında kalır (GameShell'e dokunmak 5 donmuş oyunu da etkiler → ayrı karar). Liste satırı dokunuşunu yutmaz: satır `TouchableOpacity` responder'ı sahiplenir, sarmalayıcıya ulaşmaz. `capture` fazı KULLANILMAMALI (satırı yutar). VoiceOver: `accessible={false}` şart. SE + 260'ta açıkta boşluk çok az; tek başına yetmez → B3 ile birlikte. |
| B2 | **`keyboardDismissMode="on-drag"`:** **üst bölge** ScrollView'ına uygun (kareyi sürüklemek klavyeyi kapatır → blur → liste kapanır). **Liste ScrollView'ına UYGUN DEĞİL:** sonuçları kaydırmak klavyeyi kapatır → blur → A1 listeyi kaydırırken kapatır. | `Spotlight/index.tsx:540-543` | S | iOS'ta `on-drag` native; Android'de `_handleScrollBeginDrag` (`ScrollView.js:1274-1282`) `dismissKeyboard()` çağırır. Liste ScrollView'ına konursa A1'in "blur = kapat" kuralı ayrıştırılmalı (yeni olay türü) → kapsam büyür. |
| B3 | **Kapat satırını listenin ÜSTÜNE taşı.** | `FilmSearchInput/index.tsx:242-255`, `styles.ts` `closeRow` (`borderTopWidth` → `borderBottomWidth`) | S | Yükseklik hesabı değişmez (`SEARCH_CLOSE_ROW_H` yine `maxHeight` içinde). Üstte: liste 4+ sonuçta header altına (y=109) kadar uzandığı için Kapat gözün ilk gittiği yerde, başparmaktan uzak. Altta (bugün): input'a bitişik, görsel olarak input'un parçası gibi okunabilir — gözlem bu olabilir. Erişilebilirlik sırası değişir (VoiceOver önce Kapat'ı okur). `kaydırma göstergesi` ile çakışma yok. N13 metni "listenin altında (input'a bitişik)" diyor → güncellenmeli. |

**Etkilenen testler:**
- `tests/games/filmSearchList.test.ts` — B1/B2/B3'ün hiçbiri reducer'ı değiştirmez; testler aynı kalır.
  B1 için yeni olay yok (`Keyboard.dismiss` → mevcut `blur`).
- `tests/games/spotlightLayout.test.ts` — B3 Kapat'ın konumunu değiştirir ama yüksekliği değil;
  `P-3 Kapat satiri` testi (~2.67 satır) değişmez.
- Bu üçü için RN render testi yok (jest/RNTL kurulu değil — eklemek yeni bağımlılık). Doğrulama N13.
- `docs/05_SPRINTS/ACTIVE/V1_TESTFLIGHT_CHECKLIST.md` N13 "Kapat satırı listenin altında" maddesi.

## 3. "Found it with N letter(s)" — kaynak

| Adım | Kanıt |
|---|---|
| Metin | `Spotlight/index.tsx:504-505` → `t('games.spotlight.result_won_letters', { count: triedLetters.length })` |
| `triedLetters` (oyun içinde biterse) | `handleLetter` `Spotlight/index.tsx:283`, `handleGuess` `:342`: `setTriedLetters(res.tried_letters)` — sunucu yanıtı |
| `triedLetters` (yeniden açılışta) | `loadPuzzle` `:234`: `progress?.spotlight_letters` — sunucu `progress_json` |
| Sunucu dizisi | `submit-guess/index.ts:474-495`: her harf denemesinde `[...triedLetters, spotlightLetter]` — isabet ve ıska ayrımı yok; aynı harf iki kez eklenemez (`LETTER_ALREADY_TRIED` `:474-476`) |
| Film tahmini dalı | `submit-guess/index.ts:686-707`: `spotlight_letters` değişmeden taşınır |

Yani N = **istemcinin hesapladığı bir şey değil, sunucunun denenmiş harf listesinin uzunluğu.**

"Otomatik açılanlar":
- Bir harf başlıkta birden çok yerde geçerse hepsi açılır (`findLetterPositions`, `:492`) —
  **sayılmaz** (sayaç pozisyon değil, harf).
- Rakam/noktalama/boşluk baştan görünür (`_shared/spotlightLetters.ts` `classifyChar` → `'sep'`)
  — **sayılmaz**.
- Sunucuda başka otomatik açma yok (harf dalı dışında `spotlight_revealed`'a yazan yol yok).
- **Sayılan ama tartışmalı olan:** ıska harfler. "6 harfle buldun" diyen oyuncunun 4'ü yanlış
  olabilir. "Açtığın harf" anlamı isteniyorsa sayı `hitLetters.size` (istemcide zaten var,
  `Spotlight/index.tsx:392` `hitLetters` — sunucu `revealed`'dan türetilir) olur. Bu bir ürün kararı.

### N = 0 için metin önerisi (UYGULAMA YOK)
i18n-js 4.5.3 varsayılan çoğullayıcı `count === 0` için önce `zero` anahtarını dener
(`node_modules/i18n-js/dist/require/pluralization.js:6-16`); projede `one/other` nesneleri
zaten kullanılıyor (`locales/en.json:573, 1450, 1485`).

```json
// en
"result_won_letters": {
  "zero": "Got it without a single letter!",
  "one": "Found it with 1 letter!",
  "other": "Found it with %{count} letters!"
}
// tr
"result_won_letters": {
  "zero": "Tek harf açmadan buldun!",
  "one": "1 harfle buldun!",
  "other": "%{count} harfle buldun!"
}
```
Kod değişmez (`count` zaten geçiyor). Parite: iki dosyada da +4 satır. "letter(s)" de böylece
düzgün çoğul olur. Sayının anlamı (tüm denenenler vs. isabetler) değişirse "zero" metni de
ona göre okunmalı: isabet sayılırsa "tek harf açmadan" doğru; tüm denenenler sayılırsa
"hiç harf denemeden" daha doğru (TR: "Hiç harf denemeden buldun!").

## DUR NOKTASI

1. B1 Spotlight'a yerel; **GameShell'e** taşınırsa (header dokunuşu da kapatsın) 5 donmuş oyunu
   etkiler — karar.
2. B2'yi liste ScrollView'ına uygulamak A1 kuralını değiştirmeyi gerektirir — önerilmiyor.
3. N'in anlamı: denenen harfler (bugün) mi, açılan harfler mi — ürün kararı.

## Doğrulanamayanlar

- Cihaz gözlemi hangi alana dokunularak yapıldı — bilinmiyor; tablo tüm yüzeyleri listeliyor.
- Kapat satırının 4+ sonuçta görünürlüğü — koddan; cihaz ekran görüntüsü yok.
- Pro Max'te karenin üstüne dokunmanın listeyi kapattığı — koddan.
