# Oyun İç Dinamikleri — Saniye-Saniye Deneyim Tasarımı

> Tarih: 25 Temmuz 2026
> Amaç: Her oyunun "oynamaya değer mi?" sorusuna cevap vermek
> Yöntem: Gerilim eğrisi, karar anları, feedback kalitesi, tekrar oynama dürtüsü
> Kriter: Oyuncu ilk deneyimde "yarın da oynayacağım" mı diyor, yoksa "bitti mi?" mi?

---

## Değerlendirme Çerçevesi

Her oyun 5 eksende 1-5 arasında puanlanır:

| Eksen | 1 (Kötü) | 3 (Orta) | 5 (Mükemmel) |
|-------|----------|----------|---------------|
| **Gerilim Eğrisi** | Düz — açılıştan sonuca aynı his | Bazı anlar gerilimli | Açılışta merak, ortada gerilim, sonunda patlama |
| **Karar Kalitesi** | Rastgele tıklama | Bilgi var ama stratejik düşünce sığ | Her karar bilgilendirilmiş, risk-ödül dengeli |
| **Feedback Döngüsü** | Sadece "doğru/yanlış" | Kısmi bilgi var ama sonraki hamlemi şekillendirmiyor | Her feedback bir sonraki hamlemin kalitesini artırıyor |
| **Tatmin Anı** | "Bitti" | "İyi" | "EVET!" — vücudumda hissettim |
| **Tekrar Oynama Dürtüsü** | "Bir daha açmam" | "Belki yarın" | "Keşke bir tane daha olsa" |

---

## 1. CineMetrics — ✅ SAĞLAM

### Saniye-Saniye Akış

```
[0s]   Boş 6×6 grid görünür. "Hangi film?" merakı başlar.
[5s]   Film arama — aklına gelen ilk filmi yaz.
[12s]  İlk tahmin gönder.
[13s]  ⚡ KIRILMA ANI: 6 hücre sırayla flip eder (80ms arayla).
       Her hücre kendi rengini açar: yeşil-sarı-gri.
       Son hücre = haptic medium. Gözler grid'i tarıyor.
[15s]  "Yıl yeşil, tür sarı, yönetmen gri, puan ↑, süre ↓, ülke yeşil"
       → Beyin: "2003, Amerikan, puanı bundan yüksek, süresi bundan kısa..."
       → Hipotez oluşuyor. Bu AN oyunun kalbı.
[25s]  2. tahmin — önceki feedback'e dayalı hipotez testi.
[27s]  Yeni grid satırı flip eder. Önceki satırla karşılaştırma başlar.
       Yeşiller artıyorsa: "Yaklaşıyorum!" — gerilim yükseliyor.
       Sarılar dönüyorsa: "Doğru yoldayım ama tam değil" — merak.
[40s-120s] 3-6. tahminler. Her satır bir öncekinden daha bilgilendirilmiş.
       Gerilim doğrusal artıyor — son 2 tahminde "ya bulduysa" heyecanı.
[Son]  Doğru → 6 yeşil hücre flip = dopamin patlaması + haptic heavy.
       Yanlış → 6. satır sonrası cevap açılıyor = "aaa tabii ki!" anı.
```

### Puanlama

| Eksen | Puan | Neden |
|-------|------|-------|
| Gerilim Eğrisi | 4.5 | Her tahmin gerilimi artırıyor. Son 2 tahminde doruk. |
| Karar Kalitesi | 5 | Her tahmin 6 boyutlu bilgiyle şekillendirilmiş. Strateji derin. |
| Feedback Döngüsü | 5 | Renkler + yön okları = bir sonraki tahmini doğrudan bilgilendiriyor. |
| Tatmin Anı | 4.5 | Flip animasyonu + 6 yeşil = fiziksel tatmin. |
| Tekrar Oynama | 4 | "Yarın daha az tahminde çözeceğim" motivasyonu güçlü. |

**Toplam: 23/25 — Oynamaya kesinlikle değer.**

### Ne Eksik (küçük iyileştirmeler)
- 5/6 yeşil ama yanlış olduğunda "near miss" kutlaması yok — bu an harcanıyor
- İlk tahmin tamamen karanlıkta — oyuncuya "nereden başlayacağını" hissettirecek minimal bir ipucu yok (bu tasarım tercihi olabilir)

