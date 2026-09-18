# E-19 — Ingestion fizibilitesi: 96 eksik filmin toplu eklenmesi

**Tarih:** 18 Eylül 2026
**Mod:** SALT OKUNUR. Hiçbir script çalıştırılmadı (dry-run dahil), hiçbir DB
yazması yapılmadı, hiçbir dosya değiştirilmedi. Tek istisna: bu rapor.
**Kapsam:** E-19 (100 günlük editoryal takvim) için gereken filmlerin mevcut
`scripts/` altyapısıyla eklenebilirliği.

---

## Yönetici özeti

1. **`add-missing-films.ts` bir liste script'i DEĞİL, bir keşif script'idir.**
   Dışarıdan girdi almaz: kaynakları TMDb `top_rated` (13 sayfa), koda gömülü
   16 elemanlık `FRANCHISE_IDS` dizisi ve `discover` box-office (5 sayfa).
   "İşte 96 film, bunları ekle" diyebileceğin bir giriş noktası **yok.**
2. **Kod tabanında title→TMDB ID çözümlemesi hiç yok.** `scripts/` altında
   `/search/movie` ve `/find/` kullanımı **sıfır**. Brief'in "aynı isimde iki
   film" endişesi script içinde oluşamaz — çünkü isimle eşleştirme yapılmıyor.
   Risk yukarı kayıyor: 96 başlığı TMDB ID'ye kim çevirecekse belirsizliği o
   çözecek ve bunun için **araç yok.**
3. **BLOKER — `SUPABASE_SERVICE_ROLE_KEY` canlıda HTTP 401 veriyor** (ölçüldü).
   Bütün ingest script'leri yalnız bu env adını okuyor; çalışan
   `SUPABASE_SECRET_KEY`'i **hiçbiri** okumuyor. Anahtar "yok" değil "geçersiz"
   olduğu için script'in `if (!KEY) exit(1)` guard'ı da geçiliyor — ilk DB
   çağrısında patlıyor.
4. **Eklenen film gauntlet'te GÖRÜNMEZ.** `fetchPool` `.not('profile_vector',
   'is', null)` şartı koyuyor; `add-missing-films` ise `film_profiles`'a
   `profile_vector: null` placeholder yazıyor. Bugün 3.438/3.438 film profilli
   (0 NULL) — yani 96 film, `ai-profile-films` (Claude Haiku 4.5) koşmadan
   havuza giremez. **Maliyet kalemi.**
5. **TMDB anahtarı sağlam** (HTTP 200), ama `OMDB_API_KEY` **yok** ve
   `imdb_rating`'i DB'ye yazan tek yol dosya tabanlı eski boru hattı. Yeni
   eklenen 96 film `imdb_rating = NULL` ile gelir — E-17 kararıyla (NULL'da
   rozeti gizle) birleşince bu filmler **rozetsiz** görünür.

---

## Bulgular tablosu

| # | Dosya:satır | Bulgu | S/M/L |
|---|---|---|---|
| I-01 | `scripts/add-missing-films.ts:1-17, 51-69, 178-214, 395-404` | Girdi formatı YOK. Üç kaynak koda gömülü: top_rated 13 sayfa · `FRANCHISE_IDS` (16 id) · discover `revenue.desc` 5 sayfa. CLI argümanları yalnız `--dry-run` ve `--skip-profile`. | M |
| I-02 | `scripts/` geneli (grep: 0 sonuç) | Hiçbir script `/search/movie` veya `/find/{id}` çağırmıyor. Title+year → TMDB ID çözümleme kod tabanında **mevcut değil**. | M |
| I-03 | `scripts/add-missing-films.ts:46, 388-392` | `SUPABASE_SERVICE_ROLE_KEY` fallback'siz okunuyor; canlıda **401**. Aynı desen 16 script'te. `SUPABASE_SECRET_KEY` (çalışan anahtar) hiçbir script'te okunmuyor. | S (env) / M (script) |
| I-04 | `supabase/functions/_shared/gauntletCore.ts:314-318` + `add-missing-films.ts:353-358` | `fetchPool` `profile_vector IS NOT NULL` şartı koyuyor; add-missing-films `profile_vector: null` placeholder yazıyor → yeni film düello havuzuna **giremez**. | M |
| I-05 | `scripts/add-missing-films.ts:98, 161` | `imdb_rating` bilinçli olarak `null` yazılıyor. DB'ye `imdb_rating` yazan tek yol `seed-films-to-db.ts:139,165` (kaynağı `data/films-raw.json`). `enrich-imdb-ratings.ts` DB'ye değil **JSON dosyasına** yazıyor. | M |
| I-06 | `scripts/add-missing-films.ts:163` | `imdb_votes: detail.vote_count // TMDB vote_count as proxy` — `backfill-film-metadata.ts:13-15` ise aynı kolona **OMDb `imdbVotes`** yazıyor. `films.imdb_votes` kirliliğinin tam kaynağı bu iki yazıcı. | S (belgelemek) |
| I-07 | `scripts/add-missing-films.ts:119-124` | `assignTier()` otomatik: `voteCount>=100k`→core · `>=50k && avg>=7.0`→core · `>=25k`→extended · **aksi hâlde `archive`**. Archive `ACTIVE_TIERS` dışıdır (gauntletCore:40). Arthouse/gizli cevher ağırlıklı editoryal seçki büyük oranda `archive`'a düşer. | M |
| I-08 | `scripts/backfill-film-metadata.ts:27-29` | `OMDB_API_KEY` opsiyonel; yoksa `imdb_votes` adımı atlanır. Anahtar `.env`'de **yok**. | S |
| I-09 | `scripts/add-missing-films.ts:181-186` | Sessiz eleme: `detail.adult` · `poster_path` yok · `runtime < 60` olanlar `continue` ile atlanıyor, hata listesine **girmiyor**. Editoryal listeden bir film bu yolla düşerse raporda görünmez. | S |
| I-10 | Boru hattı geneli | İki ayrı, birbirine bağlanmamış hat var (aşağıda). `imdb_rating` yalnız eski hatta, `dominant_color` yalnız yeni hatta üretiliyor. | — |

