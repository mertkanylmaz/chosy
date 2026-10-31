> **Geçersiz kılındı (Adım 1b):** kapsam daraltıldı, güncel sayılar için `phase1-daraltma.md`. Bu belge Adım 1 çıktısının (364 film) kaydıdır.

# MOOD-VEC-2b Faz 1 — arşiv nedeni, içerik taraması, etki ölçümü

31 Eki 2026 · dal `feat/mood-vec-2b` · **yalnız hazırlık**: canlıya yazılmadı, SQL'i CTO MCP ile uygular.
Üretici: `scripts/backfill-imdb-archive.ts` (SQL/CSV üretir, DB'ye yazmaz). Etki hesapları SELECT + yerel hesap.

## Sonuç özeti

| | film |
|---|---|
| Arşiv | 1.633 |
| Havuz kapısını doğrudan geçen | 682 |
| A adayı (DB'de rating+votes dolu) / B adayı (rating NULL) | 469 / 208 (+5 TMDb'den `imdb_id` çözülemedi) |
| Kural B ile arşivde KALAN | 259 (A 145, B 114) |
| İçerik taraması / oy tabanı kontrolüne takılıp SQL'e **girmeyen** | 50 → `needs-review.csv` |
| **Faz 1A SQL** (yalnız tier) | **285** (36 core, 249 extended) |
| **Faz 1B SQL** (imdb alanları + tier) | **79** (4 core, 75 extended); `imdb_id` yazılan 0 |
| Toplam tier değişimi | **364** (40 core, 324 extended) |

Keşifteki 431'den farklar (17 film): keşif A için DB değerleri yerine IMDb dosyasındaki taze oy sayısını kullanmıştı.
17 film DB'de 4.6k–4.9k oyda duruyor, dosyada ≥ 5.000 (ör. *Ride Your Wave* 4.876→5.628). Bu SQL **DB değerleriyle** karar verir;
oy sayısını yenilemek ayrı bir iş (Faz 1A yalnız `curation_tier` yazar, kapsam kararı).

## 1. 311 film neden arşivde

Kriter: `curation_tier='archive' AND imdb_rating >= 5.8 AND imdb_votes >= 5000` → **311 film** (keşifteki küme).
Geçmiş kurallar: `supabase/migrations/045_catalog_cleanup.sql` (22 Haz 2026; 045A rating NULL → archive, 045B votes < 10k → archive) ve
`scripts/assign-tiers.ts` eski kuralı (`abc8a2a`: votes < 5k veya rating < 6.5 → archive).

| ölçüt (bugünkü veriyle) | film |
|---|---|
| 045B: votes < 10.000 | 264 |
| eski assign-tiers: rating < 6.5 | 62 |
| ikisinden en az biri | **307** |
| ikisi de değil | **4** |

- 045A (rating NULL) bugünkü veriyle ölçülemez, çünkü rating sonradan doldu. Dolaylı kanıt: 311 filmin **hepsinde** `updated_at` 15–31 Ağu 2026
  (045'ten sonra), `created_at` Mar–May. Yani 045 çalıştığında rating'leri yoktu ve 045A hepsini arşive aldı; sonradan gelen rating tier'ı yeniden hesaplatmadı.
- Kalan 4: *Hoppers* (2026), *Ready or Not: Here I Come* (2026), *The Drama* (2026), *Neon Genesis Evangelion: Death and Rebirth* (1997).
  İlk üçü 2026 filmleri (trending'den düşmüş olmaları muhtemel, tek tek doğrulanmadı); `079_trending_tier_restore.sql:55-57` *The Drama*'yı ve *The Super Mario Galaxy Movie*'yi açıkça "BELİRSİZ, düşerken archive'a gider" diye kaydetmiş
  (ikisi de Faz 1A SQL'inde). *Evangelion* için açıklama yok.
- **"Elle arşivlenmiş" izi bulunmadı:** 311'de `metadata_json` not/neden anahtarı 0; `pre_trending_tier` dolu 0; 285 Faz 1A id'sinden yalnız ikisi (yukarıdaki) bir migration'da geçiyor;
  scripts/.claude/OS belgelerinde id geçmiyor. Trending geçmişli (trending_added_at dolu) arşiv filmi toplam 185, bunlardan A kriterli yalnız 6.
- Sonuç: 311'in 307'si eski kurallarla açıklanıyor (bayat tier, kural bugün değişmiş); 4'ü trending düşüşü / açıklanamayan.

## 2. İçerik taraması (kapıdan geçen A+B adaylarına, `title.basics.tsv.gz` ile)

Uygulanan: `titleType='movie'`, `isAdult=0`, genres'te `Adult` yok, DB runtime ve basics runtime ≥ 60.
Belirsiz bayraklar: genres `Documentary/Music/Talk-Show/Reality-TV`, başlıkta `Live/Tour/Concert/Special/Stand-Up`, `tvMovie/video/tvSpecial`.
Ek (kendi kararım, aşağıda): tier'ı `determineCurationTier` ile çıkan ama oyu < 5.000 olan film. Ek: DB yılı ile IMDb yılı > 1 fark.

| bayrak | film | not |
|---|---|---|
| KESİN: titleType (movie/tvMovie/video/tvSpecial dışı) | 1 | *Tel chi el telùn* (`tvMiniSeries`, runtime yok) |
| KESİN: isAdult / Adult / runtime < 60 | 0 | |
| ELLE: oy tabanı altı (votes < 5.000, tier core döndü) | 20 | aşağıya bak |
| ELLE: genres Music | 14 | çoğu müzikal/drama (*The Idea of You*, *I'm No Longer Here*, *Secret*) |
| ELLE: genres Documentary | 9 | |
| ELLE: genres Documentary + Music | 6 | konser/grup belgeselleri (BTS, BLACKPINK, Burn the Stage, Bring the Soul, Avicii, *Ennio*) |
| ELLE: başlıkta Live/Tour | 5 | *The Terror Live*, *I Live in Fear*, *Live Twice, Love Once*, *Package Tour* … çoğu yanlış pozitif |
| ELLE: titleType tvMovie / video | 4 / 3 | *Angel's Egg* (OVA, `video`), *Twin Peaks* (1989 pilot, `video`) … |
| ELLE: basics runtime yok | 1 | aynı tvMiniSeries |

Toplam: 50 film (birden çok bayrak olabilir), hepsi `needs-review.csv`'de, **hiçbiri SQL'de yok**.

**Önerim**
- **Kesin hariç:** `titleType` movie/tvMovie/video/tvSpecial dışındakiler (1 film), `isAdult`, `Adult` türü, runtime < 60. SQL'e hiç girmez.
- **Kesin hariç önerisi (konser/performans):** BTS World Tour, BLACKPINK: Light Up the Sky, Burn the Stage, Bring the Soul, HIStory on Film Vol. II, Avicii: I'm Tim.
  Bunlar günlük "film ritüeli" için belirsiz; kararı CTO verir.
- **Elle bakılacak:** diğer Documentary'ler (*Human*, *The Gleaners and I*, *Ennio*, *The Five Obstructions* …), `video`/`tvMovie` (*Angel's Egg* sinema filmi sayılabilir).
- **Genelde güvenli (listeden çıkarılabilir):** yalnız `Music` bayraklı müzikaller/dramalar ve başlıkta `Live`/`Tour` geçen ama normal filmler.
- **Kendi eklediğim kontrol (oy tabanı altı, 20 film):** `determineCurationTier` core kurallarını (rating ≥ 8, auteur+7.0, oscar ≥ 2, …) oy tabanından **önce** uyguluyor.
  Sonuç: *Fast* (8,2 / **8 oy**), *Possible Love* (783 oy), *Look Back* (785 oy), *Dear You*, *All Wishes Come True!* … oy tabanının çok altında core'a terfi ediyor,
  ve core global slot havuzuna da girer. Bu filmleri SQL'e **koymadım**, `needs-review.csv`'ye aldım. İstenirse eklenir. Fonksiyon değiştirilmedi (kural kararı CTO'nun);
  yalnız `ARCHIVE_THRESHOLDS_STANDARD` ve `ArchiveThresholds` dışa aktarıldı (`scripts/assign-tiers.ts`, davranış aynı) ki eşik tek kaynaktan okunsun.

## 3-5. SQL dosyaları

| dosya | UPDATE | boyut (bayt) | sha256 ilk 16 |
|---|---|---|---|
| `phase1a-apply.sql` | 285 | 62.549 | `34736114325f7521` |
| `phase1a-rollback.sql` | 285 | 50.107 | `3d06755322b8aaae` |
| `phase1b-apply.sql` | 79 | 22.913 | `6d23de650ce102c4` |
| `phase1b-rollback.sql` | 79 | 18.489 | `af56b53d9f26d93d` |

(Özetler LF satır sonlu dosyadan; Windows `autocrlf` ile yeniden checkout edilirse bayt/özet değişir.)

WHERE kanıtı (grep): `phase1a-apply` 285/285 UPDATE `AND curation_tier = 'archive'` taşıyor ve yalnız `SET curation_tier` yazıyor;
`phase1b-apply` 79/79 UPDATE hem `AND imdb_rating IS NULL` hem `AND curation_tier = 'archive'` taşıyor. Tam şablon regex'ine uymayan UPDATE satırı: 0 / 0.
Rollback'ler yalnız yeni değeri taşıyan satırı geri çevirir (`AND curation_tier = '<yeni>'`, 1B'de ayrıca `AND imdb_rating = <yeni>`).

Yapı (her apply): `BEGIN;` → `CREATE TABLE films_phase1x_backup_20261031 AS SELECT …` → `ENABLE ROW LEVEL SECURITY` → film başına tek `UPDATE` →
**doğrulama bloğu** → `COMMIT;`. Doğrulama bloğu `tier-b-apply.sql` kalıbına eklenen tek fark: yedek satır sayısı beklenenden farklıysa veya
hiçbir film eski tier'da kalmışsa (`UPDATE` 0 satır etkilemiş demektir) `RAISE EXCEPTION` ile işlem geri alınır. PostgREST/SQL'de 0 satır etkileyen UPDATE hata olmadığı için eklendi.
1A ve 1B kümeleri ayrık (A: DB'de rating dolu, B: rating NULL), sırayla bağımsız uygulanabilir.

## 6. Etki ölçümü (canlı SELECT + hesap; kapıdan geçen eklemeler)

Tier sayıları (canlı → sonra): core 865 → 905 · extended 1.042 → 1.366 · trending 54 → 54 · archive 1.633 → 1.269.

| | önce | sonra |
|---|---|---|
| günlük havuz (core+extended+trending, kapıdan geçen) | 1.948 | 2.312 |
| p55 votes | 89.774 | **63.197** (−%30) |
| p80 votes | 334.419 | **271.447** (−%19) |
| medyan | 68.685 | 49.131 |
| bant (p55–p80) içi, mevcut filmler | 487 / 1.948 | mevcutlardan **çıkan 66, giren 126** |
| bant içi, yeni 364 film | – | **30 / 364** |
| ortalama tanınırlık puanı, mevcut / yeni filmler | 0,325 | 0,365 / **0,110** |

Yorum: yeni filmlerin çoğu düşük oyda (extended'ın 226'sı 5k–10k oy; core'un 37'si 5k–10k), puanları ~0,11 ile düşük ağırlıkla seçilir
(MIN_SELECTION_WEIGHT 0,01 tabanının çok üstünde ama bandın dışında). Keşifteki 936 filmlik senaryoya göre (p55 −%18) bu aşama **daha** büyük bir cetvel kayması yaratıyor,
çünkü yüksek oylu filmler (Faz 2/C) henüz yok; Faz 2 cetveli kısmen geri çeker.

**Global slot havuzu (core+trending):** 906 → 946 (+40, hepsi core). p55 290.328 → 274.694, p80 684.003 → 662.221.
40 filmin **hiçbiri bantta değil** (37'si < 10k oy). İçeriğe bakınca çoğu 50–80 yıllık Avrupa/Japon klasikleri ve anime
(*Dr. Mabuse the Gambler*, *Napoleon*, *Scenes from a Marriage*, *The Human Condition II/III*, *Early Summer*, *Kanal* …) — rating ≥ 8 / auteur kuralından core oldular.
En çok oylular: *Satluj* (2026, 8,8 / 106.958), *Jailer 2* (8,2 / 15.326), *Satantango* (8,2 / 14.693).
Global slot herkese aynı 4 filmi gösterdiği için bu eklemeler "ortak ekran" kalitesi açısından en görünür risk.
Tam liste: `phase1-rows.json` (tier = core) veya `phase1-summary.md`.

## 7. Keşifteki 8 ikonik film — Faz 1'de değil

Hepsi `release_date` NULL (C grubu, havuz kapısını geçmiyor); 7'sinde `imdb_id` de NULL, *Get Out*'ta `imdb_id` var ama `release_date` NULL ve rating/votes NULL.

| film | tmdb_id | neden C |
|---|---|---|
| Superbad | 8363 | release_date NULL + imdb_id NULL |
| Hot Fuzz | 4638 | release_date NULL + imdb_id NULL |
| Groundhog Day | 137 | release_date NULL + imdb_id NULL |
| Ferris Bueller's Day Off | 9377 | release_date NULL + imdb_id NULL |
| Bridesmaids | 55721 | release_date NULL + imdb_id NULL |
| Paddington 2 | 346648 | release_date NULL + imdb_id NULL |
| Ocean's Eleven (2001) | 161 | release_date NULL + imdb_id NULL |
| Get Out | 419430 | release_date NULL (imdb_id var, rating/votes NULL) |

## Açık riskler

1. **Core terfisi oy tabanını aşıyor** (`determineCurationTier` sırası). 20 film `needs-review.csv`'de; fonksiyon düzeltmesi bu işin kapsamı dışı (CTO kararı).
2. **Global slot kalitesi:** +40 core, hepsi bandın dışında, çoğu 5k–10k oylu klasik/anime. Global slotta tanınırlık düşebilir. Bantta olmaları yerine "auteur klasikleri" olarak seçilirler.
3. **Cetvel kayması:** p55 −%30 / p80 −%19; 66 mevcut film banttan çıkıyor, 126 giriyor. Faz 2 sonrası yeniden ölçülmeli.
4. **Bayat oy sayısı:** 17 A filmi DB'de 5.000'in altında, dosyada üstünde. Bu SQL'de değiller.
5. **Veri dosyası zamanı:** B filmleri `data/imdb/title.ratings.tsv.gz` (26 Eki) değerleriyle yazılır; 4 film dosyada yok (*I Am The Bride*, *Diamond Made Man*, *Faithless*, *Her Private Hell*), 5 film TMDb'den `imdb_id` alamadı — hiçbiri SQL'de.
6. **Yanlış `imdb_id`:** A'da DB `imdb_id`'sine güvenildi; yıl uyumsuzluğu bayrağı (> 1 yıl) devrede, A+B'de tetiklenen olmadı. B'de TMDb'ye gidilen 5 filmin (DB'de `imdb_id` yok) hiçbirinde `imdb_id` dönmedi; bu yüzden SQL'de `imdb_id` yazan satır yok.
7. **Yazma anahtarı:** hafızadaki not (`SUPABASE_SERVICE_ROLE_KEY` bu projede 401, çalışan `SUPABASE_SECRET_KEY`) — uygulama MCP ile yapılacağı için bu işi etkilemez.
8. **Geçici hata:** Supabase 522 (bağlantı zaman aşımı) betiği bir kez düşürdü, tekrar denemede geçti; betik hata durumunda sessiz kalmaz (`fail`).
