## BUG-008: Archetype Assignment Logic Unverified
**Severity:** P1 (investigate)
**Issue:**
- 6 kalibrasyon sorusu → "Mind Bender" atandı
- Tüm 12 arketipin atanabilir olup olmadığı bilinmiyor
- Scoring mantığı test edilmedi
**Questions:**
1. Tüm 12 arketip farklı cevap kombinasyonlarıyla alınabiliyor mu?
2. Skor deterministik mi?
3. Bias var mı (bazı arketipler hiç çıkmıyor mu)?
**Suspected Files:** app/onboarding.tsx (scoring), Claude prompt (archetype mapping)
**Device:** iPhone SE, Build 6
