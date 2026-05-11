# ChatGPT Asset Prompts — Chosy.ai

> Her prompt'u ChatGPT'ye (DALL-E veya GPT-4o image gen) gonderirken
> **yenilogo.png'yi referans olarak ekle** (attach image).
> Ciktiyi indirdikten sonra dosya adini ve boyutunu kontrol et.

---

## ORTAK REFERANS ACIKLAMA (her prompt'un basina kopyala)

```
I have an existing app logo: a luxurious gold/champagne colored 3D film strip curled into the letter "C" shape. The film strip has classic perforations (sprocket holes) along both edges. It has a subtle metallic sheen with warm gold tones. The style is premium, cinematic, and minimal.
```

---

## 1. icon.png (iOS App Store Icon)
**Boyut:** 1024 x 1024 px | **Format:** PNG, opak (seffaf YASAK)

```
[Referans gorseli ekle]

I have an existing app logo: a luxurious gold/champagne colored 3D film strip curled into the letter "C" shape. The film strip has classic perforations (sprocket holes) along both edges. It has a subtle metallic sheen with warm gold tones. The style is premium, cinematic, and minimal.

Recreate this exact logo as a square 1024x1024 app icon with these strict requirements:
- Solid opaque background, color #0A0A0A (near black) — NO transparency
- The gold "C" film strip centered in the canvas
- The logo should fill roughly 70% of the canvas (leave ~15% padding on each side)
- No text, no wordmark, no tagline — ONLY the film strip "C" symbol
- No extra decorative elements (no sparkles, no stars, no gradients on background)
- Maintain the exact same gold/champagne metallic color and 3D depth of the original
- Clean edges, no artifacts
- The background must be perfectly uniform #0A0A0A with zero texture or noise
- Output exactly 1024x1024 pixels, PNG format
```

---

## 2. splash-icon.png (Splash Screen)
**Boyut:** 1024 x 1024 px | **Format:** PNG, opak

```
[Referans gorseli ekle]

I have an existing app logo: a luxurious gold/champagne colored 3D film strip curled into the letter "C" shape. The film strip has classic perforations (sprocket holes) along both edges. It has a subtle metallic sheen with warm gold tones. The style is premium, cinematic, and minimal.

Recreate this exact logo as a 1024x1024 splash screen icon:
- Solid opaque background, color #0A0A0A (near black) — NO transparency
- The gold "C" film strip centered in the canvas
- The logo should fill roughly 55-60% of the canvas (slightly more padding than an app icon, since splash screens display larger)
- No text, no wordmark — ONLY the film strip "C" symbol
- No extra decorative elements
- Maintain the exact same gold/champagne metallic color and 3D perspective
- Clean, crisp rendering suitable for full-screen display
- Output exactly 1024x1024 pixels, PNG format
```

---

## 3. favicon.png (Web Favicon)
**Boyut:** 32 x 32 px | **Format:** PNG, seffaf olabilir

```
[Referans gorseli ekle]

I have an existing app logo: a luxurious gold/champagne colored 3D film strip curled into the letter "C" shape.

Create a dramatically simplified 32x32 pixel favicon version:
- At 32x32, fine details like individual sprocket holes will be lost — simplify the shape
- Keep the overall "C" curve silhouette recognizable
- Use a flat or semi-flat gold/champagne color (#D4A843 or similar warm gold)
- Background: solid #0A0A0A (near black), opaque
- The "C" shape should fill about 75-80% of the tiny canvas for maximum visibility
- No text, no extra elements
- Prioritize recognizability at tiny size over detail accuracy
- Clean anti-aliased edges
- Output exactly 32x32 pixels, PNG format
```

---

## 4. android-icon-foreground.png (Android Adaptive Icon - On Plan)
**Boyut:** 1024 x 1024 px | **Format:** PNG, SEFFAF arka plan zorunlu

