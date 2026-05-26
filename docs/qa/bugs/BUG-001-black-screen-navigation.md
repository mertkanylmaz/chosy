## BUG-001: Black Screen on Back Gesture During Onboarding
**Severity:** P0 (block submit)
**Repro Steps:**
1. Onboarding'e gir
2. Herhangi bir soruda sola swipe (back gesture) yap
3. App film arama sayfasına, sonra watchlist'e, sonra başka sayfalara atlar
4. En son siyah ekranda takılı kalır
5. Force close/reopen gerekir
**Expected:** Back gesture onboarding'de devre dışı veya önceki soruya döner
**Actual:** Navigation stack bozuluyor, siyah ekran, recovery yok
**Suspected Files:** app/onboarding.tsx (gesture handling eksik), app/_layout.tsx (navigation stack)
**Device:** iPhone SE, Build 6
