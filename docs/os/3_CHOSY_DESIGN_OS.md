# 🎞️ CHOSY DESIGN OS

**Versiyon:** v4.0 — "Karanlık Salon"
**Tarih:** 5 Ağustos 2026
**Kapsam:** iOS · React Native / Expo · Dark-only

> ✅ doğrulandı (kod/envanter, 5 Ağu 2026) · ⚠️ öneri veya doğrulanmamış

---

## 0. TASARIM TEZİ

> **Chosy karanlık bir salondur. Posterler tek ışık kaynağıdır. Arayüz karanlığın içinde geri çekilir.**

Bu bir estetik tercih değil, **mekaniğin dayattığı zorunluluk.**

Gauntlet ekranının %70'i iki posterden oluşuyor. Posterler kontrolümüz dışında — biri neon pembe, diğeri sepya olabilir. Kendini gösteren bir arayüz burada posterlerle **kavga eder.**

Çözüm arayüzü zayıflatmak değil, **rolünü değiştirmek**: kendini göstermez, posterleri taşır.

### Üç sonucu

| Sonuç | Uygulama |
|---|---|
| Marka rengi bir renk değil, ışıktır | Vurgu `beam` (sıcak beyaz), düşük alfa. Hue yok |
| Renk içerikten gelir | Poster hâkim rengi çerçeveye sızar (Bölüm 5) |
| Karanlık zorunlu | Light mode tezi kırar (Bölüm 11) |

### Anti-hedef

