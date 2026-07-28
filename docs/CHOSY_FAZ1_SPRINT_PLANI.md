# CHOSY — FAZ 1 SPRİNT PLANI: GÜNLÜK OYUN SİSTEMİ
**Hazırlayan:** CTO / Baş Stratejist
**Tarih:** 23 Temmuz 2026
**Referans:** CHOSY_OYUN_SISTEMI_TASARIM_RAPORU.md (onaylı, revizyon: Replik Tahmin kalıyor/donduruluyor, The Critic iptal)
**Format:** Her task için → **Niye** + **Claude Code Prompt** + **Beklenen Çıktı** + **Doğrulama**
**Kapsam:** 3 sprint (~6 hafta) — Ortak sistemler + CineMetrics + Logline + Home hero + DNA v1

---

## KULLANIM TALİMATI

1. Her task'ı **sırayla** yap, atlama
2. Prompt'u Claude Code'a **birebir kopyala**
3. Çıktıyı **doğrulama komutu** ile kontrol et (PowerShell sözdizimi)
4. **Yeşil ışık** gelmeden bir sonrakine geçme
5. Her diff'i merge öncesi CTO'ya (bana) getir — mimari karar yetkisi Claude Code'da DEĞİL
6. Migration'lar YALNIZCA `supabase db push` ile — SQL editor YASAK (Rule 10)
7. Hiçbir hata sessizce yutulamaz — her hata Sentry'ye düşer, kullanıcıya durum gösterilir

---

## SABİT KARARLAR (bu sprintte tartışılmaz)

- Günlük bulmaca **herkes için aynı**, cihaz yerel tarihine anahtarlı
- Çözüm istemciye **asla** inmez — doğrulama sunucuda
- CineMetrics 6. sütun: **Ülke**
- Replik Tahmin: kalıyor ama havuz **donduruldu** — yeni replik eklenmez
- XP/ağırlık katsayıları `app_config`'te, **lazy getter** ile okunur (module-level constant YASAK — hydration race dersi)

---

# SPRİNT G0 — BACKEND OMURGA (Hafta 1-2)

**Hedef:** Oyun sisteminin tüm sunucu tarafı: şema, RLS, bulmaca üretim hattı, doğrulama fonksiyonları, DNA motoru. Bu sprint bitince client hiç yokken bile sistem cron'la bulmaca üretiyor ve API üzerinden oynanabiliyor olmalı.

---

## TASK G0.0 — Sprint-Start Health Check

**Niye:** Zorunlu kural — sağlık kontrolü yapılmadan iş başlamaz. Build 46 sonrası ortamın temiz olduğunu doğrulamalıyız.

**Claude Code Prompt:**

```
Sprint başlangıç sağlık kontrolü yap. Sırayla:

1. `git status` — working tree temiz mi? Değilse listele, commit'lenmemiş işleri raporla, HİÇBİR ŞEYİ silme.
2. `git log --oneline -5` — son commit'ler build 46 ile tutarlı mı?
3. `npx tsc --noEmit` — TypeScript hataları. Bilinen pre-existing hatalar (supabase/functions/, ExternalLink.tsx, SkeletonLoader, watchlist.tsx:122,144) DIŞINDA yeni hata var mı?
4. `supabase migration list` — lokal ve remote migration'lar senkron mu? En son migration 050 mi?
5. `.env` dosyasında EXPO_PUBLIC_SUPABASE_URL, SENTRY, POSTHOG anahtarları mevcut mu (değerleri YAZDIRMA, sadece var/yok raporla)?
6. `npx expo-doctor` çalıştır, kritik uyarıları listele.

Sonunda tek tablo halinde rapor: kontrol / durum / aksiyon-gerekiyor-mu.
HİÇBİR düzeltme yapma — sadece raporla. Düzeltme kararını CTO verecek.
```

**Beklenen Çıktı:** 6 satırlık sağlık tablosu, aksiyon listesi

**Doğrulama:**
```powershell
git status
supabase migration list
```
Working tree temiz + migration'lar senkron değilse **DURDUR**, bana raporu getir.

---

## TASK G0.1 — Migration 051-054: Oyun Şeması + RLS Güvenlik Duvarı

**Niye:** Tüm sistemin temeli. En kritik satır: `solution_ref` istemciye sızarsa leaderboard, paylaşım prestiji ve oyunun kendisi anlamını yitirir. Bu migration'ın kabul kriteri güvenlik view'ıdır.

**Claude Code Prompt:**

```
Chosy oyun sistemi için 4 yeni migration oluştur. supabase/migrations/ altına, mevcut numaralandırma düzenini takip ederek (051'den başla). SQL editor KULLANMA — dosyaları yaz, ben `supabase db push` ile göndereceğim.

MIGRATION 051 — daily_puzzles genişletme:
ALTER TABLE daily_puzzles
  ADD COLUMN IF NOT EXISTS difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS solution_ref UUID REFERENCES films(id),
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending','valid','rejected')),
  ADD COLUMN IF NOT EXISTS is_emergency_pool BOOLEAN NOT NULL DEFAULT false;

Ardından güvenlik view'ı:
CREATE VIEW public_daily_puzzles AS
  SELECT id, game_id, puzzle_date, difficulty,
         (puzzle_data - 'solution' - 'redaction_words') AS puzzle_data
  FROM daily_puzzles
  WHERE validation_status = 'valid';

RLS: daily_puzzles tablosunda anon/authenticated için TÜM policy'leri kaldır (yalnızca service_role erişir). public_daily_puzzles view'ına authenticated SELECT ver (security_invoker ayarına dikkat et — view'ın service tablosuna erişebilmesi için security definer function veya view owner yaklaşımı gerekiyorsa, Supabase'in önerdiği güvenli kalıbı kullan ve hangi kalıbı seçtiğini gerekçesiyle raporla).

MIGRATION 052 — game_scores genişletme:
  progress_json JSONB, dna_signals JSONB, xp_awarded INTEGER DEFAULT 0,
  is_hard_mode BOOLEAN DEFAULT false, flagged BOOLEAN DEFAULT false
UNIQUE(user_id, puzzle_id) constraint'inin mevcut olduğunu doğrula; yoksa ekle.

MIGRATION 053 — cinema_dna tablosu:
CREATE TABLE cinema_dna (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  knowledge REAL NOT NULL DEFAULT 0, deduction REAL NOT NULL DEFAULT 0,
  auteur_sense REAL NOT NULL DEFAULT 0, instinct REAL NOT NULL DEFAULT 0,
  consistency REAL NOT NULL DEFAULT 0, visual_sense REAL NOT NULL DEFAULT 0,
  cinema_score SMALLINT NOT NULL DEFAULT 0,
  rank_id SMALLINT NOT NULL DEFAULT 1,
  identity_title TEXT,
  total_dailies_completed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
RLS: kullanıcı yalnızca kendi satırını SELECT edebilir; INSERT/UPDATE yalnızca service_role (yazım Edge Function üzerinden).

MIGRATION 054 — arcade_runs tablosu (raporda tanımlı şema) + günlük leaderboard index'i:
CREATE INDEX idx_arcade_leaderboard ON arcade_runs (game_id, created_at DESC, score DESC) WHERE verified = true;

Ayrıca app_config'e şu key'leri ekleyen bir seed migration satırı koy (055 olarak ayrı dosya):
  game_xp_config: {"daily_base":50,"guess_ladder":[100,85,70,55,45,35],"fail_xp":10,"streak_mult_7":1.1,"streak_mult_30":1.25,"arcade_run_cap":30,"arcade_daily_cap":90}
  dna_config: {"ewma_alpha":0.15,"weights":{"knowledge":0.30,"deduction":0.20,"auteur":0.15,"instinct":0.15,"consistency":0.20},"rank_thresholds":[0,20,35,50,65,80],"rank_min_dailies":[0,5,15,30,60,100]}

Sonunda rapor et: her migration dosyasının yolu, RLS kalıp seçimin ve gerekçesi, view'ın solution sızdırmadığını nasıl garanti ettiğin.
```