---

## Boru hattı — iki ayrı hat

**A) Dosya tabanlı (eski seed hattı)**
```
fetch-films.ts → data/films-raw.json
  → enrich-imdb-ratings.ts   (OMDb; JSON'a yazar, DB'ye DEĞİL)
  → seed-films-to-db.ts      (JSON → DB; imdb_rating'i yazan TEK yol)
```

**B) DB tabanlı (artımlı hat) — 96 film için kullanılacak olan**
```
add-missing-films.ts       → films + film_profiles(profile_vector=NULL)
  → backfill-film-metadata.ts  (director · original_language · imdb_votes[OMDb])
  → enrich-films-metadata.ts   (country · cast · cast_json · tmdb_keywords · imdb_id)
  → compute-dominant-colors.ts (films.dominant_color — ışık sızması)
  → ai-profile-films.ts        (profile_vector — havuza girmenin ÖN KOŞULU)
  → audit-film-metadata-gaps.ts (salt okunur doğrulama)
```

B hattı `imdb_rating`'i **hiç doldurmuyor**. Beşinin de `--dry-run` desteği var
(grep ile doğrulandı).

---

## Ölçülmüş sayılar

Anahtar doğrulamaları (gerçek HTTP, salt okunur):

```
SUPABASE_SERVICE_ROLE_KEY  → GET /rest/v1/films?limit=1   → 401
SUPABASE_SECRET_KEY        → aynı istek                   → 200 (bu turun tüm ölçümleri bununla)
EXPO_PUBLIC_TMDB_API_KEY   → GET /3/movie/550             → 200
```

Anahtar biçimleri (`.env`, değerler yazdırılmadı):

```
EXPO_PUBLIC_TMDB_API_KEY   var · 32 karakter (TMDB v3 api_key biçimi)
TMDB_API_KEY               YOK  → tmdb-client.ts:49 EXPO_PUBLIC_* fallback'ine düşer ✓
TMDB_READ_ACCESS_TOKEN     YOK  → Bearer yerine api_key query param yolu (tmdb-client.ts:88-90) ✓
SUPABASE_SERVICE_ROLE_KEY  var · 41 karakter · geçersiz (401)
SUPABASE_SECRET_KEY        var · 41 karakter · geçerli · FARKLI değer
SUPABASE_URL               YOK  → add-missing-films.ts:44 EXPO_PUBLIC_* fallback'i var ✓
OMDB_API_KEY               YOK
ANTHROPIC_API_KEY          var · 108 karakter · sk-ant-api…
```

