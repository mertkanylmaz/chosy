# K-37 — Gauntlet Backend State Machine

> **Statü:** Keşif belgesi. Kod, migration veya kolon değişikliği İÇERMEZ.
> **Model:** Seçenek 1 — *türetme*. Yeni `generation_status` kolonu açılmaz;
> durum mevcut satırlardan deterministik türetilir.
> **Bible:** D-13 (27.08.2026) — K-37'nin 9 durumlu tanımı bu belgeye göre güncellendi.
> **Tarih:** 27 Ağustos 2026 · **Kaynak kod:** `generate-gauntlet` (C.2-0),
> `submit-choice` (B.4), `submit-watch-feedback` (C.4), `GauntletShell` (C.2-2)

Bu belge iki ayrı şeyi anlatır ve **karıştırmaz**:

- **§2 Hedef model** — bible'daki (K-37 / SONHALİ §69) idealize 9 durumlu diyagram.
- **§3-4 Gerçek durum** — kodda fiilen ne var.

Bible'ın 9 durumu **hiç implement edilmedi**. Bu, M1 Faz 2 şema doğrulamasında
zaten tespit edilmiş ve `supabase/migrations/092_v_algorithm_daily.sql` başlığına
not düşülmüştür:

> `generation_status` kolonu şemada YOK — K-37'nin backend state machine'i
> hiç implement edilmemiş. Bu view `champion_film_id IS NOT NULL` sinyalini
> "tamamlandı" için VEKİL olarak kullanır.

Kodda bunun yerine, `types/gauntlet.ts`'te kilitli olan **3 değerli
`GauntletProgress.status`** + `completedRounds` (0-3) çifti vardır.

---

## 1. Türetmenin girdileri

Durum hiçbir yerde saklanmaz; her istekte üç tablodan yeniden hesaplanır.

| Tablo | Kolon | Rol |
|---|---|---|
| `daily_gauntlets` | `id` | `choice_events.gauntlet_id`'nin işaret ettiği anahtar (FK kısıtı **yok**, 092 notu) |
| | `film_ids UUID[4]` | Pozisyonel slot dizisi — türetmenin omurgası |
| | `champion_film_id` | Yalnızca **doğrulama** için okunur; `completedRounds`'un kaynağı değil |
| | `date`, `user_id`, `scope` | Gün + sahiplik anahtarı (`scope='personal'`) |
| `choice_events` | `round`, `outcome`, `winner`, `film_a`, `film_b` | `outcome IN ('choice','timeout')` filtresiyle — **tek gerçek ilerleme kaynağı** |
| `watch_feedback` | `gauntlet_id` (varlık), `response`, `asked_at`, `answered_at` | Gauntlet'ten SONRAKİ akış |
| `watchlist` | `watched_at`, `watched_source` | Yazılır, duruma **girdi değildir** |

`neither` ve `seen` olayları türetmeye **hiç girmez** (`.in('outcome',
['choice','timeout'])`). Tur harcamazlar; 072'nin partial UNIQUE index'i de
onları kısıt dışında bırakır.

### `deriveProgress` algoritması

`supabase/functions/generate-gauntlet/index.ts:432`

