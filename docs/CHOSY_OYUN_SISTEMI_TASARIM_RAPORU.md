# CHOSY — GÜNLÜK OYUN SİSTEMİ: TASARIM & MİMARİ RAPORU

> **Hazırlayan:** CTO (Claude)
> **Tarih:** 23 Temmuz 2026
> **Durum:** Founder onayı bekliyor — onay sonrası sprint planına çevrilecek
> **Kapsam:** Tüm challenge'ların detaylı tasarımı, ortak sistemler, veri modeli, Edge Function mimarisi, üretim hattı, telemetri, monetizasyon, fazlama
> **Karar referansı:** "Kademeli geçiş — oyunlar merkeze, öneri motoru Pro moda" (23 Temmuz oturumu)

---

## 0. Yönetici Özeti

Chosy, "sana film öneren uygulama"dan **"sinefil olmak için kullanılan günlük antrenman uygulaması"**na kademeli geçiş yapıyor. Bu rapor, geçişin oyun tarafındaki tüm yapı taşlarını tanımlar.

Ürünün yeni çekirdek döngüsü:

```
Her gün 00:00 → Herkese aynı günlük görev(ler) açılır
  → Kullanıcı 2-5 dakikada çözer
  → Her cevap Cinema DNA'ya sinyal yazar
  → Sonuç, paylaşılabilir "film şeridi" kartı üretir
  → Streak + Rank ilerler
  → Ertesi gün aynı saatte geri gelir
```

**Mimari felsefe:** Oyunlar birbirinden bağımsız mini uygulamalar DEĞİL; ortak beş sistemin (Daily Engine, Cinema DNA, Rank/XP, Streak, Share Artifact) üzerine oturan ince mekanik katmanlardır. Yeni oyun eklemek = yeni mekanik yazmak, sistem yazmak değil. Bu, "adım adım geçiş + yolda yeni fikirler" stratejinin teknik karşılığıdır.

---

## 1. Tasarım Anayasası

Tüm oyunlar aşağıdaki 8 kurala uymak zorundadır. Bir oyun fikri bu kurallardan birini geçemiyorsa ya revize edilir ya reddedilir.

| # | Kural | Gerekçe |
|---|-------|---------|
| A1 | **Günlük görev herkes için aynıdır** (küresel tek bulmaca) | Wordle etkisi: ortak deneyim → ertesi gün konuşma konusu → organik yayılım |
| A2 | **Günlük görev ≤ 5 dakikada biter** | Ritüel, seans değil. Uzun oyunlar arcade katmanına gider |
| A3 | **Her cevap Cinema DNA'ya en az 1 sinyal yazar** | "Neden NYT Games değil de biz?" sorusunun tek cevabı |
| A4 | **Her günlük görevin paylaşım artefaktı vardır** | Wordle'ın yeşil grid'i = sıfır bütçeli büyüme motoru |
| A5 | **Çözüm istemciye asla gönderilmez** — doğrulama sunucuda | Anti-cheat + leaderboard bütünlüğü |
| A6 | **İçerik üretimi otomatik olmalı** (TMDB metadata / AI hattı), manuel küratörlük darboğaz yaratamaz | Duolingo modelini elerken öğrendiğimiz ders |
| A7 | **Yeni telif maruziyeti yasak** — mevcut taban çizgimiz (TMDB poster/backdrop/metadata) aşılamaz | Film karesi, ses, gerçek eleştirmen alıntısı kullanan mekanikler Faz 3'te, hukuki çözümle açılır |
| A8 | **Hata sessizce yutulamaz** (mevcut hard rule) — üretim hattı ve oyun akışındaki her hata Sentry'ye düşer, kullanıcıya durum gösterilir | 14 günlük outage dersi |

---

## 2. Sistem Mimarisi — Genel Bakış

```
┌─────────────────────────────────────────────────────────┐
│                      OYUN KATMANI                        │
│  CineMetrics │ Logline │ Clash │ Blitz │ (Faz 3 oyunları)│
└──────┬──────────┬─────────┬────────┬────────────────────┘
       │          │         │        │
┌──────▼──────────▼─────────▼────────▼────────────────────┐
│                   ORTAK SİSTEMLER                        │
│  Daily Engine │ Cinema DNA │ Rank/XP │ Streak │ Share    │
└──────┬──────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│                    BACKEND (Supabase)                    │
│  daily_puzzles │ game_scores │ cinema_dna │ arcade_runs  │
│  Edge Fn: get-daily │ submit-guess │ submit-run │        │
│           generate-puzzles (cron) │ get-leaderboard      │
└─────────────────────────────────────────────────────────┘
```

