# MOOD-VEC-2b Adım 1b — Faz 1 daraltılmış kapsam

31 Eki 2026 · dal `feat/mood-vec-2b` (kaynak HEAD `51cf340`) · **yalnız hazırlık**, canlıya yazılmadı. Bu belge `phase1-icerik-ve-etki.md`'nin (Adım 1) yerine geçer;
SQL/CSV/JSON dosyaları aynı adlarla yeniden üretildi (`scripts/backfill-imdb-archive.ts`, eski çıktılar git geçmişinde: `3a2eb25`, `51cf340`).

## Uygulanan filtreler (hepsi birlikte)

1. Oy tabanı: kullanılan değer ≥ 10.000 (A: DB `imdb_votes`, B: IMDb dosyası). DB ve dosya eşiğin farklı yanındaysa film atlanır ve listelenir (`[inconsistent]`).
2. İçerik: `titleType` movie dışı hariç (tvMovie/video yalnız *Angel's Egg* istisnası), isAdult, Adult türü, runtime < 60, Documentary (Talk-Show/Reality-TV de, 0 isabet), basics runtime yok, yıl uyumsuzluğu > 1.
3. Konser/performans: BTS World Tour, BLACKPINK: Light Up the Sky, Burn the Stage, Bring the Soul, HIStory on Film Vol. II, Avicii - I'm Tim.
4. 079 ile düşen 4 film: Hoppers, Ready or Not: Here I Come, The Drama, Neon Genesis Evangelion: Death and Rebirth.
5. `determineCurationTier` oy tabanı aşımı (votes < 5.000 iken core/extended dönmesi) hariç kalmaya devam. Fonksiyon değişmedi.
6. 1B'de TMDb'den `imdb_id` alınamayan (5), IMDb dosyasında olmayan (4), bayat oylu filmler SQL dışı.

Music türü ve başlıkta Live/Tour artık tek başına hariç tutma nedeni değil (yalnız bu tanımlı listeler).

## Sonuç

| | UPDATE | core | extended |
|---|---|---|---|
| Faz 1A | **42** | 0 | 42 |
| Faz 1B | **35** | 1 | 34 |
| **Toplam** | **77** | **1** | **76** |

Önceki kapsam 364 idi; 414 aday (tier ≠ archive) → 77 SQL'de, 337 `needs-review.csv`'de.
Mutabakat (eski 364 → yeni 77): 231 oy < 10k (iki kaynak da altında) + 53 oy tutarsız + 4 trending-079 düştü = 288; *The Idea of You* (82.785 oy, yalnız Music bayrağı vardı) CSV'den SQL'e girdi → 364 − 288 + 1 = 77.
Eski "5k–10k" 263 film = 231 (iki kaynak < 10k) + 32 (DB < 10k ama dosya ≥ 10k).

Hariç tutulanların BİRİNCİL nedeni (filtre sırası; bir film birden çok bayrak taşıyabilir):

| neden | film | bu bayrağı taşıyan toplam |
|---|---|---|
| 1 oy < 10k (iki kaynak da altında) | 271 | 271 |
| 1 oy tutarsız (DB ve dosya farklı eşik yanında) | **60** | 60 |
| 2 içerik | 2 (*Hot Girls Wanted*, *Jackass: Best and Last*, ikisi de Documentary, ≥ 10k oy) | 22 |
| 3 konser | 0 (6'sı da zaten oy < 10k) | 6 |
| 4 079 trending | 4 | 4 |
| 5 oy tabanı altı | 0 (hepsi zaten oy < 10k) | 20 |
| TMDb `imdb_id` doğrulaması | 0 | 0 |
| **toplam hariç** | **337** (A 282, B 55) | |

`needs-review.csv`: 337 satır (eskiden 50). Eski dosyaya göre **288 yeni satır eklendi**, 1 satır çıktı (*The Idea of You* artık SQL'de). Sütun `sebep` artık `[kod] açıklama` biçiminde.

### Tutarsız oylar (60 film): karar gerektiriyor

- **22 B filmi:** DB `imdb_votes` TMDb vekili (kirli): ör. *Satluj* DB 8 / dosya 106.958, *No Time to Die* 7.147 / 496.644, *Black Adam* 7.046 / 310.189, *Twisters* 3.011 / 201.771,
  *Uncharted*, *Superman Returns*, *Ant-Man: Quantumania*, *The Little Mermaid* (2023), *Minions: The Rise of Gru*, *It Ends with Us*, *Satantango* (309 / 14.693) … Dosya değeri gerçek IMDb sayısı.
  Kurala harfiyen uyup atladım, ama bunlar tam olarak "tanınmış ama MoodFlix döneminden kalan" filmler. Dosya değeriyle tier'ları: 20 extended + 2 core (*Satluj*, *Satantango*).
- **38 A filmi:** DB oyu bayat (< 10k), dosya ≥ 10k. Ör. *Angel's Egg* 7.817 / 18.380, *They Will Kill You* 8.025 / 55.202, *Dr. Mabuse, the Gambler* 9.645 / 10.117, *Scenes from a Marriage* 9.576 / 10.743.
  *Angel's Egg* senin istisna listendeydi ("oyu ≥ 10k ise"): dosya değeriyle ≥ 10k ama DB değeriyle değil, bu yüzden kural onu atlatıyor.
- Öneri (karar CTO'nun): B için kullanılan değer zaten dosya değeri olduğundan B'de "DB eşiğin altında" tutarsızlığı sayılmasın; A için bayat DB oyunu da dosya değeriyle yenileyen ayrı bir adım (oy güncellemesi) düşünülebilir.

## Etki ölçümü (canlı SELECT + hesap)

Tier sayıları: core 865 → **866**, extended 1.042 → **1.118**, trending 54 → 54, archive 1.633 → **1.556**.

| günlük havuz (core+extended+trending, kapıdan geçen) | önce | sonra |
|---|---|---|
| havuz | 1.948 | 2.025 |
| p55 oy | 89.774 | **84.314** (−%6) |
| p80 oy | 334.419 | **313.417** (−%6) |
| medyan | 68.685 | 66.467 |
| bant (p55–p80) içi, mevcut filmler | 487 | **15 çıkıyor, 18 giriyor** |
| bant içi, yeni 77 film | – | **16 / 77** |
| ortalama tanınırlık puanı (mevcut / yeni) | 0,325 | 0,327 / 0,272 |

Adım 1'e (364 film) göre cetvel kayması −%30'dan −%6'ya indi.

**Global slot havuzu (core+trending):** 906 → **907** (+1): *Jailer 2* (2026, 8,2 / 15.326), bantta değil. p55 290.328 → 289.401, p80 684.003 → 684.003.

Karşılaştırma senaryosu: 22 B filmi dosya değeriyle dahil edilseydi → 99 film (96 extended + 3 core), p55 85.033, p80 310.448, bant 18 çıkan / 15 giren, yeni filmlerden bantta 27/99,
global slot +3 (*Satluj* 8,8 / 106.958, *Satantango* 8,2 / 14.693, *Jailer 2*).

## Açık riskler

1. Tutarsız oy kuralı 22 gerçekten tanınmış filmi ve 38 bayat-oylu A filmini (*Angel's Egg* dahil) dışarıda bırakıyor.
2. *The Super Mario Galaxy Movie* da 079'daki "BELİRSİZ" listesinde (`079_trending_tier_restore.sql:55`) ama senin 4'lü listende değil; Faz 1A SQL'inde (extended) kaldı.
3. Music/Live/Tour bayrakları artık hariç tutmuyor: SQL'de *The Idea of You* (82.785 oy, tür Music) var. Konser belgeselleri Documentary filtresi ve konser listesiyle dışarıda.
4. B değerleri 26 Ekim tarihli IMDb dosyasından; 4 film dosyada yok, 5 film TMDb'den `imdb_id` alamadı (hiçbiri SQL'de).
5. Supabase 522 (bağlantı zaman aşımı) betiği ilk denemede düşürdü, tekrarda geçti.