### Karar: Mekanığa dokunma. Sadece polish ekle.

---

## 2. Logline — ⚠️ İYİ TEMELLİ AMA FEEDBACK EKSİK

### Saniye-Saniye Akış

```
[0s]   Sansürlü metin görünür: "A ████ ████ sets out to find the ████..."
       İlk an güçlü — "bu ne olabilir?" merakı dorukta.
[5s]   Beyin sansürlü kelimelerin etrafındaki bağlamı okuyor.
       "sets out to find" → arayış filmi. "his family" → aile teması.
       Hipotez oluşmaya başlıyor.
[15s]  İlk tahmin gönder.
[16s]  Yanlış → ❌ Sadece "yanlış" + bir kelime açılır.
       ⚠️ SORUN: Açılan kelime bilgi veriyor AMA tahminimin NEDEN
       yanlış olduğu hakkında hiçbir bilgi yok.
       "Finding Nemo" dedim, "Taken" çıktı — bu iki film ne kadar yakın?
       Hiçbir fikrim yok. Bir sonraki tahminim yine karanlıkta.
[25s]  2. tahmin — ama önceki yanlıştan öğrendiğim bir şey yok.
       Sadece yeni açılan kelime var: "████ West ████"
       → "Batı... western mi? Unforgiven?"
[35s]  3. tahmin. Yine yanlış → bir kelime daha açılır.
       Her kelime açılışı mini-dopamin veriyor ama tahmin kalitesi artmıyor.
[45s]  4. tahmin (son hak). "Ya bu sefer bildiysem" gerilimi var.
       Ama bu gerilim ŞANSA dayalı, stratejiye değil.
[Son]  Doğru → tatmin. Yanlış → "nasıl bilebilirdim ki?" frustrasyonu.
```

### Puanlama

| Eksen | Puan | Neden |
|-------|------|-------|
| Gerilim Eğrisi | 3.5 | Açılış güçlü (sansürlü metin merak uyandırıyor). Ama orta kısım düz — her tahmin aynı hissettiriyor. |
| Karar Kalitesi | 2 | Yanlış tahmin bilgi vermiyor. 2. tahmin 1. tahminden daha kaliteli değil. Kelime açılışı yardım ediyor ama yeterli değil. |
| Feedback Döngüsü | 2 | Binary: doğru/yanlış. Yanlış tahminden öğrenme sıfır. CineMetrics'in 6 boyutlu feedback'iyle kıyasla çok sığ. |
| Tatmin Anı | 3.5 | Doğru bilince "evet!" anı var. Ama yanlışta frustrasyon yüksek — "tahmin edemedim" değil "tahmin edemezdim" hissi. |
| Tekrar Oynama | 3 | Merak geri getiriyor ama "stratejik olarak gelişebileceğim" hissi yok. |

**Toplam: 14/25 — Potansiyeli var ama feedback döngüsü kırık.**

### Sorunun Kökü
CineMetrics'te her yanlış tahmin SENİ DAHA İYİ YAPIYOR (6 sütun bilgi). Logline'da her yanlış tahmin sadece OYUNU DAHA KOLAY YAPIYOR (kelime açılıyor). Fark büyük:
- CineMetrics: "Yanlış tahmin ettim AMA şimdi yılı, türü, ülkeyi biliyorum → daha iyi tahmin edebilirim"
- Logline: "Yanlış tahmin ettim. Bir kelime açıldı. Ama tahminimin nesi yanlıştı bilmiyorum"

### Çözüm: Per-Guess Semantic Feedback (V2 dokümanından)

```
[Yanlış tahmin sonrası]
"Finding Nemo" ❌
  → "Farklı tür — Cevap dram değil animasyon"     ← tür bilgisi
  → "Benzer dönem — 2000'ler"                      ← zaman bilgisi
  + Bir sansürlü kelime açılır

Şimdi oyuncu: "2000'lerin animasyon olmayan bir filmi, batıda geçiyor..."
→ Sonraki tahmin BİLGİLENDİRİLMİŞ.
```

Bu tek değişiklik karar kalitesini 2→4'e, feedback döngüsünü 2→4'e çıkarır.

### Karar: Semantic feedback ŞART. Bu oyunu "iyi"den "çok iyi"ye taşıyan tek değişiklik.