**Beklenen Çıktı:** 5 migration dosyası (051-055), RLS gerekçe raporu

**Doğrulama:**
```powershell
supabase db push
# Sonra Supabase Studio'da authenticated rolüyle test sorgusu:
# SELECT * FROM public_daily_puzzles LIMIT 1;  → puzzle_data içinde 'solution' anahtarı OLMAMALI
# SELECT * FROM daily_puzzles LIMIT 1;         → permission denied ALMALISIN
```
**CTO review noktası:** Bu diff merge edilmeden bana gelecek — ilk bakacağım yer view tanımı.

---

## TASK G0.2 — generate-puzzles Edge Function + Lint + Acil Havuz

**Niye:** "O gün bulmaca yok" durumu yapısal olarak imkansız olmalı. Üretim + doğrulama + 30 bulmacalık acil yedek + alarm zinciri tek fonksiyonda.

**Claude Code Prompt:**

```
supabase/functions/generate-puzzles adında yeni Edge Function yaz (Deno). Service role ile çalışır, haftalık cron tetikler (cron kurulumunu da supabase/functions/generate-puzzles/README.md'ye komutuyla yaz).

GÖREV AKIŞI:
1. Her oyun için (şimdilik: 'cinemetrics', 'logline') bugünden itibaren 14 günlük takvimde eksik puzzle_date'leri bul.

2. CINEMETRICS aday seçimi:
   - films tablosundan: curation_tier IN ('core','extended'), vote_average IS NOT NULL, runtime IS NOT NULL, director IS NOT NULL, year IS NOT NULL, genres dizisi boş değil, country dizisi boş değil, metadata_json->>'vote_count' >= 1000
   - Son 365 günde solution_ref olarak kullanılmamış; aynı director son 14 günde kullanılmamış
   - Deterministik seçim: seed = puzzle_date string'inin hash'i (tekrar çalıştırma aynı sonucu üretmeli — idempotency)
   - Zorluk ataması: popularity persentiline göre 1-5; haftalık eğri → Pzt-Salı difficulty 1-2, Çar-Per 3, Cum-Cmt 4-5, Pazar 3
   - puzzle_data: { columns: { year, genres, director(s), rating, runtime, country } } — TMDB verisinin SNAPSHOT'ı (sonradan veri değişirse bulmaca sabit kalır). solution anahtarı puzzle_data içinde TUTULMAZ; cevap yalnızca solution_ref kolonunda.

3. LOGLINE aday seçimi:
   - Ek şart: overview 30-80 kelime arası
   - Claude Haiku çağrısı (mevcut parse-mood fonksiyonundaki Anthropic SDK kalıbını aynen kullan, model: claude-haiku-4-5):
     System: "Film tahmin oyunu için sansür haritası çıkar. Overview'daki filmi ele veren kelimeleri seç: TÜM özel isimler + başlık kelimeleri zorunlu; ek olarak yüksek bilgi değerli 2-4 kelime. Her sansürlü kelimeye 1-9 arası reveal_order ata (1 = en az bilgi veren, ilk açılacak). SADECE JSON dön: {redactions:[{word, reveal_order}]}"
   - Lint: sansür sayısı 5-9; sansür sonrası kalan görünür metin >= %40; değilse film reddedilir, sıradaki aday denenir
   - puzzle_data: { overview_masked: [token dizisi, sansürlüler {r:reveal_order} ile işaretli], word_count } — sansürlü kelimelerin KENDİSİ puzzle_data'ya yazılır AMA 'redaction_words' anahtarı altında (view bunu zaten çıkarıyor, Task G0.1)

4. GENEL LİNT (her bulmaca): tüm zorunlu alanlar dolu + film posteri URL'i 200 dönüyor (HEAD request). Geçen → validation_status='valid'. Geçmeyen → 'rejected' + Sentry'ye captureMessage (sessiz düşürme YASAK).

5. ACİL HAVUZ: is_emergency_pool=true, puzzle_date=NULL olan 30 valid bulmaca her zaman hazır tutulur (eksikse bu koşumda tamamla). Eğer bir tarihe üretim 3 denemede başarısız olursa acil havuzdan bir bulmaca o tarihe atanır + Sentry uyarısı.

6. Koşum sonunda PostHog'a server-side event: puzzle_generation_report {generated, rejected, emergency_used, per_game}. PostHog server key'i env'den (POSTHOG_API_KEY) — yoksa event atla ama Sentry'ye "telemetry key missing" düş.

HATA YÖNETİMİ: Hiçbir catch bloğu boş olamaz. Her hata Sentry'ye. Fonksiyon kısmi başarıda bile ürettiklerini kaydeder, başarısızları raporlar.

Sonunda rapor et: dosya yapısı, cron kurulum komutu, env gereksinimleri, ilk manuel koşum çıktısı örneği.
```

