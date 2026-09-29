# K-32 / recompute-taste-vector — Keşif Raporu

**Tarih:** 29 Eyl 2026 · **Mod:** salt okunur (tek yazılan dosya bu rapor)
**Kapsam:** `recompute-taste-vector` girdi/çıktı/maliyet · çağıranlar · Profile
Cinema DNA kartı · K-32 `user_confidence` · Plus/paywall DNA vaatleri · A/B/C
**A/B/C tanımı (AskUserQuestion, bu tur):** soru *"Rapordaki A / B / C
seçenekleri repoda tanımlı değil. Tabloyu hangi tanımlarla kurayım?"* → cevap
*"A cron · B submit-choice · C vaadi geri çek (Önerilen)"*.

---

## Yönetici özeti

1. **Profile'daki Cinema DNA kartı `cinema_dna`'yı hiç okumuyor.** Kaynağı
   mood-search döneminin `sessions.parsed_profile_json` kolonu
   (`services/profileService.ts:160-171`). Gauntlet oynayan 12 kullanıcının
   **9'unda** bu kaynak boş → kart kalıcı olarak *"Birkaç akşam daha, zevkini
   tanıyacağım."* gösteriyor; gauntlet oynamak bu metni hiçbir zaman değiştirmiyor.
2. **`recompute-taste-vector` için tetikleyici yok** — repo, `cron.job`,
   `pg_proc` kaynak kodu ve `choice_events`/`watch_feedback` trigger'ları
   canlıda tarandı: **0** eşleşme. `cinema_dna` 1 satır, son hesap
   2026-08-07; gauntlet oyuncularının hiçbirinde `cinema_dna` satırı yok.
3. **Fonksiyon LLM çağırmıyor.** Saf 384 boyutlu vektör aritmetiği + ~8
   PostgREST round-trip (tek kullanıcı modu). Maliyet Edge Function çağrı
   sayısından ibaret.
4. **İki ayrı, birbiriyle tutarsız "güven" formülü var:** `generate-gauntlet`
   `choice_events` satır sayısı / **18** (`generate-gauntlet/index.ts:121,875`);
   `recompute-taste-vector` yalnız `outcome='choice'` + feedback / **50**
   (`app_config.taste_vector_config.full_confidence_signals`). En yüksek
   sinyalli kullanıcı bugün ilkinde ≈%61, ikincisinde %20 çıkar. Ayrıca D-06
   (≥7 tamamlanmış gauntlet) eşiğini bugün **0** kullanıcı karşılıyor (maks 3).
5. **"Taste evolves" vaadi 3 canlı yüzeyde** (Profile Plus CTA, kaçırılan gün
   paywall'u, DNA kartı dokunuş paywall'u). Arkasında zevk değişimini gösteren
   bir özellik repoda bulunamadı (`evolution|tasteHistory|taste_evol` → 0 eşleşme).

---

## 1. recompute-taste-vector — girdi, çıktı, maliyet