---

## 3. Spotlight — ❌ MEKANİK OLARAK KIRIK

### Saniye-Saniye Akış

```
[0s]   İpucu: "1990-2000 arası" + 4 film posteri (The Matrix, Fight Club, Titanic, Forrest Gump)
       "Bu ipucu hiçbir şeyi elemiyor — hepsi 90'lardan."
[3s]   Poster kartlarını inceliyor. Hepsi tanıdık.
       "Hangisi? Hiçbir fikrim yok. 4'te 1 şans."
[5s]   Birini tıkla → Yanlış → kırmızı shake.
       ⚠️ SORUN: Öğrendiğim bir şey yok. Sadece bir seçenek elendi.
[7s]   Tur 2: Yeni ipucu: "Drama" → hepsi drama zaten.
       Kalan 3 posterden birini tıkla.
[9s]   Yanlış → 2 kaldı.
[11s]  Tur 3: "2h 15m" → "Titanic uzun, Matrix da 2 saat civarı..."
       Şimdi BİLGİ var ama zaten 2 seçenek kaldı, %50 şans.
[13s]  Tıkla → Doğru veya Yanlış.
[Son]  Toplam süre: 15-30 saniye. Hissedilen: "Bu oyun muydu?"
```

### Puanlama

| Eksen | Puan | Neden |
|-------|------|-------|
| Gerilim Eğrisi | 1.5 | Düz. İlk turda şans, son turda elimination. Gerilim yok, sadece tıklama. |
| Karar Kalitesi | 1.5 | İlk 2 turda karar rastgele — ipuçları ayırt edici değil. Bilgi ancak çok geç geliyor. |
| Feedback Döngüsü | 1 | Yanlış = sadece elimination. Bilgi yok, strateji yok. CineMetrics'in tam tersi. |
| Tatmin Anı | 2 | Doğru bilince "oh güzel" ama "hak ettim" hissi yok — şans etkisi çok yüksek. |
| Tekrar Oynama | 1.5 | "Yarın da aynı şans oyununu oynamak istiyorum" motivasyonu sıfır. |

**Toplam: 7.5/25 — Oynamaya değmez. Mevcut haliyle bir oyun değil, şans testi.**

### Sorunun Kökü

İki temel tasarım hatası:

**1. İpuçları elimine edici değil.** "1990-2000" ipucu 4 filmden hiçbirini elemiyorsa, o ipucu YOKMUŞ gibi. İpucunun değeri = kaç seçeneği eleyebildiği. Eğer ipucu 4'ten 2'yi eliyorsa, oyuncu düşünür. Eğer 4'ten 0'ı eliyorsa, oyuncu tıklar.

**2. Tur başına 1 tahmin hakkı = brute force.** 4 seçenek, 6 tur. Hiç düşünmeden sırayla tıklasan bile 4. turda kesin bilirsin. Oyunun "kaybetme" olasılığı mekanik olarak çok düşük.

### Spotlight Ne Olmalı? İki Seçenek:

**Seçenek A: Elimine Edici İpucu Tasarımı (Mevcut çerçeveyi koru)**
- Her turda ipucu 4 filmden EN AZ 1'ini kesin elesin
- İpucu sırası: Belirsiz → Spesifik (decade → genre → runtime → director)
- Poster kartlarında yıl/tür bilgisi gösterilmesin (şu an gösteriliyor!) — oyuncu ipucundan çıkarım yapsın
- 1 tahmin/tur kalsın AMA yanlış tahminde o film elenmezse sonraki turda tekrar seçilebilir

**Seçenek B: Tamamen Yeniden Tasarla — "Film Profiling"**
- 6 ipucu sırayla gösterilir (CineMetrics gibi birikimli)
- Oyuncu istediği zaman tahmin edebilir (Logline gibi)
- Erken tahmin = yüksek XP. Geç tahmin = düşük XP
- İpuçları poster kartı DEĞİL, metin bazlı: "The director is known for crime films"
- Bu yapı Spotlight'ı CineMetrics-Logline arası bir yere konumlandırır

### Karar: Seçenek A daha az riskli — mevcut altyapıyı kullanır. AMA ipucu kalitesi generate-puzzles seviyesinde çözülmeli. UI değişikliği tek başına yetmez.

---

