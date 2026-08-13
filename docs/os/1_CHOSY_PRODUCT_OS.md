# 🎬 CHOSY PRODUCT OS

**Versiyon:** v4.0 · 5 Ağustos 2026
**Durum:** Envanter doğrulamasından sonra baştan üretildi
**Sahibi:** Mertkan Yılmaz — nihai ürün kararları

> **İşaretleme:** ✅ doğrulandı (envanter/SQL/kod okuması, 5 Ağu 2026) · ⚠️ varsayım veya model

---

## 0. BU BELGENİN VAR OLMA SEBEBİ

Chosy'nin en pahalı sorunu ürün kalitesi değil, **sürekli yapı değiştirmekti.** Sebep kararsızlık değil, **fikrin mimariye gömülü olmasıydı** — her fikir değişikliği kod tabanının tamamını etkiliyordu.

Bu belgenin merkezi tasarım hedefi:

> **Fikir değişebilir. Mimari değişmemeli.**

### Değişim protokolü

| Kural | |
|---|---|
| Sessiz düzenleme yasak | Değişen karar silinmez, ~~üstü çizilir~~, altına yenisi tarih + gerekçeyle yazılır |
| 🔒 Kilitli kararlar | Değiştirmek için **yeni veri** gerekir, yeni fikir değil |
| 🔓 Açık kararlar | Serbestçe değişir — mimari bunlara bağlanmamıştır |
| Doğrulama | Bir sayı veya yol adı yazılıyorsa ✅ ya da ⚠️ işareti taşır |

---

## 1. ÜRÜN

### 1.1 Tek cümle

> **Chosy her akşam sana 4 film gösterir. 3 seçimle 1 tanesine inersin. Ne izleyeceğini sormaz — seçmeni kolaylaştırır.**

### 1.2 Konumlandırma

| | |
|---|---|
| Çözülen problem | Karar felci — "bu akşam ne izlesem" sorusunda kaybedilen zaman |
| Kategori | Günlük ritüel ürünü (Wordle / NYT Games sınıfı), film öneri aracı değil |
| Hedef pazar | US · CA · UK birincil ⚠️ · TR arayüz desteği var, hedeflenmiyor |
| App Store | Entertainment → **Games/Trivia** (planlı, yapılmadı) |

### 1.3 Karar durumu

| Katman | Durum |
|---|---|
| Problem: karar felci | 🔒 |
| Çekirdek eylem: günde 1 gauntlet · 4 film · 3 tur · 1 şampiyon | 🔒 |
| Ritüel kuralı: bittiğinde biter, kıtlık satılmaz | 🔒 |
| Girdi: serbest metin değil, tahmin edilen + düzeltilebilir bağlam | 🔒 |
| Veri felsefesi: ham olay sakla, profili türet | 🔒 |
| Gauntlet vs braket | 🔓 1.000 kullanıcıda A/B |
| 4 filmin seçim algoritması | 🔓 Sürekli iyileşecek |
| Bonus oyun seçimi | 🔓 Şu an Spotlight |
| Fiyat, paywall tetikleyicileri | 🔓 Veriyle ayarlanacak |
| Görsel tasarım | 🔓 Retrofit, mimari değil |

---

## 2. NEDEN CHOSY — LLM'E KARŞI

### 2.1 Kabul edilen gerçek

Serbest metin kutusuna ruh hali yazıp öneri almak konusunda ChatGPT/Claude/Gemini Chosy'den iyidir. Bu alanda rekabet edilmez.

### 2.2 LLM'in yapısal olarak kaybettiği yerler

| LLM'in zaafı | Chosy'nin karşılığı |
|---|---|
| Seni tanımıyor; tanıması için senin çalışman gerekiyor | Davranıştan **pasif** öğrenme |
| Çıktı eyleme geçirilebilir değil (metin duvarı) | Poster, "nerede izlenir", tek dokunuş |
| Ne istediğini bilmeni şart koşuyor | Girdi maliyeti ≈ 0 |
| Sana gelmiyor, sen ona gidiyorsun | Bildirim, ritüel, streak |
| Çıktısı kimlik değil | Cinema DNA, paylaşılabilir sonuç |

