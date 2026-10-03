# P-1c Adım 0 — cron secret, global slot, idempotency, ask, ham path önizlemesi

**Temel:** master @ 3d8cceb · **Tarih:** 3 Eki 2026 · **Mod:** READ-ONLY
(yazma/deploy yok). Anahtar değerleri okunmadı/yazdırılmadı; yalnız uzunluk ve
HTTP durumu.

---

## Yönetici özeti

1. **Vault anahtarını kullanan 4 aktif job'un üçü 31 Ağu'dan beri iş
   üretmiyor**, dördüncüsü (Spotlight) hiç koşmadı. `job_run_details` her
   koşumu `succeeded` yazıyor — kanıt değil. Çıktı tarafı: global slot son
   satır **08-31 00:05**, sync-trending son film **08-31 06:00**; sonrasında 0.
2. **Global slot yokluğu kullanıcının günlük gauntlet'ini etkilemiyor** —
   `generate-gauntlet` `scope='global'` satırını hiç okumuyor (yalnız etiket).
   **Degrade olan: arşiv** (`get-archive-status`) — 09-01'den sonraki kaçırılan
   günler `unavailable`.
3. **`generate-puzzles` idempotent:** tekrar koşum çift kayıt üretmez
   (`missingDates` + `UNIQUE(date, game_type)` + 23505 → atla). Elle yol:
   `POST …/generate-puzzles?game=spotlight`, Bearer = runtime secret key.
4. **NO_PUZZLE gününde champion ask'i HİÇ çıkmıyor ve her denemede Sentry'ye
   `fatal` yazılıyor.** Dwell yolu `resolveAsk` içinde
   `getDailyChallenge('spotlight')`'ı çağırıyor; 404 throw ediyor → catch →
   `fatal` + `null`. Spotlight dönüş yolu da aynı. Kuyruk 10-13'te biterse
   10-14'ten itibaren auth/bildirim ask'i tamamen durur.
5. **33 filmin 66 URL'i (poster + backdrop) `…/t/p/original<path>` biçiminde
   HEAD 200.** B migration'ı için hepsi uygun.

---

## 1. Vault anahtarını kullanan job'lar

`cron.job` içinde `cron_service_role_key` geçen 8 job; **aktif 4**:

| jobid | jobname | schedule (UTC) | function | `job_run_details` (son 20) | Gerçek çıktı (kanıt) | Durum |
|---|---|---|---|---|---|---|
| 6 | `weekly-trending-sync` | `0 6 * * 1` | `sync-trending` | 13 koşum, hepsi `succeeded` (son 09-28) | `films` yeni satır: son **08-31 06:00:06–07** (15 film); 09-07/14/21/28 koşumlarında **0** | 31 Ağu'dan sonra ölü |
| 7 | `global-slot-daily` | `5 0 * * *` | `generate-global-slot` | son 20 `succeeded` (son 10-03 00:05) | `daily_gauntlets scope='global'` son **08-31**; 09-01..10-03 **0**. `net._http_response` 10-03 00:05 → **401** `Invalid API key` | 09-01'den beri ölü |
| 18 | `profile-missing-films` | `0 8 * * 1` | `profile-missing-films` | 7 koşum, `succeeded` | Profili eksik arşiv-dışı film **0** → iş yok; 401 alıp almadığı çıktıdan **ayırt edilemiyor** | Belirsiz (zararsız) |
| 19 | `generate-puzzles-spotlight` | `0 2 * * 1` | `generate-puzzles?game=spotlight` | **0 koşum** | — | İlk koşum 5 Eki 02:00 |

Pasif 4 job (1 posterle, 3 send-daily-pick, 4/5 watchlist-activation) Ağu
başından beri `active=false`.

- `net._http_response` ~24 saat tutuyor (`docs/TEKNIK_BORC.md:1331`); şu an
  **1 satır** var (10-03 00:05, 401). "Son 20 çalışmanın HTTP durumu" bu
  nedenle **ölçülemez**; 401 başlangıcı çıktı tarafından çıkarıldı.
- Vault: `length(decrypted_secret) = 13`, `sb_secret_` önekli, `updated_at =
  2026-10-01 06:23:22 UTC`. `.env` `SUPABASE_SECRET_KEY` uzunluğu 41.
