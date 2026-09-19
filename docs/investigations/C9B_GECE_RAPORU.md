# C.9b-UI — Gece Raporu

**Tarih:** 19→20 Eylül 2026 · **Mod:** gece modu, CTO uykuda
**Sonuç:** 9 maddenin 8'i commit'lendi, 1'i koşul sağlanmadığı için atlandı.
**Kapı:** pre-commit baseline (14, hepsi `scripts/`) yedi commit'te de korundu.

> Hiçbir şey `push` edilmedi. `--no-verify`, `git add -A`, `git commit -a`
> kullanılmadı — her commit açık dosya listesiyle. `app/(tabs)/index.tsx` ve
> `_TEMP_InsetProbe.tsx` **dokunulmadı**, probe çalışma ağacında duruyor.

---

## 1. Commit zinciri

| # | Hash | Madde | Dosya |
|---|---|---|---|
| 1 | `b28e96e` | **C2c** bölge cihazdan | `LanguageContext.tsx` · `WatchProviders/index.tsx` |
| 2 | `3abf2d2` | **C2b** `accent.edgeStrong` | `constants/design/semantic.ts` |
| 3 | `4c895b3` | **G4b + G11** tek merkezi kabuk | `GauntletShell/{index,styles}` · `ChampionReveal/styles` |
| 4 | `81f6b34` | **C2 + C2e** birincil eylem + sheet | 11 dosya (`PrimaryAction/*`, `useWatchProviders.ts`, `tmdb.ts`, locales…) |
| 5 | `d508cec` | **C7 + C5** w780 + siyah bekleme | `ChampionReveal/index` · `GauntletShell/index` |
| 6 | `5419586` | **C8 + isStale** | `ChampionReveal/{index,styles}` · `GauntletShell/{index,styles}` |
| 7 | `da83d52` | **C4** Spotlight bonus kartı | `SpotlightBonusCard/*` · `GauntletShell/index` · locales |

**Atlanan:** **C3** (ikon ailesi tekleştirme) — koşul sağlanmadı, aşağıda.

---

## 2. Commit detayları

### 1 · `b28e96e` — C2c: bölge cihazdan

**Kodla doğrulanan:** typecheck 14 (hepsi `scripts/`) · eslint 0 hata.

`expo-localization` projede **tek yerde** import ediliyor: `LanguageContext`.
CLAUDE.md'nin "doğrudan import YASAK → LanguageContext kullan" kuralı böylece
korundu. Paket zaten kuruluydu (`~17.0.8`) ama hiçbir yerde kullanılmıyordu.

**Cihazda:**
1. Ayarlar → Genel → Dil ve Bölge → Bölge = **Türkiye**. Uygulamayı **tam kapat** (kaydırarak), yeniden aç.
2. Gauntlet'i bitir → Champion'a gel → "Nerede izlenir"e dokun.
3. **Bak:** sağlayıcılar TR kataloğu mu (BluTV/MUBI/Netflix TR…), yoksa ABD listesi mi?
4. Bölgeyi **ABD**'ye çevir, tam kapat-aç, aynı filmde tekrar bak. Liste **değişmeli**.

> ⚠️ **Bölge ≠ dil.** `region` cihazdan okunuyor ama `language` okunmuyor:
> `LanguageContext` kayıtlı tercih yoksa **koşulsuz `'en'`** seçiyor (borç
> kaydı açıldı). Yani **cihaz dilini Türkçe yapmak uygulamanın dilini
> değiştirmez.** Türkçe string testleri (G9, C2e `empty` metni) için dili
> **uygulama içi Ayarlar'dan** çevir.

### 2 · `3abf2d2` — C2b: token

**Kodla doğrulanan:** `rgba(255, 243, 214, 0.4)` · typecheck 14.
Bu commit yalnız token ekliyor, tüketimi `81f6b34`'te. Tek başına görsel etkisi yok.

### 3 · `4c895b3` — G4b + G11: tek merkezi kabuk 🔴 **RİSKLİ**

Sekiz dalın her biri kendi `root` + `LightBleed`'ini kuruyordu. Beşi no-op'tu
(ink üstüne ink), altıncısı (champion) **hiç yoktu**. Kabuk tek yere taşındı:
dış root tam ekran (ink + tek sızma, **dolgusuz** → ışık kenara ulaşır), iç
katman safe-area dolgusunu taşır.

