# Auth Screens QA Fix Spec

> CDO Design QA raporu. auth.tsx + setup-profile.tsx CDO spec'siz build edildi.
> Bu dokuman CTO'nun fix uygulamasi icin referans.

---

## Kapsam

| Dosya | Ekran |
|-------|-------|
| `app/auth.tsx` | Apple/Google giris + misafir devam |
| `app/setup-profile.tsx` | Kullanici adi + avatar secimi |

---

## Critical Fixler (Merge Blocker)

### FIX-1: PlayfairDisplay Kaldirma — auth.tsx title

**Sorun:** `styles.title` stilde `fontFamily: 'PlayfairDisplay_700Bold'` hardcoded. Auth welcome title bir film title'i degil — design system kurali ihlal ediliyor.

**Kural:** PlayfairDisplay YALNIZCA film detail title + rating number icin kullanilir.

**Cozum:**
```typescript
// ONCE (YANLIS)
title: {
  fontFamily: 'PlayfairDisplay_700Bold',
  fontSize: 30,
  color: Colors.textWhite,
  textAlign: 'center',
  marginBottom: Theme.spacing.sm,
},

// SONRA (DOGRU)
title: {
  ...Theme.typography.h1,          // Inter Bold 24
  fontSize: 28,                     // override — ekran basligi biraz buyuk
  color: Colors.textWhite,
  textAlign: 'center',
  marginBottom: Theme.spacing.sm,
},
```

---

### FIX-2: PlayfairDisplay Kaldirma — setup-profile.tsx title

**Sorun:** Ayni ihlal. `styles.title` stilde `fontFamily: 'PlayfairDisplay_700Bold'` hardcoded.

**Cozum:**
```typescript
// ONCE (YANLIS)
title: {
  fontFamily: 'PlayfairDisplay_700Bold',
  fontSize: 30,
  color: Colors.textWhite,
  marginBottom: Theme.spacing.sm,
  lineHeight: 38,
},

// SONRA (DOGRU)
title: {
  ...Theme.typography.h1,          // Inter Bold 24
  fontSize: 28,                     // override
  color: Colors.textWhite,
  marginBottom: Theme.spacing.sm,
  lineHeight: 36,
},
```

---

### FIX-3: Avatar Hardcoded Hex → Design Token Mapping

**Sorun:** `AVATARS` dizisinde 12 renk dogrudan hex string. Proje kurali: "Design tokens from Colors.ts — no hardcoded hex."

**Cozum — token eslestirme:**

```typescript
const AVATARS: AvatarOption[] = [
  { id: '1',  emoji: '🎬', color: Colors.accentPrimary },  // Yonetmen — violet
  { id: '2',  emoji: '🌙', color: Colors.swipeDown },      // Gece kusu — blue
  { id: '3',  emoji: '🔥', color: Colors.error },           // Aksiyon — red
  { id: '4',  emoji: '🏆', color: Colors.gold },            // Odul avcisi — gold
  { id: '5',  emoji: '🚀', color: Colors.swipeDown },       // Sci-fi — blue (ayni token, farkli anlam)
  { id: '6',  emoji: '👻', color: Colors.bgSubtle },        // Korku — zinc-700
  { id: '7',  emoji: '🌿', color: Colors.success },         // Drama — green
  { id: '8',  emoji: '⚡', color: Colors.warning },          // Gerilim — amber
  { id: '9',  emoji: '🎭', color: Colors.accentHover },     // Tiyatro — violet-600
  { id: '10', emoji: '❄️', color: Colors.swipeDown },       // Sakin — blue
];
```

**Token'siz kalanlar:** Pink (#EC4899) ve amber-700 (#B45309) icin Colors.ts'te token yok.

