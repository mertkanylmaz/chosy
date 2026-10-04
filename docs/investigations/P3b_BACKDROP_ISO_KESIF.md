# P-3b KEŞİF — Editoryal havuzun backdrop `iso_639_1` taraması

- Tarih: 4 Eki 2026 · Mod: READ-ONLY (kod yok, deploy yok)
- Canlı veri: `supabase db query --linked` (SELECT) + TMDb `/movie/{id}/images` (GET, 400 çağrı)
  + `image.tmdb.org` (GET, 5 dosya). TMDb anahtarı `.env` → `EXPO_PUBLIC_TMDB_API_KEY`;
  değer hiçbir çıktıya yazılmadı.

## Yönetici özeti

1. **Editoryal havuz = 400 film** (`editorial_calendar_films`, 400 satır / 400 tekil film);
   400'ünün de `backdrop_url`'i ve `tmdb_id`'si dolu, hepsi mutlak URL (ham yol yok).
2. **Seçili backdrop'u `/images`'ta bulunan 396 filmden 395'i textless (`iso_639_1 = null`),
   1'i dolu:** Jurassic Park (`pi`).
3. **4 filmin seçili backdrop'u TMDb `/images` listesinde artık yok** (Lethal Weapon,
   Cold War, The Big Lebowski, Interstellar). Dosyalar CDN'de hâlâ 200 dönüyor;
   `iso_639_1` bu yüzden ölçülemedi.
4. Görsel kontrol (w300, 5 dosya: 1 dolu + 4 bulunamayan): hiçbirinde okunur metin görmedim.
   Jurassic Park ve The Big Lebowski backdrop'ları film karesi değil, illüstrasyon/key-art.
5. Ölçülen 396 backdrop'un tamamı 16:9 (oran 1.775–1.780) — P-2'nin 16:9 kutu varsayımıyla uyumlu.

## Bulgular tablosu

| Kaynak | Açıklama | Büyüklük |
|---|---|---|
| `supabase/functions/generate-puzzles/index.ts:596-640` | Spotlight havuzu `editorial_calendar_films → films`'ten okunur; `backdrop_url` olduğu gibi `puzzle_data`'ya kopyalanır (`:862-866`). `iso_639_1` filtresi yok. | — |
| Jurassic Park (tmdb 329, gün 29, pozisyon 1) | `iso_639_1 = "pi"` (ISO 639-1'de Pali); 3840×2160; 244 backdrop'un 172'si textless. Görsel: illüstrasyon, w300'de metin yok. | S (veri) |
| Lethal Weapon (941, gün 85, poz. 2) | Dosya `/4T2d3Ww0pNRFYS9eWHyDjkJSovq.jpg` `/images`'ta yok (42 backdrop, 21 textless). CDN 200. Görsel: film karesi, metin yok. | S (veri) |
| Cold War (440298, gün 18, poz. 1) | `/dXwXcBGK8LJ6UQVvuWM3qG6m6Co.jpg` `/images`'ta yok (57/50). CDN 200. Görsel: film karesi, metin yok. | S (veri) |
| The Big Lebowski (115, gün 5, poz. 3) | `/hXsy4XCCHrUk81XoRhcooyWejao.jpg` `/images`'ta yok (94/77). CDN 200. Görsel: illüstrasyon, metin yok. | S (veri) |
| Interstellar (157336, gün 64, poz. 1) | `/2ssWTSVklAEc98frZUQhgtGHx7s.jpg` `/images`'ta yok (187/154). CDN 200. Görsel: film karesi, metin yok. | S (veri) |

## Ölçülmüş sayılar

Havuz sorgusu:
```sql
select distinct on (f.id) f.id, f.tmdb_id, f.title, f.year, f.backdrop_url, e.day_number, e.position
from editorial_calendar_films e join films f on f.id = e.film_id
order by f.id, e.position;
-- 400 satır; backdrop_url null: 0; tmdb_id null: 0; http olmayan backdrop_url: 0

select count(*) as rows, count(distinct film_id) as films from editorial_calendar_films;
-- rows 400, films 400
```

TMDb taraması (her film için `/movie/{tmdb_id}/images`, dil parametresiz; dosya adı
`backdrop_url`'in son segmenti):

| Durum | Adet |
|---|---|
| Toplam | 400 |
| `/images`'ta bulundu | 396 |
| — `iso_639_1 = null` (textless) | **395** |
| — `iso_639_1` dolu | **1** (Jurassic Park, `pi`) |
| `/images`'ta yok | 4 |
| HTTP hatası | 0 |

En-boy oranı (bulunan 396): 1.778 ×378, 1.777 ×11, 1.780 ×4, 1.779 ×2, 1.775 ×1.

## DUR NOKTASI gerektiren maddeler

1. **`iso_639_1` dolu ya da `/images`'tan düşmüş backdrop'ların değiştirilmesi** — `films.backdrop_url`
   üzerinde veri düzeltmesi (5 film). Hangi dosyanın seçileceği ve bunun migration ile mi
   yapılacağı karar ister.
2. **Kalıcı textless garantisi** — seçimi `/images` + `iso_639_1 is null` filtresine bağlamak yeni
   veri yolu (P-3 keşif raporu, DUR #4 ile aynı madde).
3. **İllüstrasyon/key-art backdrop'lar** — Spotlight "filmden bir kare" soruyor; en az 2 filmde
   (Jurassic Park, The Big Lebowski) seçili backdrop film karesi değil. Havuzun geri kalanında
   kaç tane olduğu ölçülmedi; ürün kararı.

## Doğrulanamayanlar

- **Bulunamayan 4 dosyanın `iso_639_1`'i** — TMDb `/images`'ta yoklar; dil etiketi ölçülemedi.
  Görsel kontrolde metin görmedim, ama bu etiket değil.
- **Görsel kontrol yalnız 5 dosyada ve w300'de** yapıldı; küçük yazı (köşe logosu, filigran) bu
  çözünürlükte kaçabilir. 395 textless dosya görsel olarak kontrol edilmedi; `null` etiketi
  TMDb topluluğunun etiketidir, garanti değildir.
- **`/images`'tan düşen dosyaların CDN'de ne kadar kalacağı** bilinmiyor; bugün 200.
- **İllüstrasyon/key-art oranı** — 400 film içinde ölçülmedi (bkz. DUR #3).
