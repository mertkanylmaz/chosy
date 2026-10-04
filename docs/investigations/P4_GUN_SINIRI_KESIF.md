# P-4 KEŞİF — Gauntlet 18:00 ile Spotlight 00:00 gün sınırı

Temel: `ota/s1-s2-p1-p2` @ `4b1c5b6` · Tarih: 4 Eki 2026 · Mod: READ-ONLY
(kod değişikliği yok, commit yok, OTA yok).

## Yönetici özeti

1. **Üç ayrı "gün" var.** Gauntlet satır anahtarı sunucuda **UTC**
   (`utcDateString()`); gauntlet ekran kapısı istemcide **yerel 18:00**;
   şampiyon ekranı ve Spotlight anahtarı istemcide **yerel 00:00**. M2 Faz 2b
   (UTC → kullanıcı saat dilimi) **yapılmadı** — kodda açıkça "ertelendi" yazıyor.
2. **Şampiyon ekranı gece yarısını geçmiyor.** Dakikalık nabız yerel tarih
   değişince şampiyonu temizleyip `before_18`'e düşürüyor. Bu yüzden normal
   akışta bonus kartı yalnızca 18:00–24:00 arasında görünür ve bu pencerede
   gauntlet D'ye Spotlight D eşlik eder — **kart içinde D / D+1 karışması
   normal akışta oluşmuyor.**
3. **Asıl uyumsuzluk:** Spotlight D bulmacası 00:00–24:00 açık, ama ritüel
   içinden (kart) yalnızca son 6 saatte görünüyor. Sonuç ekranındaki
   "NEXT PUZZLE" sayacı ise gece yarısına sayıyor; bir sonraki ritüel
   18 saat daha sonra başlıyor.
4. **Sunucu Spotlight tarihini doğrulamıyor.** `get-daily-challenge` yalnızca
   biçime (YYYY-MM-DD) bakıyor, `submit-guess` (harf yolu dahil) bulmacayı
   `puzzle_id` ile buluyor, tarihe bakmıyor. Canlıda bugün itibarıyla
   **9 ileri tarihli** geçerli Spotlight satırı var (son tarih 13 Eki);
   tarih parametresi değiştirilerek alınıp oynanabilirler.
5. **Seçenek A (Spotlight anahtarı = yerel 18:00 sınırlı ritüel günü)
   bugünkü sunucuyla sunucu değişikliği olmadan çalışıyor** — ama yalnızca 4.
   maddedeki doğrulama boşluğu sayesinde. Ayrıca PRODUCT_OS §3.6 ve
   `chosy-conventions` §9.4 metinleriyle çelişiyor → ürün/CTO kararı (DUR).

## 1. Gauntlet "gün" tanımı

| Konu | Bulgu | Referans |
|---|---|---|
| Sunucu satır anahtarı | Normal akışta `let date = utcDateString()` — UTC tarihi. `users.timezone` yalnızca yazılıyor, anahtara bağlanmıyor. | `supabase/functions/generate-gauntlet/index.ts:891`, `:135-139`, `:852-854`; `supabase/functions/_shared/gauntletCore.ts:139-143` |
| M2 Faz 2b | Yapılmadı. "Normal akışın anahtarı hâlâ `utcDateString()` (M2 Faz 2b ertelendi)". | `supabase/functions/_shared/previousCycle.ts:19-20`; `generate-gauntlet/index.ts:139` |
| E-21 önceki döngü | Yeni kullanıcıya 18:00 öncesi "dün yerel 18:00'in UTC tarihi" anahtarı; isteğin `timezone` alanından hesaplanıyor. | `_shared/previousCycle.ts:10-17`, `generate-gauntlet/index.ts:872-901` |
| İstemci 18:00 kapısı | `UNLOCK_HOUR = 18`; `isUnlockedNow()` = `new Date().getHours() >= 18` (yerel). | `components/gauntlet/GauntletShell/unlockClock.ts:19`; `GauntletShell/index.tsx:134-144` |
| Bekleme sayacı hedefi | `nextUnlockAfter(now)` — sonraki yerel 18:00, tarih bileşenlerinden (DST güvenli). `countdownCore` yalnızca hedefe kalan ms'i hesaplıyor, saat bilgisi yok. | `unlockClock.ts:44-51`; `GauntletShell/index.tsx:152-156`, `:906-909`; `hooks/countdownCore.ts:30-40` |
| Şampiyon ekranı ne zaman düşüyor | Tamamlanma anında `completedDateKeyRef = localDateKey()` (yerel takvim günü). Dakikalık nabızda yerel gün değişmişse `reset_to_before_18` (18:00 öncesi) → şampiyon temizlenir. Yani **yerel 00:00 + ≤60 sn**. İstisna: E-21 `previous` modu 18:00'de `reset_and_load`. | `GauntletShell/index.tsx:159-162`, `:860-891`, `:1224`; `GauntletShell/cycleRules.ts` `pulseAction` |

