# BUILD ÖNCESİ — Gauntlet dört başlık keşfi

**Tarih:** 26 Eyl 2026 · **Mod:** salt okunur · **HEAD:** `325d3bc`
**Kapsam:** (1) ilk açılış çırpınması · (2) 100 günlük takvim teyidi ·
(3) Gauntlet ekran düzeni · (4) yükleme süresi

---

## Yönetici özeti

1. **Çırpınma (başlık 1) — kesin kök neden BULUNAMADI.** Ancak ölçülen tek canlı
   gauntlet (bugün, `Europe/Istanbul` kullanıcısı) **15:58 yerel saatte** üretildi,
   yani 18:00 kapısından **önce**. Release build'de `before_18` durumundan ağ
   çağrısına giden **tek** yol, P0-1'in (`3fd787f`) kapattığı bağlantı-geri-geldi
   tetikleyicisidir. Cihazdaki build P0-1 öncesiyse, tarif edilen dizi ("yok dedi →
   geldi") P0-1'in kendisiyle tutarlıdır. Cihazdaki build türü (dev / preview-e2e /
   release) **doğrulanamadı**. Bu build `__DEV__` ya da `preview-e2e` ise kapı hiç
   oluşmaz ve bu açıklama geçersiz kalır.
2. **Mount + auth çift tetiklemesi ağda tek çağrıya iniyor.** `flushPendingChoice`
   `inFlight` guard'ı ve `load()`'daki `loadingRef` guard'ı eşzamanlı iki
   `flushThenLoad`'ı tek `generate-gauntlet` isteğine indiriyor. GauntletShell'de
   AppState dinleyicisi **yok**. Hazır durumdan (`ready`/`in_progress`) çıkıp geri
   dönmeyi üreten, remount gerektirmeyen tek yol `submit` sırasında gelen 401
   (skeleton → yeniden yükleme). "Çıktı, tekrar girdi" için kodda bundan başka yol
   bulunamadı.
3. **Takvim yapısı temiz:** 100 gün × 4 ana pozisyon, 400 benzersiz film, gün
   tekrarı 0, tema/hafta günü eşleşmesi 100/100. Enrichment'ta gauntlet'in
   kullandığı alanların (poster, yıl, süre, dominant_color) hiçbirinde NULL yok.
   Yedek kulübesi (poz. 5-6) **0 satır**, bu bible'da zaten kayıtlı.
4. **Gün 9 canlı eşleşmesi bugün yeniden üretilemedi.** Bugünün `daily_gauntlets`
   tablosunda **tek satır** var. O satır deploy'dan (14:43 UTC) **önce**, 12:58
   UTC'de üretilmiş bir `v0-random-diverse` gauntlet ve takvimle eşleşmiyor.
   Bible v1.25'teki doğrulamanın test kimliği silinmiş. Canlı fonksiyon kodu repo
   ile **birebir aynı** (indirilip diff alındı). Yeni bir canlı eşleşme ancak
   yazma gerektiren bir çağrıyla (yeni kimlik + gauntlet satırı) yapılabilir, bu
   tur salt okunur olduğu için yapılmadı.
5. **Bugünkü iki düzen değişikliği tur ekranlarına dokunmuyor.** İkisi de yalnız
   `completed_today && champion` dalında render ediliyor. "Siyah bekleme ≤1.5s"
   hâlâ kodda aktif, ancak **yalnız Champion reveal'ı** kapsıyor. Gauntlet'in ilk
   açılıştaki yükleme süresiyle ilgisi yok.

---

## 1. İlk açılış çırpınması

### 1.1 Durum makinesi — durumlar

`ShellState` (`components/gauntlet/GauntletShell/index.tsx:160`):
`before_18 | bootstrapping | ready | in_progress | completed_today`.
Durumun üzerine binen, ShellState'e dahil olmayan göstergeler: `loadError`
(yalnız `bootstrapping` dalında render edilir, `:1051`), `pendingFeedbackVisible`
(`:1033`, tüm dalların önüne geçer), `isStale`, `choiceFrozen`.

