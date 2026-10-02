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

---

## 🟡 `seed-database.ts:283` — ham `poster_path` yazıyor (949 satır)

**Öncelik: düşük. Tespit: M3 Faz 1, 18 Ağustos 2026.**

`films.poster_url` kolonunda **iki farklı biçim** yaşıyor:

| Biçim | Adet | Yazan |
|---|---:|---|
| `https://image.tmdb.org/t/p/original/…` | 2.459 | `fetch-films.ts:335` · `add-missing-films.ts:154` · `sync-trending/index.ts:42` |
| ham `poster_path` (`/abc.jpg`) | **949** | `seed-database.ts:283` (`poster_url: film.poster_path`) |
| NULL | 5 | — |

Ham path **geçerli bir URI değildir**. Okuyucu taraf bugün korunuyor:
`gauntletCore.ts` → `toW500PosterUrl` iki biçimi de w500'e normalize ediyor ve
M3 Faz 2'de `generate-gauntlet`'in cached yolu da bu fonksiyona bağlandı (bkz.
aşağıdaki kapanmış kalem). Ama koruma **okuma tarafında**; yazma tarafı hâlâ
iki gerçek üretiyor.

**Bugünkü canlı etki: 0.** Aktif tier'da (`core`/`extended`/`trending`) yalnızca
2 ham-path satırı var (*Tom ve Jerry: Kayıp Pusula* [trending], *The Bourne
Ultimatum* [core]) ve ikisi de bugün düello havuzunda değil — ikisi de
`release_date` koşuluna takılıyor. 949'un geri kalanı `archive`.

**Risk:** Normalizasyonu atlayan **yeni** bir okuma yolu yazılırsa (ör. bir
bildirim şablonu, bir paylaşım kartı, bir Pro arşiv ekranı) o yol sessizce
kırık görsel gösterir — tip sistemi yakalamaz, `string` her iki biçimde de
geçerlidir. M3'te düzeltilen bug tam olarak buydu ve kaynağı bu ikilikti.

**Düzeltme yönü:** `seed-database.ts` de tam URL yazsın (`fetch-films.ts`
deseni) **ve** mevcut 949 satır tek seferlik backfill ile normalize edilsin.
İkisi birlikte yapılmalı — yalnız kodu düzeltmek eski satırları bırakır.