**Beklenen Çıktı:** Çalışan generate-puzzles fonksiyonu, README'de cron komutu, 14 gün + 30 acil bulmaca üretilmiş

**Doğrulama:**
```powershell
supabase functions deploy generate-puzzles
supabase functions invoke generate-puzzles
# Studio'da: SELECT game_id, puzzle_date, difficulty, validation_status FROM daily_puzzles ORDER BY puzzle_date DESC LIMIT 30;
# Beklenen: her oyun için 14 tarih 'valid' + 30 emergency pool satırı
```

---

## TASK G0.3 — get-daily-challenge + submit-guess Edge Functions

**Niye:** Oyunun kalbi. Feedback mantığı (renk kuralları) sunucuda yaşar; istemci yalnızca boyalı sonuç görür. Idempotency + rate limit + progress restore burada.

**Claude Code Prompt:**

```
İki yeni Edge Function yaz:

=== supabase/functions/get-daily-challenge ===
Input: { game_id, puzzle_date }  (auth zorunlu)
1. public_daily_puzzles view'ından bulmacayı çek (yoksa 404 + kullanıcıya gösterilecek hata mesajı — sessiz boş dönme YASAK)
2. game_scores'tan kullanıcının bu puzzle için progress_json'ını çek
3. Dön: { puzzle: {id, game_id, difficulty, puzzle_data}, progress: {...} | null, puzzle_no }
   puzzle_no = o oyunun kronolojik sıra numarası ("Chosy #47" için)
Cache-Control: private, max-age=300

=== supabase/functions/submit-guess ===
Input: { puzzle_id, guess_film_id }  (auth zorunlu)
AKIŞ:
1. Rate limit: kullanıcı başına dakikada 10 tahmin (basit: son 60 sn'deki submit sayısını progress_json timestamps'ten say). Aşımda 429 + kibar mesaj.
2. game_scores satırını çek/oluştur (UNIQUE user_id+puzzle_id → upsert). completed=true ise 409 dön ("bugünün bulmacası zaten tamamlandı").
3. Tahmin sayısı >= 6 ise 409.
4. daily_puzzles'tan (service role) solution_ref + snapshot verilerini çek. Tahmin edilen filmi films'ten çek.
5. FEEDBACK HESABI (CineMetrics):
   - year: exact→green | ±5→yellow | değilse gray + direction (up = hedef daha yeni)
   - genres: küme eşit→green | kesişim >=1→yellow | gray  (sıra bağımsız, lowercase karşılaştır)
   - director: dizi kesişimi→green | gray  (sarı YOK)
   - rating: |delta|<=0.2→green | <=0.5→yellow | gray + direction
   - runtime: |delta|<=5→green | <=15→yellow | gray + direction
   - country: kesişim→green | aynı kıta→yellow (kıta eşlemesi için sabit ülke→kıta map'i utils'e koy) | gray
6. Doğru film → completed=true, won=true. XP hesabı: app_config'ten game_xp_config oku (LAZY — her istekte fresh oku, module-level cache YASAK), guess_ladder[guess_no-1].
7. DNA sinyalleri dna_signals'a append:
   - knowledge: won ? 0.5+0.1*difficulty : 0.1
   - deduction: won ? (7-guesses_used)/6 : 0
   - auteur: yönetmen sütunu 3. tahminden önce yeşillendiyse 0.7
8. recompute-cinema-dna fonksiyonunu internal fetch ile çağır (Task G0.4). Başarısız olursa: oyun sonucu YİNE kaydedilir, DNA hatası Sentry'ye düşer ve response'ta dna_updated:false döner (kullanıcı oyunu kaybetmez ama hata görünür kalır).
9. Logline için aynı fonksiyon game_id'ye göre dallanır: yanlış tahminde reveal_order'a göre sıradaki sansürü açar, feedback = {revealed_word_index}. Doğru tahminde kalan sansür sayısı verim metriğidir.
10. Response: { correct, feedback, guesses_used, completed, won, xp_awarded, revealed_solution: (completed ise film bilgisi, değilse ASLA) }

6. tahmin de yanlışsa: completed=true, won=false, revealed_solution döner, fail_xp verilir.

Sonunda rapor et: iki fonksiyonun dosya yolları, feedback fonksiyonunun unit test edilebilir saf fonksiyon olarak ayrıldığının teyidi (tests/ altına 6 sütun için tablo-driven test yaz).
```

**Beklenen Çıktı:** İki deploy edilebilir fonksiyon + feedback saf fonksiyonu + tablo-driven testler

**Doğrulama:**
```powershell
supabase functions deploy get-daily-challenge; supabase functions deploy submit-guess
# curl ile auth token'lı test: yanlış tahmin → feedback döner, solution dönmez
# Aynı tahmini 11 kez spam → 429
# Doğru tahmin → completed + xp; tekrar submit → 409
deno test supabase/functions/submit-guess/
```
**CTO review noktası:** Response şemasında `revealed_solution`'ın yalnızca `completed=true` dalında olduğunu diff'te bizzat kontrol edeceğim.

---

## TASK G0.4 — recompute-cinema-dna + Rank Motoru

**Niye:** "Neden NYT değil de biz" katmanı. EWMA güncellemesi, Cinema Score, rank terfisi ve kimlik unvanı tek yerde.

**Claude Code Prompt:**

