# Teknik Borç — 5 Ağustos 2026

> G1 dalı kapanışında kaydedildi. Buradaki maddeler **bilinen ve kabul edilmiş**
> durumlardır; keşfedilecek sürpriz değil. Her biri neden şimdi düzeltilmediğinin
> gerekçesiyle birlikte duruyor.

---

## Tip kontrolü

### `scripts/` — 14 hata

supabase-js sürüm yükseltmesinden kalma jenerik uyuşmazlığı.

| Tip | Adet |
|---|---:|
| `SupabaseClient<any,"public","public",any,any>` ↛ `SupabaseClient<unknown,…,never,never,…>` | 8 |
| `never` tipine argüman / `never` üzerinde property | 3 |
| `as` zorlaması (`Headers`→`Record`, `{}`→`.slice`, `GenericStringError`) | 3 |

Dosyalar: `enrich-films.ts`, `seed-database.ts`, `ai-profile-films.ts`,
`enrich-imdb-ratings.ts`, `verify-ai-profiles.ts`, `verify-db-state.ts`.

**Neden şimdi değil:** Bunlar `tsx` ile çalışan gerçek komutlar
(`npm run seed:films`, `npm run db:verify`). Tip düzeltmesi runtime davranışını
değiştirebilir ve şu an o riski almaya değmez. supabase-js sürüm yükseltmesiyle
birlikte ele alınacak.

### `supabase/functions` — ~~42~~ → **32** hata

`npm run typecheck:functions` (Deno 2.9.4, `deno check **/index.ts`).

> **Baseline geçmişi: 45 (5 Ağu) → 42 (8 Ağu) → 32 (13 Ağu 2026).**
> 45 → 42 adımı 8 Ağu'da ölçüldü, 9 Ağu C.0b kapanışında teyit edildi.
> **42 → 32 adımı 13 Ağu 2026'da CTO onayıyla güncellendi**; ham çıktı
> `Found 32 errors.`, iki bağımsız koşumda teyitli. Düşüş 13 Ağu turunda
> olmadı — daha önceki bir turda gerçekleşmiş ve yalnızca kök `CLAUDE.md`'ye
> yansıtılmıştı; bu tur belgeleri hizaladı.
>
> ⚠️ **Aşağıdaki kod kırılımı ESKİDİR — toplamı 43 verir, güncel 32 değil.**
> 5 Ağu'nun kırılımıdır ve iki baseline güncellemesi boyunca yeniden sayılmadı.
> Tek doğruluk kaynağı ölçüm aracının çıktısıdır (`Found 32 errors.`), bu tablo
> değil. Kırılım gerektiğinde komutun kendisi çalıştırılarak alınmalı.

| Kod | Adet | Ne demek |
|---|---:|---|
| TS2339 | 22 | `never` üzerinde property erişimi |
| TS2345 | 9 | `SupabaseClient` jenerik uyuşmazlığı |
| TS2353 | 6 | Nesne literalinde bilinmeyen alan |
| TS2352 | 5 | Yetersiz örtüşen `as` dönüşümü |
| TS2774 | 1 | Fonksiyon her zaman tanımlı — çağrı unutulmuş olabilir |
| TS2551 | 1 | `PromiseLike` üzerinde `.catch` (aşağıya bak) |
| TS2367 | 1 | Örtüşmeyen karşılaştırma |

En yoğun dosyalar: `generate-puzzles` (19), `sync-trending` (10),
`parse-mood` (6), `watchlist-activation` (3), `submit-guess` (3),
`send-notifications` (2), `slot-triple` (1), `slot-pure-random` (1).

**Neden şimdi değil:** Bu sprintte amaç ölçüm aracını kurmaktı, ölçümü
temizlemek değil. Edge Function'lar bu sprintte kapsam dışı.

---

## ⚠️ Açık runtime bug — `send-notifications/index.ts:188`

```ts
await db.rpc('increment_retry', { p_id: id }).catch(() => {
  // Fallback: just mark failed if RPC doesn't exist
})
```

`PostgrestFilterBuilder` bir `PromiseLike`'tır — `then` var, **`catch` yok**.
Bu satır çalıştığında yorumun vaat ettiği "fallback" olmaz;
`TypeError: .catch is not a function` fırlar ve retry döngüsünü düşürür.

Aynı hata `winback-sequencer`'da iki yerde vardı, commit 11'de kapatıldı
(`grantBonusSearch` + `sentryCapture`). Bu üçüncü örnek **kapatılmadı** —
G1 kısıtı "başka Edge Function'a dokunma" idi.

**Öncelik: yüksek.** Tip hatası değil, çalışan koddaki sessiz arıza.

Taranan diğer `.catch()` çağrıları temiz: `parse-mood` (×5),
`process-referral:171` ve `dev-reset-games:92` gerçek `Promise` üzerinde
(`fetch`, `req.json`) — sorun yok.

---

## Bağımlılık

### supabase-js iki kanaldan çekiliyor

| Kanal | Kullanım |
|---|---:|
| `https://esm.sh/@supabase/supabase-js@2` | 16 |
| `jsr:@supabase/supabase-js@2` | 5 |

`deno check` iki ayrı `SupabaseClient` tipi görüyor; yukarıdaki TS2345
kümesinin (9 hata) kök nedeni bu.

**KARAR:** Faz B'de yazılacak yeni Edge Function'lar (`generate-gauntlet`,
`submit-choice`) **`jsr` kanalını** kullanacak ve `_shared/` üzerinden tip
taşıyan yeni kod yazılmayacak. Mevcut karışıklık miras alınmayacak.

> Not: `supabase/functions/deno.json` bilinçli olarak `imports` alanı
> **olmadan** kuruldu. Mevcut kod tam URL kullanıyor ve Deno bunları import
> map'e bakmadan çözer; `imports` yazmak no-op alan taşımak olurdu. Kanal
> birleştirmesi import'ların çıplak specifier'a çevrilmesini gerektirir, bu da
> ayrı bir iştir.

---

## Tip tanımı

`QuickResult/index.tsx:83` ve `ResultCard/index.tsx:72` hâlâ kendi inline
`GameType` union'ını yazıyor:

```ts
gameType: 'imposter' | 'logline' | 'quoted' | 'fadein' | 'cinemetrics' | 'spotlight' | 'detective'
```

`constants/gameThemes.ts` kendini "tek kaynak" ilan ediyor ama bu iki dosya
için henüz geçerli değil. `GameType` import edilecek şekilde taşınacak.

**Risk:** Yeni oyun eklenirse üç yerden güncelleme gerekir; biri unutulursa
tip hatası vermeden sessizce eksik kalır.

---

## `generate-puzzles` — `db()` tiplenmemiş, `upsert`'te `as never`

`generate-puzzles/index.ts:97` istemciyi şöyle tutuyor:

```ts
let _db: ReturnType<typeof createClient> | null = null
```

`ReturnType<typeof createClient>` jenerikleri **varsayılanlarıyla** örnekliyor
ve `never` şeklindeki varyantı üretiyor — bu, `createClient(url, key)`'in
gerçekte döndürdüğü tip değil. Sonuç: tablo satır tipleri `never`'a çöküyor.

Görünen etkiler:

| Satır | Belirti |
|---|---|
| `:453`, `:467` | `.update({...})` → "argument of type … is not assignable to `never`" |
| `:204`, `:219` | `data?.value` / `minRow.date` → "property does not exist on type `never`" |
| `:1470` | `.upsert(row as never, …)` — cast **bu yüzden** var |

`insert()` overload'u bu durumu kazara kurtarıyor, `upsert()` kurtarmıyor;
onarım yolu (`?force=1`) eklenirken cast'siz hâli baseline'ı 45 → 46'ya
çıkarıyordu. *(O tarihteki baseline 45'ti; bugün 32 — bkz. yukarıdaki baseline
geçmişi. Bu satır tarihsel anlatıdır, güncel eşik değildir.)*

**Çözüm — `winback-sequencer/index.ts:100` deseni:**

```ts
function makeServiceClient(url: string, key: string) {
  return createClient(url, key)
}
type ServiceClient = ReturnType<typeof makeServiceClient>
```

Tip gerçek bir çağrı yerinden çıkarılıyor, `never` varyantı hiç oluşmuyor.
`generate-puzzles`'a uygulandığında yukarıdaki beş belirti birlikte kapanır
ve `as never` cast'i silinir.

**Risk:** Cast, `daily_puzzles`'a yazılan satırın şeklini tip denetiminden
tamamen çıkarıyor. Bugün doğru; yarın bir kolon adı değişirse derleyici
uyarmaz, hata çalışma anında Sentry'ye düşer.

---

## Tasarım token

Amber `#E8A838` üç ayrı anahtarda tekrarlıyor: `Colors.accentPrimary`,
`Colors.tabActive`, `Colors.chipActiveBg`.

Commit 11'de `gameThemes.ts`'teki iki ham kopya (`DEFAULT_GAME_THEME.accent`,
`GAME_THEMES.spotlight.accent`) `Colors.accentPrimary`'ye bağlandı.

> **Düzeltme:** G1 planı bu değeri `Colors.gold` sanıyordu. `Colors.gold`
> **`#D4A843`** — farklı bir ton. `Colors.gold`'a bağlamak varsayılan temanın
> ve Spotlight'ın accent'ini sessizce değiştirirdi. Doğru token
> `Colors.accentPrimary`.

Türetilmiş değerler kasıtlı olarak ham bırakıldı: `accentDim` / `accentGlow`
`rgba(232,168,56,…)` biçiminde (ondalık, hex değil) ve `progressGradient`
çiftleri ton geçişi taşıyor.

`constants/design/` kurulumunda (Faz C.1) `marquee` olarak yeniden
adlandırılacak.

---

## Gate

| Komut | Beklenen | Durum |
|---|---|---|
| `npm run typecheck` | tam **14** hata, hepsi `scripts/` altında | ✅ |
| `npm run typecheck:functions` | ~~**45**~~ → **32** — düşüş hedefli değil, regresyon bekçisi | ✅ |

`typecheck` 14'ü aşarsa veya `scripts/` dışında hata çıkarsa **dur**.
Sıfır hedefi bu sprintte yok.

> **13 Ağustos 2026 — `typecheck:functions` baseline'ı ~~45~~ → 32.** CTO
> onaylı kasıtlı güncelleme. Ham çıktı: `Found 32 errors.` (iki bağımsız
> koşum). Bu dosya ile `docs/os/4_CHOSY_CLAUDE_CODE_OS.md`'nin altı yeri ve
> kök `CLAUDE.md` aynı turda hizalandı; başka yerde eski değer kalmadı.

---

## Faz B veri katmanı — çeşitlilik güvenlik ağı (`generate-gauntlet` yazılırken uygulanacak)

`generate-gauntlet`'in çeşitlilik kuralları üç alana bakar: `director`
("aynı yönetmen ≤1"), `original_language` ("aynı dil ≤3") ve `imdb_votes`
(tanınırlık yüzdeliği). **Alan NULL ise kural hata vermez, sadece uygulanmaz** —
yani veri katmanında sessiz fallback. Kod tarafında açık korumalar gerekiyor:

1. **`director` NULL → "bilinmeyen yönetmen" tek bir bucket sayılır** ve bir
   dörtlüde **en fazla 1** tane olur. NULL'ları "hepsi farklı yönetmen" gibi
   ele almak kuralı delik bırakır.
2. **`original_language` NULL → dil kotasında ayrı bir bucket** ("bilinmeyen"),
   dil kısıtını atlatan serbest geçiş olarak sayılmaz.
3. **`imdb_votes` NULL → tanınırlık yüzdeliğinden çıkarılır**, 0 varsayılmaz.

### Havuzun mevcut durumu (6 Ağu 2026 backfill sonrası)

`core + extended + trending` = 1866 film:

| Alan | NULL |
|---|---|
| `director` | 0 |
| `original_language` | 0 |
| `imdb_votes` | 50 |
| `profile_vector` | 0 |

Düello-uygun havuz: **1816 film (%97.3)**.

`imdb_votes`'un 50'ye çıkması gerileme değil, sahte veriden arınmadır: 49 trending
satırı TMDb `vote_count` taşıyordu (aşağıya bkz.) ve dürüst değerleri NULL'dır.
49'unun `imdb_id`'si mevcut, yani `OMDB_API_KEY` eklendiğinde gerçek değerlerle
doldurulabilirler.

Kurallar bugün pratikte boşa düşmüyor; korumalar `sync-trending` ile sonradan
eklenen filmler için gerekli — yeni gelen kayıtlar `director`/`imdb_votes`
alanlarını eksik getirebiliyor.

### İki açık kalem

- **`OMDB_API_KEY` `.env`'de yok.** `imdb_votes`'un tek kaynağı OMDb'dir
  (`scripts/lib/omdb-client.ts`); TMDb `vote_count` farklı bir metriktir ve bu
  kolona yazılmaz. Anahtar eklendiğinde
  `npx tsx --env-file=.env scripts/backfill-film-metadata.ts` kalan satırı
  doldurur. `archive` tier'ında ayrıca 957 NULL var (`--tiers=` ile kapsanabilir),
  ancak bunların yalnızca 439'unda `imdb_id` mevcut.
- **~~`sync-trending` `imdb_votes = 0` yazıyor~~ — ÇÖZÜLDÜ (6 Ağu 2026).**
  Kök neden sanıldığından genişti: `detailToRow` `imdb_votes` kolonuna TMDb'nin
  `vote_count`'unu yazıyordu (`index.ts:214`). Sıfırlar bunun yalnızca vizyona
  girmemiş filmlerdeki alt kümesiydi. TMDb oy sayısı IMDb oyu değildir; iki
  metrik karışınca tanınırlık yüzdeliği hem sıfırlarda hem sıfır olmayan
  satırlarda bozulur — ikincisi daha sinsidir, çünkü meşru görünür.
  Düzeltme: `imdb_votes: null` + `FilmInsertRow.imdb_votes` tipi `null`'a
  daraltıldı (regresyonu derleme anında yakalar). Ham TMDb sayısı
  `metadata_json.vote_count`'ta korunuyor. Veri tarafında 49 trending satırı
  NULL'landı; `imdb_rating`'i dolu ve değeri TMDb'den farklı olan 9 satır
  (gerçek OMDb verisi) korundu. `scripts/audit-film-metadata-gaps.ts` artık
  regresyon uyarısı basıyor. **Deploy edilmedi** — `sync-trending` bir sonraki
  fonksiyon deploy'unda güncellenecek, o ana kadar canlı sürüm eski davranışta.

### İlgili script'ler

| Script | İş |
|---|---|
| `scripts/audit-film-metadata-gaps.ts` | Salt-okunur boşluk denetimi (öncesi/sonrası doğrulama) |
| `scripts/backfill-film-metadata.ts` | `director` + `original_language` (TMDb), `imdb_votes` (OMDb) |
| `scripts/ai-profile-films.ts --from-db` | `profile_vector`'ü DB'den okuyarak üretir (`films-raw.json` sonradan eklenen filmleri içermez) |

---

## ✅ ~~claim_device_data — cihaz provenance'i korunmuyor~~ (KAPANDI)

**KAPANDI — migration 088 (16.08.2026):** fonksiyon ve `device_id` kimlik yolu
tamamen kaldırıldı, anonim kimlik artık Anonymous Sign-In üzerinden
`auth.users`'ta yaşıyor.

