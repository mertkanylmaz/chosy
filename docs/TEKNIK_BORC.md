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

### `supabase/functions` — 45 hata

`npm run typecheck:functions` (Deno 2.9.4, `deno check **/index.ts`).

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
çıkarıyordu.

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
| `npm run typecheck:functions` | **45** — düşüş hedefli değil, regresyon bekçisi | ✅ |

`typecheck` 14'ü aşarsa veya `scripts/` dışında hata çıkarsa **dur**.
Sıfır hedefi bu sprintte yok.

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

## claim_device_data — cihaz provenance'i korunmuyor

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