```
supabase/functions/recompute-cinema-dna Edge Function'ı yaz (internal — yalnızca diğer fonksiyonlardan service-to-service çağrılır; doğrudan client çağrısına 403).

Input: { user_id, signals: [{dim, val}], daily_completed: boolean }

1. app_config'ten dna_config oku (lazy, her istekte).
2. cinema_dna satırını çek/oluştur.
3. Her sinyal için EWMA: new = alpha * (val*100) + (1-alpha) * old
4. consistency boyutu sinyallerden DEĞİL şuradan hesaplanır: user_streaks.current_streak → min(100, streak*4) ile 0-100'e map + son 7 günde tamamlanan günlük sayısı harmanı (60/40 ağırlık).
5. cinema_score = round(weights ile ağırlıklı toplam) — visual_sense ağırlığı 0 (Faz 3'e kadar).
6. Rank kontrolü: rank_thresholds + rank_min_dailies İKİSİ birden sağlanıyorsa terfi. Terfi olduysa response'ta rank_changed:true (client kutlama gösterecek).
7. identity_title: en yüksek 2 boyut kombinasyonundan sabit 15'lik tablodan seç (tabloyu constants olarak fonksiyona göm, TR+EN çiftiyle: ör. knowledge+deduction → "The Film Detective"/"Film Dedektifi").
8. daily_completed=true ise total_dailies_completed++.
9. PostHog server event: dna_updated {cinema_score, rank_changed}.
Tüm hatalar Sentry'ye; kısmi başarı durumu response'ta açıkça belirtilir.

Sonunda: EWMA hesabını saf fonksiyon olarak ayır + 3 senaryo testi yaz (yeni kullanıcı ilk sinyal / veteran kötü gün / rank terfi eşiği).
```

**Beklenen Çıktı:** Deploy edilmiş fonksiyon + saf EWMA + 3 test

**Doğrulama:**
```powershell
supabase functions deploy recompute-cinema-dna
deno test supabase/functions/recompute-cinema-dna/
# Studio: bir test kullanıcısıyla submit-guess sonrası cinema_dna satırının güncellendiğini doğrula
```

---

## TASK G0.5 — G0 Retrospektif + Uçtan Uca API Testi

**Niye:** Client'a geçmeden omurganın uçtan uca çalıştığını kanıtlamalıyız — Sprint 1 retrosundaki ders: "entegrasyon sorunları client'ta değil, sınırda yakalanır."

**Claude Code Prompt:**

```
tests/game-system/ altına uçtan uca API test scripti yaz (Deno veya Node, mevcut test altyapısına uy):

SENARYO (test kullanıcısıyla, staging'e karşı):
1. generate-puzzles invoke → bugünün bulmacaları var mı
2. get-daily-challenge (cinemetrics) → puzzle geldi, solution YOK (assert: JSON string'inde solution_ref/solution kelimesi geçmiyor)
3. 3 yanlış tahmin → her feedback tutarlı (yıl oku doğru yönde vs.)
4. Doğru tahmin → completed, xp doğru merdivenden, cinema_dna güncellendi
5. Tekrar submit → 409
6. get-daily-challenge tekrar → progress restore çalışıyor
7. Logline için aynı zincir (reveal mekanizmasıyla)
8. Negatif: auth'suz istek → 401; olmayan puzzle_date → 404 + mesaj

Her assert başarısızlığı net hata mesajıyla düşsün. Sonunda özet tablo bas.
```

**Beklenen Çıktı:** `npm run test:game-api` (veya deno task) yeşil

**Doğrulama:**
```powershell
npm run test:game-api
# 8/8 senaryo PASS olmadan Sprint G1'e GEÇİLMEZ
```

---

# SPRİNT G1 — CINEMETRICS CLIENT + HOME HERO (Hafta 3-4)

**Hedef:** CineMetrics'in oynanabilir, paylaşılabilir hali + Home'da "Bugünün Görevi" hero kartı. Sprint sonunda TestFlight'a giden build.

---

## TASK G1.1 — CineMetrics Oyun Ekranı

**Niye:** Amiral gemi mekaniğin kendisi. Grid + autocomplete + feedback animasyonları.

**Claude Code Prompt:**

```
CineMetrics oyun ekranını yaz. Mevcut games stack'e ekle: app/games/cinemetrics.tsx + components/games/CineMetrics/ klasörü (index.tsx + styles.ts düzeni, StyleSheet.create zorunlu, inline style YASAK, Theme.xxx kullan).

YAPI:
1. services/gameApi.ts oluştur — get-daily-challenge / submit-guess çağrılarının tek kaynağı. Her çağrı ensureAuthSession() ile sarılı (mevcut JWT-expire workaround kalıbı). Hata → errorHelpers üzerinden kullanıcıya görünür mesaj + Sentry. Sessiz fallback YASAK.

2. EKRAN AKIŞI (state machine, MoodContext'teki 3-state kalıbına benzer):
   - 'loading' → get-daily-challenge
   - 'playing' → grid + arama
   - 'completed' → sonuç paneli (won/lost) + paylaşım butonu
   Progress restore: açılışta progress varsa grid'i doldurup kaldığı yerden devam.

3. GRID: 6 satır x 6 sütun (Yıl, Tür, Yönetmen, Puan, Süre, Ülke). Her hücre:
   - green: #22C55E türevi, yellow: #D4A843 (mevcut gold), gray: zinc-700
   - Yön okları (yıl/puan/süre gray hücrelerinde) Phosphor duotone ArrowUp/ArrowDown
   - Feedback geldiğinde hücreler soldan sağa 80ms kademeli flip animasyonu (reanimated v4, mevcut standartlar: haptic light per flip, medium on full-green)
   - Bu ekranda YALNIZCA Phosphor kullan (Ionicons karışımı YASAK)

4. FİLM ARAMA: components/games/FilmSearchInput/ — Pinpoint'teki mevcut autocomplete'i ortak componente çıkar (Pinpoint'i kırmadan refactor et). Görünüm: "Title (Year)" formatı zorunlu. Debounce 250ms, films tablosunda title ilike araması (index kontrol et, yoksa migration 056 olarak trigram index öner ama UYGULAMADAN bana sor).

5. SONUÇ PANELİ: won → poster + film adı + "X/6" + XP + DNA çentiği ("Deduction +6" — response'tan). lost → "Cevap: [film]" + nazik mesaj. Her iki durumda "Paylaş" (Task G1.3'e bağlanacak, şimdilik placeholder buton) + "Yarın yeni bulmaca — 00:00'a HH:MM" geri sayımı.

6. i18n: TÜM string'ler t() üzerinden, en.json + tr.json'a ekle. Hardcode YASAK.

7. Telemetri (mevcut analytics wrapper): game_daily_opened, game_guess_submitted, game_daily_completed — rapor taksonomisindeki prop'larla.

Sonunda rapor et: dosya listesi, Pinpoint refactor'ünün Pinpoint'i kırmadığının kanıtı (Pinpoint'i aç-oyna testi), yeni migration önerisi gerekti mi.
```