### 2.3 Tasarım kuralı

> **Chosy'nin mekaniği, daha iyi prompt yazınca değil, daha çok veri birikince iyileşen bir mekanik olmalı.**

### 2.4 Başarı çıtası

- ❌ *"Kullanıcının favori filmini tahmin etmeliyiz"*
- ✅ *"Kullanıcının bu akşam izlemeye razı olacağı 2 film göstermeliyiz"*

Bu bir tahmin problemi değil, **seçim mimarisi** problemi.

---

## 3. ÇEKİRDEK MEKANİK — GAUNTLET

### 3.1 Yapı

```
TUR 1    [Film A]  vs  [Film B]     → kazanan
TUR 2    kazanan   vs  [Film C]     → kazanan
FİNAL    kazanan   vs  [Film D]     → 🏆 BUGÜNÜN FİLMİ
```

Günde 1 kez. 4 film, 3 tur, 1 şampiyon.

### 3.2 Neden gauntlet, braket değil

İnsanın doğal karar sürecinin kopyası — ekranda her zaman "şu anki seçimin" durur, ona bir meydan okuyucu gelir.

**Bilinen bias ve düzeltmeleri:**

| Bias | Düzeltme |
|---|---|
| Geç giren film avantajlı (⚠️ rastgele seçimde %50 ihtimalle tek maçla şampiyon) | Çerçeve "şampiyon savunuyor" değil **"şu anki seçimin"** |
| Maruz kalma etkisi | 4 filmin sırası **her gün rastgele** — skora göre sıralama yasak |
| Pozisyon bias'ı | Sol-sağ rastgele, `position_of_winner` kaydediliyor |
| Sıralama bias'ı veriye sızıyor | Ağırlık: meydan okuyucu 1.0 · 1. savunma 0.9 · 2. savunma 0.8 |

**Veri avantajı:** Zincir üretir — `D > A`, `A > B`, `A > C` → **D > A > {B,C}**. Braket'te B ile D asla karşılaştırılamaz.

### 3.3 Ret akışı

**Kural: ret bir tur harcamaz, o turu yeniler.**

```
Ret 1 → Sessizce ekseni değiştir, belirgin farklı yeni çift
Ret 2 → Bağlamı görünür kıl: [Daha hafif] [Daha kısa] [Bambaşka]
Ret 3 → Mekaniği terk et: [3 film listesi] [Watchlist'imden] [Boşver, yarın]
```

Yenileme hakkı: Free 2/gün · Pro sınırsız.

> "Boşver, yarın" bir başarısızlık değil, sağlıklı bir çıkıştır.

### 3.4 "Bunu izledim" kapısı

Ayrı eylem. Tur harcamaz, film değişir, bilgi profile yazılır. **İzleme geçmişinin ana kaynağı** — ayrı ekran gerekmeden birikir.

### 3.5 Gürültü koruması

| Sinyal | Tepki |
|---|---|
| latency < 1500ms | Düşük ağırlık |
| 3 art arda hızlı seçim | Oturum `low_intent`, sinyaller profile az yansır |
| `rejection_rate > 0.5` | Bu kullanıcı için gauntlet yanlış → tek-film modu |

### 3.6 Günlük akış

```
18:00 (yerel)  Bildirim: "Bugünün dörtlüsü hazır"
       ↓  "Dün [Film]'i izledin mi?"        ← hakikat sinyali
       ↓  Bağlam satırı (tahmin, düzeltilebilir)
       ↓  TUR 1 → TUR 2 → FİNAL             ← ~40 sn
       ↓  🏆 + nerede izlenir
       ↓  Braket paylaş · Streak
       ↓  [Bugünün bonusu: Spotlight]       ← opsiyonel
       Kapanır.
```

Gauntlet 18:00'den önce açılmaz. Gün dönümü yerel gece yarısı.

### 3.7 Şampiyon otomatik watchlist'e gitmez

`watchlist` bugün 318 satır ✅ ve **watched_at 0/318** ✅ — yani liste zaten ölü depo. Otomatik ekleme bunu büyütür. Kullanıcı açıkça "Sonraya bırak" derse gider.

---

## 4. BAĞLAM SİSTEMİ