| Konu | Bulgu | Referans |
|---|---|---|
| Girdi (istek) | `POST {user_id}` (tek kullanıcı) veya `{full:true, confirm_reset:true}` | `supabase/functions/recompute-taste-vector/index.ts:85-89, 530-544` |
| Auth | Yalnız `service_role` JWT claim'i; aksi 403 | `index.ts:507-521` |
| Okunan tablolar | `choice_events` (id, user_id, session_id, round, film_a, film_b, winner, outcome, low_confidence, created_at) · `watch_feedback` (id, user_id, film_id, response, created_at) · `users.archetype_id` · `cinema_dna.taste_computed_at` · `film_profiles.profile_vector` · `app_config.taste_vector_config` | `index.ts:268-308, 158-161, 553-555` |
| Yazılan kolonlar | `cinema_dna`: `taste_vector`, `user_confidence`, `taste_signal_count`, `taste_computed_at`, `taste_algorithm_version` — `upsert onConflict user_id` | `index.ts:207-217` |
| Kaynak tablolara yazma | Yok (yalnız okur) | `index.ts:21-24` |
| LLM | **Yok.** `tasteVector.ts`, `archetypeEngine.ts`, fonksiyon dosyasında `anthropic/openai/fetch(` eşleşmesi 0. Hesap `computeTasteVector` içinde shrinkage + normalize | `supabase/functions/_shared/tasteVector.ts:344-475` |
| Vektör boyutu | 384 (`VECTOR_DIM`) | `services/vectorEncoder.ts:92`, `tasteVector.ts:14` |
| Sinyal tanımı | Yalnız `outcome='choice'` + `watch_feedback`; `neither/seen/timeout` sinyal değil | `tasteVector.ts:318-330` |
| Güven | `w = min(1, signal_count / full_confidence_signals)`; canlı değer 50 | `tasteVector.ts:458`; ölçüm §Ölçülmüş sayılar |
| Idempotent mi | **Sonuç açısından evet**: her çağrı kullanıcının tüm geçmişini yeniden okur, sıralama deterministik (`created_at, id`). Değişen tek alan `taste_computed_at`. Çıktı, `film_profiles.profile_vector` veya `app_config` değişirse değişir. Eşzamanlı iki çağrı aynı değeri upsert eder. | `index.ts:245-261, 273-275, 153-154` |
| Full mod | Önce **tüm** satırlarda taste_* kolonlarını sıfırlar, sonra `users` tablosundaki **her** kullanıcıyı sırayla yazar (sinyalsiz kullanıcıya arketip prior'u). Atomik değil; yarıda kalırsa kalanlar NULL. | `index.ts:341-491` |
| Full mod yan etkisi | `upsert` satırı olmayan kullanıcıya yeni `cinema_dna` satırı açar; diğer kolonlar default (knowledge=0, rank_id=1 …). 279 kullanıcıda ≈278 yeni satır. Bu satırları `hooks/useCinemaDna.ts:87` (dondurulmuş oyun hub'ı) okur. | `index.ts:207`; kolon default'ları ölçümü |
| Kullanıcı başına süre | **Ölçülmedi** (son çağrı 07.08; log saklama süresi dışında). Round-trip sayımı: `choice_events` 2 (dolu sayfa + boş sayfa, `fetchAllPages` boş sayfada kırılır) + `watch_feedback` 2 + `users` 1 + `cinema_dna` 1 + `film_profiles` 1 + upsert 1 = **≈8**. Kullanıcı başına olay en fazla 11. | `index.ts:118-136, 268-322` |
| Deploy durumu | ACTIVE, versiyon 21, deploy 2026-08-07 19:08. Import ettiği `_shared/gameUtils.ts` sonrasında değişti (`de13881`, 12 Ağu). Canlı bundle ile repo farkı **indirilip karşılaştırılmadı**. | `supabase functions list`; `git log` |

## 2. Çağıran kim — "tetikleyici yok" kanıtı

| Kontrol | Sonuç | Yöntem |
|---|---|---|
| Repo | Fonksiyon adı yalnız kendi dosyasında, dokümanlarda, `_shared/auth.ts:145` yorumunda ve `services/archetypeEngine.ts:16` yorumunda geçiyor; **çağrı yok** (istemci, başka Edge Function, script) | `git grep -n -i "recompute-taste-vector\|recompute_taste_vector\|recomputeTaste"` |
| Edge→Edge çağrı deseni | Hiçbir Edge Function'da `functions/v1` fetch'i veya `waitUntil` yok | `git grep waitUntil -- supabase/functions` → 0 |
| `cron.job` | 8 job, `command ILIKE '%taste%'` → **0** | canlı SQL |
| `pg_proc` | `prosrc ILIKE '%recompute-taste%' OR '%recompute_taste%'` → **0** | canlı SQL |
| Trigger | `choice_events` → **none**, `watch_feedback` → **none** | canlı SQL (`pg_trigger`, internal hariç) |
| Sonuç izi | `cinema_dna` 1 satır, `taste_computed_at` maks **2026-08-07 19:09**, `user_confidence > 0` → **0** | canlı SQL |

## 3. Profile Cinema DNA kartı — okunan alan ve her durumdaki metin

**Okunan alanlar** (`app/(tabs)/profile.tsx:875-884`):
- `profile` ← `getLastParsedProfile(userId)` → `sessions.parsed_profile_json`,
  son satır (`services/profileService.ts:158-178`)
- `insights` ← `getSwipeInsights(userId)` → `watchlist` + `films(genres, director)`
  (`services/profileService.ts:90-146`)
- `archetypeId` prop'u geçiliyor ama `TasteDNA` içinde kullanılmıyor
  (`components/Profile/TasteDNA/index.tsx:249` imza, gövdede referans yok)
- `cinema_dna` / `user_confidence` **okunmuyor**.

`sessions` tablosunu yazan tek istemci yolu Pro Mode mood araması:
`components/Home/MoodSearchScreen/index.tsx:287` → `services/watchlist.ts:370-395`
(`saveSession`); ekran yalnız `app/pro-mode.tsx:35` üzerinden erişilir
(Profile satırı `app/(tabs)/profile.tsx:1669`). Sunucu tarafında
`supabase/functions/recommend/index.ts:212` de `INSERT INTO sessions` içeriyor.

| Durum | Görünen | Referans |
|---|---|---|
| `loading` | Skeleton, metin yok | `TasteDNA/index.tsx:264-265` |
| `sessions` satırı var | Baskın duygu satırı (`tasteDNA.emotion_*`) + watchlist'ten ilk 3 tür chip'i + `tasteDNA.summary` — EN *"You prefer %{pace}, %{emotion} films with %{depth}."* / TR *"%{pace}, %{emotion} filmler ve %{depth} tercih ediyorsun."* | `TasteDNA/index.tsx:188-245, 103`, `locales/en.json:718`, `locales/tr.json:718` |
| `sessions` satırı yok | `tasteDNA.emptyHint` — EN *"A few more evenings and I’ll know your taste."* / TR *"Birkaç akşam daha, zevkini tanıyacağım."* | `TasteDNA/index.tsx:268-271`, `locales/*.json:692` |
| Okuma hatası | Hata `null`'a iniyor (yalnız `__DEV__` console) → "satır yok" ile **aynı** metin; Sentry yok | `profileService.ts:172-177` |
| `premiumStatus === 'free'` | Kart aynı; dokunuş `mood_history_tap` → `PaywallMoodHistory` açar (bkz. §5) | `profile.tsx:1499-1509`, `services/conversion/triggerOrchestrator.ts:56-57` |
| Başlık | `profile.tasteDNA` — *"Cinema DNA" / "Sinema DNA"* | `profile.tsx:1498`, `locales/*.json:480` |

Not: `emptyHint` "birkaç akşam" (gauntlet ritmi) vaat ediyor; ama metni
değiştirecek tek veri kaynağı mood-search oturumu. Gauntlet oyuncularının 9/12'sinde
`sessions` profili yok.

## 4. K-32 ve `user_confidence`

**K-32 tanımı:** *"DNA dashboard değil narrative. Üç yerde görünür: Champion
('Tonight you leaned…') · Profile ('You're becoming…') · Milestone ('Your taste
has changed')."* — `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md:104`.
Sprint belgesi K-32'yi Profile'da *"Seni %N tanıyorum" + 9 segment* olarak
yorumluyor — `docs/05_SPRINTS/V1_DESIGN_OS_UYUM_SPRINT.md:309, 328`.
**D-06:** ≥7 tamamlanmış gauntlet'ten önce yüzde gösterilmez; o zamana kadar
*"Your Cinema DNA is forming."* — `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md:298-304`.

**Tanım yerleri:**

| Yer | Ne | Referans |
|---|---|---|
| DB kolonu | `cinema_dna.user_confidence real NOT NULL DEFAULT 0`, CHECK 0..1, yorum *"'Seni %35 tanıyorum' göstergesi bu kolonu okur"* | `supabase/migrations/074_cinema_dna_taste_axis.sql:34, 57-58, 78-80` |
| Yazan | Yalnız `recompute-taste-vector` | `index.ts:211, 382` |
| Formül | `min(1, signal_count / 50)` | `tasteVector.ts:458`, `app_config.taste_vector_config` |
| Sözleşme alanı | `DailyGauntlet.userConfidence` (KİLİTLİ) | `types/gauntlet.ts:70` |
| Sözleşmeyi dolduran | `generate-gauntlet`, **ayrı formül**: tüm `choice_events` satırları / 18 (neither/seen/timeout dahil) | `supabase/functions/generate-gauntlet/index.ts:117-121, 343-354, 874-875` |
| Gösterge bileşeni | `ConfidenceMeter` — mevcut, render edilmiyor | `components/gauntlet/ConfidenceMeter/index.tsx:22-25`, `components/gauntlet/GauntletShell/index.tsx:1590-1595` |
| String | `gauntlet.confidence` *"I know %{percent}% of you" / "Seni %%{percent} tanıyorum"* | `locales/en.json:1479`, `locales/tr.json:1479` |
| D-06 metni | *"Your Cinema DNA is forming"* için locale key **yok** (`forming|oluşuyor` → 0) | `grep` |

**Neden hesaplanmıyor:** kolonu yazan tek fonksiyonun tetikleyicisi yok (§2).

**Eksik olanlar (durum tespiti, öneri değil):**
1. Tetikleyici (cron / submit-choice / başka).
2. Profile kartının `cinema_dna` okuması — bugün `sessions` okuyor.
3. İki güven formülü arasında tek tanım (18 vs 50; sinyal sayımı farklı).
4. D-06 eşik mantığı ve *"forming"* metni.
5. K-32'nin anlatı cümleleri (*"You're becoming…"*, *"Tonight you leaned…"*,
   *"Your taste has changed"*): 384 boyutlu `taste_vector`'den K-30'un 6
   eksenine (`KAPSAM_KILIDI.md:102`) ve cümleye çeviren bir katman repoda
   bulunamadı. `archetypeEngine` en yakın arketibi verir (`nearest_archetype_id`,
   `index.ts:235`) ama bu kolon `cinema_dna`'ya yazılmıyor.

## 5. Plus / paywall — DNA ve "taste evolves" vaadi

Canlı yüzeylerde kullanılan key'ler:

| Key | EN / TR | Ekran | Referans |
|---|---|---|---|
| `profile.chosyProSubtitle` | *Replay missed days · see how your taste evolves* / *Kaçırdığın günleri oyna · zevkinin değişimini gör* | Profile → Plus CTA (yalnız `free`) → `profile_upgrade` paywall | `locales/*.json:563`, `app/(tabs)/profile.tsx:1647-1657, 1018-1019` |
| `contextPaywall.missedDayValueIdentity` | *See how your taste evolves* / *Zevkinin nasıl değiştiğini gör* | `PaywallMissedDayArchive` (K-47 "iki değer"ın ikincisi) ← `ArchiveTrigger` | `locales/*.json:1350`, `components/paywalls/PaywallMissedDayArchive/index.tsx:62-75`, `components/gauntlet/ArchiveTrigger/index.tsx:107` |
| `contextPaywall.moodHistoryTitle` | *Unlock Your Mood History* / *Ruh Hali Gecmisini Ac* | `PaywallMoodHistory` ← Profile DNA kartına dokunuş (free) | `locales/*.json:1313`, `components/paywalls/PaywallMoodHistory/index.tsx:45` |
| `contextPaywall.moodHistorySubtitle` | *See how your taste has evolved over the last 30 days. Discover your Cinema DNA.* / *Son 30 gunde zevkinin nasil degistigini gor. Sinema DNA'ni kesfet.* | aynı | `locales/*.json:1314`, `PaywallMoodHistory/index.tsx:48` |
| `tasteDNA.emptyHint` | *A few more evenings and I’ll know your taste.* / *Birkaç akşam daha, zevkini tanıyacağım.* | Profile DNA kartı (herkes) | §3 |
| `profile.tasteDNA` | *Cinema DNA* / *Sinema DNA* | Profile bölüm başlığı | §3 |
| `authPrompt.body` | *Your streak and taste profile are saved here — free…* / *Streak'in ve tat profilin burada kayıtlı…* | `AuthPromptSheet` (paywall değil; "taste profile" vaadi) | `locales/*.json:604`, `components/auth/AuthPromptSheet.tsx:119` |

Dondurulmuş oyun yüzeyleri (DNA kelimesi, zevk vaadi değil, bilgi ekseni):
`games.dna.section_title` (`components/games/DnaSummaryCard/index.tsx:38`),
`games.dna_updated` (`components/games/DnaXpReveal/index.tsx:173`,
`components/games/QuickResult/index.tsx:203`).

`app/` ve `components/` altında kullanımı bulunamayan eşleşen key'ler:
`entry.pickDescPreferenceMatch` (`locales/*.json:263`), `onboarding.mysteryDesc`
(`:320`), `profile.retakeQuizConfirmMessage` (`:548`).

Vaadin karşılığı: `evolution|tasteHistory|taste_history|taste_evol` → `app/`,
`components/`, `services/`, `hooks/`, `supabase/functions/` altında **0**
özellik eşleşmesi. Plus kullanıcısına zevk değişimini gösteren bir ekran
bulunamadı.

## 6. A / B / C — maliyet ve karmaşıklık

Ortak not: **A ve B tek başına kullanıcının gördüğü hiçbir şeyi değiştirmez** —
Profile kartı `cinema_dna` okumuyor (§3). A/B'nin görünür etkisi için kart
okuması + D-06 eşiği + metin işi ayrıca gerekir (tabloda "görünürlük için ek").

| | **A — pg_cron** | **B — submit-choice sonrası** | **C — vaadi geri çek** |
|---|---|---|---|
| Ne | Gece job'u `net.http_post` ile fonksiyonu çağırır | Her `choice` sonrası kullanıcı için hesap | Tetikleyici eklenmez; §5 metinleri ve kartın boş durumu düzeltilir |
| LLM maliyeti | 0 | 0 | 0 |
| Çağrı hacmi (bugünkü veri) | 1/gün | ≈ seçim başına 1; 29 Eyl'e kadar toplam 42 `choice` | 0 |
| DB yükü | Full mod: 279 kullanıcı × 1 upsert + tam tablo okuması; tek kullanıcı döngüsü yazılırsa yalnız aktifler | ≈8 round-trip/seçim (§1) | 0 |
| Tazelik | ≤24 saat gecikme | Anlık | — |
| `watch_feedback` kapsamı | Kapsar (full mod ikisini de okur) | **Kapsamaz** — feedback `submit-watch-feedback`'ten yazılıyor (`supabase/functions/submit-watch-feedback/index.ts:194`); ayrı çağrı gerekir | — |
| Önkoşul / engel | Vault `cron_service_role_key` bugün **401** veriyor (ölçüm: `net._http_response` son 7 gün tek satır, 2026-09-29 00:05, 401) → çözülmeden job ölü doğar | Edge→Edge çağrı deseni repoda **yok** (B1); ya da `_shared/tasteVector.ts` submit-choice'a import edilir (B2) — hot path'e ≈8 round-trip | K-47 (paywall "iki değer") ve metin kararları bible'da |
| Değişen dosya türü | Migration (cron.schedule) · muhtemelen fonksiyonda "yalnız aktif kullanıcılar" modu | `submit-choice` (+ `submit-watch-feedback`) | `locales/en.json` + `tr.json` (parite), belki `PaywallMissedDayArchive`, `TasteDNA` |
| Risk | Full mod atomik değil + sıfırlama penceresi; 278 yeni `cinema_dna` satırı (dondurulmuş hub okur) | `submit-choice` gauntlet-contract alanında; hata yönetimi (seçim başarılı, recompute başarısız) tanımlanmalı | Plus değer önerisi zayıflar; K-32 kapanmaz |
| K-32'yi kapatır mı | Hayır, yalnız veriyi üretir | Hayır, yalnız veriyi üretir | Hayır, erteler |
| Görünürlük için ek | Kart `cinema_dna` okuması + D-06 + metin (M) | aynı (M) | — |
| Tahmini büyüklük | **M** (+ Vault engeli) | **M–L** | **S** |

## Ölçülmüş sayılar

Tümü `supabase db query --linked`, 29 Eyl 2026, salt SELECT.

```sql
select count(*) from cron.job;                                             -- 8
select count(*) from cron.job where command ilike '%taste%';               -- 0
select count(*) from pg_proc where prosrc ilike '%recompute-taste%'
   or prosrc ilike '%recompute_taste%';                                    -- 0
-- pg_trigger (not tgisinternal) on choice_events / watch_feedback         -- none / none
select count(*) from cinema_dna;                                           -- 1
select count(*) from cinema_dna where taste_computed_at is not null;       -- 1
select max(taste_computed_at) from cinema_dna;                             -- 2026-08-07 19:09:05+00
select count(*) from cinema_dna where user_confidence > 0;                 -- 0
select count(*) from users;                                                -- 279
select count(*) from choice_events;                                        -- 51
select count(*) from choice_events where outcome='choice';                 -- 42
select count(distinct user_id) from choice_events where user_id is not null; -- 12
select max(c) from (select count(*) c from choice_events
  where user_id is not null group by user_id) s;                           -- 11
select count(*) from watch_feedback;                                       -- 3
select count(*) from sessions;                                             -- 145
select count(*) from sessions where created_at > now()-interval '30 days'; -- 7
select max(created_at) from sessions;                                      -- 2026-09-29 13:27
select count(distinct user_id) from sessions where parsed_profile_json is not null; -- 57
select value from app_config where key='taste_vector_config';
  -- full_confidence_signals: 50, round_weights {1:1.0,2:0.9,3:0.8}, ...
```

Kart kapsamı (gauntlet oyuncusu = `choice_events.user_id` distinct):

```sql
-- gauntlet_users                          12
-- ... with sessions.parsed_profile_json    3
-- ... without                              9
-- ... with cinema_dna row                  0
select count(*) from users where archetype_id is not null;                 -- 38
-- choice+timeout sinyali / kullanıcı: 9,6,3,3,3,3,3,3,3,3,3,3
-- taste sinyali (choice + watch_feedback<>'skipped') ilk 3: 10, 7, 3
select count(*) filter (where n>=7), max(n), count(*) from
  (select user_id, count(*) n from daily_gauntlets
   where champion_film_id is not null and scope='personal' group by 1) x;  -- 0 / 3 / 11
select status_code, count(*), max(created) from net._http_response
  where created > now()-interval '7 days' group by 1;                      -- 401 / 1 / 2026-09-29 00:05
```

Türetilmiş: en yüksek sinyalli kullanıcı için `recompute-taste-vector` formülü
10/50 = **0.20**; `generate-gauntlet` formülü 11/18 ≈ **0.61**.

## DUR NOKTASI gerektiren maddeler

1. **A (cron):** yeni migration + yeni cron job + Vault anahtar sorunu
   (401). Cron'un full modla mı, yeni bir "aktif kullanıcılar" moduyla mı
   çağıracağı fonksiyon sözleşmesi değişikliği.
2. **B (submit-choice):** Edge→Edge çağrı yeni bir pattern (repoda 0 örnek);
   alternatif B2, `submit-choice`'a yeni bağımlılık/hot-path işi — her ikisi de
   gauntlet-contract alanı. `watch_feedback` için ikinci tetikleme noktası.
3. **İki güven formülü (18 vs 50):** `DailyGauntlet.userConfidence` kilitli
   sözleşme alanı (`types/gauntlet.ts:70`); hangi tanımın geçerli olduğu CTO kararı.
4. **Kartın veri kaynağı:** `sessions` → `cinema_dna` geçişi; K-32 anlatı
   cümleleri için 384-boyut → 6-eksen (K-30) → metin katmanı yeni bir pattern.
5. **C (metin):** `missedDayValueIdentity` K-47'nin iki değerinden biri;
   değişimi bible kararı.
6. **Full mod yan etkisi:** ≈278 yeni `cinema_dna` satırı (dondurulmuş hub
   `useCinemaDna` okur).

## Doğrulanamayanlar

- **Kullanıcı başına süre:** ölçülmedi. Fonksiyonun son çağrısı 07.08; Edge log
  saklama süresi dışında. Yukarıdaki değer round-trip sayımıdır, ms değil.
- **Canlı bundle = repo mu:** deploy 07.08, `_shared/gameUtils.ts` 12.08'de
  değişti; canlı kod indirilip diff alınmadı.
- **Vault 401'in kapsamı:** `net._http_response` yalnız 1 satır döndü
  (pg_net yanıt tablosu kısa süre saklıyor); hangi job'ların etkilendiği bu turda
  ayrıca ölçülmedi. Hafıza kaydı "iki anahtar kuşağı" ile tutarlı, ama bu
  turdan bağımsız doğrulanmadı.
- **`recommend` Edge Function'ın `sessions` yazma yolunun canlı olup olmadığı**
  (`supabase/functions/recommend/index.ts:212`) kontrol edilmedi.
- **"Taste evolves" özelliği:** repo taramasında bulunamadı; RevenueCat /
  App Store Connect metadata'sındaki vaat metinleri erişim dışı, kontrol edilmedi.