Başlangıç değeri: `isUnlockedNow() ? 'bootstrapping' : 'before_18'` (`:184-186`).
`isUnlockedNow()`, `__DEV__` ve `preview-e2e` build'lerinde **her zaman `true`**
döner (`:120`, `:125`).

### 1.2 Tetikleyici haritası

| # | Kaynak | dosya:satır | Koşul | Ne yapar |
|---|---|---|---|---|
| T1 | Mount | `GauntletShell/index.tsx:467-482` | `shellStateRef === 'bootstrapping'` | `flushThenLoad()` |
| T2 | Auth event (`SIGNED_IN` / `INITIAL_SESSION` / `TOKEN_REFRESHED`) | `:486-497` | `shellStateRef === 'bootstrapping'` | retry timer iptal + `flushThenLoad()` |
| T3 | Bağlantı geri geldi (offline→online) | `:502-510` | `shellStateRef !== 'before_18'` (P0-1) | `flushThenLoad()`. **ready / in_progress / completed_today'de de ateşlenir** |
| T4 | Dakikalık nabız (60 sn) | `:513-542` | `before_18 && isUnlockedNow()` → bootstrapping + `load()`; `completed_today && gün değişti` → state sıfırla | |
| T5 | 401 retry backoff | `:401-415` | `GauntletAuthPendingError`, deneme < 5 | 300/600/1200/2400 ms sonra `load()` |
| T6 | `submit` sırasında 401 | `:554-558` | oyun ortasında | `setShellState('bootstrapping')` + `load()` |
| T7 | "Tekrar dene" butonu | `:1057`, `:1147` | yalnız hata görünümünde | `retryLoad()` → `flushThenLoad()` |
| — | **AppState listener** | yok | — | GauntletShell'de **yok**. Tek AppState dinleyicisi `app/_layout.tsx:265-278`'de ve yalnız PostHog flush yapıyor |
| — | Polling | yalnız T4 | — | Başka interval yok |

`load()` başarılı olduğunda her seferinde `applyGauntlet` çalışır (`:300-380`).
Yan etkileri: `setShareRounds([])`, `pendingWatchFeedback` varsa kartı yeniden
açar (`:312`), round/pair/state sunucu progress'inden yeniden kurulur.

### 1.3 Race değerlendirmesi

**T1 + T2 (mount + INITIAL_SESSION) neredeyse aynı anda:**
supabase-js yeni aboneye `INITIAL_SESSION` yayınlar, yani iki `flushThenLoad` üst
üste biner. Ağ çağrısı sayısı yine de bir:
- `flushPendingChoice` modül seviyesinde `inFlight` promise'ini paylaşıyor (`services/gauntletOfflineQueue.ts:160-167`), iki çağrı aynı sonucu bekliyor.
- `load()` `loadingRef` ile korunuyor (`GauntletShell/index.tsx:385-386`). İkinci çağrı, ilki uçuştayken sessizce çıkıyor.
- İlk `load` bittikten sonra gelen bir auth olayı etkisiz kalıyor, çünkü durum artık `bootstrapping` değil (`:490`).
→ Bu çift tetiklemeden görünür bir flaş çıkmıyor. **Risk: düşük.**

**Hata → otomatik iyileşme dizisi (görünür "yok → var"):**
İlk `load` 401 dışı bir hatayla düşerse (ilk kurulumda cache yokken bağlantı
hatası da buna dahil, `services/gauntletService.ts:337-343`), `loadError`
gösterilir: "Bugünün filmleri yüklenemedi. Tekrar dene." Durum `bootstrapping`
kalır. Sonraki bir auth olayı (T2) ya da reconnect (T3) kullanıcı dokunmadan
`load()` çağırır. `setLoadError(null)` önce skeleton'a, sonra `ready`'ye götürür.
Aynı şey 5 ardışık 401 sonrası da olur (≈4,5 sn sonra hata metni, ardından gelen
`SIGNED_IN` ile otomatik yükleme). → "yok dedi, sonra geldi" ile **tutarlı bir
yol**. Tetiklendiği ölçülmedi.