## 4. FadeIn — ⚠️ TEK BOYUTLU AMA VİZÜEL OLARAK TATMİN EDİCİ

### Saniye-Saniye Akış

```
[0s]   Aşırı blur'lu poster (50px). Renk paletini görüyorsun, şekilleri değil.
       "Kırmızı ve mavi... bir süper kahraman filmi mi?"
       Merak başlıyor ama bilgi çok az.
[5s]   İlk tahmin — neredeyse tamamen şansa dayalı.
       Bu "karanlıkta ateş etme" hissi.
[7s]   Yanlış → Blur bir kademe azalır (50→40). Fark minimal.
       ⚠️ SORUN: 50px ile 40px arasında görsel fark neredeyse yok.
       Oyuncu: "Değişti mi? Aynı gibi duruyor."
[15s]  2-3. tahmin → Blur 40→28. Artık şekiller belirginleşiyor.
       "Bir yüz var... kadın... saçları uzun..."
       BURADA oyun gerçekten başlıyor — ilk 2 tahmin boşa gitti.
[25s]  4-5. tahmin → Blur 18→10. Poster neredeyse net.
       "Bu kesinlikle American Beauty!" — tanıma anı.
[Son]  Doğru → Poster tamamen açılır. Bu görsel reveal tatmin edici.
       Yanlış → 6. tahminde poster açılıyor — "aaa, bunu bilmem lazımdı" pişmanlığı.
```

### Puanlama

| Eksen | Puan | Neden |
|-------|------|-------|
| Gerilim Eğrisi | 3 | İlk 2 adım düz (fark görülmüyor), son 3 adımda yükseliyor. Eğri dengesiz. |
| Karar Kalitesi | 2 | Her tahmin tek boyutlu: "Bu posteri tanıyor musun?" Strateji yok. |
| Feedback Döngüsü | 2.5 | Blur azalması bilgi veriyor ama bu pasif — oyuncunun stratejisi değişmiyor, sadece daha net görüyor. |
| Tatmin Anı | 4 | Görsel reveal doğası gereği tatmin edici. Posteri tanıma anı güçlü. |
| Tekrar Oynama | 3 | Görsel merak geri getiriyor. Ama "gelişebileceğim" hissi yok. |

**Toplam: 14.5/25 — Oynama deneyimi "iyi" ama sığ. Tek boyutlu.**

### Sorunun Kökü

FadeIn'in mekanik derinliği sıfır. Oyuncu her turda aynı soruyu soruyor: "Bu posteri tanıyor muyum?" Cevap ya evet ya hayır. Hipotez test etme, bilgi biriktirme, strateji geliştirme yok.

### Çözüm: İpucu Katmanı Ekle (Derinlik Kur)

```
Mevcut:
  [50px blur] → Tahmin → [40px blur] → Tahmin → ... → Poster

Önerilen:
  [50px blur] → Tahmin et veya PAS geç
  Yanlış/Pas → [40px blur] + "Bu film 2000'lerde çıktı" (tür/dönem ipucu)
  Yanlış/Pas → [28px blur] + "Yönetmeni bir suç filmiyle tanınır"
  Yanlış/Pas → [18px blur] + "Başrolde Oscar ödüllü bir aktör var"

  Şimdi oyuncu her turda 2 bilgi kaynağı kombine ediyor:
  görsel (poster) + metin (ipucu). Bu karar kalitesini artırıyor.
```

Blur eğrisini de düzelt: [50, 40, 28, 18, 10, 4] → [45, 30, 20, 12, 6, 2]
İlk 2 adımdaki "fark yok" sorununu çözer.

### Karar: Blur eğrisi düzeltmesi + metin ipucu katmanı ekle. Generate-puzzles zaten `hints` üretiyor — sadece UI'da göstermek lazım. Küçük değişiklik, büyük etki.

---

## 5. Quoted — ❌ YAPISAL SORUN (HAVUZ + MEKANİK)

### Saniye-Saniye Akış

