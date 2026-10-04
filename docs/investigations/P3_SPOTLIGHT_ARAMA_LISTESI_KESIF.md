# P-3 KEŞİF — Spotlight arama listesi + backdrop bütünlüğü

- Temel: `ota/s1-s2-p1-p2` @ `4b1c5b6` · Tarih: 4 Eki 2026
- Mod: READ-ONLY. Kod değişikliği yok, commit yok (iş tanımı "commit yok" dedi), OTA yok.
- Canlı veri: `supabase db query --linked` (SELECT) + TMDb `/movie/{id}/images` ve `/movie/{id}` (GET).
  TMDb anahtarı `.env` → `EXPO_PUBLIC_TMDB_API_KEY`; değer hiçbir çıktıya yazılmadı.

## Yönetici özeti

1. **Listeyi kapatan tek "niyetli" yol bir sonuca dokunmak ya da X'tir.** Dışarı dokunma,
   blur, kaydırma ve geri tuşu listeyi kapatmaz. Dışarı dokunma sistem klavyesini kapatır
   ama liste açık kalır ve bu kez *daha büyük* çizilir (`FilmSearchInput/index.tsx:79-90`,
   onBlur yok `:182-194`).
2. **Liste her geometride önce harf klavyesini örter.** Dropdown input'un hemen üstüne
   yapışık açılır; aradaki tek şey harf klavyesi + etiket (`Spotlight/index.tsx:644-671`).
   1 sonuç ZXCVBNM satırını, 3 sonuç 26 tuşun tamamını kapatır — SE'de de Pro Max'te de.
   Liste açıkken harf tuşlarına erişim yok.
3. **Sonuca dokunmak tahmini onaysız gönderir ve yanlışsa 1 hak düşer**
   (`FilmSearchInput/index.tsx:123-133` → `Spotlight/index.tsx:327-341` →
   `submit-guess/index.ts:676, 690-698`). Aynı yanlış filmi ikinci kez seçmek de bir hak
   daha götürür — sunucuda Spotlight film tahmini için tekrar kontrolü yok (harf için var,
   `:474-476`).
4. **Debounce kalıntısı listeyi geri açabilir:** X ve seçim, bekleyen 300 ms zamanlayıcıyı
   iptal etmiyor (`:105-120`, `:123-133`, `:199-203`). Yazıp 300 ms içinde X'e basınca
   liste boş sorguyla yeniden açılır.
5. **Backdrop: önümüzdeki 10 Spotlight bulmacasının 10'u da textless (`iso_639_1 = null`).**
   Ancak bu bir seçim kuralının sonucu değil: `backdrop_url`, TMDb `/movie/{id}` detay
   yanıtındaki `backdrop_path`'in kopyası; kodda `/images` çağrısı veya dil filtresi yok.
   "~25 gün" ölçülemedi — DB'de yalnızca 13 Eki'ye kadar 10 bulmaca var.

## 1. Liste nasıl açılıyor / kapanıyor

### Açılma
| Yer | Davranış |
|---|---|
| `components/games/FilmSearchInput/index.tsx:95-121` | `onChangeText` → 300 ms debounce → `searchFilms(text, catalogOnly)` → `setShowDropdown(films.length > 0)` (`:109`) |
| `:138-177` | `showDropdown` true iken `results.slice(0, 6)` çizilir — en fazla 6 satır |
| `styles.ts:39-55` | `position: 'absolute'`, `bottom: 52 + 4` → input'un ÜSTÜNE açılır; `maxHeight` runtime'da |
| `dropdownHeight.ts:36-39` | `maxHeight = min(280, inputTopY − 4 − boundaryTopY)`; `boundaryTopY` = GameShell içerik üstü (`index.tsx:65-66`) |