**P0-1 yolu (before_18 → ready):**
P0-1 öncesi build'de T3, `before_18`'de de `flushThenLoad` çağırıyordu. Sonuç:
"Bugünün dörtlüsü 18:00'de hazır" → `ready`. **Ölçülmüş bir destek var** (bkz. 1.4).

**"Çıktı, tekrar girdi":**
`ready`/`in_progress` durumundan başka bir duruma geçen yollar yalnızca şunlar:
T6 (submit 401 → skeleton → yeniden yükleme), champion ve exhausted. Hiçbir yol
`ready`'den `before_18`'e dönmüyor. T4 yalnız `completed_today` durumundan
geri dönüş yapıyor. Remount gerektirmeyen başka bir "çıkış" kodda yok. Dolayısıyla
şu üç yoldan biri olmalı, hangisi olduğu **belirlenemedi**:
(a) T6, oyun ortasında 401;
(b) GauntletShell remount (uygulama soğuk yeniden başladı; remount'ta başlangıç
durumu yeniden `isUnlockedNow()` ile hesaplanır, 18:00 öncesi release build'de
tekrar `before_18` olur ve T3 ile tekrar `ready`'ye geçer);
(c) kullanıcının kendi uygulamadan çıkıp girmesi.
Tab navigator remount riski (`app/(tabs)/_layout.tsx:28-40`, `hidden` prop'u) bugün
tetiklenmiyor: `discover_tab_enabled = false` canlıda ölçüldü, state değişmiyor.

**Ek risk (ilk açılışta değil):** T3 `ready`/`in_progress`/`completed_today`'de de
tam yeniden yükleme yapıyor. `pendingWatchFeedback` yanıtlanmış ama henüz
yazılmamışsa (`handlePendingFeedback` optimistic, `:834-850`), araya giren bir
reconnect kartı yeniden açabilir (`:312`). Yeni kullanıcıda pending feedback
olmadığı için bu, tarif edilen ilk açılışı açıklamıyor.

### 1.4 Ölçülmüş kanıt

```sql
select g.id, g.user_id, g.date, g.algorithm_version, g.generated_at, ...
from daily_gauntlets g where g.date >= '2026-09-24';
-- 1 satır: 2bd41d10…, user 9aa25048…, v0-random-diverse,
-- generated_at 2026-09-26 12:58:59 UTC, choice r1/r2/r3 13:00:55–13:01:09 UTC

select created_at, timezone from users where id = '9aa25048-…';
-- created_at 2026-09-26 12:55:27 UTC · timezone = Europe/Istanbul
```

- Kullanıcı 12:55:27 UTC'de oluşmuş, gauntlet 3,5 dakika sonra (12:58:59 UTC =
  **15:58 İstanbul**) üretilmiş. Bu, ilk açılış + onboarding ile tutarlı.
- 15:58 < 18:00. Release build'de `before_18` durumunda `load()`'a ulaşan yollar
  T3 (P0-1 öncesi), T4 ve T7. T4 `isUnlockedNow()` false olduğu için ateşlenmez.
  T7 `before_18` dalında render edilmez. Kalan tek yol **T3**.
- `__DEV__` ya da `preview-e2e` build'inde kapı zaten açık olduğundan bu çıkarım
  geçersizdir. Build türü doğrulanamadı.

**Sentry breadcrumb'ları:** Bu oturumda Sentry erişimi yok (MCP bağlı değil,
`sentry-cli` kurulu değil, token yok). GauntletShell durum geçişleri için ayrıca
breadcrumb da **yazmıyor**. Kodda yalnız `gauntlet.perf` (`services/gauntletService.ts:187-193`)
var. `networkStatus` geçişleri `logger.log` ile yazılıyor
(`services/networkStatus.ts:129`) ve bu prod'da iz bırakmıyor (bkz. hafıza:
logger prod no-op). → Reconnect'in gerçekten ateşlendiği **sahada ölçülemez**.

---

## 2. 100 günlük takvim teyidi

### 2.1 Yapı