### 4.1 İlke: tercih sorma, kısıt sor

- ❌ *"Ne izlemek istersin?"* → zor soru, kullanıcı bilmiyor
- ✅ *"Kaç kişisin, kaç saatin var, ne kadar yorgunsun?"* → kolay, 4 saniye

### 4.2 Görünür tahmin

```
Salı akşamı · Yalnız · ~2 saat  ⌄
```

| Kiminle | Ne kadar | Nasıl |
|---|---|---|
| Yalnız · Partner · Arkadaşlar · Aile | ~90dk · ~2sa · Fark etmez | Bitkin · Normal · Açığım |

Yazı girişi yok. Düzeltme **anında yeni çift** getirir.

### 4.3 Kurallar

- Tahmin güveni <%70 → tahmin etme, nötr varsayılan
- İlk oturumda asla tahmin etme
- Gizli tahmin yasak — yanlışsa kullanıcı ürünü suçlar

---

## 5. CINEMA DNA

### 5.1 İki eksen

| Eksen | Kaynak |
|---|---|
| **Zevk** — neyi seversin | Gauntlet seçimleri, izleme geri bildirimi |
| **Bilgi** — ne kadar sinema biliyorsun | Sadece trivia ölçebilir → bonus oyun bu yüzden korunuyor |

### 5.2 Arketip: beyan edilmez, kazanılır

~~Onboarding'de 6 soruluk quiz~~ → **davranıştan türetilir, 7. günde ortaya çıkar.**

`constants/archetypes.ts` ✅ mevcut. 12 arketip artık **küme merkezi** olarak kullanılır:

```
kullanıcı_vektörü = w × gözlenen + (1−w) × en_yakın_arketip_merkezi
w = min(1.0, sinyal_sayısı / 50)
```

Sıfır sinyalde `w=0` → prior devralır. "Bilmiyorum" durumu hiç oluşmaz.

### 5.3 Anlatı

```
7. gün   → "Bir profil oluşmaya başladı: Arşivci eğilimi"
30. gün  → "Sen bir Arşivci'sin. 22 filmin 14'ü 1990 öncesi."
90. gün  → "Arşivci → Sınır Tanımaz."
```

### 5.4 Güven göstergesi

```
Seni %35 tanıyorum  ▓▓▓░░░░░░
```

Zayıf öneriyi mazur gösterir · ilerleme yaratır · "sistem beni öğreniyor" hissini somutlaştırır.

---

## 6. ADAY HAVUZU — GÜNÜN 4 FİLMİ

### 6.1 Doğru hedef

- ❌ En iyi eşleşen 4 film → dördü benzer olur, seçim anlamsızlaşır
- ✅ Aralarında seçim yapmanın **anlamlı** olduğu 4 film

**Çeşitlilik birincil kriterdir.**

### 6.2 Gerçek havuz ✅

**13 Ağustos 2026'da yeniden ölçüldü** (C.0d ölçüm turu — kapanış 17 Ağustos'a
bağlı, bkz. 4_OS "C.0d DURUM ÖZETİ"). Tüm satırlar güncellendi;
eski değerler ~~üstü çizili~~ bırakıldı — sayıların hangi yönde hareket ettiği
görünür kalsın diye.

| Katman | Film | Not |
|---|---|---|
| archive | ~~1.528~~ → **1.537** | Migration 050 ile eşleştirmeden dışlanıyor |
| extended | ~~948~~ → **949** | |
| core | ~~860~~ → **862** | |
| trending | ~~58~~ → **56** | 079 tier restorasyonu + 081 sonrası gerçek değer |
| **Toplam** | ~~**3.394**~~ → **3.404** | |
| **Öneri havuzu** | ~~**1.866**~~ → **1.867** | archive hariç |
| **Düello-uygun** | ~~**1.865** (%99,9)~~ → **1.867 (%100)** | tüm alanlar dolu + profile_vector var |