1. Gauntlet'in ilerleten olaylarını `round` artan sırada çek.
2. `completedRounds = events.length`.
3. **Guard:** `completedRounds > 3` → throw. Tur dizisi 1..n bitişik değilse → throw.
4. Savunan slotunu (`dIdx`, 0'dan başlar) olaylar üzerinde yürüterek bul:
   - `timeout` olayı atlanır (`continue`) — dIdx **değişmez**.
   - `outcome='choice'` ama `winner` null → throw.
   - Kaybeden `film_ids[round]`'daysa → kazanan savunandı, `dIdx` sabit.
   - Kaybeden `film_ids[dIdx]`'deyse → `dIdx = round`.
   - İkisi de değilse → throw.
5. `completedRounds === 3` ise:
   - son olay `timeout` → `exhausted` / `timeout_no_winner`
   - `champion_film_id` null **veya** son kazananla eşleşmiyor → throw
   - şampiyon `film_ids` dışında → throw
   - aksi halde → `champion`
6. Aksi halde → `in_progress`, `defender = films[dIdx]`,
   `challenger = films[completedRounds + 1]`.

Kazananın konumu **kaybedenin** konumundan bulunur: kaybeden elendikten sonra
bir daha değiştirilmez, kazanan ise sonraki turda `seen` ile değişmiş olabilir —
bu yüzden `indexOf(winner)` güvenilmezdir.

Çıktı `assertProgressInvariant()` ile doğrulanır; ihlal **throw** eder,
sessizce düzeltilmez.

### Gerçek durum uzayı

`status` 3 değer alır, `completedRounds` 0-3. Fiilen ayırt edilebilir **5** konum:

```
in_progress(0) → in_progress(1) → in_progress(2) ─┬─→ champion
                                                  └─→ exhausted
```

`in_progress(3)` mümkün değildir: 3. tur kapandığı anda `champion` ya da
`exhausted`'a düşer.

---

## 2. Hedef model (bible — SONHALİ §69)

`docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md:114`:

```
GENERATING → READY → STARTED → ROUND_1 → ROUND_2 → FINAL → COMPLETED
           → WATCH_PENDING → WATCHED
```

Bu liste bir **tahminden** yazılmıştır ve kodda karşılığı yoktur. Aşağıdaki
eşleme, bibleın adlarını gerçeğe zorlamak için değil, **farkı görünür kılmak**
için yapılmıştır.

---

## 3. Gerçek durum — 9 bible durumunun kod karşılığı

| # | Bible durumu | Gerçek kolon koşulu | Verdikt |
|---|---|---|---|
| 1 | `GENERATING` | **Karşılığı yok.** Üretim `generate-gauntlet` isteğinin İÇİNDE senkron çalışır; satır INSERT başarılı olana kadar hiç var olmaz. Yarım kalan üretim iz bırakmaz. | **SAPMA — durum yok** |
| 2 | `READY` | `daily_gauntlets` satırı var **AND** 0 ilerleten olay → `{completedRounds:0, status:'in_progress'}` | Kısmî — ayrı ad yok |
| 3 | `STARTED` | **READY ile birebir aynı.** "Üretildi" ile "kullanıcı açtı" arasında hiçbir kolon ayrım yapmaz. | **SAPMA — READY ile ayrışmıyor** |
| 4 | `ROUND_1` | `completedRounds === 1` → `in_progress` | Eşleşiyor (ad farkı) |
| 5 | `ROUND_2` | `completedRounds === 2` → `in_progress` | Eşleşiyor (ad farkı) |
| 6 | `FINAL` | **ROUND_2 ile aynı koşul.** "3. tur oynanıyor" = `completedRounds === 2`. Ayrı bir temsili yok. | **SAPMA — ROUND_2 ile aynı** |
| 7 | `COMPLETED` | `completedRounds === 3` **AND** son olay `outcome='choice'` **AND** `champion_film_id = son kazanan` → `status:'champion'` | Eşleşiyor |
| 8 | `WATCH_PENDING` | Bu gauntlet'in durumu **değil**. Çapraz satır türetmesi: `date < bugün` **AND** `champion_film_id IS NOT NULL` **AND** o `gauntlet_id` için `watch_feedback` satırı yok. Yanıtta ayrı alan (`pendingWatchFeedback`), farklı `gauntletId` taşır. | **SAPMA — başka gauntlet'e ait** |
| 9 | `WATCHED` | Gauntlet'te değil: `watch_feedback.response ∈ (loved, ok, abandoned)` + `watchlist.watched_at` (yalnız NULL ise yazılır). `not_watched` ve `skipped` watchlist'e dokunmaz. | **SAPMA — gauntlet tablosunda değil** |

### Bible'da adı olmayan gerçek durum

| Gerçek durum | Koşul | Not |
|---|---|---|
| `exhausted` / `timeout_no_winner` | `completedRounds === 3` **AND** son olay `outcome='timeout'` | Şampiyon **uydurulmaz** (`advanceFrom`, submit-choice:447) |
| `exhausted` / `no_candidates` | Yenilemede aday havuzu boş | **DB'ye yazılmaz** — bkz. §5 R2 |

**Özet:** 9 bible durumundan 3'ü birebir eşleşiyor (ROUND_1, ROUND_2,
COMPLETED), 2'si komşusundan ayrışmıyor (STARTED, FINAL), 1'inin hiç temsili
yok (GENERATING), 2'si başka tablonun konusu (WATCH_PENDING, WATCHED),
1'i ad farkıyla var (READY). Buna karşılık bible'da olmayan `exhausted`
gerçekte iki gerekçeyle mevcut.

---

## 4. Client ↔ backend haritalaması