- 29 Eyl ölçümünde mesaj "Unregistered API key", bugün "Invalid API key"
  (`TEKNIK_BORC.md:2905-2913`).
- **Ne zamandan beri 401:** global slot için 09-01 00:05'ten (08-31 satırı var,
  09-01 yok), sync-trending için 09-07 06:00'dan (08-31 koşumu film ekledi).
  Aralık **08-31 06:00 → 09-01 00:05**. Hafıza notu "31 Ağu'dan beri kayıtsız"
  ile tutarlı. 10-01 06:23 güncellemesi durumu düzeltmedi.
- **Doğrulanamadı:** `.env` anahtarının bugün hâlâ kapıyı açtığı. README'nin
  yan etkisiz testi (`?force=1` → 400 `FORCE_WITHOUT_DATE`) bu oturumda izin
  sistemi tarafından engellendi — kurucunun koşması gerekir (aşağıda).

## 2. Global slot ve kullanıcı gauntlet'i

```sql
select scope, date, count(*) from daily_gauntlets
where date between '2026-08-28' and '2026-10-03' and scope='global' group by 1,2;
```
→ 08-28, 08-29, 08-30, 08-31 birer satır; **10-01..10-03 dahil 09-01'den beri 0**.

**Kullanıcı yolu:** `generate-gauntlet` global satırı **okumuyor**
(`supabase/functions/generate-gauntlet/index.ts:285-289`: "Üretici hazır,
tüketici değil"). Dört film kişisel boru hattından (ilk 100 gün editoryal
takvimden) gelir; `global` yalnız slot etiketi (`:295-297`). "On-demand
fallback" diye bir yol yok — gerek de yok. **Günlük gauntlet etkilenmiyor.**

**Global satırı okuyan yerler:**

| Okuyan | Etki | dosya:satır |
|---|---|---|
| `get-archive-status` → `fetchGlobalSelections` | Kaçırılan günün içeriği o günün global satırı. Satır yoksa gün `unavailable` — açık dal, sessiz değil. **09-01'den sonraki her kaçırılan gün arşivde boş.** | `get-archive-status/index.ts:37-43, 202-234, 297` |
| `gauntletCore` global dışlama kümesi | Son 21 günün global filmleri dışlanır; satır yok → dışlama boş. Yalnız `generate-global-slot`'u etkiler. | `_shared/gauntletCore.ts:462-482` |

Sonuç: **degrade = arşiv özelliği**, ritüel değil.

## 3. `generate-puzzles` idempotency ve elle çalıştırma

| Durum | Davranış | dosya:satır |
|---|---|---|
| Normal koşum | `missingDates` önümüzdeki 14 günden yalnız **satırı olmayanları** döner | `generate-puzzles/index.ts:131-149` |
| Aynı tarihe insert yarışı | `UNIQUE(date, game_type)` (`daily_puzzles_date_game_type_key`, canlıda var) → 23505 → `return true` ("zaten var") | `:1557-1560` |
| Acil havuz | Sayıma göre `15 − mevcut` kadar ekler; tekrar koşum fazlasını eklemez | `:1576-1585` |
| `?date=X&force=1&game=Y` | Yalnız bu modda `upsert(onConflict: date,game_type)` — üzerine yazar | `:1548-1556, 1741-1773` |
| `force=1` tarihsiz / oyunsuz | 400 — auth'tan sonra, DB'den önce | `:1759-1770` |

**Sonuç:** idempotent; çift kayıt yok, hata yok (23505 yutulmuyor, "var" sayılıyor).

**Elle çalıştırma** (`supabase/functions/generate-puzzles/README.md:78-92`):
`POST https://<ref>.supabase.co/functions/v1/generate-puzzles?game=spotlight`,
`Authorization: Bearer <runtime secret key>`, gövde `{}`. Anahtar seçimi
README `:23-70`: "kapıya sorarak seç" — `?force=1` (tarihsiz) → **400
`FORCE_WITHOUT_DATE`** dönen anahtar doğrudur; yan etkisiz. Spotlight Claude
çağırmaz (migration 120 `:14-18`), maliyet yok. 30 Eyl elle koşumu 77,5 sn
sürdü.

## 4. `useChampionAsk` — Spotlight kartı yokken / NO_PUZZLE'da

