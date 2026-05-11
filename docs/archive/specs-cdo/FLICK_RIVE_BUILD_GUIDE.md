# Flick .riv Build Guide — Rive Editor Step-by-Step

**Hedef:** `assets/flick/flick.riv` dosyasini olusturmak
**Arac:** [rive.app](https://rive.app) (ucretsiz hesap yeterli)
**Tahmini sure:** 2-4 saat (deneyime gore)
**Referans spec:** `.claude/specs/FLICK_MASCOT_SPEC.md`

---

## Neden .riv Kodla Olusturulamaz?

Rive dosyalari binary format — Figma'nin .fig dosyasi gibi. Icinde bezier path'ler, bone rigging, timeline keyframe'ler ve state machine graph'i var. Bunlar gorsel editorde cizilir, export edilir. Rive'in CLI'i yok, SDK'si sadece runtime (oynatma) icin.

**Alternatifler:**
1. rive.app'te kendin ciz (bu rehber)
2. Fiverr/Upwork'ten Rive animator'u tut (~$50-150)
3. Rive Community'den benzer asset bul, modifiye et

---

## Adim 1: Yeni Dosya Olustur

1. [rive.app](https://rive.app) → Sign in → New File
2. Artboard adi: `FlickMain`
3. Artboard boyutu: **256 x 256 px**
4. Background: **Transparent** (sag panelde Background → opacity 0)

---

## Adim 2: Karakter Cizimi (Design Mode)

### 2A. Body Layer
1. Yeni grup olustur: `Body`
2. **Govde:** Ellipse tool → 140x100px, merkeze yerles, y offset +30 (asagida)
   - Fill: `#7C3AED` (Colors.accentHover)
   - Stroke: 2px `#8B5CF6` (Colors.accentPrimary)
3. **Kafa:** Ellipse → 120x110px, merkezde, y offset -20 (yukarida)
   - Fill: `#7C3AED`
   - Stroke: 2px `#8B5CF6`
4. **Sol kulak:** Pen tool → ucgen, uc noktasi (80,30), (95,70), (105,35)
   - Fill: `#7C3AED`
   - Ic kulak (kucuk ucgen): Fill `#8B5CF6` opacity 60%
5. **Sag kulak:** Sol kulagi mirror et (x ekseni)
6. Boolean union: kafa + govde + kulaklar → tek path

### 2B. Eyes Layer
1. Yeni grup: `Eyes`
2. **Sol goz disi:** Ellipse → 36x28px, konum (-22, -25) (kafanin icinde)
   - Fill: `#FAFAFA` (beyaz sclera)
3. **Sol iris:** Ellipse → 20x20px, goz merkezinde
   - Fill: `#D4A843` (Colors.gold)
4. **Sol pupil:** Rectangle → 8x18px, iris merkezinde, radius 4
   - Fill: `#0A0A0A` (Colors.bgPrimary) — dikey kedi pupili
5. **Sol highlight:** Ellipse → 6x6px, sag ust kose
   - Fill: `#F0D78C` (Colors.goldLight)
6. Tum sol goz elementlerini grupla → `LeftEye`
7. Sag goz: `LeftEye` grubunu duplicate → mirror x → `RightEye`
8. **Goz kapagi** (her goz icin): Rectangle, goz boyutunda, gozun ustunde
   - Fill: `#7C3AED` (govde rengiyle ayni — kapali gorunmesi icin)
   - Baslangic konumu: gozun USTUNDE (gorunmez)
   - Animasyonda asagi kaydirilarak goz kapatilir

### 2C. Tail Layer
1. Yeni grup: `Tail`
2. **Ana kuyruk:** Pen tool → S-seklinde bezier path
   - Baslangic: govdenin sag alt (130, 120)
   - Kontrol noktalari: saga kivrilan yaklasik 3 nokta
   - Bitis: (200, 60) civarinda, yukari kivrilan uc
   - Stroke: 12px `#8B5CF6` (Colors.accentPrimary)
   - Cap: Round
3. **Film kareleri (perforation):** Kuyruk boyunca 6-8 kucuk kare
   - Her kare: 4x4px Rectangle
   - Fill: `#27272A` (Colors.bgElevated)
   - Kuyrugun her iki yaninda, esit aralikli
   - Bunlari kuyruk grubuna child yap (kuyrukla birlikte hareket etsin)

### 2D. Effects Layer
1. Yeni grup: `EffectsBack` (govdenin ARKASINDA)
   - **Glow hale:** Ellipse → 180x180px, merkez, blur
   - Fill: `#8B5CF6` opacity 12% (Colors.accentDim)
2. Yeni grup: `EffectsFront` (her seyin ONUNDE)
   - **Sparkle 1-5:** Her biri 4-kollu yildiz path (veya + seklinde rotated kare)
   - Boyut: 8px
   - Fill: `#D4A843` (Colors.gold)
   - Opacity: 0 (animasyonda fade in/out)
   - Rastgele pozisyonlar: karakterin cevresi

---

## Adim 3: Bone Rigging (Animate Mode)

### Kuyruk Bone'lari
1. Animate mode'a gec
2. Bone tool ile kuyruga 3 bone ekle:
   - `tail_base` → govde bilesim noktasinda
   - `tail_mid` → ortada
   - `tail_tip` → ucta
3. Skin binding: kuyruk path'ini bone'lara bagla
4. Test: `tail_tip` bone'unu hareket ettirince kuyruk dogal kivriliyor olmali

### Goz Expression Bones
1. Her goz kapagina 1 bone:
   - `lid_left` → sol goz kapagi y pozisyonu kontrol eder
   - `lid_right` → sag goz kapagi
2. Her pupile 1 bone:
   - `pupil_left` → sol pupil x,y pozisyonu (bakis yonu)
   - `pupil_right` → sag pupil
3. Goz boyutu icin scale constraint:
   - `eye_scale_left` → sol goz grubu scale'i
   - `eye_scale_right`

---

## Adim 4: Animasyonlar (Timeline)

Her animasyon icin: Animate mode → yeni Animation olustur.

### `idle_loop` (4s, Loop)
- Govde: scale Y 1.0→0.98→1.0→1.02→1.0 (nefes)
- Kuyruk: `tail_tip` rotation +15deg→-15deg (sinusoidal)
- Glow: opacity 0.08→0.15→0.08
- Gozler: normal acik

### `blink` (0.3s, One-shot)
- t=0.0s: goz kapaklari yukarda (acik)
- t=0.1s: kapaklari asagiya kaydir (kapali)
- t=0.2s: kapaklari geri yukari (acik)
- Not: Bu animasyon `idle_loop` uzerine blend edilecek

### `happy_burst` (0.8s, One-shot)
- t=0.0s: govde scale 1.0
- t=0.2s: govde scale 1.15 (bounce up)
- t=0.5s: govde scale 0.97 (overshoot)
- t=0.8s: govde scale 1.0
- Gozler: kapaklar asagidan kapaniyor (gulmece "^ ^")
- Kuyruk: hiz 3x (period 0.8s yerine normal 3s)
- Sparkle: 3 tanesi fade in 0→1 → fade out, staggered

### `sad_droop` (0.6s, One-shot)
- Govde: scale 1→0.95 (cokme)
- Gozler: ust kapak yari kapali (lid %50 asagi), pupil asagi bakiyor
- Kuyruk: rotation 0'a yavas don (sarkilma), sonra durma
- Glow: opacity 0.15→0.05 (kararma)

### `thinking_loop` (3s, Loop)
- Govde: rotate 0→5→-5→0 (yana sallanma)
- Gozler: pupiller saga yukari bakiyor, sol kas kalkik (sol goz %105 scale)
- Kuyruk: ritmik sallama (1.5s period, +/-10deg)
- Soru isareti efekti:
  - t=0.0s: scale 0, opacity 0 (kafanin ustunde)
  - t=0.2s: scale 1.2, opacity 1 (bounce in)
  - t=0.4s: scale 1.0
  - t=2.0s: opacity 1→0 (fade out)
  - t=2.5s: tekrar bastan

### `excited_bounce` (1s, One-shot)
- Govde translateY: 0→-20→0→-15→0→-8→0 (3 azalan ziplama)
- Her ziplama: ~0.25s
- Gozler: surprised (buyuk) → happy (gulmece)
- Kuyruk: cok hizli sallama (+/-30deg, 0.5s period)
- Sparkle: 5-8 tanesi rastgele fade in/out

### `surprised_pop` (0.8s, One-shot)
- t=0.0s: govde scale 1.0
- t=0.15s: govde scale 0.9 (geri cekilme)
- t=0.35s: govde scale 1.1 (one atilma)
- t=0.6s: govde scale 1.0
- Gozler: pupil scale 2x, goz scale 1.2x
- Kuyruk: freeze (0.2s) → hizli sallama
- Sparkle: 1 buyuk pop (scale 0→2→0, 0.5s)

### `love_hearts` (1.5s, One-shot)
- Govde: rotate 3deg (hafif one egilme, 0.3s)
- Gozler: iris yerine kalp path (pupil → kalp seklinde morph)
  - Fill: `#EF4444` (Colors.error)
- Kuyruk: uca dogru kivriliyor (kalp seklini andiran)
- Kalp efektleri (3 tane):
  - Baslangic: govde merkezinden
  - Path: bezier yukari + hafif saga/sola
  - Scale: 0→1 (0.2s)
  - Opacity: 1→0 (son 0.3s)
  - Stagger: 0.2s aralik
  - Renkler: `#EF4444`, `#D4A843`, `#EF4444`

### `sleepy_loop` (4s, Loop)
- Govde: rotate 0→8deg (sag yana yaslaniyor)
- Gozler: kapaklari %80 kapali, cok yavas acil-kapa (her 3s)
- Kuyruk: neredeyse hareketsiz (max +/-3deg)
- Glow: opacity 0.03 sabit (minimum)

### `wake_up` (0.5s, One-shot)
- Govde: rotate 8→0 (dogruluyor)
- Gozler: kapaklari aciliyor (%20 → %100)
- Kuyruk: tekrar sallama basliyor
- Bu animasyon `sleepy` → herhangi baska state gecisinde oynar

### `celebration_confetti` (2s, One-shot, Additive)
- 12 parcacik, rastgele pozisyon ve renk
- Renkler: `#8B5CF6`, `#D4A843`, `#22C55E`
- Path: yukari firlama (translateY -200) + parabolik dusme
- Rotation: her parcacik rastgele spin
- Bu animasyon ADDITIVE — mevcut state'in ustune oynar, state'i degistirmez

---

## Adim 5: State Machine

1. State Machine panelini ac → yeni State Machine: `FlickController`

### Inputs Olustur
| Input Adi | Tip | Varsayilan |
|-----------|-----|------------|
| `mood` | Number | 0 |
| `isSwiping` | Boolean | false |
| `swipeDirection` | Number | 0 |
| `celebration` | Boolean | false |

### State'ler Olustur
Her animasyona karsilik gelen state'leri ekle:
- `Idle` → `idle_loop` animasyonu, Loop
- `Happy` → `happy_burst` animasyonu, One-shot → `Idle`'a gecis
- `Sad` → `sad_droop` animasyonu, One-shot → 2s bekle → `Idle`'a gecis
- `Thinking` → `thinking_loop` animasyonu, Loop
- `Excited` → `excited_bounce` animasyonu, One-shot → `Idle`'a gecis
- `Surprised` → `surprised_pop` animasyonu, One-shot → 1s bekle → `Idle`'a gecis
- `Love` → `love_hearts` animasyonu, One-shot → `Idle`'a gecis
- `Sleepy` → `sleepy_loop` animasyonu, Loop

Ek state'ler:
- `WakeUp` → `wake_up` animasyonu, One-shot → hedef state'e gecis
- `Blink` → `blink` animasyonu, Additive layer (3-5s aralikla rastgele tetik)

### Gecis Kurallari (Transitions)

**Entry → Idle** (varsayilan)

**Any State → hedef state:**
```
mood == 0 → Idle
mood == 1 → Happy
mood == 2 → Sad
mood == 3 → Thinking
mood == 4 → Excited
mood == 5 → Surprised
mood == 6 → Love
mood == 7 → Sleepy
```

**Sleepy → WakeUp → hedef state:**
- Sleepy'den cikarken once WakeUp state'inden gec
- WakeUp bitince mood degerine gore hedef state'e git

**Celebration overlay:**
- `celebration == true` → `celebration_confetti` oynat (additive blend layer)
- `celebration == false` → konfeti durur

**Blink katmani:**
- Ayri bir blend layer'da
- 3-5s aralikla rastgele tetiklenir (Rive'in "random" range ozelligiyle)
- `Sleepy` state'inde devre disi (zaten kendi kirpma animasyonu var)

### Blend Transition Suresi
- Tum state gecisleri: **300ms** blend (yumusak gecis)
- WakeUp → hedef: **200ms** blend

---

## Adim 6: Export

1. File → Export → `.riv` format
2. Dosyayi kaydet: `flick.riv`
3. Proje klasorune kopyala: `assets/flick/flick.riv`

### Platform Entegrasyonu

**iOS (Xcode):**
- `flick.riv` dosyasini Xcode projesine ekle (Build Phases → Copy Bundle Resources)
- Expo managed workflow'da `app.json`'a asset eklemeye gerek yok — `rive-react-native` kendi buluyor

**Android:**
- `flick.riv` dosyasini `android/app/src/main/res/raw/` klasorune kopyala
- Expo managed workflow: EAS build otomatik halleder

**Expo Managed (Development Build):**
- `assets/flick/flick.riv` konumuna koy
- `app.json` veya `app.config.ts`'te asset olarak ekle:
  ```json
  "assets": ["./assets/flick/flick.riv"]
  ```

---

## Adim 7: Flick Component'te Aktiflestirme

`.riv` dosyasi yerlestirildikten sonra:

1. `components/Flick/index.tsx` ac
2. `USE_RIVE` sabitini `true` yap:
   ```typescript
   const USE_RIVE = true;
   ```
3. Development build ile test et (Expo Go desteklemez!)
4. 8 state'in her birini test et
5. celebration overlay'i test et

---

## Boyut Optimizasyonu

Hedef: < 150KB

### Kucultme Ipuclari
- Path'leri sadece gerekli kadar detayli ciz (az kontrol noktasi)
- Efekt parcaciklarini clone yerine tek asset + instance kullan
- Gereksiz keyframe'leri sil
- Sparkle/konfeti parcaciklarini minimal tut (max 5 sparkle, 12 konfeti)
- Glow icin buyuk shape yerine radial gradient kullan

### Test
- Rive editor'de sol altta dosya boyutunu gor
- 150KB'yi asarsa: once efektleri sadellestir, sonra path detayini azalt
- Minimum hedef: govde + gozler + kuyruk + idle/happy/thinking = ~60-80KB
- Tam set (8 state + efektler): ~100-140KB

---

## Kontrol Listesi

- [ ] Artboard: FlickMain, 256x256, transparent bg
- [ ] Body: violet govde + kafa + kulaklar, tek birlesik path
- [ ] Eyes: amber iris, dikey kedi pupili, highlight, kapak bone'lari
- [ ] Tail: S-seklinde, film kareleri (perforation), 3 bone
- [ ] Effects: glow (arka), sparkle + kalp + soru isareti + konfeti (on)
- [ ] 12 animasyon timeline'i olusturuldu
- [ ] State Machine: FlickController, 4 input, 8+2 state
- [ ] Tum gecis kurallari tanimli (300ms blend)
- [ ] Blink rastgele layer aktif
- [ ] Celebration additive layer aktif
- [ ] Export: flick.riv, < 150KB
- [ ] assets/flick/flick.riv konumuna kopyalandi
- [ ] USE_RIVE = true yapildi
- [ ] Development build'de 8 state test edildi
