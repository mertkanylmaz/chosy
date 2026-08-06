# 💰 CHOSY BUSINESS MODEL OS

**Versiyon:** v2.0 · 5 Ağustos 2026
**Bağlı:** `1_CHOSY_PRODUCT_OS.md`

> ✅ doğrulandı (envanter/kod, 5 Ağu 2026) · ⚠️ varsayım veya finansal model

---

## 1. TEMEL İLKE

> **Günlük gauntlet sonsuza kadar ücretsizdir. Para ritüelin *etrafından* gelir, *içinden* değil.**

**Satılmayacaklar** — hepsi cazip, hepsi tuzak:

| Fikir | Neden yapılmaz |
|---|---|
| "Free 1 gauntlet, Pro 3 gauntlet" | Kıtlık ürünün kendisi; kaldırırsan alışkanlık çöker |
| Gauntlet'ta sponsorlu film | Kullanıcı "öneri mi reklam mı" diye düşündüğü an ürün ölür |
| Reklam arası | 40 saniyelik ritüele reklam sığmaz |
| Şampiyonu görmek için ödeme | Değeri rehin almak; en hızlı churn yolu |

---

## 2. MEVCUT DURUM ✅

| | |
|---|---|
| Kullanıcı | **135** (`users` tablosu) |
| Watchlist | 318 satır |
| Mood arama (toplam) | 49 |
| Oyun skoru (toplam) | **12** |
| Swipe | 0 |
| Mevcut model | Mood-search kotası (Free 3/gün, Monthly 15, Annual 25, Lifetime 50) ⚠️ |
| Mevcut fiyat | $6.99/ay · $39.99/yıl · $89.99 lifetime ⚠️ |
| Ödeme altyapısı | RevenueCat `react-native-purchases ^10.0.1` ✅ |
| Paywall varyantı | 7 ⚠️ (`app_config`'te `paywall_*` anahtarları ✅) |
| Kota motoru | `services/quotaEngine.ts`, 5 dosyada 8 çağrı ✅ |

> ⚠️ **Gelir rakamları ve abone sayıları doğrulanmadı.** RevenueCat panelinden okunmalı.

---

## 3. MODEL KIRIK — VE NEDEN

Mevcut monetizasyon **mood-search kotası** üzerine kurulu. Yeni çekirdek döngü günlük gauntlet.

Sonuç:
- Ücretsiz kullanıcı artık kotaya çarpmıyor → paywall hiç tetiklenmiyor
- 7 paywall varyantının tetikleyicileri ölü kod
- `quotaEngine` yanlış şeyi sayıyor

**NYT Games ne satar:** Günlük bulmaca bedava ve sonsuza kadar bedava. Para arşivden, istatistik derinliğinden, ek oyunlardan gelir.

---

## 4. DÖRT GELİR KATMANI

### Katman 1 — Abonelik (ana motor)

| | **Free** | **Chosy Pro** |
|---|---|---|
| Günlük gauntlet | ✅ Tam | ✅ Tam *(aynı)* |
| Şampiyon + nerede izlenir | ✅ | ✅ |
| Streak + paylaşım | ✅ | ✅ |
| Yenileme hakkı | 2/gün | Sınırsız |
| **Arşiv** — kaçırılan günler | ❌ | ✅ |
| **Cinema DNA** | Rank + tek satır | Tam profil, eksen grafikleri, haftalık rapor |
| **Grup gauntlet** | ❌ | ✅ |
| **Servis filtresi** | ❌ | ✅ |
| **Watchlist çözücü** | ❌ | ✅ |
| Pro mode (metin araması) | ❌ | ✅ |
| Gelişmiş filtreler | ❌ | ✅ |

**En güçlü iki kalem:**

**Arşiv** — duygusal borç. 12 günlük streak'i olan biri gün kaçırdığında hissettiği şey rasyonel değil. İnşası bedava; veri `daily_gauntlets`'te zaten duracak.

**Grup gauntlet** — "ne izleyeceğiz" kavgası iki kişilik problem, tek kişilikten pahalı. Rekabette kimse yapmıyor. ⚠️ Teknik olarak zor (eşzamanlı iki kullanıcı, çakışan tercih, davet akışı) — Faz 2'den önce başlanmaz.

### Katman 2 — Affiliate

Gauntlet bir **satın alma niyetiyle** biter. Bu ticari bir andır ve Wordle'da yoktur.

- "Nerede izlenir" ekranındaki kiralama/satın alma linkleri affiliate olur
- ⚠️ Beklenti: MAU başına aylık $0.01–0.03
- Maliyeti sıfır, UX'i bozmaz, kurulumu ~1 gün

⚠️ Apple'ın film/TV affiliate programı büyük ölçüde kapandı. Amazon, JustWatch, bölgesel sağlayıcılar. **Şartlar doğrulanmalı — bu geliri modelin temeline değil üstüne koy.**

`app_config`'te `paywall_streaming_link` anahtarı zaten var ✅ — altyapı kısmen hazır.

### Katman 3 — Tek seferlik

- **Cinema DNA Yıllık Raporu** ⚠️ $4.99/yıl. Spotify Wrapped mantığı: kimlik + paylaşım + FOMO. Otomatik üretim, %100 marj.
- Braket temaları / poster kartları — kozmetik, düşük öncelik.

### Katman 4 — Veri ve marka (36+ ay)

*"Chosy kullanıcılarının %73'ü Heat'i tercih etti."* Hiçbir yerde bulunmayan tercih verisi.

⚠️ İtibar riski yüksek, hukuki hazırlık gerektiriyor, **10K+ DAU olmadan anlamsız.** Şimdi düşünme; sadece mimariyi buna kapatma — `choice_events` anonim toplu analize açık kalsın.

---

## 5. FİYATLANDIRMA

~~$6.99/ay · $39.99/yıl · $89.99 lifetime~~ ⚠️ *AI aracı fiyatlaması — yanlış referans sınıfı*

| Plan | Fiyat ⚠️ | Not |
|---|---|---|
| Aylık | **$4.99** | Giriş, öne çıkarılmaz |
| **Yıllık** | **$29.99** | ⭐ Varsayılan. Aylık $2.50 — %50 ankraj |
| 7 gün deneme | Yıllık planda | Dönüşüm aylıktan yüksek |
| Lifetime | **$79.99 · ilk 1.000 üye** | Sonra emekliye ayrılır |

**Neden yıllık varsayılan:** Günlük ritüelde aylık plan yanlış eşleşme — kullanıcı her ay "hâlâ değer mi" diye sorguluyor ama alışkanlığın olgunlaşması ⚠️ 60-90 gün alıyor. Yıllık plan bu süreyi satın alır.

**Lifetime hakkında dürüstlük:** En bağlı kullanıcının gelecekteki tüm gelirini tek seferde satmaktır; LTV modelini ve MRR anlatısını bozar. Ama pre-PMF'te **nakit** ve **kurucu sadakati** verir. 1.000 ile sınırla; sınır `app_config`'ten **lazy** okunsun ki kod değişmeden kapatılabilsin.

`app_config`'te `paywall_lifetime_soldout` anahtarı zaten var ✅.

---

## 6. PAYWALL TETİKLEYİCİLERİ

| # | Tetikleyici | Mesaj | Neden güçlü |
|---|---|---|---|
| 1 | **İlk kaçırılan gün** | *"Dünü kaçırdın. Arşivden oynayıp streak'ini koru."* | Kayıptan kaçınma — en yüksek dönüşüm ⚠️ |
| 2 | 7. gün, DNA reveal | *"7 günde profilin oluştu. Tamamını gör."* | Merak + kimlik |
| 3 | 3. "izledim" onayı | *"3 filmi bizden buldun."* | Kanıtlanmış değer |
| 4 | Grup moduna tıklama | *"Partnerinle ortak gauntlet"* | Niyet belli |
| 5 | 3. yenileme denemesi | *"Bugünlük hakkın bitti."* | Doğal sınır |

**Kurallar:**
- 14 günden önce paywall yok (arşiv hariç — o kullanıcının kendi talebiyle geliyor)
- **İlk kaçırılan gün ücretsiz telafi**, ikinciden itibaren Pro. Güveni artırdığı için dönüşümü yükseltir.
- 7 varyant → **2 varyant.** 135 kullanıcıda 7 varyant istatistik değil gürültüdür.

---

## 7. BİRİM EKONOMİ

### 7.1 Marjinal maliyet ≈ 0

Gauntlet'ta serbest metin yok → `parse-mood` çağrısı yok → LLM çağrısı yok.

| | Eski (mood search) | Yeni (gauntlet) |
|---|---|---|
| Kullanıcı başına LLM çağrısı | Her aramada | **Sıfır** |
| Günlük maliyet/DAU ⚠️ | ~$0.006 | ~$0.0001 |
| 100K DAU aylık AI maliyeti ⚠️ | ~$19.000 | ~$60 *(sadece Pro mode)* |

> **Maliyet artık kullanıcı sayısına değil gelire bağlı.** Yatırımcı anlatısında kritik cümle.

**Doğrulanmış maliyet noktası:** 84 filmin AI profillemesi Haiku 4.5 ile **$0,163** ✅ (66K girdi + 27K çıktı token, 1dk 21sn). Yani katalog işlemleri de pratikte bedava.

### 7.2 Senaryolar ⚠️

*Varsayımlar: MAU→ödeyen %2,5 · aylık/yıllık 40/60 · Apple %15 (Small Business) · affiliate $0.02/MAU*

| MAU | Ödeyen | Abonelik (net) | Affiliate | **Aylık** | Brüt marj |
|---|---|---|---|---|---|
| 1.000 | 25 | $74 | $20 | **$94** | %47 |
| 10.000 | 250 | $743 | $200 | **$943** | %84 |
| 50.000 | 1.250 | $3.712 | $1.000 | **$4.712** | %89 |
| 100.000 | 2.500 | $7.425 | $2.000 | **$9.425** | %90 |
| 500.000 | 12.500 | $37.125 | $10.000 | **$47.125** | %93 |

### 7.3 Acı gerçek

⚠️ 100K MAU → ~$113K/yıl. İyi bir yan gelir, milyar dolarlık şirket değil.

Üç kaldıraç:

| Kaldıraç | Etki ⚠️ |
|---|---|
| **Dönüşüm %2,5 → %6** | Geliri **2,4x** yapar — en yüksek etkili değişken |
| **Hane/grup planı ($7.99)** | ARPPU $3.50 → $5+ |
| **Yayın servisi filtresi** | Ödeme isteğini yükselten tek somut özellik — kullanıcı önerileni *gerçekten* izleyebiliyor |

Üçü birden → 100K MAU'da ⚠️ ~$25-30K/ay.

**Ama hepsi dağıtım çözüldükten sonra anlamlı.** Bugün 135 kullanıcı var ✅. Gelir modeli tasarlamak, kullanıcı bulmaktan psikolojik olarak çok daha konforlu bir iştir.

---

## 8. FAZ PLANI

| Faz | Kullanıcı | Ne var | Ne yok |
|---|---|---|---|
| **0** *(şimdi)* | 0–1K | Her şey ücretsiz. **Tek istisna: arşiv paywall'ı** | Deneme, A/B, varyant, grup |
| **1** | 1K–10K | Free/Pro ayrımı, 7 gün deneme, 2 varyant, affiliate | Grup planı, yıllık rapor |
| **2** | 10K–50K | Grup gauntlet, servis filtresi, DNA raporu | Veri lisanslama |
| **3** | 50K+ | Hane planı, fiyat testleri, marka işbirlikleri | — |

**Faz 0'da neden yalnızca arşiv:** Ödeme isteğine dair sinyale ihtiyaç var, optimizasyona yok. İnşası ~1 gün ve tek bir gerçek sayı veriyor: *"streak'i olan insanlar bunun için para verir mi?"* Bu sayı tüm gelir modelinin geçerliliğini test ediyor.

---

## 9. MEVCUT KULLANICI GÖÇÜ

**Kural: hiç kimse hiçbir şey kaybetmeyecek.**

| Mevcut | Yeni |
|---|---|
| Lifetime | `legacy_lifetime` → Pro'nun tamamı, kalıcı, gelecek özellikler dahil |
| Aylık/Yıllık aktif | Dönem sonuna kadar Pro. Yenilemede **eski fiyat garantili** |
| Ücretsiz | Yeni Free katmanı |

**Jest:** Mevcut 135 kullanıcıya ✅ **"Kurucu Üye" rozeti** — paylaşım kartında görünür, kalıcı. Maliyeti sıfır, değeri yüksek.

⚠️ Kaç kullanıcının Lifetime aldığı doğrulanmadı. Göç öncesi RevenueCat'ten ve `app_config.paywall_lifetime_soldout` durumundan okunmalı.

---

## 10. TEKNİK MİMARİ (GELİR TARAFI)

```
TEK entitlement: 'chosy_pro'
  ├── legacy_lifetime  → chosy_pro + kalıcı
  ├── legacy_quota     → chosy_pro (dönem sonuna kadar)
  └── chosy_pro        → aktif abonelik
```

**Kurallar:**

| # | Kural | Gerekçe |
|---|---|---|
| 1 | `quotaEngine` emekli — kota → entitlement kontrolü | Mood-search kotası sadece Pro mode içinde kötüye kullanım koruması olarak kalır |
| 2 | Feature gate'ler `app_config`'ten **lazy getter** ile | Modül seviyesi sabit async hydration ile race condition yaratır |
| 3 | RevenueCat webhook **idempotent** | `webhook_events` tablosu + retry kuyruğu + mutabakat scripti |
| 4 | Entitlement kontrolü **sunucu tarafında** | Client'tan gelen tier bilgisine güvenilmez |
| 5 | **Sessiz fallback yasak** | Entitlement kontrolü hata verirse kullanıcıyı Free'ye düşürme — Sentry'ye at, mevcut durumu koru |
| 6 | Fiyat değişimi mevcut abonelere uygulanmaz | Apple zaten onay ister; kodda da garantile |

✅ Mevcut altyapı: `supabase/functions/revenuecat-webhook`, `process-lifetime-purchase`, `lifetime-counter`, `check-quota` mevcut. `027_webhook_columns` migration'ı var.

---

## 11. RİSKLER

| # | Risk | Önlem |
|---|---|---|
| 1 | Apple komisyonu %15→%30 | ⚠️ Yıllık $1M'da Small Business'tan çıkılır, marj %15 düşer. Modele koy |
| 2 | Affiliate şartları değişken | Geliri modelin temeline koyma |
| 3 | Grup gauntlet teknik zorluğu | Faz 2'den önce başlama |
| 4 | Arşiv paywall'ı sömürüye dönüşmesi | İlk kaçırılan gün ücretsiz telafi |
| 5 | App Store açıklaması kota diliyle yazılı | ⚠️ Yeni modele geçmeden güncelle, red riski |
| 6 | Webhook düşmesi → "ödedi ama erişemiyor" | Idempotent handler + retry + mutabakat scripti |

---

## 12. KARAR GÜNLÜĞÜ

> **05.08.2026 — v2.0**
>
> ~~Monetizasyon: mood-search kotası (Free 3/gün, Monthly 15, Annual 25, Lifetime 50)~~
> ~~Fiyat: $6.99/ay · $39.99/yıl · $89.99 lifetime~~
> ~~7 paywall varyantı~~
>
> **Yeni:** Ritüel ücretsiz · gelir arşiv + DNA + grup + affiliate'ten · $4.99/$29.99/$79.99 · 2 varyant · tek entitlement `chosy_pro` · Faz 0'da yalnızca arşiv paywall'ı
>
> **Gerekçe:** Kota modeli mood-search etrafında kuruluydu; çekirdek döngü gauntlet olunca paywall hiç tetiklenmiyor. Kıtlık satmak ritüeli öldürür.
>
> **Yeniden değerlendirme:** 1.000 aktif kullanıcı veya arşiv paywall'ının ilk 30 günlük verisi

---

*5 Ağustos 2026 · Bağlı: 1_PRODUCT_OS · 3_DESIGN_OS · 4_CLAUDE_CODE_OS*