**Kayıt tarihi:** 7 Ağustos 2026 (B.1 / migration 069)

`claim_device_data(p_device_id, p_user_id)` anonim satırları kayıtlı kullanıcıya
devrederken `daily_gauntlets`'te `device_id = NULL` yazıyor. Bunun sebebi
`daily_gauntlets_scope_integrity` kısıtı: `scope = 'personal'` satırında
`device_id IS NULL` olmak zorunda. Sonuç: devir sonrası "bu satır hangi
cihazdan geldi" bilgisi kayboluyor.

Bilinçli karar. `claimed_from_device` gibi bir kolon eklenmedi çünkü hiçbir
Faz C/D işi bu veriye ihtiyaç duymuyor ve şema kilitleniyor — spekülatif kolon
eklemek "bir gün lazım olur" mantığıdır, mimari ihtiyaç çıkınca genişler.

Fraud veya analitik ihtiyacı doğarsa ayrı bir migration ile eklenir.

---

## game_scores — 9 sahipsiz satır

**Kayıt tarihi:** 7 Ağustos 2026 (migration 070)

`game_scores` 12 satırın 9'unda `user_id` değeri ne `public.users`'ta ne de
`auth.users`'ta karşılık buluyor — ölü satırlar, muhtemelen silinmiş test
kullanıcılarından kalma. Bir app user'a çevrilemiyorlar.

070 yalnız policy düzeltir, veriye dokunmaz. Sonuç: bu 9 satır erişilemez
durumda kalır (zaten bozuk policy yüzünden erişilemiyorlardı).

`game_scores.user_id` üzerinde FK yok (`016:19`) ve bu 9 satır durdukça FK
eklenemez. Temizlik + FK ekleme gerekirse ayrı bir migration ile yapılır.

---

## generate-gauntlet — havuzun tamamı her istekte çekiliyor

**Kayıt tarihi:** 7 Ağustos 2026 (B.3 gate incelemesi)

ADIM 1, aday havuzunu PostgREST üzerinden sayfalayarak belleğe çekiyor
(`any` bağlamında 1.866 satır, 2 sayfa). Ölçüldü — çağrı başı yanıt süresinin
neredeyse tamamı burada:

| Aşama | Süre |
|---|---:|
| POOL sayfa 1 (1000 satır) | 886 ms |
| POOL sayfa 2 (866 satır) | 845 ms |
| `app_config` ×4 (paralel) | 210–609 ms |
| dışlama sorguları ×4 (paralel) | 211–225 ms |
| `countSignals` | 284 ms |

Uçtan uca: cold start 8,0 s · sıcak çağrı 2,0–3,3 s (ortalama 3,4 s).

**Maliyet DB'de değil, veri transferinde.** `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)`
ile ölçüldü (pooler üzerinden doğrudan bağlantı):

| Sorgu | Plan | Execution |
|---|---|---:|
| Havuz, `any` (LIMIT 1000) | Merge Join · Index Scan `film_profiles_film_id_key` + `films_pkey` | **5,0 ms** |
| Havuz, `short` (791 satır) | Hash Join · Seq Scan `film_profiles` + Index Scan `idx_films_curation_tier` | **88,5 ms** |

Yani 886 ms'lik POOL çağrısının ~880 ms'i ağ gecikmesi + PostgREST serialize.
`short` bağlamı en pahalı plan: seçicilik yüksek olduğu için `LIMIT 1000` erken
kesemiyor, planner tam taramaya geçiyor.

`film_profiles` üzerindeki Seq Scan **kaçınılmaz**: `enable_seqscan = off` ile
bile Seq Scan seçiliyor (10 milyar maliyet cezasına rağmen), çünkü
`profile_vector IS NOT NULL` için kullanılabilir index yok —
`idx_film_profiles_vector` bir vektör index'i, bu predicate'e uymuyor.
Ayrıca ölçüldü: `film_profiles` 3.394 satırın **0'ında** `profile_vector` NULL,
yani filtre bugün hiçbir satır elemiyor. Buna rağmen kaldırılamaz:
`sync-trending/index.ts:365` yeni filmler için `profile_vector: null`
placeholder satırı açıyor — filtre gerçek bir korumadır, faydası bugün sıfır.

**Bu bir quantile sorunu DEĞİL.** Süre yayılımı eşiği DB'de `percentile_cont`
ile değil, zaten çekilmiş havuzun `runtime` dizisi üzerinde JS'de hesaplanıyor:
1.000 satırda 100 sort = 21,4 ms, yani çağrı başına **0,21 ms**. Faz D'de havuz
3.394'e çıksa `n log n` ile ~0,4 ms. Cache'lenmesi gereken şey eşik değil,
havuzun kendisi.

Eşiği precompute etmek ayrıca migration 071'in commit'lenmiş gerekçesine aykırı:
eşik, ADIM 1 **sonrası** havuzun kendi dağılımından hesaplanmak zorunda —
`short` bağlamında havuz 791'e düşerken 1.866'lık dağılımın eşiğini kullanmak
tam da 071'in reddettiği hata.

