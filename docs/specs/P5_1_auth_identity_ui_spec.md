# P5.1 Auth & Identity — CDO UI Spec

> Sprint A gorevi. Bu spec CTO'nun implement etmesi icin referans olacak.
> Tasarim dili: "Premium Bumble" — DESIGN_SYSTEM.md'deki token'lar kullanilacak.

---

## 1. Sign-In Screen (`app/auth.tsx` — yeni)

### Layout
- Tam ekran, `bg-primary` (#0A0A0A) arka plan
- Ust %40: Lumi orb animasyonu (mevcut component) + app logo/isim
- Orta: Kisa tanitim copy'si (CMO'dan gelecek)
- Alt %30: Auth butonlari + skip/anonymous link

### Auth Butonlari
- **Apple Sign-in:** Beyaz arka plan, siyah Apple logosu + "Apple ile Devam Et" / "Continue with Apple"
  - Yukseklik: 52px, radius-lg (16px), full width (padding-md her iki yandan)
  - Font: Inter SemiBold 16px, #000000
- **Google Sign-in:** `bg-card` (#18181B) arka plan, Google logosu (renkli) + "Google ile Devam Et"
  - Ayni boyutlar, `text-primary` (#FAFAFA) renk
  - `cardBorder` (rgba(139,92,246,0.15)) border
- Butonlar arasi: spacing-md (16px)
- Butonlarin altinda: "Hosgeldin mesaji" — text-tertiary, Caption (12px)

### Anonymous Skip Link
- Butonlarin 24px altinda
- "Hesap olusturmadan devam et" — text-tertiary, underline, Caption
- Bu mevcut `signInAnonymously()` akisini tetikler

### Animasyon
- Lumi orb: mevcut idle animasyonu
- Auth butonlari: staggered fade-in (150ms aralik)
- Basarili auth sonrasi: Lumi happy state + 500ms bekle → navigate

---

## 2. Post-Auth Onboarding — Username & Avatar (`app/setup-profile.tsx` — yeni)

### Layout
- `bg-primary` arka plan, SafeArea
- Progress indicator: 2 dot (adim 1: username, adim 2: avatar), accent-primary aktif dot
- Her adim arasi swipe veya "Devam" butonu

### Adim 1: Username
- Baslik: "Seni nasil taniyalim?" — H1 (Inter Bold 24px), text-primary
- Alt baslik: text-secondary, Body (14px)
- Input field:
  - `inputBg` arka plan, `inputBorder` border (violet tint)
  - Placeholder: text-tertiary
  - Focus state: `accent-primary` border (tam opak)
  - Yukseklik: 52px, radius-md (12px), padding-md
  - Font: Inter Regular 16px
- Karakter limiti: 20 karakter, sag alt kose counter (text-tertiary, Caption)
- Validation: min 2 karakter, sadece harf/sayi/underscore

### Adim 2: Avatar Secimi
- Baslik: "Bir avatar sec" — H1, text-primary
- 4x3 grid (12 emoji preset — mevcut AVATAR_OPTIONS kullanilacak)
  - Her bir emoji: 64x64px daire, `bg-card` arka plan
  - Secili: `accent-primary` border (2px), scale(1.1), `accentDim` arka plan
  - Font: 32px emoji
  - Gap: spacing-md (16px)
- Grid alti: "Daha sonra degistirebilirsin" — text-tertiary, Caption

### Devam Butonu
- Sabit alt bar (paddingBottom: 83 + spacing-lg)
- Full width, 52px yukseklik, radius-lg
- Aktif: accent-primary arka plan, text-on-accent, Inter SemiBold 16px
- Pasif (validation fail): %30 opacity, disabled
- Animasyon: scale(0.97) press + haptic light

### Tamamlanma
- Username + avatar Supabase `users` tablosuna kaydedilir
- Navigasyon: `(tabs)` — mevcut onboarding flow'u atlanir (ONBOARDING_KEY set edilir)

---

## 3. Profile Header Yenileme (profile.tsx — mevcut guncellenecek)

### Mevcut → Yeni Degisiklikler
- Avatar: Emoji placeholder → secilen avatar (buyuk, 72px daire)
  - `bg-card` arka plan, `accent-primary` border (2px)
  - Bos ise: varsayilan emoji (🎬)
- Username: "Sinefil #1234" → gercek username
  - H2 (Inter SemiBold 20px), text-primary
  - Altinda: text-tertiary Caption ile user ID veya join date
- **Persona Badge (Placeholder):**
  - Username'in altinda, pill shape
  - `goldDim` arka plan, `gold` border (1px), `gold` text
  - Ikon (sol): ✦ veya ilgili arketip ikonu
  - Text: "Arketip Bekleniyor" / "Take Persona Test" (P5.2'de gercek arketiple degisecek)
  - Boyut: Auto-width, 28px yukseklik, radius-full
  - Font: Inter SemiBold 11px
- Header gradient: mevcut profileHeaderStart → profileHeaderEnd korunur
- Edit butonu: sag ust, Ionicons "create-outline", text-secondary, 20px

### Animasyon
- Avatar: fade-in + scale (0.8→1.0), 300ms spring
- Badge: slide-up + fade-in, 150ms sonra baslar

---

## 4. Genel Notlar

### Responsive
- iPhone SE (375px) → iPhone 15 Pro Max (430px) araligihe uyumlu
- Input ve butonlar horizontal padding ile esnek
- Avatar grid: 4 sutun sabit, item boyutu esnek

### Erisilebilirlik
- Tum butonlarda accessibilityLabel
- Input'ta accessibilityHint
- Touch target: minimum 44px
- Auth butonlarinda role="button"

### Dark Mode
- Sadece dark mode — bg-primary (#0A0A0A) her zaman

### i18n
- Tum metin key'leri t() ile sarilacak
- Key'ler CMO'dan gelecek: `auth.signInApple`, `auth.signInGoogle`, `auth.skipAnonymous`, `setup.usernameTitle`, `setup.avatarTitle`, `setup.continue`, `setup.changeLater`, `profile.personaPlaceholder`
