# MOOD-VEC-2a Adım 3 — IMDb backfill etki ölçümü

Tarih: 2026-10-30 · Kapsam: SADECE OKUMA (canlı DB'ye yazma yok, `assign-tiers.ts` çalıştırılmadı).
Kaynak: `films_imdb_backfill_backup_20261030` (önce, 1322 satır) ↔ `films` (şimdi, 3594 satır).
Backfill edilen film: **150** (yedekte `imdb_votes` ve `imdb_rating`'i `films`'ten farklı olan satırlar).

## Özet (tek satır)

Band: 485 → 488 (net +3; 62 girdi / 59 çıktı) · Koşul B: 0 film (8 NULL film band dışı) · Simülasyon: 29 (votes<5000 veya rating<6.5) ve 27 (votes<10000) — ikisi de beklenenle birebir.

## 1. Önce / sonra (150 film)

| Metrik | min | medyan | p90 | max | NULL |
|---|---|---|---|---|---|
| `imdb_votes` önce | 0 | 2.745 | 8.825 | 16.918 | 47 |
| `imdb_votes` sonra | 391 | 84.475 | 427.452 | 908.613 | 0 |
| `imdb_rating` önce | — | — | — | — | 150 |
| `imdb_rating` sonra | 4,0 | 7,3 | 7,7 | 9,3 | 0 |

- Yön: 103 film artış, **0 film azalış**, 47 film NULL → değer (biri 0 → değer). Yani "proxy→gerçek"
  değişim oranı 150/150; sayısal oran karşılaştırması yapılabilen 103 filmde sonra/önce oranı
  min 26,6× · medyan 54,1× · p90 75,0× · max 103,7×.
- `imdb_rating` önce hepsinde NULL idi; backfill rating'i ilk kez doldurdu (delta anlamsız).
- Önceki değerler TMDb vote_count benzeri proxy gibi görünüyor (p90 8.825); gerçek IMDb oyu iki
  mertebe yukarıda.

## 2. Gauntlet etkisi — band 55–80

Yöntem (`supabase/functions/_shared/gauntletCore.ts` `fetchPool` + `applyRecognitionScores` birebir):
havuz = `film_profiles.profile_vector` dolu ⨝ `films`, poster/runtime/year/release_date dolu,
`release_date <= bugün`, `curation_tier in (core, extended, trending)`; `imdb_votes = 0` → NULL;
`imdb_votes` NULL ∧ `vote_average` NULL → elenir (2A); yüzdelik = `percent_rank` × 100
(votes dolu olanlar kendi arasında, votes NULL olanlar `vote_average` arasında). "Önce" için
150 filmin votes değeri yedekten alındı, diğerleri aynı.

⚠️ Sınırlar: `maxRuntime` kısıtı uygulanmadı (istek bazlı parametre) → havuz 1.955 (kodun
yorumundaki ~1866 ile aynı büyüklük sınıfı). Band **yumuşak puandır**, sert filtre değil
(`score = 1 − |p − 67,5| / 32,5`); "band içi" burada yüzdelik ∈ [55, 80] demektir.

| | önce | sonra |
|---|---|---|
| havuz (tier+tarih) | — | 1.955 |
| aday (2A sonrası) | 1.936 | 1.954 |
| bandda | **485** | **488** |
| votes NULL aday | 25 | 0 |

Girdi 62 · Çıktı 59 · Kalan 426.

### 2a. Backfill'in doğrudan etkisi (backfill edilen film)

**Banda girenler (45)** — önce→sonra votes · yüzdelik:
Identity (4.385→299.358 · 3,6→78,5) · The Bourne Legacy (6.149→331.137 · 4,2→79,8) · Jason Bourne
(6.230→261.306 · 4,3→76,3) · The Beach (4.723→272.119 · 3,9→76,8) · Paterson (2.118→96.870 · 2,3→56,5) ·
Melancholia (3.931→210.608 · 3,4→72,0) · Begin Again (4.076→178.830 · 3,4→69,0) · Ghost Dog (1.467→104.085 · 1,9→57,6) ·
Blow (4.692→289.693 · 3,8→77,9) · Clerks (2.863→242.157 · 2,7→74,7) · Minari (1.920→127.891 · 2,3→62,4) ·
Caché (1.304→91.358 · 1,7→55,6) · Christopher Robin (2.989→92.099 · 2,8→55,7) · Good Time (3.239→160.466 · 3,0→66,5) ·
Dark City (3.335→229.464 · 3,0→73,7) · Babel (4.179→331.887 · 3,5→79,9) · Locke (3.034→171.260 · 2,9→68,0) ·
Youth (2.265→89.774 · 2,5→55,1) · Chocolat (3.576→212.082 · 3,2→72,3) · The Killing of a Sacred Deer (4.575→219.912 · 3,7→73,0) ·
The Goonies (6.407→331.797 · 4,4→79,9) · The Patriot (4.482→317.444 · 3,7→79,5) · Julie & Julia (2.258→137.887 · 2,4→64,0) ·
Wild (2.734→147.800 · 2,6→65,0) · Chef (3.764→254.881 · 3,3→75,8) · Nomadland (3.466→223.124 · 3,1→73,2) ·
Dogtooth (2.686→125.579 · 2,6→62,1) · The Zone of Interest (2.745→193.968 · 2,7→70,3) · Wall Street (2.321→176.535 · 2,5→68,6) ·
Stardust (4.577→301.547 · 3,8→78,7) · Blue Is the Warmest Color (4.939→175.154 · 3,9→68,5) · Babe (3.207→144.509 · 2,9→64,7) ·
Frances Ha (1.865→103.786 · 2,2→57,5) · The Queen (1.464→120.430 · 1,8→61,1) · Triangle of Sadness (3.017→221.525 · 2,8→73,1) ·
The Last of the Mohicans (3.545→210.611 · 3,2→72,0) · Darkest Hour (5.641→246.742 · 4,1→75,3) · Paddington (4.350→159.803 · 3,6→66,3) ·
Lincoln (4.145→287.802 · 3,5→77,8) · The Tree of Life (3.413→193.844 · 3,1→70,3) · TÁR (1.597→111.498 · 2,0→59,2) ·
Glengarry Glen Ross (1.656→127.782 · 2,0→62,3) · Backrooms (votes NULL→değer · 29,2→74,2, trending) ·
The Angry Birds Movie (votes NULL→değer · 8,3→61,3, trending) · Resident Evil (önce havuzda yoktu, sonra 60,1, trending).

**Bandı terk edenler (6)** — önce→sonra yüzdelik: Obsession (79,2→83,5, üste çıktı) ·
Colony (79,2→22,2) · Animals (62,5→31,4) · Matchbox the Movie (70,8→5,0) · De Gaulle: Résistance (75,0→0,6) ·
The Cycle (66,7→0,4). Altı film de `trending`; önce votes NULL idi ve `vote_average` yüzdeliğiyle
bandda görünüyorlardı, gerçek votes gelince düşük oy havuzundaki yerlerine oturdular.

Not: Backfill edilen film sayısı 150 ama havuzda 145'i var (5'i archive tier veya tarih dışı).

