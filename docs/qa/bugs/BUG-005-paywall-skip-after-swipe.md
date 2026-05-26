## BUG-005: Paywall Skipped After Quota Exhausted
**Severity:** P0 (block submit)
**Repro Steps:**
1. Onboarding tamamla
2. 5 film sağa kaydır (quota exhausted)
3. Paywall göstermek yerine direkt ana sayfaya atar
**Expected:** Quota bitince paywall gösterilir
**Actual:** Sessiz fail, ana sayfaya atıyor, paywall yok
**Suspected Files:** app/discover.tsx (quota check logic), services/quotaEngine.ts
**Device:** iPhone SE, Build 6