**Kodla doğrulanan:** typecheck 14 · eslint 0 hata · sekiz dalda `styles.root`
ve `<LightBleed` referansı **0**.

**Cihazda — en kritik sınav:**
1. **Gauntlet turu.** Atonement gibi sıcak posterli bir çift çıkana kadar bak.
   **Bak:** zemin sıcak kahve/bordo mu? → before görüntüsüyle **birebir aynı** olmalı. Değiştiyse regresyon.
2. **Üst kenar.** ContextBar Dynamic Island'ın **altından** başlıyor mu? Önceden ona dayanıyordu.
3. **Champion'a geç** (son turu oyna). **Bak:**
   - 120ms tam siyah → **renk yok**
   - ~400ms sessizlik → **hâlâ renk yok**
   - poster belirmeye başlayınca sızma **onunla birlikte** yükseliyor mu?
   - **Önceki turun rengi taşınmamalı** — kara boşlukta önceki çiftin rengi görünürse hata.
4. **Dört poster vakası** (farklı günlerde): turkuaz (Colony) · sıcak · çok karanlık · renksiz/siyah-beyaz.
   **Bekle:** "karanlık salon" hissi bozuluyorsa 0.30'dan aşağı kalibre edilir — **0.10'a inilmez**.
5. **Reduce Transparency** aç → sızma **kapanmalı**, zemin nötr `ink`.
6. Uygulamayı kapat-aç (resume yolu) → Champion'da sızma **beklemeden** var olmalı.

**Geri alma:** `git revert 4c895b3`
⚠️ `81f6b34`, `d508cec`, `5419586`, `da83d52` bunun üstüne yazıldı — tek başına
revert çakışabilir. Zinciri geri almak gerekirse: `git revert da83d52 5419586 d508cec 81f6b34 4c895b3`

> **Not:** `4c895b3`'ün commit mesajındaki "GERI ALMA: git revert 4f8c9a2"
> satırı **yanlış** (taslak hash kaldı). Doğrusu `4c895b3`.

### 4 · `81f6b34` — C2 + C2e: birincil eylem + sheet 🔴 **RİSKLİ**

**Kodla doğrulanan:** typecheck 14 · eslint 0 hata · i18n paritesi 1357/1357.

**Cihazda — dört durumu ayrı ayrı:**

| Durum | Nasıl tetiklenir | Bak |
|---|---|---|
| **loading** | Champion'a ilk geçiş (prefetch yetişmemişse) | Buton **yerinde**, sönük. Sonradan **belirmemeli** (pop-in yok) |
| **ok** | Sağlayıcısı olan bir film | Butona dokun → sheet aşağıdan gelir. Logolar görünür. Bir logoya dokun → TMDB sayfası açılır |
| **empty** | Bölge = Türkiye + yeni/niş film (Colony gibi) | "Bölgende akışta yok." satırı + **"Sonraya bırak" beam dolgulu birincil** olmalı |
| **error** | Uçak modu aç, sonra Champion'a gel | "İzleme seçenekleri yüklenemedi." + **"Tekrar dene"** birincil. **"Sonraya bırak" YÜKSELMEMELİ** |

> ⚠️ **`empty` Türkiye'de SIK çıkacak** — TMDB'nin TR katalog verisi ABD'ye
> göre seyrek. Bu bir ürün hatası değil, veri gerçeği. Sonucu: `provider_clicked`
> oranı TR'de düşük görünecek ve bu K-20 köprüsünün başarısızlığı olarak
> okunmamalı. G-4 ve R-06 yorumlarında hesaba katılacak (borç kaydı açıldı).

