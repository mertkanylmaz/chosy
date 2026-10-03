# P-2 KEŞİF — Spotlight kare kırpması + sonuç reveal

Temel: master `fbaee25`. Salt okunur. Kod değişikliği yok, commit yok, OTA yok.
Tarih: 4 Eki 2026.

## Yönetici özeti

1. **Oyun karesi 16:9 kutuda değil.** Kutu genişliği sabit (`ekran − 32pt`), yüksekliği
   ölçülen alandan 150–380pt arasında pay biçiliyor; `contentFit="cover"` + varsayılan
   merkez konum. Kutu 16:9'dan uzun olduğu her durumda (iPhone 15'te H > 203pt)
   **yanlardan** kırpılıyor; H=380'de kaynağın yalnız ortadaki **~%53'ü** görünüyor.
2. **Beau Travail (bugün) bu kırpmanın en kötü örneği:** backdrop 1920×1080 (ölçüldü);
   figür karenin sağ kenarında (x ≈ 1260–1810). H=380 / 361pt kutuda görünen bölge
   x 447–1473 → ekranda büyük ölçüde **düz mavi gökyüzü**, figürün yalnız sol kenarı.
3. **Sonuç ekranı kareyi hiç çizmiyor.** `ResultCard` yalnız poster alıyor;
   `revealed_solution` içinde `backdrop_url` **yok**. Ama `puzzleData.backdrop_url`
   tamamlanmış durumda da istemcinin state'inde duruyor → netleşme için **sunucu
   değişikliği / yeni alan gerekmiyor.**
4. **"Back to Hub"** → `router.back()`. Bugünkü IA'da tek giriş bonus kartı olduğu için
   pratikte şampiyon ekranına döner; etiket artık var olmayan bir hub'ı adlandırıyor.
5. Kırpma için içerik-farkındalıklı konum (odak noktası) istenirse film başına veri
   gerekir → **DUR noktası**. Saf istemci seçenekleri (kutu oranı) mevcut.

## 1. Oyun ekranı görsel kutusu

| Konu | Değer | Kaynak |
|---|---|---|
| Kutu genişliği | `STILL_W = SCREEN_W − 2×16` | `components/games/Spotlight/styles.ts:26` |
| Kutu yüksekliği | `clamp(fit.height − maskFit.height − 24, 150, 380)`; ölçülmeden önce 150 | `components/games/Spotlight/index.tsx:212-214`, sabitler `:80-85` |
| Kutu stili | radius lg, `overflow: 'hidden'`, height runtime | `styles.ts:84-93` |
| Görsel | `expo-image`, `contentFit="cover"`, `contentPosition` **verilmemiş** (merkez) | `index.tsx:561-567` |
| Kaynak | `puzzleData.backdrop_url` (TMDb `/t/p/original/`) | `index.tsx:562` |
| Blur | `blurRadius={blurAmount}`; `blurForProgress` = `round(40 × (1 − açılan/letter_count))` | `index.tsx:91-94`, `:435`; `MAX_BLUR=40` `components/games/Spotlight/constants.ts:12` |

Blur yalnız açılan **harf** oranına bağlı; film tahminiyle kazanılınca oynanış ekranı
hemen `completed`'a geçer ve kare bir daha çizilmez (`index.tsx:376-384`, `:481`).
Yani oyuncu kareyi netleşmiş hâliyle **hiçbir zaman** görmez — tüm harfleri açması
dışında (o da pratikte kazanma tahminiyle kesilir).

### Kırpma geometrisi (cover, merkez)

16:9 kaynakta kutu oranı `W/H`:
- `W/H < 1.778` (kutu daha uzun) → yanlardan kırpma; görünen kaynak genişliği = `1080 × W/H` px.
- `W/H > 1.778` (kutu daha basık) → üst/alttan kırpma; görünen kaynak yüksekliği = `1920 × H/W` px.

| Cihaz (pt) | STILL_W | 16:9 eşiği H | H=380 → görünen x | H=150 → görünen y |
|---|---|---|---|---|
| 375 (SE) | 343 | 193 | 975 px, x 473–1447 (%51) | 840 px, y 120–960 |
| 393 (15) | 361 | 203 | 1026 px, x 447–1473 (%53) | 798 px, y 141–939 |
| 430 (Pro Max) | 398 | 224 | 1131 px, x 394–1526 (%59) | 724 px, y 178–902 |