```
[Referans gorseli ekle]

I have an existing app logo: a luxurious gold/champagne colored 3D film strip curled into the letter "C" shape. The film strip has classic perforations (sprocket holes) along both edges. It has a subtle metallic sheen with warm gold tones.

Create the Android adaptive icon FOREGROUND layer:
- TRANSPARENT background — this is critical, the background is a separate layer
- The gold "C" film strip centered on a transparent canvas
- IMPORTANT: Android adaptive icons crop to various shapes (circle, squircle, rounded square). The logo MUST stay within the center 66% "safe zone" — meaning at least 170px padding on every side of a 1024x1024 canvas
- The logo should fill roughly 55-60% of the canvas, well inside the safe zone
- No text, no wordmark — ONLY the film strip "C" symbol
- Maintain the gold/champagne metallic appearance and 3D depth
- No background color, no shadow on the ground — just the floating "C" on transparency
- Output exactly 1024x1024 pixels, PNG format with alpha channel
```

---

## 5. android-icon-background.png (Android Adaptive Icon - Arka Plan)
**Boyut:** 1024 x 1024 px | **Format:** PNG, opak

> Bu dosya sadece duz renk — ChatGPT'ye gerek yok, Python ile uretebiliriz.
> Ama isterseniz prompt:

```
Create a perfectly uniform solid color square image:
- Color: #0A0A0A (near-black)
- No gradients, no texture, no noise — perfectly flat solid color
- Output exactly 1024x1024 pixels, PNG format
- This will be used as the background layer for an Android adaptive icon
```

**Alternatif (Python ile aninda uret):**
```python
from PIL import Image
img = Image.new('RGB', (1024, 1024), (10, 10, 10))
img.save('android-icon-background.png')
```

---

## 6. android-icon-monochrome.png (Android Material You)
**Boyut:** 1024 x 1024 px | **Format:** PNG, seffaf arka plan

```
[Referans gorseli ekle]

I have an existing app logo: a luxurious gold/champagne colored 3D film strip curled into the letter "C" shape.

Create a monochrome/single-color version for Android 13+ Material You theming:
- TRANSPARENT background
- The "C" film strip shape rendered in pure WHITE (#FFFFFF) — no gradients, no shading, completely flat single color
- This is a silhouette/mask — Android will apply the user's theme color on top
- The shape should be a clean, simplified version of the 3D logo — flatten the perspective but keep the "C" curve and sprocket hole pattern recognizable
- Same safe zone rules as adaptive icon: logo within center 66% (min 170px padding on each side)
- No anti-aliasing gray pixels if possible — crisp white on transparent
- No text, no extra elements
- Output exactly 1024x1024 pixels, PNG format with alpha channel
```

---

## Uretim Sonrasi Kontrol Listesi

Dosyalari indirdikten sonra:

```
1. [ ] icon.png          → 1024x1024, opak, seffaf yok
2. [ ] splash-icon.png   → 1024x1024, opak
3. [ ] favicon.png       → 32x32
4. [ ] android-icon-foreground.png → 1024x1024, seffaf bg
5. [ ] android-icon-background.png → 1024x1024, duz #0A0A0A
6. [ ] android-icon-monochrome.png → 1024x1024, seffaf bg, beyaz silüet
```

Python ile boyut dogrulama:
```python
from PIL import Image
files = {
    'icon.png': (1024, 1024),
    'splash-icon.png': (1024, 1024),
    'favicon.png': (32, 32),
    'android-icon-foreground.png': (1024, 1024),
    'android-icon-background.png': (1024, 1024),
    'android-icon-monochrome.png': (1024, 1024),
}
for name, expected in files.items():
    img = Image.open(f'assets/images/{name}')
    status = 'OK' if img.size == expected else f'WRONG {img.size}'
    alpha = 'has alpha' if img.mode == 'RGBA' else 'opaque'
    print(f'{name}: {img.size} ({status}) — {alpha}')
```

---

## app.json Guncelleme (assetler hazir olduktan sonra)

icon ve splash icin `yenilogo.png` yerine dogru dosyalara gecilecek:

```json
{
  "icon": "./assets/images/icon.png",
  "splash": {
    "image": "./assets/images/splash-icon.png"
  },
  "web": {
    "favicon": "./assets/images/favicon.png"
  },
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/images/android-icon-foreground.png"
    }
  }
}
```
