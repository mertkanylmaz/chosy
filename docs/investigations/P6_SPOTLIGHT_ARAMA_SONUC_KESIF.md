# P-6 KEŞİF — Spotlight arama sıralaması, liste konumu, kare kalitesi, sonuç ekranı

**Temel:** `fix/spotlight-search` @ `3f8ce18` · **Tarih:** 6 Eki 2026 · **Mod:** READ ONLY (kod yazılmadı)

## Yönetici özeti

1. **Sıralama sunucuda, `search_films` RPC'sinde (`029_search_improvements.sql:60-119`).** Eşleşme
   `tsvector @@ websearch_to_tsquery` (token AND) **VEYA** `ILIKE '%q%'`. Sıra: birebir başlık →
   `ts_rank` → `imdb_rating`. Başlıkta geçen kelimelerin hepsi aynı A ağırlığında olduğundan
   `ts_rank` ~1.0'da doyuyor ve **beraberliği IMDb puanı bozuyor**: "The King" → LOTR: Return of
   the King, The Lion King, The King's Speech (3.). Önek eşleşmesinin hiç sinyali yok; "the" tek
   başına AND terimi. **Düzeltme sunucu değişikliği (migration) ister → DUR.**
2. **Liste yeni sonuçta `scrollTo(0)` yapmıyor** (`FilmSearchInput/index.tsx:190-194`; ref yok).
   Liste açık kaldıkça ScrollView eski kaydırma konumunu koruyor. Ayrıca görünür satır sayısı
   geometri gereği hep kesirli (2.67 / 3.32), yani bir satır her zaman yarım görünüyor.