```
[0s]   "You can't handle the truth!" — replik görünür.
       İlk tepki 2 durumdan biri:
       A) "Bunu biliyorum!" → Anında tahmin → 3 saniyede oyun biter.
       B) "Hiç bilmiyorum" → Rastgele tahmin, 4 deneme boyunca şans.
       ⚠️ SORUN: Arada YOK. "Hmm, bu tanıdık, düşüneyim" durumu nadir.
[3s]   (Eğer bilmiyorsa) İlk tahmin → Yanlış → Hint: "Karakter: Col. Jessup"
       "Col. Jessup? Askeri film... A Few Good Men?"
       Hint güçlü — karakter ismi bilgiyi daraltıyor.
[10s]  2. tahmin → Doğru. Oyun bitti.
       VEYA
       2. tahmin → Yanlış → Hint: "Oyuncu: Jack Nicholson"
       "Nicholson'lı askeri film? A Few Good Men kesin."
[15s]  3. tahmin → Doğru.
[Son]  Toplam süre: 10-30 saniye. Hissedilen: Anında bilindiyse meh,
       hint'lerle bulunduysa tatmin edici.
```

### Puanlama

| Eksen | Puan | Neden |
|-------|------|-------|
| Gerilim Eğrisi | 2 | Binary: ya hemen biliyorsun ya bilmiyorsun. "Gittikçe yaklaşıyorum" hissi yok. |
| Karar Kalitesi | 1.5 | Sıfır strateji. "Bu repliği hangi filmden hatırlıyorsun?" — ya hatırlarsın ya hatırlamazsın. |
| Feedback Döngüsü | 2.5 | Hint'ler (karakter→oyuncu→yönetmen) bilgi veriyor. Ama yanlış tahminden bilgi yok. |
| Tatmin Anı | 3 | "Bunu biliyorum!" anı güçlü. Ama çok kısa sürüyor. |
| Tekrar Oynama | 2 | Havuz donmuş = aynı replikler dönecek. Bilince oynamanın anlamı kalmıyor. |

**Toplam: 11/25 — Oynamaya değmez. İki yapısal sorun birbirini besliyor.**

### Sorunların Kökü

**1. Bilgi/Hatırlama oyunu, Dedüksiyon değil.**
CineMetrics'te "bilmiyorum ama ÇIKARABİLİRİM." Quoted'da "ya biliyorum ya bilmiyorum." Bu fark engagement'ı öldürüyor.

