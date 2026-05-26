## BUG-010: Offline Sign-In Shows Generic Error
**Severity:** P2 (cosmetic)
**Repro Steps:**
1. İnternet kapat
2. Sign in with Apple dene
3. Uzun süre "Signing in..." döner
4. "Something went wrong, please try again" mesajı
**Expected:** "No internet connection" mesajı veya graceful offline state
**Actual:** Generic error mesajı, kullanıcı ne olduğunu anlamıyor
**Suspected Files:** app/auth.tsx (network error handling)
**Device:** iPhone SE, Build 6