```sql
-- tek sorgu, sonuçlar:
days_rows=100 · day_range=1-100 · missing_days=0
film_rows=400 · main_rows(pos 1-4)=400 · bench_rows(pos 5-6)=0
days_with_full_1_4=100 · days_not_4=null
dup_film_all=0 · films_in_multiple_days=0
```
- Her günde tam 4 film var, pozisyon 1-4 dolu ve boşluksuz, hiçbir film iki günde
  geçmiyor (ayrıca `UNIQUE(film_id)` index'i de var: `112_editorial_calendar.sql`).
- Yedek kulübesi 100 günün **hepsinde 0**. Bible §9'da kayıtlı. Editoryal günde
  `neither` kilitleniyor.

### 2.2 Tema deseni

`launch_date = 2026-09-18` (canlı `app_config`). Beklenen tema, `isodow(launch + n - 1)`
ile hesaplandı (Pzt arthouse … Paz prestige):
```
match=100 · mismatch=0
arthouse 14 · cult 14 · cozy 14 · discovery 14 · popcorn 15 · epic 15 · prestige 14
day 9 → epic, 2026-09-26 (Cumartesi)
```

### 2.3 Gün 9 canlı eşleşmesi

Takvim, gün 9: 1 *The Fellowship of the Ring* (2001) · 2 *The Two Towers* (2002) ·
3 *The Return of the King* (2003) · 4 *The Hobbit: An Unexpected Journey* (2012).

Bugünün canlı `daily_gauntlets` satırları: **1 satır**, takvimle eşleşmiyor
(`exact_order_match=0`). Satır `v0-random-diverse`, `slot_types` dördü de
`global`, 12:58 UTC'de üretilmiş. `generate-gauntlet` v33 ise 14:43:57 UTC'de
deploy edilmiş (`supabase functions list`). Satır deploy'dan önce üretildiği için
aynı gün cached-serve yolundan döner (`generate-gauntlet/index.ts:771-827`). Bible
v1.25 bunu "tasarım gereği" diye kaydetmiş.
`v1-editorial-calendar` satırı canlıda **0**. v1.25 doğrulamasının test kimliği
silinmiş.

**Canlı kod = repo:** `generate-gauntlet` ve `submit-choice` geçici dizine indirildi
(repo dışı). `index.ts` ×2, `_shared/editorialCalendar.ts`, `gauntletCore.ts`,
`gameUtils.ts`, `sentry.ts` ve `types/gauntlet.ts` dosyalarının **hepsi repo ile
aynı**. `editorialDayNumber('2026-09-26','2026-09-18') = 9`
(`_shared/editorialCalendar.ts:97-108`).
→ Bir sonraki yeni üretim gün 9'u (ya da o günün UTC tarihine denk gelen günü)
takvimden sırasıyla alacaktır. Bu **statik kanıttır**. Canlı yeni üretim bu turda
tetiklenmedi, çünkü yazma gerektiriyor.

### 2.4 Enrichment (400 editoryal film)

```sql
select count(*) filter (where poster_url is null or poster_url='') …
from editorial_calendar_films e join films f on f.id=e.film_id;
```
| alan | NULL / boş | gauntlet kullanıyor mu |
|---|---|---|
| `poster_url` | 0 | evet (`GauntletFilm.posterUrl`) |
| `poster_quality_ok ≠ true` | 0 | — |
| `year` | 0 | evet |
| `runtime` | 0 | evet |
| `dominant_color` | 0 | evet (ışık sızması) |
| `tmdb_id` | 0 | — |
| `overview` | 0 | — |
| `genres` boş | 0 | — |
| `vote_average` | 0 | — |
| `imdb_rating` | **127** | gauntlet kullanmıyor |
| `imdb_id` | **32** | gauntlet kullanmıyor |
| `director` | **31** | gauntlet kullanmıyor |
| `tr_title` | **399** | gauntlet kullanmıyor |

`curation_tier` dağılımı: core 238 · extended 127 · archive 33 · trending 2.
33 archive film editoryal yolda sorun değil, çünkü `fetchCandidatesByIds` ile
çözümleniyor ve havuz filtresine girmiyor
(`_shared/editorialCalendar.ts:146-153`).
Not: `films` tablosunda `poster_path` kolonu yok, alan adı `poster_url`.
**TMDB'de gerçek varlık:** `tmdb_id` 400/400 dolu. TMDB API'sine istek atılmadı
(harici çağrı), yani "TMDB'de hâlâ var" iddiası **doğrulanamadı**.

---

## 3. Gauntlet ekranı düzeni

### 3.1 Kabuk

`GauntletShell/index.tsx:1240-1253`: `root` (flex 1, `surface.base`) → `LightBleed`
(dolgusuz, kenara kadar) → `insetLayer` (`paddingTop/Bottom = insets`) → `renderBody()`.

### 3.2 Dal bazında yerleşim

| Koşul | dosya:satır | İçerik |
|---|---|---|
| `pendingFeedbackVisible && pendingWatchFeedback` | `:1033-1040` | Yalnız `PendingWatchFeedbackCard`. Tüm dalların önüne geçer |
| `before_18` | `:1042-1048` | Ortalanmış tek metin `gauntlet.before18` |
| `bootstrapping` + `loadError` | `:1051-1060` | Ortada hata metni + `QuietAction` "Tekrar dene" |
| `bootstrapping` | `:1063-1076` | İskelet: 40% çubuk → 2 poster slotu (2:3) → 55% çubuk |
| `completed_today` + champion | `:1081-1125` | `isStale` notu → `ChampionReveal` (flex 1) → `AuthPromptSheet` / `NotificationPromptSheet` (modal) → `ArchiveTrigger` → `SpotlightBonusCard` → `TabBarInsetTelemetry` (absoluteFill, `pointerEvents="none"`) |
| `completed_today` champion'sız (exhausted) | `:1127-1134` | Ortada metin (+ `onDismiss` varsa "Boşver, yarın"; Home'da verilmiyor, `app/(tabs)/index.tsx:9-15`) |
| `ready` / `in_progress`, `pair` veya `gauntlet` yok | `:1138-1150` | Sentry + hata metni + "Tekrar dene" |
| `ready` / `in_progress` | `:1156-1237` | Aşağıda |

