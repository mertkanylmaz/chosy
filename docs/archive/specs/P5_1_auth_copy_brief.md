# P5.1 Auth & Identity — CMO Copy Brief

> Sprint A gorevi. EN + TR ciftleri gerekli. Tum copy'ler locales/en.json ve locales/tr.json'a eklenecek.
> Brand voice: Warm, cinematic, slightly playful. "Your mood, your movies."

---

## Gerekli Copy Listesi

### 1. Sign-In Screen (`auth.*` key namespace)

| Key | Context | Max Length | Notes |
|-----|---------|------------|-------|
| `auth.welcomeTitle` | Baslik — Lumi altinda | 30 char | Hook, merak uyandirici |
| `auth.welcomeSubtitle` | Alt baslik — ne yapacagini anlatan | 80 char | Deger onerisi, 1 cumle |
| `auth.signInApple` | Apple butonu metni | 25 char | "Continue with Apple" pattern |
| `auth.signInGoogle` | Google butonu metni | 25 char | "Continue with Google" pattern |
| `auth.skipAnonymous` | Hesapsiz devam linki | 35 char | Dusuuk baski, yonlendirici |
| `auth.skipNote` | Skip altinda kucuk not | 60 char | Neden hesap olusturmali — kayip riski |

### 2. Profile Setup — Username (`setup.*` key namespace)

| Key | Context | Max Length | Notes |
|-----|---------|------------|-------|
| `setup.usernameTitle` | Baslik — username girisi | 25 char | Sicak, kisisel |
| `setup.usernameSubtitle` | Aciklama | 60 char | Ne icin kullanilacak |
| `setup.usernamePlaceholder` | Input placeholder | 20 char | Ornek kullanici adi |
| `setup.usernameError` | Validation hatasi | 40 char | Min 2 karakter, harf/sayi |

### 3. Profile Setup — Avatar (`setup.*` key namespace)

| Key | Context | Max Length | Notes |
|-----|---------|------------|-------|
| `setup.avatarTitle` | Baslik — avatar secimi | 25 char | Eglenceli, davetkar |
| `setup.avatarSubtitle` | Aciklama | 50 char | "Seni temsil etsin" vibes |
| `setup.changeLater` | Grid altinda kucuk not | 35 char | "Daha sonra degistirebilirsin" |
| `setup.continue` | Devam butonu | 15 char | CTA, action-oriented |
| `setup.complete` | Tamamlanma mesaji | 40 char | Kutlama + yonlendirme |

### 4. Profile Header Updates (`profile.*` key namespace)

| Key | Context | Max Length | Notes |
|-----|---------|------------|-------|
| `profile.personaPlaceholder` | Arketip badge placeholder | 25 char | "Testi coz" / "Discover your type" |
| `profile.editProfile` | Duzenle butonu | 15 char | Minimal |
| `profile.memberSince` | Uyelik tarihi | 20 char | "Since {date}" pattern |

---

## Ton Rehberi (Bu Sprint icin)

- **Sign-in:** Sicak ama profesyonel. Kullanici kendini ozel hissetmeli. Film/sinema metaforu kullanilabilir.
- **Setup:** Oyunsu, hafif. "Merhaba sinefil!" vibes. Baskici degil.
- **Profile:** Premium, kisa. Badge placeholder merak uyandirmali — "Hangi sinefil arketipisin?"

## Ornek Referanslar (yalnizca ilham)
- Bumble: "Make the first move"
- Letterboxd: "Your life in film"
- Spotify Wrapped: "Your year in music"

## Deliverable
- `locales/en.json` icin EN key-value cifltleri
- `locales/tr.json` icin TR key-value ciftleri
- Her iki dosyaya eklenmesi gereken tum key'ler bu dokumanda listelenmiistir
