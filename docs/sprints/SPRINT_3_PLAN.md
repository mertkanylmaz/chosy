# CHOSY SPRINT 3 — PRODUCTION PROMOTE & PERSONALIZATION UX

> **Tarih:** 6 Haziran 2026
> **Tahmini sure:** 5-7 gun
> **Onceki:** Sprint 2 (taste signals + hybrid v3 + remote config)
> **Durum:** KOD TASKLERI TAMAMLANDI — EAS build bekliyor

---

## SPRINT 2 KAPANISI

Sprint 2 deliverables (kod hazir, commit bekliyor):
- [x] Bug B fix committed (81c3535)
- [x] Founder acceptance tests: 3/5 PASS, 2 PARTIAL, 0 FAIL (regression yok)
- [ ] Device test: 5 ardisik swipe right → watchlist'te 5 film (founder verification)
- [ ] Supabase watchlist tablosunda 5 yeni row dogrulanmasi

**Sprint 2 uncommitted dosyalar (commit gerekli):**
- `services/auth-utils.ts` — circular import fix
- `services/remoteConfig.ts` — remote config system
- `services/tasteSignalService.ts` — 6 trigger taste signal service
- `services/userVectorRefresh.ts` — 30-min throttle user vector refresh
- `supabase/functions/recompute-user-vector/index.ts` — edge function
- `supabase/migrations/035-039` — app_config, taste_signals, user_vector_refresh, match_films_v3, dirty_trigger
- Modified: recommendations.ts (v3 hybrid), watchlist.ts, _layout.ts, profile.tsx, onboarding.tsx, etc.

---

## SPRINT 3 HEDEFI

> Production'daki kullanicilara Sprint 1+2'nin tum gelistirmelerini ulastir ve
> cold-start problemi coz. Hybrid recommendation gercekten calisir hale gelsin.

---

## TASK 3.0 — Sprint 2 Kod Commit & Temizlik [0.5 gun]

**Amac:** Sprint 2'nin tum uncommitted dosyalarini tek clean commit olarak kaydet.

**Adimlar:**
1. Tum Sprint 2 dosyalarini stage et (untracked + modified)
2. Tek commit: `feat: Sprint 2 — taste signals, hybrid v3, remote config, Bug A+B fixes`
3. `git tag v1.0.3-sprint2` ekle

**Done kriterleri:**
- [ ] Clean working tree (git status temiz)
- [ ] Tag eklendi

---

## TASK 3.1 — App Store v1.0.3 Build & Submit [1 gun] ⭐ BLOCKER

**Amac:** Sprint 1+2 tum gelistirmeleri production'a tasimak. Simdi prod'da hala v1.0.2 + match_films_v1.

**Oncesinde gerekli:**
- TASK 3.0 tamamlanmis olmali
- Bug B device verification (5 swipe → 5 watchlist row)

**Adimlar:**
1. app.json version bump → 1.0.3, buildNumber increment
2. EAS build: `eas build --platform ios --profile production`
3. App Store Connect submit
4. What's New copy (EN + TR):
   - EN: "Smarter recommendations that learn your taste. Bug fixes."
   - TR: "Zevkini ogrenen daha akilli oneriler. Hata duzeltmeleri."

**Done kriterleri:**
- [ ] EAS build basarili
- [ ] App Store Connect'e yuklendi
- [ ] Review submit edildi

**Risk:** Apple review 1-3 gun surebilir. Review sirasinda diger tasklara devam edilir.

---

## TASK 3.2 — Cold-Start Onboarding Swipe [1.5 gun] ⭐ YUKSEK ONCELIK

**Amac:** Yeni kullanici onboarding'de 6 film swipe ile baslasin, boylece hybrid recommendation
ilk arama itibariyle aktif olsun. Su an calculateBlendWeights threshold 10 signal,
kullanicilar 0-9 arasi → userWeight: 0 → hybrid fiilen mood-only calisiyor.

**Tasarim:**
- Onboarding step 4'ten sonra (archetype reveal oncesi) yeni bir adim ekle
- "Bize zevkini goster" / "Show us your taste" basligi
- 6 curated film karti goster (genreler arasi dagilim: drama, comedy, thriller, sci-fi, animation, romance)
- Swipe right = begendim, swipe left = ilgimi cekmiyor
- Her swipe bir taste signal uretir (swipe_right: strength 0.8, swipe_left: strength -0.5)
- Minimum 6 swipe zorunlu, skip yok
- Tamamlaninca: preferences_vector_dirty = true → recompute-user-vector tetiklenir

**Film secimi:**
- TMDb'den popular + well-known filmler (The Shawshank Redemption, Inception, Spirited Away, The Grand Budapest Hotel, Get Out, La La Land gibi)
- Hardcoded film_id listesi (DB'de mevcut filmlerden sec)
- Poster + baslik + yil gosterilir

**Teknik:**
- `app/onboarding.tsx`'e yeni step ekle (step 5 olacak, archetype reveal step 6'ya kayar)
- Swipe mekanigi: Reanimated + GestureHandler (discover.tsx'teki pattern'i reuse et)
- Signal kaydi: `tasteSignals.recordSwipeRight(filmId)` / yeni `tasteSignals.recordSwipeLeft(filmId)`
- `recordSwipeLeft` → tasteSignalService'e eklenmeli (strength: -0.5, type: 'swipe_left')