**Yan gözlem (P-4 kapsamı dışında, M2'ye ait):** Anahtar UTC olduğundan
UTC− bölgelerde (ör. New York, EDT) yerel 20:00'den sonra açılan gauntlet
D+1 UTC anahtarını alır; ertesi akşam 18:00'de (hâlâ aynı UTC günü)
idempotency tamamlanmış satırı döndürebilir. Bu doğrulanmadı (ölçüm/cihaz
testi yapılmadı), yalnızca koddan çıkarım. UTC+3 (İstanbul) için 18:00–24:00
yerel = 15:00–21:00 UTC, aynı tarih; sorun oluşmuyor.

## 2. Spotlight gün anahtarı

| Konu | Bulgu | Referans |
|---|---|---|
| Oyun ekranı | `new Date().toLocaleDateString('en-CA')` — yerel takvim günü. | `components/games/Spotlight/index.tsx:219-220` |
| Bonus kartı | `localDayKey(new Date())` — yerel takvim günü, **ayrı implementasyon** (aynı değer beklenir, aynı kod değil). | `components/gauntlet/SpotlightBonusCard/useSpotlightCardState.ts:56`; `utils/askDecision.ts:159-163` |
| `get-daily-challenge` doğrulaması | Yalnızca boşluk + `/^\d{4}-\d{2}-\d{2}$/`. Bugünden farklı / gelecek tarih **reddedilmiyor**. Satır `.eq('puzzle_date', puzzleDate)` ile tarihe göre seçiliyor. | `supabase/functions/get-daily-challenge/index.ts:130-148` |
| View filtresi | `public_daily_puzzles`: `validation_status='valid' AND is_emergency_pool=false AND date IS NOT NULL` — **tarih üst sınırı yok**. | `supabase/migrations/064_puzzle_view_strip_solution.sql:62-64` |
| `submit-guess` / harf | `submit-letter` adında ayrı fonksiyon **yok**; harf yolu `submit-guess` içinde `spotlight_letter` alanı. Bulmaca `.eq('id', puzzleId)` ile alınıyor, `puzzle.date` yalnızca çift-XP kontrolünde kullanılıyor; tarih doğrulaması yok. | `supabase/functions/submit-guess/index.ts:243`, `:258-260`, `:372-376`, `:535`; `supabase/functions/` listesi |
| `puzzle_no` | Sunucuda `date <= puzzleDate` sayımı — istemcinin gönderdiği tarihten türüyor. | `get-daily-challenge/index.ts:178-185` |

## 3. "NEXT PUZZLE" geri sayımı

`components/games/Spotlight/index.tsx:140-149` — `useCountdown()`:
`midnight.setHours(24, 0, 0, 0)` → **yerel gece yarısına** sayıyor.
`:174`'te çağrılıyor, `:510`'da sonuç kartına `countdown` olarak geçiyor;
etiket `components/games/ResultCard/index.tsx:365`
(`games.result.next_puzzle_label`).

Not: Aynı ekranda dosya-yerel bir `useCountdown` var; `hooks/useCountdown.ts`
(gauntlet'in kullandığı, duvar saatinden senkron) ile isim çakışıyor ama
farklı kod. Bu dosyadaki sürüm `setInterval` tikine dayanıyor.

## 4. useSpotlightCardState ve gece yarısı

- Anahtar: `localDayKey(new Date())` (`useSpotlightCardState.ts:56`).
- `enabled` yalnızca `shellState === 'completed_today' && champion !== null`
  iken true (`GauntletShell/index.tsx:1408-1414`). Okuma `useFocusEffect` ile
  — **yalnızca odak alındığında**, zamanlayıcıyla değil.
- Şampiyon gece yarısını geçmediği için (bkz. §1) normal akışta "gauntlet D
  şampiyonu + Spotlight D+1" kombinasyonu **oluşmuyor**: 00:00'dan sonraki ilk
  nabızda şampiyon ve kart birlikte kalkıyor.
- Kalan dar pencere: 23:59'da kart okundu, ekran açık; 00:00–00:01 arası
  (nabız gelene kadar) kart D durumunu gösterir, karta basılırsa oyun ekranı
  `loadPuzzle` ile **D+1** bulmacasını açar. ≤60 sn'lik pencere; ölçülmedi.
- E-21 `previous` modu: yeni kullanıcı sabah önceki döngüyü (dün 18:00
  anahtarı) bitirirse şampiyon + kart gösterilir, kart **bugünün (D)**
  Spotlight'ını okur. Akşam 18:00'de normal gauntlet D gelince aynı Spotlight
  D zaten oynanmış görünür (Solved/Failed). Davranış koddan çıkarım, cihazda
  doğrulanmadı.
- Bekleme ekranındaki son şampiyon (`useLastChampion`,
  `GauntletShell/index.tsx:913`) bonus kartı çizmiyor — `WaitingChampion`
  içinde Spotlight referansı yok (grep).

## 5. Sınırdan etkilenen diğer yüzeyler

| Yüzey | Gün anahtarı | Spotlight sınırından etkisi | Referans |
|---|---|---|---|
| K-46 arşiv (`get-archive-status`) | UTC (`utcDateString(-1)`, `(-7)`); yalnızca `daily_gauntlets` | **Etkilenmiyor** — Spotlight/`daily_puzzles` okumuyor. UTC kayması "bilinen sınırlama" olarak belgeli. | `supabase/functions/get-archive-status/index.ts:25-35`, `:256-257` |
| PostHog | Spotlight event'lerinde tarih alanı yok; `game_daily_opened` / `game_daily_completed` `puzzle_no` taşıyor | Anahtar değişirse aynı saatte farklı `puzzle_no` gider; event şeması değişmez. | `utils/gameAnalytics.ts:12-13`, `:53-64`; `Spotlight/index.tsx:251` |
| S-1 ask günü | `today = localDayKey(now)` → `askedToday` (`lastAskDay`) + `readSpotlightState(today)` | **Etkileniyor.** Ask kararı `spotlightState === 'in_progress'` iken bastırılıyor; bu durum aynı `today` anahtarıyla okunuyor. Spotlight anahtarı değişirse bu okuma da aynı anahtara taşınmalı, yoksa kart ile ask farklı bulmacaya bakar. `lastAskDay`'in takvim günü mü ritüel günü mü olacağı ayrı karar. | `services/askCoordinator.ts:66-74`, `:110-118`, `:151-153`; `utils/askDecision.ts:78-80`, `:91-93` |
| askCoordinator gün sayımı (`dayIndex`) | `getChampionDatesSince` → `daily_gauntlets.date` sayısı (UTC anahtarları) | Spotlight sınırından **etkilenmiyor**; UTC anahtarına bağlı. | `services/askCoordinator.ts:77-82`; `services/gauntletService.ts:786-797` |
| Bildirim | Yerel 18:00 (`UNLOCK_HOUR`) | Spotlight'a özel gece yarısı bildirimi bulunamadı. | `services/pushNotifications.ts:402` |
| Kuyruk derinliği alarmı | `reportQueueDepth(service, gameId, puzzleDate)` istemci tarihiyle | Anahtar ileri kayarsa derinlik 1 gün eksik görünür (eşik etkisi ölçülmedi). | `get-daily-challenge/index.ts:150` |
| Spotlight'a ritüel dışı giriş | `app/games/spotlight.tsx`, `app/games/index.tsx`, `components/Discover/GamesSection/index.tsx`, `PlayNextBridge` rotaları var | Bu girişler ritüel saatinden bağımsız; canlı tab yapısında hangisinin bağlı olduğu **doğrulanmadı**. | `app/games/`, grep |

## 6. Seçenek A — Spotlight anahtarı = yerel 18:00 sınırlı ritüel günü

**Sunucu değişikliği zorunlu mu? Hayır (bugünkü kodla).**
`get-daily-challenge` herhangi bir geçerli biçimli tarihi kabul ediyor,
`submit-guess` tarihe bakmıyor; ileri tarihli satırlar mevcut (§Ölçüm). İstemci
18:00'den itibaren yeni anahtarı gönderirse sunucu sorunsuz cevaplar.

**Ama:**
- Bu, §2'deki doğrulama boşluğuna yaslanıyor. İleride sunucuya "yalnızca
  bugün" doğrulaması eklenirse, ritüel penceresini (UTC'ye göre en fazla
  ±1 gün) kabul edecek biçimde tasarlanması gerekir → o noktada sunucu işi.
- PRODUCT_OS §3.6 "Gün dönümü yerel gece yarısı"
  (`docs/os/1_CHOSY_PRODUCT_OS.md:157`) ve `chosy-conventions` §9.4
  ("cihaz yerel tarihine anahtarlanır") metinleriyle çelişiyor.
- Anahtar tanımı iki türlü kurulabilir ve davranışları farklı:
  - (A1) "son yerel 18:00'in tarihi": 18:00–24:00 bugünküyle aynı; 00:00–18:00
    arası dünün bulmacası sürer. Şampiyon penceresinde değişiklik yok.
  - (A2) "sonraki yerel 18:00'in tarihi": 18:00'de yarının tarihli bulmacası
    açılır; kart ilk kez farklı bir bulmaca gösterir.
- İstemcide değişecek okuma noktaları (uygulama yok, yalnızca envanter):
  `Spotlight/index.tsx:219` (oyun), `:140-149` (sayaç),
  `useSpotlightCardState.ts:56` (kart), `askCoordinator.ts:111`, `:153`
  (ask Spotlight durumu). Hepsi aynı tek fonksiyondan beslenmezse kart / oyun /
  ask farklı bulmacaya bakabilir — bugün bile iki ayrı implementasyon var
  (`toLocaleDateString('en-CA')` ve `localDayKey`).
- `puzzle_no` ve Daily Chest çift-XP (`applyDoubleXp`, `puzzle.date`
  karşılaştırması, `submit-guess/index.ts:179-196`) bulmaca tarihine
  bağlı; A ile çift-XP günü bulmaca tarihine göre işlemeye devam eder,
  takvim gününe göre değil. Dondurulmuş oyunlar için önemsiz, Spotlight için
  etkisi ürün kararı.

## Ölçülmüş sayılar

```sql
select current_date as db_today, now() as db_now,
       count(*) filter (where date > current_date) as future_rows,
       max(date) as max_date,
       count(*) filter (where date = current_date) as today_rows
from public.daily_puzzles
where game_type='spotlight' and is_emergency_pool=false and validation_status='valid';
```
`supabase db query --linked`, 2026-10-04 14:03 UTC:
`db_today=2026-10-04 · future_rows=9 · max_date=2026-10-13 · today_rows=1`.

Bu 9 satır `public_daily_puzzles` filtresinden geçer (filtre aynı üç koşul,
`064:62-64`), yani tarih parametresi değiştirilerek istemciye iner. Çözüm
alanı view'da yok (064) — cevap sızıntısı değil, **ileri bulmaca erişimi**.

## Bulgular tablosu

| # | dosya:satır | açıklama | iş |
|---|---|---|---|
| B1 | `generate-gauntlet/index.ts:891` | Gauntlet satır anahtarı UTC; M2 Faz 2b yapılmadı | L (M2) |
| B2 | `GauntletShell/index.tsx:159-162`, `:860-891` | Şampiyon yerel 00:00'da düşüyor (≤60 sn nabız) | — (durum) |
| B3 | `Spotlight/index.tsx:140-149` | "NEXT PUZZLE" yerel gece yarısına sayıyor | S |
| B4 | `Spotlight/index.tsx:219` vs `askDecision.ts:159` | Aynı gün anahtarı iki ayrı implementasyon | S |
| B5 | `get-daily-challenge/index.ts:130-148`; `064:62-64` | Tarih doğrulaması / view tarih sınırı yok; 9 ileri bulmaca erişilebilir | M |
| B6 | `submit-guess/index.ts:372-376` | Harf/tahmin yolu bulmaca tarihini kontrol etmiyor | S–M |
| B7 | `askCoordinator.ts:66-74`, `:110-118` | Ask, Spotlight durumunu kendi `today` anahtarıyla okuyor — anahtar değişirse eşlenmeli | S |
| B8 | `useSpotlightCardState.ts:50-91` | Kart yalnız odakta okunuyor; gece yarısı ≤60 sn penceresinde bayat kart → D+1 oyun | S |

## DUR NOKTASI gerektiren maddeler

- **D1 — Seçenek A ürün kuralını değiştiriyor.** PRODUCT_OS §3.6 ("Gün
  dönümü yerel gece yarısı") ve `chosy-conventions` §9.4 yeniden yazılmalı;
  A1/A2 tanım seçimi ve `lastAskDay`'in hangi güne bağlanacağı ürün kararı.
- **D2 — B5/B6 sunucu tarih doğrulaması.** Kapatılması Edge Function
  sözleşme/davranış değişikliği (ve muhtemelen view değişikliği = migration).
  A seçilirse doğrulamanın ritüel penceresine göre tasarlanması gerekir.
- **D3 — M2 Faz 2b (B1).** Gauntlet anahtarının kullanıcı saat dilimine
  bağlanması; hafıza notu: önce `users.timezone` 'UTC' sayımını yeniden al.
  Bu iş P-4'ün kapsamı değil ama A'nın "ritüel günü" ile sunucunun "gauntlet
  günü"nü tek tanıma bağlamanın ön koşulu.

## Öneri (karar CTO'nun)

- Bulgulara göre en dar seçenek **A1 (yalnızca istemci, tek anahtar
  fonksiyonu)**: şampiyon penceresinde (18:00–24:00) davranış bugünküyle aynı
  kalır, yalnızca 00:00–18:00 arasında Spotlight dünkü bulmacada kalır ve
  "NEXT PUZZLE" sonraki 18:00'e sayar. Sunucu değişmez.
- Alternatif olarak yalnızca B3 (sayaç metni/ hedefi) ele alınabilir; anahtar
  gece yarısında kalır, uyumsuzluk yalnızca görünürde azalır.
- B5/B6 hangi seçenek alınırsa alınsın ayrı bir iş olarak kalıyor.

## Doğrulanamayanlar

- Cihazda gece yarısı geçişi (B2, B8) gözlenmedi; davranış koddan çıkarım.
- UTC− bölgelerde gauntlet anahtarının akşam ortasında D+1'e dönmesi
  (§1 yan gözlem) ölçülmedi.
- Spotlight'a ritüel dışı giriş rotalarının (games hub / Discover) canlı tab
  yapısında bağlı olup olmadığı doğrulanmadı.
- `users.timezone` dağılımı bu turda yeniden ölçülmedi.
- Ritüel dışı Spotlight oynanma oranı (PostHog) ölçülmedi.