### 2b. Dolaylı etki (backfill EDİLMEYEN, yalnız rank kayması)

150 filmin votes'u yüzlerce kat arttı → yüzdelik cetveli kaydı. Backfill edilmemiş filmlerin yüzdeliği
~1–3 puan oynadı; sınırdakiler bandı değiştirdi.

**Banda giren (17, üst sınırın hemen altına indi, ~80,1–80,9 → 79,0–80,0):**
Cinema Paradiso · Scary Movie · Mission: Impossible – Dead Reckoning Part One · Frankenstein · Toy Story 4 ·
Rango · Me Before You · Before Sunset · All Quiet on the Western Front · Atonement · Seven Pounds · Grown Ups ·
BlacKkKlansman · Furiosa: A Mad Max Saga · Panic Room · Grease · Death Proof.

**Bandı terk eden (53, alt sınırın hemen altına indi, ~55,0–57,7 → 52,1–55,0):**
Tokyo Story · Dilwale Dulhania Le Jayenge · Thirteen Lives · Anatomy of a Murder · The Ten Commandments ·
Wings of Desire · 28 Years Later: The Bone Temple · Nuremberg · Mufasa: The Lion King · Brotherhood of the Wolf ·
Awake · The Outfit · La Dolce Vita · Whisper of the Heart · Perfect Strangers · Just Mercy · Sonic the Hedgehog 3 ·
Senna · Free Solo · The Man Who Shot Liberty Valance · The Chaser · Mysterious Skin · Children of Heaven ·
The Best Years of Our Lives · Mother · Who's Afraid of Virginia Woolf? · In the Heat of the Night · A Dog's Purpose ·
The Woman King · Harold and Maude · Bringing Out the Dead · Being There · The Sea Inside · Doctor Zhivago ·
Three Colors: White · The White Ribbon · The Body · Open Your Eyes · The Man from Nowhere ·
Sympathy for Mr. Vengeance · Burning · Fearless · The Girl Who Kicked the Hornet's Nest · The Dirty Dozen ·
The African Queen · The Man Who Knew Too Much · To Catch a Thief · The Manchurian Candidate · Badlands ·
The Outlaw Josey Wales · Duel · Bottle Rocket · Paris, Je T'aime.