**Beklenen Çıktı:** Oynanabilir CineMetrics, ortak FilmSearchInput, i18n tam

**Doğrulama:**
```powershell
npx tsc --noEmit
npx expo start
# Cihazda: bulmaca yükleniyor → 2 yanlış + 1 doğru tahmin → sonuç paneli → uygulamayı öldür-aç → progress restore
Select-String -Path locales/en.json -Pattern "cinemetrics" | Select-Object -First 5
```

---

## TASK G1.2 — Paylaşım Kartı: Film Şeridi Artefaktı

**Niye:** Sıfır bütçeli büyüme motorumuz. Wordle'ın yeşil grid'inin sinematik versiyonu. Kart tasarımı bir "özellik" değil, dağıtım stratejisinin kendisi.

**Claude Code Prompt:**

```
CineMetrics (ve ileride tüm günlük oyunlar için yeniden kullanılabilir) paylaşım kartı sistemi yaz.

1. npx expo install react-native-view-shot expo-sharing

2. components/games/ShareCard/ — props: { gameTitle, puzzleNo, resultGrid (renk matrisi), efficiency ("4/6"), dnaDelta ("Deduction +6"), won }
   TASARIM (film şeridi metaforu):
   - Dikey 1080x1920 (9:16, story formatı) offscreen render
   - Üst-alt kenarlarda film perforasyon deliği deseni (saf View'larla çiz, asset yok)
   - Merkez: 6x6 renk grid'i (film adı ASLA yok, spoiler yasağı)
   - Alt: "Chosy #47 — 4/6" + kimlik unvanı varsa ("The Film Detective") + küçük Chosy işareti
   - Renkler mevcut palet: zinc-950 zemin, violet/gold vurgu
   - lost durumunda grid + "X/6" — utandırma dili YASAK, "Yarın tekrar" tonu

3. Akış: Sonuç panelindeki Paylaş butonu → view-shot capture → expo-sharing native sheet. iOS izin/hata durumları görünür mesajla (sessiz fail yok).

4. Metin fallback: "Panoya kopyala" ikincil buton → emoji grid:
   Chosy #47 4/6
   + emoji satırları + yön okları
   + "chosy.ai" satırı

5. Telemetri: game_share_card_rendered, game_share_completed {channel: 'image'|'text'}.

6. Performans: render main thread'i bloklamasın; capture sırasında buton loading state.

Sonunda: kartın 3 örnek render screenshot'ını (won-erken / won-geç / lost) simülatörden al ve raporla.
```

**Beklenen Çıktı:** Çalışan görsel + metin paylaşımı, 3 örnek render

**Doğrulama:**
```powershell
# Cihazda: Paylaş → iOS share sheet açılıyor, görselde film adı YOK
# Kopyala → yapıştırılan metin emoji grid formatında
```
**CTO review noktası:** 3 render'ı ben göreceğim — kart "atmak isteyeceğim kadar güzel" değilse tasarım turu tekrarlanır. Bu task estetik onaya tabi.

---

## TASK G1.3 — Home "Bugünün Görevi" Hero Kartı

**Niye:** Faz 1'in vitrin hamlesi: tab bar'a dokunmadan hiyerarşi devrimi. Uygulamayı açan herkesin ilk gördüğü şey günün görevi olur.

**Claude Code Prompt:**

```
Home ekranına (app/(tabs)/index.tsx) "Bugünün Görevi" hero kartını ekle ve mevcut bileşen sırasını yeniden düzenle.

1. YENİ SIRA: GreetingWidget → **DailyChallengeHero (YENİ)** → MoodCTA (küçültülmüş) → DailyPick → ArchetypeCard
   Mevcut hiçbir bileşeni SİLME — sadece sıra ve boyut değişir.

2. components/home/DailyChallengeHero/:
   - Film şeridi çerçeveli geniş kart (ShareCard'la aynı görsel dil)
   - İçerik: "Bugünün Görevi" + CineMetrics durumu:
     - çözülmedi → "Chosy #47 seni bekliyor" + Oyna CTA
     - çözüldü → renk grid mini önizleme + "4/6 — Yarın: HH:MM"
   - Streak rozeti (mevcut user_streaks'ten): "12 gün"
   - Logline eklendiğinde (Sprint G2) ikinci satır otomatik açılır — component'i iki oyunu listeleyecek şekilde şimdiden data-driven yaz (games: DailyGameStatus[] prop'u)
   - Tıklama → /games/cinemetrics
   - Veri: get-daily-challenge'ın progress alanından; homeService.ts'e getDailyChallengeStatus() ekle, Home'un mevcut data aggregation kalıbına uy

3. MoodCTA küçültme: mevcut büyük mood kartını tek satırlık kompakt versiyona indir ("Bu akşam ne izlesem? →"). İşlevsellik aynen korunur — sadece görsel ağırlık düşer.

4. Skeleton: hero kart için shimmer (1.5s standart), yüklenemezse görünür hata + retry (sessiz gizlenme YASAK).

5. Telemetri: game_daily_opened {source:'home_widget'} — hub'dan açılışla ayrışsın.

Sonunda: Home'un önce/sonra ekran görüntüsü + hangi mevcut bileşenlerin sadece taşındığının listesi.
```

**Beklenen Çıktı:** Yeni Home hiyerarşisi, hiçbir işlev kaybı yok

**Doğrulama:**
```powershell
npx expo start
# Cihazda: Home ilk ekranda hero görünüyor, mood search hala çalışıyor, Daily Pick hala çalışıyor
# Bulmaca çözülünce Home'a dönüşte kart 'çözüldü' durumuna geçiyor
```

---

## TASK G1.4 — Streak Entegrasyonu + XP Gösterimi

**Niye:** Ritüelin bağlayıcısı. Mevcut streak altyapısı oyun tamamlanma anına bağlanır.

**Claude Code Prompt:**