Bonus kartı (`SpotlightBonusCard`) 56×56 kare (`size.touchTarget 44 + space.md 12`,
`components/gauntlet/SpotlightBonusCard/styles.ts:21`, `:38-46`), `cover`, `blurRadius=40`
(`index.tsx:159-165`): görünen x 420–1500 (%56). Max blur'da olduğu için etkisi sınırlı.

### Beau Travail ölçümü

- `daily_puzzles` 2026-10-04 spotlight → `b3afe3f1-…`, `v=3`,
  `puzzle_data.backdrop_url = films.backdrop_url =
  https://image.tmdb.org/t/p/original/1C84Yg3F2CgGJlOilvXBP8OZCMB.jpg`
- HEAD: `image/jpeg`, `Content-Length: 268053`
- İndirilip `System.Drawing` ile ölçüldü: **1920 × 1080** (oran 1.7778)
- Kompozisyon (görsel inceleme, göz kararı): sol ~%65 düz mavi gökyüzü; figür
  x ≈ 1260–1810, baş x ≈ 1400–1610, y ≈ 65–330.
- Sonuç: 361×380 kutuda görünen x 447–1473 → başın yarısı ve gövdenin sol şeridi
  dışında her şey gökyüzü. 343pt (SE) kutuda kesim x 1447'de → baş çoğunlukla dışarıda.
  Kutu ≤ ~203pt olursa (16:9) kare tam görünür.

## 2. Sonuç ekranı (ResultCard)

| Konu | Bulgu | Kaynak |
|---|---|---|
| Spotlight'ın geçirdiği prop'lar | `filmPosterUrl={revealedFilm?.poster_url}`; backdrop prop'u yok | `components/games/Spotlight/index.tsx:496-523` |
| ResultCard arayüzü | Yalnız `filmPosterPath` / `filmPosterUrl`; backdrop alanı yok | `components/games/ResultCard/index.tsx:49-103` |
| Kahraman görsel | 148×222 poster, `cover` | `ResultCard/index.tsx:206-231` |
| `RevealedFilm` tipi | `film_id, title, year, director, poster_url` — backdrop yok | `types/game.ts:214-221` |
| `revealed_solution` (resume) | `films`'ten `title, year, director, poster_url…`; backdrop seçilmiyor | `supabase/functions/get-daily-challenge/index.ts:262-283` |
| `revealed_solution` (harf ile bitiş) | aynı 5 alan | `supabase/functions/submit-guess/index.ts:561-574` |
| `revealed_solution` (tahmin ile bitiş) | aynı 5 alan | `submit-guess/index.ts:783-789`, `:1568-1574` |
| `puzzle_data` tamamlanmışta da dönüyor | evet, `public_daily_puzzles` view'ından her durumda | `get-daily-challenge/index.ts:143-148`, `:361-369` |
| İstemci tamamlanmışta da tutuyor | `setPuzzleData(pd)` `progress.completed` kontrolünden **önce** | `Spotlight/index.tsx:263` vs `:272-276` |
| Oturum içi bitişte | `puzzleData` state'i sıfırlanmıyor | `index.tsx:320-327`, `:376-384` |

→ Kare URL'si sonuç ekranında istemcide zaten mevcut; `revealed_solution`'a alan
eklemek gerekmiyor.

## 3. "Back to Hub" butonu

| Konu | Bulgu | Kaynak |
|---|---|---|
| Etiket anahtarı | `games.result.back_to_hub` | `ResultCard/index.tsx:338` |
| Metin | EN "Back to Hub" · TR "Hub'a Don" | `locales/en.json:1201`, `locales/tr.json:1201` |
| Görünürlük | `onBackToHub` verilirse | `ResultCard/index.tsx:328-340` |
| onPress | `hapticLight()` → `onBackToHub()` → `router.back()` | `ResultCard/index.tsx:332-335`, `Spotlight/index.tsx:522` |
| Bugünkü giriş noktası | bonus kartı `router.push('/games/spotlight')` | `components/gauntlet/SpotlightBonusCard/index.tsx:121` |
| Diğer `/games/spotlight` referansları | `app/games/index.tsx:69`, `components/Discover/GamesSection/index.tsx:68`, `components/games/PlayNextBridge/index.tsx:36` | — |