**Karar gereken 2 avatar:**
- `🌸 Romantik` — pink (#EC4899): Yeni token `Colors.pink` eklenebilir VEYA bu avatar `Colors.error` (yakin kirmizi) ile degistirilir. **CDO onerisi: yeni token ekle** → `Colors.pink: '#EC4899'`
- `🐉 Fantezi` — amber-700 (#B45309): `Colors.goldDark` (#B8922E) en yakin token. **CDO onerisi: `Colors.goldDark` kullan.**

**Son avatar listesi (2 yeni karar dahil):**

```typescript
const AVATARS: AvatarOption[] = [
  { id: '1',  emoji: '🎬', color: Colors.accentPrimary },  // violet
  { id: '2',  emoji: '🌙', color: Colors.swipeDown },      // blue
  { id: '3',  emoji: '🔥', color: Colors.error },           // red
  { id: '4',  emoji: '🌸', color: Colors.pink },            // pink (YENi TOKEN)
  { id: '5',  emoji: '🏆', color: Colors.gold },            // gold
  { id: '6',  emoji: '🚀', color: Colors.swipeDown },       // blue (cyan yerine)
  { id: '7',  emoji: '👻', color: Colors.bgSubtle },        // zinc-700
  { id: '8',  emoji: '🌿', color: Colors.success },         // green
  { id: '9',  emoji: '⚡', color: Colors.warning },          // amber
  { id: '10', emoji: '🎭', color: Colors.accentHover },     // violet-600
  { id: '11', emoji: '🐉', color: Colors.goldDark },        // amber-dark
  { id: '12', emoji: '❄️', color: Colors.swipeDown },       // blue
];
```

**Gerekli Colors.ts eklentisi:**
```typescript
/** Pink — romantic/decorative accent */
pink: '#EC4899',
```

> NOT: 3 avatar ayni `Colors.swipeDown` (#3B82F6) kullanir (ay, roket, kar). Farkli mavi tonlari isteniyorsa `Colors.swipeDown` yerine yeni token (`Colors.cyan`, `Colors.sky`) eklenebilir. CDO olarak suan kabul edilebilir — hepsi "blue family" ve avatar emojileri zaten farklilik sagliyor.

---

## Medium Fixler

### FIX-4: Back Button Touch Target — auth.tsx

**Sorun:** `backButton` stilde `width: 40, height: 40`. Minimum touch target 44px.

**Cozum:**
```typescript
backButton: {
  // ...
  width: 44,
  height: 44,
  // geri kalan ayni
},
```

---

### FIX-5: Hardcoded #FFFFFF → Token — setup-profile.tsx

**Sorun:** Avatar selectedBadge icindeki checkmark icon rengi `color="#FFFFFF"` hardcoded.

**Cozum:**
```tsx
// ONCE
<Ionicons name="checkmark" size={9} color="#FFFFFF" />

// SONRA
<Ionicons name="checkmark" size={9} color={Colors.textOnAccent} />
```

---

### FIX-6: Skip Text Typography Hybrid — auth.tsx

**Sorun:** `skipText` stilde `...Theme.typography.body` (14px regular) + `fontWeight: '600'` override. Ne body ne h3 — belirsiz state.

**Cozum — Opsiyon A (onerilen):** CTA text olarak h3 kullan.
```typescript
skipText: {
  ...Theme.typography.h3,           // Inter SemiBold 16
  color: Colors.accentPrimary,
},
```

**Cozum — Opsiyon B:** Body olarak kalsin, SemiBold ile.
```typescript
skipText: {
  ...Theme.typography.body,
  fontWeight: '600',                // explicit SemiBold
  color: Colors.accentPrimary,
},
```

CDO onerisi: **Opsiyon A** — "Explore without an account" bir CTA link'i, h3 daha uygun.

---

### FIX-7: Input Valid Border Opacity — setup-profile.tsx

**Sorun:** `Colors.success + '80'` hex suffix. Calisir ama token disinda.

**Cozum:** Kabul edilebilir pattern — hex suffix burada tolere edilir cunku `success` tokeninin opacity varyanti yok. Yorum eklemek yeterli:
```typescript
inputWrapperValid: {
  borderColor: Colors.success + '80',  // 50% opacity — success token, no dim variant
},
```

---

## Minor Fixler (Nice to Have)

### FIX-8: Gereksiz fontWeight Duplicate — setup-profile.tsx

**Sorun:** `continueButtonText` stilde `...Theme.typography.h3` (zaten `fontWeight: '600'`) + ayrica `fontWeight: '600'`.

**Cozum:**
```typescript
continueButtonText: {
  ...Theme.typography.h3,
  color: Colors.textOnAccent,
  // fontWeight: '600' kaldırildi — h3 zaten SemiBold
},
```

---

### FIX-9: LinearGradient Opacity Token — auth.tsx

**Sorun:** `Colors.accentPrimary + '28'` — 16% violet. `Colors.accentDim` 12% violet saglar.

**Cozum:** Fark minimal (12% vs 16%). Glow efekti icin 16% uygun olabilir — degistirme zorunlu degil. Yorum ekle:
```typescript
colors={[Colors.accentPrimary + '28', 'transparent']}  // 16% violet glow — accentDim (12%) yerine bilinçli karar
```

---

## Uygulama Sirasi

| Sira | Fix | Dosya | Zorluk |
|------|-----|-------|--------|
| 1 | FIX-1 | auth.tsx | 1 satir |
| 2 | FIX-2 | setup-profile.tsx | 1 satir |
| 3 | FIX-3 | setup-profile.tsx + Colors.ts | ~15 satir + 1 yeni token |
| 4 | FIX-4 | auth.tsx | 2 satir |
| 5 | FIX-5 | setup-profile.tsx | 1 satir |
| 6 | FIX-6 | auth.tsx | 1 satir |
| 7 | FIX-7 | setup-profile.tsx | yorum |
| 8 | FIX-8 | setup-profile.tsx | 1 satir sil |
| 9 | FIX-9 | auth.tsx | yorum |

**Tahmini sure:** ~15 dakika (test dahil)

---

## QA Checklist (Fix Sonrasi)

- [ ] Hicbir PlayfairDisplay auth/setup ekranlarinda kalmadi
- [ ] AVATARS dizisinde hardcoded hex yok (Colors.xxx)
- [ ] Colors.ts'e `pink` tokeni eklendi
- [ ] Back button >= 44px touch target
- [ ] Hardcoded `#FFFFFF` kalmadi
- [ ] iPhone SE layout kirilmasi yok (avatar grid, input, butonlar)
- [ ] iPhone 15 Pro Max layout kirilmasi yok
- [ ] Keyboard acikken setup-profile scroll/input gorunurlugu OK
- [ ] Dark mode only — beyaz/acik arka plan yok
