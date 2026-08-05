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
