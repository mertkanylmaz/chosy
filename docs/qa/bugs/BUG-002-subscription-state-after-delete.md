## BUG-002: Subscription State Persists After Account Delete
**Severity:** P0 (block submit)
**Repro Steps:**
1. Yıllık üyelik al
2. Hesabı sil
3. Yeni Apple ID ile veya aynı ID ile tekrar sign in
4. Onboarding'i tamamla
5. Mood arama ekranında 50 hak görünüyor (3 olması gerekiyor)
**Expected:** Hesap silinince subscription sıfırlanmalı, free user olarak başlamalı
**Actual:** Eski subscription persist ediyor, quota doğru değil
**Suspected Files:** services/subscriptionService.ts, services/purchaseService.ts, supabase delete-account edge function
**Device:** iPhone SE, Build 6