**2. Havuz donmuş (Hard Rule: movieQuotes.ts'e ekleme YASAK).**
~100 replik × 1/gün = 3.3 ayda biter. Tekrarlayan replikler tanınır, oyun ölür.

### Quoted Ne Olmalı? 3 Katmanlı Karar:

**Katman 1 (Acil): Havuz sorunu — AI Paraphrase**
V2 dokümanındaki Option A: Claude orijinal repliği paraphrase eder. "You can't handle the truth!" → "The reality is something you're incapable of accepting!" Havuz sonsuz, telif temiz.

**Katman 2 (Mekanik): Dedüksiyon katmanı ekle**
Repliği göstermeden ÖNCE bağlam ver:
```
[Tur 0] "Bu replik bir dram filminden, 1990'lardan."
[Tur 1] Replik göster: "The reality is something you're incapable of accepting!"
[Tur 2] Yanlış → "Karakter askeri bir figür"
[Tur 3] Yanlış → "Başrolde Jack Nicholson"
```
Şimdi oyuncu tur 0'daki bağlamı replikle kombine ediyor — "90'lar draması + bu üslup = mahkeme sahnesi?" Dedüksiyon var.

**Katman 3 (Opsiyonel): "Replik mi Scene mi?" pivot**
Eğer paraphrase kalitesi düşükse, replik yerine "sahne tasviri" kullan. AI scene description üretir. Bu daha fazla dedüksiyon alanı açar.

### Karar: Katman 1 (paraphrase) + Katman 2 (bağlam-önce) birlikte yapılmalı. Biri olmadan diğeri yetmez.

---

## 6. Imposter — ❌ OYUN DEĞİL, COİN FLİP

### Saniye-Saniye Akış

```
[0s]   Film posteri + 4 isim: "Christian Bale, Heath Ledger, Gary Oldman, Mark Ruffalo"
       "The Dark Knight kadrosu... Ruffalo? O MCU değil mi?"
[3s]   Tıkla: Mark Ruffalo.
[4s]   ✅ Doğru → Oyun bitti. Toplam süre: 4 saniye.
       VEYA
       ❌ Yanlış → Oyun bitti. Toplam süre: 4 saniye. Frustrasyon.

Alternatif senaryo (tanımadığın film):
[0s]   "Amores Perros" posteri + 4 isim hiçbirini tanımıyorsun.
[3s]   Rastgele tıkla. %25 şans.
[4s]   Oyun bitti. Ne olduğunu anlamadan.
```

### Puanlama

| Eksen | Puan | Neden |
|-------|------|-------|
| Gerilim Eğrisi | 1 | Eğri YOK. 0'dan sonuca 4 saniye. Gerilim inşa edilemiyor. |
| Karar Kalitesi | 1.5 | Tek karar: "Bu ismi tanıyor musun?" Strateji sıfır. |
| Feedback Döngüsü | 0.5 | Feedback yok — sonuç gösteriliyor, bir sonraki hamle yok. |
| Tatmin Anı | 2 | Doğru bilince "güzel" ama 4 saniyede gelen tatmin sığ. Yanlışta ise frustrasyon şiddetli — tek hak. |
| Tekrar Oynama | 1 | "Yarın da 4 saniyede coin flip oynayayım" motivasyonu sıfır. |

**Toplam: 6/25 — Bu bir oyun değil. Tek soruluk bir trivia quiz'i.**

### Sorunun Kökü

**Oyun süresi çok kısa.** 4-10 saniye. Gerilim eğrisi inşa etmek için minimum 30-60 saniye lazım. Wordle 3-5 dakika. Imposter 4 saniye. Bu fark her şeyi açıklıyor.

**Tek hak = sıfır öğrenme.** İlk ve son kararın aynı olması, oyuncunun oyun içinde gelişmesini engelliyor.

### Imposter Ne Olmalı? V2 Tasarımı Doğru Ama Eksik

V2 dokümanı 3 turlu format önermiş. Bu iyi bir başlangıç ama **gerilim eğrisini saniye-saniye tasarlamamış:**

```
Önerilen Imposter V2 — Detaylı Akış:

[ROUND 1 — Isınma] 🟢 Güven evresi
[0s]   Film posteri + 4 isim (3 gerçek, 1 sahte).
       Sahte aktör AÇIKÇA farklı (farklı cinsiyet, farklı dönem).
       "Ah, Jennifer Lawrence The Godfather'da mı? Tabii ki hayır."
[5s]   Tıkla → Doğru → "Round 1 ✓" + küçük kutlama.
       Oyuncu: "Kolaydı, devam." GÜVEN inşa edildi.

[ROUND 2 — Gerilim] 🟡 Düşünme evresi
[8s]   YENİ film posteri + 5 isim (3 gerçek, 2 sahte). İKİSİNİ bul.
       Sahteler daha inandırıcı — aynı dönem, benzer roller.
       "Tom Hanks, Meg Ryan, Billy Crystal, Greg Kinnear, Steve Martin"
       "Sleepless in Seattle... Crystal? Martin? İkisi de 90'lar komedisi..."
[15s]  İlk seçim: Steve Martin → ✅ "1/2 buldum."
       İkinci seçim: Billy Crystal → ❌ "Aslında Crystal'ı karıştırdım..."
       → ROUND 2 başarısız. Ama oyun bitmedi — sonuç "2/3 round."

       ⚠️ ÖNEMLİ TASARIM KARARI: Round 2'de yanlış = oyun BİTMESİN.
       Bunun yerine Round 3'e geçilsin ama Round 2 puanı 0 olsun.
       Bu sayede oyuncu HER ZAMAN 3 round oynuyor — süre 60-90 sn'ye çıkıyor.

[ROUND 3 — Doruk] 🔴 Panik evresi
[25s]  YENİ film posteri + 6 isim (4 gerçek, 2 sahte).
       Sahteler SON DERECE inandırıcı. Aynı türde, aynı dönemde, benzer rollerde.
       "Bu sefer gerçekten bilmem lazım."
[30s]  İlk seçim düşünerek → ✅ veya ❌
[35s]  İkinci seçim → final kararı.
[40s]  SONUÇ: "3/3 Perfect" veya "2/3 Great" veya "1/3" veya "0/3"

Toplam süre: 40-90 saniye. Gerilim eğrisi: Güven → Gerilim → Doruk.
```

### V2'ye Ek — Önemli Tasarım Kararları:

**1. Yanlış round'da oyun BİTMEMELİ.**
Mevcut V2 dokümanı: "Any wrong selection → Game over at that round." Bu YANLIŞ.
Eğer Round 1'de yanılırsan oyun 5 saniyede biter — V1'le aynı sorun.
Bunun yerine: 3 round DAIMA oynanır. Her round bağımsız puanlanır. Toplam: 0-3.

**2. Her round sonrası doğru cevap GÖSTERİLMELİ.**
"Mark Ruffalo The Dark Knight'ta değildi — onu The Avengers'tan tanıyorsunuz."
Bu ÖĞRENME anı. Oyuncu bir şey öğrenince "yarın daha iyi olacağım" hissediyor.

**3. Confidence wager EKLEME.**
V2 dokümanı "Confident toggle" öneriyor. Bu oyunun akışını kesiyor.
3 round zaten yeterli karar noktası. Wager over-engineering.

### Karar: V2 3 turlu format ama "game over" yerine "her zaman 3 round" + round sonrası öğrenme anı.

---

## GENEL SONUÇ VE ÖNCELİK SIRASI

### Oyun Sıralaması (oynamaya değerlik)

| Sıra | Oyun | Puan | Durum | Aksiyon |
|------|------|------|-------|---------|
| 1 | CineMetrics | 23/25 | ✅ Sağlam | Dokunma, polish ekle |
| 2 | Logline | 14/25 | ⚠️ İyi temel | Semantic feedback ekle (Sprint 1) |
| 3 | FadeIn | 14.5/25 | ⚠️ Sığ ama görsel | Hint katmanı + blur eğrisi (Sprint 2) |
| 4 | Quoted | 11/25 | ❌ Yapısal sorun | Paraphrase + bağlam katmanı (Sprint 3) |
| 5 | Spotlight | 7.5/25 | ❌ Kırık mekanik | İpucu kalitesi + eleme mantığı (Sprint 3) |
| 6 | Imposter | 6/25 | ❌ Oyun değil | 3 turlu yeniden yazım (Sprint 2) |

### Önerilen Yeni Sprint Sırası

**Sprint 2: Hızlı Kazanımlar (en az eforla en çok etki)**
1. Logline semantic feedback — Backend'de zaten film metadata var, karşılaştırma kolay
2. FadeIn blur eğrisi düzeltmesi + hint gösterimi — Generate-puzzles zaten hint üretiyor, sadece UI

**Sprint 3: Büyük Yeniden Yazımlar**
3. Imposter V2 — 3 turlu format (backend + client tam yeniden yazım)
4. Quoted paraphrase — generate-puzzles'a Claude API entegrasyonu

**Sprint 4: İkincil İyileştirmeler**
5. Spotlight ipucu kalitesi — generate-puzzles seviyesinde, UI küçük değişiklik
6. Meta-progression (streak freeze, quest, bridge) — ARTIK oyunlar "oynamaya değer" olduğu için kanca mantıklı

### Neden Bu Sıra?

**Önce oyun deneyimini düzelt, sonra tutma mekanizmasını kur.**

Streak freeze, daily quest, cross-game bridge gibi sistemler ancak oyunlar tek başına tatmin edici olduğunda işe yarar. "Sıkıcı bir oyunu streak ile oynatma" çalışmaz — kullanıcı streak'i kırmayı bile umursamaz.

Ama CineMetrics kalitesinde 3-4 oyun olursa, streak/quest/bridge zaten var olan motivasyonu katlıyor.

---

## HARD RULE UYUMLULUK KONTROLÜ

| Değişiklik | Hard Rule İhlali? |
|-----------|-------------------|
| Logline semantic feedback | ❌ Hayır — server-side metadata karşılaştırma, çözüm sızmaz |
| FadeIn blur eğrisi | ❌ Hayır — client-side görsel parametre |
| FadeIn hint gösterimi | ❌ Hayır — generate-puzzles hint üretiyor, view zaten strip ediyor |
| Imposter 3 tur | ❌ Hayır — her tur ayrı film, çözüm sunucuda |
| Quoted paraphrase | ❌ Hayır — generate-puzzles batch üretim, telif temiz (A7 uyumlu) |
| Spotlight ipucu | ❌ Hayır — generate-puzzles kalite iyileştirmesi |