**Neden şimdi değil:** Veri migration'ı + script değişikliği, M3 Faz 2'nin
kapsamı dışında (kapsam kilidi: "seed-database.ts'in kendisini yeniden yazmak
ayrı, düşük öncelikli teknik borç"). Okuma tarafı korunduğu için acil değil.

---

## 🟡 `recognition_band` / `MIN_SELECTION_WEIGHT` — tuning C.9b sonrasına ertelendi

**Öncelik: orta (C.9b sonrası). Tespit: M3 Faz 1, 18 Ağustos 2026.**

M3 Faz 1 ölçümü: nominal düello-uygun havuz **1.847** film, ama gerçek **etkin
havuz 840** — seçim ağırlığının %90'ını taşıyan film sayısı.

Daraltan şey çeşitlilik kuralları **değil**: 365 gün × 5 senaryo simülasyonunda
`language`/`genre`/`decade`/`runtime_spread` merdiveninin hiçbir basamağı
tetiklenmedi, hiçbir gün üretim başarısız olmadı. Daraltan, tanınırlık bandı:

```
recognition_band_low = 55 · high = 80  →  mid 67.5 · halfWidth 32.5
puan = 1 − |yüzdelik − 67.5| / 32.5     →  yüzdelik ≤ 35 olan her film puan 0
```

Puanı 0 olan **648 film** (havuzun %35'i) `MIN_SELECTION_WEIGHT = 0.01` ile
toplam ağırlığın yalnızca **%1,1**'ini taşıyor. `gauntletCore.ts:594` yorumu
`(high−low)/2` okumasını "yumuşak puanı ikinci bir sert filtreye dönüştürür"
diye reddediyor; seçilen formül alt %35 için pratikte aynı sonucu üretiyor.

Simüle edilen tekrar oranı (kümülatif, `%10`u geçtiği gün):

| Bağlam | Havuz | g90 | g365 | %10 eşiği |
|---|---:|---:|---:|---:|
| `any` | 1.847 | 8,6% | 44,9% | 97. gün |
| `medium` (≤150dk) | 1.655 | 13,6% | 46,5% | 72. gün |
| `short` (≤110dk) | 778 | 22,8% | 67,9% | **53. gün** |

**Neden şimdi değil — CTO kararı, 18 Ağu 2026:** Bu bir bug değil, **tasarım
gerilimi**. Dar bant muhtemelen kasıtlı: tanınmayan/belirsiz filmleri öne
çıkarmamak, kullanıcı güvenini korumak. Bandı genişletmek tekrar ufkunu uzatır
ama daha az tanınan filmleri daha sık gösterir — retention/kalite ödünleşimi.

Ölçüm **simülasyondan** geliyor, gerçek kullanıcı davranışından değil: bugün
sahada 3 kullanıcı, 17 gauntlet, 18 `choice_events` satırı var — tuning kararı
için yetersiz örneklem. C.9b gauntlet'i production'a açtığında gerçek
`watch_feedback` / `neither` / `seen` oranlarıyla yeniden değerlendirilecek.
97 günlük ufuk, C.9b'nin takvimi düşünüldüğünde acil değil.

**Ayar noktaları DDL gerektirmez:** `recognition_band_low`/`_high` `app_config`
satırlarıdır (lazy okunur); `MIN_SELECTION_WEIGHT` `gauntletCore.ts:56`
sabitidir.

---

## 🟡 `imdb_votes` NULL + `vote_average` boş — 10 film düello-uygunluk dışında

**Öncelik: düşük. Tespit: M3 Faz 1, 18 Ağustos 2026.**

`isDuelEligible` her adayda en az bir tanınırlık sinyali arıyor
(`recognitionMissing`: `imdb_votes` ve `vote_average` ikisi de yok → elenir).
Aktif tier'da bu kapıya takılan **12 film** var; 10'u "her iki sinyal de
eksik", 2'si `imdb_votes = 0` sentinel'i (ikisinin `vote_average`'ı da 0).

Kök neden `OMDB_API_KEY`'in `.env`'de olmaması — bu dosyanın "Faz B veri
katmanı" bölümünde zaten kayıtlı. `imdb_votes`'un tek kaynağı OMDb'dir; TMDb
`vote_count` farklı bir metriktir ve bu kolona yazılmaz (6 Ağu 2026 kararı).

Havuz genelinde: `imdb_votes` NULL olan 39 filmin 29'u `vote_average` ile
kurtarılıyor, 10'u elenir. `films` tablosunun tamamında 1.026 NULL var.

**Neden şimdi değil:** 1.847 filmlik havuzda 10 film = %0,5. Anahtar
eklendiğinde `npx tsx --env-file=.env scripts/backfill-film-metadata.ts`
kalanı doldurur — kod değişikliği gerektirmez.

> ⚠️ İlgili düzeltme: `gauntletCore.ts:64`'teki "ÖLÇÜME GÖRE ULAŞILAMAZ
> (7 Ağu 2026): havuzda `imdb_votes = 0` olan 0 satır" notu **artık güncel
> değil** — 18 Ağu ölçümünde havuzda 2 satır var. `NEUTRAL_RECOGNITION_SCORE`
> katmanı yine de ulaşılamaz durumda, çünkü o 2 film zaten `recognitionMissing`
> ile havuz dışına düşüyor. Yorumun kendisi bir sonraki dokunuşta güncellenmeli.

---

## 🟡 `poster_quality_ok` doldurulmuyor — D-03 gate'i bilinçli olarak bağlanmadı

**Öncelik: orta. Tespit: M3 Faz 2, 18 Ağustos 2026.**

`films.poster_quality_ok` kolonu **var** (migration 084) ama onu dolduran
`scripts/compute-dominant-colors.ts` bir **yerel `npx tsx` script'i** — Edge
Function değil, cron'a bağlı değil, elle çalıştırılıyor. Üç kanıt:

1. `supabase/functions/` altında karşılığı yok; pg_cron `net.http_post` ile
   Edge Function çağırır, yerel script yapısal olarak bağlanamaz.
2. Cron envanterinde yok — 8 job'ın hiçbiri poster kalitesi hesaplamıyor
   (`posterle-daily-curation` · `send-daily-pick-hourly` ·
   `watchlist-activation-weekend` · `watchlist-activation-mood-recall` ·
   `weekly-trending-sync` · `global-slot-daily` · `profile-missing-films` ·
   `cleanup-rate-limits`).
3. Senaryo zaten gerçekleşmiş: `weekly-trending-sync` 17 Ağu'da **9 trending
   film** ekledi, dokuzunun da `poster_quality_ok = NULL` ve
   `dominant_color_computed_at = NULL`. Tablodaki en son hesap tarihi
   **15 Ağu** — elle çalıştırma. Son 30 günde eklenen 62 filmin 9'u NULL.

### Gate neden bağlanmadı (CTO kararı, 18 Ağu 2026)

Fail-open gate (`poster_quality_ok IS NOT false`) bugün **yapısal olarak 0 film**
eler: `= false` olan 5 satırın tamamı `archive` tier'da ve `poster_url`'leri
zaten NULL, yani mevcut `poster_url IS NOT NULL` filtresi onları çoktan eliyor.
Gate'in korumak için var olduğu filmler — yeni ingest edilmiş, posteri ölü
olabilecekler — script manuel olduğu sürece **her zaman NULL** kalır ve
fail-open'da hep geçer.

**Sonuç: sıfır kapsama, tam koruma görüntüsü.** Bu, D-03'ün yasakladığı *sessiz
eleme*nin ikiz kardeşi: **sessiz sahte-güvence**. Kural 1'in ruhu ("hata görünür
olmalı") burada da geçerli — olmayan bir korumayı var gibi göstermek, hatayı
gizlemenin başka bir biçimidir. Kod okuyan biri "poster kalitesi kontrol
ediliyor" sanır. Bu yüzden gate koda dökülmedi.

**D-03'ün gerçek ön koşulu kolonu okumak değil, kolonun doldurulmasını
otomatikleştirmektir.**

### Tasarım notu — ingestion-time HEAD kontrolü (kod YAZILMADI)

Onaylanan yön (18 Ağu 2026), ayrı ve küçük bir takip işi olarak açılacak:

1. **Nereye:** `sync-trending/index.ts:491-492` — `detailToRow(detail,
   trendingType)` ile `films` upsert'i (`:493-497`) **arasına**. Poster URL'i
   `detailToRow` içinde `:254`'te kuruluyor (`TMDB_IMAGE_BASE` = `/t/p/original`).
2. **Ne:** Yazılacak poster'a **bir kez** `HEAD` at, sonucu `row` üzerine
   `poster_quality_ok: boolean` olarak koy. `FilmInsertRow` (`:96-120`) bu alanı
   kazanır — kolon zaten mevcut olduğu için **şema değişikliği değil**, yalnız
   tip genişlemesi.
3. **Hangi boyut:** `w500` varyantına atılmalı, `original`'a değil — istemcinin
   gerçekten yüklediği boyut odur (`toW500PosterUrl`, M3 Faz 2 fix'i sonrası).
4. **Başarısızlık semantiği:** HEAD düşerse film yine de INSERT edilir
   (`poster_quality_ok = false`), satır **atlanmaz/silinmez** (CLAUDE.md #4).
   Hata `console.error` + `sentryCapture` ile görünür olur — sessiz geçilmez.
   Mevcut `:483` "no poster" atlaması farklı bir vakadır (`poster_path` hiç yok);
   bu kontrol "path var ama ölü" vakasını yakalar.
5. **Neden D-03'ü ihlal etmez:** Kontrol **ingestion anında**, haftada bir,
   ~9 film için çalışır (5'li paralel batch içinde) — D-03'ün yasakladığı şey
   **request-time** kontrolüdür (generation anında, kullanıcı beklerken, aday
   başına network çağrısı). İkisi farklı zaman ekseni.

Bu doldurma yolu canlıya çıktıktan **sonra** `gauntletCore.ts:318` filtresine
fail-open gate eklenmesi anlamlı hale gelir — o zaman gerçek kapsaması olur.

> Alternatif ve daha büyük çözüm — `compute-dominant-colors`'ı Edge Function +
> cron'a taşımak — **reddedilmedi, ertelendi**: yeni Deno görsel indirme/decode
> mimarisi ve yeni cron demektir, kendi sprint'ini hak eder.

---

## `no_candidates` exhaustion kalıcılaşmıyor (K-37 / R2)

`submit-choice:952` yenilemede aday bulunamazsa istemciye `exhausted` /
`no_candidates` döner ve Sentry'ye yazar — ama **DB'ye hiçbir iz bırakmaz**.
`deriveProgress` yalnız yazılmış duruma bakar; kullanıcı uygulamayı yeniden
açtığında sunucu `in_progress` der ve tur kaldığı yerden devam eder.
İstemci "bitti" gösterirken sunucu "devam ediyor" der — kullanıcıya görünür
tutarsızlık.

**Neden şimdi değil:** Kalıcılaştırmanın doğal yolu `choice_events.outcome`
enum'una `'exhausted'` eklemek. Bu üç yeri birden değiştirir:

1. migration 069'daki `choice_events_outcome_check` CHECK kısıtı,
2. `types/gauntlet.ts` → `ChoiceOutcome` — **KİLİTLİ sözleşme**, CTO onayı ister,
3. migration 072'nin partial UNIQUE index'i (`WHERE outcome IN ('choice','timeout')`)
   — yeni değerin tur harcayıp harcamadığına göre gözden geçirilmeli.

Yani migration + kilitli sözleşme değişikliği + index revizyonu. **R1
atomikleştirmesiyle (aynı dosyanın aynı sıcak yolu) birlikte tek turda
değerlendirilecek** — ikisini ayrı ayrı yapmak `submit-choice`'ı iki kez
riske sokar.

Alternatif (migration'sız): `no_candidates` hiç kalıcılaştırılmaz, istemcinin
exhausted ekranı "tur devam ediyor"a çevrilir. Davranış değişikliği,
şema değişikliği yok. Karar verilmedi.

Ayrıntı: `docs/os/K37_GAUNTLET_STATE_MACHINE.md` §5 R2.

---

## Orphan auth teşhisi tam kapanmadı — 6 kayıt, kök neden bilinmiyor

17 Ağu 2026'da runner fix'i sahada doğrulanmış ve öksüz `auth.users` sayısı
88'den 3'e inmişti. **27 Ağu 2026 ölçümünde tekrar 6.** En yenisinin
`last_sign_in_at` değeri **19 Ağu** — yani fix'ten SONRA da yeni öksüz
doğmuş. Sızıntı devam ediyor, kök neden araştırılmadı.

| Ölçüm (27 Ağu 2026) | Değer |
|---|---|
| `auth.users` | 255 |
| `public.users` | 249 (249'unun da `auth_id`'si dolu) |
| Öksüz `auth.users` (köprüsü yok) | **6** |
| Hepsi anonim oturum, yaş | 8-13 gün, `last_sign_in_at ≈ created_at` |

**Etki:** `resolveAppUser` (`_shared/gameUtils.ts:100`) `public.users` satırı
bulamazsa `AuthError` fırlatır → `generate-gauntlet` **401** döner. Bu 6 kayıt
gauntlet alamaz. Hiçbiri geri dönmemiş (tek oturum), yani aktif kullanıcı
kaybı değil — ama her yeni öksüz bir sessiz kayıp adayıdır.

**Neden şimdi değil:** Kök neden `ensureAppUser`'ın hangi koşulda iki denemede
de düştüğü (`app/_layout.tsx:141-147`) — ağ, RLS ya da yarış olabilir, ölçüm
yapılmadı. **K-42 (offline/fallback) öncesi gözden geçirilecek**: o iş zaten
bootstrap ve ağ hatası yollarına dokunacak, teşhis oraya doğal olarak giriyor.

İlgili: `docs/os/K37_GAUNTLET_STATE_MACHINE.md` — R7 keşfinde bulundu
(R7'nin kendisi gerçek risk değilmiş, bu çıktı).

---

## offlineQueue.ts ölü kod — silinmesi WIP temizliğini bekliyor

`services/offlineQueue.ts` (241 satır) **işlevsizdir**: yazma tarafının
tamamı bağlantısız.

| Export | Çağıran |
|---|---|
| `enqueueOperation` | **0** — kuyruğa hiçbir şey girmiyor |
| `cacheArchetypeId` | **0** |
| `cacheCalibrationVector` | **0** |
| `getCachedCalibrationVector` | **0** |
| `processOfflineQueue` | `app/_layout.tsx:282` (açılış), `:430` (TOKEN_REFRESHED) |
| `getCachedArchetypeId` | `services/homeService.ts:87` |

Yani `chosy_offline_queue` anahtarı hiç yazılmadığı için `processOfflineQueue()`
her açılışta boş kuyruk buluyor, `getCachedArchetypeId()` daima `null` dönüyor.
Kök neden: dosya onboarding arketip quiz'i için yazılmıştı, o akış emekli oldu
(bkz. gauntlet pivotu), çağrı noktaları onunla birlikte gitti.

**Neden şimdi silinmedi:** silmek `app/_layout.tsx` (import + 2 çağrı) ve
`services/homeService.ts` (import + fallback) düzenlemesi gerektiriyor.
`app/_layout.tsx` şu an **dört ayrı yarım işin** ortasında (K-15/E-05 bildirim
istemi, auth, vektör seed, champion prompts — 12 dosyalık WIP). Yarım işi
"bitmiş" diye commit'e sokmamak için ertelendi.

**Silme sonrası davranış değişmez:** `homeService.ts:87` fallback'i kalkınca
`archetypeId = profile?.archetype_id ?? null` kalır — cache zaten hep boş
olduğu için sonuç aynı.

**Ne zaman:** Mertkan'ın WIP'i commit'lenince. K-42'yi bloklamıyor.

İlgili: K-42 keşif turu (27 Ağu 2026).

---

## "Unlock the full experience" ekranında geri gezinme yok

Paywall ekranına ("Unlock the full experience") girildiğinde geri dönmenin
görünür bir yolu yok — geri butonu/kapatma yüzeyi eksik. Kullanıcı ekranda
sıkışıyor.

**Nerede bulundu:** K-42 cihaz doğrulama turu, 27 Ağu 2026 (bkz. bible E-11).
Aranan hata bu değildi, yan bulgu olarak çıktı.

**Neden şimdi düzeltilmedi:** paywall yüzeyi R-C sprintinin kapsamı
(K-46 arşiv paywall'ı, K-49 RevenueCat durum matrisi, E-09 funnel
enstrümantasyonu). Ekranı iki kez elden geçirmemek için düzeltme oraya
bırakıldı.

**Ne zaman:** R-D (App Store submission) açılmadan önce çözülecek.

İlgili: `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` E-11.

---

## `activate_referral` → `claim_lifetime_spot` iç çağrısı postgres bağlamında kırılır

`activate_referral` 5. davette `claim_lifetime_spot(v_referral.referrer_id, 0,
'referral_reward')` çağırıyor — çağıranın değil, **davet edenin** id'siyle.
`claim_lifetime_spot`'un guard'ını aşan tek şey `auth.role() = 'service_role'`
baypası; iç blokta EXCEPTION handler yok. Fonksiyon postgres bağlamında
doğrudan çağrılırsa (psql, Dashboard SQL editor, doğrudan SQL cron)
`auth.role()` NULL döner, baypas çalışmaz, 42501 propagate eder ve tüm
`activate_referral` abort olur — 5. davet ödülü hard fail olur.
**`service_role` dışı çağrı yolu asla açılmamalı.**

**Nerede bulundu:** 109/110 doğrulama turu, 11 Eyl 2026.

**Neden şimdi düzeltilmedi:** şu an güvenli — tek çağıran
`supabase/functions/process-referral/index.ts` ve o service_role bağlamında
çalışıyor. Risk yalnızca CLAUDE.md'nin "Dashboard SQL editor yasak" kuralı
ihlal edilirse doğuyor. Kod değişikliği yapılmadı.

İlgili: `supabase/migrations/109_security_definer_user_id_guard.sql`,
`supabase/migrations/026_referrals.sql`.

---

## `claim_lifetime_spot` service_role pozitif yolu ampirik doğrulanmadı

109/110 doğrulama turunda guard'ın **blokaj** tarafı `claim_lifetime_spot` için
doğrudan doğrulandı (anon → FORBIDDEN, authenticated + başka id → 403
FORBIDDEN). **Baypas** tarafı (`auth.role() = 'service_role'` ile geçiş) ise
yalnızca dolaylı kanıtlandı: predicate'i `apply_invite_code` ile satır satır
özdeş ve o gerçek service_role anahtarıyla ampirik doğrulandı.

**Neden şimdi doğrulanmadı:** `lifetime_sales` tablosu boş, dolayısıyla
`ALREADY_LIFETIME` erken dönüşünü tetikleyecek sıfır maliyetli yol yok. Tek
alternatif `nextval('lifetime_sale_number')` yakmak — satır silinse bile
`sale_number` 1 kalıcı boşa düşer ve ilk gerçek kurucu üye "#2" olur.
Doğrulanmayan tek şeyin (aynı predicate'in ikinci kopyası) kanıt değerine
göre orantısız maliyet.

**Ne zaman:** `lifetime_sales`'in ilk gerçek satırı geldiğinde (veya launch
sonrası ilk claim'de) fırsatçı doğrulama yapılabilir. Düşük risk.

**Güncelleme — 11 Eyl 2026, migration 111 turu.** Kapsam daraldı ama kalem
kapanmadı:

- **Düzeltilen:** `lifetime_sales.user_id` FK'si `auth.users(id)` →
  `public.users(id)`'ye çevrildi (111). `claim_lifetime_spot` gövdesi zaten
  public uzayı bekliyordu (`UPDATE users WHERE id = p_user_id`,
  `UPDATE subscriptions WHERE user_id = p_user_id`) — auth id geçildiği için
  o iki UPDATE **sessizce 0 satır** ediyordu. Çağıranlar da düzeltildi:
  `revenuecat-webhook` ve `process-lifetime-purchase` artık `public.users.id`
  gönderiyor (ikisi de deploy edildi).
- **Doğrulanan:** FK hedefi `pg_constraint` ile ölçüldü; `tsc` baseline'ları
  korundu; owner-read ve service-role RLS politikaları gerçek oturum + anon
  ile test edildi. Aynı guard predicate'ini paylaşan `apply_invite_code`
  **uçtan uca** doğrulandı (auth id → 42501, public id → success) ve
  `activate_referral`'ın service_role yolu gerçek anahtarla çalıştırıldı.
- **Hâlâ doğrulanmayan:** `claim_lifetime_spot`'un kendi pozitif yazma yolu
  canlıda çalıştırılmadı. Gerekçe değişmedi — `nextval('lifetime_sale_number')`
  geri alınamaz, satır silinse bile ilk gerçek kurucu üye "#2" olur.
- **İzleme:** launch sonrası **ilk gerçek satın almada** şu üçü kontrol edilir:
  `lifetime_sales` satırı yazıldı mı, `users.subscription_tier = 'lifetime'`
  oldu mu, `subscriptions.plan = 'lifetime'` oldu mu. Üçü birden geçerse bu
  kalem kapanır; `sale_number`'ın 1'den başlaması ayrıca teyit edilir.

İlgili: `supabase/migrations/109_security_definer_user_id_guard.sql`,
`supabase/migrations/111_fk_identity_space_fix.sql`,
`docs/investigations/LIFETIME_REFERRAL_FK_KESIF.md`.

---

## `ai-profile-films` — maliyet sabitleri güncel değil (19 Eyl 2026)

`scripts/ai-profile-films.ts:94-95` fiyatları modül sabiti olarak taşıyor:

```typescript
const CLAUDE_INPUT_PRICE = 0.80;
const CLAUDE_OUTPUT_PRICE = 4.00;
```

Claude Haiku 4.5'in güncel fiyatı **$1.00 / $5.00** (1M token, girdi/çıktı).
Sabitler **%25 düşük** olduğu için hem `--dry-run` tahmini hem koşum sonu
raporu gerçek harcamanın altını gösteriyor.

Ölçüldü (19 Eyl, E-19 zinciri, 94 film): script `$0.187` raporladı; aynı
token sayılarıyla (75.335 girdi / 31.759 çıktı) gerçek tutar **$0.234**.

**Neden şimdi değil:** mutlak fark bu ölçekte sent mertebesinde ve koşum
zaten ayrı onayla yapılıyor. Ayrı `/uygula` ile düzeltilecek. Düzeltirken
fiyatın kod içinde sabitlenmesinin kendisi de gözden geçirilmeli — fiyat
değiştiğinde iki dosya birden kayar.

---

## `ai-profile-films` — sistem promptu prompt caching kullanmıyor (19 Eyl 2026)

`PROFILING_SYSTEM_PROMPT` (`services/filmProfilePrompt.ts:102`) **261 token**
ve her film için yeniden tam ücretle gönderiliyor; `cache_control` yok.
94 filmlik koşumda bu 24.534 token, toplam girdinin yaklaşık **üçte biri**.

**Neden şimdi değil:** bu ölçekte tasarruf sent mertebesinde, üstelik 261
token Haiku'nun minimum cacheable prefix eşiğinin altında kalabilir — yani
`cache_control` eklemek ölçülebilir bir kazanç vermeyebilir. Havuz büyüdükçe
(yüzlerce film / tekrarlayan koşum) yeniden değerlendirilmeli; o noktada
önce `usage.cache_read_input_tokens` ile gerçekten cache'lendiği doğrulanmalı.

---

## logger.warn / logger.error production'da no-op — kritik yol denetimi (19 Eyl 2026)

C.9b-UI G8 maddesi `app/_layout.tsx:181-187`'deki **font yükleme fallback**'ini
`Sentry.captureMessage`'a bağlıyor. Bu **tek bir noktayı** kurtarır; sınıfın
kendisi açık kalıyor.

`logger.warn`/`logger.error` production build'inde iz bırakmıyor. Bir `catch`
bloğu yalnız `logger.error` çağırıyorsa, hata sahada **hiç görünmüyor** —
CLAUDE.md kural 1'in ("sessiz fallback yasak") sessizce ihlali, çünkü kod
okunduğunda hata ele alınmış görünüyor.

**Yapılacak:** kritik yolların `logger` kullanımını tarayan bir denetim —
öncelik sırası:

1. `supabase/functions/submit-choice` — oyun sonucu yazma yolu
2. auth akışı (`app/_layout.tsx` session/`signInAnonymously` dalları, E-08)
3. billing (RevenueCat webhook, entitlement senkronu)

Her `catch` için karar: Sentry'ye mi gidecek, kullanıcıya mı yansıyacak, yoksa
gerçekten yutulabilir mi (ve neden). İlgili: hafıza kaydı
`logger.error prod'da no-op`, K-44.

---

## D-05 "Battle" paylaşım formatının sprint sahibi yok (19 Eyl 2026)

D-05 (`7_CHOSY_V1_KAPSAM_KILIDI.md:199-207`) paylaşımı 3 formattan **1 formata**
indiriyor ve o formatı **"Battle"** olarak kilitliyor
(*"Ben Heat seçtim. Sen ne seçerdin?"* — viral asimetrisi olan tek format).

**Ölçülen (C.9b-UI Faz 0, M-C4):** `utils/gauntletShareText.ts:64` tek format
üretiyor ✅ ama o format **braket metni** (başlık + tur satırları + şampiyon),
"Battle" değil. Yani "tek format" şartı sağlanmış, **format seçimi sağlanmamış**.

C.9b-UI'da yalnız L-10 düzeltmesi yapıldı (EN `share.championLine`
"Tonight's film" → "Today's film"); format değişimi **kapsam dışı bırakıldı**.

**Açık soru:** D-05'i hangi sprint taşıyacak? Sprint tablosunda (§8) sahibi yok.
Dikkat: "Battle" formatına geçiş, C.5'te kurulan `shareRounds` braket
altyapısını (`GauntletShell` `setShareRounds`) **ölü kod** hâline getirir —
karar birlikte alınmalı.

---

## D-07 session replay hiç uygulanmadı ve sprint sahibi yok (19 Eyl 2026)

D-07 (`7_CHOSY_V1_KAPSAM_KILIDI.md:219`) session replay'i iki segmente
daraltıyor: **first session** ve **aborted gauntlet**, privacy masking zorunlu.

**Ölçüldü (C.9b-UI Faz 0, bulgu F-B):**

- Kod tabanında `aborted` geçen **hiçbir yer yok**
- `Sentry.init` içinde **replay entegrasyonu yok** (`app/_layout.tsx:78`
  yalnız `tracesSampleRate`)
- **Sprint tablosunda (§8) sahibi yok.** M1 "Ölçüm Önce" kapsamı dört kalem
  sayıyor (event dictionary · alan bağlaması · Sentry release health + source
  map · `v_algorithm_daily`) — replay bunlardan biri **değil**. M1'in DUR
  NOKTASI'ı da "20/20 event canlı doğrulanmış"; replay bir event olmadığı için
  o kapıdan **geçmez bile**
- Tek dolaylı atıf: E-03 altyapı maliyet modeli (`:384`) "Supabase depolama
  (session replay dahil)" diyor — replay'in **var olduğunu varsayıyor**

**Neden önemli:** D-01 ("ölçüm en başa") gereği bu boşluk marketing kapısından
önce kapanmalı. Doğal sahibi M1; kapsamına açıkça eklenmesi gerekiyor.

**Uygulanırken:** "aborted gauntlet" tespiti **unmount'a bağlanmamalı**.
`GauntletShell` sekme değişiminde unmount olabiliyor (bkz. C.9b-UI G10);
unmount'u "terk etme" saymak her sekme dönüşünü yanlış pozitif yapar.

---

## docs/os — 5 ve 6 numaralı dosyalar repoda yok (19 Eyl 2026)

`docs/os/` altında bugün **1 · 2 · 3 · 4 · 7 · 8** + `K37_GAUNTLET_STATE_MACHINE.md`
var. Eksik:

| # | Dosya | Durum |
|---|---|---|
| 6 | `6_IA_REVIZE_KARAR_GUNLUGU` | Kapsam kilidi buna **referans veriyor** ama dosya repoda yok. CTO'nun Project'inde mevcut, repoya kopyalanacak |
| 5 | (adı bilinmiyor) | **BULUNAMADI** — ne repoda, ne CTO'nun Project'inde (CTO teyidi, 19 Eyl 2026). Var olduğuna dair tek kanıt numaralama sırası |

Bible referans verdiği bir dosyanın repoda bulunmaması, kararların
izlenebilirliğini kırıyor.

**5 numara:** "yok" değil, **"bulunamadı"** olarak kayda geçiyor — dosyanın
hiç var olmadığı kanıtlanmadı, yalnızca iki bilinen konumda da yok. Bir
kaynaktan çıkarsa buraya bağlanır; çıkmazsa numaralama boşluğunun bilinçli
olduğu kapsam kilidine not düşülür.

---

## `exhausted` dalı çıkışsız — K-23 boşluğu mu? (19 Eyl 2026)

C.9b-UI Faz 0 state-makinesi denetiminin gözlemi. **Bu turda değiştirilmedi**
(CTO kararı: davranış ve IA'yı ilgilendiriyor, görsel uyum turuna girmez).

### Gözlem

`GauntletShell/index.tsx:1006-1016` — `completed_today` + champion yok dalı
ekrana **yalnız bir cümle** basıyor (`gauntlet.exhausted`). Tek eylem
`QuietAction` `{onDismiss && ...}` koşuluna bağlı ve `app/(tabs)/index.tsx`
`onDismiss` **vermiyor** (bilinçli, K-03 gerekçesi dosyada yazılı). Sonuç:
ritüelin bittiği bu yüzeyde hiçbir eylem yok. Kullanıcı sekme değiştirerek
çıkabiliyor — kilitlenme değil, ama çıkış da sunulmuyor.

### K-23 ile ilişki — **doğrulanmadı**

K-23 (`7_CHOSY_V1_KAPSAM_KILIDI.md:85`): *"Ret merdiveni korunur (Ret 1
sessiz yeni çift · Ret 2 üç yön · **Ret 3 liste/saved/yarın**). Her ret
analytics sinyalidir."*

`exhausted` ile "Ret 3" aynı şey **olmayabilir**: `exhausted`ın iki üretim
yolu var (`submit-choice/index.ts:157`) — `no_candidates` (yedek film
kalmadı) ve `timeout_no_winner`. K-23'ün merdiveni ret **sayısına** bağlı,
`exhausted` ise havuz/zaman durumuna. Örtüşüyorlarsa boşluk gerçek.

İlgili not: `GauntletShell` başlık yorumu zaten *"Ret akışı yalnızca Seviye 1
… Seviye 2/3 dalları C.3 / Faz D"* diyor — yani merdivenin üst basamakları
**bilinçli ertelenmiş**. Bu, boşluğun sahipsiz değil ertelenmiş olabileceğine
işaret ediyor ama sprint tablosunda açık bir satır yok.

### Cevaplanacak üç soru

1. **K-23 boşluğu mu?** "Ret 3"ün `liste/saved/yarın` üçlüsü `exhausted`
   dalında mı karşılanmalı, yoksa ret sayacına bağlı ayrı bir dal mı?
2. **`exhausted`a ulaşma oranı — gerçek mi teorik mi?** Bugün ölçülmüyor:
   istemci `GauntletProgress.exhaustedReason`'ı **okumuyor**
   (`applyGauntlet` → `toExhausted()` reason'ı yok sayıyor) ve `exhausted`
   için ayrı analytics event'i yok. Alan sunucuda üretiliyor
   (`no_candidates` / `timeout_no_winner`) ama hiçbir yere yazılmıyor.
   ⚠️ E-19 dönemi bu oranı ayrıca çarpıtıyor: editoryal günde yedek
   çekilmediği için `no_candidates` yolu farklı davranıyor (bkz. F-A).
3. **Sahibi hangi sprint?** Sprint tablosunda (§8) `exhausted` veya K-23
   ret merdiveni için açık satır **yok**. `GauntletShell` yorumu C.3 / Faz D
   diyor; C.3 tabloda geçmiyor, Faz D ise v1 kapsamı dışında.

### Bağlantılı açık madde

§9'daki **"E-19 yedek kulübesi boş"** (`editorial_calendar_films` position
5-6, 0 satır) aynı ailenin parçası: *"eksik olan 'ret sonrası yerine ne
gelecek' cevabı."*

---

## LanguageContext varsayılan dili cihazdan seçmiyor (20 Eyl 2026)

`contexts/LanguageContext.tsx` başlığı *"Kayıtlı tercih yoksa cihaz diline
göre 'en' veya 'tr' seçer"* diyordu ama kod **koşulsuz `'en'`** seçiyor.
C.9b-UI C2c'de başlık gerçeğe uyduruldu; **davranış değiştirilmedi** — bu bir
ürün kararı ve o maddenin kapsamı değildi.

**Yön (CTO, 20 Eyl 2026):** kayıtlı tercih yoksa cihaz dilinden seç (tr/en).
**Kayıtlı tercihi asla ezme.** Ayrı, küçük bir sprintte yapılacak.

Altyapı hazır: `expo-localization` artık bu dosyada import ediliyor
(`getLocales()`), `region` için zaten kullanılıyor. Dil için aynı çağrının
`languageCode`'u okunacak.

**Yan etki (test notu):** bugün cihaz dilini değiştirmek uygulamanın dilini
değiştirmiyor. Türkçe string testleri **uygulama içi Ayarlar'dan** yapılmalı.

---

## `app/film/[id].tsx` sağlayıcı bölgesi hâlâ sabit 'US' (20 Eyl 2026)

C.9b-UI C2c gauntlet tarafında bölgeyi cihaza bağladı
(`useLanguage().region`), ama film detay ekranı hâlâ
`fetchMovieWatchProviders(tmdb_id)` varsayılanıyla ('US') çağırıyor
(`app/film/[id].tsx:373`).

**Sonuç:** aynı film iki ekranda **farklı sağlayıcı** gösteriyor. Champion'da
TR kataloğu, film detayında ABD kataloğu. Bu bir tutarsızlık değil, güven
sorunu — kullanıcı hangisine inanacağını bilemez.

**Öncelik (CTO): C.9b'den HEMEN sonra.** Tek satırlık bölge okuması;
`useLanguage()` zaten o ekranda mevcut.

---

## TR sağlayıcı kapsamı seyrek — C2e "empty" sık görünecek (20 Eyl 2026)

C.9b-UI C2e "Nerede izlenir"e dört durum verdi; bunlardan **empty** (istek
başarılı, bölgede sağlayıcı yok) Türkiye'de **sık** çıkacak: TMDB'nin TR
katalog verisi ABD'ye göre belirgin biçimde seyrek.

**Bu bir ürün hatası DEĞİL, veri gerçeği.** Davranış doğru: "Bölgende akışta
yok." denir ve "Sonraya bırak" birincil eyleme yükselir.

**Ölçüm sonucu:** `provider_clicked` oranı TR kullanıcılarda düşük çıkacak.
Bu, K-20 activation bridge'inin başarısızlığı olarak okunmamalı.

**Nerede hesaba katılacak:**
- **G-4** (Watched-it ilk sinyal ≥%25) — köprünün bir ayağı zayıfsa pay düşer
- **R-06** köprü kalitesi yorumları
- İleride: "sağlayıcı yok oranı"nı bölge kırılımıyla ölçmek (M1 borcu; bugün
  yalnız Sentry breadcrumb'ında `region` var, event yok)

---

## `isPremium` üç yoldan hesaplanıyordu — kalan istemci borçları (27 Eyl 2026, V-1 Tur 1)

`useSubscription().premiumStatus` (`loading` / `premium` / `free`) tek UI
kaynağı oldu (CTO D3). Karar mantığı `utils/premiumStatus.ts`'te saf fonksiyon,
testi `tests/subscription/premiumStatus.test.ts`. RC `chosy_plus` aktif ⇒
premium (DB satırı olmasa da; Sentry warning `RC_ACTIVE_DB_MISSING`). Bu turda
**bilinçli olarak dokunulmayanlar**:

1. **`quotaEngine.getTierFromRevenueCat`** (`services/quotaEngine.ts:102`) —
   hâlâ ayrı bir RC okuması yapıyor ve hata durumunda `free` dönüyor;
   `premiumStatus` ile ayrışabilir (UI premium, kota free). K-48 sunucu
   kapılarıyla birlikte ele alınacak.
2. **`getUserSubscription` hatayı `null`'a indiriyor**
   (`services/subscriptionService.ts:61`) — "satır yok" ile "sorgu hatası"
   ayırt edilemiyor; RC okunamadığında DB hatası sessizce free'ye katkı veriyor.
3. **`checkQuota` fresh-fetch** (`contexts/SubscriptionContext.tsx`) RC aktif +
   DB yok durumunu hâlâ premium saymıyor — kota yolu D3 kuralına hizalanmadı.
4. **`isPremium` tüketicileri** — paywall/özellik kapıları (`useContextualPaywall`,
   `useGamePaywall`, `ArchiveTrigger`, `roulette`, `discover`) bu turda
   `premiumStatus`'a geçirildi; `loading`'de özellik açan kapılar no-op /
   fail-closed. **Kalan:** `app/(tabs)/profile.tsx` (Tur 2),
   `hooks/useProModeAccess.ts` (zaten `isLoading` ile fail-closed, geçiş opsiyonel).
5. **`RC_ACTIVE_DB_MISSING` hacmi** — kimlik uzayı çatallanması olan kullanıcıda
   webhook satırı hiç gelmeyebilir; warning her refresh'te tekrar eder. Hacim
   G-3'te ölçülüp gerekirse örneklenecek.
   `not_initialized` durumunda `purchaseService` ve `SUBSCRIPTION_RC_UNREADABLE`
   aynı anda düşüyor — dedupe/tag birleştirme G-3 ölçümüyle birlikte
   değerlendirilecek.

---

## `v_algorithm_daily` önceki döngü satırlarını sayıyor (27 Eyl 2026, E-21)

**Öncelik: düşük (hacim küçük). R-C öncesi gözden geçirilecek.**

`v_algorithm_daily` görünümü `cycle='previous'` satırlarını günlük sayıma dahil
ediyor; algoritma kalite metrikleri E-21 sonrası hafif şişmiş olabilir.

- Önceki döngü satırı, önceki döngünün **anahtarıyla** (dün) yazılıyor
  (migration 118, E-21 "satır tarihi" kuralı). Görünüm `dg.date` ile grupladığı
  için bu satırlar o günün `gauntlets_generated` sayısını artırıyor ve —
  sabah oynanıp bitirildiğinde — tamamlanma oranını o güne yazıyor.
- Görünüm kolonları açıkça seçiyor (`SELECT *` yok); şema kırılmadı, yalnız
  metrik anlamı etkileniyor (migration-guard turuncu notu, 27 Eyl 2026).

**Düzeltme:** görünüme `cycle = 'current'` filtresi (yeni migration, `CREATE OR
REPLACE VIEW`). Önceki döngü davranışı ayrıca ölçülmek istenirse `cycle`
kolonuna göre ayrı bir kırılım eklenebilir.

---

## Playfair kalıntıları ve Tur 7 sonrası artık kod (28 Eyl 2026, V-1 Tur 7)

**Öncelik: düşük. Donmuş oyunların kaderi kararlaştırıldığında kapanır.**

V-1 Tur 7 (D10) canlı ekranları ve token'ları Design OS §3.3 rollerine taşıdı
(`dab1e53`), ulaşılamayan taşıyıcıları sildi (`054f4ba`). `git grep -i
playfair` kod tarafında yalnız şunları gösteriyor, **hepsi D10 gereği bilinçli**:

| Yer | Neden kaldı |
|---|---|
| `app/_layout.tsx:8-14, :165-170` — 6 ağırlık `useFonts()` | D10: "font bundle'da kalır". Tek canlı tüketici aşağıdaki Detective. |
| `components/games/Detective/styles.ts:613, :957, :1030` — `PlayfairDisplay_900Black` | Donmuş oyun, dosyasına dokunulmaz (D10). |
| `package.json:61`, `package-lock.json`, `deno.lock:57` | Paket bağımlılığı — font yüklemesiyle birlikte gider. |
| `DESIGN_SYSTEM.md` + `docs/` (5 dosya, 20 satır) | Tarihsel doküman; Design OS §3.2 emekliliği kayıt altında. |

**Kapanış yolu:** Detective silinir ya da token'a bağlanırsa 6 ağırlığın
yüklemesi ve `@expo-google-fonts/playfair-display` bağımlılığı kaldırılabilir
(açılışta 6 TTF — başlangıç maliyeti). Bu bir bağımlılık değişikliğidir, CTO
onayı ister.

**Görsel yan etki (onaylı, izlenmeli):** `serif*`/`fonts.display*` token'ları
SF Pro'ya geçtiği için donmuş oyunlar ve games hub (CineMetrics, Logline
`serifQuote`, Detective `serifHero`, DailyChest/DailyRoute/DailyThemeCard/
HubHero) dosyaları değişmeden SF Pro 600 render ediyor; `serifHero` 900 →
600. Bir donmuş oyun yeniden açılırsa başlık hiyerarşisi cihazda gözden
geçirilmeli.

### Tur 7 sonrası artık kod (silinmedi — kapsam dışı)

Silme yalnız onaylı listeyle sınırlı tutuldu. Aynı import grafiği ile
**hiçbir route'tan erişilemeyen** kalanlar:

- `hooks/useFeedState.ts` — tek kullanıcısı silinen `SwipeCardStack` idi;
  yalnız `hooks/index.ts` barrel'ı export ediyor.
- `components/Profile/CollectionsCard`, `components/Profile/CinemaIdentity` —
  importer yok (Tur 7'den önce de).
- `services/entryService.ts` — `hasEntryShownToday` / `markEntryShownToday` /
  `wasEntryShownToday` / `markEntryShown`: çağıran yok (Entry'den önce de).
- Silinen Entry/TasteSwipe/ArchetypeReveal/ArchetypeShareCard/SwipeCard
  bileşenlerinin i18n anahtarları `en.json`/`tr.json`'da duruyor (parite
  eşit, yalnız ölü anahtar).

### Tur 7'de görülen, düzeltilmeyen

- **§3.5 Dynamic Type sınırı uygulanmıyor:** Archivo Expanded 1.4x ile
  sınırlanmalı; hiçbir `display-*` tüketicisinde (`ChampionReveal`, yeni
  `profile.tsx` `archetypeHeroName`) `maxFontSizeMultiplier` yok.
- **Pro Mode üst arama çubuğu gönder butonu** (`compactSubmitBtn`) hâlâ
  `accentPrimary` dolgu + `textOnAccent`; Tur 7 yalnız alt CTA'yı kapsadı.

---

## V-1 kapanışı — kalan istemci/altyapı borçları (28 Eyl 2026, V-1 Tur 8)

**Kaynak:** V-1 Tur 8 entegrasyon turu. Bible karşılığı: `7_CHOSY_V1_KAPSAM_KILIDI.md`
v1.31, §5 E-22. Kod değişikliği yok; hepsi ölçülmüş durum kaydıdır.

### 1. `quotaEngine` ayrı RevenueCat okuması

Zaten kayıtlı — bkz. yukarıda *"`isPremium` üç yoldan hesaplanıyordu"* madde 1.
Değişiklik yok: `services/quotaEngine.ts:102-121` hâlâ kendi
`Purchases.getCustomerInfo()` çağrısını yapıyor, hatada `free` dönüyor;
`premiumStatus` (V1-D3) ile ayrışabilir.

### 2. İstemci taraflı kota sayacı (AsyncStorage) — yeniden kurulumla sıfırlanıyor

**Öncelik: orta. R-C öncesi karar.**

`checkAndConsumeQuota()` sayacı AsyncStorage'da tutuyor
(`services/quotaEngine.ts:61` anahtar `quota_{userId}_{type}_{YYYY-MM-DD}`,
`:147` "RPC bypass"); yeniden kurulumda / depo silinmesinde sıfırlanır.
Hata dalı fail-open (`:149`, `:200`).

⚠️ **Tanım düzeltmesi (ölçüm, 28 Eyl 2026):** görev notu bunu "Haiku maliyet
riski" olarak tanımlıyordu. İstemci sayacı Haiku'ya giden yolun **tek kapısı
değil**: `parse-mood` (`:209`) ve `parse-taste` (`:318`) `check_and_consume_quota`
RPC'sini Haiku çağrısından (`parse-mood:356`) **önce** sunucuda çalıştırıyor;
`parse-mood` ayrıca fail-closed rate limiter taşıyor. Slot fonksiyonları
(`slot-pure-random` / `slot-triple` / `slot-mood-filtered`) da sunucuda sayıyor.
Yani AsyncStorage'ı silmek **aynı kimlik için** sunucu kotasını aşmaz.

**Gerçek açıklar:**

- **Yeniden kurulum = yeni anonim kimlik = yeni sunucu kotası.** Tam depo
  silinmesinde kimlik kaybı ölçülmüyor (bible §9, M0 Faz 3; `expo-secure-store`
  kurulu değil). Her yeniden kurulum free 3 aramayı (Haiku) tazeler. Maliyet
  vektörü sayaç değil, **kimlik**. Hacim bilinmiyor.
- **Sunucu kota RPC hatasında fail-open** (`parse-mood:214-226`, Sentry
  `QUOTA_CHECK_FAILED`) — maliyet tavanı o an yalnız rate limiter.
- **İki sayaç bağımsız:** istemci "N left today" AsyncStorage'dan, sunucu
  `check_and_consume_quota`'dan sayıyor; çoklu cihazda veya sayaç silindiğinde
  UI kalan hakkı yanlış gösterir, sunucu 429 döner.

**Karar gerekenler (R-C):** istemci sayacını sunucu sonucundan türetmek
(`check-quota` fonksiyonu mevcut) · yeniden kurulum hacmini ölçmek (G-3).

### 3. Bildirim kolonları — istemci kullanımı bırakıldı (K-15 yerel planlama, V-2 Tur E1)

**Öncelik: düşük — sunucu okuyucuları ölü cron'larda.**

**Güncelleme (28 Eyl 2026, V-2 Tur E1):** K-15 yerel planlama uygulandı —
Settings tek native switch (`users.push_enabled`, `toggle_push_notifications`
RPC) + cihazda `ensureDailyReminderScheduled()` (`services/pushNotifications.ts`).
Aşağıdaki iki kolonu istemci artık **okumuyor ve yazmıyor**; get/toggle
fonksiyonları silindi. Kolonlar **silinmedi**.

**DUR ön koşulu ölçüldü (28 Eyl 2026, `cron.job` + `cron.job_run_details`):**
`send-daily-pick-hourly` (jobid 3), `watchlist-activation-weekend` (4) ve
`watchlist-activation-mood-recall` (5) üçü de `active=false`; son koşumlar
5–9 Ağu 2026, hepsi `failed` (`unrecognized configuration parameter
"app.supabase_functions_url"`). `notification_log` son 60 günde 0 satır.
Yani toggle'ı kaldırmak bugün kullanıcıdan canlı bir kapatma yolunu almadı.
⚠️ Bu cron'lar yeniden açılırsa kolonların istemcide yazıcısı yok —
varsayılan `true` ile herkese gider; açmadan önce karar gerekir.

Kullanımı bırakılan yerler (eski satır numaraları, E1 öncesi):

| Kolon | İstemci | Sunucu okuyucusu |
|---|---|---|
| `users.daily_pick_enabled` | `services/pushNotifications.ts:269-305` (get/toggle) | `send-daily-pick/index.ts:155-159` |
| `users.watchlist_notifications_enabled` | `services/pushNotifications.ts:317-350` (get/toggle) | `watchlist-activation/index.ts:164` |

Ön koşul (sprint v1 Tur 5 DUR noktası) yukarıda ölçüldü: sunucu
okuyucularının cron'ları ölü. Kolonlar silinmez (K-44 append-only ruhu);
yalnız kullanım bırakıldı.

Aynı turda kullanımı bırakılan locale anahtarları (silindi, parite korundu):
`notifications.settingsLabel`, `.enabled`, `.disabled`, `.dailyPickLabel`,
`.watchlistRemindersLabel`. Bırakılan AsyncStorage anahtarı **yok**.

### 4. Playfair font yüklemesi + donmuş oyun referansları

Zaten kayıtlı — bkz. yukarıda *"Playfair kalıntıları ve Tur 7 sonrası artık
kod"*. Durum değişmedi: `app/_layout.tsx` 6 ağırlık yüklüyor, tek canlı
tüketici donmuş Detective; kapanış bağımlılık kararı ister (V1-D10).

### 5. Avatar DB senkronu yok

**Öncelik: düşük.**

V1-D8 (`61f9993`) avatar seçimini yalnız AsyncStorage'a, kullanıcı bazlı
anahtarla yazıyor (`utils/avatarStorage.ts:22` `chosy_user_avatar_{publicUserId}`).
Sonuç: aynı hesap başka cihazda / yeniden kurulumda varsayılan avatarla açılır.
Öte yandan `app/setup-profile.tsx` avatarı `users.avatar_url`'e yazıyor
(`:10`, `:56`) — **iki kaynak senkron değil**: Profile modalında yapılan
seçim DB'ye gitmiyor, setup-profile'da yapılan seçim Profile'ın okuduğu
anahtara gitmiyor. Pratikte DB yazımı da yok: `setup-profile`'a kodda
navigasyon yok (`app/auth.tsx:12` TODO), yalnız route kayıtlı
(`app/_layout.tsx:624`). Ayrıca
`avatar_url` UPDATE'i 0 satır etkileyip `{success:true}` dönebiliyor (bkz.
yukarıda `.update()` 0-satır körlüğü). Düzeltme: tek kaynak seçimi (DB +
yerel önbellek) — sözleşme kararı.

### 6. 18:00 yerel kilit ↔ UTC döngü anahtarı (M2 Faz 2b)

**Öncelik: R-D / M2 Faz 2b. Bugün dokunulmuyor.**

İstemci kapısı **yerel** 18:00: `UNLOCK_HOUR = 18`, V1-D9 ile tek tanım
`components/gauntlet/GauntletShell/unlockClock.ts:19` (geri sayım da buradan).
Sunucu gauntlet anahtarı **UTC** tarih: `generate-gauntlet/index.ts:805`
`utcDateString()`. Ölçülen etkiler (UTC− bölgelerinde akşam ortasında anahtar
dönmesi, K-42 önbelleğinin yanlış `cache_stale` uyarısı) bible §9 *"UTC gün
anahtarı ↔ yerel ritüel ayrışması"* satırında. Anahtarı kullanıcı-yerel güne
bağlamadan önce M2 notu geçerli: `users.timezone` 'UTC' sayımı yeniden alınmalı.

**Bayat yol düzeltmesi:** yukarıdaki *"`gauntlet_unlock_hour` app_config'e
taşınmalı"* kaydı sabiti `GauntletShell/index.tsx`'te gösteriyor; V1-D9'dan
beri yeri `unlockClock.ts:19`. Borcun kendisi (release'siz değiştirilemez)
aynen açık.

---

## V-2 build öncesi — expo-doctor yama listesi ve bundle'daki emekli route'lar (28 Eyl 2026)

**Kaynak:** build öncesi salt okunur kontrol (`npx expo-doctor` 1.20.4,
`npx expo export --platform ios`). Kod değişikliği yok; ölçülmüş durum kaydıdır.

### 1. SDK 54 paket sürümleri — bu build'de bilinçli olarak güncellenmedi

**Öncelik: orta. Sonraki native build'den önce kapanmalı.**

`expo-doctor` 18 kontrolden 17'sini geçti. Başarısız olan tek kontrol paket
sürümlerinin SDK ile uyumu. Bu build'de güncellenmedi: build öncesinde
bağımlılık değişikliği yapılmadı.

| Paket | Beklenen | Kurulu | Tür |
|---|---|---|---|
| `@react-navigation/bottom-tabs` | ^7.4.0 | ^7.10.1 | minor (önde) |
| `expo` | ~54.0.37 | 54.0.34 | patch |
| `expo-constants` | ~18.0.14 | 18.0.13 | patch |
| `expo-font` | ~14.0.12 | 14.0.11 | patch |
| `expo-localization` | ~17.0.9 | 17.0.8 | patch |
| `expo-router` | ~6.0.24 | 6.0.23 | patch |
| `expo-updates` | ~29.0.20 | 29.0.17 | patch |
| `@react-navigation/native` | ^7.1.8 | ^7.1.28 | patch (önde) |

**Dikkat:** `expo-updates` ve `expo-localization` native kod taşır. Bunları
güncellemek yeni bir build gerektirir. `runtimeVersion` politikası
`appVersion` olduğu için güncellemeyle birlikte `app.json` `version` de
artırılmalı. Artırılmazsa yeni JS aynı runtime'daki eski binary'ye OTA ile
iner. **Kapanış yolu:** `npx expo install --check` → typecheck, gate'ler,
cihaz testi → yeni build.

### 2. Emekli ve donmuş route'lar hâlâ JS bundle'ına giriyor

**Öncelik: düşük. Donmuş oyunların kaderi kararlaştırıldığında kapanır.**

Expo Router, `app/` altındaki her dosyayı erişilebilir olup olmadığına
bakmadan bundle'a alır (`require.context`). Export edilen iOS bundle'ında
(`entry-53acc398….hbc`, 16.7 MB) aşağıdaki route yolları string olarak
bulundu:

- Donmuş oyunlar: `./games/detective.tsx`, `./games/cinemetrics.tsx`,
  `./games/fadein.tsx`, `./games/imposter.tsx`, `./games/logline.tsx`,
  `./games/quoted.tsx`
- Mood-search / eski akış: `./(tabs)/mood.tsx`, `./discover.tsx`,
  `./roulette.tsx`
- Font: `PlayfairDisplay_900Black`. Bkz. yukarıda *"Playfair kalıntıları"*,
  6 TTF de asset listesinde.

Donmuş oyun kodu CLAUDE.md gereği silinmiyor. Bu yüzden bu kayıt bir
düzeltme talebi değil, bundle boyutu ve başlangıç maliyetini takip etmek
için. Hangi route'un gerçekten erişilemez olduğu (import grafiği ile) bu
kayıtta **ölçülmedi**.

---

## 🟡 `recompute-taste-vector` hiçbir yerden tetiklenmiyor — K-32 güven göstergesi bekliyor (29 Eyl 2026, V-4 Tur C)

V-4 Tur C, Profile'daki Cinema DNA kartına K-32 güven göstergesini
(`Seni %N tanıyorum` + 9 segment, PRODUCT_OS §5.4 / DESIGN_OS §10.4)
eklemeyi hedefliyordu. Kaynak kolon hazır: `cinema_dna.user_confidence`
(074, `0..1`, yorumu "istemcideki gösterge bu kolonu okur"), RLS
`cinema_dna: owner read` (070) açık. **Ama kolonu yazan fonksiyon
çalışmıyor:**

- `recompute-taste-vector` için cron yok, istemci çağrısı yok, başka bir
  Edge Function'dan çağrı yok (repo taraması, 29 Eyl 2026).
- Canlı ölçüm (29 Eyl 2026): `cinema_dna` **1 satır**, `taste_computed_at`
  son değer **2026-08-07**, `user_confidence > 0` olan satır **0**. Aynı
  anda `choice_events` 11 kullanıcıdan 42 `choice` olayı taşıyor.

Gösterge eklenseydi herkes ya hiçbir şey ya da "%0" görecekti — ikisi de
ürün yalanı. **Kurucu kararı (AskUserQuestion): göstergeyi ertele.** Bu
turda yalnız kartın boş alanı (`minHeight: 100` + altın üst kenar) kaldırıldı.

**Kapanış koşulu:** `recompute-taste-vector` bir tetikleyiciye bağlanır
(cron ya da `submit-choice` sonrası), `user_confidence` gerçek kullanıcılarda
`> 0` ölçülür; ardından gösterge `cinema_dna` okumasıyla eklenir (yeni
hesaplama yok, yalnız okuma). Cron eklenirse bkz. yukarıda *pg_cron GUC* ve
hafıza kaydı "iki anahtar kuşağı" (Vault `cron_service_role_key`).

**Aynı turun yan notları:**

1. `isPremium` kaydının (27 Eyl) 4. maddesindeki **"Kalan:
   `app/(tabs)/profile.tsx`"** kapandı — abonelik rozeti `premiumStatus`
   okuyor. `isPremium` Profile'da yalnız bir Sentry `extra` alanında kaldı.
2. *"logger.warn / logger.error production'da no-op"* kaydı (19 Eyl) **eskidi**:
   `utils/logger.ts` bugün `error`'ı prod'da Sentry'ye köprülüyor (`skipBridge`
   ile devre dışı bırakılabilir). Bu turda Kural 2 taraması buna göre yapıldı —
   servis katmanında `logger.error` olan yollara ekranda ikinci
   `Sentry.capture*` eklenmedi (çift event). Profile'daki mevcut üç çift-event
   noktası da kapatıldı (avatar oku/kaydet → `skipBridge`, `clearWatchlist`
   ekran log'u kaldırıldı). `logger.warn` hâlâ prod'da sessiz.
3. `profileService.getLastParsedProfile` hatayı `null`'a indiriyor (yalnız
   `__DEV__` console) — Cinema DNA kartının "henüz profil yok" durumu ile
   "okunamadı" durumu ayırt edilemiyor. Mood-search döneminin kaynağı; K-32
   göstergesi `cinema_dna`'ya geçince kart bu fonksiyondan kopabilir.
4. Yıkıcı eylem rengi: Design OS'ta tehlike token'ı yok. `Colors.error`
   Profile Settings (listeyi temizle, hesabı sil) ve Watchlist (kaldır,
   tümünü temizle) satırlarında **bilinen istisna** olarak kaldı (kurucu
   kararı). Bir `color.feedback.danger` token'ı Design OS kararı ister.
5. TR `profile.watchlistSummaryCount` / `watchlistSummaryEmpty`: "Izleme
   Listesi" — noktasız büyük I (İ olmalı). Metin turu, bu turda değişmedi.

> **Güncelleme (30 Eyl 2026):** CTO kararı — v1'de DNA vaadi yok, kart gizli,
> boru hattı v1.1. Ön koşullar ve son tarih aşağıdaki kayıtta.

---

## 🟡 Cinema DNA boru hattı — v1.1 ön koşulları (30 Eyl 2026)

**Durum:** Profile'daki Cinema DNA bölümü ve okuması `isCinemaDnaEnabled()`
(`constants/config.ts`, şu an `false`) arkasında; kapalıyken `sessions` ve
`watchlist` sorguları atılmıyor. Bileşen (`components/Profile/TasteDNA/`) ve
servis (`services/profileService.ts`) silinmedi. Plus/paywall metinlerinden
DNA / "taste evolves" vaadi çıkarıldı (bible v1.33, K-47). Kanıt: keşif raporu
`docs/investigations/K32_TASTE_VECTOR_KESIF.md` (`cf97732`).

**Son tarih: ilk kohortun 7. akşamı** — v1 mağaza yayın günü + 6. akşam. D-06
yüzdeyi ≥7 tamamlanmış gauntlet'e bağlıyor; en erken o akşam bir kullanıcı
eşiği geçebilir, o ana kadar hat canlı ve geçmiş doldurulmuş olmalı.
⚠️ Mağaza yayın tarihi repoda kayıtlı değil. `app_config.launch_date =
2026-09-18` **editoryal takvim başlangıcıdır**, mağaza yayını değil (ölçüm
30 Eyl: tüm zamanlarda 15 kişisel gauntlet satırı, tamamlanmış gauntlet'i olan
11 kullanıcı, kullanıcı başına en fazla 3). Yayın günü belli olunca tarih buraya
yazılır.

**Ön koşullar (sıra önemli):**

1. **Vault anahtarı.** `cron_service_role_key` "Unregistered API key" (401)
   dönüyor. Ölçüm (29 Eyl 21:xx UTC): 4 aktif cron'un 3'ü bu anahtarı
   kullanıyor (`global-slot-daily`, `weekly-trending-sync`,
   `profile-missing-films`); `cron.job_run_details` bunları `succeeded`
   gösteriyor çünkü yalnız `net.http_post`'un kuyruğa alınmasını ölçüyor.
   `net._http_response` yalnız 1 yanıt tutuyordu: 2026-09-29 00:05,
   `global-slot-daily` saatiyle eşleşen **401**. Diğer iki job'un HTTP sonucu
   saklama süresi dışında — aynı anahtarı kullandıkları için muhtemelen 401,
   **doğrulanmadı**. Son 10 günde `scope='global'` `daily_gauntlets` satırı 0.
   Tetikleyici cron olacaksa bu önce çözülür.
2. **Tetikleyici kararı (CTO).** A cron / B `submit-choice` sonrası / ikisi.
   B, `watch_feedback`'i kapsamaz (`submit-watch-feedback` ayrı). Edge→Edge
   çağrı deseni repoda yok — yeni pattern.
3. **Tek güven tanımı (CTO, kilitli sözleşme).** `generate-gauntlet` tüm
   `choice_events` / 18; `recompute-taste-vector` yalnız `choice` + feedback /
   50. `DailyGauntlet.userConfidence` (`types/gauntlet.ts:70`) birini seçmeli.
4. **Canlı bundle ↔ repo farkı.** Fonksiyon 07.08'de deploy edildi,
   `_shared/gameUtils.ts` 12.08'de değişti; indirip diff alınmadan
   çağrılmamalı (bkz. "deploy durumu bible'dan okunmaz").
5. **Geçmiş doldurma.** Bir kez `full` mod. Yan etki: satırı olmayan her
   kullanıcıya `cinema_dna` satırı açar (~278; dondurulmuş hub `useCinemaDna`
   okur). Atomik değil, tekrar çalıştırılabilir.
6. **Kart veri kaynağı.** `sessions.parsed_profile_json` → `cinema_dna`.
   `getLastParsedProfile` hatayı sessizce `null`'a indiriyor (kural 1) —
   kart ondan koparken düzelir.
7. **D-06 eşiği + metin.** ≥7 tamamlanmış gauntlet sayımı ve *"Your Cinema DNA
   is forming"* için locale key yok (EN/TR).
8. **K-32 anlatı katmanı.** 384 boyutlu `taste_vector` → K-30'un 6 ekseni →
   cümle. Repoda yok; yeni pattern (CTO).
9. **Açılış.** `isCinemaDnaEnabled` `app_config`'e lazy getter olarak taşınır
   (kural 5); K-47 Identity değeri ancak özellik görünür olduğunda geri döner
   (R-16). `contextPaywall.moodHistoryTitle` hâlâ "Unlock Your Mood History"
   (mood-search dili) — kart dönmeden önce metin turu.

**Kapanış koşulu:** 1–8 yapılmış, bayrak açık, D-06 eşiğini geçen gerçek bir
kullanıcıda `cinema_dna.user_confidence > 0` ölçülmüş.

## 🟡 İzlendi tek kaynak (B-1 / Fix 6) — kalan istemci borçları (2 Eki 2026)

Fix 6 ile "izlendi"nin tek kaynağı `watchlist.watched_at` oldu. Aşağıdakiler
bilinçli olarak bu turun dışında bırakıldı.

### 1. Bekleyen izlendi kuyruğu yalnızca soğuk açılışta boşaltılıyor

`toggleWatched` sunucuya yazamazsa işlem `chosy_watched_pending_{authId}`
kuyruğuna girer (`services/watchlist.ts`). Kuyruğu yalnızca `syncWatchedFilms`
boşaltır ve o da yalnızca `INITIAL_SESSION`'da, süreç başına bir kez çalışır
(`app/_layout.tsx`). Uygulama arka planda açık kaldıkça işaret sunucuya geçmez:
Profil "Watched" sayacı (sunucu `count=exact`) bu sürede eksik sayar, gauntlet
aday filtresi (`fetchExclusions`) filmi izlenmiş saymaz. Ekranlar kuyruğu
sunucu durumunun üstüne bindirdiği için liste ve detay doğru görünür.
**Neden şimdi değil:** foreground (AppState `active`) ya da `TOKEN_REFRESHED`
tetiği yeni bir tetik noktası; `processOfflineQueue` ile birlikte ele alınmalı
(K-42 doğrulanmadan `QueuedOperation`'a dokunulmuyor).

### 2. Detaydan izlendi → geri alma, listeye hiç eklenmemiş filmi Saved'e düşürüyor

Watchlist'te olmayan bir film film detayından "izlendi" işaretlenince
`watchlist`'e yeni satır açılır (`watched_source = 'manual'`). Geri alma satırı
silmez, `watched_at` + `watched_source`'u NULL'lar (Fix 6 karar 4) → film,
kullanıcı hiç kaydetmediği hâlde Saved'de belirir. Satırın "izlendi" ile mi
"kaydet" ile mi açıldığı veriden ayırt edilemiyor (`added_from_session` NULL
her iki yolda da). **Neden şimdi değil:** ayırt etmek yeni kolon ya da yeni
`watched_source` anlamı ister — şema kararı (CTO).

### 3. `useFeedManager` izlenen film okumasında boş küme fallback'i

`hooks/useFeedManager.ts` `getWatchedFilmIds().catch(() => new Set<string>())`
ile okuma hatasında boş kümeyle devam ediyor. Servis hatayı Sentry'ye yazdığı
için iz kalıyor, ama feed o oturumda izlenmiş filmleri de önerebilir. Fix 6'dan
sonra `getWatchedFilmIds` sunucudan okuduğu için bu dal artık ağ hatasında da
tetikleniyor (eskiden yalnızca AsyncStorage hatasında). **Neden şimdi değil:**
Fix 6 kapsamı `useFeedManager`'ı içermiyordu; hata dalının ne yapması gerektiği
(feed'i durdurmak mı, uyarı mı) ayrı bir karar.

### 4. Rulet: izlenen kümesi okunamazsa tüm ekran hata kutusuna düşüyor

`app/roulette.tsx:188-191` `getWatchlist()` ile `getWatchedFilmIds()`'i aynı
`Promise.all`'da bekliyor. `getWatchedFilmIds` hata verirse catch (`:221`)
`setLoadFailed(true)` ile hata kutusunu gösteriyor — liste okunmuş olsa bile
rulet kullanılamıyor. Fix 6'dan sonra `getWatchedFilmIds` sunucudan okuduğu
için bu yol artık ağ hatasında da tetikleniyor. **Hedef:** izlenen kümesi
okunamazsa boş küme ile devam et + Sentry (hata servis katmanında zaten
yazılıyor; ekran tarafında ayrı `error_code` ile işaretlenmeli ki boş küme
sessiz fallback olmasın — kural 1). **Neden şimdi değil:** Fix 6 kapsamı
rulet ekranını içermiyordu; kod değişikliği ayrı iş.

---

## 🟡 Profil abonelik rozeti (B-1 / Fix 7) — kalan borçlar (2 Eki 2026)

Fix 7 ile profil rozeti entitlement'tan türetiliyor ("Chosy Pro"), plan
bilgisi alt satırda; "Founding Member" etiketi kaldırıldı.

### 1. Lifetime akışı ölü kod: `app/lifetime.tsx` + `services/lifetimeService.ts`

`/lifetime` route'una C.9c'den beri hiçbir yerden link yok (bible §7.3
lifetime satışını donduruyor). Ekran ve servisi yalnızca birbirini kullanıyor;
`lifetime.tsx:405`'te sabit "FOUNDING MEMBER" metni ve `lifetime.*` locale
anahtarları da bu yolla birlikte ölü. **Neden şimdi değil:** silme kararı
RevenueCat'teki lifetime sahipliği kontrolüne bağlı; Fix 7 bu dosyalara
dokunmadı.

### 2. `getLifetimeOffering` ölü kod

`services/purchaseService.ts` `getLifetimeOffering()` (`lifetime_founding`
offering'i + default'taki `com.chosy.lifetime` fallback'i) yalnızca
`app/lifetime.tsx`'ten çağrılıyor. Madde 1 ile birlikte kaldırılmalı.
Profildeki `tier === 'lifetime'` → "Lifetime" plan satırı dalı **kalır**
(silme kararı RC kontrolüne bağlı).

### 3. `willRenew` context'e taşınmıyor

Profil plan satırı bu yüzden "renews {date}" değil "active until {date}"
diyor: iptal edilmiş ama süresi dolmamış abonelikte "renews" yanlış olurdu.
RC `EntitlementInfo.willRenew` / `unsubscribeDetectedAt` `SubscriptionInfo`'ya
ve `SubscriptionContext`'e taşınırsa satır "renews" / "ends" ayrımı yapabilir.
**Neden şimdi değil:** context sözleşmesine yeni alan — mimari karar (CTO).

### 4. App Store Connect görünen adı kontrolü

Uygulama içi marka "Chosy Pro"ya geçiyor (rozet Fix 7'de; kalan "Chosy Plus"
metinleri ayrı copy-only commit). App Store Connect'teki abonelik grubu /
ürün görünen adları ve RevenueCat paywall metinleri "Chosy Plus" olarak
kalmış olabilir — Apple satın alma sheet'i ve abonelik yönetim sayfası bu
adı gösterir. Kontrol edilmeli (kod dışı).

## 🟡 Film detayı "Neden bu film?" (B-1 / Fix 5) — kalan borçlar (2 Eki 2026)

Fix 5 ile film detayı `film_profiles.dimensions_json`'u okuyup
`explainBatch`'e veriyor; boyut yoksa ya da template eşleşmezse bölüm hiç
render edilmiyor. Hata metni artık kullanıcıya gitmiyor.

### 1. `dimensions_json` şema kayması: `pace` ↔ `pace_preference`

Canlıda 3532 profilin 2560'ı `pace_preference` (+ `social_context`,
`era_preference`, `avoid_signals`, `rewatch_tolerance`, `ending_preference`),
972'si farklı bir anahtar setiyle geliyor (eşleşme adlardan tahmin, doğrulanmadı): `pace`, `social_fit`,
`era_feel`, `rewatch_value`, `ending_tone`, `content_warnings`. İki kümede de
`visual_style`, `emotional_state`, `energy_level`, `thematic_depth`,
`narrative_style`, `cultural_context` ortak. `services/matchExplanation.ts`
template'i geçici olarak `pace_preference ?? pace` okuyor. **Neden şimdi
değil:** normalleştirme veri migration'ı ve tüm `dimensions_json`
okuyucularının (`recommendations.whyFromDimensions`, `dailyMatch`,
explain-match prompt'u) gözden geçirilmesini ister — ayrı karar.

### 2. explain-match çıktısı doğrulanmıyor

`supabase/functions/explain-match` modelin JSON'unu olduğu gibi döndürüyor.
Fix 5 öncesi istemci `filmProfile: null` gönderdiğinde model
"Unable to generate explanation — film profile data is missing" yazıyor,
bu metin başarılı açıklama sayılıp kullanıcıya gösteriliyordu. İstemci artık
null boyut göndermiyor, ama model başka bir nedenle boş / reddetme /
sistem dili içeren bir açıklama üretirse yine gösterilir. Edge Function
tarafında açıklama doğrulaması gerekli: boş, reddetme kalıbı veya sistem
dili → o film için `null` (istemci bölümü gizler). **Neden şimdi değil:**
Fix 5 kapsamı yalnızca istemci; Edge Function deploy'u ayrı tur.

### 3. Model açıklamaları her zaman İngilizce

explain-match prompt'u dil parametresi almıyor; TR kullanıcı model
açıklamasını İngilizce görüyor (template fallback ise i18n'li). Ayrıca
`matchExplanation` in-memory cache'i dil bağımsız — oturum içinde dil
değişirse önbellekteki template metni eski dilde kalır.

---

## 🟡 Spotlight arama alanı yerleşimi (B-1 / Fix 8) — kalan borçlar (2 Eki 2026)

Fix 8 ile Spotlight'ın üst bölgesi kayıyor, aksiyon barı klavyenin üstünde
sabit; `FilmSearchInput` dropdown'ı input üstünde kalan alana göre
kısılıyor; `searchFilms` hataları Sentry'ye gidiyor. Bible: KAPSAM_KILIDI
v1.36. Aşağıdakiler bilinçli olarak kapsam dışı bırakıldı.

### 1. TMDb fallback sonucu `uuid`'siz — Spotlight seçimi hata kutusuna düşüyor (Fix 9)

`gameService.searchFilms` DB'de eşleşme yoksa TMDb'ye düşüyor; bu sonuçlarda
`uuid` yok. Spotlight `handleGuess` `uuid`'siz seçimde `logger.warn` +
genel hata kutusu gösteriyor (`components/games/Spotlight/index.tsx`,
"Film UUID yok"). Kullanıcı listede gördüğü filmi seçip hata alıyor.
**Neden şimdi değil:** sonuç listesinin kaynağı/filtrelenmesi davranış
değişikliği — ayrı iş (Fix 9).

### 2. `FilmSearchInput` debounce yarışı ve unmount temizliği

Yanıtlar sıra dışı gelirse eski sorgunun sonucu yenisinin üstüne yazılıyor
(istek kimliği/iptal yok). Debounce zamanlayıcısı unmount'ta temizlenmiyor;
ekrandan çıktıktan sonra arama çalışıp state yazabiliyor. **Neden şimdi
değil:** arama davranışı, Fix 8 yalnız yerleşim + hata raporlaması.

### 3. Android'de dropdown dokunuşu doğrulanmadı

Dropdown `position:absolute; bottom: input + 4` ile ebeveyninin sınırları
DIŞINA çiziliyor. Android, ebeveyn sınırı dışındaki çocuklara dokunuş
iletmeyebilir. v1 iOS-only (R-15) olduğu için canlı risk değil; Android
açılmadan önce cihazda doğrulanmalı.

### 4. Donmuş 6 oyunun yerleşimi aynı risk sınıfında

FadeIn, CineMetrics, Logline, Quoted, Detective "tek sayfa, ScrollView
yok, sabit medya + altta FilmSearchInput" düzeninde (Imposter arama
kullanmıyor). Uzun başlık
onları etkilemiyor (maske yok), ama küçük ekran + açık klavye + büyük
Dynamic Type'ta arama alanı aynı şekilde itilebilir. Kural 7 istisnası
yalnız Spotlight'a verildi. Fix 8'in ortak bileşen değişikliği (dropdown
yüksekliği) bu oyunlara da uygulanıyor; bol alanda eski 280 sınırı aynen
geçerli. **Neden şimdi değil:** oyunlar `app_config` ile kapalı; açılırlarsa
her biri ayrı yerleşim turu ister.

### 5. `searchFilmsDb` RPC hatası kısılmadan raporlanıyor

`services/searchFilms.ts` RPC hatasında her çağrıda `logger.error`
(→ Sentry) yazıyor; arama her 300 ms debounce'ta çalıştığı için DB kesintisinde
event seli üretebilir. Fix 8'in 60 sn / tür kısması yalnız
`gameService.searchFilms`'in kendi catch'ine uygulandı. **Neden şimdi değil:**
`searchFilmsDb` başka çağıranlarca da kullanılıyor; kısma kararı ortak.