**Sheet çakışması (ayrı test):**
1. Taze bir gauntlet bitir (auth istemi gelecek bir hesapla).
2. Champion belirir belirmez **hemen** "Nerede izlenir"e dokun (1.8s'den önce).
3. **Bak:** auth/bildirim sheet'i **gelmemeli**.
4. Sheet'i kapat. **Bekle:** istem şimdi **açılmalı** (kuyruktan).

**Dokunma hedefi:** sheet'teki logolara kenarından dokun — 44pt hedef, 36pt logo.

**Geri alma:** `git revert 81f6b34` (C2b token'ı `3abf2d2`'de kalır, kullanılmayan token zararsız).

### 5 · `d508cec` — C7 + C5: w780 + siyah bekleme

**Kodla doğrulanan:** typecheck 14 · eslint 0 hata · `deno test tests/gauntlet/posterUrl.test.ts` → **15 passed**.

**Cihazda:**
1. **Normal ağ.** Son turu oyna. **Bak:** kara boşluk 120+400ms, poster yumuşak
   belirsin. Poster **ani belirmemeli**, önce siyah olmalı.
2. **Yavaş ağ (opsiyonel).** Ayarlar → Geliştirici → Network Link Conditioner
   *(Xcode olmadan görünmeyebilir)*. Görünmüyorsa: zayıf hücresel sinyal veya
   **Düşük Veri Modu**. Hiçbiri yoksa **bu testi atla** — kod 1,5s üst sınırını
   zaten garantiliyor, yavaş ağ yalnız onu gözle doğrulamak için.
   **Bak:** siyah **uzuyor** ama **1,5 saniyeyi geçmiyor**; sonra poster geliyor.
3. **Keskinlik.** Champion posterini before görüntüsüyle karşılaştır — daha net olmalı (w500 → w780).

⚠️ **C5'in zamanlama kanıtı ekran kaydıyla alınacak** — kod analizi imza anın
korunduğunu kanıtlayamaz (K-57).
⚠️ K-42 offline fallback dalı: development build'de Expo Go kısıtı **geçerli
değil**. Yine de E-11'in asıl bulgusu durabilir — uçak modunda JS bundle
Metro'dan yüklenemezse senaryo yine ölçülemez. **Bu turda zorlanmayacak.**

### 6 · `5419586` — C8 + isStale

**Kodla doğrulanan:** typecheck 14 · eslint 0 hata · kademe saf fonksiyon
(aynı başlık her cihazda aynı boyut).

Kademe: **>35 kr → 28pt · >25 kr → 32pt · diğer → 40pt**, en fazla 3 satır.

**Cihazda:**
1. Kısa başlık ("Colony", 6 kr) → **40pt**, tek satır.
2. Orta ("The Trial of the Chicago 7", 26 kr) → **32pt**.
3. Uzun — havuzdaki en uzunu: *"Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb"* (68 kr) → **28pt, en fazla 3 satır, taşma yok**.
4. **VoiceOver** aç, başlığa odaklan → **tam başlık** duyulmalı (görsel kısaltma bilgi eksiltmez).
5. **isStale:** uçak modu aç, uygulamayı kapat-aç → dünün champion'ı gelirse
   üstte "Bu bugünün listesi değil" uyarısı **görünmeli**.

### 7 · `da83d52` — C4: Spotlight bonus kartı

**Kodla doğrulanan:** typecheck 14 · eslint 0 hata · parite 1359/1359 ·
mor tek yerde (3pt kenar, `GAME_THEMES.spotlight.accent`'ten).

**Small iPhone bütçesi (hesaplandı, 375×667):**

| | pt |
|---|---|
| insetLayer | 647 |
| Bonus kartı | 58 |
| ChampionReveal'a kalan | 589 |
| ChampionReveal içeriği | 538,5 |
| **Pay** | **50,5** |

→ **Birincil eylem güvende**: merkez bloğun içinde, 50,5pt payla. Kart merkez
bloğun **dışında**, altında — birincil eylemi aşağı itmiyor.

**Cihazda:**
1. Champion'a gel. **Bak:** "Bugünün bonusu / Spotlight" kartı en altta.
2. Karta dokun → `app/games/spotlight` açılmalı. Geri dön → Champion **aynı** (K-22).
3. **Bak:** mor yalnız ince kenar çizgisinde; metinler bone/smoke.
4. **Small iPhone'da:** "Nerede izlenir" butonu **kaydırmadan** görünüyor mu?

---

## 3. Yapılamayanlar

| Madde | Neden |
|---|---|
| **C3** ikon ailesi | **Koşul sağlanmadı.** Champion ağacında (ChampionReveal + WatchProvidersSheet + Primary/QuietAction) ikon ailesi **sıfır**. Gauntlet ağacında **tek** aile var: `PosterTile/index.tsx:15` Ionicons (`film-outline`, poster yer tutucusu). Aynı ekranda ikinci aile olmadığı için madde düştü |
| **G4b tab bar payı** | `expo-router/unstable-native-tabs` `BottomTabBarHeightContext` sağlamıyor; JS API'si yok. `styles.insetLayer` içinde tek satır `TODO(measure)` bırakıldı. Sabah probe ölçümüne bağlı |
| **G10 dedupe** | Talimat gereği dokunulmadı — sabah unmount ölçümüne bağlı |
| **C5 zamanlama kanıtı** | Ekran kaydı gerekiyor |

---

## 4. Beklenmeyen bulgular

1. **`LanguageContext` başlığı yanlıştı.** *"Kayıtlı tercih yoksa cihaz diline
   göre 'en' veya 'tr' seçer"* diyordu ama kod **koşulsuz `'en'`** seçiyor.
   Başlık gerçeğe uyduruldu; **davranış değiştirilmedi** — varsayılan dilin
   cihazdan gelip gelmeyeceği bir ürün kararı ve C2c'nin kapsamı değil.
   *(Karar gerekiyor.)*

2. **`fetchMovieWatchProviders` iki farklı durumu tek `null`'a eziyordu.**
   C2e için ayrımlı `fetchWatchProvidersResult()` eklendi; eski fonksiyon
   silinmedi, ince sarmalayıcı oldu — `app/film/[id].tsx` etkilenmedi.

3. **`app/film/[id].tsx` hâlâ sabit `'US'`.** Aynı film iki ekranda farklı
   sağlayıcı gösterebilir. Kapsam dışıydı, dokunulmadı. *(Borç veya sonraki tur.)*

4. **`tests/gauntlet` `tsconfig` exclude'una eklenmesi gerekti** — mevcut Deno
   test klasörleri (`tests/game-system`, `tests/identity`) zaten hariçti.
   Pre-commit hook bunu yakalayıp ilk denemede commit'i **reddetti**; hook doğru çalıştı.

5. **C8'in 32/28 değerleri tip ölçeğinde yok** (`display-l`=30, `display-m`=22).
   C8 bu üç değeri açıkça kilitlediği için ölçekten bilinçli sapıldı, gerekçe
   `ChampionReveal/styles.ts` içinde yazılı.

---

## 5. Riskli commit'ler — geri alma

```bash
# Tek tek (en riskliden):
git revert 81f6b34      # C2 + C2e (birincil eylem + sheet)
git revert 4c895b3      # G4b + G11 (kabuk) — üstüne 4 commit yazıldı, çakışabilir

# Gece zincirinin tamamı (ters sırayla):
git revert da83d52 5419586 d508cec 81f6b34 4c895b3 3abf2d2 b28e96e
```

---

## 6. Sabah ilk 10 dakika — önerilen sıra

Probe hâlâ ağaçta; **önce onu kullan**, sonra kaldır.

**Adım 0 — ön koşul:** development build telefonda mı? Değilse önce
`eas build --profile development:device --platform ios` başlat; Developer Mode
açık ve hesaba giriş yapılmış olmalı. (Ben build başlatmıyorum.)

1. **(2 dk) Probe ölçümü.** `npx expo start --dev-client` → Home → kartın ekran görüntüsü.
   `ALT BOSLUK` değeri G4b'nin tab bar kararını çözer. Champion'da ikinci bir
   görüntü daha al (değer değişiyor mu).

2. **(2 dk) Gauntlet turu — en ucuz regresyon kapısı.**
   Yüzde yok · 3 segment + "1/3" · bağlam çubuğu **tek satır** · ölü bant gitti mi ·
   ContextBar Dynamic Island'ın altında mı · zemin sıcak mı (before ile aynı).

3. **(2 dk) G10 ölçümü.** Tur 2'de Profile'a geç, dön. Aynı tur mu?
   PostHog Live'da `gauntlet_viewed`/`gauntlet_started` **tekrar geldi mi?**
   → "hayır" ise G10 düşer, "evet" ise dedupe Commit 8'e girer.

4. **(3 dk) Champion — kara boşluk + birincil eylem.**
   Sızma kara boşlukta kapalı mı, posterle mi geliyor · "Nerede izlenir"
   birincil mi · sheet açılıyor mu · başlık kademesi.

5. **(1 dk) "Probe kaldır" de.** Sonra dizi kaydını temiz build üzerinden al.

**Sonra:** sonuçları getir, `after/` görüntülerini before ile aynı boyuta
indirip yan yana bakalım.