Mevcut altyapıdan yeniden kullanılanlar: `daily_puzzles` + `game_scores` tabloları, GameShell/ResultCard bileşenleri, streak RPC'leri (`update_streak`), kota motoru (`quotaEngine`), PostHog wrapper, film kataloğu + `curation_tier` sistemi.

---

## 3. Ortak Sistemler

### 3.1 Daily Challenge Engine

**Görevi:** Her takvim günü için bulmacaları üretmek, sunmak ve tek seferlik çözümü garanti etmek.

**Gün tanımı (kritik karar):** Bulmaca, **cihazın yerel takvim gününe** anahtarlanır (Wordle modeli). Kullanıcı gece yarısında "yeni gün" hisseder; bu ritüel psikolojisi için şarttır. Bedeli: saat dilimleri arası ~24 saatlik spoiler penceresi. Wordle bu bedelin önemsiz olduğunu küresel ölçekte kanıtladı. Sunucu tarafında her takvim tarihi için bulmaca önceden üretilir; istemci `puzzle_date = cihaz yerel tarihi` ile ister.

**Tek seferlik çözüm garantisi:** `game_scores` üzerinde `UNIQUE(user_id, puzzle_id)` + Edge Function idempotency. Devam eden oyun durumu (kaçıncı tahmin, hangi feedback'ler) sunucuda `game_scores.progress_json`'da tutulur → cihaz değişse/uygulama silinse bile durum korunur ve "temiz cihazla ikinci deneme" hilesi kapanır.

**Bulmaca yayın takvimi:** Cron (haftalık) her oyun için **14 gün ilerisini** üretir ve doğrular. Üretim hattı bölüm 6'da.

### 3.2 Cinema DNA (kimlik/istatistik katmanı)

Film Strip vizyonundaki 6 boyut korunur ancak **oyun-beslemeli** olacak şekilde yeniden tanımlanır — küratörlü ders içeriği yoktur, tüm skorlar oyun davranışından türetilir. Boyutlar fazlara göre aktive olur:

| Boyut | Ne ölçer | Besleyen sinyal | Aktivasyon |
|-------|----------|-----------------|-----------|
| Knowledge | Film evreni bilgisi | CineMetrics/Logline çözüm başarısı, Blitz doğru sayısı | Faz 1 |
| Deduction | Az ipucuyla sonuca gitme | Kaç tahmin/kaç açık kelimeyle çözüldüğü (verim skoru) | Faz 1 |
| Auteur Sense | Yönetmen/imza tanıma | Blitz yönetmen kategorileri, CineMetrics'te yönetmen sütununu erken yeşilletme | Faz 1 |
| Instinct | Hız + sezgi | Clash serisi uzunluğu, cevap süreleri | Faz 2 |
| Consistency | Süreklilik | Streak, haftalık tamamlama oranı | Faz 1 |
| Visual Sense | Görsel okuma | Focus Pull / Glyph Grid (telif çözümü sonrası) | Faz 3 — profilde "kilitli" görünür |

**Hesaplama:** Her boyut 0-100. Sinyaller `game_scores.dna_signals` (JSONB) olarak yazılır; boyut skoru **EWMA** (üstel ağırlıklı hareketli ortalama, α=0.15) ile güncellenir → yeni performans eskisini yavaşça ezer, tek kötü gün profili çökertmez. İnaktiflikte skor DÜŞMEZ (cezalandırma churn üretir); bunun yerine 7+ gün sinyal yoksa boyutun yanında "paslanıyor" göstergesi çıkar.

**Cinema Score:** `round(0.30·Knowledge + 0.20·Deduction + 0.15·Auteur + 0.15·Instinct + 0.20·Consistency)` — Visual Sense aktive olunca ağırlıklar yeniden dağıtılır (migration ile, hardcode değil `app_config`'ten).

**Rank merdiveni:** Movie Lover (0) → Film Explorer (20) → Cinema Apprentice (35) → Film Scholar (50) → Cinephile (65) → Cinema Master (80+). Rank, Cinema Score eşiği + minimum toplam görev sayısı ister (ör. Cinephile için ≥60 tamamlanmış günlük görev) → tek haftada zirve yapılamaz, kimlik "kazanılmış" hisseder.

**Kimlik unvanı:** En güçlü 2 boyut kombinasyonundan türetilir ("The Visual Detective" tarzı, 15 kombinasyon × arketiple harmanlanmış isim seti). Mevcut 12 arketip sistemi silinmez: arketip = *zevkin kim*, Cinema DNA = *gözün ne kadar keskin*. Profil bu iki kimliği yan yana gösterir.

### 3.3 XP ve Ekonomi

XP tek para birimidir, satın alınamaz. Kaynaklar: günlük görev tamamlama (taban 50 XP) + verim bonusu (az tahminle çözme, maks +50) + streak çarpanı (7+ gün: x1.1, 30+ gün: x1.25) + arcade (run başına tavan 30 XP, günlük arcade XP tavanı 90 → grind ile şişirme kapalı). XP → haftalık lig sıralaması ve rank ilerlemesinde "toplam görev" sayacını besler. Enflasyon kontrolü: tüm katsayılar `app_config`'te, lazy-getter kuralıyla okunur.

### 3.4 Streak

Tek birleşik streak: **gün içinde en az 1 günlük görevi tamamlamak** (arcade saymaz — ritüeli korumak için). Mevcut `user_streaks` tablosu ve `update_streak` RPC yeniden kullanılır; tetik noktası günlük görev tamamlanma anına taşınır. **Streak Freeze:** ayda 1 otomatik koruma herkese; ek freeze Premium'da. Streak kaybı anında "acıma bildirimi" yok — sessiz sıfırlama + ertesi gün "yeniden başla" çerçevesi (kayıptan utanç değil, temiz sayfa).

### 3.5 Paylaşım Artefaktı ("Film Şeridi Kartı")

Her günlük görevin sonucu, **tek görsel formatında** üretilir: dikey film şeridi çerçevesi içinde (a) oyuna özgü spoiler-içermeyen sonuç grid'i, (b) deneme sayısı/verim, (c) Cinema DNA çentiği ("Deduction +6"), (d) günün numarası ("Chosy #47"), (e) uygulama işareti. Görsel istemcide `react-native-view-shot` ile render edilir → native share sheet. Metin fallback'i (emoji grid) her oyun spec'inde tanımlı. Kural: kart **filmin adını asla içermez** (spoiler yasağı = paylaşımın merak motoru).

### 3.6 Anti-Cheat Mimarisi

Üç savunma hattı: (1) çözüm istemciye inmez — her tahmin `submit-guess` Edge Function'a gider, yanıt sadece feedback içerir; (2) durum sunucuda — `progress_json` tek gerçek kaynak, istemci restart'ı durumu sıfırlamaz; (3) arcade skorları sunucu-taraflı zaman damgası ve makul-üst-sınır lint'inden geçer (60 saniyede 40 film yazan run flag'lenir, leaderboard'a girmez, Sentry'ye düşer — sessiz düşürme yok, A8). Leaderboard yalnızca doğrulanmış skorları gösterir.

### 3.7 Kota ve Erişim Katmanı

| İçerik | Free | Premium |
|--------|------|---------|
| Günlük görevler (CineMetrics + Logline) | Sınırsız erişim (günde zaten 1'er tane) | Evet |
| Arcade (Clash, Blitz) | Günde 3 run (toplam) | Sınırsız |
| Geçmiş bulmaca arşivi | Hayır | Evet (NYT Games modeli — en güçlü premium kancası) |
| Cinema DNA detay analitiği (trend grafikleri, boyut kırılımı) | Özet | Tam |
| Hard Mode (bkz. oyun spec'leri) | Hayır | Evet |
| Streak Freeze | Ayda 1 | Ayda 4 |

Günlük görevlerin free kalması bilinçli: onlar büyüme motoru, arcade + arşiv + analitik gelir motoru. Mevcut `quotaEngine` fail-open stratejisiyle aynen kullanılır.

---

## 4. Oyun Spesifikasyonları

### 4.1 CineMetrics — Amiral Gemi (Faz 1, Günlük)

**Konsept:** Günün gizli filmini metadata feedback'iyle bulma. Wordle'ın sinema versiyonu. 6 tahmin hakkı.

**Neden amiral:** Sıfır içerik maliyeti (saf TMDB metadata), sıfır yeni telif riski, sonsuz üretilebilirlik, kanıtlanmış talep (Moviedle/Framed klon ekosistemi), en zengin paylaşım grid'i.

#### Oynanış Akışı
1. Kullanıcı açar → "Chosy #N" başlığı + boş 6 satırlık grid + film arama kutusu.
2. Autocomplete'ten film seçer (tüm katalog aranabilir; cevap havuzu kısıtlı ama tahmin havuzu serbest — UX için kritik).
3. `submit-guess` → sunucu 6 sütunluk feedback döner.
4. Doğru film → kutlama + sonuç kartı. 6 tahmin biter → cevap açıklanır + kart ("X" işaretli).

#### Feedback Sütunları ve Renk Kuralları

| Sütun | Yeşil | Sarı | Gri + yön oku |
|-------|-------|------|---------------|
| **Yıl** | Tam eşleşme | ±5 yıl içinde | ↑/↓ (hedef daha yeni/eski) |
| **Tür** | Tür kümeleri birebir aynı | En az 1 ortak tür | — |
| **Yönetmen** | Aynı yönetmen | Aynı yönetmenle başka ortak film bağı YOK — sarı kullanılmaz (gürültü üretir) | — |
| **TMDB Puanı** | ±0.2 içinde | ±0.5 içinde | ↑/↓ |
| **Süre** | ±5 dk içinde | ±15 dk içinde | ↑/↓ |
| **Dönem/Ülke** (6. sütun) | Aynı ülke | Aynı kıta | — |

Not: 6. sütun A/B adayı — "Ülke" vs "Popülerlik on yılı". Lansmanda Ülke ile başla (uluslararası sinema bilgisini ödüllendirir, hedef kitle sinefil).

#### Cevap Havuzu Kuralları (üretim hattı lint'i)
- `curation_tier IN ('core','extended')`, `vote_count >= 1000`, tüm 6 sütun alanı NOT NULL
- Son 365 günde cevap olmamış; aynı yönetmen son 14 günde cevap olmamış
- Haftalık zorluk eğrisi: Pzt-Salı yüksek popülerlik (kolay), Cuma-Cmt kült/derin kesim (zor) — NYT çapraz bulmaca ritmi. Zorluk skoru = `f(popularity, vote_count)`.

#### Skor ve DNA Sinyalleri
- XP: 1. tahmin 100 / 2. 85 / 3. 70 / 4. 55 / 5. 45 / 6. 35 / başarısız 10 (katılım).
- DNA: `Knowledge` (çözdü/çözemedi + zorluk ağırlıklı), `Deduction` (tahmin verimi: 6-denemede-çözen ile 2-denemede-çözen farkı), `Auteur Sense` (yönetmen sütununu 3. tahminden önce yeşilletme → +sinyal).

#### Paylaşım Kartı
6x6 renk grid'i (satır=tahmin, sütun=feedback), film şeridi çerçevesinde. Metin fallback: `Chosy #47 4/6` + emoji satırları + yön okları. Film adı yok.

#### Hard Mode (Premium)
4 tahmin hakkı + yön okları kapalı (sadece renk). Ayrı XP çarpanı (x1.3), leaderboard'da rozet.

#### Kenar Durumları
- Aynı filmin yeniden çekimi/aynı ad (örn. 1968/2018): autocomplete `title (year)` formatı zorunlu.
- Çok yönetmenli filmler: dizi olarak karşılaştır, kesişim varsa yeşil.
- Tür dizisi TMDB'de sıralı değil: küme karşılaştırması (sıra bağımsız).
- Guess spam: dakikada maks 10 `submit-guess` (rate limit, aşımda kibar hata — A8).

---

### 4.2 The Logline — İkinci Günlük (Faz 1)

**Konsept:** Filmin TMDB açıklaması (overview) ekranda, kritik kelimeler siyah bantla sansürlü. 6 tahmin; her yanlışta bir bant düşer. Az açık kelimeyle bulan prestij kazanır.

**Pinpoint ilişkisi:** Mevcut Pinpoint (5 ipucu) bu oyunun kuzeni; Logline canlıya çıktıktan 2 hafta sonra Pinpoint günlük rotasyondan çekilir, altyapısı (arama/autocomplete bileşeni) Logline'a devrolur. İki benzer oyunu aynı anda vitrine koymayız.

#### Sansür Haritası Üretimi (bulmaca üretim anında, runtime'da DEĞİL)
1. Overview'dan aday kelimeler: özel isimler (karakter/yer/oyuncu), başlık kelimeleri (her zaman sansür), yüksek-bilgi içerikli isimler/fiiller.
2. Claude Haiku'ya tek çağrı: "bu overview'da filmi ele veren kelimeleri bilgi değerine göre sırala" → sansür listesi + **açılma sırası** (en az bilgi verenden en çok verene).
3. Lint: sansür sonrası kalan metin >= %40 (aksi halde bulmaca anlamsız), sansür sayısı 5-9 arası, overview uzunluğu 30-80 kelime. Geçemeyen film havuzdan düşer, alarm üretir (A8).
4. Çıktı `puzzle_data`'ya gömülür → runtime'da AI çağrısı yok, maliyet ve gecikme sıfır.

#### Skor ve DNA
- XP: CineMetrics ile aynı merdiven.
- DNA: `Knowledge` + `Deduction` (kaç bant açıkken çözüldü — bu oyunun ana verim metriği). `Auteur Sense` sinyali yok (yönetmen bilgisi oyunda geçmiyor).

#### Paylaşım Kartı
Sansürlü metnin siluet görseli (bantlar görünür, kelimeler asla) + "3 bant açıkken buldum" ifadesi + grid. Metin fallback: `Chosy Logline #47 — (3/6)`.

#### Kenar Durumları
- İngilizce overview + TR kullanıcı: Faz 1'de overview'lar İngilizce kalır (hedef pazar US/CA/UK; TR lokalizasyonu backlog). UI çerçevesi çevrilir, bulmaca metni çevrilmez — çeviri sansür haritasını bozar.
- Overview'u zayıf filmler (tek cümle, spoiler içeren): lint eler.

---

### 4.3 Box Office / Rating Clash — Arcade (Faz 2)

**Konsept:** İki film, tek soru: "hangisi daha yüksek/uzun/yeni?" Doğru bildikçe seri devam eder, yanlışta biter. Endless, hız/dopamin modu.

**Mekanik detay:**
- Karşılaştırma ekseni her 5 soruda değişir (rating → runtime → yıl → TMDB popularity → vote count) → tek eksen ezberi kırılır.
- Çift üretimi sunucuda, 10'luk batch'ler halinde: `|delta|` alt eşiği (rating için >= 0.3, süre için >= 8dk) → "kıl payı" adaletsizliği yok; üst eşik → aşırı bariz çiftler elenir (delta persentil 10-85 bandı).
- 3 saniyelik cevap süresi bonusu (hızlı doğru = +2 combo puanı).
- Run sonu: skor + günün en iyi serisi leaderboard'u.

**DNA:** `Instinct` (seri uzunluğu + ortalama cevap süresi). Zayıf ama gerçek bir `Knowledge` sinyali de yazar (yüksek seriler bilgisiz kurulamaz).

**Kota:** Free 3 run/gün (Blitz ile ortak havuz), Premium sınırsız. Paylaşım: "23 seri" kartı — günlük görev kartından farklı, sade rekabet formatı.

---

### 4.4 Auteur Blitz — Arcade (Faz 2)

**Konsept:** Kategori + 60 saniye: "Nolan filmleri", "90'lar bilimkurgusu", "En İyi Film Oscar'ı kazananlar". Kullanıcı yazabildiği kadar yazar; TMDB fuzzy-match anında doğrular.

**Mekanik detay:**
- Cevap kümeleri bulmaca üretiminde **precompute** edilir (runtime'da TMDB sorgusu yok): kategori → film ID listesi + kabul edilen alternatif başlıklar (orijinal + EN + yaygın kısaltmalar; "LOTR" → kabul).
- Fuzzy eşleşme: normalize (lowercase, noktalama sil) + trigram benzerlik >= 0.75 → istemcide anlık ön-eşleşme (hız hissi), sunucuda kesin doğrulama (skor bütünlüğü).
- Kategori havuzu üç zorlukta; günün Blitz'i günlük olabilir AMA Faz 2'de arcade olarak başlar (kategori havuzu yeterince derinleşince "Daily Blitz" terfisi değerlendirilir — açık karar #3).

**DNA:** `Auteur Sense` (yönetmen kategorileri), `Knowledge` (dönem/tema kategorileri).

**Kenar durumu:** Yazım hatası toleransı ile yanlış film kabulü arasındaki denge → eşik 0.75'te başlar, telemetriden (`blitz_reject_rate`) kalibre edilir.

---

### 4.5 Mevcut Oyunların Yeniden Konumlanması

| Oyun | Karar | Gerekçe |
|------|-------|---------|
| **Pinpoint** | Logline'a devrolur (bkz. 4.2), 2 hafta paralel yaşar | Aynı mekanik ailesinin zayıf versiyonu |
| **Imposter** | Kalır — haftalık "bonus görev" slotuna taşınır (Pazar günleri) | Çalışan içerik; ama günlük çekirdeğe girecek derinliği yok |
| **Replik Tahmin** | Faz 2 sonunda emekli edilir; The Critic (AI-pastiş) yerini alır | 100+ gerçek replik = mevcut telif gri alanımız; A7 gereği azaltıyoruz, büyütmüyoruz |

### 4.6 Faz 3 Oyunları — Ön Spec (detay tasarım, faz kapısı geçilince)

- **Focus Pull:** Bulanıktan netleşen görsel. Açılma şartı: görsel kaynağın hukuki çözümü — poster tabanlı versiyon (TMDB taban çizgimiz içinde) önce denenir; film karesi versiyonu ancak lisanslı kaynak bulunursa. DNA: Visual Sense.
- **Glyph Grid:** 4 monokrom ikonla film anlatımı. Açılma şartı: AI-destekli ikon seçim hattı (Claude → ikon seti eşlemesi → founder onaylı batch). DNA: Deduction + Visual Sense.
- **The Critic:** AI'ın "efsanevi eleştirmen üslubunda" yazdığı pastiş yorumdan film tahmini. Gerçek alıntı yok (A7 temiz). Üretim: haftalık batch, Claude, ton lint'i. DNA: Analysis/Knowledge.
- **The Gauntlet:** 5 oyunluk maraton, 10 can, haftalık (her Cumartesi). Açılma şartı: en az 4 canlı oyun + istikrarlı DAU. Paylaşım kartı en prestijlisi.
- **Movie Duel (1v1):** Arkadaşla 5 raund asenkron düello. Açılma şartı: sosyal graf (Faz 3 arkadaş sistemi). Likidite gerektirmeyen asenkron tasarım (davet linki ile dışarıdan rakip → aynı zamanda viral kanal).

---

## 5. Veri Modeli

Mevcut `daily_puzzles` ve `game_scores` genişletilir (yeni tablo minimumda tutuldu). Tüm değişiklikler `supabase db push` ile (Rule 10).

```sql
-- 051: daily_puzzles genişletme
ALTER TABLE daily_puzzles
  ADD COLUMN difficulty SMALLINT,              -- 1-5
  ADD COLUMN solution_ref UUID REFERENCES films(id), -- cevap; RLS: istemciye ASLA select edilmez
  ADD COLUMN validation_status TEXT DEFAULT 'pending'
    CHECK (validation_status IN ('pending','valid','rejected'));
-- puzzle_data JSONB: oyun-özel yük (sansür haritası, sütun konfigürasyonu, kategori cevap kümesi)
-- RLS: SELECT yalnızca solution_ref HARİÇ view üzerinden (public_daily_puzzles view)

-- 052: game_scores genişletme
ALTER TABLE game_scores
  ADD COLUMN progress_json JSONB,              -- devam eden oyun durumu (tahminler + feedback'ler)
  ADD COLUMN dna_signals JSONB,                -- [{dim:'knowledge', val:0.8, weight:1.0}]
  ADD COLUMN xp_awarded INTEGER DEFAULT 0,
  ADD COLUMN is_hard_mode BOOLEAN DEFAULT false,
  ADD COLUMN flagged BOOLEAN DEFAULT false;    -- anti-cheat işareti
-- UNIQUE(user_id, puzzle_id) zaten mevcut — korunuyor

-- 053: cinema_dna
CREATE TABLE cinema_dna (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  knowledge REAL DEFAULT 0, deduction REAL DEFAULT 0,
  auteur_sense REAL DEFAULT 0, instinct REAL DEFAULT 0,
  consistency REAL DEFAULT 0, visual_sense REAL DEFAULT 0,
  cinema_score SMALLINT GENERATED ALWAYS AS (...) STORED,
  rank_id SMALLINT DEFAULT 1,
  identity_title TEXT,
  total_dailies_completed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: self read/write via RPC only
-- Not: cinema_score generated yerine trigger ile hesaplanır (ağırlık değişebilirliği için)

-- 054: arcade_runs
CREATE TABLE arcade_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  game_id TEXT NOT NULL,                        -- 'clash' | 'blitz'
  score INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,                 -- sunucu ölçümü
  detail_json JSONB,                            -- eksen kırılımı / yazılan filmler
  verified BOOLEAN DEFAULT false,               -- lint geçti mi
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON arcade_runs (game_id, created_at DESC, score DESC); -- günlük leaderboard
```

**Kritik RLS notu:** `solution_ref` sızıntısı tüm sistemi çökertir. `daily_puzzles` tablosu istemciye kapalı; istemci yalnızca `public_daily_puzzles` view'ını (solution_ref ve sansür kelimeleri hariç) görür. Bu, migration 051'in kabul kriteridir ve code review'da ilk bakılacak satırdır.

---

## 6. Bulmaca Üretim Hattı

```
CRON (haftalık, Pazartesi 06:00 UTC) → generate-puzzles Edge Fn
  1. Her oyun için 14 günlük takvim boşluğunu bul
  2. Aday seçimi (havuz kuralları, bkz. 4.1/4.2) — deterministik seed = tarih
  3. Oyun-özel hazırlık:
     - CineMetrics: sütun verisi snapshot'ı (TMDB verisi sonradan değişirse bulmaca sabit kalsın)
     - Logline: Claude ile sansür haritası (batch, ~14 çağrı/hafta — maliyet ihmal edilebilir)
     - Blitz: kategori cevap kümesi precompute
  4. LİNT (her bulmaca): zorunlu alanlar, tekrar kontrolü, zorluk skoru, Logline metin oranı
  5. validation_status='valid' → yayına hazır
  6. HERHANGİ bir adım başarısızsa: Sentry alarm + status='rejected' + yedek bulmaca
     havuzundan otomatik ikame (30 önceden onaylı acil durum bulmacası her zaman hazır)
     → "o gün bulmaca yok" durumu MÜMKÜN DEĞİL (A8: hata görünür, kullanıcı etkilenmez)
```

İzleme: cron her koşumda PostHog'a `puzzle_generation_report` (üretilen/reddedilen/ikame sayıları) yazar; 2 hafta üst üste reddetme oranı >%20 ise havuz kuralları gözden geçirilir.

---

## 7. Edge Functions

| Fonksiyon | Görev | Not |
|-----------|-------|-----|
| `get-daily-challenge` | Tarihe göre bulmaca + kullanıcının progress'i | solution asla dönmez; cache: 24h CDN |
| `submit-guess` | Tahmin doğrulama + feedback + DNA sinyal yazımı | Idempotent, rate-limit 10/dk, progress_json günceller |
| `submit-arcade-run` | Run kaydı + lint + leaderboard | Süre sunucu doğrulamalı |
| `generate-puzzles` | Cron üretim hattı (bölüm 6) | Service role |
| `get-leaderboard` | Günlük/haftalık lig | Materialize edilmiş, 5dk cache |
| `recompute-cinema-dna` | EWMA güncelleme | submit-guess içinden senkron çağrı (ayrı fonksiyon = test edilebilirlik) |

Mevcut 24 fonksiyona +6. `parse-mood`/`recommend` hattına dokunulmuyor (Pro mod olarak yaşamaya devam ediyor).

---

## 8. Telemetri Taksonomisi (PostHog)

Adlandırma: `game_*` prefix'i, snake_case.

- `game_daily_opened` {game_id, puzzle_no, source: home_widget|hub|push}
- `game_guess_submitted` {game_id, guess_no, latency_ms}
- `game_daily_completed` {game_id, won, guesses_used, xp, hard_mode, time_to_solve_s}
- `game_share_card_rendered` / `game_share_completed` {channel} — kuzey yıldızı hunisinin son adımı
- `game_arcade_run` {game_id, score, duration_ms, verified}
- `dna_updated` {dims_changed, cinema_score, rank_changed}
- `streak_incremented` / `streak_lost` / `streak_freeze_used`
- `puzzle_generation_report` (sunucu)

**Faz 1 karar metrikleri:** (a) günlük görev tamamlayanların D7'si vs tamamlamayanlar (birincil), (b) `share_completed / daily_completed` oranı (hedef >= %8 — Wordle zirvede ~%10-15 civarındaydı), (c) 7 günlük görev tamamlama oranı (ritüel tutuyor mu: hedef medyan >= 4/7).

---

## 9. Monetizasyon Haritası (özet)

Free = büyüme motoru (günlük görevler + paylaşım). Premium ($6.99 aylık mevcut plan korunur) = **arşiv** (geçmiş bulmacalar — NYT'nin kanıtladığı en güçlü kanca) + sınırsız arcade + Hard Mode + tam DNA analitiği + 4 streak freeze. Lifetime/Founding yapısı değişmez. Mood/öneri motoru Premium içinde "Pro" sekmesine taşınır — mevcut aboneler hiçbir şey kaybetmez, yeni değer kazanır (App Store review riski sıfır).

---

## 10. Fazlama ve Kill-Criteria

| Faz | Kapsam | Kapı (geçiş şartı) |
|-----|--------|---------------------|
| **Faz 1** (~3 sprint) | Ortak sistemler (Daily Engine, DNA v1, Share, XP/Streak) + CineMetrics + Logline; Home'a "Bugünün Görevi" widget'ı | D7 farkı: görev tamamlayanlar >= +10 puan VE 7-gün tamamlama medyanı >= 3/7 (4 hafta veri) |
| **Faz 2** | Clash + Blitz (arcade+kota), Hard Mode, arşiv premium'u, haftalık lig; ana ekran kahramanı = Daily | Arcade'in premium dönüşüme katkısı ölçülür; share oranı >= %5 sürdürülüyor |
| **Faz 3** | Sosyal (arkadaş, Duel), Gauntlet, telif-çözümlü görsel oyunlar; öneri motoru "Pro mod" nihai konumuna | — |

**Kill-criteria (dürüstlük maddesi):** Faz 1 kapısı 4 hafta sonunda karşılanmazsa ana ekran devri YAPILMAZ; oyunlar hub'da kalır ve yeni bir strateji oturumu açılır. Kademeli geçişin sigortası budur.

---

## 11. Riskler

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| CineMetrics zorluk kalibrasyonu tutmaz (çok kolay/zor) | Orta | Yüksek | Haftalık zorluk eğrisi + `guesses_used` dağılımı telemetrisi; hedef medyan 4/6 |
| Paylaşım oranı düşük kalır → organik büyüme çalışmaz | Orta | Yüksek | Kart tasarımına Faz 1'de ayrı tasarım turu; A/B: grid-önce vs prestij-önce kart |
| TMDB veri kalitesi (null runtime, tutarsız tür) | Yüksek | Orta | Lint + snapshot; reddedilen film alarmı |
| solution_ref sızıntısı | Düşük | Kritik | View-only erişim, code review kabul kriteri, pen-test maddesi |
| Türkçe kullanıcı deneyimi (EN bulmaca metni) | Orta | Düşük | Hedef pazar EN; TR bulmaca lokalizasyonu backlog'a |
| İki günlük oyun "çok" gelir, biri sönük kalır | Orta | Orta | Telemetride ayrı izlenir; sönük olan haftalık slota indirilir |

---

## 12. Founder Onayı Bekleyen Açık Kararlar

1. **CineMetrics 6. sütun:** Ülke (önerim) mi, popülerlik on yılı mı?
2. **Gün sıfırlama:** Yerel gece yarısı (önerim, Wordle modeli) onaylı mı?
3. **Blitz'in kaderi:** Arcade olarak mı kalsın (önerim), yoksa üçüncü günlük mü olsun?
4. **Replik Tahmin emekliliği:** Faz 2 sonu onaylı mı? (Telif azaltma gereği güçlü önerim: evet)
5. **Faz 1 kapı eşiği:** D7 +10 puan makul mü, yoksa daha agresif mi istersin?

Onay + revizyonlar geldikten sonra Faz 1, sprint planına (CHOSY_SPRINT_PLANI.md formatında, paste-and-run Claude Code prompt'larıyla) çevrilecek.

*— CTO raporu sonu*