```
Streak sistemini günlük oyun tamamlanmasına bağla:

1. submit-guess (sunucu) completed=true olduğunda mevcut update_streak RPC'sini çağırsın — "en az 1 günlük görev = streak günü" kuralı. Arcade İLERİDE saymayacak; RPC çağrısı yalnızca daily akışında.
2. Streak Freeze v1: user_streaks'e freeze_available SMALLINT DEFAULT 1 ve freeze_used_month TEXT kolonları (migration 056). Gün kaçırıldığında update_streak içinde: freeze varsa otomatik harca, streak korunur, response'ta freeze_consumed:true. Her ayın 1'inde freeze_available=1'e reset (fonksiyon içinde ay kontrolü — ayrı cron gerekmez).
3. Client: sonuç panelinde streak animasyonu (sayı +1 tick + haptic medium). Freeze harcandıysa ertesi açılışta bir defalık bilgi kartı: "Streak'in koruma ile kurtuldu" — suçlayıcı dil YASAK.
4. Telemetri: streak_incremented, streak_lost, streak_freeze_used.
5. XP toast: sonuç panelinde xp_awarded animasyonlu sayaç (0→XP count-up, 600ms).

Migration'ı dosya olarak yaz, ben push edeceğim. Sonunda: streak akış diyagramını 5 satırda özetle.
```

**Beklenen Çıktı:** Streak oyunla bağlı, freeze v1 çalışır, migration 056 hazır

**Doğrulama:**
```powershell
supabase db push
# Test kullanıcısı: bugün çöz → streak+1; Studio'da last_activity_date'i 2 gün geriye çek → yarın çöz → freeze harcanmış, streak korunmuş
```

---

## TASK G1.5 — G1 Kapanış: Cihaz Testi + TestFlight Build

**Niye:** Hard rule — cihaz seviyesinde gesture testi olmadan TestFlight'a build gitmez.

**Claude Code Prompt:**

```
TestFlight build hazırlığı ve test checklist'i üret:

1. app.json/app.config version bump (mevcut versiyonlama düzenine uy), changelog taslağı yaz.
2. docs/testing/G1_TESTFLIGHT_CHECKLIST.md oluştur — 12 maddelik cihaz testi:
   (1) Bulmaca yükleme (soğuk açılış) (2) 6 sütun feedback doğruluğu — bilinen filmle manuel doğrulama (3) Progress restore (kill-reopen) (4) Aynı gün ikinci çözüm engeli (5) Grid flip animasyonları 60fps (6) Paylaşım görseli + metin fallback (7) Home hero durum geçişleri (8) Streak artışı + freeze senaryosu (9) Rate limit kibarlığı (10) Uçak modu davranışı — görünür hata + retry, sessiz boşluk YOK (11) TR/EN dil geçişi (12) Gece yarısı geçişi (cihaz saatini 23:59'a çek → yeni bulmaca)
3. eas build --profile preview --platform ios komutunu hazırla ama ÇALIŞTIRMA — build kararını CTO verir.

Sonunda: checklist dosyası + build öncesi eksik kalan riskler listesi.
```

**Beklenen Çıktı:** Checklist hazır, build komutu bekliyor

**Doğrulama:**
```powershell
Get-Content docs/testing/G1_TESTFLIGHT_CHECKLIST.md | Select-Object -First 20
# 12 maddenin TAMAMI cihazda yeşil olmadan build gönderilmez — founder onayı şart
```

---

# SPRİNT G2 — LOGLINE + CINEMA DNA v1 + RELEASE (Hafta 5-6)

**Hedef:** İkinci günlük oyun canlıda, DNA profili görünür, günlük push aktif, Faz 1 ölçüm altyapısı tamam.

---

## TASK G2.1 — The Logline Oyun Ekranı

**Niye:** İkinci günlük ritüel. Backend (sansür haritası) G0.2'de hazır — bu task saf client.

**Claude Code Prompt:**

```
The Logline oyun ekranını yaz: app/games/logline.tsx + components/games/Logline/.

1. gameApi.ts'i logline için genişlet (aynı get-daily-challenge/submit-guess uçları, game_id='logline').
2. UI: overview metni token akışı olarak render edilir; sansürlü tokenlar siyah bant (zinc-800 blok, hafif film-grain dokusu — saf stil, asset yok). Yanlış tahminde sunucunun döndürdüğü revealed_word_index'teki bant 400ms'de "düşer" (reanimated: bant yukarı kalkar, kelime fade-in) + haptic light.
3. FilmSearchInput ortak component'i aynen kullanılır (G1.1'de çıkarıldı).
4. Sonuç paneli + ShareCard: aynı sistem, grid yerine bant durumu görseli (kaç bant kapalıyken çözüldü). Logline kartında da film adı ve AÇILAN KELİMELER asla görünmez — bantlı siluet gösterilir.
5. Home DailyChallengeHero'ya ikinci satır otomatik düşer (G1.3'te data-driven hazırlanmıştı — sadece games dizisine logline status ekle).
6. i18n + telemetri: CineMetrics ile birebir aynı taksonomide, game_id ayrımıyla.

Sonunda: iki günlük oyunun Home'daki birlikte görünümünün screenshot'ı.
```

**Beklenen Çıktı:** Oynanabilir Logline, Home'da iki görevli hero

**Doğrulama:**
```powershell
npx tsc --noEmit
# Cihazda: yanlış tahmin → doğru bant düşüyor (reveal_order sırasına göre), açılan kelime sunucudan geliyor (client'ta önceden YOK — network log'unda doğrula)
```

---

## TASK G2.2 — Cinema DNA Profil Kartı v1

**Niye:** Kimlik katmanının kullanıcıya göründüğü ilk an. Letterboxd profili ne izlediğini gösterir; bizimki nasıl gördüğünü.

**Claude Code Prompt:**

```
Profile ekranına Cinema DNA bölümü ekle:

1. components/profile/CinemaDNACard/:
   - Üst: rank adı + kimlik unvanı ("Film Scholar / The Film Detective") + Cinema Score halkası
   - 6 boyut yatay bar listesi (0-100). visual_sense: kilitli görünüm (blur + kilit ikonu + "Yakında" — Faz 3 teaser)
   - Barlar Phosphor duotone ikonlarıyla (rapor tablosundaki ikon eşlemesi)
   - 7+ gün sinyalsiz boyutta "paslanıyor" mikro-etiketi (cezalandırma dili YASAK, nötr ton)
   - Mevcut ArchetypeCard'ın ALTINA yerleşir — iki kimlik yan yana: "zevkin" (arketip) + "gözün" (DNA). ArchetypeCard'a dokunulmaz.
2. Veri: cinema_dna self-select (RLS zaten hazır). services/cinemaDna.ts — tek kaynak.
3. Rank terfisi kutlaması: submit-guess response'unda rank_changed:true gelirse sonuç panelinde tam ekran kısa kutlama (mevcut ArchetypeReveal animasyon kalıbını yeniden kullan — StoreReview çağrısını BLOKLAMADAN, o bug'ın dersini unutma).
4. Boş durum (yeni kullanıcı, 0 sinyal): "İlk görevini çöz, sinema DNA'n oluşmaya başlasın" + Oyna CTA.
5. Telemetri: dna_card_viewed, rank_celebration_shown.

Sonunda: dolu + boş + kilitli-boyutlu üç durumun screenshot'ı.
```