Bonus kartı yolunda `router.back()` şampiyon ekranına döner. IA §2.6 "ayrı hub yok"
(`SpotlightBonusCard/index.tsx:4-7`) — etiket var olmayan bir hedefi adlandırıyor.

## 4. Sonuçta netleşme (blur → 0) için gereken değişiklikler

Hepsi **istemci**; sunucu response'u ve yeni alan **gerekmiyor**.

| # | Değişiklik | Dosya | Büyüklük |
|---|---|---|---|
| a | Tamamlanmış dalda kareyi çiz: `puzzleData.backdrop_url`, `blurRadius` 40→0 geçişi (ya da doğrudan 0) | `components/games/Spotlight/index.tsx:481-528` | S |
| b1 | Seçenek: kareyi Spotlight'ın tamamlanmış dalında, `ResultCard`'ın **üstünde** ayrı blok olarak çiz — `ResultCard` arayüzü değişmez | `Spotlight/index.tsx` + `styles.ts` | S |
| b2 | Seçenek: `ResultCard`'a opsiyonel `heroImageUrl` prop'u — 7 oyunun ortak bileşeni (6'sı donmuş) | `components/games/ResultCard/index.tsx`, `styles.ts` | M |
| c | Sonuç karesinde kırpmayı önlemek için kutuyu 16:9 (`aspectRatio`) yap | ilgili styles | S |
| d | Blur geçişi animasyonu: `expo-image` `blurRadius` prop'u animasyonlu değil; geçiş için iki katman crossfade ya da `transition` | `Spotlight/index.tsx` | S–M |
| e | "Back to Hub" etiketi (EN+TR parite) — kapsam P-2'ye dahilse | `locales/en.json:1201`, `tr.json:1201` | S |

Kural notları:
- Spotlight kural 5: `backdrop_url` **paylaşım görselinde** yer almaz. `ResultCard`'ın
  offscreen `GameShareCard`'ı (`ResultCard/index.tsx:191-202`) ayrı; b2 seçilirse
  prop'un `GameShareCard`'a geçmemesi gerekir.
- Kural 11: sonuç ekranında kare göstermek çözüm sızıntısı değil — kare oynanışta da
  istemcide (`puzzle_data`), sonuç zaten açık.
- Kural 10 (retrofit'te logic değişmez): a–e hiçbiri oyun/sunucu mantığına dokunmuyor.

## DUR NOKTASI gerektiren maddeler

- **Oyun ekranında içerik-farkındalıklı kırpma** (Beau Travail tipi kenar kompozisyonu):
  `contentPosition`'ı film başına doğru ayarlamak için odak noktası verisi gerekir →
  `puzzle_data`'ya ya da `films`'e **yeni alan** → CTO onayı. Saf istemci alternatifi
  (oyun kutusunu 16:9'a sabitlemek) kare tam görünür ama `STILL_MIN/MAX` yerleşim
  kararını (Kural 4, `index.tsx:201-211`) değiştirir → ürün/tasarım kararı.
- **b1 vs b2 seçimi**: b2 donmuş oyunların ortak bileşenine arayüz ekler; mimari değil
  ama kapsam kararı.

## Doğrulanamayanlar

- Gerçek cihazda `stillHeight`'in hangi değere oturduğu (ölçüm runtime `onLayout`) —
  cihaz/simülatör çalıştırılmadı. Tablo 150 ve 380 uçlarını ve 16:9 eşiğini veriyor.
- Figür koordinatları görsel incelemeyle göz kararı alındı, piksel analiziyle değil.
- `expo-image` `blurRadius=40`'ın iOS/Android'de piksel mi pt mi yorumlandığı ve
  `/original/` (1920px) üzerinde algılanan bulanıklık — doğrulanmadı.
- `router.back()`'in geçmiş yokken (deep link / soğuk açılış) davranışı — test edilmedi.
- `app/games/index.tsx`, Discover `GamesSection`, `PlayNextBridge` girişlerinin bugün
  erişilebilir olup olmadığı — bu turda izlenmedi.
