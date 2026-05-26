## BUG-004: Offline Search Shows Deleted Film "Lumi"
**Severity:** P1 (block release)
**Repro Steps:**
1. İnternet kapat
2. Mood arama yap
3. No results found ekranı gelir
4. Silinmiş "Lumi" filmi görünür
**Expected:** Offline'da temiz "no connection" mesajı
**Actual:** Eski cache'den silinmiş film görünüyor
**Suspected Files:** services/recommendations.ts (stale cache), offline cache invalidation yok
**Device:** iPhone SE, Build 6