- ❌ Krem zemin + yüksek kontrast serif + terracotta *(AI üretimi görünümün 1 numaralı imzası)*
- ❌ Siyah zemin + tek asit yeşili vurgu
- ❌ Her yüzeye uygulanmış cam *(Liquid Glass'ın yanlış okunması)*
- ❌ Mor–pembe gradient yığını
- ❌ Letterboxd taklidi turuncu/yeşil/mavi

---

## 1. TEKNİK GERÇEKLİK ✅

Tasarım kararları kurulu paketlerle sınırlıdır. Bu bölüm tahmin değil, `package.json` okumasıdır.

| Alan | Durum |
|---|---|
| Expo | **~54.0.34** |
| React Native | **0.81.5** |
| Reanimated | ~4.1.1 (+ `react-native-worklets` 0.5.1) |
| Blur | `expo-blur` ~15.0.8 |
| Gradient | `expo-linear-gradient` ~15.0.8 |
| SVG | `react-native-svg` 15.12.1 |
| Görüntü | `expo-image` ~3.0.11 |
| Haptik | `expo-haptics` ~15.0.8 |
| Görüntü yakalama | `react-native-view-shot` 4.0.3 |
| Pano | `expo-clipboard` ~8.0.8 |
| İkon | `phosphor-react-native` ^3.0.6 |
| Yerel depolama | `@react-native-async-storage/async-storage` 2.2.0 |
| **Skia** | ❌ **KURULU DEĞİL** |
| **SecureStore** | ❌ **KURULU DEĞİL** |

### 1.1 "Liquid Glass" bugün ne demek

iOS 26'nın gerçek cam API'lerine (dinamik kırılma, kenar ışıması, içerik-duyarlı adaptasyon) **erişimimiz yok.** `expo-blur` `UIVisualEffectView` sarmalayıcısıdır — bir önceki nesil malzeme.

**Karar:** Cam yüzeyler `expo-blur` + `beam` @6% üst kenar + `graphite` alt kenar ile yaklaşık kurulur. Görsel hedef aynı, malzeme farklı.

- **Skia eklenmeyecek.** 40 saniyelik bir ekran için paket boyutu ve derleme maliyeti gerekçelendirilemez.
- Işık sızması Skia gerektirmez: düz `View` + düşük alfa `backgroundColor` yeterli.
- Expo yeni SDK'da iOS 26 cam API'lerini açtığında yeniden değerlendirilir. `GlassSurface` bileşeni ✅ bu geçişi tek dosyada tutuyor.

---

## 2. RENK

### 2.1 Yeni palet ⚠️

```
ink        #08090B    Salon karanlığı. Zemin. Saf siyah DEĞİL.
charcoal   #14161A    Yükseltilmiş yüzey. Chrome tabanı.
graphite   #22252B    Kenar, ayraç, iskelet.
smoke      #8A8F98    İkincil metin, meta veri.
bone       #ECEAE4    Birincil metin. Sıcak kırık beyaz.
beam       #FFF3D6    Vurgu = ışık. Düşük alfa.
marquee    #D4A72C    Ödül katmanı. XP · rank · streak.
```

### 2.2 Neden saf siyah değil

`#000000` üç problem yaratır: OLED'de kaydırma smear'ı, derinlik kaybı, poster kenarlarının "yüzmesi". `#08090B` hafif soğuk — poster sıcaklığı karşısında zemin geri çekilir.

Metin de saf beyaz değil: `#ECEAE4` projeksiyon ışığının rengi. Saf beyaz karanlıkta parlar.

### 2.3 Vurgu neden hue değil

Bu sistemin en önemli kararı:

> **Chosy'nin marka vurgusu bir hue değil, ışıktır.**

| Kullanım | Değer |
|---|---|
| Seçili poster kenarı | `beam` @24% |
| Birincil buton | `beam` @12% zemin + @40% kenar |
| Odak halkası | `beam` @60% |
| Aktif tur göstergesi | `beam` @100%, 4px |

Hiçbir posterle çakışmayan, her posterle uyumlu vurgu. Bir hue seçseydik filmlerin yarısıyla kavga ederdi.

### 2.4 Mevcut renkler ✅ — dokunulmazlar

`constants/Colors.ts` içindeki değerler doğrulandı:

```
Colors.gold           #D4A843    ← marquee'nin mevcut karşılığı
Colors.accentPrimary  #E8A838    ← tabActive, chipActiveBg ile ortak
Colors.chromeGlassSurface / chromeGlassBorder / chromeGlassFallback   (GlassSurface tüketicisi)
Colors.successWash    rgba(34,197,94,0.14)
```

⚠️ **Uyarı:** `Colors.gold` ≠ `Colors.accentPrimary`. Bu ikisi karıştırılırsa tip hatası vermeyen **görsel regresyon** olur. `marquee` yeni sistemde `Colors.gold`'un yerini alacak; `accentPrimary` ayrı kalacak.

**Feedback renkleri** (yeşil/sarı/gri) **öğrenilmiş sinyal dilidir**, asla değişmez. Yalnızca oyun geri bildirim ızgaralarında semantik anlam taşır.

### 2.5 Oyun paleti ✅ → daralıyor

`constants/gameThemes.ts` mevcut yapı:

```
GameType (7 oyun union'ı) · AmbientVariant 'orbs' | 'beam'
GameTheme: accent, accentDim, accentGlow, accentOn,
           ambientBase[3], ambientGlowA[2], ambientGlowB[2],
           ambientVariant, progressGradient
DEFAULT_GAME_THEME: #E8A838
withAlpha(hex, alpha) · resolveGameTheme(gameType)
```

**Doktrin (mevcut, korunuyor):** *"Oynanış oyunun teması, ödül Chosy'nin altını."*

Yeni durum:

```
gauntlet      beam + marquee (ışık + ödül)
spotlight     #8B5CF6   ← aktif bonus oyun
```

~~cinemetrics #6366F1~~ · ~~detective #0D9488~~ · ~~imposter #22D3EE~~ · ~~fadein #FB7185~~ · ~~logline #8B5CF6~~ — dondurulmuş oyunlarla birlikte dosyada kalır, kullanılmaz.

### 2.6 Spotlight accent neden `#E8A838` olamaz

Mevcut değer `Colors.accentPrimary` ile aynı ve ödül altını `marquee` ile aynı aileden. Aynı ekranda XP/rank/streak altın taşırken oyun accent'i de altınsa **ödül katmanı ile oynanış katmanı ayırt edilemez** — `gameThemes.ts`'in kendi doktrininin ihlali.

`#8B5CF6` (donmuş Logline'dan devralınıyor): tiyatro ışığı çağrışımı Spotlight'a uygun, `marquee`'den ve `beam`'den maksimum uzak.

Ek uyum: Spotlight `ambientVariant: 'beam'` kullanan tek oyun ✅ — mor bir sahne huzmesi, altın accent'ten çok daha tutarlı.

> ⚠️ **İsim çakışması notu:** `AmbientVariant`'taki `'beam'` ile tasarım token'ı `color.accent.beam` farklı tip uzaylarında. Gerçek çakışma yok, ama `constants/design/` kurulurken karıştırılmamalı.

### 2.7 Kontrast ⚠️

| Kombinasyon | Oran | WCAG |
|---|---|---|
| `bone` / `ink` | ~15.8:1 | AAA |
| `smoke` / `ink` | ~6.2:1 | AA |
| `smoke` / `charcoal` | ~5.1:1 | AA |
| `marquee` / `ink` | ~8.4:1 | AAA |

**Kural:** `smoke` 13pt altında kullanılmaz; küçük metin `bone` @70%.

---

## 3. TİPOGRAFİ

### 3.1 Üç rol

| Rol | Aile | Neden |
|---|---|---|
| **Arayüz / gövde** | **SF Pro** (Text + Display) | Platform yerlisi. Dynamic Type, optik boyut, erişilebilirlik bedava gelir |
| **Marka anı** | **Archivo Expanded** (variable) ⚠️ → ✅ | Sinema **marki** tipografisi soyu — geniş, ışıklı tabela. Editoryal serif değil |
| **Veri / meta** | **Martian Mono** ⚠️ → ✅ | Film kutusu etiketi / teknik slate. Paylaşım metninde hizalama için zorunlu |

✅ Not: `constants/theme.ts` içinde `FONT_INTER` sabiti var ama yorumu açıkça *"Inter yüklenmiyor, bu SF Pro"* diyor. Yani gövde zaten SF Pro; sadece isimlendirme yanıltıcı.

⚠️ → ✅ **14 Ağustos 2026, C.1a:** `@expo-google-fonts/archivo` paketinde "Expanded" adında ayrı bir statik kesit **yok** — yalnızca Roman genişlik ağırlıkları var. Resmi variable font (`google/fonts` reposu, `ofl/archivo/Archivo[wdth,wght].ttf`) STAT tablosunda `wdth=125` değeri "Expanded" olarak etiketli (fvar max da 125) — bu doğrulanmış gerçek değer, tahmin değil. `fonttools.varLib.instancer` ile `wght=600/wdth=125` ve `wght=700/wdth=125` iki statik kesit üretildi (`ArchivoExpanded-SemiBold.ttf`, `ArchivoExpanded-Bold.ttf`), `assets/fonts/`'a commit'lendi. `@expo-google-fonts/martian-mono` paketi sorunsuz, `400Regular` + `600SemiBold` doğrudan kuruldu.

### 3.2 Playfair Display emekli

Mevcut arketip ekranlarında kullanılıyor ⚠️. Emekli:

- Yüksek kontrastlı didone serif, 2024-26 arası **AI üretimi tasarımın en tanınır imzası** oldu
- Karanlık zeminde hairline'ları OLED'de kayboluyor
- "Editoryal lüks" çağrışımı oyun/ritüel kimliğiyle çelişiyor

### 3.3 Ölçek ⚠️

```
display-xl    Archivo Expanded  700   40/44   -2%     Şampiyon adı
display-l     Archivo Expanded  700   30/34   -1.5%   DNA arketip adı
display-m     Archivo Expanded  600   22/26   -1%     Paylaşım kartı

title         SF Pro Display    600   20/24   -0.4%   Ekran başlığı
body          SF Pro Text       400   17/24   -0.2%   Gövde
body-strong   SF Pro Text       600   17/24   -0.2%
callout       SF Pro Text       400   15/20    0
caption       SF Pro Text       400   13/18   -0.1%

meta          Martian Mono      400   12/16   +2%     Yıl · süre · sayaç
meta-strong   Martian Mono      600   12/16   +2%     Streak
```

✅ `theme.ts`'te title −0.4, body −0.2, meta −0.1 letterSpacing zaten tanımlı — yukarıdaki ölçek bunlarla uyumlu.

### 3.4 Disiplin

Archivo Expanded **üç yerde** kullanılır: şampiyon açıklaması · DNA arketip adı · paylaşım kartı kelime markası. Başka hiçbir yerde.

> Marka fontu her yerdeyse marka anı diye bir şey kalmaz.

### 3.5 Dynamic Type

Tüm SF Pro rolleri bağlanır. Archivo Expanded ve Martian Mono **1.4x ile sınırlanır**. AX1–AX5'te gauntlet **dikey düzene** geçer: posterler alt alta, tek seferde biri odakta.

---

## 4. UZAY VE YAPI

### 4.1 Boşluk

4pt taban, 8pt ritim: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`

### 4.2 Köşe yarıçapı

```
radius-poster   14    Poster (fiziksel poster oranı)
radius-surface  20    Kart, panel
radius-chrome   28    Cam yüzey   ← theme.ts'te xxl: 28 zaten var ✅
radius-pill    999    Etiket, sayaç
```

✅ `theme.ts` borderRadius'a `xs: 4` ve `xxl: 28` eklenmiş. Sıfır yarıçap kullanılmaz.

Ayrıca `Theme.concentric(outer, padding)` ✅ mevcut — iç içe yarıçap hesabı için, yeni sistemde de kullanılacak.

### 4.3 Yükseklik — gölge değil, ışık

Karanlık arayüzde gölge işe yaramaz. Derinlik zemin açıklığı + ışık sızması ile kurulur.

```
elev-0   ink
elev-1   charcoal
elev-2   charcoal + beam@4% üst kenar
elev-3   glass + beam@8% kenar        ← yalnızca chrome
```

Drop shadow **yasak**. Tek istisna: poster altında `ink` gölge (y:8 blur:24 alpha:0.5) — posterin zeminden ayrılması için.

---

## 5. İMZA ÖĞE — IŞIK SIZMASI

> Her tasarım sisteminin hatırlanacak tek bir şeyi olmalı. Chosy'de bu, ışık sızmasıdır.

### 5.1 Ne yapar

Ekrandaki posterlerin hâkim rengi çıkarılır, aşırı kısıtlanır, zemine çok hafif bir ışıma olarak sızar.

```
Perdeden yayılan ışık, salonun duvarlarını boyar.
```

Projeksiyonun fiziğinin birebir karşılığı — ve poster/arayüz çatışmasını **yapısal olarak** çözer: arayüz posterle kavga etmez, ondan beslenir.

### 5.2 Kısıtlar

```typescript
const BLEED_CONSTRAINTS = {
  maxChroma:    0.08,   // OKLCH doygunluk tavanı
  maxLightness: 0.22,   // asla parlamaz
  maxAlpha:     0.10,   // zeminde
  transition:   600,    // ms
  fallback:     'ink',
};
```

### 5.3 Uygulama kuralları

| Kural | Gerekçe |
|---|---|
| Sadece **zemin** ve **chrome kenarı**. Metin/ikon/buton asla | Okunabilirlik |
| Tek renk, gradient değil | Gradient yığını yasak |
| Kontrast 4.5:1 altına düşerse **otomatik iptal** | Erişilebilirlik önce gelir |
| `Reduce Transparency` → kapalı | Sistem tercihine saygı |
| Feedback renklerinin yakınına sızma yok | Sinyal dili korunur |
| İstemcide görüntü işleme **yok** | Renk backend'den gelir |

### 5.4 Veri ✅ ONAYLANDI

`films.dominant_color` (OKLCH jsonb) + `dominant_color_computed_at` + `poster_quality_ok` — CTO onayı 04.08.2026.

Renk **kısıtlanmış haliyle** saklanır; istemci hesaplama yapmaz. Poster w92 boyutunda indirilir (3.394 film × tam boyut kabul edilemez). LLM çağrısı yok.

`GauntletFilm.dominantColor?` opsiyonel alan olarak sözleşmeye eklenir — **ekleme, değişiklik değil**, geriye dönük uyumlu.

---

## 6. LIQUID GLASS — KATMAN KURALI

```
CHROME KATMANI      → cam     (navigasyon, bağlam çubuğu, alt eylem çubuğu)
İÇERİK KATMANI      → düz     (posterler, metin, kartlar, ızgaralar)
```

Cam **hareket eden şeyin altında** anlam kazanır. Sabit içeriğin altında sadece bulanıklıktır.

**Cam kullanılan:** Bağlam çubuğu · alt eylem çubuğu · şampiyon bilgi paneli · modal arka plan
**Cam kullanılmayan:** Posterler · poster etiketleri · tur göstergesi · sessiz eylemler · oyun ızgaraları · paylaşım kartı · DNA grafikleri

**Reduce Transparency:** cam → düz `charcoal` + `graphite` 1px kenar. Düzen değişmez, malzeme değişir. ✅ `Colors.chromeGlassFallback` bunun için zaten var.

---

## 7. HAREKET — İKİ İLKE

Chosy'de iki hareket ilkesi vardır. Üçüncüsü yoktur. İsimler film montajından gelir ve gerçekten o işi yaparlar.

### 7.1 Kesme (Cut) — 0ms
Ani, kesin, geri dönüşsüz. Karar anları: seçim onayı · tur değişimi · şampiyon açıklaması.

### 7.2 Geçiş (Dissolve) — 240–400ms ⚠️
- Elenen poster: aşağı 12px + opaklık 1→0.25, **320ms**, `easeOutQuart`
- Kalan poster: ölçek 1→1.06, **280ms**, `spring(0.8, 0.9)`
- Yeni rakip: opaklık 0→1 + aşağıdan 16px, **360ms**
- Işık sızması: **600ms** lineer

✅ `constants/animations.ts` mevcut ve genişletilmiş — yeni süreler oraya girer, bileşenlere hardcode edilmez.

### 7.3 Kara boşluk — imza an

```
Final seçimi
  → 120ms tam siyah (KESME)
  → 400ms nefes, hiçbir şey yok
  → Şampiyon posteri GEÇİŞ ile belirir
  → 200ms sonra başlık (Archivo Expanded)
  → 200ms sonra meta veri
```

Bu 720ms'lik sessizlik ürünün en pahalı anıdır ve kısaltılmaz.

### 7.4 Yasaklar

Dekoratif animasyon · parıltı/shimmer/pulse (iskelet hariç) · paralaks · zincirleme gecikme >300ms · spring bounce >1.06

### 7.5 Reduce Motion

Tüm **Geçiş**ler → 100ms cross-fade. **Kesme**ler aynı. Kara boşluk korunur (hareket değil, zamanlama). Sızma geçişi anlık.

---

## 8. HAPTİK

40 saniyelik sessiz ritüelde dokunuş sesin yerini alır. Dekoratif değil, anlatısal. ✅ `expo-haptics` kurulu.

| An | Desen |
|---|---|
| Poster seçimi | `impactLight` |
| Tur geçişi | `impactMedium` |
| Ret | `selectionChanged` |
| "İzledim" | `selectionChanged` |
| Şampiyon | `notificationSuccess` + 300ms sonra `impactHeavy` |
| Streak kırılma riski | `notificationWarning` |
| **Paywall açılışı** | **haptik yok** — ticari an fiziksel baskı yapmaz |

Kullanıcı tercihi `AsyncStorage`'da ✅ (SecureStore kurulu değil).

---

## 9. İKON

| Sistem | Kullanım |
|---|---|
| **Phosphor duotone** ✅ | Marka anları: DNA, arketip, streak, şampiyon |
| **Ionicons** | Fonksiyonel UI: kapat, geri, ayar, paylaş |
| **69 özel ikon** ⚠️ | Arketip ve tür ikonları — mevcut set korunur |

**Değişmez:** Phosphor ve Ionicons **aynı ekranda yan yana görünmez.**

Gauntlet fonksiyoneldir → Ionicons. Şampiyon marka anıdır → Phosphor duotone.

---

## 10. EKRAN ANATOMİLERİ

### 10.1 Gauntlet

```
┌────────────────────────────────────────┐
│ ░░░ cam ░░░                            │
│  Salı akşamı · Yalnız · ~2 saat    ⌄  │  smoke, caption
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│      ● ● ○ ○        Tur 1/3            │  beam aktif, graphite pasif
│                                        │
│    ┌──────────┐    ┌──────────┐       │
│    │ POSTER A │    │ POSTER B │       │  %70, radius 14, 2:3
│    └──────────┘    └──────────┘       │
│      HEAT            SICARIO           │  body-strong, bone
│      1995 · 170dk    2015 · 121dk      │  meta, smoke
│                                        │
│         Bu akşam hangisi?              │  callout, smoke
│   İkisi de değil  ·  Bunu izledim      │  caption, smoke@70%
└────────────────────────────────────────┘
        ↑ ink + ışık sızması
```

**Kurallar:** Tab bar gizli · poster 2:3 sabit, kırpma yok · başlık >18 karakter tek satırda kısaltılır · ikincil eylemler buton değil metin bağlantısı · yükleme `graphite` iskelet, spinner yok · hata gerçek mesaj, sessiz boş ekran yasak.

### 10.2 Şampiyon

Tek poster ortalanmış · `display-xl` başlık · meta satırı · anlatı cümlesi (*"Heat iki tur dayandı ama sen fikrini değiştirdin."*) · cam panelde eylemler + `marquee` streak.

Işık sızması burada **en güçlü** — tek poster, rengi netleşiyor, alfa 0.14.

### 10.3 Bağlam seçici

Üç sekme, sadece dokunma, yazı girişi yok. Seçili durum `beam` @12% zemin + @40% kenar — **renk değişimi değil, ışık değişimi.** Hedef süre 4 saniye.

### 10.4 Cinema DNA

Eksenler yatay çubuk, `graphite` zemin + `beam` dolgu. Arketip adı `display-l`. Güven: 9 segment, dolu olanlar `marquee`.

### 10.5 NAVİGASYON SÖZLEŞMESİ 🔒

**Karar tarihi:** 13 Ağustos 2026 · **Yeniden değerlendirme:** 1.000 aktif kullanıcı

#### 10.5.1 Yapı

```
(tabs)/
├── index.tsx      BUGÜN     ← kök ekran
│                              durum makinesi: bekleyiş | gauntlet | şampiyon
└── profile.tsx    PROFİL    ← Cinema DNA · Kütüphane · Arşiv 🔒 · Ayarlar
```

**İki sekme. Üçüncüsü yok.**

#### 10.5.2 Tab bar davranışı

| Durum | Tab bar |
|---|---|
| Bekleyiş (18:00 öncesi) | Görünür |
| **Gauntlet — 3 tur** | **GİZLİ** |
| Şampiyon açıklaması | Geri gelir |
| Profil ve alt ekranları | Görünür |

Gizleme ekran bazında (`options.tabBarStyle`), koşullu render ile DEĞİL —
koşullu render layout sıçraması üretir.

#### 10.5.3 Kararın gerekçesi

Tasarım tezi (§0) ile gelir modeli (`2_BUSINESS_MODEL` §4) bu ekranda çatışıyor:

| Belge | Talep |
|---|---|
| DESIGN_OS §0 | Arayüz geri çekilir; kalıcı chrome tezi zayıflatır |
| BUSINESS_MODEL §4 | Gelirin **tamamı** ritüelin dışındaki yüzeylerde |

**Çözüm çatışmayı ortadan kaldırıyor:** Tez 40 saniyelik ritüelin bölünmemesini
talep ediyor — o 40 saniye korunuyor. Geri kalan zamanda navigasyon var, çünkü
gelir orada.

**Belirleyici argüman:** Faz 0'da tek paywall arşivdir ve tek bir sayıyı ölçer:
*"streak'i olan insanlar bunun için para verir mi?"* Sıfır-chrome mimarisinde
arşive giden yol 3 dokunuştur. O sayı ölçülemezse **"ödemedi" ile "bulamadı"
ayrımı yapılamaz** ve gelir modelinin tamamı test edilmemiş kalır.

**Referans sınıfı düzeltmesi:** `1_PRODUCT_OS` §1.2 "Wordle / NYT Games" diyor.
Bu ikisi aynı sınıf değil. Navigasyonu olmayan ritüel ürünleri (Wordle) para
kazanmadı; ritüelin etrafından para kazanan her ürün (NYT Games, Duolingo) o
etrafı kalıcı görünür tuttu. Chosy'nin gelir modeli NYT Games kopyasıdır
(BUSINESS_MODEL §3) — navigasyon modelini Wordle'dan almak tutarsızdır.

**Platform uyumu:** iOS 26'da tab bar içeriğin üzerinde yüzer, kaydırmada
küçülür ve üzerine aksesuar shelf eklenebilir. Apple HIG Liquid Glass'ı
"içeriğin üzerinde yüzen navigasyon katmanı" için ayırır — §6 katman kuralımızın
aynısı. Tab bar'ı silmek, tasarım sistemimizin en olgun bölümünü kullanılamaz
hale getirirdi.

**Neden 2 sekme, 3 değil:** Üçüncü sekmenin bugün içeriği yok. Boş sekme,
olmayan sekmeden kötüdür. Faz 2'de grup gauntlet gelirse üçüncü sekme tek
satırla açılır; sıfır-chrome mimarisinde aynı iş router yeniden yazımıdır.

#### 10.5.4 Ekran envanteri

| Ekran | Karar | Gerekçe |
|---|---|---|
| **Bugün** | 🆕 Kök | Gauntlet + bekleyiş + şampiyon tek durum makinesi |
| **Profil** | 🆕 İkinci sekme | Kimlik + gelir yüzeyi |
| ~~Home~~ | ❌ Silinir | Ayrı ana ekranın göstereceği şey gauntlet'ın kendisi |
| ~~Games~~ | ❌ Silinir | 7 oyundan 1 kaldı (C.6). Spotlight şampiyon sonrası tek kart |
| ~~Watchlist~~ | ❌ Sekme değil | Profil → Kütüphane'ye taşınır (§10.6) |
| ~~Mood search~~ | 🧊 Dondurulur | 57 arama/90 gün. Pro mode altında kalır |

⚠️ **Silinen ekranların kodu C.6'ya kadar durur** — `app_config` ile kapatılır,
dosya silinmez. C.1 renk denetimi bu dosyaları KAPSAM DIŞI sayar.

#### 10.5.5 Profil — sözleşme (düzen DEĞİL)

Bu bölüm hangi bilginin nerede yaşadığını tanımlar. Görsel anatomi
**C.2 tamamlandıktan sonra** yazılır — gerekçe §10.5.7.

| Blok | İçerik | Durum |
|---|---|---|
| Kimlik | Arketip adı + güven göstergesi (§10.4) | C.2 sonrası |
| Streak | Gün sayısı, `marquee` | C.2 |
| **Kütüphane** | İzlenenler + watchlist (§10.6) | C.4'e bağımlı |
| **Arşiv** | Kaçırılan günler · 🔒 Pro · **Faz 0'ın tek paywall'ı** | Faz D |
| Ayarlar | Bildirim, haptik, dil, hesap | C.7 |

#### 10.5.6 Kütüphane — sözleşme

`1_PRODUCT_OS` §3.7: watchlist bugün ölü depo (318 satır, `watched_at` 0/318).
**C.4 öncesi tasarlanamaz** — bugünkü ölü ekranın yeniden inşası olur.

C.4 sonrası iki bölüm: **İzlenenler** (`watched_source`: manual ·
gauntlet_feedback · local_sync) ve **Sonraya bırakılanlar**. Şampiyon otomatik
girmez (§3.7).

#### 10.5.7 Neden anatomiler şimdi yazılmıyor

| Blok | Engel |
|---|---|
| Cinema DNA | Gerçek eksen ayrışması C.2+C.4 verisi olmadan bilinmiyor |
| Kütüphane | C.4'ten önce ölü listeyi yeniden inşa etmek olur |
| Görsel dil | Işık sızması + `PosterTile` cihazda görülmeden ikincil ekranlar kâğıt üstünde kalır (§6 kurucu testi kuralı) |

Faz A maliyet gerekçesiyle atlandı. Kullanım verisi sıfır olan ekranlar için
şimdi detaylı tasarım turu açmak o kararla çelişir.

#### 10.5.8 Kararın ölçümü

Karar veriyle geri alınabilir. PostHog'da C.2 ile kurulur:

| Sinyal | Eşik | Sonuç |
|---|---|---|
| Profil sekmesi açılma | DAU'nun <%5'i / 30 gün | İkinci sekme gereksiz → sıfır-chrome |
| Gauntlet tamamlama | Tab bar'lı sürümde belirgin düşüş | Gizleme bozuk, ritüel bölünüyor |
| Arşiv paywall görüntülenme | Kaçıranların <%40'ı | Keşif sorunu, fiyat sorunu değil |

#### 10.5.9 Kilitli / açık

**🔒 Kilitli:** iki sekme · kök ekran gauntlet · gauntlet sırasında tab bar gizli ·
Arşiv Profil altında ve Faz 0'ın tek paywall yüzeyi

**🔓 Açık:** sekme ikon/etiketleri · `minimizeBehavior` ayarı · Profil içi düzen ·
aksesuar shelf kullanımı (streak için cazip, C.2 sonrası değerlendirilir)

---

## 11. DARK-ONLY

Chosy light mode desteklemez.

| Gerekçe | |
|---|---|
| Kullanım bağlamı | Ritüel 18:00 sonrası, çoğunlukla karanlık oda |
| Tez bütünlüğü | "Posterler tek ışık kaynağı" aydınlık zeminde çöker |
| İmza öğe | Işık sızması yalnızca karanlıkta çalışır |
| Poster sunumu | Poster sanatı karanlık zeminde daha iyi okunur |

**Erişilebilirlik yükümlülüğü** — pazarlığa açık değil. `Increase Contrast` açıkken: `smoke` → `bone`@85% · kenarlar `graphite` → `smoke` · cam → düz `charcoal` · sızma kapalı.

⚠️ App Store incelemesi light mode zorunlu tutmaz, ancak sistem erişilebilirlik ayarlarına saygı zorunludur.

> ✅ Not: `components/useColorScheme.ts` 5 Ağustos'ta düzeltildi — hook `null` dönebiliyordu ve `Colors[null]` çökme yoluydu. Artık `?? 'light'` ile `'light' | 'dark'`. Dark-only karara rağmen bu hook `_layout.tsx`'te canlı.

---

## 12. TOKEN MİMARİSİ

### 12.1 Dosya yapısı

```
constants/                          ← src/ YOK ✅
├── design/
│   ├── primitives.ts      Ham değerler. Hiçbir bileşen buradan import etmez.
│   ├── semantic.ts        Anlamlı isimler. Bileşenler BURADAN okur.
│   └── motion.ts          Süre, easing, haptik
├── gauntletTokens.ts      Gauntlet'a özel
├── gameThemes.ts    ✅    Mevcut — Spotlight + dondurulmuş oyunlar
├── gameLayout.ts    ✅    Mevcut — GAME_CONTENT_PADDING, gridItemWidth
├── Colors.ts        ✅    Mevcut — dokunulmaz değerler
├── theme.ts         ✅    Mevcut — borderRadius, concentric, tipografi
└── animations.ts    ✅    Mevcut
```

### 12.2 Katman kuralı

```typescript
// primitives.ts — ham
export const palette = {
  ink: '#08090B', charcoal: '#14161A', graphite: '#22252B',
  smoke: '#8A8F98', bone: '#ECEAE4', beam: '#FFF3D6',
  marquee: '#D4A72C',
} as const;

// semantic.ts — anlamlı
import { withAlpha } from '../gameThemes';   // ✅ mevcut, yeniden yazma

export const color = {
  surface: { base: palette.ink, raised: palette.charcoal, border: palette.graphite },
  text:    { primary: palette.bone, secondary: palette.smoke },
  accent:  {
    edge:   withAlpha(palette.beam, 0.24),
    fill:   withAlpha(palette.beam, 0.12),
    focus:  withAlpha(palette.beam, 0.60),
    active: palette.beam,
  },
  reward:  { primary: palette.marquee },
} as const;
```

**Kural:** Bileşenler `primitives.ts`'ten **asla** import etmez. Palet değişimi tek dosyada kalır.

`withAlpha` yeniden yazılmaz — `gameThemes.ts`'te tekil olarak var ✅.

### 12.3 Denetim ✅

```powershell
# Hardcoded renk — mevcut sayı: 94
Get-ChildItem -Recurse -Include *.tsx,*.ts app,components,services,constants,hooks,contexts,utils |
  Select-String -Pattern '#[0-9a-fA-F]{6}'

# primitives.ts'ten doğrudan import (yasak)
Get-ChildItem -Recurse -Include *.tsx app,components |
  Select-String -Pattern "design/primitives"

# Hardcoded süre
Get-ChildItem -Recurse -Include *.tsx app,components |
  Select-String -Pattern 'duration:\s*[0-9]+'
```

⚠️ **94 hardcoded renk** ✅ mevcut (önceki 159 kaydı yanlış ölçümdü, C.1a'da düzeltildi), çoğu yeni festival katmanında. C.1'in gerçek kapsamı bu.

---

## 13. BİLEŞEN ENVANTERİ ✅

| Bileşen | Durum |
|---|---|
| `GameShell` ✅ | Koru — Spotlight kullanıyor (**`GameScreenShell` DEĞİL**) |
| `GlassSurface` ✅ | Uyarla — `expo-blur` sarmalayıcısı, cam geçişinin tek noktası |
| `GameBackdrop` ✅ | Uyarla — ışık sızmasının taşıyıcısı olabilir |
| `Spotlight` ✅ | Koru — aktif bonus oyun |
| `ResultCard`, `QuickResult` ✅ | Koru — ödül katmanı, tema uygulanmaz |
| `WhyThisMovie`, `PlayNextBridge` ✅ | Koru — tema uygulanmaz |
| `ConfidenceSelector`, `DnaSummaryCard`, `DnaXpReveal` ✅ | Koru |
| `HintBoard`, `FilmSearchInput`, `GameStateView` ✅ | Koru |
| `CineMetrics`, `Detective`, `Imposter` ✅ | Dondur (kod kalır) |
| **`PosterTile`** | 🆕 **Envanterde YOK** — sıfırdan |
| `GauntletShell` | 🆕 |
| `ContextBar` | 🆕 |
| `RoundIndicator` | 🆕 |
| `ChampionReveal` | 🆕 |
| `ConfidenceMeter` | 🆕 |
| `QuietAction` | 🆕 |
| `LightBleed` | 🆕 |
| `TabShell` | 🆕 İki sekmeli kabuk. Gauntlet'ta gizleme mantığı burada tek noktada |
| `ProfileScreen` | 🆕 Sözleşme §10.5.5. Anatomi C.2 sonrası |
| `LibraryScreen` | 🆕 Sözleşme §10.5.6. **C.4'e bağımlı, önce inşa edilmez** |
| Home / Games / Watchlist ekranları | ❌ Silinir (§10.5.4) — C.6'ya kadar `app_config` ile kapalı, C.1 kapsamı DIŞI |

**Değişmez:** Paylaşılan ödül bileşenleri oyun/gauntlet temasından **muaftır**. Ödül katmanı her yerde aynı görünür.

---

## 14. KALİTE ZEMİNİ

Çıkış koşulu. Karşılanmadan hiçbir ekran TestFlight'a gitmez.

- [ ] Dynamic Type XS → AX5, düzen kırılmıyor
- [ ] AX boyutlarında gauntlet dikey düzene geçiyor
- [ ] VoiceOver: `"Heat, 1995, 170 dakika, seçmek için çift dokun"`
- [ ] VoiceOver sırası: bağlam → tur → poster A → poster B → eylemler
- [ ] Reduce Motion: geçişler 100ms cross-fade
- [ ] Reduce Transparency: cam düz
- [ ] Increase Contrast: `smoke` yükseltiliyor
- [ ] Dokunma hedefi ≥44×44pt
- [ ] Kontrast oranları Bölüm 2.7'ye uygun
- [ ] 60fps — düşük pil modunda da
- [ ] Safe area: notch, Dynamic Island, home indicator
- [ ] Poster yüklenemezse anlamlı yer tutucu
- [ ] Ağ hatasında gerçek mesaj — **sessiz boş ekran yasak**

---

## 15. METİN DİLİ

### 15.1 Ses
Sakin, kesin, kısa. Bir sinema programcısının tonu — bildiğini bilir, satmaya çalışmaz.

### 15.2 Kurallar

| Kural | ❌ | ✅ |
|---|---|---|
| Etken çatı | "Seçim yapılmalı" | "Birini seç" |
| Sistem dili yok | "Vektör hesaplanıyor" | "Seni tanımaya çalışıyorum" |
| Hata özür dilemez | "Üzgünüz, bir hata oluştu" | "Bugünün filmleri yüklenemedi. Tekrar dene." |
| Boşluk davettir | "Veri yok" | "Henüz oynamadın. İlk gauntlet 18:00'de." |
| Övgü yok | "Harika seçim!" | "Kararında netsin." |

### 15.3 Anahtar metinler

```
Bağlam:       Salı akşamı · Yalnız · ~2 saat
Soru:         Bu akşam hangisi?
Ret:          İkisi de değil
İzlendi:      Bunu izledim
Kararlılık:   Kararında netsin.
Değişim:      Fikrini değiştirdin, iyi ki bakmışsın.
Şampiyon:     Bugünün filmi
Güven:        Seni %35 tanıyorum
Tükeniş:      Bugün ikna olmadın galiba. Yarın yeni bir dörtlü hazır olacak.
Bekleyiş:     Bugünün dörtlüsü 18:00'de hazır.
```

✅ i18n: `locales/en.json` ve `tr.json` **1.223/1.223 tam paritede**. Tüm yeni string'ler `t()` üzerinden, parite korunacak.

---

## 16. YÜRÜRLÜĞE GEÇİRME

| # | İş | Faz |
|---|---|---|
| 0 | **Navigasyon iskeleti (`TabShell`, 2 sekme)** — §10.5 | **C.1 başı** |
| 1 | Hardcoded renk denetimi (94 ihlal) + rapor | C.1 |
| 2 | `constants/design/primitives.ts` + `semantic.ts` | C.1 |
| 3 | `gauntletTokens.ts` + `design/motion.ts` | C.1 |
| 4 | Archivo Expanded + Martian Mono yükle, Playfair emekli | C.1 |
| 5 | Spotlight accent `#E8A838` → `#8B5CF6` | C.1 |
| 6 | `PosterTile` (yeni) + `GauntletShell` | C.2 |
| 7 | Gauntlet ekranı | C.2 |
| 8 | Şampiyon + kara boşluk | C.2 |
| 9 | Işık sızması backend (`films.dominant_color`) | C.2b |
| 10 | Işık sızması istemci + erişilebilirlik kapatmaları | C.2c |
| 11 | `ContextBar` | C.3 |
| 12 | Paylaşım kartı (metin öncelikli) | C.5 |
| 13 | Erişilebilirlik geçişi (Bölüm 14) | C.8 |
| 14 | Profil + Kütüphane anatomileri (§10.5.7) | **C.4 sonrası** |

⚠️ Sıra 0 kasıtlı: `TabShell` C.1'in ilk işi. Token katmanı router iskeleti otururken yazılırsa ikinci kez dokunulmaz.

**Disiplin:** Ekran başına tek commit · `design/before/` ve `design/after/` ekran görüntüsü · `DESIGN_SYSTEM.md`'ye üstü çizili karar kaydı.

---

## 17. KARAR GÜNLÜĞÜ

> **04–05.08.2026 — v4.0 "Karanlık Salon"**
>
> ~~Marka vurgusu: tür-kodlu 5 renkli palet~~
> ~~Marka fontu: Playfair Display~~
> ~~Vurgu rengi: her oyun için ayrı hue~~
>
> **Yeni:**
> - Tez: posterler tek ışık kaynağı; arayüz taşıyıcı, gösterici değil
> - **Vurgu bir hue değil, ışık** (`beam` #FFF3D6, düşük alfa)
> - Palet: ink · charcoal · graphite · smoke · bone · beam · marquee
> - Tipografi: SF Pro (arayüz) · Archivo Expanded (marka, 3 yerde) · Martian Mono (veri)
> - İmza öğe: Işık sızması — `films.dominant_color` onaylandı (04.08)
> - Hareket: iki ilke — Kesme ve Geçiş; şampiyonda 720ms kara boşluk
> - Cam: yalnızca chrome katmanı; Skia eklenmiyor, `expo-blur` ile yaklaşık
> - Mod: dark-only, gerekçeli
> - Bonus oyun accent'i: Spotlight `#E8A838` → `#8B5CF6` (ödül altınıyla çakışma)
>
> **Değişmeyenler:** feedback renkleri · ödül katmanı altını · Phosphor/Ionicons ayrımı · `gameThemes.ts` doktrini ("oynanış oyunun teması, ödül Chosy'nin altını") · `withAlpha` tekil
>
> **Gerekçe:** Gauntlet mekaniği ekranın %70'ini kontrol dışı poster görsellerine bıraktı. Renkli marka paleti bu görsellerle çatışıyordu. Vurguyu hue'dan ışığa taşımak ve rengi içerikten türetmek, çatışmayı kimlik kaybı olmadan çözüyor.
>
> **Yeniden değerlendirme:** 1.000 aktif kullanıcı veya Işık Sızması A/B testi

> **13.08.2026 — Navigasyon sözleşmesi 🔒**
>
> ~~Tab bar tamamen kalkar, kök ekran gauntlet, Profil köşe ikonundan push~~
> *(aynı gün, uygulanmadan reddedildi)*
>
> **Karar:** İki sekme (Bugün · Profil), tab bar gauntlet sırasında gizli.
> Home/Games/Watchlist sekmeleri silindi.
>
> **Gerekçe:** Sıfır-chrome önerisi tasarım tezini optimize ediyor, gelir
> modelini görmüyordu. Faz 0'ın tek paywall'ı arşiv ve tek işi bir sayı
> ölçmek; 3 dokunuş derinliğinde o sayı ölçülemez. "Ödemedi" ile "bulamadı"
> ayrımı yapılamayan bir mimari, gelir modelini test edilemez kılar.
>
> **Değişmeyen:** Ritüelin 40 saniyesi bölünmez — tez bu noktada korunuyor.

---

*5 Ağustos 2026 · Bağlı: 1_PRODUCT_OS · 2_BUSINESS_MODEL · 4_CLAUDE_CODE_OS*