> ⚠️ **Görev metnindeki K-08 referansı yanlış.** Client-side state enum
> **K-03**'ün konusudur (SONHALİ §68). K-08 profil bölüm sırasıdır
> (`Cinema DNA → Streak → Watched → Saved → Pro → Settings`, SONHALİ §57) ve
> state machine ile ilgisi yoktur. Ayrıca bible'daki enum `waiting · ready ·
> in_progress · completed · watch_feedback · error_recovery`'dir —
> `pre_generated` diye bir durum ne bible'da ne kodda vardır.

K-03'ün gerçekle uzlaştırılması **zaten yapılmıştır**:
`docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` **D-12** (C.9b, 19.08.2026, Seçenek A —
"GauntletShell'e dokunulmaz, bible gerçeğe uyar"). Bu belge o kararı tekrar
etmez, yalnızca backend türetmesiyle bağlar.

```ts
// components/gauntlet/GauntletShell/index.tsx:143
type ShellState = 'before_18' | 'bootstrapping' | 'ready' | 'in_progress' | 'completed_today';
```

| Backend (`GauntletProgress`) | ShellState | Nereden okunur |
|---|---|---|
| — (18:00 öncesi, istek hiç atılmaz) | `before_18` | Yalnız istemci saati. Backend'in bu kapıdan haberi **yok** |
| — (istek uçuşta / 401 penceresi) | `bootstrapping` | Ağ durumu |
| `in_progress` && `completedRounds === 0` | `ready` | `p.status`, `p.completedRounds` |
| `progress === undefined` (eski istemci yolu) | `ready` | Tur 1'den başlar |
| `in_progress` && `completedRounds > 0` | `in_progress` | `setRound(completedRounds + 1)` |
| `champion` | `completed_today` | `p.champion` (boşsa Sentry + `loadError`) |
| `exhausted` | `completed_today` | `toExhausted()` |
| `pendingWatchFeedback` alanı dolu | *(enum dışı)* | Erken dönüş, enum kontrolünün **önünde** |
| hata | *(enum dışı)* | `loadError` / `actionError`, bulunulan durumun içinde |

### "Client asla progress türetmez" ilkesi — **teyit edildi**

- `services/gauntletService.ts:5-6` — "`progress` alanı SUNUCUDAN gelir
  (C.2-0 deriveProgress); istemci progress TÜRETMEZ, yalnızca gösterir."
- `GauntletShell/index.tsx:11` — aynı kural bileşen başlığında tekrarlanır.
- Kodda doğrulandı: `GauntletShell:265-320` yalnızca `p.status` ve
  `p.completedRounds` okur. `choice_events`'e istemciden hiç sorgu yoktur;
  `completedRounds` yeniden hesaplanmaz.
- İhlal olduğunda **sessizce düzeltmez**: invariant bozuksa
  (`champion` ama `champion` boş / `in_progress` ama defender boş)
  `Sentry.captureException` + `loadError` — uydurma değer üretmez.

**Tek nüans:** canlı oyun sırasında istemci `submit-choice`'ın döndürdüğü
`result.next` (`round2`/`round3`/`champion`) ile ileri gider; her turda
`generate-gauntlet`'i yeniden çağırmaz. Bu **türetme değil**, sunucunun verdiği
kararın uygulanmasıdır. Yeniden yüklemede durum yine sunucudan gelir. İlkeyle
çelişmiyor, ama istemcinin `round` state'i ile DB arasında geçici bir
pencere olduğu anlamına gelir (bkz. §5 R1).

---

## 5. Ara durum riskleri

Sessizce başarısız olabilecek veya tanımsız kalan durumlar. Hiçbiri bu turda
düzeltilmedi — CTO kararı için listelenmiştir.

### R1 — Yazma atomik değil: 3. tur kaydedildi, şampiyon yazılamadı 🟠

`submit-choice` iki ayrı yazma yapar, **tek transaction değil**:

- `:773` → `choice_events` INSERT
- `:855` → `daily_gauntlets.champion_film_id` UPDATE

İkisi arasında hata olursa: 3 ilerleten olay var, sonuncusu `outcome='choice'`,
`champion_film_id` NULL. `deriveProgress` bu durumda **throw eder**:

```
progress türetimi: champion_film_id (null) 3. tur kazananıyla (…) uyuşmuyor
```

Sonuç: `generate-gauntlet` o kullanıcı + o gün için **her çağrıda 500 döner**.
Kullanıcı günü bir daha açamaz; durum **kendini onarmaz**, manuel müdahale
gerekir. Sessiz değil (Sentry'ye düşer) ama **kalıcı kilit**.

**Canlı ölçüm (27 Ağu 2026): 0 satır.** 8 personal gauntlet'in hepsi tutarlı;
yarış hiç ateşlenmemiş. Bu hacimde beklenen sonuç — risk gerçek, ama
"canlıda yangın var" değil. Düzeltme önleyicidir.

*Not:* Bu, "sessiz fallback yasak" kuralının doğru uygulanmasının yan etkisidir —
throw etmek yerine sessizce `in_progress` dönmek daha kötü olurdu. Çözüm
kolon eklemek değil, iki yazmayı tek RPC'de birleştirmek olabilir; **karar CTO'nun**.

### R2 — `no_candidates` exhaustion kalıcı değil 🟠

`submit-choice:952` yenilemede aday bulunamazsa `exhausted` /
`no_candidates` döner, Sentry'ye yazar — ama **DB'ye hiçbir iz bırakmaz**.
`deriveProgress` yorumunda bu açıkça kabul edilmiştir:

> "submit-choice'ın kalıcı iz bırakmayan `no_candidates` exhaustion'ı buraya
> YANSITILMAZ — yalnız DB'ye yazılmış duruma göre türetilir."

Sonuç: istemci `completed_today` (exhausted) gösterir; kullanıcı uygulamayı
yeniden açtığında sunucu **`in_progress`** der ve tur kaldığı yerden devam eder.
Kullanıcıya görünür tutarsızlık.

### R3 — `champion_film_id` dolu ama olaylar eksik → sessizce turda görünür 🟠

**Canlı ölçüm (27 Ağu 2026): 0 satır.**

`champion_film_id` **yalnızca** `completedRounds === 3` dalında okunur.
`choice_events` satırları eksikse (silinmiş, hiç yazılamamış) `completedRounds < 3`
olur ve dolu `champion_film_id` **sessizce yok sayılır** — gauntlet `in_progress`
döner. R1'in aynası, ama bu yönde throw yok: sessiz.

### R4 — `pendingWatchFeedback` kapsam kaybı 🟡

`findPendingWatchFeedbackCandidate` (`:317`):
- `.limit(30)` → 30 günden eski cevaplanmamış şampiyonlar **hiç sorulmaz**.
- `rows.find(...)` → aynı anda birden fazla pending varsa yalnız **en yenisi**
  sorulur; eskiler sıraya girmez, sessizce düşer.

Veri kaybı değil, **sinyal kaybı**: `watch_feedback` `cinema_dna`'nın iki
kaynağından biri (K-40).

### R5 — `generation_status` yokluğu metriği çarpıtıyor 🟡

`092_v_algorithm_daily` "tamamlandı"yı `champion_film_id IS NOT NULL` vekiliyle
sayar. Bu vekil `exhausted` biten gauntlet'leri (timeout ya da aday tükenmesi)
**tamamlanmamış** sayar. Başarısız üretimin ise hiç izi olmadığı için
"kaç gauntlet üretilemedi" sorusu **cevaplanamaz**. K-38'in "6 ay sonra neden
bu 4 film?" gereksinimi bu tarafta karşılanmıyor.

### R6 — Pozisyonel varsayımın kırılganlığı 🟡

Türetme tamamen `film_ids` indekslerine dayanır ve şu konvansiyona güvenir:
*submit-choice DAL 2 yenilemede filmi AYNI index'e yazar.* Bu bugün doğrudur
(`:986` `film_ids` güncellemesi indeksi korur) ama **derleyici veya DB kısıtı
tarafından zorlanmıyor** — yalnız iki dosyadaki yorumlar tutuyor. Bozulursa
`deriveProgress` throw eder (sessiz bozulma yok), yani R1'e benzer kalıcı kilit
üretir.

### R7 — `scope='anonim'` ölü şema (üretim hatası DEĞİL) 🟢

> ⚠️ **Bu madde 27 Ağu 2026'da ölçümle düzeltildi.** İlk yazımda "anonim
> kullanıcılar için türetme yolu yok" denmişti; bu **yanlıştı**, çünkü
> "anonim kullanıcı" ile `scope='anonim'` karıştırılmıştı.

`daily_gauntlets.scope` şemada `global | personal | anonim` kabul eder ve
`generate-gauntlet` yalnızca `.eq('scope','personal')` sorgular. Ama bu bir
kullanıcı yolculuğunu kırmıyor:

Supabase **anonim oturumu** (`signInAnonymously()`, `app/_layout.tsx:351`)
reddedilmez — `_shared/auth.ts:19-24` bunu açıkça yazar: *"Reddedilen şey
'anonim kullanıcı' değil, KİMLİKSİZ istek."* Anonim oturumun imzalı token'ı
vardır → `auth.users` satırı → `ensureAppUser()` köprüsü → `public.users`
satırı → `scope='personal'` gauntlet. Şemadaki `anonim`+`device_id` yolu
(köprüsüz cihaz) bambaşka bir tasarımdır ve **hiç kullanılmamıştır**.

Canlı ölçüm (27 Ağu 2026):

| Ölçüm | Değer |
|---|---|
| `daily_gauntlets` `scope='anonim'` | **0** (hiç yazılmamış) |
| `scope='personal'` | 8 |
| `scope='global'` | 21 |
| Sahibi **anonim oturum** olan personal gauntlet | **8** |
| Sahibi kimlikli (e-postalı) olan | **0** |
| Farklı anonim oyuncu / şampiyona ulaşan | 6 / 7 |
| `auth.users` anonim / e-postalı | 190 / 65 |

**Bugüne kadarki her gauntlet anonim bir kullanıcı tarafından oynanmıştır** —
anonim akış, çalışan tek akıştır. R7 bir üretim hatası değil, kullanılmayan
bir enum değeri + ölü `device_id` kolonudur.

**Ama bu keşifte gerçek bir risk çıktı:** `resolveAppUser`
(`_shared/gameUtils.ts:100`) `public.users` satırı bulamazsa `AuthError`
fırlatır → **401**. 27 Ağu ölçümünde **6 öksüz `auth.users`** var (köprüsü
yok, hepsi anonim, 8-13 günlük, `last_sign_in_at ≈ created_at`). En yenisi
19 Ağu — yani 17 Ağu'daki orphan runner fix'inden SONRA doğmuş. Bu kayıtlar
gauntlet alamaz. K-37 kapsamı dışı; `docs/TEKNIK_BORC.md`'ye ayrı kalem
olarak yazıldı (K-42 öncesi gözden geçirilecek).

---
## 6. CTO'ya karar için özet

| # | Konu | Seçenek |
|---|---|---|
| R1 | 3. tur + şampiyon yazımı atomik değil, kalıcı 500 kilidi (**canlıda 0 vaka**) | (a) İki yazmayı tek RPC/transaction'a al · (b) `deriveProgress`'e onarım dalı ekle (kural 1'e aykırı) · (c) Kabul et, runbook yaz |
| R2 | `no_candidates` kalıcı değil | (a) `choice_events`'e iz yazan bir outcome ekle (069 CHECK + kilitli sözleşme değişir) · (b) Kabul et, belgele |
| R3 | Eksik olay + dolu şampiyon sessiz | (a) `completedRounds < 3` iken `champion_film_id` doluysa uyar/throw · (b) Kabul et |
| R4 | pendingWatchFeedback limit(30) + tek aday | (a) Kuyruk mantığı · (b) Kabul et |
| R5 | `generation_status` yok, metrik vekili yanlı | (a) Seçenek 2'ye geç (kolon aç — bu turun kapsamı dışı) · (b) 092 view'ını `exhausted`ı da sayacak şekilde düzelt · (c) Kabul et |
| R7 | `anonim` scope ölü şema — **üretim hatası değil** (ölçüldü) | (a) Belgelendi, kapandı · (b) Şemadan kaldırma ayrı kalem |
| **yeni** | 6 öksüz `auth.users` gauntlet alamıyor (401) | TEKNIK_BORC'a yazıldı — K-42 öncesi |

**Bible bakımı — YAPILDI.** `7_CHOSY_V1_KAPSAM_KILIDI.md`'ye **D-13** eklendi
(27.08.2026, Seçenek A — *"kod korunur, bible gerçeğe uyar"*, D-12 emsali).
K-37 satırına da D-12'deki gibi ⚠️ uyarısı düşüldü. `generation_status`
kolonu açılmadı.

---

## 7. Referanslar

| Konu | Yer |
|---|---|
| Kilitli sözleşme | `types/gauntlet.ts` — `GauntletProgress`, `DailyGauntlet` |
| Türetme | `supabase/functions/generate-gauntlet/index.ts:432` (`deriveProgress`), `:377` (invariant) |
| Yazma | `supabase/functions/submit-choice/index.ts:773` (olay), `:855` (şampiyon), `:447` (`advanceFrom`) |
| Watch feedback | `supabase/functions/submit-watch-feedback/index.ts` · migration 086 (`skipped`) |
| Şema | migration 069 (`daily_gauntlets`, `choice_events`, `watch_feedback`) · 072 (partial UNIQUE idempotency) |
| Metrik vekili | migration 092 başlık notu |
| Client | `components/gauntlet/GauntletShell/index.tsx:143` · `services/gauntletService.ts` |
| Bible | `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` — K-03, K-37, K-38, K-40, **D-12** |
| Önceki tespit | `docs/05_SPRINTS/ARCHIVE/M1_OLCUM_ONCE.md` DUR NOKTASI #2 (18 Ağu 2026) |