### Kapanma yolları (mevcut)
| Yol | Kapatıyor mu? | Kanıt |
|---|---|---|
| Sonuca dokunma | Evet (+ `Keyboard.dismiss`, sorgu temizlenir) | `index.tsx:123-133` |
| X (XCircle) | Evet, sorguyu da siler; yalnız `query.length > 0` iken görünür | `:195-207` |
| Metni 2 karakterin altına silmek | Evet | `:99-103` |
| Aramanın 0 sonuç / hata dönmesi | Evet | `:109`, `:117-118` |
| Dışarı dokunma | **Hayır.** Üst bölge ScrollView'ı `keyboardShouldPersistTaps="handled"` (`Spotlight/index.tsx:544`) → dokunuş sistem klavyesini kapatır, ama `showDropdown` değişmez; `keyboardDidHide` yeniden ölçüm yapar (`:79-86`) → liste daha yüksek çizilir | `index.tsx:79-90` |
| TextInput blur | **Hayır** — `onBlur` prop'u yok | `:182-194` |
| Kaydırma | **Hayır** — dropdown ScrollView'ında `onScroll`/`keyboardDismissMode` yok | `:140-144` |
| Android donanım geri | **Hayır** — `BackHandler` yok; geri ekranı kapatır | dosyada `BackHandler` geçmiyor |
| Harf tuşuna basma | **Hayır** (zaten çoğu durumda örtülü, bkz. §1 geometri) | `Spotlight/index.tsx:657-660` |
| Ekran unmount | Evet (state ile birlikte) — ancak debounce zamanlayıcısı unmount'ta temizlenmiyor | `index.tsx:57`, cleanup yok |

### Liste neyi örter
Oynanış düzeni yukarıdan aşağı: üst bölge (kare + maske, kayar) → hata kutusu →
aksiyon barı = **harf klavyesi** (`Spotlight/index.tsx:646-665`) → "Hangi film?" etiketi →
**arama input'u** (`:668-671`). Dropdown input'tan yukarı büyüdüğü için örtme sırası her
zaman: etiket → ZXCVBNM → ASDFGHJKL → QWERTYUIOP → (kalan yükseklik varsa) üst bölge.
`FilmSearchInput` kabı `zIndex: 10` (`styles.ts:20-23`) ve `guessArea` harf klavyesinden
sonra render ediliyor → görsel olarak üstte.

**Dokunuş:** iOS'ta (yeni mimari varsayılan; `app.json`'da `newArchEnabled` geçmiyor →
SDK 54 varsayılanı) taşan, `overflow: visible` çocuk dokunuş alır → örtülü harf tuşları
dokunulamaz. **Android'de** taşan dropdown satırlarının dokunuş alıp almadığı, yoksa
dokunuşun altındaki harf tuşuna mı düştüğü **doğrulanamadı** (bkz. Doğrulanamayanlar).

### Geometri (kod okumasından, `tests/games/spotlightLayout.test.ts:8-12, 150-166` modeliyle)