`profile_vector` NULL: **0** ✅ (84 film 5 Ağustos'ta profillendi, $0,163)

> **13 Ağustos 2026 — düello-uygunluk %99,9'dan %100'e çıktı.** Eski satır
> "1.865/1.866" diyordu; tek eksik film artık yok. Ölçüm üç bağımsız sorguyla
> doğrulandı: aktif tier'daki 1.867 filmin **tamamının** `film_profiles` satırı
> var, hiçbirinde `profile_vector` NULL değil, hiçbirinde `poster_url` NULL
> değil. Sebep: GATE 3 (migration 080, commit `f1e0163`) `profile-missing-films`
> cron'unu devreye aldı — vektörsüz film artık havuzda birikmiyor, haftalık
> kapatılıyor.
>
> ⚠️ Bu **%100 kalıcı bir garanti değil, o günkü ölçüm.** `weekly-trending-sync`
> Pazartesi 06:00 UTC'de yeni film ekliyor, `profile-missing-films` 08:00 UTC'de
> profilliyor — arada iki saatlik bir pencere var. Havuz o pencerede geçici
> olarak %100'ün altına düşebilir.

> **⏳ C.0f sonrası yeniden ölçülecek (13 Ağustos 2026, C.0e kararı).**
> Düello-uygun sayı **1.846**'ya inecek, **21 film** elenecek:
>
> | filtre | eler | not |
> |---|---:|---|
> | 1A `release_date` | **10** | 9 gelecek tarihli + 1 `release_date IS NULL` (*The Bourne Ultimatum*) |
> | 2A `recognition_missing` | **20** | tamamı `trending`, tamamı `year=2026` |
> | **birleşim** | **21** | örtüşme 9 → 10 + 20 − 9 |
>
> Havuz toplamı (1.867) **değişmez** — bu filmler `archive`'a taşınmıyor,
> yalnızca düello seçiminden eleniyor. Yukarıdaki **%100** oranı C.0e öncesi
> düello-uygunluk tanımına aittir.
>
> ⚠️ **Beklenen sayı önce ~1.847 sanılmıştı; doğrusu 1.846.** Hata `release_date
> IS NULL` olan tek filmin (Bourne) 1A tarafından da elendiğinin atlanmasından
> geldi. Sayı 13 Ağustos'ta doğrudan ölçüldü — hesapla değil sorguyla:
> `release_date=not.is.null & release_date=lte.<bugün> & or=(imdb_votes.gt.0,vote_average.gt.0)`
> → **1.846**.

> **Yöntem notu (13 Ağustos 2026):** Bu sayılar PostgREST üzerinden
> `Prefer: count=exact` başlığıyla, tier başına ayrı istekle ölçüldü. Düz
> `select=curation_tier` ile satır çekip istemcide saymak **yanlış sonuç verir** —
> PostgREST varsayılan `max-rows` sınırı 1000'dir ve sessizce keser. İlk deneme
> bu tuzağa düştü (toplam 3.404 yerine 1.000 gösterdi).

### 6.3 Boru hattı

```
1.866 film
   ↓  [1] SERT FİLTRE      → bağlama göre
   ↓  [2] PUANLAMA
   ↓  [3] ÇEŞİTLİLİK SEÇİMİ → 4 film   ← asıl iş
   ↓  [4] KEŞİF SLOTU
   ↓  [5] SIRA KARIŞTIRMA
```

### 6.4 Sert filtre

```sql
WHERE profile_vector IS NOT NULL
  AND poster_url IS NOT NULL              -- ✅ poster_path DEĞİL
  AND curation_tier IN ('core','extended','trending')
  AND runtime <= :context_max_runtime     -- runtime %100 dolu ✅
  AND id NOT IN (izlenenler)
  AND id NOT IN (son 21 gün gösterilenler)
  AND id NOT IN (son 45 gün reddedilenler)
  AND (film_a, film_b) çifti gösterilmemiş
  AND release_date IS NOT NULL AND release_date <= now()   -- 1A, C.0e
  AND NOT (recognition_missing)                            -- 2A, C.0e
```

> `recognition_missing` = normalizasyon sonrası `imdbVotes === null && voteAverage === null`.
> Sentinel normalizasyonu (`0 → null`, her iki kolonda) `_shared/gauntletCore.ts`
> içinde C.0e'den **önce de mevcuttu**; eksik olan eleme adımıydı. C.0e bu 20
> filmi düello havuzundan çıkarır. Kural veri doğruluğu kuralıdır, `app_config`'e
> bağlı değildir.

Az aday çıkarsa **sırayla gevşet** (cooldown → tier). Asla boş dönme; gevşetildiyse logla.

### 6.5 Tanınırlık — yüzdelik, mutlak eşik değil

> ⚠️ **Bu bölüm spesifikasyondur, implementasyon değildir.**
> 13 Ağustos 2026 doğrulaması: `generate-global-slot` ve
> `generate-gauntlet` içinde `percent_rank`, `imdb_votes` veya
> `recognition_*` okuması YOK. Config anahtarları migration 071 ile
> yazılmış, hesap yazılmamış. Tanınırlık puanlaması **F fazında**
> implemente edilecek. O güne kadar bu bölüm üzerine davranış
> çıkarımı yapılmaz.

⚠️ **Uyarı: `imdb_votes` kolonu kirli.** Kaynak OMDb ✅ (`scripts/lib/omdb-client.ts:101`), ama `sync-trending:214` TMDb `vote_count` yazıyordu ✅. İki farklı metrik aynı kolonda. Trending temizliği yapıldı; kalan kirlilik borç kaydında.

Bu yüzden mutlak eşik kullanılmaz:

```
percent_rank(imdb_votes) havuz içinde
hedef bant: 55-80  (app_config'ten LAZY okunur)
puan = 1 - |percentile - 67.5| / 32.5, min 0
imdb_votes NULL → vote_average fallback
imdb_votes = 0  → NULL sayılır, ASLA gerçek değer kabul edilmez
```

### 6.6 Çeşitlilik

**MMR:** `MMR(f) = 0.6 × skor(f) − 0.4 × max_benzerlik(f, seçilenler)`

**Sert kurallar:**

| Kural | Not |
|---|---|
| Aynı yönetmen ≤1 | `director` havuzda %100 dolu ✅ |
| Aynı on yıl ≤2 | |
| Aynı birincil tür ≤2 | `genres text[]` ✅ |
| Aynı dil ≤3 | `original_language` havuzda %100 dolu ✅ |
| ≥1 film <110dk, ≥1 film >130dk | `runtime` %100 dolu ✅ |

**Eksen zıtlığı:** Her gün DNA'daki en belirsiz ekseni seç, 4 filmi iki uca dağıt (2+2). Sıra: `tempo → yoğunluk → karanlık → gerçekçilik → dönem → dil`. ⚠️ 6 günde temel profil oturur (model tahmini).

### 6.7 Keşif slotu

| Dönem | Oran |
|---|---|
| İlk 14 gün | 2/4 |
| 15-60 gün | 1/4 |
| 60+ gün | 1/4, daha uzak bölgeden |

Keşif filmi kazanırsa yüksek ağırlıklı sinyal.

### 6.8 Sıra karıştırma

Rastgele. Skora göre sıralama **yasak** — maruz kalma bias'ı algoritmanın kendi tahminini kendine kanıtlamasına yol açar.

### 6.9 Global / kişisel hibrit

```
Slot 1  →  GLOBAL (herkese aynı)
Slot 2  →  kişisel
Slot 3  →  kişisel
Slot 4  →  keşif
```

Global slot ortak konuşma zeminini korur — paylaşım kartının dayanağı. Yeni kullanıcıda 4'ü de global.

### 6.10 v0 — ilk sürüm

Kişiselleştirme yok: bağlam filtresi + çeşitlilik kuralları + rastgele 4. Asıl işi çeşitlilik ve bağlam yapıyor; kişiselleştirme veri biriktikçe eklenen **çarpan**.

---

## 7. BONUS OYUN — SPOTLIGHT

### 7.1 Karar

~~7 oyunlu günlük oyun platformu~~ → ~~CineMetrics tek bonus~~ → **Spotlight tek bonus** (05.08.2026, kurucu kararı: eğlence değeri)

Gauntlet çekirdek döngüdür. İki günlük ritüel olamaz. Oyunlar **bilgi eksenini** ölçtüğü için korunuyor — gauntlet bunu ölçemez.

### 7.2 Spotlight V3 — doğrulanmış mekanik ✅

| | |
|---|---|
| Görsel | `backdrop_url` — film karesi, poster değil |
| Blur | `MAX_BLUR = 40` → açılan harf oranıyla lineer 0 |
| Maske | `films.title` (TMDb `language=en-US` zorlanıyor ✅ `tmdb-client.ts:99`) |
| Klavye | QWERTY 3 satır, A-Z |
| Hak | 6 (yanlış harf + yanlış film tahmini ortak havuz) |
| Kazanma | Sadece `FilmSearchInput` ile film tahmini |
| Havuz | **3.081 uygun film** ✅ (~8 yıl) |

**Hard Rule uyumu ✅:** Başlık `puzzle_data`'ya girmez; eşleştirme `solution_ref` üzerinden sunucuda; dönen tek şey oyuncunun kendi açtığı `{pos, ch}` çiftleri.

### 7.3 5 Ağustos'ta düzeltilenler ✅

| Hata | Etki |
|---|---|
| `toLocaleUpperCase('tr-TR')` | `'i'→'İ'` ≠ `'I'` → i içeren her başlıkta yanlış harf cezası |
| Ölü hücre | Rakam/aksan `slot` sayılıyordu, hiçbir tuşla açılamıyordu → blur asla tam açılmıyordu |
| `letter_count` invariantı | 2026-08-07 bulmacası bozuktu, yeniden üretildi |

Yeni kurallar: rakam → `sep` (görünür) · `toUpperCase()` A-Z'ye düşmeyen harf → bulmaca reddedilir · üretimde invariant koruması (`letter_count === slotCount` değilse fatal + null).

### 7.4 Portföy

| Oyun | Durum |
|---|---|
| **Spotlight** | ✅ Aktif bonus |
| CineMetrics, Detective, Fade In, Logline, Quoted, Imposter | 🧊 Feature flag ile dondurulacak |
| Roulette / Slot | ❌ Kaldırılacak (gauntlet'ı kanibalize ediyor) |

Kod silinmez — `app_config` lazy getter ile kapatılır. Gauntlet oturduktan sonra ayda bir oyun açmak bedava retention hamlesidir.

### 7.5 Spotlight'ın iki sonucu

**Telif zemini zayıf.** `backdrop_url` film karesidir, poster değil. Poster dağıtım materyali; still eserin kendisinden kadraj. ⚠️ Uygulama içi kullanım yaygın pratik, düşük olasılıklı risk. Ama: TMDb atıfı zorunlu, **still asla paylaşım görselinde kullanılmaz.**

**Dil bağımlı.** Spotlight bir kelime oyunudur. Maske `films.title` üzerinden çalışıyor ve o alan `en-US` zorlanıyor ✅ — Türkçe başlıklar ayrı `tr_title` kolonunda ✅ (migration 029). Global slot ilkesi korunuyor: aynı `puzzle_id` herkeste aynı maskeyi üretiyor.

---

## 8. ÖLÇÜM

### 8.1 North Star

> **Günlük Gauntlet Tamamlama** — 3 turu bitirip şampiyona ulaşan kullanıcı sayısı

### 8.2 Tek gerçek başarı metriği

> **WATCHED-IT RATE** — önerilen filmi gerçekten izleyenlerin oranı. Hedef ⚠️ **>%35**

### 8.3 ⚠️ Bugün ölçülemiyor

`watchlist.watched_at` = **0/318** ✅. İzleme bilgisi yalnızca cihazda `AsyncStorage: chosy_watched_films` ✅, sunucuya hiç yazılmıyor.

Sonuç: sert filtrede "izlenenleri çıkar" maddesinin verisi yok, ve watched-it rate ölçülemiyor.

**Bu yüzden C.4 ("dün izledin mi?") ertelenemez — kritik yol üzerinde.**

### 8.4 Algoritma sağlık paneli

| Metrik | Sağlıklı ⚠️ | Bozuksa |
|---|---|---|
| `neither_rate` | %15-30 | >%40: aday üretimi kötü |
| "İzledim" oranı | <%20 | >%30: tanınırlık bandı yüksek |
| Karar süresi | 2-5 sn | <1.5sn rastgele · >8sn 4 film çok benzer |
| Final değişim | %40-60 | %0'a yakın: çeşitlilik yok |
| Bağlam düzeltme | <%30 | >%50: tahmin motoru kötü |

### 8.5 Ürün metrikleri ⚠️

Aktivasyon %70+ · D1 %40+ · D7 %25+ · D30 %15+ · haftalık tamamlama ≥4/7 · K-factor 0.3+ · Free→Pro %2,5→%6 · crash-free %99,5+

### 8.6 İstatistiksel gerçeklik

Mevcut veri ✅: `users` ~~135~~ → **139** · `game_scores` **12** · `mood_searches` ~~49~~ → **56** · `swipes` 0

> **13 Ağustos 2026'da yeniden ölçüldü.** `users` +4 (beklenen organik büyüme),
> `mood_searches` +7. `mood_searches` burada **toplam** tanımıyla sayılır —
> 2_BUSINESS_MODEL §2'de 12 Ağustos'ta aynı kalem toplam tanımıyla 49→57
> yapılmıştı, bu satır o tanımla hizalanıyor.
>
> ⚠️ **90 günlük pencere farklı bir sayıdır (13 Ağustos ölçümü: 39)** ve bu
> satırda kullanılmaz. İki tanım karıştırılırsa metrik ters yönde okunur:
> toplam artarken 90-günlük düşüyor.
>
> ⚠️ `game_scores` (12) ve `swipes` (0) bu turda **yeniden ölçülmedi** — 5
> Ağustos değerleri olduğu gibi duruyor. Ölçülmemiş sayı güncellenmez.

> **139 kullanıcıda D7 kohortu gürültüdür.** Retention gate'leri **min 400 aktif kohorta** bağlı. Altında proxy: D1 + 2. oturum dönüşü. A/B testleri 1.000+ kullanıcıdan önce yapılmaz.
>
> ~~135 kullanıcıda~~ → 139 (13 Ağustos 2026). Eşiğe uzaklık anlamlı ölçüde
> değişmedi; sonuç aynı: kohort analizi hâlâ yapılamaz.

---

## 9. YOL HARİTASI

### ✅ Tamamlandı (5 Ağustos 2026)

| İş | Sonuç |
|---|---|
| G1 dalı kapanışı | 11 commit, repo temiz |
| Tip kontrolü altyapısı | 325 → 14 hata; `typecheck` + `typecheck:functions` |
| 4 runtime bug | `useColorScheme` çökme yolu · `winback-sequencer` PromiseLike · Spotlight locale · Spotlight ölü hücre |
| Koruma ağı | `guard.js` PreToolUse hook, 8 kural, canlı doğrulandı |
| Veri hijyeni | Düello havuzu 1.865/1.866 · `profile_vector` NULL 0 |

### ~~Faz A — Elle doğrulama~~ → ATLANDI

> **05.08.2026, kurucu kararı.** Gerekçe: 5 kişilik test grubunu yürütme maliyeti.
>
> **Sonuç:** Mekaniğin doğruluğu inşaattan **önce** öğrenilemeyecek. İlk gerçek watched-it rate ölçümü C.4 canlıya çıktıktan ~2 hafta sonra.
>
> **Telafi:** C.4 kritik yolda. Kill criteria kaydı: 500 kullanıcıda watched-it rate <%20 ise mekanik yeniden değerlendirilir.

### Faz B — Veri temeli

| # | İş | Çıktı |
|---|---|---|
| B.1 | Migration **069** — 6 tablo | Ham olay şeması |
| B.2 | `types/gauntlet.ts` | 🔒 Kilitli sözleşme |
| B.3 | `generate-gauntlet` v0 | Günün 4 filmi |
| B.4 | `submit-choice` | Seçim kaydı |
| B.5 | `recompute-cinema-dna` uyarlaması | Zevk vektörü |

### Faz C — Ürün

| # | İş |
|---|---|
| C.1 | Tasarım token katmanı (`constants/design/`) |
| C.2 | Gauntlet ekranı → **oynanabilir ürün** |
| C.2b/c | Işık sızması (backend + istemci) |
| C.3 | Bağlam satırı |
| C.4 | **"Dün izledin mi?" + izleme sinyali kurtarma** — kritik yol |
| C.5 | Metin paylaşım kartı |
| C.6 | Oyun portföyü budaması (Spotlight aktif, 6 oyun dondurulur) |
| C.7 | Onboarding sıfırlama + anonim oyun |
| C.8 | Cihaz testi + TestFlight |

### Faz D–F

D: Arşiv + paywall · E: Web gauntlet + dağıtım · F: Kişiselleştirme (MMR, eksen zıtlığı)

---

## 10. RİSKLER

| # | Risk | Ciddiyet | Önlem |
|---|---|---|---|
| 1 | **Dağıtım** — 135 kullanıcı ✅ | 🔴 | Web gauntlet + içerik iş kolu. Ürün mükemmelleştikçe çözülmüyor |
| 2 | **Watched-it rate ölçülemiyor** ✅ | 🔴 | C.4 kritik yolda |
| 3 | `imdb_votes` iki metrik karışık ✅ | 🟠 | Yüzdelik + `imdb_votes > 0` filtresi |
| 4 | Sürekli "ikisi de değil" | 🟠 | Kademeli teslim + `neither_rate` ölçümü |
| 5 | Popülarite bias'ı düelloda | 🟠 | Soru "bu akşam hangisini izlerdin", benzer yüzdelik desilinden çift |
| 6 | Spotlight telif (backdrop = still) ✅ | 🟡 | TMDb atıf, still paylaşım görselinde yok |
| 7 | Havuz tükenmesi | 🟡 | Çift bazlı cooldown; 500+ kullanıcıdan sonra gerçek problem |
| 8 | 45 Edge Function tip hatası ✅ | 🟡 | Borç kaydında; yeni fonksiyonlar `ServiceClient` deseniyle |
| 9 | Yeniden yapı değiştirme | 🔴 | Bu belge + katman izolasyonu + ham olay saklama |

---

## 11. KARAR GÜNLÜĞÜ

> **04–05.08.2026 — v4.0**
>
> ~~**v1:** Mood-based AI film öneri uygulaması. Serbest metin → 12-dim vector → pgvector → swipe. Monetizasyon: mood-search kotası.~~
>
> ~~**v2:** 7 oyunlu günlük film oyun platformu. Cinema DNA. Öneri motoru ikincil "Pro mode".~~
>
> **v3/v4 — KİLİTLİ:**
> - Çekirdek: günde 1 gauntlet · 4 film · 3 tur · 1 şampiyon
> - Girdi: serbest metin değil, tahmin edilen + düzeltilebilir bağlam
> - Kimlik: arketip beyan edilmez, davranıştan türetilir (7. gün)
> - Bonus oyun: ~~CineMetrics~~ → **Spotlight** (05.08, kurucu kararı)
> - Onboarding: sıfır, quiz kaldırıldı
> - Veri: ham olay saklanır, profil türetilir; `cinema_dna` cache'tir
> - Faz A atlandı (05.08, kurucu kararı)
> - Işık sızması onaylandı: `films.dominant_color` (04.08)
>
> **Gerekçeler:** v1→v2 frekans yetersizdi. v2→v3 iki günlük ritüel olamaz; gauntlet hem alışkanlığı hem asıl değeri teslim ediyor; serbest metin ChatGPT ile kafa kafaya çarpışıyordu.
>
> **Yeniden değerlendirme:** 1.000 aktif kullanıcı

---

## 12. AÇIK SORULAR

| # | Soru | Ne zaman |
|---|---|---|
| 1 | Gauntlet ana marka rengi | C.1 öncesi |
| 2 | App Store kategori değişimi | Faz E öncesi |
| 3 | Web: ayrı repo mu monorepo mu | Faz E başı |
| 4 | Havuz genişletme: `extended`→`core` terfisi ne zaman | Faz F |
| 5 | OMDb anahtarı alınacak mı (`imdb_votes` için) | Faz F |
| 6 | Grup gauntlet teknik tasarımı | Faz 2 |

---

*5 Ağustos 2026 · Bağlı: 2_BUSINESS_MODEL · 3_DESIGN_OS · 4_CLAUDE_CODE_OS*
