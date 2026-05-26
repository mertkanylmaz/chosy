## BUG-011: Recommendation Quality Unverified
**Severity:** P1 (investigate)
**Issue:**
- "a cozy, warm and peaceful evening" + IMDB Top 250 filter → Schindler's List geldi
- Schindler's List cozy/warm/peaceful değil — yanlış öneri
- Film çıkıyor ama gerçekten mood'a uygun mu belirsiz
**Expected:** Mood'a gerçekten uyan filmler
**Actual:** Muhtemelen filter (IMDB Top 250) mood'u override ediyor
**Suspected Files:** supabase/functions/recommend/index.ts, match_films RPC
**Device:** iPhone SE, Build 6
