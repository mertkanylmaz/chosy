# Claude Code UI/UX Prompting Cheat Sheet — MoodFlix

## Altın Kural
Claude Code'a tasarım tarif ederken şu formülü kullan:

**[Komponent] + [Referans App] tarzı + [Layout detayı] + [Renk/Stil] + [Davranış]**

---

## Hazır Prompt Şablonları

### Yeni Ekran Oluştururken:
```
"[Ekran adı] ekranını oluştur.
Layout: [üstte/altta/ortada ne var açıkla]
Referans: [Netflix/Spotify/Tinder/Letterboxd] tarzı
Renk: design-tokens.md dosyasındaki paleti kullan
Komponentler: [hangi mevcut komponentleri kullanacak]
Data: [nereden geliyor — Supabase RPC, local state, vs.]"
```

### Mevcut Komponenti Güncellerken:
```
"[Dosya yolu] dosyasındaki [komponent adı]'nı güncelle:
- [Değişiklik 1: ne → ne olacak]
- [Değişiklik 2: ne → ne olacak]
design-tokens.md'deki [ilgili token]'ları kullan.
Mevcut props ve API'yi bozmadan yap."
```

### Animasyon/Etkileşim Eklerken:
```
"[Komponent]'e şu etkileşimi ekle:
- Tetikleyici: [hangi gesture/event]
- Animasyon: [ne hareket edecek, nereye]
- Süre: [ms]
- Easing: [ease-out/spring/linear]
- Haptic: [light/medium/heavy/none]
react-native-reanimated kullan."
```

---

## Referans App Kılavuzu

Claude Code bu app'lerin tasarımlarını bilir, direkt referans verebilirsin:

| Söylediğin | Claude Code'un Anlayacağı |
|---|---|
| "Netflix tarzı" | Koyu bg, yatay scroll listeleri, büyük hero image |
| "Tinder tarzı" | Kart stack, swipe mekanik, overlay ikonları |
| "Spotify tarzı" | Gradient header, compact list items, bottom sheet |
| "Letterboxd tarzı" | Film poster grid, rating stars, yeşil accent |
| "Instagram Stories tarzı" | Üst kısım yatay circles, tap ile ileri/geri |
| "Apple Music tarzı" | Blur efektler, büyük artwork, fluid animasyonlar |
| "TikTok tarzı" | Full-screen vertical feed, overlay UI, snap scroll |

---

## Sık Kullanacağın Komponent Tarifleri

### Kart (Film):
"3:4 poster üstte, altta gradient overlay ile film adı (bold beyaz),
altında year • rating • genre satırı (gri, küçük).
Kart bg zinc-900, rounded-2xl, shadow-lg."

### Bottom Sheet:
"Ekranın altından %60 yüksekliğinde açılan bottom sheet.
Üstte drag handle (40px gri çizgi), başlık, içerik scroll.
Arka plan blur + koyu overlay. Gesture ile aşağı kapatılır."

### Chip/Tag:
"Pill şeklinde (full radius), padding horizontal 12 vertical 6.
Aktif: violet-500 bg beyaz text. Pasif: zinc-800 bg zinc-400 text.
Yan yana horizontal scroll, gap 8px."

### Stat Card:
"zinc-900 bg, rounded-xl, padding 24.
Üstte büyük rakam (violet-500, 24px bold).
Altta label (zinc-500, 11px, uppercase)."

---

## Prompt'a Eklenmesi Gereken Dosya Yolları

Claude Code dosya yollarını bilirse çok daha iyi çalışır:

```
"src/components/SwipeCard.tsx dosyasını güncelle..."
"src/screens/HomeScreen.tsx'e yeni bir section ekle..."
"src/theme/colors.ts'deki renkleri design-tokens ile eşitle..."
"src/navigation/BottomTabs.tsx'deki tab ikonlarını değiştir..."
```

---

## Hata Çıktığında

Layout/stil beklediğin gibi değilse:
```
"Şu an [komponent] böyle görünüyor: [sorun açıkla].
Beklediğim: [nasıl olmalı].
Muhtemel sorun: [padding/margin/flex/position/zIndex olabilir].
Düzelt ve değişiklikleri açıkla."
```

---

## NativeWind (Tailwind RN) Quick Reference

MoodFlix'te NativeWind kullanıyorsan bu class'ları sık kullanacaksın:

```
Arka planlar:  bg-zinc-950, bg-zinc-900, bg-zinc-800
Textler:       text-zinc-50, text-zinc-400, text-zinc-500
Accent:        bg-violet-500, text-violet-500
Radius:        rounded-lg (16), rounded-2xl (24), rounded-full
Spacing:       p-4, px-6, py-3, gap-2, gap-4
Flex:          flex-1, flex-row, items-center, justify-between
Shadow:        shadow-lg, shadow-2xl
```