**Done kriterleri:**
- [ ] Onboarding'de 6 film swipe adimi calisir
- [ ] Her swipe bir taste signal kaydi olusturur (user_taste_signals tablosunda)
- [ ] Tamamlaninca signalCount >= 6 → calculateBlendWeights userWeight > 0
- [ ] Archetype reveal hala dogru calisiyor (step kayma sorunu yok)

---

## TASK 3.3 — Archetype Reveal Animation [1.5 gun]

**Amac:** Onboarding'in climax ani. Spotify Wrapped tarzi identity moment.
Investor pitch icin altin degerinde — sosyal paylasim + viral potansiyel.

**Tasarim:**
- Archetype reveal ekraninda:
  1. 3 saniyelik build-up animasyonu (pulse, glow, particles)
  2. Archetype icon + isim buyuk reveal (scale-up + haptic heavy)
  3. Archetype aciklama text fade-in
  4. Share card butonu (1080x1350 Instagram story format)
- 12 archetype icin tema renkleri (archetype.color mevcut mu kontrol et)
- Haptic feedback: reveal aninda `Haptics.notificationAsync(Success)` + `impactAsync(Heavy)`

**Teknik:**
- `app/onboarding.tsx` archetype reveal step'ini refactor et
- Reanimated: `useSharedValue`, `withSequence`, `withTiming`, `withSpring`
- Share card: `react-native-view-shot` ile capture → `expo-sharing`
- Share card layout: archetype icon + isim + "I'm a [Archetype]" + Chosy logo

**Done kriterleri:**
- [ ] Reveal animasyonu akici calisiyor (60fps, no jank)
- [ ] 12 archetype icin dogru icon + isim + renk
- [ ] Share butonu calisir, gorsel capture + share
- [ ] Haptic feedback tetikleniyor

---

## TASK 3.4 — Lazy Getter ESLint Rule [0.5 gun]

**Amac:** Sprint 2 Kural 6'yi enforce etmek. Module-level `remoteConfig.get()` yasak.

**Adimlar:**
1. `.eslintrc.js`'e custom rule ekle veya `no-restricted-syntax` ile pattern'i yakala
2. Pattern: `const X = remoteConfig.get(` module scope'ta → hata
3. Mevcut tum dosyalarin pass ettigini dogrula

**Done kriterleri:**
- [ ] ESLint rule aktif
- [ ] `npm run lint` hatasiz

---

## TASK 3.5 — Sprint 2 Backlog Temizlik [1 gun]

**Backlog items (Sprint 1+2 carry-over):**
- [ ] Supabase migration 016 deploy (games tablolari — Mini Games sprint'ten kalan)
- [ ] V1.1.0 Games release (EAS build + submit — games sprint'ten kalan)
- [ ] Device test: 3 oyun full flow
- [ ] `swipe_left` signal type eklenmesi (TASK 3.2 ile birlikte yapilabilir)
- [ ] Sentry error rate baseline check

**Not:** Bu liste Sprint 3 esnasinda guncellenebilir. Diger task'lar arasinda bosluk oldugunda calisilir.

---

## SPRINT 3 TIMELINE

```
Gun 1:  TASK 3.0 (commit) + TASK 3.1 basla (version bump + EAS build)
Gun 2:  TASK 3.1 submit + TASK 3.2 basla (cold-start swipe)
Gun 3:  TASK 3.2 devam + test
Gun 4:  TASK 3.3 (archetype reveal animation)
Gun 5:  TASK 3.3 polish + TASK 3.4 (ESLint) + TASK 3.5 (backlog)
Gun 6:  Buffer / Apple review follow-up / device test
```

---

## SPRINT 3 KALICI KURALLAR (Sprint 1+2'den devir)

1. **Silent fallback YASAK** — her fallback bir error log + Sentry event uretmeli
2. **Optimistic UI ONCE backend insert** — toast gostermeden ONCE DB'ye yaz
3. **Done = end-to-end** — migration + RPC + UI cagri + production data ornegi
4. **3 hipotez once, patch sonra** — bug'a ilk patch'i yazmadan once 3 root cause yaz
5. **Module-level feature flag YASAK** — lazy getter pattern kullan
6. **Plan'a sadik kal** — scope creep'e kapilma, retro'da degerlendir

---

## BASARI METRIKLERI

| Metrik | Hedef |
|---|---|
| App Store v1.0.3 live | Evet |
| Cold-start user signalCount | >= 6 (onboarding tamamlayan) |
| Hybrid recommendation aktif | calculateBlendWeights userWeight > 0 |
| Archetype share card | Capture + share calisiyor |
| Founder acceptance test | >= 3/5 PASS (regression yok) |
| Sprint backlog | Azalmis (19 → <15) |