Toplam: 45 + 17 = 62 giren, 6 + 53 = 59 çıkan → net +3 (485 → 488). Girenlerin ağırlığı artık
`core/extended` klasikleri (bandın üst-orta kesimi), yani etki beklenen yönde: düşük proxy yüzünden
yüzdeliği ~%1–4'e gömülü 42 tanınmış film bandın içine taşındı.

## 3. Koşul B — `imdb_votes` NULL olup bandda olan film

**Sonuç: 0 film.** Backfill sonrası aday havuzunda votes NULL aday yok (önce 25 idi).

`films` genelinde `imdb_votes IS NULL` (profil vektörü olanlar):

| tier | tarih | adet | `vote_average > 0` |
|---|---|---|---|
| trending | gelecek (`release_date > bugün`) | 7 | 0 |
| trending | yayınlanmış (The Mongoose, 2026-08-30) | 1 | 0 |
| archive | `release_date` NULL | 951 | 951 |
| archive | yayınlanmış | 106 | 81 |

- Aktif tier'larda NULL = **8 film** (beklenen 8). 7'si vizyon öncesi (`releasedBy` eler),
  1'i (The Mongoose) yayınlanmış ama `vote_average` de yok → 2A `recognition_missing` eler. Hiçbiri havuza girmez.
- ⚠️ 1.057 archive film NULL votes taşıyor. Normalde `archive` havuz dışı (migration 050),
  ama `RELAXED_TIERS` son çare gevşetmesinde dahil olur ve `vote_average > 0` olan 1.032'si
  `vote_average` fallback yüzdeliğiyle bandda skorlanabilir. Bu backfill'in kapsamı değil, ama bilinmesi gereken artık risk.

## 4. `assign-tiers` simülasyonu (çalıştırılmadı, SQL ile hesaplandı)

150 backfill filmi, SONRAKİ değerlerle:

| Kural | Hesaplanan | Beklenen |
|---|---|---|
| votes < 5.000 **veya** rating < 6.5 | **29** | 29 ✓ |
| — yalnız votes < 5.000 | 16 | |
| — yalnız rating < 6.5 | 16 | |
| (ikisi birden) | 3 | |
| 045B: votes < 10.000 | **27** | 27 ✓ |

Karşılaştırma için ÖNCEKİ değerlerle: votes<5000 veya rating<6.5 = 76 (rating hep NULL → 0 sayılırdı,
`votes<5000` 76), votes<10.000 = 95. Backfill arşiv adayı sayısını 76 → 29'a, 045B adayını 95 → 27'ye düşürdü.

Farklılık yok, açıklanacak sapma yok. İki uyarı:
- 29 = **arşiv koşulu sağlayan** film sayısı. `determineCurationTier` önce core kurallarına bakar
  (rating ≥ 8, auteur+7.0, Oscar ≥ 2, metascore, keyword); gerçek arşive düşen sayı bundan az olabilir.
  Core kuralları bu ölçümde uygulanmadı (görev tanımı yalnız arşiv koşulunu istedi).
- 150 filmin şu anki tier'ı: core 9 · extended 94 · trending 47 · archive 0 — yani 29 filmin hiçbiri henüz
  arşive alınmadı; `assign-tiers` hâlâ çalıştırılmadı.

## Yöntem notu

Tüm sorgular `execute_sql` ile yalnız `SELECT`. Proje: `chosy ai` (`xpcwihldlnlmyopjubdc`). `app_config`:
`recognition_band_low=55`, `recognition_band_high=80`. Ham sonuçlar bu rapora işlendi; env/anahtar çıktısı yazılmadı.