**Beklenen Çıktı:** Profil'de canlı DNA kartı, rank kutlaması

**Doğrulama:**
```powershell
# Cihazda: 2-3 görev çözmüş kullanıcıda barlar doluyor; yeni kullanıcıda boş durum CTA'sı
# Rank eşiğini Studio'dan manuel tetikle → kutlama akıyor, navigation DONMUYOR
```

---

## TASK G2.3 — Günlük Push: "Görevin Seni Bekliyor"

**Niye:** Ritüelin hatırlatıcısı. Mevcut notification altyapısı hazır — içerik ve zamanlama stratejisi yeni.

**Claude Code Prompt:**

```
Günlük görev push bildirimi ekle (mevcut schedule-notifications/send-notifications altyapısını genişlet):

1. Kural: günde EN FAZLA 1 oyun bildirimi. Kullanıcı o günün görevini çözdüyse bildirim İPTAL (gönderim anında kontrol).
2. Zamanlama: kullanıcının son 7 gündeki medyan çözüm saatinden 1 saat sonra; veri yoksa yerel 19:00. (game_scores.created_at'ten hesapla, schedule-notifications'a getOptimalGameHour() ekle.)
3. İçerik rotasyonu (5 varyant, en.json/tr.json): "Chosy #48 seni bekliyor", "Streak'in N günde — bugünü kaçırma", vb. Suçlayıcı/FOMO-agresif dil YASAK; davetkar ton.
4. Deep link: bildirim → doğrudan /games/cinemetrics (mevcut push routing kalıbı).
5. Opt-out: Settings'te "Günlük görev hatırlatması" toggle'ı (mevcut bildirim ayarları bölümüne).
6. Telemetri: push_game_sent, push_game_opened → CTR ölçümü.

Sonunda: gönderim karar akışını 6 satırda özetle + hangi mevcut dosyaların değiştiğini listele.
```

**Beklenen Çıktı:** Akıllı zamanlı günlük push, opt-out'lu

**Doğrulama:**
```powershell
# Test cihazında: bildirimi manuel tetikle → tık → CineMetrics açılıyor
# Görevi çöz → o günün bildirimi gelmiyor (Studio'da scheduled kayıt iptalini doğrula)
```

---

## TASK G2.4 — Games Hub Düzeni + Pinpoint Devir Bayrağı

**Niye:** Hub'ın yeni hiyerarşisi: günlük görevler üstte, mevcut oyunlar altta. Pinpoint'in 2 haftalık paralel yaşam süreci remote-config'le yönetilir.

**Claude Code Prompt:**

```
Games Hub'ı (app/games/index.tsx) yeniden düzenle:

1. YENİ DÜZEN: "Bugünün Görevleri" bölümü (CineMetrics + Logline kartları, durum rozetli) → ayraç → "Oyunlar" (Imposter, Pinpoint, Replik Tahmin).
2. Imposter kartına "Pazar Bonusu" rozeti — şimdilik görsel etiket, kilitleme YOK (davranış değişikliği Faz 2'de).
3. remoteConfig'e pinpoint_visible flag'i (default true, lazy getter — module-level constant YASAK). false olduğunda Pinpoint hub'dan gizlenir; route silinmez.
4. Replik Tahmin: değişiklik yok, havuz donduruldu — movieQuotes.ts'e "FROZEN — yeni replik eklenmez (CTO kararı 23 Tem 2026)" başlık yorumu ekle.
5. Telemetri: hub'dan oyun açılışları source:'hub' ile ayrışıyor (G1.3'te kurulmuştu, doğrula).

Sonunda: hub önce/sonra screenshot + pinpoint_visible flag'inin app_config'te nasıl kapatılacağının tek satırlık talimatı.
```

**Beklenen Çıktı:** İki katmanlı hub, uzaktan yönetilebilir Pinpoint görünürlüğü

**Doğrulama:**
```powershell
Select-String -Path services/remoteConfig.ts -Pattern "pinpoint_visible"
# Studio'da flag'i false yap → hub'da Pinpoint kayboluyor, uygulama crash etmiyor
```

---

## TASK G2.5 — Faz 1 Ölçüm Panosu + Release

**Niye:** Kapı metriği (D7 farkı) 4 hafta sonra bu panodan okunacak. Ölçüm altyapısı release'ten ÖNCE hazır olmalı — Sprint 0'ın dersi: "ölçemediğin şeyi yönetemezsin."

**Claude Code Prompt:**

```
Faz 1 karar panosunu ve release hazırlığını tamamla:

1. docs/analytics/FAZ1_OLCUM_PLANI.md yaz — PostHog'da kurulacak 4 insight'ın adım adım tarifi:
   a) Cohort karşılaştırma: "ilk 3 gün içinde >=1 günlük görev tamamlayanlar" vs tamamlamayanlar → D7 retention (BİRİNCİL KAPI METRİĞİ, hedef: +10 puan)
   b) Funnel: game_daily_opened → guess_submitted → daily_completed → share_card_rendered → share_completed (hedef: share_completed/daily_completed >= %8)
   c) Haftalık tamamlama dağılımı (hedef: medyan >=3/7)
   d) guesses_used dağılımı (CineMetrics zorluk kalibrasyonu, hedef medyan 4/6)
2. TestFlight checklist'i G2 maddeleriyle genişlet (Logline reveal, DNA kartı, push deep link, hub flag, +G1'in 12 maddesi regresyon).
3. Version bump + changelog. eas build komutunu hazırla, ÇALIŞTIRMA — cihaz checklist'i yeşil + founder onayı sonrası build.

Sonunda: ölçüm planı dosyası + release-blocker riskler listesi.
```