**Tur ekranı (`ready`/`in_progress`), yukarıdan aşağıya** (`content`: padding
`xxl` üst / `xl` alt, ortalı):
1. `header` (`:1158-1167`): `ContextBar` + `RoundIndicator` (güven yüzdesi kaldırılmış, `:1160-1165`)
2. `isStale` → `offlineNotice` (`:1171`)
3. `middle` (flex 1, dikeyde ortalı, `:1176`):
   - `posterRow`: iki `PosterTile` (flex 1, `key = film.id`), `disabled = submitting || transitioning || choiceFrozen`
   - `question`: `seenMode` açıksa `seenPrompt`, değilse `question`
   - `choiceFrozen` → `pendingNotice`
   - `actionError` → `actionError`
   - `actions` satırı: `seenMode` açıksa yalnız "Vazgeç". Değilse "İkisi de değil" (`outOfRefreshes || editorialRefreshBlocked` iken disabled) · "İzledim" · (`outOfRefreshes && onDismiss` iken "Boşver, yarın". Home'da görünmez)

### 3.3 Bugünkü değişikliklerin tur ekranlarına etkisi (kural 10)

`git diff 5435e8b HEAD --stat`: `app/gate.tsx`, `ChampionReveal/styles.ts` (−1),
`GauntletShell/index.tsx` (+5), `TabBarInsetTelemetry/*` (yeni).
- `a2273ad`: yalnız `ChampionReveal/styles.ts` içindeki `actionsWrapper.marginTop`
  silindi. `ChampionReveal` yalnız `:1091`'de, champion dalında render ediliyor.
  Bu stil dosyası başka yerden import edilmiyor.
- `325d3bc`: GauntletShell'e bir import (`:38`) ve champion dalına tek bir
  `<TabBarInsetTelemetry />` (`:1123`) eklendi. Durum, effect, handler ya da tur
  dalında değişiklik yok. Bileşen absoluteFill ve `pointerEvents="none"`
  (`TabBarInsetTelemetry/index.tsx:117`, `styles.ts:8-10`), akışta yer kaplamıyor.
- `ad30156` (`gate.tsx`) yönlendirme değişikliği, GauntletShell'e dokunmuyor.
→ Tur ekranları (`before_18` / `bootstrapping` / `ready` / `in_progress` /
exhausted) **kod olarak değişmemiş**. Görsel doğrulama cihazda yapılmadı.

---

## 4. Gauntlet yükleme süresi

### 4.1 Ekrana gelene kadar zincir (soğuk açılış)

| Adım | dosya:satır | Süre |
|---|---|---|
| Gate splash, **yapay minimum** | `app/gate.tsx:31` (`MIN_SPLASH_MS = 3000`) | ≥ 3000 ms |
| Splash fade-out | `components/LoadingScreen/index.tsx:46` (`FADE_OUT_MS = 500`) | 500 ms |
| Stack geçişi | `app/_layout.tsx` `animation: 'fade'` | platform varsayılanı, ölçülmedi |
| (yalnız ilk açılış) Onboarding | `app/onboarding.tsx:131-136` | kullanıcıya bağlı |
| Bekleyen seçim flush'ı (AsyncStorage) | `GauntletShell/index.tsx:437` | ölçülmedi, yerel |
| `ensureAuthSession` (token 30 sn içinde bitiyorsa `refreshSession`, ağ) | `services/gauntletService.ts:164-176` | ölçülmedi |
| `generate-gauntlet` round-trip | `gauntletService.ts:240-243` | **ölçülemedi** (aşağıda) |
| 401 penceresi (en kötü durum) | `GauntletShell/index.tsx:111-112` | 300+600+1200+2400 = 4500 ms + 5 istek |
| Tur 1 posterleri (w500, skeleton `onLoad`'a kadar) | `PosterTile/index.tsx:164-178` | ağ bağımlı. Tur 1 için **prefetch yok** |

`generate-gauntlet` sunucu içinde sıralı DB adımları çalıştırıyor: auth +
`resolveAppUser`, `timezone` write-through (`:746-764`), `resolvePendingWatchFeedback`,
mevcut satır sorgusu, `countSignals`, ardından cached yolda `fetchFilmsByIds` +
`deriveProgress`, yoksa üretim. Süre ölçümü yok.

### 4.2 "Siyah bekleme ≤1.5s" (d508cec)

- Hâlâ aktif: `components/gauntlet/ChampionReveal/index.tsx:85`
  (`POSTER_WAIT_CAP_MS = 1500`), tavan zamanlayıcısı `:267-288`, kapı `:309-312`,
  toplam süreyi uzatmayan `posterAt` hesabı `:324-332`.
- Prefetch hâlâ aktif: son tur başlarken iki finalistin w780'i ısıtılıyor
  (`GauntletShell/index.tsx:692-703`).
- **Kapsam:** Bu karar yalnız **Champion reveal'ının kara boşluğunu** kapsıyor.
  Gauntlet'in ilk yüklemesiyle ilgisi yok. Kara boşluk üst sınırı: poster
  yüklendiyse 520 ms, yüklenmediyse 1500 ms + belirme (360 ms, Reduce Motion'da
  100 ms).
- Tavan aşılınca `posterUri`, w500'e (`champion.posterUrl`) düşüyor (`:273`). Bu
  URL tur 3'te PosterTile tarafından zaten yüklenmiş, önbellekte olması beklenir.
  Önbellekte olduğu doğrulanmadı.
- **Kapsama girmeyen yol:** Resume ile doğrudan tur 3'e girilirse (`applyGauntlet`,
  `:346-353`) finalist prefetch'i çalışmıyor. Prefetch yalnız canlı tur 2→3
  geçişinde yapılıyor. Bu durumda Champion w780 soğuk yüklenir ve 1,5 sn tavanına
  takılma ihtimali artar. Oran ölçülmedi.
- "Hâlâ ≤1,5 sn'ye uyuyor mu" sorusunun saha verisi `gauntlet.poster` breadcrumb'ı
  ("w780 1.5s icinde yuklenmedi")'dır. Sentry erişimi olmadığı için
  **doğrulanamadı**.

### 4.3 Yapay gecikmeler (tam liste, ilk yükleme yolunda)

- `MIN_SPLASH_MS = 3000` (gate). İlk gauntlet görüntüsünden önceki **tek büyük
  sabit gecikme** bu.
- 401 backoff, yalnız 401 alınırsa.
- Tur içi geçişler: `DISSOLVE_DURATION.eliminatedPoster = 320` ms (Reduce Motion'da
  `crossFade = 100`), `constants/design/motion.ts:16-24`, `:50-52`. İlk yüklemeyi
  etkilemiyor.

---

## Bulgular tablosu

| # | dosya:satır | Durum | İş |
|---|---|---|---|
| B1 | `GauntletShell/index.tsx:502-510` | Tek canlı gauntlet 15:58 yerel saatte üretilmiş. Release build'de bunu açıklayan tek yol T3, yani P0-1 öncesi davranış. Build türü bilinmiyor | S (doğrulama) |
| B2 | `GauntletShell/index.tsx:399-419`, `:486-497` | Hata metni → auth/reconnect ile kullanıcı dokunmadan otomatik iyileşme. "Yok → var" flaşı üretebilen ikinci yol | S |
| B3 | `GauntletShell/index.tsx:554-558` | Oyun ortasında 401 → skeleton → yeniden yükleme. Remount olmadan "çıktı, tekrar girdi" üretebilen tek yol | S |
| B4 | `GauntletShell/index.tsx:502-510` + `:312` | Reconnect, ready / in_progress / completed_today'de de tam yeniden yükleme yapıyor. `pendingWatchFeedback` kartını yeniden açabilir | S |
| B5 | `GauntletShell` + `networkStatus.ts:129` | Durum geçişleri ve reconnect sahada iz bırakmıyor (breadcrumb yok, `logger.log` prod'da no-op) | S |
| B6 | `editorial_calendar_films` | Yedek kulübesi 0/200. Bible'da zaten kayıtlı | — |
| B7 | `films` (400 editoryal) | imdb_rating 127, imdb_id 32, director 31, tr_title 399 NULL. Gauntlet bu alanları kullanmıyor | M (veri) |
| B8 | `daily_gauntlets` | Bugün `v1-editorial-calendar` satırı 0. Gün 9 canlı eşleşmesi bu turda yeniden gözlenemedi | S (doğrulama) |
| B9 | `GauntletShell/index.tsx:346-353` vs `:692-703` | Resume ile tur 3'e girişte finalist w780 prefetch'i yok | S |
| B10 | `app/gate.tsx:31` | Gauntlet'ten önce 3000 ms + 500 ms sabit splash | S |

## DUR NOKTASI gerektiren maddeler

- **B5**: GauntletShell'e durum geçişi breadcrumb'ı ya da `networkStatus`'a Sentry
  izi eklemek yeni bir telemetri deseni olur. Karar CTO'da.
- **B8**: Gün 9 / editoryal dalın canlı yeniden doğrulaması **yazma** gerektiriyor
  (yeni kimlik + `daily_gauntlets` satırı + K-16 cascade silme). Salt okunur
  tur kapsamı dışında. Yapılıp yapılmayacağı onaya bağlı.
- **B1**: Kök neden için cihazdaki build türünün (dev client / preview-e2e /
  preview / TestFlight) ve P0-1'i içerip içermediğinin kullanıcıdan teyidi gerekiyor.

## Doğrulanamayanlar

- **Sentry** (breadcrumb'lar, `gauntlet.perf` süreleri, `gauntlet.poster` 1,5 sn
  tavanı olayları): erişim yok (MCP bağlı değil, `sentry-cli` yok, token yok).
- **Edge Function log'ları / ortalama `generate-gauntlet` süresi:** Management API
  token'ı bu kabukta yok.
- **Cihazdaki build türü**, dolayısıyla 1. maddenin kesin kök nedeni.
- **TMDB'de filmlerin hâlâ var olması:** harici API çağrısı yapılmadı. Yalnız
  `tmdb_id` doluluğu ölçüldü.
- **Görsel:** düzen yalnız koddan çıkarıldı, cihazda bakılmadı.
- `supabase db query --linked` bu turda birkaç kez `login-role … unexpected EOF`
  verdi. Sorgular yeniden denendi ve raporlanan tüm sayılar başarılı çalışmalardan
  alındı.