Sabitler: input 52, gap 4, sonuç satırı = 8+54+8 + hairline ≈ **70.5**, dropdown kenarlığı 2 →
n sonuç ≈ 70.5n + 2 (üst sınır `maxHeight`). Aksiyon barı 216 = harf klavyesi 134
(3×42 + 2×4) + 8 + etiket 14 + 8 + input 52. iOS alt pay = klavye yüksekliği
(KAV `padding` modu GameShell `paddingBottom`'unu ezer — test dosyası `:138-147`).
`inputTopY = H − K − 8 − 52`; harf satırları `inputTopY − 164` ile `inputTopY − 30` arası.

| Senaryo | inputTopY | maxHeight | Harf satırları (y) | 1 sonuç örter | 2 sonuç | ≥3 sonuç | ≥4 sonuç (tavan) |
|---|---|---|---|---|---|---|---|
| SE 667, içerik üstü 109, sistem klavyesi **216** | 391 | 278 | 227–361 | ZXCVBNM (319–361) | + ASDF; QWERTY'nin 25/42pt'si | 26 tuşun tamamı + üst bölgenin alt 54pt'si | 109–387: header altından input'a kadar her şey (kare + maske dahil) |
| SE, sistem klavyesi **260** (QuickType) | 347 | 234 | 183–317 | ZXCVBNM | + ASDF; QWERTY kısmen | tamamı | 109–343: üst bölgenin tamamı (58pt) |
| SE, sistem klavyesi **kapalı** (dışarı dokunuş sonrası liste açık kalırsa) | 607 | 280 | 443–577 | ZXCVBNM | + ASDF; QWERTY kısmen | tamamı | 323–603: tuşlar + maske/kare alt ~120pt |
| Pro Max 932, içerik üstü 148, sistem klavyesi **336 (varsayım)** | 536 | 280 | 372–506 | ZXCVBNM | + ASDF; QWERTY kısmen | tamamı + üst bölgenin alt ~53pt'si | 252–532 |
| Pro Max, sistem klavyesi kapalı | 872 | 280 | 708–842 | ZXCVBNM | + ASDF; QWERTY kısmen | tamamı | 588–868 |

Sonuç: dropdown'ın harf klavyesini örtmesi ekran boyutundan bağımsız, düzenin yapısından
geliyor. SE + QuickType'ta input ile header arasında kalan 234pt'nin 134'ü harf klavyesi;
dropdown'a harf klavyesini örtmeden yer açmak bu geometride mümkün değil.

## 2. Listeden dokunma → tahmin

| Adım | Kanıt |
|---|---|
| Satır `TouchableOpacity.onPress` → `handleSelect` | `FilmSearchInput/index.tsx:148-153` |
| `handleSelect` → `onSelect(film)` doğrudan; ara onay yok | `:123-133` |
| Spotlight `onSelect={handleGuess}` | `Spotlight/index.tsx:670` |
| `handleGuess` → `submitSpotlightGuess(puzzleId, filmUuid)` | `:327-341` |
| Sunucu: `newAttempts = scoreRow.attempts + 1`, yanlışsa da artar | `supabase/functions/submit-guess/index.ts:676`, `:690-698` |
| Sunucu: aynı film ikinci kez → tekrar kontrolü yok, yeni hak harcanır | `:684-700` (harf dalındaki `LETTER_ALREADY_TRIED` `:474-476` karşılığı yok) |
| İstemci önceki yanlış film tahminlerini göstermiyor (`spotlight_guesses` UI'da okunmuyor) | `Spotlight/index.tsx` — yalnız `guesses.length` okunuyor `:240` |

**Hak düşüyor mu:** Evet. Yanlış film tahmini harfle aynı havuzdan (6) 1 hak götürür
(`Spotlight/index.tsx:63-64`, `:342`).

**Kaydırma sırasında yanlış dokunma koruması:**
- RN ScrollView, kaydırma başlayınca responder'ı alır ve `TouchableOpacity`'nin `onPress`'ini
  iptal eder; momentum sırasında yapılan dokunuş da ScrollView'a gider. Bu RN'in varsayılan
  davranışı — Chosy kodunda ek bir koruma yok.
- `showsVerticalScrollIndicator={false}` (`:143`): 4+ sonuçta listenin kaydırılabilir olduğu
  görünmüyor.
- `disabled={isBusy}` yalnız `editable`'ı kapatıyor (`:188`); dropdown satırları busy iken de
  dokunulabilir, ancak `handleGuess` `isBusy` ile çıkıyor (`Spotlight/index.tsx:329`) → çift
  gönderim yok.
- Onay adımı, geri alma veya "bu filmi zaten denedin" uyarısı yok.

### Ek bulgular (aynı bileşen)
- **Debounce kalıntısı:** X (`:199-203`) ve `handleSelect` (`:123-133`) `debounceRef`'i
  temizlemiyor. Senaryo: "ar" yaz → 300 ms dolmadan X → zamanlayıcı çalışır, liste boş
  input'un üstünde "ar" sonuçlarıyla açılır. Aynı şekilde 3. harfi yazıp eski listeden hemen
  seçim yapılırsa tahmin gönderilir ve ardından liste yeniden açılır.
- **Yanıt sırası:** istekler sıralanmıyor; yavaş eski yanıt yeni sorgunun sonuçlarını ezebilir
  (`:105-109`, istek kimliği/iptal yok).

## 3. Öneri (A) — UYGULAMA YOK, karar CTO'da

Aşağıdakiler seçenek ve risk dökümüdür.

| # | Değişiklik | Dosya | Büyüklük | Risk |
|---|---|---|---|---|
| A1 | `TextInput onBlur` → listeyi kapat (dışarı dokunma + klavye kapanması aynı yoldan kapanır) | `FilmSearchInput/index.tsx:182-194` | S | Satıra dokunuşta blur'un `onPress`'ten önce gelmemesi `keyboardShouldPersistTaps="handled"`'a (`:141`) bağlı — cihazda doğrulanmalı. Spotlight dışındaki dondurulmuş oyunlar da (CineMetrics, Detective, FadeIn, Logline, Quoted) aynı bileşeni kullanıyor. |
| A2 | Görünür kapat: dropdown'ın en altında (input'a yakın) "Kapat" satırı/tutamacı; X sorguyu silerken bu yalnız listeyi kapatır | `index.tsx:138-177`, `styles.ts` | S–M | Yeni i18n anahtarı (en+tr parite). Liste yüksekliği hesabına satır eklenir → `dropdownHeight.ts` testleri (`spotlightLayout.test.ts:168-190`) güncellenmeli. |
| A3 | Debounce temizliği: X, seçim ve unmount'ta `clearTimeout` | `index.tsx:123-133, 199-203`, yeni cleanup effect | S | Düşük; davranış değişikliği yalnız hatalı yeniden açılmayı keser. |
| A4 | Harf tuşlarına erişim | — | — | Geometri §1: SE + QuickType'ta dropdown'ı harf klavyesinin *üstüne* taşımak için yer yok (üst bölge 58pt). Pratik seçenekler: (a) liste açıkken harf klavyesi bilinçli olarak "duraklatılmış" sayılır ve A1+A2 ile kapatma kolaylaşır; (b) liste en fazla N satırla sınırlanır (ör. 2 → yalnız alt 2 satır örtülür) — sonuç görünürlüğünü azaltır; (c) dropdown'ın sınırı aksiyon barının üstü yapılır — paylaşılan bileşene yeni ölçüm/prop gerekir. (c) yeni pattern sayılır → **DUR**. |
| A5 | Liste kaydırılabilirliğini göstermek (`showsVerticalScrollIndicator`) | `index.tsx:143` | S | Görsel; düşük. |

Etkilenen testler: `tests/games/spotlightLayout.test.ts` — dropdown bölümü (`:136-190`) ve
aksiyon barı modeli (`:150-166`, 216pt sabiti) yalnızca yükseklik/düzen değişirse. Başka
`FilmSearchInput` testi yok (`grep FilmSearchInput tests/` → yalnız bu dosya).
`npm run test:founder` kapsamında bu bileşen yok (doğrulanmadı — test dosyaları okunmadı).

## 4. Backdrop bütünlüğü

### Seçim yolu
| Adım | Kanıt |
|---|---|
| Bulmaca `backdrop_url`'i `films.backdrop_url`'in birebir kopyası | `supabase/functions/generate-puzzles/index.ts:862-866`; havuz filtresi `:512-514`, `:625-640` |
| `films.backdrop_url` yazanlar: TMDb **`/movie/{id}` detay** yanıtının `backdrop_path`'i | `supabase/functions/sync-trending/index.ts:255` (istek `:477-480`, `language=en-US` `:194`); `scripts/fetch-films.ts:336-337`; `scripts/add-missing-films.ts:164`; `scripts/seed-database.ts:301` (devre dışı, `:4`) |
| `/images` çağrısı veya `include_image_language` / `iso_639_1` filtresi | **Yok** — repo genelinde `backdrop_path|/images|include_image_language` araması kod tarafında yalnız yukarıdaki detay çağrılarını buldu |

Yani backdrop'un textless olması bir kural tarafından garanti edilmiyor; TMDb'nin o anki
varsayılan seçimine bağlı.

### Ölçüm — Spotlight bulmacaları, 4 Eki 2026 ve sonrası

Sorgu:
```sql
select p.date, p.validation_status, f.tmdb_id, f.title, f.year,
       p.puzzle_data->>'backdrop_url' as pd_backdrop, f.backdrop_url as film_backdrop
from daily_puzzles p join films f on f.id = p.solution_ref
where p.game_type = 'spotlight' and p.date >= date '2026-10-04'
order by p.date;
```
→ **10 satır** (4–13 Eki), hepsi `validation_status = valid`, hepsinde `pd_backdrop = film_backdrop`.

Her biri için TMDb `/movie/{tmdb_id}/images` (dil parametresiz) listesinde dosya arandı:

| Tarih | Film | tmdb_id | Dosya `/images`'ta | `iso_639_1` | Boyut | Listede sıra | Textless / toplam | Detay `backdrop_path` bugün aynı mı |
|---|---|---|---|---|---|---|---|---|
| 10-04 | Beau Travail | 14626 | evet | **null** | 1920×1080 | 0 | 62/67 | aynı |
| 10-05 | The King's Speech | 45269 | evet | **null** | 1920×1080 | 1 | 12/19 | **farklı** |
| 10-06 | Das Boot | 387 | evet | **null** | 1920×1080 | 1 | 27/37 | **farklı** |
| 10-07 | Sherlock Holmes | 10528 | evet | **null** | 3840×2160 | 0 | 30/48 | aynı |
| 10-08 | Wheel of Fortune and Fantasy | 795811 | evet | **null** | 3840×2160 | 0 | 26/45 | aynı |
| 10-09 | Whisper of the Heart | 37797 | evet | **null** | 3840×2160 | 0 | 62/71 | aynı |
| 10-10 | Stand by Me | 235 | evet | **null** | 3840×2160 | 0 | 62/74 | aynı |
| 10-11 | Frances Ha | 121986 | evet | **null** | 3840×2160 | 0 | 33/38 | aynı |
| 10-12 | Arrival | 329865 | evet | **null** | 3840×2160 | 2 | 50/70 | **farklı** |
| 10-13 | Magnolia | 334 | evet | **null** | 3840×2160 | 0 | 92/101 | aynı |

- **Dolu `iso_639_1` (yazılı/logolu) backdrop: 0/10.** Liste boş.
- 3/10 filmde TMDb detay yanıtı bugün başka bir `backdrop_path` döndürüyor; DB'deki değer
  eski bir anlık görüntü. Bugün yeniden çekilseydi seçilecek dosyaların `iso_639_1`'i ölçülmedi.
- Tüm kareler 16:9 (P-2 16:9 kutu varsayımıyla uyumlu).

## DUR NOKTASI gerektiren maddeler

1. **Onay adımı / geri alma** (listeden dokunma = anında hak harcama) — ürün/UX kararı.
2. **Aynı yanlış filmi tekrar tahmin etmenin hak götürmesi** — düzeltme `submit-guess`
   Edge Function'ında Spotlight davranış değişikliği (sunucu doğrulama kuralı) → CTO onayı.
3. **A4(c)** — paylaşılan `FilmSearchInput`'a aksiyon barı sınırı için yeni ölçüm/prop:
   yeni pattern + dondurulmuş 5 oyunu da etkiler.
4. **Textless garantisi** — `iso_639_1` filtresiyle `/images`'tan seçim yapmak yeni bir
   veri yolu (yeni TMDb çağrısı, muhtemelen yeni kolon veya `puzzle_data` alanı) → mimari karar.
5. A2 yeni i18n anahtarı ister (kural 7 kapsamında, mimari değil — bilgi için).

## Doğrulanamayanlar

- **"~25 gün"**: DB'de 13 Eki 2026'dan sonra Spotlight bulmacası yok; 14–28 Eki için ölçülecek
  satır olmadığından ölçülemedi. Üretim takvimi/cron ufku bu turda incelenmedi.
- **Android dokunuş davranışı**: taşan dropdown satırlarının Android'de dokunuş alıp almadığı
  (yoksa altındaki harf tuşuna düşüp harf hakkı yakıp yakmadığı) cihazda denenmedi.
- **Pro Max sistem klavyesi yüksekliği** (336) varsayım; ölçülmedi. Sonuç (≥3 sonuçta 26 tuş
  örtülü) 216–346 aralığındaki her değer için aynı.
- Satır yüksekliği 70.5pt kod okumasından; cihazda ölçülmedi (AX font boyutunda `resultTitle`/
  `resultYear` için `maxFontSizeMultiplier` yok → satır büyüyebilir).
- Momentum kaydırma sırasındaki dokunuşun satırı tetiklemediği RN varsayılanına dayanıyor;
  cihazda denenmedi.