Kaynak: `components/gauntlet/GauntletShell/useChampionAsk.ts`,
`services/askCoordinator.ts`, `utils/askDecision.ts`.

**Bugünkü davranış (kart mount, NO_PUZZLE — kuyruk biterse 10-14+):**

| Tetik | Akış | Sonuç |
|---|---|---|
| **dwell** | Kart nötr durumda mount → `onCardLayout` ölçü verir → 8 sn → `fire('dwell')` → `resolveAsk` → `readSpotlightState(today)` → `getDailyChallenge('spotlight')` **404 throw** (`askCoordinator.ts:59-62, 105-106`) | catch → `Sentry.captureException(level:'fatal', ASK_RESOLVE_FAILED)` + `null` (`:129-135`). **Ask yok.** `resolvedThisFocusRef=true` → bu odakta tekrar denenmez. |
| **spotlight_return** | Karta bas → oyun ekranı (genel hata) → geri → `readSpotlightStateForAsk` → aynı 404 | catch → `fatal` `ASK_SPOTLIGHT_STATE_FAILED` + `null` (`:139-152`) → `state !== 'completed'` → **ask yok** (`useChampionAsk.ts:166-170`) |

Ek gürültü: her deneme `gameApi.getDailyChallenge` içinde ayrıca
`captureException` (`services/gameApi.ts:148-153`). Champion'a her giriş ≥2
Sentry olayı (biri `fatal`).