**Beklenen Çıktı:** Ölçüm planı, genişletilmiş checklist, build hazır bekliyor

**Doğrulama:**
```powershell
Get-Content docs/analytics/FAZ1_OLCUM_PLANI.md | Select-Object -First 30
# PostHog'da 4 insight kurulu ve test event'leriyle veri akıyor olmalı
```

---

# FAZ 1 KAPI KRİTERLERİ (Release + 4 hafta)

| Metrik | Hedef | Ölçüm | Sonuç |
|---|---|---|---|
| D7: görev tamamlayan vs tamamlamayan | **>= +10 puan** | PostHog cohort | Faz 2 kapısı (birincil) |
| 7-gün görev tamamlama medyanı | >= 3/7 | PostHog | Faz 2 kapısı |
| Paylaşım oranı (share/completed) | >= %8 | PostHog funnel | İzleme (tasarım turu tetikleyici) |
| CineMetrics guesses_used medyanı | 4/6 | PostHog | Zorluk kalibrasyonu |
| Crash-free sessions | >= %99.5 | Sentry | Release sağlığı |
| Push CTR (oyun bildirimi) | >= %15 | PostHog | İzleme |

**Kill-criteria (onaylı):** İki kapı metriği 4 haftada karşılanmazsa ana ekran devri (Faz 2 tab mimarisi) YAPILMAZ — oyunlar hub'da kalır, strateji oturumu yeniden açılır.

---

# BU PLANDA OLMAYANLAR (NİYET BIRAKMA)

- Clash + Blitz (Faz 2)
- Tab bar değişikliği / Today-Arcade-Tonight mimarisi (Faz 2, kapı sonrası)
- Hard Mode + bulmaca arşivi premium'u (Faz 2)
- Leaderboard / haftalık lig (Faz 2)
- Arkadaş sistemi, Movie Duel, Gauntlet (Faz 3)
- Yeni replik ekleme (havuz donduruldu)
- Mood/öneri motoru değişikliği (Faz 2'de Tonight'a taşınacak — şimdilik dokunulmuyor)
- Android (V1.3+)

---

# EXECUTION DISCIPLINE

1. Her task sırayla, doğrulama yeşil gelmeden geçme.
2. Her diff merge öncesi CTO review'ından geçer — özellikle G0.1 (RLS view) ve G0.3 (solution sızıntısı) satır satır incelenir.
3. Migration'lar yalnızca `supabase db push`.
4. G1.2 paylaşım kartı estetik onaya tabidir — "atmak istemeyeceğin kart" release olmaz.
5. TestFlight'a build, cihaz checklist'i %100 yeşil + founder onayı olmadan gitmez.
6. Her sprint sonunda retro: ne çalıştı, ne çalışmadı, ne öğrendik.

Başlıyoruz patron: **Sprint G0, Task G0.0 (sağlık kontrolü)** — prompt'u Claude Code'a yapıştır, tabloyu bana getir.

---

# KAPANIŞ NOTU — 29 Temmuz 2026

Faz 1 "oyun altyapısının tamamlanması" olarak kapatıldı. Founder kararı: **yeni oyun
yapılmayacak**; buradan sonraki getiri mevcut oyunların birbirini besleme oranından ve
haftalık analitik okumasından gelecek.

## Kapanış sprintinde ne yapıldı

**Release-blocker'lar (prod'da doğrulandı, kapatıldı):**
- `public_daily_puzzles` view'ı çözümü istemciye indiriyordu: `puzzle_data.film_title`
  CineMetrics/Logline/FadeIn/Detective'de cevabın kendisiydi; Imposter'da
  `rounds[].imposter_ids`, FadeIn'de tüm ipucu içerikleri iniyordu → migration 064
- Paylaşım kartı film adı + yıl basıyordu (Hard Rule 9 ihlali) → kart spoiler'sız
- Bu iki durum `tests/game-system/e2e-api.test.ts` S0 testine bağlandı (kalıcı bekçi)

**Ölü sistemler canlandırıldı:**
- WhyThisMovie kartı hiçbir oyunda render edilmiyordu (`why_this_movie` yalnızca
  Detective dalında üretiliyor, hiçbir ekran prop'u geçmiyordu)
- Detective'in `FilmDiscoveryBridge` butonları boş handler'dı
- "Listeye ekle" düğmesi eklemiyordu, yalnızca yönlendiriyordu → gerçek ekleme + `game_watchlist_added`
- Daily Chest ödülleri hiç uygulanmıyordu → `get-daily-chest` (migration 066/067)

**Ölçüm:**
- Event property şemaları ayrışmıştı (`guesses_used` / `turns_used` / `total_guesses`);
  hepsi taksonomiye çekildi — kapı metriği artık 6 oyunu da görüyor
- `docs/analytics/FAZ1_OLCUM_PLANI.md` yazıldı (bu planın G2.5 görevi)

**Üretim sağlığı:**
- `cast_json`/`imdb_rating` filtresi sunucuya taşındı: Spotlight havuzu 4 → 147,
  Detective 0 → 138 (Detective ilk kez üretilebildi)
- Quoted `games_enabled` dışına alındı (havuz tükendi, Hard Rule 7)
- Günlük tema (Tier 3.1) canlıda: migration 063 + `get-daily-theme` + hub kartı

## Kapanışta AÇIK KALAN işler

| Konu | Not |
|---|---|
| ShareCard 3 oyunda yok | CineMetrics/Spotlight/Detective kendi sonuç ekranlarını kullanıyor; paylaşım akışı eklenmedi |
| `game_milestone_earned` hiç ateşlenmiyor | Koleksiyon seviye atlama noktasına bağlanmadı |
| FadeIn poster sızıntısı | Blur istemcide; net poster payload'da. Sunucu tarafı blur ayrı iş |
| `rare_poster` / `dna_boost` ödülleri | Sandık config'inden çıkarıldı, Faz 2 |
| Quoted replik havuzu | Telif kararı gözden geçirilmeden geri açılamaz |

## Faz 2 kapısı

`docs/analytics/FAZ1_OLCUM_PLANI.md` → D7 farkı ≥ +10 puan **ve** haftalık medyan ≥ 3/7.
Bu iki metrik 4 haftada karşılanmazsa tab mimarisi değişmez (kill-criteria).