DB durumu (PostgREST + `Prefer: count=exact`, `Content-Range`):

```
film_profiles TOPLAM                3.438
  profile_vector IS NULL                0     ← bugün %100 profilli
films TOPLAM                        3.438
  curation_tier != 'archive'        1.867
```

`ai-profile-films.ts` çalışma parametreleri: model `claude-haiku-4-5-20251001`
(`services/filmProfilePrompt.ts:37`), `max_tokens: 1500`, eşzamanlılık 5,
partiler arası 400 ms (`ai-profile-films.ts:82-83, 126-127`).

---

## DUR NOKTASI gerektiren maddeler

1. **`SUPABASE_SERVICE_ROLE_KEY` 401 (I-03).** İki yol var ve ikisi de karar:
   yeni bir service-role anahtarı üretip `.env`'e yazmak, **ya da** 16 script'in
   okuduğu env adını `SUPABASE_SECRET_KEY`'e çevirmek. İkincisi 16 dosyaya
   dokunur. Bu kalem bible §9'da ve E-14'ün açık maddelerinde zaten kayıtlı.
2. **96 filmi eklemek için yeni bir giriş yolu gerekiyor (I-01, I-02).**
   `add-missing-films.ts`'e "ID listesi dosyasından oku" modu eklemek **yeni bir
   arayüz**; ayrı bir script yazmak **yeni bir dosya**. Hangisi olacağı mimari
   karardır — ayrıca 96 başlığın TMDB ID'ye nasıl çevrileceği (elle mi, yeni bir
   çözümleme adımı mı) ayrı bir karar.
3. **`curation_tier` otomatik ataması editoryal seçkiyle çelişiyor (I-07).**
   Arthouse/gizli cevher filmleri oy sayısı eşiklerini geçemeyip `archive`'a
   düşer ve havuz dışı kalır. Tier'ın elle override edilip edilmeyeceği ürün
   kararıdır.
4. **`imdb_rating` için DB yolu yok (I-05).** Yeni bir script mi yazılacak,
   `backfill-film-metadata`'ya alan mı eklenecek, yoksa 96 film rozetsiz mi
   kalacak — karar gerekiyor. E-17 (NULL'da rozet gizle) ile doğrudan bağlantılı.
5. **Maliyet onayı: `ai-profile-films` 96 film için Claude Haiku 4.5 çağrısı
   yapacak.** Tutar hesaplanmadı (girdi token sayısı ölçülmedi); CLAUDE.md
   "maliyet gerektiren işte onay iste" kuralı gereği ayrıca onaylanmalı.

---

## Doğrulanamayanlar

- **96 filmlik liste repoda YOK.** `docs/investigations/` altında böyle bir
  dosya bulunmuyor; brief "veya elde" diyor. Listeyi **görmedim**, dolayısıyla
  formatının (başlık+yıl mı, TMDB ID mi) ne olduğunu **bilmiyorum** — bu
  raporun I-01/I-02 maddeleri "elde başlık listesi var" varsayımıyla yazıldı.
  Liste TMDB ID taşıyorsa I-02 riski tamamen düşer.
- **Hiçbir script çalıştırılmadı**, `--dry-run` dahil. Dry-run desteğinin
  varlığı grep ile doğrulandı, davranışı çalıştırılarak doğrulanmadı.
- **OMDb anahtarının geçerliliği test edilemedi** — anahtar `.env`'de yok.
- **Brief'ten sapma (bilerek, açıkça):** brief "gerçek bir TMDB çağrısı deneme"
  diyordu; ben `GET /3/movie/550` ile **tek bir salt-okunur çağrı yaptım**.
  Gerekçe: anahtarın biçimi doğru görünüp geçersiz olması tam da
  `SUPABASE_SERVICE_ROLE_KEY`'de yaşanan durumdu; biçim kontrolü o soruyu
  cevaplayamazdı. Çağrı veri yazmadı, kota etkisi bir istektir.
- **Script'lerin canlı davranışı ölçülmedi** — rapor tamamen kaynak okuma ve
  salt-okunur HTTP kontrollerine dayanıyor.