**Neden şimdi değil:** Gauntlet ekranı henüz yok (C.2). Havuz cache'i bağlam ×
tier kırılımında invalidasyon stratejisi ister (yeni film, `curation_tier`
değişimi, `profile_vector` doldurma hepsi cache'i bozar) — bu mimari karar,
ekran ölçülmeden alınmamalı. C.2'de gerçek açılış süresi ölçülüp karar verilir.

---

## daily_gauntlets_film_ids_gin — ölü index

**Kayıt tarihi:** 7 Ağustos 2026 (B.3 gate incelemesi)

Migration 069 bu GIN index'ini açıkça *"B.3'teki 'son 21 gün gösterilen
filmler' filtresi için"* ekledi. B.3 o filtreyi `user_id + date` ile çekip
`film_ids` dizisini bellekte açacak şekilde yazıldı, dolayısıyla GIN'e hiç
uğramıyor: `index-stats` → **0 tarama, unused**.

Aynı taramada gauntlet zincirinin geri kalanı temiz (Seq scan 0):
`film_profiles_film_id_key` 2.764.649 · `films_pkey` 3.068.328 ·
`idx_films_curation_tier` 191 · `daily_gauntlets_user_date_uniq` 27 ·
`duel_impressions_user_pair_uniq` 39.

`EXPLAIN` ayrıca `daily_gauntlets` üzerinde iki Seq Scan gösteriyor (idempotency
SELECT'i ve "son 21 gün" filtresi). Sebebi tablo boyutu: **0 satır, 1 sayfa** —
bu boyutta Seq Scan doğru plan. Index'lerin kullanılabilir olduğu
`enable_seqscan = off` ile doğrulandı:

- idempotency SELECT → `daily_gauntlets_user_date_uniq` (partial unique), Index
  Cond `(user_id, date)` — tam uyum
- son 21 gün → `daily_gauntlets_scope_date`, `user_id` filtre olarak kalıyor

Tablo büyüdükçe planner kendiliğinden index'e geçer; bugünkü Seq Scan regresyon
değil. Diğer dışlama sorguları şimdiden index kullanıyor: `watchlist` →
`idx_watchlist_user_id` · `choice_events` → `choice_events_user_recent`
(bileşik `user_id, created_at`, tam uyum) · `duel_impressions` →
`duel_impressions_user_pair_uniq` (Bitmap Index Scan).

**Neden şimdi değil:** 24 KB, zararsız. Ama 069'daki yorumu gerçekle
uyuşmuyor — index'i okuyan biri var olmayan bir sorgu deseni varsayar.
C fazında ya filtre GIN üzerinden yazılır ya index düşürülür; ikisi de
karar gerektirir, ölü index tek başına düşürmeye değmez.

---

## taste_vector norm uzayı — w→1'de fark vektörü film vektörüyle kıyaslanamaz

**Kayıt tarihi:** 7 Ağustos 2026 (B.5, migration 074 ile birlikte)

`recompute-taste-vector` iki farklı uzaydan sinyal topluyor ve tek bir vektörde
harmanlıyor:

- `choice_events` → **fark vektörü**: `ağırlık × (kazanan − kaybeden)`.
  Yaklaşık sıfır ortalamalı, bileşenleri negatif olabilir.
- `watch_feedback` + arketip merkezleri → **mutlak vektör**: `[0,1]` aralığında,
  tamamı pozitif (`vectorEncoder.tasteProfileToVector` çıktısı).

Shrinkage her ikisini de harmanlamadan önce birim uzunluğa indiriyor, yani `w`
gerçekten ağırlık kontrolü yapıyor, vektör büyüklüğü değil — bu doğru. Sorun
formülün ucunda:

```
taste_vector = normalize( w × normalize(gözlem) + (1−w) × normalize(prior) )
w = min(1, sinyal_sayısı / 50)
```

`w` küçükken sonuca mutlak arketip merkezi hâkim ve vektör film uzayında
duruyor. **`w` 1.0'a yaklaştıkça (50+ sinyal) prior payı sıfıra iner ve
`taste_vector` saf fark vektörüne dönüşür** — artık bir film vektörüne
benzemez.

**Neden sessiz ve tehlikeli:** `film_profiles.profile_vector` mutlak/pozitif
uzayda. Faz F (kişiselleştirme, MMR) `taste_vector`'ü aday puanlamasında cosine
ile kullanmaya başladığında bu **hata vermez** — sadece anlamsız benzerlik
skorları döner. Tip kontrolü, CHECK kısıtı, Sentry: hiçbiri yakalamaz.

**Bugün ısırmıyor:** 136 kullanıcının hiçbiri 50 sinyale yakın değil
(`choice_events` prod'da **0 satır**). `w ≈ 0`, sonuç fiilen arketip prior'u.

### İkinci uç: `w→0` tarafı da kırılgan (cto-reviewer bulgusu, aynı kök)

Yukarıdaki `w→1` ucu geleceğe ait. Ama aynı uzay uyuşmazlığı **bugünkü
rejimde** başka bir yerden ısırıyor: `computeTasteVector` gözlem varsa prior'u
`nearestArchetype(gözlem)` ile seçiyor, `users.archetype_id` yalnızca sıfır
sinyalde kullanılıyor. Yani:

- Tek bir `choice` olayı bile gelse, kullanıcının **atanmış arketipi devre dışı
  kalır** ve prior'u artık o tek olayın fark vektörü seçer.
- `w ≈ 0.02` olduğu için sonucun **%98'i** bu prior. Prior seçimi = sonucun
  kendisi.
- Seçimi yapan karşılaştırma, sıfır-ortalamalı bir fark vektörü ile tamamı
  pozitif arketip merkezleri arasında cosine — yani tam da bu kaydın konusu
  olan kıyaslanamaz iki uzay. Tek olayda bu karşılaştırma gürültü hâkimiyetinde.

**Ölçüm noktası (bu uç için):** İlk gerçek gauntlet turlarından sonra, aynı
kullanıcının 1., 2. ve 5. olayında seçilen `nearest_archetype_id` kararlı mı,
yoksa her olayda zıplıyor mu? Zıplıyorsa prior seçimi `users.archetype_id` ile
harmanlanmalı ya da minimum sinyal eşiğine bağlanmalı.

`prior_source` alanı bu ölçümü mümkün kılmak için yanıtta ve logda zaten
raporlanıyor (`nearest_archetype:N` / `user_archetype:N` / `population_mean`).

**Ölçüm noktası:** İlk kullanıcı 50 sinyale ulaştığında — `taste_vector` ile
`profile_vector` arasındaki cosine dağılımını gerçek film eşleşmeleriyle
karşılaştır. Dağılım gürültüden ayrılamıyorsa formül fark uzayından mutlak
uzaya taşınmalı (ör. gözlemi kazanan vektörlerinin ağırlıklı ortalaması olarak
kurup kaybedeni indirimli çıkarmak — sonuç film uzayında kalır).

**Neden şimdi değil:** Ağırlık sıralaması B.3/B.4'te kilitlendi ve `w` formülü
CTO onayıyla bu haliyle geçti. Faz F gelmeden gerçek dağılım ölçülemez;
ölçmeden formülü değiştirmek kilitli sözleşmeyi tahminle bozmak olur.
`--full` bayrağı zaten bu senaryo için var: formül değişirse
`taste_algorithm_version` artırılır ve geçmiş yeniden kurulur.

---

## ✅ pg_cron job'larının çoğu aylardır sessizce ölü — ayarlanmamış GUC (KAPANDI)

**KAPANDI: 9 Ağu 2026, C.0b.** Migration 077 + beş fonksiyona service-role
kapısı. Kapanış kanıtı bölümün sonunda.

**Öncelik: yüksek.** Tip hatası değil, üretimde hiç çalışmayan iş.

`cron.job_run_details` ölçümü (7 Ağu 2026): en az iki job her tetiklemede
şu hatayla düşüyor —

```
unrecognized configuration parameter "app.supabase_functions_url"
```

`cron.job` tablosunda kayıt **var**, `active = true`, tetikleme **oluyor**.
Dışarıdan bakınca sistem çalışıyor görünüyor; yaptığı iş sıfır. Hiçbir alarm
çalmadı çünkü hata pg_cron'un kendi log tablosunda kalıyor — Sentry'ye
ulaşmıyor, kimse `job_run_details`'e bakmıyor.

### Kök neden

Cron gövdeleri hedef URL'yi ve service-role anahtarını `current_setting()` ile
okuyor. Bu GUC'lar bu projede **hiç kurulmamış**. Üstelik tek bir isim değil,
iki ayrı isim ailesi dolaşıyor:

| Migration | Okuduğu GUC | Durum |
|---|---|---|
| 019 | `app.settings.supabase_url` · `app.settings.service_role_key` | ayarlanmamış |
| 040, 041 | `app.supabase_functions_url` · `app.service_role_key` | ayarlanmamış |

Postgres ilk `current_setting` çağrısında patladığı için hata mesajında hep
URL parametresi görünüyor; anahtar parametresine hiç sıra gelmiyor.

### Etkilenen job'lar (migration dosyalarından tespit edildi)

| jobname | Migration | Zamanlama | Kaybedilen iş |
|---|---|---|---|
| `send-daily-pick-hourly` | 040 | `0 * * * *` | **Günlük film push bildirimi** |
| `watchlist-activation-weekend` | 041 | Cuma 15:00 UTC | Hafta sonu izleme listesi bildirimi |
| `watchlist-activation-mood-recall` | 041 | Çarşamba 17:00 UTC | Mood hatırlatma bildirimi |
| `posterle-daily-curation` | 019 | 23:00 UTC | Posterle günlük bulmaca üretimi |

Sağlam olanlar: `cleanup-rate-limits` (033 — düz SQL, `current_setting` yok) ve
`weekly-trending-sync` (049 — URL sabit yazılmış, header yok).

En ağır kalem `send-daily-pick-hourly`: bildirim altyapısının tamamı buna
bağlı, yani retention kolunun tek tetikleyicisi. `posterle-daily-curation`
görece hafif — Posterle zaten `app_config` ile dondurulmuş oyunlardan biri.

### Bu risk zaten yazılıydı, kontrol edilmedi

`040_daily_pick_notifications.sql:26`:

```sql
-- current_setting calismiyorsa hardcode URL kullanilmali — deploy sonrasi kontrol et.
```

041'de aynı uyarı iki kez tekrarlanıyor, hatta **çalışan sabit-URL alternatifi
yorum satırı olarak dosyada duruyor** (041:65-82). "Deploy sonrası kontrol et"
adımı hiç yapılmadı, alternatif hiç açılmadı. Kayıt edilmiş bir risk,
kapatılmamış bir döngü.

### Düzeltme yönü

049 desenine geçiş: sabit fonksiyon URL'si + `--no-verify-jwt` ile deploy +
service-role auth'un fonksiyon içinde `Deno.env`'den çözülmesi. Bu, bu DB'de
çalıştığı **kanıtlı** tek desen. Alternatif (GUC'ları `ALTER DATABASE ... SET`
ile kurmak) service-role anahtarını `pg_db_role_setting` içine yazar ve SQL
erişimi olan herkese açar — tercih edilmiyor.

### Kapanış koşulu

`cron.job` kaydına bakmak **yeterli değil** — bu kaydın tamamı zaten o yanılgının
ürünü. Her düzeltilen job için `cron.job_run_details`'te `status = 'succeeded'`
bir gerçek çalışma görülmeden kalem kapanmaz.

### Yeni cron yazan herkes için kural

Bu tespitten sonra **yeni migration'larda `current_setting('app.*')` deseni
kullanılmaz** (CTO kararı, 7 Ağu 2026). Migration 075 (`generate-global-slot`)
bu kararla 049 desenini kullanan ilk migration'dır.

**Neden hemen tamamı düzeltilmiyor:** Bu kalem C.2'den önce ele alınacak, ancak
her job'ın hedef Edge Function'ının hâlâ canlı ve doğru olduğu ayrıca
doğrulanmalı — `send-daily-pick` ve `watchlist-activation` mood-search dönemine
ait, gauntlet pivotundan sonra içeriklerinin geçerli olup olmadığı ayrı bir
karar. Cron'u körlemesine diriltmek aylardır susan bir bildirim akışını yanlış
içerikle aniden açabilir.

### ✅ Kapanış — 9 Ağu 2026

**Ne yapıldı:** Migration 077 altı HTTP cron'unu tek desende birleştirdi (sabit
tam URL + Vault'tan runtime okunan `Authorization` header'ı, `current_setting`
hiçbir biçimde yok). Beş hedef fonksiyona `requireServiceRole()` kapısı takıldı
ve `config.toml`'daki üç eksik `verify_jwt` beyanı tamamlandı (commit `54213d1`).

**Kapanış koşulu neydi:** "Her düzeltilen job için `cron.job_run_details`'te
gerçek bir çalışma görülmeden kalem kapanmaz." Koşul, `job_run_details`'in
yetersizliği anlaşıldığı için **sıkılaştırılarak** karşılandı — pg_net
fire-and-forget olduğu için `succeeded` bir şey kanıtlamaz; kanıt
`net._http_response.status_code` ve yan etki satırlarıdır.

| Ölçüm | Sonuç |
|---|---|
| Deploy öncesi canlı doğrulama | `generate-global-slot` 200×3, `generate-puzzles?force=1` 400×3 |
| Deploy sonrası (5.1) | `generate-global-slot` **200×2**, `generate-puzzles` 400×2 |
| Yan etki (5.2, `sync-trending`) | `films` 3394 → **3404**, `max(updated_at)` 6 Ağu → **9 Ağu 14:10**, son 15 dk **69 satır** |
| Negatif yol (5 fonksiyon, header'sız) | hepsi **401 `SERVICE_ROLE_REQUIRED`** |
| `cron.job` envanteri | 7 job, jobid'ler korundu, `current_setting` = 0, `functions/v1/` = 6 |
| pg_net ömür boyu istek | 7 → **20** |
| Geçici job temizliği | `tmp-verify-077` + `tmp-verify-sync` unschedule, `count = 7` |

5.2 kritik olan: 200 tek başına yalnızca kapının açıldığını söyler. `updated_at`
hareketi ve +10 satır, iş mantığının gerçekten koştuğunu söyler. Aylardır sıfır
iş yapan sınıf, ilk kez ölçülebilir yan etki üretti.

**Kalan iş kalem olarak ayrıldı:** dört job hâlâ `active = false` — desenleri
onarıldı ama içerikleri emekli ürüne ait. Aşağıdaki iki kaleme bakılmalı.

---

## ✅ `generate-puzzles` — auth'suz ve ücretli (KAPANDI)

> **8 Ağu 2026 — C.0a kapanışı.** Bu kalem KAPANDI. Aşağıdaki teşhis tarihsel
> kayıt olarak korunuyor; güncel durum:
>
> | Fonksiyon | Durum |
> |---|---|
> | `explain-match` | ✅ `requireUser()` eklendi, deploy edildi |
> | `parse-mood` | ✅ anon boşluğu kapatıldı (header yoksa artık 401) |
> | `rerank-films` | ✅ `requireUser()` eklendi |
> | `recommend` | ✅ `requireUser()` + rate limit eklendi (öncesinde hiç yoktu) |
> | `generate-puzzles` | ✅ `requireServiceRole()` eklendi |
>
> **Kapanış koşulu sağlandı.** `cron.job` listesi görüldü: 7 job var, hiçbiri
> `generate-puzzles` çağırmıyor. "Auth eklersem cron sessizce ölür" endişesinin
> dayanağı yoktu — ortada cron yok, `daily_puzzles`'ın dolu olması elle
> çalıştırmalardan geliyordu. Bunun üzerine `_shared/auth.ts` →
> `requireServiceRole()` eklendi: Bearer token'ı `SUPABASE_SERVICE_ROLE_KEY`
> ile SHA-256 üzerinden sabit-zamanlı karşılaştırıyor, eşleşmeyen her çağrı 401.
>
> `requireUser()` KULLANILMADI — çağıran bir kullanıcı değil, batch üretim işi.
> `recompute-*` dosyalarındaki imzasız `atob` role-claim deseni de kullanılmadı:
> o desen yalnızca gateway JWT'yi doğruladığında (`verify_jwt` beyansız)
> güvenli; `generate-puzzles`'ta `verify_jwt = false` olduğu için forge
> edilebilirdi. Gerekçenin tamamı `_shared/auth.ts` başında.
>
> **Pozitif yol doğrulandı (8 Ağu 2026):** `sb_secret_…` ile çağrı **400
> `FORCE_WITHOUT_DATE`** dönüyor — auth geçiyor, üretim tetiklenmiyor.
> Negatif yolların hepsi (header yok / anon key / uydurma token / legacy JWT)
> 401 `SERVICE_ROLE_REQUIRED`. Kalem tam olarak kapandı.
>
> **Anahtar kuşağı sürprizi.** Deploy sonrası ölçüldü: fonksiyona enjekte
> edilen `SUPABASE_SERVICE_ROLE_KEY` **yeni biçim** (`sb_secret_…`, 41 kr),
> `.env`/`scripts/` altındaki ise **legacy JWT** (`eyJ…`, 219 kr). İkisi farklı
> anahtar; legacy JWT ile çağrı 401 alıyor. Kapının tek anahtara bakması CTO
> kararı. Doğru değer yalnızca Dashboard'dan alınır — `supabase projects
> api-keys` secret'ları `·····` ile maskeliyor.
>
> Yan bulgu: `_shared/auth.ts` yorumundaki "gateway Authorization başlığını
> yeniden yazıyor" iddiası (`recompute-*` dosyalarından geliyor) **yanlış**.
> Ölçüldü: başlık fonksiyona bozulmadan ulaşıyor (`Bearer eyJ…`, 219 kr).
>
> **Yan etki (giderildi):** `tests/founder-acceptance/runner.ts` anon key ile
> `parse-mood` çağırıyordu, `requireUser()` sonrası 401 alacaktı. Runner artık
> uygulamanın kendisi gibi `signInAnonymously()` ile oturum açıyor.
>
> **Kırık sayaç onarıldı.** Aşağıda 1/2/3 diye sayılan üç kusurun üçü de
> kapandı: artırma migration 076'daki `increment_rate_limit` RPC'sine taşındı
> (atomik, `ON CONFLICT DO UPDATE ... + 1`), `extractUserId`'nin imzasız
> `atob` decode'u **dosyadan tamamen silindi** (kimlik artık `_shared/auth.ts`
> → `requireUser()` ile imza doğrulanarak geliyor), DB hatası **fail-closed**
> (503 + Sentry `level: 'error'`).
>
> Ölçüldü (8 Ağu 2026): `recommend`'e 13 istek → sayaç tam 13, ilk 10 geçti,
> 3'ü 429. Sahte `sub` taşıyan imzasız JWT → 401. Anon key → 401.
>
> **`generate-puzzles` neden hâlâ açık:** çağıranı cron'dur ve o cron
> `cron.schedule` ile SQL Editor'den kurulmuş — repoda migration'ı YOK, yani
> hangi header'ı gönderdiği kod tabanından doğrulanamıyor. Doğrulamadan auth
> eklemek tam olarak bu dosyanın "pg_cron job'ları sessizce ölü" kaleminde
> anlatılan hatanın yenisini üretirdi. Kapanış koşulu: `cron.job` listesi
> görülecek; listede yoksa (elle tetikleniyorsa) auth eklenmesi hiçbir şeyi
> kırmaz ve doğrudan eklenir.

**Öncelik: yüksek.** 7 Ağu 2026'da `supabase/config.toml` yazılırken tespit edildi.

İki Edge Function `--no-verify-jwt` ile deploy ediliyor **ve içeride de hiçbir
kimlik kontrolü yapmıyor**. Ölçüldü — dosyalarda `requireAuthUser`,
`getUserClient`, `auth.getUser` veya bir paylaşılan sır kontrolü yok:

| Fonksiyon | İç auth | Ücretli çağrı |
|---|---|---|
| `explain-match` | **yok** | LLM API |
| `generate-puzzles` | **yok** | LLM API |

Karşılaştırma: `parse-mood`, `slot-triple`, `slot-pure-random`,
`slot-mood-filtered` de `--no-verify-jwt` ile deploy ediliyor ama dördü de
`auth.getUser` ile çağıranı fonksiyon içinde doğruluyor. `revenuecat-webhook`
kendi paylaşılan sırrını kontrol ediyor. Yani desen projede zaten var; bu iki
fonksiyon deseni uygulamıyor.

### `explain-match`'teki rate limit KORUMA SAĞLAMIYOR (kod okundu, 8 Ağu 2026)

`explain-match` `checkRateLimit(req, 'explain-match')` çağırıyor — yani
dışarıdan bakınca 30/dakika korumalı görünüyor. **Üç ayrı nedenle korumuyor:**

**1. Sayaç her istekte 1'e sıfırlanıyor — limit HİÇ tetiklenmiyor.**
`_shared/rateLimit.ts:70-98` upsert'ü `request_count: 1` sabitiyle yapıyor ve
`ignoreDuplicates: false` veriyor. Çakışmada `ON CONFLICT DO UPDATE` sayacı
mevcut değerin üzerine **1 yazıyor**. Dönen değer bu yüzden her zaman 1, ve
hemen ardındaki `if (data.request_count === 1) return` her istekte erken
dönüyor. Altındaki artırma bloğu (`:100-122`) **ulaşılamaz kod** — `throw new
RateLimitError` satırı hiç çalışmıyor. Tablo yalnızca "bu dakikada çağrıldı"
kaydı tutuyor, sayım yapmıyor.

**2. Kimlik doğrulanmadan JWT'den okunuyor — sahtelenebilir.**
`rateLimit.ts:33-45` `extractUserId` JWT'yi **imza doğrulamadan** base64 decode
edip `payload.sub`'ı alıyor (yorumu bunu açıkça yazıyor: "imza doğrulaması
gerekmiyor, sadece kimlik için"). Saldırgan her istekte uydurma bir `sub`
göndererek sınırsız sayıda taze kova açabilir. Sayaç çalışsaydı bile bu tek
başına limiti etkisiz kılardı.

**3. DB hatasında sessizce geçiriyor.**
`rateLimit.ts:88-92` — hata olursa `console.error` + `return`, yani istek
geçiyor. Sentry'ye düşmüyor. Proje kuralı 1 ihlali (sessiz fallback yasak).

Sonuç: URL'i bilen herkes bu iki endpoint'i **sınırsız** çağırıp API kredisi
harcatabilir. Kota altyapısı (`check-quota`, `api_rate_limits`, migration 033)
mevcut ama `explain-match` yolunda çalışmıyor, `generate-puzzles` yolunda hiç
yok.

### ⚠️ `verify_jwt = true` bu sorunu ÇÖZMEZ

İlk akla gelen düzeltme yanıltıcı: `verify_jwt` Supabase proje anahtarıyla
imzalanmış herhangi bir JWT'yi kabul eder — **anon anahtarı dahil**. Anon
anahtarı React Native bundle'ında bulunuyor (`EXPO_PUBLIC_SUPABASE_ANON_KEY`),
yani saldırganın onu elde etmesi tam olarak fonksiyon URL'ini elde etmesi kadar
kolay. `verify_jwt` açmak yalnızca "URL'i buldum, körlemesine curl atıyorum"
seviyesini keser; hedefli sömürüyü kesmez.

Gerçek düzeltme üç parçalı:
1. Fonksiyon içinde `auth.getUser` ile **gerçek kullanıcı** doğrulaması
   (`parse-mood` deseni); anon reddedilir.
2. `rateLimit.ts`'in sayaç hatası düzeltilir (upsert yerine atomik
   `increment` RPC'si) ve `extractUserId` doğrulanmış kimliği kullanır.
3. DB hatasında sessiz geçiş kaldırılır — Sentry + fail-closed.

`rateLimit.ts` düzeltmesi `parse-mood` ve `rerank-films`'i de kapsar: üçü de
aynı kırık sayacı kullanıyor. O ikisinde kimlik doğrulaması olduğu için etki
daha düşük, ama sayaç orada da çalışmıyor.

`supabase/config.toml` bu iki fonksiyon için `verify_jwt = false` beyanı
içeriyor. Bu beyan mevcut gerçeği KAYDEDER, onaylamaz — satırlar önce içeriye
auth eklenmeden silinirse fonksiyonlar çalışmayı bırakır.

**Düzeltme yönü:** `parse-mood` deseni (fonksiyon içinde `auth.getUser`) ya da
`generate-puzzles` cron'dan tetikleniyorsa paylaşılan sır kontrolü. Hangisinin
doğru olduğu çağrı yerine bağlı ve önce tespit edilmeli.

**Neden şimdi değil:** B.5 kapsamında değil ve iki fonksiyonun çağrı yerleri
(istemci mi, cron mu, ikisi birden mi) doğrulanmadan auth eklemek canlı bir
akışı kırabilir. `generate-puzzles` mood-search/oyun dönemine ait — gauntlet
pivotundan sonra hâlâ çağrılıp çağrılmadığı ayrıca kontrol edilmeli.

---

## 🔴 `slot-mood-filtered` — `body.user_id` fallback'i kimlik taklidine açık

**Öncelik: yüksek. Kalem: C.0c.** 8 Ağu 2026'da C.0a auth taraması sırasında
bulundu, o turda bilinçli olarak kapsam dışı bırakıldı.

`supabase/functions/slot-mood-filtered/index.ts:48-95` kimliği **iki
stratejiyle** çözüyor ve ikincisi hiçbir şey doğrulamıyor:

```
// Strategy 1: JWT auth        → auth.getUser() ile DOĞRULANMIŞ kimlik ✓
// Strategy 2: body.user_id fallback  → gövdeden okunan ham string ✗
const bodyUserId = body.user_id as string | undefined
if (bodyUserId) {
  const { data } = await admin.from('users').select('id, subscription_tier').eq('id', bodyUserId)
  if (data) return { userId: data.id, tier: data.subscription_tier ?? 'free' }
}
```

Strateji 1 başarısız olduğunda — ya da hiç Authorization header'ı
gönderilmediğinde — çağıran, **gövdeye başka bir kullanıcının `user_id`'sini
yazarak o kullanıcı olarak işlem görür**. Lookup `admin` (service role)
client'ı ile yapıldığı için RLS de devrede değil. Bu bir rate limit boşluğu
değil, doğrudan **kimlik taklidi (impersonation)** açığıdır:

- Kurbanın `subscription_tier` değeri okunur (premium hakları kullanılabilir)
- İşlem kurbanın kimliğine yazılır
- Ücretli LLM çağrısı kurbanın kotasından harcanır

`user_id`'ler tahmin edilemez UUID'ler ama gizli değil — istemciye dönen pek
çok yanıtta ve paylaşılan içerikte görünürler. Gizlilik kimlik doğrulaması
değildir.

**Neden C.0a'da kapatılmadı:** o turun kapsamı "kimliksiz çağrılabilen + LLM
harcayan" fonksiyonlardı ve kapsamı büyütmek bilinçli olarak reddedildi. Bu
kalem ayrı ele alınacak çünkü fallback'in **neden** eklendiği kod tabanından
anlaşılmıyor — muhtemelen oturum kurulmadan önceki bir akış için. Fallback'i
körlemesine silmek o akışı sessizce kırabilir; önce çağıranı doğrulanmalı.

**Düzeltme yönü:** Strateji 2 tamamen kaldırılır ve `_shared/auth.ts` →
`requireUser()` kullanılır (C.0a'da 4 fonksiyonda uygulanan desen). Fallback'e
gerçekten ihtiyaç duyan bir akış varsa, o akış anonim oturum açmalı —
`app/_layout.tsx:196` zaten her istemci için `signInAnonymously()` çağırıyor,
yani doğrulanmış bir kimlik HER ZAMAN mevcut.

**🔴 önceliği korunuyor — 16 Ağu 2026 notu.** Bu, migration **088** ile şemadan
kaldırılan `device_id` anti-pattern'inin **kod tarafındaki kardeşi**: her ikisi
de "istemciden gelen doğrulanamaz kimlik". 16 Ağu'da doğrulandı, fallback hâlâ
canlı (`index.tsx:77-80`, `console.log('[auth] Fallback to body.user_id')`).

C.7 kapsamına **bilerek alınmadı** — ayrı iş kalemi. Şemadaki yolu kapatıp
koddaki kardeşini açık bırakmak aynı deliği bir katman aşağıda sürdürmek olur,
bu yüzden takip edilmeli.

⚠️ **Önce bir doğrulama gerekiyor, düzeltme değil:** bu fonksiyon muhtemelen
C.6'da (`087_games_portfolio_prune`) dondurulan `slot-*` ailesiyle ilişkili.
Eğer yüzey zaten `app_config` ile kapalıysa açığın sömürülebilirliği ve
dolayısıyla önceliği değişir — ama fonksiyon deploy edilmiş durumda kaldığı
sürece Edge endpoint'i çağrılabilir olmaya devam eder, feature flag istemciyi
durdurur, gateway'i durdurmaz. İlk adım: **kullanımda mı, zaten donmuş bir
yüzey mi** — bu belirlenmeden düzeltmeye girilmemeli.

---

## 🟡 `parse-taste` — anon isteklerde kota sessizce atlanıyor

**Öncelik: orta. Kalem: C.0c ile birlikte.** 8 Ağu 2026'da bulundu.

`supabase/functions/parse-taste/index.ts:293-330` `checkSearchQuota`'sı,
`parse-mood`'un 8 Ağu'da onarılan hâlinin aynısını yapıyor: header yoksa ya da
`getUser` başarısız olursa `{ allowed: true }` dönüyor, yani **kota kontrol
edilmeden ücretli Claude çağrısı yapılıyor**.

`parse-mood`'dan farkı: `config.toml`'de beyanı yok, yani platform
`verify_jwt = true` uyguluyor ve çağıranın en azından anon key taşıması
gerekiyor. Ama o key uygulama binary'sinde gömülü — bu kalemin hemen üstündeki
"`verify_jwt = true` bu sorunu ÇÖZMEZ" bölümü aynen geçerli.

**Düzeltme yönü:** `parse-mood`'un C.0a'daki onarımının birebir aynısı —
handler başında `requireUser()`, ardından `checkRateLimit(auth.authUserId, …)`,
ve `checkSearchQuota` doğrulanmış `appUserId` alır. Şablon hazır.

---

## ✅ `parse-mood` — `APP_USER_MISSING` yolunda kota fail-open (KAPANDI)

**Kapandı: 10 Ağu 2026, C.0c kalem 3.** Fail-open kaldırıldı, dal artık 403
döndürüyor. Uygulama detayı bu bölümün sonunda.

⚠️ **8 Ağu kararı 10 Ağu'da DEĞİŞTİ.** Aşağıdaki tabloda "Edge'de tembel satır
oluştur" ✅ ile, "fail-open'ı kapat" ❌ ile işaretli. C.0c oturumunda CTO bunun
tersine karar verdi: satır oluşturma (lazy insert) **C.7'ye ertelendi**, kısa
vadeli çözüm fail-closed oldu. Tablo tarihsel kayıt olarak bırakılıyor —
silinmiyor ki kararın hangi gerekçeyle döndüğü izlenebilsin.

**Öncelik: yüksek. Kalem: C.0b.** 8 Ağu 2026, C.0a kapanış incelemesinde bulundu.

`supabase/functions/parse-mood/index.ts:176-183` — `requireUser()` kimliği
doğruluyor ama `public.users` satırı yoksa `appUserId === null` geliyor ve
`checkSearchQuota` **`return { allowed: true }`** diyor. Yani kimliği doğru,
kotası yok: ücretli Claude çağrısı sınırsız. Üstelik her istekte bir Sentry
`warning` yazılıyor.

**Bu bir veri bütünlüğü sorunu DEĞİL — ölçüldü (8 Ağu 2026):**

| Ölçüm | Değer |
|---|---|
| `auth.users` | 225 (161'i anonim) |
| `public.users` | 137 — **hepsinin `auth_id`'si dolu**, NULL yok |
| Köprüsüz `auth.users` | 88 |
| ...bunların anonim olanı | 87 |
| ...anonim olmayan | 1 — `provider=email`, `last_sign_in_at` **boş** (kaydolmuş, hiç giriş yapmamış) |
| Anonim + köprülü | 74 / 161 |

Trigger yok ve **olması da beklenmiyor**: köprü `services/auth-utils.ts:31`
→ `getAppUserId()` tarafından **tembel** kuruluyor, ilk ihtiyaç anında
(watchlist, taste sinyali vb.). 87 anonim kullanıcı bu eylemlerin hiçbirini
yapmamış. İki tanesi bugünkü `test:founder` koşumlarının kendisi.

**Asıl sorun bu tembelliğin sırası:** yeni bir kullanıcının **ilk** mood
araması, `getAppUserId()`'yi tetikleyen herhangi bir eylemden ÖNCE oluyor.
Yani fail-open yolu marjinal bir kenar durum değil — anonim kullanıcıların
%54'ü herhangi bir anda köprüsüz ve ilk arama tam bu pencerede.

**Düzeltme yönü — KARAR VERİLDİ (CTO, 8 Ağu 2026): Edge'de satırı oluştur.**

Üç seçenek değerlendirildi:

| Seçenek | Karar | Gerekçe |
|---|---|---|
| Kotayı `authUserId` kovasında tut | ❌ | `public.users`'ın neden var olduğu sorusunu atlıyor. İki UUID uzayının ayrı tutulma sebebi (`app_user_id()` SECURITY INVOKER + RLS) hâlâ geçerli; kısayol o modelde delik açar |
| **Edge'de tembel satır oluştur** | ✅ | Zaten var olan `getAppUserId()` desenini (`services/auth-utils.ts:31`) `parse-mood`'un kendisine taşımak. Yeni mimari değil, mevcut desenin yer değiştirmesi |
| Fail-open'ı kapat, 409 dön | ❌ | İlk kullanıcıyı anlık olarak reddeder. Kötü ilk izlenim; "sistem beni öğreniyor" hissinin tam tersi |

Uygulama notu: `auth-utils.ts`'teki 23505 (unique_violation) toleransı Edge
tarafında da korunmalı — eşzamanlı iki istek aynı `auth_id` için yarışabilir.

**Ne yapıldı (10 Ağu 2026, C.0c):** `checkSearchQuota` `appUserId === null`
dalı `{ allowed: false, reason: 'APP_USER_MISSING' }` döndürüyor; handler bu
sebebi ayırıp **403** dönüyor (401 değil — kimlik geçerli, eksik olan uygulama
satırı). Sentry seviyesi `warning` → `error`. İstemci zinciri:
`tasteParser.ts` → `MoodParseError('APP_USER_MISSING')` →
`errorHelpers.ts` (`type: 'auth'`, `retryable: false`) →
`app/(tabs)/index.tsx` `t('errors.accountSetupIncomplete')`.

Kabul edilen bedel: 838. satırdaki ❌ gerekçesi ("ilk kullanıcıyı anlık olarak
reddeder") hâlâ geçerli ve şimdi gerçekleşiyor. Sayaçsız ücretli LLM yolunu
açık bırakmaya tercih edildi. Kalıcı çözüm C.7.

---

## ✅ ~~`public.users` satırı anonim kimlikler için HİÇ oluşmuyor~~ (KAPANDI)

**KAPANDI — 16 Ağu 2026, iki parça hâlinde:**

1. **Birikmiş 87 kimlik:** migration **082** (14 Ağu) hepsine satır açtı —
   `public.users` 139 → 231. `created_at` `auth.users`'tan taşındı, kohort
   analizi bozulmadı.
2. **Yeni kimlikler:** `ensureAppUser()` bootstrap'ı (`f44fac2`, 10 Ağu,
   `INITIAL_SESSION` + `SIGNED_IN`) sızıntıyı durdurdu. 16 Ağu canlı ölçümü:
   bootstrap sonrası doğan kimlikler satırı **0,2–1,3 saniyede** aldı.

Başlıktaki eski **"(kalıcı)"** nitelemesi bu yüzden düştü: satır artık hem
geçmişe dönük hem ileriye dönük oluşuyor.

⚠️ Kapanış **koşulsuz değil**: bootstrap istemci kodunda yaşıyor, yani kimliği
istemci dışından açan her yol orphan üretebilir. 16 Ağu'da ölçülen üç orphan'ın
kaynağı tam olarak buydu — `tests/founder-acceptance/runner.ts` (düzeltildi,
C.7). Aynı sınıftan yeni bir yol eklenirse (script, web istemcisi) boşluk geri
gelir.

**Öncelik (tarihsel): yüksek. Kalem: C.7 — C.1'den ÖNCE.** 10 Ağu 2026,
senaryo B doğrulandı.

87 kimlik, **2026-04-23'ten** beri satırsız. En yenisi 2026-08-08. Son 48
saatte **0** yeni çözülme; dağılım 3,5 aya kesintisiz yayılmış. Yarış koşulu
olsaydı satırsızlar son saatlerde kümelenirdi — kümelenmiyor. Satır **hiç
oluşmuyor ve kendiliğinden de oluşmayacak.**

**Sonuç:** ürüne dokunan kimliklerin **~%58'i** (87 / 150) hiçbir sinyal
üretmedi. LLM çağrıları yapılıyordu, sonuçları hiçbir yere yazılmıyordu —
109 gün boyunca saf maliyet.

**Kod tarafı ölçüldü (10 Ağu 2026, C.0c adım 2):** `public.users`'a INSERT
yapan **tek** kod yolu `services/auth-utils.ts:31-33` → `getAppUserId()`.
Repo genelinde başka `users` INSERT'i yok. Auth akışının hiçbir adımı bu
fonksiyonu çağırmıyor (detay: bir sonraki kalem). Satır yalnızca
`getAppUserId()`'yi çağıran bir ürün eylemi gerçekleşirse açılıyor.

Şema ve RLS bu yolu engellemiyor — `users` tablosunda `auth_id` dışında NOT
NULL kolon yok (001:14-21) ve `"users: self insert"` policy'si
`WITH CHECK (auth_id = auth.uid()::text)` ile INSERT'e izin veriyor
(001:143-145). Yani INSERT teknik olarak mümkün; sorun çağrılmaması.

C.0c'de `parse-mood` bu durumu 403 ile reddeder hâle geldi — tutarsızlık artık
kullanıcıya yansıyor, sessiz değil. Bu borcu kapatmaz, görünür kılar.

**Yapıldı (C.7):** satır oluşturmanın tek ve deterministik noktası
`app/_layout.tsx` → `onAuthStateChange` → `bootstrapAppUser()` oldu. 8 Ağu'da
tartışılan diğer seçenekler (Edge'de tembel insert, `auth.users` trigger'ı)
seçilmedi.

---

## 🟢 `app/(tabs)/index.tsx:145` `useFocusEffect` — satır açmama kök nedeni teşhis edilmedi

**Öncelik: düşük. Teşhis borcu.** 10 Ağu 2026'da bulundu, 16 Ağu'da üst
maddeden ayrıldı.

`useFocusEffect` ekrana her girişte `getAppUserId()` çağırıyor ve o fonksiyonun
içinde INSERT var — yani bu satır 87 kimliğin en azından bir kısmına satır
açmalıydı. **Neden açmadığı kod okumasıyla belirlenemedi.** O bloğun `catch`'i
(`149-151`) hatayı **sessizce yutuyor** ("recent searches opsiyonel"), yani
INSERT başarısız olduysa hiçbir iz bırakmadı.

**Artık kritik yolda değil** — `ensureAppUser()` bootstrap'ı satır açma işini
bu yoldan tamamen devraldı ve boşluğu kapatıyor. Ama teşhis borcu duruyor:
sessizce yutulan bir INSERT hatasının sebebi hâlâ bilinmiyor ve aynı sebep
başka bir çağrı noktasında da etkin olabilir. Boş olmayan ama hatayı yutan
`catch` bloğu ayrıca CLAUDE.md kural 1 ihlali.

---

## 🟡 Sosyal giriş akışı `public.users` satırı AÇMIYOR — sadece UPDATE ediyor

**Öncelik: 16 Ağu 2026'da yüksekten ortaya DÜŞÜRÜLDÜ (🔴 → 🟡).** Tespitin
kendisi geçerli, sonucu değişti — gerekçe bu maddenin sonundaki "Bugünkü
durum" bölümünde.

**Kayıt:** 10 Ağu 2026, C.0c adım 2'de kod yolu izlendi.

Köprüsüz 88 kimliğin 87'si anonim; **1 tanesi anonim değil** —
`provider = email`, `last_sign_in_at` **boş**.

**Kök neden bulundu.** `services/authService.ts`'teki giriş sonrası adımların
**hepsi UPDATE**, hiçbiri INSERT değil:

| Kod yolu | İşlem | Satır yoksa |
|---|---|---|
| `signInWithApple` → `syncAuthProvider('apple')` (`:141-144`) | `UPDATE users SET auth_provider` | 0 satır, `error` **null** |
| `signInWithApple` → `syncDisplayName` (`:113-117`) | `UPDATE users SET display_name` | 0 satır, `error` **null** |
| `signInWithGoogle` → `syncAuthProvider('google')` (`:141-144`) | `UPDATE users SET auth_provider` | 0 satır, `error` **null** |
| `setup-profile.tsx` → `updateUserProfile` (`:376-379`) | `UPDATE users SET username, avatar_url` | 0 satır, `error` **null**, **`{success:true}` döner** |

PostgREST'te 0 satır etkileyen UPDATE hata değildir. Dolayısıyla kullanıcı
Apple/Google ile giriş yapar, `setup-profile` ekranını doldurur, ekran
"başarılı" der ve `/(tabs)`'a yönlendirir — **`public.users`'ta hiçbir şey
oluşmamıştır.** Kayıt akışının tamamı, var olmayan bir satırı güncellemeye
çalışıp sessizce başarılı görünüyor.

`authService.ts` `getAppUserId`'yi import ediyor (`:28`) ama yalnızca
`deleteAccount` içinde (`:470`) kullanıyor — yani satır, hesap **silinirken**
açılıyor olabilir; oluşturulurken değil.

**Bugünkü durum (16 Ağu 2026) — sonuç geçersiz, kusur geçerli.**

Yukarıdaki paragraf eskiden şöyle bitiyordu: *"kullanıcı Apple/Google ile giriş
yapar, `setup-profile`'ı doldurur, ekran başarılı der ve `public.users`'ta
hiçbir şey oluşmamıştır."* **Bu iddia artık geçersiz:** `ensureAppUser()`
bootstrap'ı `SIGNED_IN` (ve `INITIAL_SESSION`) olayında satırı **koşulsuz**
açıyor, sosyal giriş akışı da o olayı üretiyor. Dolayısıyla UPDATE'ler artık
var olan bir satıra çarpıyor ve "hesap oluştur" yönlendirmesi çalışıyor.

**Kusurun kendisi olduğu gibi duruyor:** bu dört kod yolunun hiçbiri kaç satır
etkilediğini kontrol etmiyor. PostgREST'te 0 satır etkileyen UPDATE hata
değildir — bugün satır var diye sessizlik kabul edilebilir hâle gelmiyor, sadece
zararsızlaşıyor. Satırın herhangi bir sebeple yok olduğu (ya da bootstrap'ın
başarısız olduğu) her senaryoda aynı sessiz başarı geri gelir. Bu, bu dosyadaki
**"75 `.update()` çağrısının en az 63'ü 0-satır durumunu tespit edemiyor"**
maddesinin somut bir örneği; çözümü de orayla birlikte düşünülmeli.

**Yapılacak:** satır oluşturma tarafı C.7'de kapandı. Kalan iş, bu dört
UPDATE'in 0-satır durumunu tespit edip raporlaması.

---

## 🔴 2026-04-23 → 2026-08-08 arası kohort/retention ölçümleri geçersiz

**Öncelik: yüksek. Kalem: C.7 sonrası.** 10 Ağu 2026.

Yukarıdaki boşluk 3,5 ay boyunca açık kaldığı için o dönemin tüm
retention/kohort sayıları **eksik payda** üzerinden hesaplandı: ürüne dokunan
kimliklerin ~%58'i hiçbir satır, sinyal veya olay üretmedi.

**Geçmiş veri kurtarılamaz.** `auth.users` tarafında kimlikler duruyor ama
davranış verisi hiç yazılmadı — geriye dönük türetilecek bir kayıt yok.

Etkilenenler:
- 3,5 aylık retention ve kohort analizleri — yeniden kullanılmamalı
- C.4 watched-it rate — ölçüm C.7 kapanmadan başlarsa aynı boşluğu tekrarlar
- 1.000 kullanıcı gate'i — payda tanımı §1'de kilitli ve doğru, ama boşluk
  kapanmazsa gate hiç dolmaz

**Yapılacak:** ölçüm C.7 sonrası sıfırdan başlar. Önceki dönem raporlarına
"eksik payda" notu düşülecek.

**⚠️ 082 backfill'i bu maddeyi KAPATMIYOR — tersine yeni bir tuzak ekliyor
(16 Ağu 2026 notu).** Migration 082 (14 Ağu) 88 orphan kimliğe `public.users`
satırı açtı: **139 → 227** (bugün 233). Ama backfill **satır** açtı,
**davranış verisi** açmadı — o 88 satır aktivitesizdir. Yani bu maddedeki
"eksik payda" sorunu artık **ters yönde** de var: ham `public.users` sayısı
kullanılırsa payda şişer.

`public.users` sayısı bu tarihten sonra **üç parçalı** okunmalı:
`auth.users` 234 · `public.users` 233 (88'i backfill, aktivitesiz) ·
**davranış geçmişi olan 139**. `docs/os/1_CHOSY_PRODUCT_OS.md` §8.6 ve
`2_CHOSY_BUSINESS_MODEL.md` §2'deki çıplak "135/139 kullanıcı" ifadeleri bu
yüzden güncellenmeli (ayrı doküman işi).

1.000 kullanıcı gate'i **bozulmuyor**: tanımı aktivite tabanlı (son 28 günde
≥1 tamamlanmış gauntlet), üyelik tabanlı değil.

---

## 🟠 2026-05-11 haftasında 32 kimlik kaybı — tek sürümde 3-4 kat sıçrama

**Öncelik: orta. Kalem: C.7 araştırması.** 10 Ağu 2026, C.0c kalem 4.

87 kimlik satırsız**DI** — o taraf migration **082** ile 14 Ağu'da kapandı
(hepsine satır açıldı). **Bu maddenin açık sorusu kapanmadı:** satırsızların
3,5 aya yayılan dağılımında **2026-05-11 haftası tek başına 32 kayıp** taşıyor
— normalin 3-4 katı. Dağılımın geri kalanı düzgünse bu hafta bir sürümle
örtüşüyor olabilir ve **o sürümde ne olduğu hâlâ incelenmedi.**

**Yapılacak:** `git log 2026-05-04..2026-05-18` incelenecek. Aranan şey yalnız
kimlik zinciri değil: o sürümde başka bir regresyon da girmiş olabilir ve aynı
sessizlik sınıfından olduğu için hâlâ fark edilmemiş olabilir.

Not: kimlik boşluğunun **kök nedeni bu hafta değil** — kayıplar 2026-04-23'te
başlıyor. Bu sıçrama nedeni değil, ağırlaştırıcısı.

Aranan şeyin kimlik zinciri **olmadığını** vurgulamak gerekiyor: kimlik tarafı
kapandı, geriye "aynı sessizlik sınıfından, hâlâ fark edilmemiş başka bir
regresyon" ihtimali kaldı. Madde bu yüzden açık.

---

## 🔴 `getAppUserId()` çağrı noktalarında hâlâ INSERT yapabiliyor

**Öncelik: yüksek. Kalem: C.0c-5.** 10 Ağu 2026.

"Satır oluşturma tek noktadan yönetilir" kararı yalnızca
`app/(tabs)/index.tsx`'te uygulandı. `getAppUserId()` (`auth-utils.ts:14`,
içinde `INSERT`) hâlâ çağrılıyor — ve sayı **azalmadı, arttı**:

| Ölçüm | 10 Ağu 2026 | **16 Ağu 2026** |
|---|---|---|
| Çağıran dosya | 22 (7 ekran + 15 servis) | **27** |
| Toplam geçiş | ölçülmedi | **85** |

(16 Ağu ölçümü: `auth-utils.ts` tanımı hariç, `app/ components/ services/
contexts/ hooks/` altında.) 10 Ağu'daki dosya listesi aşağıda tarihsel kayıt
olarak bırakıldı — bugünkü 27'nin tam listesi değildir:

`app/gate.tsx` · `app/roulette.tsx` · `app/lifetime.tsx` ·
`app/onboarding.tsx` · `app/discover.tsx` · `app/referral.tsx` ·
`app/(tabs)/profile.tsx` · `components/ReferralPromptSheet` ·
`contexts/SubscriptionContext` · `hooks/useFeedManager` ·
`components/paywalls/PaywallBase` + `services/` (watchlist, history,
gamification, pushNotifications, roulette, recommendations, gameService,
tasteSignalService, analytics, offlineQueue, conversion/triggerOrchestrator,
authService)

**Neden borç:** `gate.tsx:62` veya `onboarding.tsx:263` bootstrap'tan ÖNCE
çalışırsa satırı orada açar. O çağrı yolunun Sentry bağlantısı yok, retry'ı
yok, hata yolu `logger.error` ile bitiyor — yani bootstrap'ın sağladığı
görünürlük ve dayanıklılık garantilerinin hiçbiri geçerli değil. Sonuç
"çalışır ama izlenemez": tam olarak 87 kimliği doğuran sınıf.

**Yapılacak (C.0c-5):** çağrı noktaları `readAppUserId()`'ye çevrilecek;
`getAppUserId()` ya kaldırılacak ya da yalnız `deleteAccount` için bırakılıp
`@deprecated` işaretlenecek.

⚠️ **Okuma/oluşturma ayrımı bu maddenin çözümü olarak tasarlandı ama HENÜZ
UYGULANMADI.** `readAppUserId()` (okuma) ve `ensureAppUser()` (oluşturma) C.0c'de
yazıldı ve C.7'nin deseni olarak kabul edildi; bootstrap `ensureAppUser`'a
geçirildi. Ancak **27 dosyadaki 85 geçişin dönüştürülmesi yapılmadı** — desen
var, göç yok. C.7'nin kapanması bu maddeyi kapatmıyor.

---

## 🔴 75 `.update()` çağrısının en az 63'ü 0-satır durumunu tespit edemiyor

**Öncelik: yüksek. C.4'ten ÖNCE çözülmeli.** 10 Ağu 2026, C.0c kalem 4 taraması.

PostgREST'te 0 satır etkileyen `UPDATE` **hata değildir**: `error` null döner,
çağıran başarılı sanır. Repo genelinde 75 `.update()` çağrısı var; yalnızca
**12'sinin** zincirinde dönen satırı görebilecek bir ifade var
(`.select()` / `.single()` / `.maybeSingle()` / `count:`). Kalan **63'ü kör.**

63 bir **alt sınırdır** — 12'sinin dönen satırı gerçekten kontrol edip
etmediği tek tek doğrulanmadı.

Kritik olanlar (hepsi `users` tablosuna yazıyor, hepsi kör):

| Dosya:satır | Ne yazıyor | Satırsız kullanıcıda |
|---|---|---|
| `services/authService.ts:115` | `display_name` | sessizce hiçbir şey |
| `services/authService.ts:143` | `auth_provider` | sessizce hiçbir şey |
| `services/authService.ts:378` | `username`, `avatar_url` | **`{success:true}` döner** — ürün kullanıcıya doğrudan yanlış söylüyor |
| `services/userProfile.ts:169/255/310/349` | `preferences_vector` | kişiselleştirme verisi kayboluyor |
| `services/offlineQueue.ts:182/197` | `archetype_id`, `preferences_vector` | kuyruk "işlendi" sayıyor |

**Neden C.4'ten önce:** `watchlist.watched_at` yazımı da aynı desene düşerse
watched-it rate ölçülemez — C.4'ün tek çıktısı o metrik.

**Yapılacak:** desen düzeltmesi — kritik `UPDATE`'ler `.select()` ile dönen
satırı okuyacak ve 0 satır hata olarak raporlanacak. Tüm 63'ü değil, önce
`users` ve `watchlist` yazanlar.

---

## 🟢 `test:founder` ölçütü — `expectedConcepts` hiç puanlanmıyor

**Öncelik: düşük, C.0'ı bloklamıyor.** 8 Ağu 2026, runner onarımı sırasında bulundu.

`tests/founder-acceptance/runner.ts:103` → `titleMatches()` yalnızca **başlık
dizisi** karşılaştırıyor. `cases.ts`'teki `expectedConcepts` alanı (örn.
`['arthouse', 'classic', 'non-mainstream']`) hiçbir yerde okunmuyor.

Sonuç: sistem doğru cevap verdiğinde bile test yanlış soruyor. `no_marvel`
case'i (8 Ağu koşumu) — negatif kısıt tam çalışıyor (`unacceptable: 0`), ama
dönen Fellini / Lynch / Kiarostami üçlüsü `acceptableExamples`'daki Bergman /
Tarkovski listesinde geçmediği için `acc:0` yazıyor ve case PARTIAL kalıyor.

**Karar (CTO, 8 Ağu 2026): `expectedConcepts` gerçekten puanlansın.**
`acceptableExamples` listesini genişletmek REDDEDİLDİ — kanon arthouse listesi
sonsuz genişletilebilir, her "doğru ama listede olmayan film" tekrar eden bakım
yükü üretir. Kavram bazlı puanlama (dönen filmlerin tür/dönem/köken meta
verisinin `expectedConcepts` ile eşleşmesi) daha az kırılgan.

**Bekleyen ikinci soru:** aynı koşumda `Joy Ride (2001)` (gerilim) ve
`Cobain: Montage of Heck` (müzik belgeseli) top-10'a sızdı — algoritmada gürültü
sinyali olabilir. Ölçüt düzeltilmeden ayırt edilemez; düzelince tekrar bakılacak.

---

## 🟠 İstemci tarafı — 401'ler sessizce yutuluyor

**Öncelik: orta. Kalem: C.0c.** 8 Ağu 2026, C.0a kapanış incelemesinde bulundu.

C.0a Edge Function'lara gerçek auth ekledi. İstemcideki iki çağrı yolu bu
401'i **kullanıcıya hiç yansıtmıyor** — kural 1 ihlali. Kusur C.0a'dan önce de
vardı; C.0a onu erişilebilir hâle getirdi (oturumsuz durum önceden çalışıyordu).

| Dosya | Davranış |
|---|---|
| `services/recommendations.ts:751-770` | `session?.access_token ?? SUPABASE_ANON_KEY` fallback'i artık kesin 401. 401 yalnızca `__DEV__` console'a yazılıp `return null`. Production'da rerank sessizce devre dışı, kullanıcı boş/zayıf sonuç görür ve nedenini bilmez |
| `services/matchExplanation.ts:132-140` | `if (!error && data?.explanations)` — hata hiç incelenmiyor, 401 sessizce şablon metnine düşüyor |

`services/tasteParser.ts:107` aynı deseni taşıyor ama en azından
`MoodParseError` fırlatıyor — hedef davranış o.

**Düzeltme yönü:** anon key fallback'lerini kaldır (oturum yoksa istek atma),
401'i Sentry'ye yaz ve kullanıcıya "oturum yenilenmeli" hatası göster.

---

## 🟠 `.env`'de iki `sb_secret_` — isimlendirme yanıltıcı

**Öncelik: orta.** 9 Ağu 2026, `service_role` rotasyonu sonrası C.0a yeniden
doğrulanırken bulundu.

`.env` içinde iki ayrı `sb_secret_` değeri var; ikisi de 41 karakter, ikisi de
doğru kuşak, **değerleri farklı**. Canlı ölçüm
(`generate-puzzles?force=1`, 9 Ağu 2026):

| `.env` adı | Edge kapısı |
|---|---|
| `SUPABASE_SECRET_KEY` | **400 `FORCE_WITHOUT_DATE`** — açıyor |
| `SUPABASE_SERVICE_ROLE_KEY` | **401 `SERVICE_ROLE_REQUIRED`** — açmıyor |

Yani kapıyı açan değer, adı onu çağrıştırmayan değişkende duruyor. `VT_l` ile
biten değerin kaynağı bilinmiyor — rotasyondan artakalmış olabilir.

**Etkisi bugün:** `requireServiceRole()` eşitlik karşılaştırması yapar, biçim
kontrolü değil. Migration 077'nin Vault guard'ı (`LIKE 'sb\_secret\_%'`)
**kuşağı eler, değeri elemez** — iki değerin ikisi de guard'ı geçer. Yanlış
olanı Vault'a yazılırsa `db push` başarılı olur ve altı cron sessizce 401 alır.
Bu yüzden 077 push'undan sonra canlı çağrı doğrulaması zorunlu kılındı
(ayrıntı: `supabase/functions/generate-puzzles/README.md`).

**Kapanış koşulu:** kaynak netleşince tek isme indirilecek. İsim değişikliği
`scripts/` (14 dosya `process.env.SUPABASE_SERVICE_ROLE_KEY` okuyor) + Edge
Function secrets + Vault + EAS/CI'yı **birlikte** etkiler; atomik yapılmalı,
parça parça değil.

Şimdilik yalnızca `.env` ve `.env.example`'a uyarı yorumu eklendi — değer,
isim ve satır sayısı değiştirilmedi.

---

## 🟠 C.2 kapsamı — `send-daily-pick` + `watchlist-activation` içerik borcu

**Öncelik: orta. Kalem: C.2.** 9 Ağu 2026, C.0b kapanışında ayrıldı.

İki fonksiyonun **deseni onarıldı ve kapısı takıldı** (077 + `54213d1`), ama
cron'ları `active = false` bırakıldı. Sebep teknik değil, içerik: metinler
mood-search dönemine ait ve gauntlet ritüelini hiç anmıyor. `active = true`
yapmadan önce aşağıdaki dördü çözülmeli — aksi halde 135 gerçek kullanıcıya
emekli ürün metni gider.

| Alt kalem | Durum |
|---|---|
| `t()` kullanılmıyor | Metinler fonksiyon içinde hardcoded. Proje kuralı 7 ihlali — tüm string'ler `t()` üzerinden olmalı, `en.json` + `tr.json` tam parite |
| Dil timezone'dan tahmin ediliyor | `users.language` kolonu okunmuyor. Kullanıcının açık dil tercihi varken tahmine düşmek yanlış |
| TR metinlerde diakritik yok | "gunun filmi" gibi. Bildirim ürünün sesidir, bu ses kırık |
| `mood_recall` dalı emekli ürüne ait | `mood_searches.mood_text` serbest metnini kullanıcıya geri gösteriyor. Chosy'de serbest metin girdisi YOK — bu dal silinecek veya gauntlet seçim geçmişine dayalı olarak yeniden yazılacak |

Son satır bir karar gerektiriyor: `mood_recall` **silinsin mi, yeniden mi
yazılsın**. Silinirse `watchlist-activation-mood-recall` job'ı da kalkar (bugün
7 olan job sayısı 6'ya iner). CTO kararı, C.2'de.

---

## 🟠 `posterle-daily-curation` — `active = false`, karar C.6'da

**Öncelik: orta. Kalem: C.6.** 9 Ağu 2026.

Deseni 077'de onarıldı, `curate-posterle`'ye kapı takıldı, ama job kapalı.
Posterle `app_config` ile **dondurulmuş** altı oyundan biri; kodu silinmiyor
ama günlük bulmaca üretmesinin de bugün bir karşılığı yok.

Karar C.6'da: oyun kalıcı olarak emekli edilirse job `unschedule` edilir;
geri açılırsa tek bayrakla `active = true` yeterli — desen hazır.

---

## 🟡 `sync-trending` çalışma süresi `timeout_milliseconds`'i aşabilir

**Öncelik: düşük-orta.** 9 Ağu 2026, C.0b 5.2 doğrulamasında fark edildi.

077 tüm cron'lara `timeout_milliseconds := 30000` veriyor. `sync-trending`
TMDB'ye üç liste çağrısı + film başına detay çağrısı yapıyor
(`TMDB_DELAY_MS = 260`, `PARALLEL_DETAIL_BATCH = 5`) — 40 filmlik bir turda
tek başına 30 saniyeye yaklaşabilir.

**Risk sessiz:** pg_net timeout'a düşerse `net._http_response`'ta yanıt
yakalanamaz. Fonksiyon Edge tarafında çalışmaya devam edip işini bitirebilir,
ama biz bunu göremeyiz. Yani "başarısız göründü, aslında çalıştı" veya tersi
ayırt edilemez — 077'nin kapattığı görünmezlik sınıfının daha hafif bir biçimi.

5.2 ölçümünde 200 alındı, yani o koşum 30 sn'nin altında bitti. Ama havuz
büyüdükçe süre artar.

**Yapılacak:** gerçek süre ölçülsün (fonksiyon başında/sonunda `Date.now()`
farkı zaten `startTime` ile tutuluyor, loglanıyor mu bakılacak). 30 sn'ye
yaklaşıyorsa ya `timeout_milliseconds` yükseltilecek ya da iş parçalanacak.

---

## 🟡 `db diff` koşulamıyor — Docker yok

**Öncelik: düşük şimdi, C.1 ÖNCESİ ZORUNLU.** 9 Ağu 2026.

`supabase db diff` gölge veritabanı için Docker Desktop istiyor; makinede
çalışmıyor. 077 push'unda diff **koşulamadı**; 077 yalnızca `cron` şemasına ve
uzantılara dokunduğu ve `db diff` zaten `cron` şemasını raporlamadığı için CTO
tarafından kabul edildi.

**Bu muafiyet C.1'e taşınamaz.** Tasarım token katmanı gerçek DDL içerecek ve
orada şema kayması kontrolsüz kalamaz. C.1'e girmeden önce Docker çalışır
durumda olmalı.

---

## 🟢 `rateLimit` muafiyeti — bugün hedefi yok, ileride düşünülecek

**Öncelik: düşük.** 9 Ağu 2026, C.0b ADIM 3'te ölçüldü.

CTO talimatı "service-role çağrıları rateLimit'e takılmamalı — açık koşulla
muaf tut, sessizce değil" idi. Beş fonksiyonun **hiçbiri** `rateLimit`
kullanmıyor (`rateLimit` yalnızca `explain-match`, `recommend`, `parse-mood`,
`rerank-films`'te). Uygulanacak hedef olmadığı için muafiyet kodu yazılmadı —
yazılsaydı olmayan bir çağrı yolu için ölü kod olurdu.

**Kural olarak kayda geçsin:** bu beş fonksiyondan birine ileride `rateLimit`
eklenirse, service-role muafiyeti **aynı commit'te** düşünülecek. Ayrı bir
commit'e bırakmak, cron'un kendi rate limit'ine takıldığı sessiz bir pencere
açar.

---

## 🟢 `net._http_response` TTL ~24 saat (6 değil) — ölçüldü

**Öncelik: bilgi.** 9 Ağu 2026.

Doğrulama penceresini 6 saat sanıyorduk. Ölçüm: `id = 8` kaydı 13 saat sonra
hâlâ duruyordu. Gerçek TTL ~24 saat.

Pencere sandığımızdan geniş, ama **"hemen oku" kuralı korunuyor**: tetikleme
ile okuma arasına başka iş girerse hangi satırın hangi tetiklemeye ait olduğu
karışır, `id` sıralaması tek başına ayırt etmeye yetmez.

---

## 🟡 `dbRowToRawFilm` iki ayrı kopya — CLI ve Edge Function

**Öncelik: orta.** 13 Ağu 2026, GATE 3 ile birlikte doğdu.

DB satırı → `RawFilmJSON` dönüşümü hem `scripts/ai-profile-films.ts` hem
`supabase/functions/profile-missing-films/index.ts` içinde **ayrı yazılı**.
Ayrışırsa aynı film için iki farklı prompt girdisi doğar — yani aynı film
CLI'den ve cron'dan profillenince farklı vektör alabilir.

Prompt, doğrulama, `CLAUDE_MODEL` ve `PROFILING_METHOD` GATE 3'te
`services/filmProfilePrompt.ts` ortak modülüne çıkarıldı; bu dönüşüm
fonksiyonu ekstraksiyon kapsamı dışında kaldığı için geride kaldı.

**Yapılacak:** `dbRowToRawFilm` de `filmProfilePrompt.ts`'e taşınmalı. Tek
engel, iki tarafın satır şekillerinin birebir aynı olmaması: CLI supabase-js
üzerinden okuyor (`release_date` string), Edge Function ham SQL üzerinden
(`release_date` Date nesnesi olabiliyor). Ortak imza bu farkı normalize
etmeli.

---

## 🔴 `recommend/index.ts:338-346` — aynı SCRAM/ASCII bug'ı

**Öncelik: yüksek (ama kapsamı belirsiz).** 13 Ağu 2026'da
`profile-missing-films` yazılırken keşfedildi.

Aynı desen: ham `SUPABASE_DB_URL` doğrudan `new Client(dbUrl)`'a veriliyor,
decode yok. `deno-postgres@0.17` SCRAM uygulaması kullanıcı adı/parolada
ASCII dışı karakter kabul etmiyor ve bağlantı
`"scram username/password is currently limited to safe ascii characters"`
ile düşüyor. `profile-missing-films` canlı testinde birebir bu hata alındı;
`SUPABASE_DB_URL` kullanan yalnızca bu iki fonksiyon var.

Yani `recommend` canlıda büyük olasılıkla **her çağrıda 500 veriyor** ve bu
fark edilmemiş — fonksiyon mood-search döneminden kalma, güncel çağrı durumu
bilinmiyor.

**Bu turda BİLEREK dokunulmadı** (tur kapsamı GATE 3). Ayrı turda:
- (a) `recommend` hâlâ çağrılıyor mu, hangi ekrandan — doğrula
- (b) kullanılıyorsa B/D/E'den biriyle düzelt — **A (elle decode) 13 Ağu'da
  `profile-missing-films`'te denendi ve BAŞARISIZ oldu**: parola gerçekten
  ASCII dışı karakter taşıyor, SASLprep eksikliği sürücü sınırı. Çalışan
  çözüm: PostgREST/supabase-js'e geçmek (`profile-missing-films` bunu yaptı)
- (c) kullanılmıyorsa C.6 kapsamında dondurma listesine ekle

---

## 🔵 `cron_job_status()` — `command` kolonu bilerek dışarıda

**Öncelik: düşük.** 13 Ağu 2026.

`cron_job_status()` (079'da migration takibine alındı) `jobid, jobname,
schedule, active` döndürüyor; `command` kolonunu **bilerek** dışarıda
bırakıyor. 079'daki gerekçe: sır sızıntısı riski.

13 Ağu'da `weekly-trending-sync` açma kontrolü sırasında doğrulandı ki
`command` içinde açık sır **yok** — Vault'a yalnızca isimle başvuruluyor
(`SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name =
'cron_service_role_key'`) ve değer çalışma anında okunuyor. Bu, 077'nin
bilinçli tasarımıydı. Yani **sızıntı gerekçesi zayıfladı.**

Yine de eklenmedi, iki sebeple:
1. Bu fonksiyon bir teşhis aracı, ürün yüzeyi değil — kapsamı dar tutmak
   kendi başına bir değer.
2. Dashboard SQL Editor'dan manuel erişim hâlâ mümkün; ihtiyaç istisnai.

**Yeniden değerlendirme koşulu:** tüm erişim yolları tükenirse (PostgREST
`cron` şemasını göstermiyor · Docker yok · doğrudan Postgres yok ·
deno-postgres SCRAM/ASCII engeline takılıyor) ve `command` okumaya düzenli
ihtiyaç doğarsa.

---

## 🔵 Kök `CLAUDE.md` ile `docs/os/` arasında senkron borcu

**Öncelik: düşük.** 13 Ağu 2026.

CLAUDE.md (kök) iki hata taşıyor: `dimensions_json` `films`'te değil
(`film_profiles`'ta), migration numarası 076 yazıyor (gerçek 081). `docs/os/`
turu 13 Ağustos'ta bunları düzeltti, kök CLAUDE.md kapsam dışı bırakıldı —
ayrı turda senkronlanmalı.

---

## ⏳ DUR ve DOĞRULA — 17 Ağustos 2026, ilk otomatik cron koşumu

**Öncelik: yüksek. Tarih: 17 Ağustos 2026 (Pazartesi).** 13 Ağu 2026'da açıldı.

**C.0d bu doğrulama yapılmadan KAPANMAZ.** `weekly-trending-sync` 081 ile
`active=true` yapıldı ama **hiç otomatik koşmadı** — bugüne kadarki tüm
doğrulamalar elle tetiklendi. 17 Ağustos, zincirin kendi kendine çalıştığı
ilk andır.

| saat (UTC) | job | ne yapar |
|---|---|---|
| **06:00** | `weekly-trending-sync` (jobid 6) | `sync-trending` fonksiyonunu çağırır, yeni trending filmleri ekler |
| **08:00** | `profile-missing-films` (jobid 18) | Vektörsüz kalan yeni filmleri profiller |

### Kontrol listesi — üçü de işaretlenmeden C.0d kapanmaz

- [ ] **1. `films.curation_tier` dağılımı beklenmedik şekilde kaymadı mı?**
      13 Ağu referansı: `core 862 · extended 949 · trending 56 · archive 1.537`
      (toplam 3.404). Ölçüm yöntemi: PostgREST `Prefer: count=exact`, tier
      başına ayrı istek — düz satır çekip saymak `max-rows=1000` yüzünden
      yanlış sonuç verir.
- [ ] **2. `pre_trending_tier` doğru çalıştı mı?** Yeni trending filmler için
      mandal kuruldu mu — 079'un restore ettiği hasarın tekrarı var mı.
- [ ] **3. `profile-missing-films` 08:00'de çalışıp yeni filmleri yakaladı mı?**
      Beklenen: aktif tier'da `profile_vector IS NULL` sayısı **0**.
      13 Ağu ölçümü 0/1.867 idi.
- [ ] **4. `weekly-trending-sync` sonrası yeni giren filmler `recognition_missing`
      filtresine takılıyor mu — havuz sayısı beklenmedik şekilde artmadı mı?**
      Referans: **1.846** (`any`). Yeni trending filmler `vote_average = 0` ve
      `imdb_votes IS NULL` ile girer, yani C.0e filtresi (commit `970e262`)
      onları elemeli. Düello-uygun sayı 1.846'nın **belirgin üstüne çıktıysa**
      filtre taze girenleri yakalamıyor demektir → DUR.

> **17 Ağustos artık İKİ şeyi birden test ediyor** (13 Ağu 2026, C.0e sonrası):
> (a) cron zincirinin kendi kendine çalıştığını, (b) C.0e sert filtresinin
> taze girenleri doğru elediğini. `weekly-trending-sync` tam olarak filtrenin
> hedeflediği türden film ekliyor — yeni trending, oyu henüz oluşmamış. Bu iki
> testi ayırmayın: havuz sayısı beklenmedik çıkarsa hangisinin bozulduğu
> (cron mu, filtre mi) ayrıca teşhis edilmeli.

### Neden bu kayıt var

13 Ağustos'ta bu iş yalnızca `4_CHOSY_CLAUDE_CODE_OS.md` metninde bir **uyarı
cümlesi** olarak duruyordu — kimsenin takip edeceği bir checklist item değildi.
Takip edilebilir bir kalem olmadan üç gün sonra unutulur ve "muhtemelen
çalışmıştır" varsayımıyla sessizce kapanır. Bu tam olarak önlemeye çalıştığımız
şeydir: doğrulanmamış bir olayın doğrulanmış gibi kaydedilmesi.

**Koşum sonrası:** üç madde de yeşilse C.0d kapanabilir (RevenueCat kalemi
hariç — o ayrı, bkz. aşağıdaki kayıt). Herhangi biri kırmızıysa **C.0e
başlamaz.**

---

## 🔵 `weekly-trending-sync` / `sync-trending` isim uyumsuzluğu

**Öncelik: düşük — kozmetik, C.0e'yi bloklamaz.** 13 Ağu 2026.

Cron job'un adı `weekly-trending-sync` (jobid 6, migration 049'da yaratıldı),
çağırdığı Edge Function'ın slug'ı `sync-trending`
(`supabase/functions/sync-trending/`). **İkisi aynı işin iki adı**, farklı
şeyler değil — job'un `command`'ı `…/functions/v1/sync-trending` URL'ini
çağırıyor.

Kafa karışıklığı gerçek: 13 Ağustos'ta CTO incelemesinde "bunlar iki farklı
şey mi, migration numarası hangisi" sorusu doğdu. Cevap: tek iş, ve job 049'da
yaratıldı — 081 yalnızca `active=true` yaptı.

**Yapılacak:** ya job yeniden adlandırılır (`cron.unschedule` + `cron.schedule`,
jobid değişir — 081'deki jobid=6 sabiti kırılır, dikkat), ya da fonksiyon slug'ı
değişir (deploy gerektirir, cron `command`'ı da güncellenmeli). İkisi de
migration ister. Aceleye gerek yok; **çözülene kadar bu kayıt referans olsun.**

---

## 🟠 RevenueCat webhook fail-open — "Kapandı"dan geri alındı

**Öncelik: yüksek.** 13 Ağu 2026'da yeniden açıldı.

`4_CHOSY_CLAUDE_CODE_OS.md` §10'da bu kalem **"Kapandı ✅"** listesinde
duruyordu. 13 Ağustos C.0d belge turunda seçenek **(a)** kararıyla oradan
çıkarıldı ve 🟠 Yüksek'e taşındı.

**Sorun:** webhook secret yokken auth atlanıyor (fail-open). İsim uyuşmazlığı
bu yolu bir süre canlıda aktif hale getirmişti.

**Neden hâlâ açık — üç sebep:**
1. **Kod düzeltmesi yazıldı ama CTO onayı bekliyor.** Onaysız deploy edilmedi,
   dolayısıyla canlıda fail-open yolu kapanmış **değil**.
2. §3.2 sürüm kararı gereği düzeltme App Store sürümüne kadar deploy
   edilmiyor.
3. **Hiçbir turda kod yolu yeniden ölçülmedi** — 13 Ağustos C.0d turunun
   kapsamı `docs/os/` ile sınırlıydı, kod okunmadı.

**Bağlı kayıt:** `MEMORY.md` → `project_revenuecat_webhook_fail_open.md`
("secret yokken auth atlanıyor, isim uyuşmazlığı bunu canlı yapmıştı; kod
düzeltmesi onay bekliyor"). İki kayıt bilerek birbirine bağlandı — belge ve
hafıza aynı şeyi söylemeli, biri "kapandı" diğeri "onay bekliyor" dememeli.

**Kapanış koşulu:** kod yolu okunup fail-open dalının gerçekten kapandığı
doğrulanmalı **ve** düzeltme deploy edilmeli. İkisi olmadan bu kalem
"Kapandı"ya geri dönmez.

---

## 🟠 Vizyon penceresi / yayın erişilebilirliği verisi yok

**Öncelik: yüksek.** 13 Ağu 2026, C.0e ölçümünde doğdu.

`release_date` geçmiş ama evde izlenemeyen **~11 film** havuzda. C.0e'nin 1A
filtresi yalnızca *gelecek tarihli* filmleri eliyor; sinemada olan ama dijital
platforma düşmemiş filmler tarih testini geçiyor.

**Neden yüksek öncelik:** C.4 watched-it rate paydasını kirletir. Kullanıcı
filmi seçiyor, şampiyon ekranına gidiyor, ama film fiziksel olarak
izlenemiyor → "izlemedim" olarak sayılıyor. **Kill criteria (500 kullanıcıda
watched-it rate <%20) yanlış tetiklenebilir** — mekanik suçlanır, oysa sorun
havuzda.

**Çözüm** TMDb `watch/providers` veya JustWatch entegrasyonu gerektirir —
yeni dış bağımlılık, yeni maliyet. **Faz D affiliate işiyle birlikte
değerlendirilir**, tek başına açılmaz.

---

## ✅ 0-sentinel taraması yapıldı

**Tarih:** 14 Ağustos 2026 · **Sonuç:** 2 bulgu (1 enforce edilen karar doğrulandı, 1 veri hatası tespit).

**Tarama yöntemi:** Node.js + @supabase/supabase-js, anon key ile. Films: 7
nullable numeric kolon (3.404 satır). Film_profiles: 0 numeric kolon. Users:
1 nullable kolon (`archetype_id`) — **RLS tarafından erişim reddedildi,
tarama tamamlanamadı.**

**Sonuçlar:**
- `imdb_votes`: 22/3.404 (0,65%) sıfır, 1.017 NULL → **Sentinel (enforce edilmiş)**
- `vote_average`: 45/3.404 (1,32%) sıfır, 0 NULL → Partial (PRODUCT_OS §6.2 "0=NULL sayıl")
- `metascore`, `imdb_rating`, `year`: Temiz (NULL destekler veya veri dolu)
- `runtime`: 12/3.404 (0,35%) sıfır → **Veri hatası** (ayrı kalem)
- `tmdb_vote_count`: 3.404/3.404 NULL (uygulanmamış kolon)
- `users.archetype_id`: **Erişim reddedildi** — service-role ile tekrarlanmalı

**Sonuç:** Sentinel kuralı 3B→3A terfiye hazır. İmdb_votes zaten enforce ediliyor (`gauntletCore.ts:169-172`). Runtime sorunu ayrı veri kalitesi belgesi.

---

## 🔵 C.0f son maddesi — §6.2 dipnotu ölçülmüş sayılarla güncellenecek

**Öncelik: düşük ama unutulmamalı.** 13 Ağu 2026, C.0e GÖREV 2 sonrası.

`1_CHOSY_PRODUCT_OS.md` §6.2 dipnotu hâlâ **beklenti** dilinde:
*"C.0f sonrası yeniden ölçülecek: 1.846"*. Sayı 13 Ağustos'ta **fiilen
üretildi** (gerçek `buildScoredPool`, commit `970e262` doğrulaması) — dipnot
ölçülmüş dile çevrilmeli:

> 13 Ağustos 2026'da ölçüldü: **1.846** (`any`), **1.655** (`medium`),
> **778** (`short`).

**Üç sayı birden yazılacak.** `duration` kırılımı ileride havuz tükenmesi
tartışmasında (RİSK #7) referans olacak: `short` bağlamında havuz zaten
778'e iniyor, yani gevşetme merdiveni en çok orada baskı altında.

Kod commit'ine doküman karıştırılmadığı için bu turda yapılmadı (iki commit
disiplini). C.0f'nin **son maddesi**.

---

## 🔵 `trending_type` güvenilir ayraç değil

**Öncelik: düşük.** 13 Ağu 2026, C.0e ölçümü.

`films.trending_type` (`'weekly_trending' | 'upcoming'`) filtrelemede
kullanılabilir görünüyor ama **tutmuyor:**

| kesişim | sayı |
|---|---|
| gelecek tarihli 9 filmin `upcoming` OLMAYANI | **3** |
| tanınırlıksız 20 filmin `upcoming` OLMAYANI | **11** |
| `trending_type IS NULL` (havuzun geri kalanı) | 1.811 |

**Filtrelemede kullanılmaz.** `release_date` ve `vote_average` doğrudan
ölçülmeli. Bu kayıt, ileride birinin aynı kestirmeyi denemesini önlemek
içindir.

---

## 🟡 `global-slot-daily` — `relaxedTiers: null`, gevşetme yok

**Öncelik: orta, izlenecek.** 14 Ağu 2026.

`generate-global-slot` cron'u (migration 075, her gün 00:05 UTC) havuzda
tierler daralmış (`core` + `trending` yalnızca, `extended` hariç — §6.9). Dışarıdan
**hiç gevşetme merdivenesi yok:** `relaxedTiers: null` parametresi ile,
havuz 4 film altına düşerse fonksiyon `throw` eder — ürün **hiç slot üretmez** bu gün.

`buildScoredPool(..., { tiers: GLOBAL_TIERS, relaxedTiers: null, ...})`
— `_shared/gauntletCore.ts:861-880`, **tier basamağı tamamen kapalı.**

**Mevcut durumu (13 Ağu 2026):** havuz `pool_size = 869` (log okundu).
Taban 4'e karşı geniş aman, güvenli. Ama C.0e sert filtresi (release_date,
recognition_missing) ileride sıkılaştırılacak — F fazı "vizyon penceresi"
kısıtı (Faz Planı §2.4) ekleneceği zaman bu satırı yeniden değerlendir.
Kişisel slotlar `extended`'i kaybederse gevşetme merdiveni archive'a kadar
iniyor (`relaxedTiers: RELAXED_TIERS = ['archive']`), fakat global gevşetmezse
günü kaçırır.

---

## 🟡 `films.runtime = 0` (12 satır) — veri hatası, sert filtrede geçiyor

**Durum:** Veri kalitesi sorunu, sentinel değil ama sert filtreden kaçıyor.

12 filmde `runtime = 0`. Hiçbir filmin süresi 0 dakika olamaz — TMDb/OMDb
kaynaklarında eksik bilgi. Ama sert filtrede `runtime <= maxRuntime` kontrol,
`0 <= 110` her zaman true → bu 12 film **`short` bağlamında (≤110dk) düello
havuzuna giriyor** ve istemcide "0dk" gösterilebilir.

**Remediation:** (1) Film başlıklarını listele, IMDb/TMDb'de doğru süreleri
bul, güncellenmiş SUPABASE değerle yaz. (2) Yoksa `curation_tier` gözden geç
— hata yapısı düşük kalite veri işareti. (3) Kısa vadi: `runtime > 0 OR
runtime IS NULL` filtresi ekle.

---

## ✅ `imdb_votes` — sentinel enforce edilen karar doğrulandı (3B→3A terfi hazır)

**Tarama:** 22/3.404 (0,65%) sıfır, 1.017 NULL.

Bu karar 3B'ye yazılmışdır (ileriye dönük, CLAUDE.md kuralı). **Şimdi enforce
edilmiş:** `gauntletCore.ts:169-172`'de koddadır — `imdb_votes = 0` filmler
sert filtreyde eleniyor. Terfi koşulu karşılanmıştır: "Tarama yeni sentinel
buldu" değil, "enforce edilen karar doğrulandı" — farklı sonuç. Kural 3A'ya
hazır. Beş kolon (_runtime hariç_) sentinel değildir.

---

## ℹ️ `users.archetype_id` — Erişim Reddedildi, Tarama Tamamlanmadı

Tarama anon key ile koştu. Users tablosuna RLS erişim reddetti — veri hatası
değil, güvenlik tasarımı. Ama `archetype_id` kolonunun sentinel içeriği
bilinmiyor.

**Tekrar gerekli:** Service-role JWT ile users.archetype_id kontrol edilmeli.
Bu turda ertelendi.

---

## 🔵 `submit-choice` — `seen` yazımı read-then-write, teorik yarış penceresi

**Kayıt: 14 Ağu 2026, C.2-0 sırasında kod okunurken görüldü.**

`markWatched()` (`supabase/functions/submit-choice/index.ts:375-424`) önce
`watchlist` satırını okuyor, `watched_at` doluysa dokunmuyor, boşsa `id` ile
UPDATE ediyor. Okuma ile yazma arasında ikinci bir istek aynı satırı
doldurursa gerçek izleme tarihi bugünle ezilebilir — UPDATE'te
`.is('watched_at', null)` guard'ı yok.

**Neden şimdi değil:** C.2-0'ın kısıtı "submit-choice DEĞİŞTİRİLMEYECEK".
Pencere pratikte dar (aynı kullanıcının çift `seen` isteği aynı milisaniyelerde
gelmeli) ve idempotency katmanı çoğu tekrarı zaten eler. submit-choice ayrı
bir işte ele alınmalı; düzeltme tek satır: UPDATE'e `.is('watched_at', null)`
eklemek + 0 satır etkilenirse loglamak.

---

## 🔵 `generate-gauntlet` deriveProgress — canlı smoke YAPILDI (14 Ağu 2026)

JS port ile 11/11 sentetik senaryo doğrulandıktan sonra **deploy edilmiş Deno
kodu üzerinde canlı smoke testi 14 Ağu 2026'da koşuldu: 30/30 PASS.** Kapsam:
dört zorunlu senaryo (yeni→0 · choice→defender=kazanan · neither→tur
sabit/çift değişmiş · 3 tur→champion) + **timeout zinciri** (3× timeout →
`exhausted`/`timeout_no_winner`, defender konvansiyonu `films[0]` iki ara
adımda doğrulandı) + resume çifti === submit-choice `replacement` çifti
tutarlılık kontrolü.

**Kalıntı:** Smoke, canlı DB'de 2 anonim test kimliği bıraktı
(`public.users`: `d4128b7c…`, `9247f8e8…` — service key bootstrap'lı, orphan
DEĞİL) + 2 `daily_gauntlets` + 9 `choice_events` + `duel_impressions`
satırları. C.2-0 kısıtı gereği (choice_events/duel_impressions'a DELETE yok)
temizlenmedi. Orphan-auth sayımı yapan biri bu iki kimliği test olarak
tanımalı. Temizlik gerekirse ayrı onaylı iş.

**Not:** Anon kimlikle ilk çağrı 401 verdi — kök neden o tarihte açık olan
"anonim kimlikler için `public.users` satırı hiç oluşmuyor" borcuydu; smoke,
istemcinin `getAppUserId` INSERT bootstrap'ını taklit ederek geçti.
**O borç KAPANDI (082 backfill + `ensureAppUser` bootstrap, 16 Ağu 2026)** —
bu 401 artık aynı sebeple tekrarlanmaz.

---

## 🟡 `gauntlet_unlock_hour` app_config'e taşınmalı

**Kayıt: 14 Ağu 2026, C.2-2 (CTO kararı).**

18:00 kapısı (`PRODUCT_OS §3.6`) şu an yerel sabit:
`components/gauntlet/GauntletShell/index.tsx` → `UNLOCK_HOUR = 18`.
app_config anahtarı yok; değiştirmek **app release gerektiriyor**. Anahtar
eklemek migration ister (C.2-2'de migration yasaktı). `__DEV__` bypass'ı
sabitin yanında — taşımada birlikte düşünülmeli.

---

## 🟡 `submit-choice` — `choice` outcome'unda `replacement`/`nextPair` dönmüyor

**Kayıt: 14 Ağu 2026, C.2-2 (CTO 🔴1 kararı). Hedef: Faz F.**

`choice` sonrası sıradaki çifti sunucu bildirmiyor; istemci
`nextChallengerForRound(round, films)` (GauntletShell) ile deriveProgress'in
POZİSYONEL mantığını **ayna** olarak taşıyor. `film_ids` in-place
güncellendiği için bugün doğru; backend seçim mantığı değişirse istemci
sessizce yanlış film gösterir. Güvence: şampiyon anında istemci/backend
uyuşmazlık tespiti Sentry'ye `GAUNTLET_MIRROR_DIVERGENCE` yazar. Kalıcı
çözüm: submit-choice `choice` dalında da `replacement`/`nextPair` dönmeli.

---

## 🟡 `ChoiceResult` ayna tipi iki yerde

**Kayıt: 14 Ağu 2026, C.2-2.**

`services/gauntletService.ts` (istemci) ile
`supabase/functions/submit-choice/index.ts:111` (sunucu) aynı yanıt tipini
ayrı ayrı tanımlıyor — derleyici iki kopyayı KONTROL ETMEZ (kilitli sözleşme
`types/gauntlet.ts` yanıt şeklini kapsamıyor, B.4 kararı). İki dosyada da
karşılıklı referans yorumu var; biri değişirse ikisi birden değişmeli.

---

## 🟡 `recompute-cinema-dna` — `outcome='seen'` satırları tercih sinyali sayılmamalı

**Kayıt: 14 Ağu 2026, C.2-2 (CTO 🟡5 kararı).**

`submit-choice`, `seen` outcome'unda `winner` alanına **izlenen filmi** yazar
(ölçüldü: `validateBusinessRules` + `markWatched` yolu). Yani `choice_events`'te
izlenmiş bir film "kazanan" olarak durur. B.5/`recompute-cinema-dna` bu
satırları `outcome` ile filtrelemezse "izledim" bir **tercih** sinyali gibi
okunur — oysa izlemiş olmak beğenmiş olmak değil. Vektör hesabına girmeden
önce `outcome = 'choice'` filtresi doğrulanmalı.

---

## 🟢 Işık sızması — düşük-chroma posterlerde her koşulda cılız kalıyor

**Kayıt: 15 Ağu 2026, C.2c.**

`compute-dominant-colors.ts` `lightnessMode` varsayılanı bugün `clamp`
(15 Ağu'da `scale`'den değiştirildi — `scale` ham L'yi 0.22 ile çarpıyordu ve
sızmayı görünmez kılıyordu). Ama `clamp` yalnızca **tavan** koyar, **taban**
koymaz: ham L zaten tavanın altındaysa renk olduğu gibi kalır.

Ölçüldü (α 0.30, `ink` #08090B zemin, Δ = kompozitin zeminden en büyük kanal
sapması):

| Film | ham L | depolanan `l` | Δ |
|---|---|---|---:|
| Çoğu film | ~0.43-0.84 | 0.2200 (tavan) | **12-14** |
| `Double Indemnity` | 0.0512 | 0.0512 | **3** |
| `Ikiru` | 0.0712 | 0.0712 | **3** |

Δ3 görünmez (referans: `ink → charcoal` yükseklik adımı Δ15). Yani gerçekten
karanlık/akromatik posterli filmlerde imza öğe çalışmaz.

**⚠️ 15 Ağu 2026 düzeltmesi — sorun lightness tabanı DEĞİL, chroma tabanı.**
Bu madde önce "clamp yalnızca tavan koyar, taban yok" diye yazılmıştı. Lightness
eşleme adayları (A/B/C, `l = taban + k × hamL`) ölçüldüğünde görüldü ki **taban
eklemek de yetmiyor**:

| Film | ham L | ham c | A → Δ | B → Δ | C → Δ | clamp → Δ |
|---|---:|---:|---:|---:|---:|---:|
| Double Indemnity | 0,051 | **0,026** | 3 | 2 | 2 | 3 |
| Ikiru | 0,071 | **0,030** | 3 | 2 | 2 | 3 |

Lightness tabanı `l`'yi yükseltiyor ama Δ düzelmiyor: bu filmlerin asıl sorunu
**chroma** — ham `c` değerleri 0,026 ve 0,030, yani tavanın (0,08) üçte biri.
Renksiz bir rengi parlatmak ink'e yakın bir gri üretir. Yani **düşük-chroma
filmlerde (c < ~0,03) sızma her koşulda cılız kalır**; çözüm için ayrı bir
**minimum chroma tabanı** gerekir.

**Karar bekliyor — iki seçenek:**
1. **Minimum chroma tabanı** eklensin (ör. `minChroma ≈ 0.03`): akromatik
   posterlerde de renk görünür, ama o renk artık posteri temsil etmez —
   gri bir posterden uydurulmuş bir hue yayılır.
2. **"Renksiz film renksiz ışık yayar"** olarak kabul edilsin: fiziksel olarak
   doğru, tasarım tezine sadık, ama bazı filmlerde imza öğe hiç görünmez.

Bu karar **lightness eşleme kararından (A/B/C) bağımsızdır** — hangisi seçilirse
seçilsin düşük-chroma filmler etkilenmeye devam eder.

**Etkilenen oran ölçüldü** (15 Ağu, tam havuz yeniden hesaplandıktan sonra):
`dominant_color.l < 0.15` olan **62 film / 1867 (%3,3)**. Filmlerin %94,3'ü
tavana (`l = 0.22`) oturuyor. α 0.30'da havuz genelinde Δ dağılımı:
medyan 12 · p25 9 · p75 14 · max 16 — **%84,5'i Δ ≥ 8** (fark edilir),
**%3,6'sı Δ ≤ 4** (görünmez). Yani sorun dar bir azınlıkta.

**Neden şimdi değil:** Bu bir ürün/tasarım kararı, teknik düzeltme değil —
etkilenen oran da (%3,3) acil müdahaleyi gerektirmiyor.


---

## 🟡 `test:founder` 5 case vs `free.daily_search_limit = 3`

**Öncelik: orta. Karar bekliyor (C.7, 16 Ağu 2026).**

Runner her koşumda `signInAnonymously()` ile taze bir anonim kimlik açıyor ve
o kimlik `free` katmanında doğuyor. Canlı `subscription_limits.free`
`daily_search_limit = 3`; runner'ın 5 case'i var. Yani 4. ve 5. case
**yapısal olarak** `parse-mood` üzerinden 429 `QUOTA_EXCEEDED` alıyor —
mood eşleşmesiyle ilgisi yok. İki bağımsız koşumda birebir aynı sonuç:
**3 PASS + 2 FAIL**.

Bu, C.7'de runner'a `ensureAppUser()` eklenmesiyle *görünür* oldu, o
değişiklikle *oluşmadı*: öncesinde runner'ın kimliği orphan olduğu için
`parse-mood` fail-closed dalı (`APP_USER_MISSING`) beş case'e de 403
döndürüyordu, yani test 10 Ağu'dan (C.0c) beri 5/5 FAIL'di. Şimdi 3/5 geçiyor.

**Seçenekler (karar bekliyor):**
1. Case sayısını 3'e indir — kapsam kaybı.
2. Runner'a `grant_bonus_searches` ile bonus arama tanı — test yolu üretim
   yolundan ayrışır.
3. Runner'ın kullanıcısını ücretli bir katmana yaz — aynı ayrışma, artı
   `subscription_limits` bağımlılığı.

---

## 🟢 `recompute-taste-vector` — `skipped_anonymous_rows` sayacı ulaşılamaz

**Öncelik: düşük, zararsız. 16 Ağu 2026, migration 088 sonrası.**

`supabase/functions/recompute-taste-vector/index.ts:362` çevresindeki
`skipped_anonymous_rows` sayacı `choice_events` / `watch_feedback` tablolarında
`user_id IS NULL` satırlarını dışlayıp sayıyordu. 088 `device_id` kolonunu
kaldırıp `*_owner_present` CHECK'lerini `user_id NOT NULL`a dönüştürdüğü için
o dal artık **kanıtlanabilir biçimde ulaşılamaz** — sayaç kalıcı olarak 0.

Zararsız: sıfır dönen bir gözlem sayacı yanlış sonuç üretmiyor. Kaldırılması
ayrı bir kod kararı, 088 kapsamında bilinçli olarak yapılmadı. Aynı dosyadaki
`claim_device_data`'ya atıf yapan yorum da bayat (fonksiyon 088'de düştü).

---

## 🟡 `remoteConfig.ts` — modül seviyesi cache, kural 6 ihlali

**Öncelik: orta. Tespit: C.9a keşfi, 17 Ağustos 2026.**

- remoteConfig.ts: modül seviyesi cache (memoryCache), CACHE_TTL_MS tanımlı ama
  kullanılmıyor → kural 6 ihlali (chosy-conventions §2). app_config flag okuma
  şu an gameApi.ts üzerinden kurala uygun gidiyor, remoteConfig.ts kullanılmıyor
  olsa da temizlenmeli. Tespit: C.9a keşfi, 17 Ağu 2026.

---

## 🟡 `app/(tabs)/_layout.tsx` — discoverEnabled → native `hidden` remount riski

**Öncelik: orta. Tespit: C.9a-2 Faz 2, 17 Ağustos 2026.**

- app/(tabs)/_layout.tsx: discoverEnabled flag'i NativeTabs.Trigger'ın
  `hidden` prop'una bağlı. expo-router dokümantasyonu: tab'lar görünürken
  gizlenmemeli (navigator remount + state kaybı riski). Şu an flag hep
  false (K-02, Discover donduruldu) olduğu için tetiklenmiyor.
  ⚠️ discover_tab_enabled app_config'te true yapılmadan önce bu satır
  düzeltilmeli — doğru çözüm: flag'i (tabs) layout mount olmadan ÖNCE
  (boot/gate aşamasında) çözüp initial render'a sabit değer olarak
  geçirmek. Tespit: C.9a-2 Faz 2, 17 Ağu 2026.

---

## 🟡 OTA update source map upload'ı kurulu değil

**Öncelik: orta. Tespit: M1 Faz 2, 18 Ağustos 2026.**

OTA update source map upload'ı kurulu değil (yalnızca native build source
map'leri otomatik). ota_update_found/fetched event'leri OTA'nın aktif
kullanıldığını gösteriyor — bir OTA-only JS hatası şu an düzgün
symbolicate olmayabilir. Kurulum: .eas/workflows/ + expo-upload-sourcemaps.js
script'i, yeni bir pattern (proje hiç kullanmıyor) → ayrı DUR NOKTASI
gerektirir. Tetikleyici: OTA update'ler kritik/sık hale geldiğinde veya
bir crash'in OTA kaynaklı olduğu şüphesi doğduğunda öncelik kazanır.
Tespit: M1 Faz 2, 18 Ağu 2026.

---

## 🟡 M1 event enstrümantasyonu — eski/eksik UI'ya bağlı, taşınması gerekecek

**Öncelik: orta. Tespit: M1 Faz 2, 18 Ağustos 2026.**

M1 Faz 2'de eklenen bazı event'ler bilinçli olarak eski/eksik UI'ya
bağlandı. C.9b/C.9c bu UI'ları yeniden inşa ettiğinde event de birlikte
taşınmalı — aksi halde ölçüm sessizce eski yüzeyde kalır ve yeni yüzeyde
hiç veri üretmez.

- **watched_something_else**: SONHALİ §16 opsiyonel film arama akışı hiç
  implement edilmemiş, event de yok. C.4/watch feedback yeniden ele
  alınırsa birlikte eklenir.
- **save_for_later, provider_clicked/where_to_watch_opened**: Champion CTA
  gap'i (K-06/§3.9) C.9b'nin işi — CTA'lar inşa edildiğinde event'ler
  aynı commit'te eklenmeli, unutulmasın.
- **auth_prompt_viewed/completed**: şu an mevcut tek auth.tsx ekranına
  bağlandı, K-13'teki "champion sonrası ayrı sheet" henüz yok — sheet
  inşa edilince event bağlantısı oraya taşınmalı.
- **paywall_viewed** → eski 9 varyantlı ContextualPaywall sistemine bağlı,
  K-46 tek-tetikleyicili arşiv paywall'ı henüz yok — R-C'de paywall
  yeniden inşa edilince event yeni yüzeye taşınmalı.
- **dna_viewed** → eski TasteDNA/EmotionalState modeline bağlı, K-30'daki
  6 eksenli yeni DNA henüz yok — DNA yeniden inşa edilince taşınmalı.

---

## ✅ ÇÖZÜLDÜ — RLS bypass / PII sızıntısı taraması (032, 010, 059, kök neden)

**Tespit: v_algorithm_daily (092) migration-guard denetimi, 18 Ağustos 2026. Kapatıldı: 18 Ağustos 2026, migration 093-098.**

`v_algorithm_daily` (092) denetimi sırasında `v_mood_searches_recent`'te (032) bulunan RLS-bypass deseni bir tarama başlattı. Migration geçmişinde hiç `ALTER DEFAULT PRIVILEGES` yoktu — Supabase'in proje-bootstrap kuralı gereği `public` şemasında yaratılan her yeni view/tablo doğuştan `anon`+`authenticated`'a açık geliyordu. Üç view etkilenmiş bulundu, hepsi kapatıldı:

- `v_mood_searches_recent` (032) — `user_id`, `mood_text`, `parsed_profile`, anon key ile bile (kimlik doğrulamasız) erişilebiliyordu, ayrıca auto-updatable (yazma/silme riski). **Migration 093.**
- `user_swipe_history` (010) — `user_id`, `mood_text` (raw_input), zaman penceresi bile yoktu (tüm tarihçe). **Migration 094.**
- `detective_daily_scores` (059) — `user_id`, skor/`progress_json`. **Migration 095.**

Kök neden `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated` ile kapatıldı (**migration 096**) — bundan sonra `postgres` rolüyle yaratılan her yeni tablo/view kapalı doğar. `v_posterle_daily_stats` ve `public_daily_puzzles` bilinçli olarak açık bırakıldı (PII yok) ve DB nesnelerine COMMENT ile "yeniden yaratılırsa GRANT'i unutma" notu düşüldü (**migration 097**).

**Kapatılamayan kalıntı risk:** `pg_default_acl` sorgusu iki ayrı grantor ortaya çıkardı — `postgres` VE `supabase_admin`. `postgres` rolü superuser değil ve `supabase_admin`'e member değil (`pg_has_role` ile doğrulandı) — bu yüzden `supabase_admin` grantor'lu default ACL kaydı REVOKE edilemedi. Bu rolle yaratılacak (migration geçmişinde şu ana kadar hiçbir dosyada örneği yok) herhangi bir gelecekteki tablo/view hâlâ doğuştan `anon`/`authenticated`'a açık gelecek. Kapatmak muhtemelen Supabase support/dashboard yetkisi gerektiriyor — Claude Code'un erişiminin ötesinde. **Öncelik: düşük** (bugüne kadar hiç kullanılmamış bir yol) ama izlenmeli — CTO'nun Supabase dashboard/support üzerinden ayrıca ele alması gerekiyor.
