## BUG-003: Archetype Not Saved When Onboarding Completed Offline
**Severity:** P0 (block submit)
**Repro Steps:**
1. İnternet kapat
2. Onboarding'i tamamla
3. İnterneti aç
4. Ana sayfaya bak
**Expected:** Archetype kaydedilip home'da görünür
**Actual:** Archetype yok, home'da görünmüyor, sync olmamış
**Suspected Files:** services/profileService.ts (offline queue yok), app/onboarding.tsx (network-dependent save)
**Device:** iPhone SE, Build 6