**E uygulanırsa (NO_PUZZLE'da kart mount edilmez):**
- dwell: `onCardLayout` hiç çağrılmaz → `cardHeight = 0` →
  `isCardFullyVisible` false (`askDecision.ts:168-169`) → zamanlayıcı kurulmaz.
  **Ask hiç çıkmaz** — ama fatal gürültü de kesilir.
- spotlight_return: karta basılamaz → tetik oluşmaz.
- ⚠️ Aynı oturumda kart önce mount edilip sonra kaldırılırsa `metricsRef`
  eski `cardY/cardHeight`'ta kalır (bilinen borç, `TEKNIK_BORC.md` S-2 §3) →
  dwell görünmeyen kart için kurulabilir; `resolveAsk` yine 404'e çarpar.

**Sonuç:** NO_PUZZLE gününde ask (auth dönüşümü + bildirim izni) **her iki
durumda da çıkmıyor**. Bugün kuyruk dolu olduğu için etki yok; 10-14'ten
itibaren olur. DUR 3 önerisi için girdi: ask kararının Spotlight durumunu
okuyamadığında "yok" yerine "not_started/unknown" sayması ya da karttan
bağımsız bir tetik — **uygulanmadı**.

## 5. 33 film — ham path → tam URL önizlemesi (yazma yok)

Dönüşüm: `https://image.tmdb.org/t/p/original` + `path` (mevcut 2.579 tam-URL
satırının biçimi). Her URL için `HEAD`:

- Poster: **33/33 → 200**
- Backdrop: **33/33 → 200**

Sıra editoryal kuyruk sırası (`position ASC, day_number DESC`).

| # | id | title | poster: ham → tam | HEAD | backdrop: ham → tam | HEAD |
|---|---|---|---|---|---|---|
| 1 | `ddf32d20-9c85-4f78-98db-ca0cfb417d8d` | Ocean's Eleven | `/hQQCdZrsHtZyR6NbKH2YyCqd2fR.jpg` → `https://image.tmdb.org/t/p/original/hQQCdZrsHtZyR6NbKH2YyCqd2fR.jpg` | 200 | `/ncoqdHs1poUaBqyKic9YI8ai7MP.jpg` → `…/original/ncoqdHs1poUaBqyKic9YI8ai7MP.jpg` | 200 |
| 2 | `4ee7f4f4-41aa-4113-858d-11a54e3b9751` | The Quiet Girl | `/6Njyz53N417cgxE0d7cBEWHUEjc.jpg` → `https://image.tmdb.org/t/p/original/6Njyz53N417cgxE0d7cBEWHUEjc.jpg` | 200 | `/23jok5sYloPEBwKd6Bp4V8Y1O9I.jpg` → `…/original/23jok5sYloPEBwKd6Bp4V8Y1O9I.jpg` | 200 |
| 3 | `4ebd2e6d-960e-465f-b9c4-26656a3a7ef4` | The Princess Bride | `/2FC9L9MrjBoGHYjYZjdWQdopVYb.jpg` → `https://image.tmdb.org/t/p/original/2FC9L9MrjBoGHYjYZjdWQdopVYb.jpg` | 200 | `/2CisgvF2HcIVnbMZbSjASCtSgEb.jpg` → `…/original/2CisgvF2HcIVnbMZbSjASCtSgEb.jpg` | 200 |
| 4 | `2c5a608f-5cb1-45ba-94c6-dd9355337305` | Mission: Impossible - Fallout | `/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg` → `https://image.tmdb.org/t/p/original/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg` | 200 | `/5jnoAA74Qwb5w6B9FMvnc20n6Ie.jpg` → `…/original/5jnoAA74Qwb5w6B9FMvnc20n6Ie.jpg` | 200 |
| 5 | `f81715cf-84ec-4cd2-907d-b9269ea2bf7a` | Scott Pilgrim vs. the World | `/g5IoYeudx9XBEfwNL0fHvSckLBz.jpg` → `https://image.tmdb.org/t/p/original/g5IoYeudx9XBEfwNL0fHvSckLBz.jpg` | 200 | `/4jSTo5o597cURiEROqi9pVCCSbg.jpg` → `…/original/4jSTo5o597cURiEROqi9pVCCSbg.jpg` | 200 |
| 6 | `21acbc8e-d76c-418e-85d1-5154596adb6d` | The Worst Person in the World | `/1NxGNQchGBTHXJ6RShLY1IlZqWn.jpg` → `https://image.tmdb.org/t/p/original/1NxGNQchGBTHXJ6RShLY1IlZqWn.jpg` | 200 | `/4oWU9FPOvjCE85DaHm4vo89Whpz.jpg` → `…/original/4oWU9FPOvjCE85DaHm4vo89Whpz.jpg` | 200 |
| 7 | `542925e1-ece4-40f6-95e7-d5acf43c832c` | Lethal Weapon | `/6gt44oqb4nE8vflPElffeGwsHVl.jpg` → `https://image.tmdb.org/t/p/original/6gt44oqb4nE8vflPElffeGwsHVl.jpg` | 200 | `/4T2d3Ww0pNRFYS9eWHyDjkJSovq.jpg` → `…/original/4T2d3Ww0pNRFYS9eWHyDjkJSovq.jpg` | 200 |
| 8 | `58e965db-c419-4a90-a183-7496ffe5e292` | X-Men: Days of Future Past | `/tYfijzolzgoMOtegh1Y7j2Enorg.jpg` → `https://image.tmdb.org/t/p/original/tYfijzolzgoMOtegh1Y7j2Enorg.jpg` | 200 | `/fctQU5MoXgJ5pNMljFzlEFXwfSu.jpg` → `…/original/fctQU5MoXgJ5pNMljFzlEFXwfSu.jpg` | 200 |
| 9 | `6fbf049a-86a4-498b-a26e-f35ca18f427b` | This Is Spinal Tap | `/b3lllDltoBws5uKZzBYVSjpjjJx.jpg` → `https://image.tmdb.org/t/p/original/b3lllDltoBws5uKZzBYVSjpjjJx.jpg` | 200 | `/a3FaHEGActk76BeCBingyOvEqnm.jpg` → `…/original/a3FaHEGActk76BeCBingyOvEqnm.jpg` | 200 |
| 10 | `121918a7-1ad4-4c7d-9086-9e62d12b16ed` | Once | `/7nW363kSYRCkr4VGOMvuSGwtzKs.jpg` → `https://image.tmdb.org/t/p/original/7nW363kSYRCkr4VGOMvuSGwtzKs.jpg` | 200 | `/p1XSyBriqz7oBWoVcRqYlB6Kve3.jpg` → `…/original/p1XSyBriqz7oBWoVcRqYlB6Kve3.jpg` | 200 |
| 11 | `f806fed3-4e69-47d7-a2bf-f1d75d16420f` | The Farewell | `/7ht2IMGynDSVQGvAXhAb83DLET8.jpg` → `https://image.tmdb.org/t/p/original/7ht2IMGynDSVQGvAXhAb83DLET8.jpg` | 200 | `/5INPBiKVRsyp9kgHfsC0cTfvKFH.jpg` → `…/original/5INPBiKVRsyp9kgHfsC0cTfvKFH.jpg` | 200 |
| 12 | `c9bad052-079c-4196-b4ca-5fee393c9d11` | The Book of Life | `/aotTZos5KswgCryEzx2rlOjFsm1.jpg` → `https://image.tmdb.org/t/p/original/aotTZos5KswgCryEzx2rlOjFsm1.jpg` | 200 | `/b0XkgWgCBurkCZdNXp7kEZdgxEi.jpg` → `…/original/b0XkgWgCBurkCZdNXp7kEZdgxEi.jpg` | 200 |
| 13 | `74ebfc5e-10a8-48d4-9b33-9da6c03dadeb` | Twelve Monkeys | `/gt3iyguaCIw8DpQZI1LIN5TohM2.jpg` → `https://image.tmdb.org/t/p/original/gt3iyguaCIw8DpQZI1LIN5TohM2.jpg` | 200 | `/mKIkGoyuR71qz6FdiEiOjxvBQcS.jpg` → `…/original/mKIkGoyuR71qz6FdiEiOjxvBQcS.jpg` | 200 |
| 14 | `e7360d83-4261-4c35-b573-3d84674ef1fb` | King Kong | `/6a2HY6UmD7XiDD3NokgaBAXEsD2.jpg` → `https://image.tmdb.org/t/p/original/6a2HY6UmD7XiDD3NokgaBAXEsD2.jpg` | 200 | `/mRM2NB0i3wv4HqxXvwIjEVi4Qqq.jpg` → `…/original/mRM2NB0i3wv4HqxXvwIjEVi4Qqq.jpg` | 200 |
| 15 | `aa01a9c2-558c-4143-8ba7-59ea2da83b8d` | The Banshees of Inisherin | `/4yFG6cSPaCaPhyJ1vtGOtMD1lgh.jpg` → `https://image.tmdb.org/t/p/original/4yFG6cSPaCaPhyJ1vtGOtMD1lgh.jpg` | 200 | `/1vXD5HXqkhvsXFHE7KmCPZGPR1e.jpg` → `…/original/1vXD5HXqkhvsXFHE7KmCPZGPR1e.jpg` | 200 |
| 16 | `c6d6654f-ea18-4635-a876-49294e295076` | Free Guy | `/dxraF0qPr1OEgJk17ltQTO84kQF.jpg` → `https://image.tmdb.org/t/p/original/dxraF0qPr1OEgJk17ltQTO84kQF.jpg` | 200 | `/7py8kUCYaOdFn1TfVS87BDBySOz.jpg` → `…/original/7py8kUCYaOdFn1TfVS87BDBySOz.jpg` | 200 |
| 17 | `8b75b450-8f43-40c7-aa88-49f5063cae26` | Children of Men | `/lQcXgb0fFzffnLV5WY0Q0X2WW7E.jpg` → `https://image.tmdb.org/t/p/original/lQcXgb0fFzffnLV5WY0Q0X2WW7E.jpg` | 200 | `/gFGLwUBhVrq0bq4j9DU08xQDRU2.jpg` → `…/original/gFGLwUBhVrq0bq4j9DU08xQDRU2.jpg` | 200 |
| 18 | `dd0803f3-57fc-4ef4-bc80-ade33542da88` | The Hundred-Foot Journey | `/1vFhSr7INoulu18smHqicft05i8.jpg` → `https://image.tmdb.org/t/p/original/1vFhSr7INoulu18smHqicft05i8.jpg` | 200 | `/jUaZAbdpNl33VHprUl4qEohXn8q.jpg` → `…/original/jUaZAbdpNl33VHprUl4qEohXn8q.jpg` | 200 |
| 19 | `dc7bd17f-80a2-4f43-bad3-17657e4ce894` | Still Alice | `/yY6ypZPQl67J4RwOA6YBALNS3Wj.jpg` → `https://image.tmdb.org/t/p/original/yY6ypZPQl67J4RwOA6YBALNS3Wj.jpg` | 200 | `/tw1IZuR6GVlSL4aqfsmLFfUJAN9.jpg` → `…/original/tw1IZuR6GVlSL4aqfsmLFfUJAN9.jpg` | 200 |
| 20 | `d9b27171-757c-4087-a804-0699b5186c1c` | 300 | `/h7Lcio0c9ohxPhSZg42eTlKIVVY.jpg` → `https://image.tmdb.org/t/p/original/h7Lcio0c9ohxPhSZg42eTlKIVVY.jpg` | 200 | `/lgBZlJ1LHQel5nneNQMoesmvc7l.jpg` → `…/original/lgBZlJ1LHQel5nneNQMoesmvc7l.jpg` | 200 |
| 21 | `63c9942f-fc1e-4d0d-aac1-ee3275d1d4dd` | Brazil | `/aewan59WcFThBimkTVVoNf2o5Vb.jpg` → `https://image.tmdb.org/t/p/original/aewan59WcFThBimkTVVoNf2o5Vb.jpg` | 200 | `/9IYyCLf5NNAQFK9pNtqzEU9HWzM.jpg` → `…/original/9IYyCLf5NNAQFK9pNtqzEU9HWzM.jpg` | 200 |
| 22 | `89d7cf26-1b41-441c-b726-2a683e7d69d3` | Midnight in Paris | `/4wBG5kbfagTQclETblPRRGihk0I.jpg` → `https://image.tmdb.org/t/p/original/4wBG5kbfagTQclETblPRRGihk0I.jpg` | 200 | `/gR1LRuvKTzh2AvxGvfoBNNJHPMq.jpg` → `…/original/gR1LRuvKTzh2AvxGvfoBNNJHPMq.jpg` | 200 |
| 23 | `043911e2-307b-4092-b4df-8f062b5df800` | The Bourne Ultimatum | `/15rMz5MRXFp7CP4VxhjYw4y0FUn.jpg` → `https://image.tmdb.org/t/p/original/15rMz5MRXFp7CP4VxhjYw4y0FUn.jpg` | 200 | `/qiBILuWhv7ipF0pxiEqIJdkQzj8.jpg` → `…/original/qiBILuWhv7ipF0pxiEqIJdkQzj8.jpg` | 200 |
| 24 | `10f3c8c0-c094-4c2a-bfb4-6f65587cd986` | Casino Royale | `/lMrxYKKhd4lqRzwUHAy5gcx9PSO.jpg` → `https://image.tmdb.org/t/p/original/lMrxYKKhd4lqRzwUHAy5gcx9PSO.jpg` | 200 | `/mXFmGlMCgTIOyHaGmQG1Hb6Rv2m.jpg` → `…/original/mXFmGlMCgTIOyHaGmQG1Hb6Rv2m.jpg` | 200 |
| 25 | `80f59a4d-3560-4363-82ce-53006befe6f9` | Baby Driver | `/tYzFuYXmT8LOYASlFCkaPiAFAl0.jpg` → `https://image.tmdb.org/t/p/original/tYzFuYXmT8LOYASlFCkaPiAFAl0.jpg` | 200 | `/oVD3ClJBoomSQHtnJPAlMfes8YD.jpg` → `…/original/oVD3ClJBoomSQHtnJPAlMfes8YD.jpg` | 200 |
| 26 | `f7455189-ccff-4004-a268-08ad3ad0442b` | Hot Fuzz | `/zPib4ukTSdXvHP9pxGkFCe34f3y.jpg` → `https://image.tmdb.org/t/p/original/zPib4ukTSdXvHP9pxGkFCe34f3y.jpg` | 200 | `/9rMSCFH9zhv1vILpEZQlUJs9iUm.jpg` → `…/original/9rMSCFH9zhv1vILpEZQlUJs9iUm.jpg` | 200 |
| 27 | `7fb1905c-676c-423f-887e-2ee9153494a2` | Ferris Bueller's Day Off | `/9LTQNCvoLsKXP0LtaKAaYVtRaQL.jpg` → `https://image.tmdb.org/t/p/original/9LTQNCvoLsKXP0LtaKAaYVtRaQL.jpg` | 200 | `/leehjwM57DKJ79XMUll4oAF0kin.jpg` → `…/original/leehjwM57DKJ79XMUll4oAF0kin.jpg` | 200 |
| 28 | `f8d6fa68-f2ce-411f-9338-a9ce2b426bc9` | Contact | `/bCpMIywuNZeWt3i5UMLEIc0VSwM.jpg` → `https://image.tmdb.org/t/p/original/bCpMIywuNZeWt3i5UMLEIc0VSwM.jpg` | 200 | `/yFkUPqBuUnbhYbQL8VFpTrAT9za.jpg` → `…/original/yFkUPqBuUnbhYbQL8VFpTrAT9za.jpg` | 200 |
| 29 | `b5a975e6-a3b9-4e22-8c42-f5669c823432` | Wind River | `/pySivdR845Hom4u4T2WNkJxe6Ad.jpg` → `https://image.tmdb.org/t/p/original/pySivdR845Hom4u4T2WNkJxe6Ad.jpg` | 200 | `/kQGxGXzYiCumY8kmXXpgbZyZQK8.jpg` → `…/original/kQGxGXzYiCumY8kmXXpgbZyZQK8.jpg` | 200 |
| 30 | `c294c9b2-7bbb-4d1e-b806-ecf5fb70311f` | Boyhood | `/2BvtvDUyxiMJ4dmKfiQf4qdOHQN.jpg` → `https://image.tmdb.org/t/p/original/2BvtvDUyxiMJ4dmKfiQf4qdOHQN.jpg` | 200 | `/qRwkMMZhQRKM4uDaXpd2XbZZmkE.jpg` → `…/original/qRwkMMZhQRKM4uDaXpd2XbZZmkE.jpg` | 200 |
| 31 | `3a214e4e-9438-4e81-96c7-5ba990d06565` | Birdman or (The Unexpected Virtue of Ignorance) | `/rHUg2AuIuLSIYMYFgavVwqt1jtc.jpg` → `https://image.tmdb.org/t/p/original/rHUg2AuIuLSIYMYFgavVwqt1jtc.jpg` | 200 | `/s0OrExdg7i3RLR7oqzHRk4q2kL4.jpg` → `…/original/s0OrExdg7i3RLR7oqzHRk4q2kL4.jpg` | 200 |
| 32 | `47c331c3-d808-4fda-b0fd-8c9f301fbea9` | Edge of Tomorrow | `/nBM9MMa2WCwvMG4IJ3eiGUdbPe6.jpg` → `https://image.tmdb.org/t/p/original/nBM9MMa2WCwvMG4IJ3eiGUdbPe6.jpg` | 200 | `/4V1yIoAKPMRQwGBaSses8Bp2nsi.jpg` → `…/original/4V1yIoAKPMRQwGBaSses8Bp2nsi.jpg` | 200 |
| 33 | `9688fcab-7307-43e7-8c30-4a8d316b15fe` | Paddington 2 | `/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg` → `https://image.tmdb.org/t/p/original/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg` | 200 | `/kRVUMsXFzhuXjr20JcCGc6TapxA.jpg` → `…/original/kRVUMsXFzhuXjr20JcCGc6TapxA.jpg` | 200 |

Not: `300` (0 harf) ve `Birdman or (…)` (39 harf) Spotlight maske filtresinde
elenir ama gauntlet ve diğer yüzeyler için de ham yol düzeltmesinden
yararlanır; B migration'ı "yalnız 33 film" kapsamında ikisini de içerir.

---

## DUR 1 — onay bekleyen kararlar

1. **Vault anahtarı (kapsam dışı, kurucu):** 4 aktif job'u etkiler. Önce
   `.env` `SUPABASE_SECRET_KEY` ile README testi (`?force=1` → 400) — bu
   oturumda izin sistemi engelledi. Sonra Dashboard'dan Vault güncellemesi ve
   isteğe bağlı elle Spotlight koşumu (idempotent).
2. **A–D** brief'teki sırayla. Not: A (guard) `generate-puzzles` deploy'u ister;
   B migration'ı `films`'e UPDATE (DELETE değil, kural 4 uyumlu).
3. **E** için ask bulgusu (§4): kart mount edilmezse ask yine çıkmaz; tercih
   DUR 3'te.

## Doğrulanamayanlar

- Son 20 koşumun HTTP durumu (`net._http_response` ~24 saat; 1 satır).
- `profile-missing-films`'in 401 alıp almadığı (iş olmadığı için çıktı yok).
- `.env` `SUPABASE_SECRET_KEY`'in bugün kapıyı açtığı (test engellendi).
- Vault'u 10-01 06:23'te kimin değiştirdiği.