3. **Kare kalitesi (400 film ölçüldü):** birleşik skorun medyanı 43.5. Beau Travail 15.6
   (%9'luk dilim), King's Speech 46.5 (%58'lik dilim). **36 film Beau Travail'den kötü**; 25'inde
   baskın kutu siyah. 18 Eki'ye kadar takvimde olan Spotlight bulmacalarının **hiçbiri** bu
   eşiğin altında değil. Metrik "düz alanı" ölçüyor, "tanınmazlığı" ölçmüyor (aşağıda §3, sınırlar).
4. **"Watch Tonight" Spotlight'ta film sayfasını açıyor** (`/film/<uuid>`, nerede izlenir orada).
   "Why This Movie?" Spotlight'ta yönetmen · yıl · tür · süre + tagline gösteriyor ve
   **sunucu bu metni her zaman İngilizce üretiyor** (`buildWhyThisMovie` locale almadan çağrılıyor).
   Butonu ikincile indirmek opsiyonel bir prop ile S iş (diğer oyunlar varsayılanda kalır).
5. **Sonuç sayacı iPhone 15 Pro'da y ≈ 796–832'de, görünür alan 818'de bitiyor** (koddan hesap):
   etiket görünüyor, saat yarıya kadar kesiliyor. Başlık iki satırsa sayaç tamamen dışarıda.

---

## 1. Arama sıralaması

### Akış

| Adım | Kanıt |
|---|---|
| Input → 300 ms debounce → `searchFilms(text, catalogOnly)` | `components/games/FilmSearchInput/index.tsx:136-166` |
| `searchFilmsDb(query, 10)`; DB boşsa ve `catalogOnly` ise `[]` | `services/gameService.ts:718-749` |
| `supabase.rpc('search_films', { search_query, result_limit })` | `services/searchFilms.ts:40-43` |
| İstemci sırayı değiştirmiyor; ilk 6 çiziliyor | `FilmSearchInput/index.tsx:195` (`results.slice(0, 6)`) |
| RPC gövdesi (eşleşme + sıralama) | `supabase/migrations/029_search_improvements.sql:84-117` |
| `search_vector`: title/original_title **A**, tr_title B, director C, cast D; config `'simple'` (durak kelime yok) | `029:17-27` |

**Canlı = repo:** `pg_proc` tek imza `search_films(search_query text, result_limit integer)`;
gövdede `ts_rank` + `imdb_rating DESC` var (ölçüldü, aşağıda).

### Eşleşme ve sıralama (`029:97-116`)

- **WHERE:** `search_vector @@ websearch_to_tsquery('simple', q)` → `'the' & 'king'` (token AND,
  önek yok) **VEYA** title/original_title/tr_title/director `ILIKE '%q%'`.
- **ORDER BY:** (1) birebir başlık eşitliği 0/1/2 → (2) `ts_rank(search_vector, tsquery)` DESC
  → (3) `imdb_rating DESC NULLS LAST`. Popülerlik alanı **`imdb_rating`** (oy sayısı değil).
- `curation_tier` filtresi yok: 3.557 filmin 1.596'sı `archive` ve aramada çıkıyor.

### "The King" neden böyle sıralanıyor

`ts_rank` varsayılan normalizasyonla başlıktaki her A-ağırlıklı eşleşmeyi ~1.0'a doyuruyor. "The"
ve "King" geçen 10 filmin hepsi `rank = 1.0000` → sıra tamamen `imdb_rating`. Katalogda
**"The King" adlı film yok** (sorgu 0 satır). 5 Eki'nin Spotlight cevabı The King's Speech'ti.

Bir sorgu ilk 10'da yeniden sıralamanın yetmediğini de gösteriyor: "The Re" için katalogdaki 6
önek eşleşmesinin yalnız 4'ü ilk 10'a giriyor.

| Sorgu | İlk sonuçlar (canlı) | Gözlem |
|---|---|---|
| `The King` | 1 LOTR: Return of the King (9.0) · 2 The Lion King (8.5) · 3 The King's Speech (8.0) · … 9 The Rivals of Amziah King (`archive`) | Hepsi rank 1.0, sıra = IMDb |
| `The` | LOTR ×3, Narnia, Pirates… | Birden çok "the" içeren başlık daha yüksek rank (0.93) alıyor: "the" bir sıralama sinyali |
| `the kin` | 1 **Enter the Dragon** (rank 0.126) · 2 LOTR · 3 The King of the Street Cleaners | `'kin'` kadroda ("Sek Kin") birebir token. Yazarken yarım kelime tsvector'e eşleşmiyor, cast token'ı öne geçiyor |
| `the god` | 1 **Aguirre, the Wrath of God** · 2 The Hand of God · 3 The Godfather | Kelime eşleşmesi önek eşleşmesini geçiyor |
| `The Re` | 1 LOTR: Return… · 7 The Revenant | Önek 6, ilk 10'da 4 |
| `Kings Speech` / `Amelie` | **0 sonuç** | Kesme işareti ve aksan normalizasyonu yok (`unaccent` yok) |

Sorgu şablonu:
```sql
select s.title, s.year, round(s.relevance_rank::numeric,4) rank, f.curation_tier, f.imdb_rating
from search_films('The King',10) s join films f on f.id=s.id;
```

### Önerilen sıra (CTO kararı için, UYGULAMA YOK)

Kademeler (her kademe içinde popülerlik):
0. Birebir başlık (baştaki the/a/an atılmış hâli dahil)
1. Başlık öneki: `normalize(title) LIKE normalize(q) || '%'`
2. Bitişik ifade: `normalize(title) LIKE '%' || normalize(q) || '%'`
3. Tüm kelimeler (son kelime önek: `to_tsquery('king:*')`)
4. Yönetmen/kadro eşleşmesi
- `normalize` = lower + unaccent + noktalama/kesme atma + baştaki `the |a |an ` atma. Böylece "the"
  tek başına sinyal olmaz; "The" yazınca 0 karakterlik önek olur, popülerlik sıralar.
- Popülerlik: `imdb_rating` yerine yüzdelik `imdb_votes` daha doğru olur. **Ama** MEMORY notu:
  `imdb_votes` kirli (OMDb/TMDb karışık, 0 = NULL). Hangi alanın kullanılacağı karar ister.
- `catalogOnly` çağrıları için `curation_tier <> 'archive'` filtresi ayrı bir karar.

**İstemci yolu (sunucusuz) sınırlı:** `gameService.searchFilms` ilk 10'u istemcide aynı kademelerle
yeniden sıralayabilir (S). Ama "The Re" örneğinde sunucunun LIMIT 10'u önek eşleşmelerini zaten
kesiyor; `Kings Speech`/`Amelie` 0 sonuçta istemci hiçbir şey yapamaz. Kalıcı çözüm RPC'de.

---

## 2. Liste kaydırma konumu

| Bulgu | Kanıt |
|---|---|
| Sonuç listesi `ScrollView`; `ref` yok, `scrollTo`/`contentOffset` çağrısı yok | `FilmSearchInput/index.tsx:190-194`; repo grep: `FilmSearchInput/` ve `Spotlight/` içinde `scrollTo` 0 eşleşme |
| Dropdown `list.open` true kaldıkça mount'lu kalıyor; yeni harf → yeni `results` aynı ScrollView'a yazılıyor | `index.tsx:152-153, 184` |
| Satırlar `key={String(item.id)}` (tmdb id) | `index.tsx:200` |
| Satır yüksekliği 70.5 (8+54+8+hairline) | `styles.ts:56-69`, `tests/games/spotlightLayout.test.ts:193` |
| Dropdown tavanı 280, Kapat satırı 44 → kaydırma alanı ~234 = **3.32 satır**; SE + QuickType'ta **2.67 satır** | `dropdownHeight.ts:133-142`, `spotlightLayout.test.ts:197-201` |
| Dropdown input'un üstüne, alttan sabitli açılıyor (`bottom: 52 + 4`) | `styles.ts:39-55` |

**Açıklamalar (cihazda ayırt edilmedi):**
- **H1, eski konum:** kullanıcı listeyi kaydırıp yeni harf yazarsa yeni sonuçlar eski
  `contentOffset`'te çizilir, üstteki satır(lar) yarım ya da görünmez kalır. Kodda bunu sıfırlayan
  bir şey yok.
- **H2, kesirli geometri:** liste kaydırılmasa bile görünür alan tam satıra bölünmüyor. İçerik
  üstten başladığı için yarım satır **altta, Kapat'ın hemen üstünde** kalır. Kullanıcı input'a en
  yakın satırı "ilk" diye okuyorsa gözlem bu olabilir.
- **Doğrulanamadı:** ekran görüntüsü yok; H1 mi H2 mi, ikisi birden mi bilinmiyor.

**Seçenekler (UYGULAMA YOK):** (a) `results` değişince `scrollRef.current?.scrollTo({ y: 0, animated:
false })`, S. Yalnız `listControls` altında tutulursa dondurulmuş oyunlar değişmez. (b) Kaydırma
alanını satır katına yuvarlamak (`floor(h / 70.5) * 70.5`): `dropdownHeight.ts` + test, S. Yarım
satır kaybolur, kaydırılabilirlik ipucu da kaybolur (P-3'te kaydırma göstergesi açık).

---

## 3. Kare kalitesi ölçümü (400 film)

**Yöntem:** repo dışı tek seferlik script (scratchpad `frame_quality.py`, Python 3.14 + global
PIL/numpy, repoya bağımlılık girmedi). Kaynak: `editorial_calendar_films` ⨝ `films.backdrop_url`
(400 satır, 400 farklı film, 400'ünün de backdrop'u tam URL). Spotlight karesi doğrudan
`films.backdrop_url` (`supabase/functions/generate-puzzles/index.ts:864`). `/t/p/original/` →
`/t/p/w300/` (hepsi 300×169), 400/400 indirildi, 0 hata.

- **lum_std:** Rec.709 luminans standart sapması (0-255)
- **dom:** kanal başına 8 seviye (512 kutu); en kalabalık kutunun piksel payı
- **score = lum_std × (1 − dom)**, birleşik skor (düşük = düz/bilgisiz)
- (ek) **edge:** komşu luminans farkı > 24 olan piksel payı

| Metrik | min | p10 | p25 | medyan | p75 | p90 | max |
|---|---|---|---|---|---|---|---|
| lum_std | 6.6 | 39.1 | 47.6 | 58.0 | 68.9 | 79.1 | 114.2 |
| dom | 0.036 | 0.100 | 0.140 | 0.237 | 0.391 | 0.630 | 0.961 |
| edge | 0.007 | 0.079 | 0.123 | 0.203 | 0.308 | 0.412 | 0.712 |
| **score** | 0.3 | 16.6 | 31.2 | **43.5** | 54.5 | 61.9 | 77.5 |

**Kalibrasyon:** Beau Travail score 15.6 (std 26.5, dom 0.409, sıra 36/400). The King's Speech
score 46.5 (std 67.6, dom 0.312, sıra 233/400). Yön doğru. Beau Travail eşiğinde: **36 film ≤ 15.6**
(baskın kutu: 25 siyah, 6 renkli, 5 beyaz). dom ≥ 0.6 olan 51 film: 32 siyah, 14 beyaz, 5 renkli.

Dağılım (score): `0-10: 19 · 10-15: 12 · 15-20: 18 · 20-25: 25 · 25-30: 21 · 30-35: 29 · 35-40: 41 ·
40-50: 101 · 50-60: 84 · 60+: 50`

### En düşük 20

| # | film id | Başlık | score | lum_std | dom | baskın |
|---|---|---|---|---|---|---|
| 1 | 4c85b5ad-95e4-45a2-8b0f-fcdf72387477 | Oslo, August 31st (2011) | 0.3 | 6.6 | 0.961 | siyah |
| 2 | 14644090-ff36-4f77-8ec8-2327baa4163f | Whiplash (2014) | 2.0 | 19.5 | 0.895 | renkli (turuncu) |
| 3 | 699bec82-3d3f-48eb-9aa0-05eddd5fcca7 | Nightcrawler (2014) | 3.7 | 18.5 | 0.800 | siyah |
| 4 | cd28b279-1cc8-4ef0-bbb3-5f144337a75a | Cold War (2018) | 3.8 | 42.3 | 0.911 | siyah |
| 5 | 2f6d66e6-c5ae-4da6-9576-a00144e0e0d4 | Casino (1995) | 5.2 | 33.4 | 0.843 | siyah |
| 6 | 930b5f82-0ed8-4aa0-bf7c-3dc7aaaa7a20 | Kill Bill: Vol. 1 (2003) | 5.4 | 29.1 | 0.815 | renkli (sarı) |
| 7 | 74ebfc5e-10a8-48d4-9b33-9da6c03dadeb | Twelve Monkeys (1995) | 5.6 | 42.4 | 0.867 | siyah |
| 8 | d3786508-11d4-4bf7-9925-3f680db43600 | TÁR (2022) | 5.8 | 37.6 | 0.845 | siyah |
| 9 | c44e21c8-5e36-454a-9500-ccf1d9a2a9b8 | GoodFellas (1990) | 5.9 | 43.0 | 0.863 | siyah |
| 10 | f3eed324-6cf4-41a6-a4c0-ce9baa4500d9 | Black Swan (2010) | 6.1 | 43.2 | 0.860 | beyaz |
| 11 | b367c570-5470-435a-a8fe-eb23abcea722 | Caché (2005) | 7.8 | 43.1 | 0.819 | siyah |
| 12 | 049c8e68-240a-4907-a5ae-ea66b3a5b730 | Dark City (1998) | 7.8 | 35.9 | 0.781 | siyah |
| 13 | 3afe273e-bb30-4870-829a-c1430d713211 | A Clockwork Orange (1971) | 7.9 | 49.9 | 0.842 | siyah |
| 14 | 7b391754-486f-47eb-8e88-dba5fff8b44e | The Godfather (1972) | 8.7 | 39.6 | 0.780 | siyah |
| 15 | fce88bf4-f9f9-484b-bd3c-d1265f14c9d7 | The Square (2017) | 8.7 | 43.3 | 0.798 | siyah |
| 16 | 02feab16-caaf-410b-af59-dd91f5e1b544 | Carlito's Way (1993) | 9.6 | 40.7 | 0.763 | siyah |
| 17 | 3888d58d-fe3e-42a4-b470-d5bc7962b534 | The Batman (2022) | 9.8 | 17.8 | 0.451 | renkli (kırmızı) |
| 18 | c30e864f-5463-4902-9128-c772cbbc5ac5 | Blue Velvet (1986) | 9.9 | 39.2 | 0.748 | siyah |
| 19 | 04b5d36d-b94d-4908-ad2a-9a57686aeb5c | Youth (2015) | 10.0 | 40.7 | 0.755 | siyah |
| 20 | 5bbee12c-bc8a-4cb7-a410-6329f664358d | Wall Street (1987) | 10.1 | 48.3 | 0.792 | siyah |

### Takvimdeki bulmacalarla kesişim

`daily_puzzles` (`game_type='spotlight'`, `film_id` = **tmdb_id, bigint**) ⨝ `films.tmdb_id`, 30 Eyl
– 18 Eki (en ileri tarih 18 Eki):

| Tarih | Film | score | yüzdelik |
|---|---|---|---|
| 03 Eki | Akira | 33.3 | 29 |
| **04 Eki** | **Beau Travail** | **15.6** | **9** |
| 05 Eki | The King's Speech | 46.5 | 58 |
| 08 Eki | Wheel of Fortune and Fantasy | 40.6 | 42 (ileri tarihlilerin en düşüğü) |
| diğer 15 gün | — | 42.0–66.5 | 45–96 |

İleri tarihli 12 bulmacanın (7–18 Eki) hiçbiri Beau Travail eşiğinin altında değil. Not:
`editorial_calendar_films.day_number` Spotlight tarihiyle eşleşmiyor (Beau Travail `day_number=95`,
4 Eki'de oynandı = launch_date 18 Eyl + 16). Seçim mantığı bu turda incelenmedi.

### Metriğin sınırları (kontakt sayfasıyla gözle kontrol edildi)

- En düşük 20'nin çoğu **siyah zemin üstüne yerleştirilmiş tanıtım görseli (key art)**, sahne karesi
  değil (Casino, GoodFellas, The Godfather, Wall Street, Kill Bill, Black Swan). Kalibrasyondaki "iyi"
  King's Speech de key art (yarısı düz turuncu).
- Siyah zemin + **tanınır yüz** (GoodFellas, The Godfather, The Chaser) düşük skor alıyor ama
  Spotlight'ta muhtemelen kolay. Metrik "düz alan oranını" ölçüyor, tanınabilirliği ölçmüyor. Beau
  Travail tipi sorun (geniş düz alan + bulanıklıkta kaybolan küçük figür) bu metrikle yakalanıyor,
  ama yanlış pozitif oranı yüksek.
- Bulanıklık sonrası bilgi (`blurForProgress`) ölçülmedi. Daha isabetli bir sinyal için kare blur
  uygulanmış hâliyle ölçülebilir; bu turun kapsamı dışında.

---

## 4. ResultCard — "Watch Tonight" ve "Why This Movie?"

| Bulgu | Kanıt |
|---|---|
| ResultCard butonu **çizmiyor**; CTA'lar `WhyThisMovieFunnel`'da. ResultCard onu yalnız `whyThisMovie` prop'u varsa çiziyor | `ResultCard/index.tsx:289-298` |
| Spotlight `whyThisMovie` ve `filmUuid={revealedFilm?.film_id}` geçiyor | `Spotlight/index.tsx:500-531` |
| **Watch Tonight** = `router.push('/film/<uuid>')`. Uuid varsa sorgu yok | `WhyThisMovie/index.tsx:116-124` |
| Film sayfası TMDb watch providers çekiyor (nerede izlenir orada) | `app/film/[id].tsx:403, 419` |
| Birincil görünüm: dolu `accentPrimary` buton, altında çerçeveli "Add to List" | `WhyThisMovie/index.tsx:214-248`, `styles.ts:92-124` |
| "Why This Movie?" varsayılan **kapalı** açılır başlık; açılınca `why_text` + `fun_fact` | `WhyThisMovie/index.tsx:251-294` |
| `why_text` = "Directed by X · yıl · 2 tür · N min"; `fun_fact` = TMDb tagline, yoksa "TMDB audience score" | `supabase/functions/_shared/whyThisMovie.ts:32-71` |
| **Locale geçilmiyor → TR kullanıcı İngilizce metin görüyor** | `get-daily-challenge/index.ts:311`; `submit-guess/index.ts:575, 815, 1028, 1185, 1290, 1590` |
| Bonus oyun filmi için "neden bu film" anlamında editoryal bir gerekçe yok; metin film künyesi. Yıl, ResultCard'ın `release_year` satırıyla tekrar ediyor | `ResultCard/index.tsx:241-248` |

**"Nerede izlenir"i ikincile indirmek için gereken değişiklik (UYGULAMA YOK):**
- `WhyThisMovieFunnelProps`'a opsiyonel `ctaEmphasis?: 'primary' | 'secondary'` (varsayılan `'primary'`).
  `'secondary'`de Watch butonu `addButton` gibi çerçeveli olur, isteğe bağlı olarak iki buton tek
  satırda (`flexDirection: 'row'`) durur.
- `ResultCardProps`'a aynı opsiyonel prop, `WhyThisMovieFunnel`'a aktarılır. Spotlight yalnız
  `'secondary'` geçer.
- Etkilenmeyenler: CineMetrics, fadein, imposter, logline, quoted (ResultCard), Detective ve
  QuickResult (`WhyThisMovieFunnel`'ı doğrudan kullanıyor). Varsayılan değişmediği için çıktı aynı.
- Etiket "Where to watch / Nerede izlenir" olacaksa yeni i18n anahtarı gerekir (en/tr parite).
  Davranış (film sayfası) değişmez.
- Büyüklük **S**. Sözleşme yok, sunucu yok. Locale düzeltmesi ayrı (Edge Function, aşağıda DUR).

---

## 5. Sonuç ekranı sayacı — iPhone 15 Pro (393×852, safe area 59 / 34)

**Koddan dikey bütçe (cihazda ölçülmedi):**

| Blok | pt | Kaynak |
|---|---|---|
| Floating header chrome (59 + 16 + 44 + 8) | ~127 | `GameShell/styles.ts:51-67`; gerçek değer `onLayout` (`GameShell/index.tsx:418`) |
| Kare 361 × 9/16 | 203 | `Spotlight/styles.ts:27, 35`, `stillLayout.ts:13-17` |
| gap | 16 | `Spotlight/styles.ts:210-213` |
| Kart üst (1 + 24) | 25 | `ResultCard/styles.ts:21-30` |
| Başlık 34 (tek satır) + 8 + yıl 18 | 60 | `styles.ts:33-64` |
| gap + durum (16 + 4 + 18) | 16 + 38 | `styles.ts:67-89` |
| gap + XP çipi | 16 + ~26 | `DnaXpReveal/styles.ts:18-25` |
| gap + WhyThisMovie (16 + 44 + 8 + 44 + 8 + 1 + 8 + 28 + 16 + 2) | 16 + ~175 | `WhyThisMovie/styles.ts:19-124` |
| gap + Share/Back | 16 + ~46 | `ResultCard/styles.ts:149-185` |
| gap → **sayaç (14 + 2 + 20)** | 16 → **36** | `styles.ts:188-200` |

→ Sayaç ≈ **y 796–832**. Görünür alt sınır 852 − 34 (`GameShell/index.tsx:357`) = **818**. Etiket
görünüyor, saat yarıya kadar kesiliyor. **İki satırlık başlıkta** (+34) sayaç 830–866: tamamen dışarıda.
`PlayNextBridge` sayacın altında (`ResultCard/index.tsx:372-374`), etkisi yok.

**Seçenekler (UYGULAMA YOK):**

| # | Seçenek | Dosya | Büyüklük | Not |
|---|---|---|---|---|
| A | Spotlight sayacı kendisi çizer (karenin üstünde/altında) ve ResultCard'a `countdown` geçmez | `Spotlight/index.tsx:526` | S | ResultCard'a dokunulmaz, diğer oyunlar aynı kalır. Kart içindeki hiyerarşiden kopar |
| B | ResultCard'a opsiyonel `countdownPlacement?: 'top' \| 'bottom'` (varsayılan bottom); top = durum satırının altı | `ResultCard/index.tsx:252-269, 361-369` | S | Diğer oyunlar değişmez |
| C | §4'teki `ctaEmphasis='secondary'` + tek satır CTA | `WhyThisMovie` | S | ~52pt kazanç → sayaç ~744–780. Tek satır başlıkta içeri girer, iki satırda ~814 sınırda |
| D | Sonuçta kareyi küçültmek | `Spotlight/styles.ts` | S–M | Kare sonuç ekranının kahraman görseli (P-2). Ürün kararı |
| E | Şu an ikincil olan "Why This Movie?" başlığını CTA satırına almak | `WhyThisMovie` | S | ~45pt; açılır kart yerleşimi değişir |

C ve A/B birbirini tamamlıyor: C tek başına iki satırlık başlıkta yetmiyor, A/B yetiyor.

---

## 6. TEKNIK_BORC taslağı (dosyaya yazılmadı)

```markdown
## 🟡 Spotlight: arama listesi kareyi ve maskeyi örtüyor (P-6, 6 Eki 2026)

Arama sonuçları açıkken liste input'un üstünden header'ın altına kadar uzanır
(tavan 280pt, `FilmSearchInput/dropdownHeight.ts:133`). Cihaz gözleminde liste
16:9 karenin ~%60'ını ve başlık maskesini örtüyor. Oyuncu tahmin seçerken
tahminini dayandırdığı iki bilgiyi (kare + açılmış harfler) göremiyor.

İlgili kayıtlar: "sistem klavyesi açıkken kare 50pt görünür" (P-2d) ve
"P-3 sonrası kalanlar §1, harf tuşları örtülü". Üçü aynı dikey alan
çakışmasının yüzleri.

**Olası çözüm (M):** odaktayken kareyi şeride küçült (ör. tam genişlik × ~96pt,
`contentFit="cover"` ile odak bölgesi). Maskeyi şeridin hemen altına sabitle,
listeyi maskenin altıyla input arası alana sınırla. Dokunur: `SpotlightStill`
yerleşimi, `Spotlight/styles.ts` (`STILL_H` sabit → odak durumuna bağlı),
`dropdownHeight.ts` (üst sınır = maske altı), `tests/games/spotlightLayout.test.ts`,
blur yarıçapı (küçük kare + aynı blur = farklı algı). Paylaşılan
`FilmSearchInput`'a yeni üst sınır prop'u gerekir, varsayılan kapalı olur
(dondurulmuş oyunlar değişmez).

**Neden şimdi değil:** yerleşim/pattern kararı. Şeridin kareden hangi bölgeyi
göstereceği (TMDb karelerinde odak noktası verisi yok) ürün kararı ister.
"Ölçülen yüzde" cihaz gözlemi, kod geometrisiyle doğrulanmadı.

**Tetikleyici:** N13/N15'te "liste açıkken kareyi göremiyorum" geri bildirimi
ya da küçük ekranlarda Spotlight completion düşüşü.
```

---

## Bulgular tablosu

| # | dosya:satır | Açıklama | Büyüklük |
|---|---|---|---|
| F1 | `supabase/migrations/029_search_improvements.sql:105-116` | Sıralama: birebir → `ts_rank` (doyuyor) → `imdb_rating`. Önek sinyali yok, "the" AND terimi | M (migration) |
| F2 | `029:99` | `websearch_to_tsquery` önek desteklemiyor; yarım kelime kadro token'ına eşleşip öne geçiyor ("the kin" → Enter the Dragon) | M (F1 ile) |
| F3 | `029:97-104` | Kesme işareti/aksan normalizasyonu yok: "Kings Speech", "Amelie" → 0 sonuç | M (F1 ile, `unaccent` uzantısı) |
| F4 | `029:96-104` | `curation_tier` filtresi yok, `archive` filmler aramada | S (karar) |
| F5 | `services/gameService.ts:726` | Sunucuya LIMIT 10 gidiyor; istemcide yeniden sıralama önek eşleşmelerini kurtaramıyor ("The Re": 6 → 4) | S (geçici) |
| F6 | `components/games/FilmSearchInput/index.tsx:190-194` | Yeni sonuçta `scrollTo(0)` yok; eski konum korunuyor | S |
| F7 | `FilmSearchInput/dropdownHeight.ts:133-142` | Görünür satır sayısı kesirli (3.32 / 2.67); hep yarım satır | S |
| F8 | `supabase/functions/get-daily-challenge/index.ts:311`, `submit-guess/index.ts:575, 815, 1028, 1185, 1290, 1590` | `buildWhyThisMovie` locale'siz → why_text/fun_fact TR'de İngilizce | S (Edge Function) |
| F9 | `components/games/WhyThisMovie/index.tsx:214-248` | Watch Tonight birincil dolu buton (film sayfasına gidiyor); ikincile indirmek için opsiyonel prop | S |
| F10 | `components/games/ResultCard/index.tsx:361-369` + `Spotlight/index.tsx:526` | Sayaç kartın en altında; 15 Pro'da y≈796–832, görünür alan 818'de bitiyor | S |
| F11 | `editorial_calendar_films` (veri) | 36/400 backdrop Beau Travail'den düz; ileri tarihli 12 bulmacanın hiçbiri değil | — (ölçüm) |
| F12 | Spotlight odak yerleşimi | Liste kareyi + maskeyi örtüyor (TEKNIK_BORC taslağı §6) | M |

## Ölçülmüş sayılar

| Sayı | Değer | Sorgu / yöntem |
|---|---|---|
| `films` toplam / `archive` | 3.557 / 1.596 | `select count(*) filter (where curation_tier='archive'), count(*) from films;` |
| "The King" başlıklı film | 0 | `select … from films where lower(title) in ('the king','king') or lower(original_title)='the king';` |
| Editoryal takvim | 400 satır, 400 film, 400 tam-URL backdrop | `select count(*), count(distinct e.film_id), count(f.backdrop_url), count(*) filter (where f.backdrop_url like 'https://%') from editorial_calendar_films e join films f on f.id=e.film_id;` |
| İndirilen w300 kare | 400/400, 0 hata, hepsi 300×169 | scratchpad `frame_quality.py` |
| ≤ Beau Travail skoru | 36 (25 siyah · 6 renkli · 5 beyaz baskın) | aynı script |
| İleri tarihli Spotlight bulmacası | 12 (7–18 Eki), eşik altı 0 | `select p.date, f.title from daily_puzzles p join films f on f.tmdb_id=p.film_id where p.game_type='spotlight' and p.date >= '2026-09-30';` |
| `launch_date` | 2026-09-18 | `select key, value from app_config where key ilike '%launch%';` |
| Metrik korelasyonu | std~dom −0.13 · std~edge 0.22 · dom~edge −0.47 | aynı script |

## DUR NOKTASI gerektiren maddeler

- **D1, arama sıralaması (F1–F4):** `search_films` için yeni migration (`CREATE OR REPLACE FUNCTION`),
  büyük olasılıkla `unaccent` uzantısı + normalize edilmiş başlık için ifade/trigram index. Sunucu +
  migration + muhtemelen yeni uzantı → CTO onayı. Popülerlik alanı seçimi (`imdb_rating` mı, kirli
  `imdb_votes` yüzdeliği mi) ayrıca karar ister.
- **D2, `why_this_movie` locale (F8):** iki Edge Function'da `buildWhyThisMovie(film, locale)` çağrısı
  ve istemcinin locale'i iletmesi. Edge Function davranış değişikliği; `_shared` modülü →
  tüketici/üretici deploy sırası kuralı.
- **D3, kare kalitesi eşiği (F11):** ölçüm üretim hattına girecekse (generate-puzzles reddi ya da
  yeni kolon) şema/Edge Function kararı. Bu turda yalnız ölçüm yapıldı.
- **D4, şerit yerleşimi (F12):** paylaşılan `FilmSearchInput`'a yeni prop + Spotlight yerleşim
  kararı (pattern).

## Doğrulanamayanlar

- §2 "ilk satır kesik" gözleminin H1 (eski konum) mı H2 (kesirli geometri) mı olduğu: cihaz ekran
  görüntüsü yok.
- §5 bütçesi koddan; gerçek chrome yüksekliği `onLayout`'la ölçülüyor ve cihazda okunmadı. Font
  ölçeklemesi (Dynamic Type) hesaba katılmadı.
- §6 "%60" cihaz gözlemi; kod geometrisiyle ölçülmedi.
- §3 skorunun Spotlight zorluğuyla ilişkisi doğrulanmadı (completion/harf sayısı verisiyle
  karşılaştırılmadı). Takvim eşleşmesi başlık üzerinden yapıldı; aynı başlıklı iki film varsa
  eşleşme belirsiz olabilir.
- Spotlight bulmaca seçiminin `editorial_calendar_films` içinden nasıl yapıldığı
  (`day_number` ≠ tarih) bu turda incelenmedi.
