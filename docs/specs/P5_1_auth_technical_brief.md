# P5.1 Auth & Identity — CTO Technical Brief

> Sprint A gorevi. CDO spec: `docs/specs/P5_1_auth_identity_ui_spec.md`
> CMO copy: `docs/specs/P5_1_auth_copy_brief.md` (locales/*.json'a eklenecek)

---

## Gorev Listesi (Sirayla)

### Task 1: Supabase Auth — Apple + Google Sign-in

**Paketler:**
- `expo-apple-authentication` (iOS native)
- `@react-native-google-signin/google-signin` (veya expo uyumlu alternatif)
- Mevcut `@supabase/supabase-js` zaten var

**Akis:**
1. Kullanici Apple/Google butonuna basar
2. Native auth provider'dan `idToken` alinir
3. `supabase.auth.signInWithIdToken({ provider: 'apple'|'google', token: idToken })`
4. Basarili → profile setup'a yonlendir (ilk giris) veya tabs'a yonlendir (geri donen)

**linkIdentity — Anon Migration:**
- Kullanici zaten `signInAnonymously()` ile giris yapmissa:
- `supabase.auth.linkIdentity({ provider: 'apple'|'google' })` kullan
- Bu mevcut `user_id`'yi korur, watchlist/swipe/session verileri kaybolmaz
- linkIdentity basarili olursa kullanici artik social auth ile giris yapar
- `app/_layout.tsx`'teki mevcut auth listener'i guncelle

**DB Migration (012):**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS archetype_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'anonymous';
```

**Kurallar:**
- Hardcoded user ID YASAK — her zaman `supabase.auth.getUser()`
- Mevcut anonymous auth calisir kalmali (skip butonu)
- `app/_layout.tsx` provider zincirine dokunma — sadece auth listener guncelle

---

### Task 2: Sign-In Screen (`app/auth.tsx`)

**Yeni dosya:** `app/auth.tsx`
- CDO spec'e gore layout: Lumi + butonlar + skip link
- Routing: `app/gate.tsx` veya `app/_layout.tsx`'ten yonlendirme
  - Auth durumu yoksa → `auth.tsx`
  - Auth var, profile setup tamamlanmamissa → `setup-profile.tsx`
  - Auth var, setup tamam → `(tabs)`
- Mevcut `gate.tsx` ve `entry.tsx` ile entegrasyon kontrol edilmeli

---

### Task 3: Profile Setup Screen (`app/setup-profile.tsx`)

**Yeni dosya:** `app/setup-profile.tsx`
- 2 adimli flow: username → avatar
- State: `useState` ile adim yonetimi (step 0/1)
- Username validation: min 2 char, /^[a-zA-Z0-9_]+$/ regex
- Avatar: mevcut AVATAR_OPTIONS (12 emoji) kullan
- Kayit: `supabase.from('users').update({ username, avatar_url: selectedEmoji })`
- Tamamlaninca: `AsyncStorage.setItem(ONBOARDING_KEY, 'true')` + navigate `(tabs)`

---

### Task 4: Profile Header Guncelleme (`app/(tabs)/profile.tsx`)

**Mevcut dosya guncelleme:**
- Header section'da:
  - Avatar: emoji veya varsayilan 🎬 → 72px daire, accent-primary border
  - Username: users tablosundan cek, yoksa "Sinefil #" + kisa ID
  - Persona Badge: placeholder pill — "Arketip Bekleniyor" (P5.2'de gercek deger gelecek)
- Mevcut `AvatarModal` korunabilir (settings icinden degistirme)
- Yeni: `fetchUserProfile()` → username, avatar, archetype_id cek

---

## Oncelik Sirasi
1. DB Migration (012) — schema hazir olsun
2. Auth paketleri kur + Supabase config
3. `auth.tsx` sign-in ekrani
4. `setup-profile.tsx` onboarding
5. `profile.tsx` header guncelleme
6. gate.tsx routing guncelleme

## Test Checklist
- [ ] Apple sign-in calisiyor (iOS simulator/device)
- [ ] Google sign-in calisiyor
- [ ] Anonymous skip hala calisiyor
- [ ] linkIdentity: anon → social gecis verilerini koruyor
- [ ] Username + avatar Supabase'e kaydediliyor
- [ ] Profile header yeni veriyi gosteriyor
- [ ] MVP flow bozulmadi: mood → films → swipe → watchlist
- [ ] Mevcut onboarding flow ile catisma yok
