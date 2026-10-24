# MONEY-1C — Pro Mode daveti + 1 ücretsiz AI araması keşfi (SALT OKUNUR)

Tarih: 24 Eki 2026 · Dal: `release/2.1.1` (HEAD `bb4569a`) · Proje: `chosy ai` (linked).
Yapılan: kod okuma + `supabase db query --linked` (yalnız SELECT) + `supabase functions download parse-mood`
(repo dışı geçici dizine, karşılaştırma için). Kod / migration / deploy / `test:founder` YOK.
Karar girdisi (görev metninden): 1B (şampiyon sonrası paywall) iptal; yerine Pro Mode daveti → 1 ücretsiz AI araması →
bağlamsal teklif. Gauntlet kalıcı ücretsiz ve reklamsız. Önceki tur: `docs/investigations/MONEY-1_KESIF.md` (tekrarlanmadı).

---

## Yönetici özeti

1. **Sunucu Pro Mode'u hiç zorlamıyor.** `parse-mood` yalnız `check_and_consume_quota('search')` çağırıyor (`parse-mood/index.ts:209-212`);
   free tier günlük limiti **3** (canlı `subscription_limits`). Pro Mode kapısı (`isPremium || legacy_mood_access`) yalnız istemcide
   (`hooks/useProModeAccess.ts:117-122`, `app/pro-mode.tsx:159`). Ölçüm: 17 Ağu'dan beri `legacy=false, tier=free` kullanıcılardan **34 kişi / 38
   başarılı arama**, en sonuncusu bugün 08:54 UTC. Bu aramaların hangi yoldan geldiği (eski binary / başka giriş / doğrudan API) **doğrulanamadı**;
   repoda MoodSearchScreen'e giden tek rota `pro-mode.tsx`.
2. **Canlı `parse-mood` v41 (8 Ağu) repodan geri.** Fark = C.0c: canlıda `public.users` satırı olmayan kimlik **kota atlanarak ücretli
   Haiku'ya geçiyor** (fail-open); repoda 403 `APP_USER_MISSING`. Canlıda şu an auth kimliklerinin 55'i (son 30 günde 41/108) app satırsız. Ücretsiz-hak
   mantığı `parse-mood` içine konacaksa önce bu fark deploy edilmeli ya da bilinçli olarak devralınmalı. Şampiyon ekranına ulaşmış kullanıcının app
   satırı zorunlu olduğundan (`daily_gauntlets.user_id` FK) bu funnel'ı doğrudan etkilemiyor.
3. **Ücretsiz hakkın saklanacağı yer yok.** `users` / `user_daily_quotas` içinde "bir kez" semantiği taşıyan kolon yok; `user_daily_quotas` günlük
   (PK `user_id,date`). `merge_anonymous_user` anonim `users` satırını `DELETE … CASCADE` ile siliyor — hak taşıma kuralı bugün yok. Her çözüm
   şema değişikliği (**DUR**). `135` guard'ı henüz uzakta uygulanmamış (`migration list`: Local 135 / Remote boş); yeni kolon guard listesine alınmazsa
   istemci kendi hakkını sıfırlayabilir.
4. **Rıza reddi = AI arama yok, alternatif yok.** `'basic'` arama modu tipte ve 3 tüketicide duruyor ama **hiçbir yerde set edilmiyor**; `parseMoodLocal`
   çağrılmıyor. Reddeden kullanıcı MoodSearchScreen'de rıza bloğunu görüyor (tek CTA "Enable & find"), arama yapamıyor. Rıza durumu: 333 kullanıcıdan
   **1** rızalı. Yani funnel'ın her adımında rıza adımı fiilen yeni.
5. **Funnel olayları büyük ölçüde eksik**: `ai_search_completed`, `offer_shown` yok; `recordTrialStarted` tanımlı ama **hiç çağrılmıyor**; `purchase_completed`
   yalnız `package_id`/`product_id` taşıyor (giriş noktası yok, trial/paid ayrımı yok). Giriş noktası (`champion`/`spotlight`) hiçbir olayda yok.
6. **Maliyet düşük ama kötüye kullanım yüzeyi açık.** parse-mood ölçümü: ort. 1.292 giriş / 346 çıkış token (n=49) ≈ **0,003 $/arama** (liste fiyatı
   varsayımı); rerank ölçülmüyor (token loglanmıyor), tahmini benzer büyüklükte. Anonim yeniden kurulum her seferinde yeni app kullanıcısı ve yeni hak
   üretir (304/388 auth kimliği anonim, cihaz bağlama yok).

---

## 1. Giriş noktaları

### 1a. Şampiyon ekranı

| dosya:satır | açıklama | boyut |
|---|---|---|
| `components/gauntlet/GauntletShell/index.tsx:1747-1817` | Şampiyon dalı tek `ScrollView`: `ChampionReveal` → Spotlight kartı (`:1778-1791`) → `CycleRow` (`:1797-1810`) → `ArchiveTrigger` (`:1814-1816`) | — |
| `components/gauntlet/ChampionReveal/index.tsx:611-679` | "Where to Watch / Save / Share": `WatchProvidersRow` → `shareNotice` → `actionsRow` ([Watch now][Save][Share]). Kartın istenen yeri bunun **hemen altı** | — |
| `ChampionReveal/index.tsx:612-679` içine mi, dışına mı | İçine koymak `ChampionReveal`'in hero yüksekliği hesabını (`belowHeight`, `GauntletShell:1541-1547`) etkiler. Dışına (GauntletShell'de `ChampionReveal` ile Spotlight arasına) koymak `ArchiveTrigger` desenini izler ama `useBelowHeight`'a yeni bir anahtar ister (`total({card,cycle,archive})` bugün 3 anahtar) | M |
| `components/gauntlet/ArchiveTrigger/index.tsx:1-60` | Mevcut "sakin, kullanıcı eylemiyle açılan" desen; kendi durumunu kendi sorar, prop almaz. Satır içi kart için en yakın emsal | — |

En dar ekleme noktası (rapor, karar CTO'nun): `GauntletShell` içinde `ChampionReveal` ile `bonusCardInline` arasında, kendi `onLayout` sarmalayıcısıyla yeni bir
bileşen; `below.total`'a yeni `offer` anahtarı. Yeni bileşen `useProModeAccess`'i kendisi okur (ArchiveTrigger deseni).

**Bildirim ön-sorusu (8 sn) ile çakışma** — modal ile satır içi kart aynı anda görünmez ama dolaylı çakışmalar var:

| dosya:satır | durum |
|---|---|
| `useChampionAsk.ts:45,144-155` | Dwell sayacı: Spotlight kartı görünür alanda **tamamen** ve etkileşimsiz 8 sn. Karar `canStartDwell({cardY,cardHeight,scrollY,viewportHeight,bottomInset})` (`utils/askDecision.ts`) ile. Spotlight kartının üstüne bir kart eklemek `cardY`'yi aşağı iter → küçük ekranda kart "tamamen görünür" olmayabilir, dwell **hiç başlamaz** (bildirim sorusu sessizce düşer). `useSpotlightVisible` aynı ölçüyü kullanıyor (`GauntletShell:1548-1553`). |
| `askDecision.ts:92-104` | Gün 1 → yalnız `notif`; gün 2+ → auth uygunsa `auth`, değilse `notif`; günde en çok 1 ask. İlk şampiyon günü = bildirim sorusunun da günü; teklif kartı ile aynı oturumda yan yana gelir. |
| `GauntletShell:1806` | `CycleRow` zaten `championAsk.askType === null` iken "hatırlat" gösteriyor — ask açıkken yan CTA gizleme emsali var. |
| `useChampionAsk.ts:21-26` | Sayaç dokunuşla silahsızlanır; kart içi dokunuş ask'i ertelemez/kapatmaz, yani kart etkileşimi dwell'i bitirir (ask gelmeyebilir). |

Sıralama seçenekleri (karar CTO'nun): (i) kart yalnız `askType===null` ve bugün ask gösterilmişse/çözülmüşse görünür; (ii) gün 1'de kart yok, gün 2+; (iii) kart ask'in
*altında* kalır ve dwell ölçüsü kartı hesaba katar. (i) ve (iii) `useChampionAsk`/`askDecision` sözleşmesine dokunur → **DUR (D1)**.

### 1b. Spotlight sonucu

| dosya:satır | açıklama |
|---|---|
| `components/games/Spotlight/SpotlightResult.tsx:2-8,251-296` | Sıra: kare → ad → yıl → durum → hak satırı → `Where to Watch` (marquee) → `Save` → `Share` (yalnız kazanılırsa) → `result_next_film` alt satırı |
| `SpotlightResult.tsx:272-290` | `actions` bloğu `filmId || canShare` iken çizilir; kart bu bloğun altına, alt satırın üstüne girebilir. Kazanma/kaybetme (`variant: found/flawless/lost`) her ikisinde aynı yer |
| `app/games/spotlight.tsx:15-17` | Ekran `GameShell` içindeki `SpotlightGame`; kendi `GameShell` header'ı (geri) var |

Spotlight'ta ask yok (`useChampionAsk` yalnız şampiyon dalı); bildirim çakışması yok. Ama Spotlight'tan şampiyon ekranına dönüşte `spotlight_return` tetikleyicisi
ask'i açabilir (`useChampionAsk.ts:183-206`) — kart Spotlight'ta gösterilmişse dönüşte ikinci kez karşılaşma olur.

**Mevcut bileşenler:** `ChampionActionButton` (`variant: marquee|filled|outline`), `QuietAction`, `OutlineAction`, `PrimaryAction` (`components/gauntlet/*`). Satır içi kart için
yeni bileşen gerekir (yeni bileşen = tasarım/pattern kararı, CLAUDE.md Yetki sınırı).

---

## 2. Pro Mode erişim kapısı

| dosya:satır | açıklama |
|---|---|
| `hooks/useProModeAccess.ts:59-124` | `allowed = !loading && (isPremium || legacyAccess)`; `reason: 'premium'|'legacy'|'none'`. `legacy_mood_access`, `readUserRow('auth_id', authId, ['legacy_mood_access'])` ile **60 sn önbellekli** (`services/userCache`) okunur (`:82-86`). Fail-closed: okuma hatasında `allowed=false`, `error=true` |
| `app/pro-mode.tsx:84-179` | Durumlar: loading / error / **locked** (`!allowed`: `proMode.lockedTitle/Body` + tek "Chosy Pro" CTA → `triggerPaywall({type:'profile_upgrade'})`, `:109-122`) / allowed → `MoodSearchScreen` |
| `services/userFlags.ts:43-47,83-87` | `readUserFlags()` de `legacyMoodAccess` döndürüyor (iki okuyucu; kaynak aynı kolon) |
| `components/Home/MoodSearchScreen/index.tsx:136-137` | `quotaExempt` (yalnız legacy) istemci kota duvarını atlatıyor |
| `app/discover.tsx:80-81,194-242` | Aynı `quotaExempt`, slot kotası için |
| Canlı | `legacy_mood_access=true`: **233/333**; ücretli tier: 7; `ai_consent_at` dolu: **1** |

**Bugün free kullanıcıya gösterilen:** `/pro-mode` açılırsa kilitli ekran (ikon + metin + "Chosy Pro" CTA'sı). Rota Profile'daki "Pro Mode" girişinden (`app/(tabs)/profile.tsx:781,1234,2026`);
şampiyon / Spotlight ekranından tek bir yol yok.

**"1 ücretsiz hak" kapıya nasıl eklenir (seçenekler):**

| seçenek | not |
|---|---|
| (a) `ProModeAccess`'e `freeSearchAvailable: boolean` + `reason: 'free_trial'` eklenir; `allowed` aynı kalır, `pro-mode.tsx` yeni durumda MoodSearchScreen'i açar | `reason` birleşim tipi (`'premium'|'legacy'|'none'`) ve `pro_mode_opened.access_reason` değişir. Hakkın kaynağı sunucu kolonu → `readUserRow` **60 sn önbelleği**: tüketimden sonra `invalidateUserCache()` (`userFlags.ts:122` emsali) şart, yoksa tüketilmiş hak 60 sn daha "var" görünür |
| (b) Ayrı hook (`useFreeProSearch`) | `ProModeAccess` sözleşmesi değişmez; `pro-mode.tsx` iki hook'u birleştirir. "Tek doğruluk kaynağı" ilkesi (`useProModeAccess.ts:2`) bozulur |

İstemci kapısı güvenlik değil UX: **sunucu zorlaması yok** (Yönetici özeti 1). "Hak bitti → Pro gerekli" ancak `parse-mood` tarafında tier/legacy/hak kontrolüyle gerçek olur (**DUR**).

---

## 3. Ücretsiz hak (sunucu)

### 3.0 Bugünkü sunucu akışı

| dosya:satır | açıklama |
|---|---|
| `parse-mood/index.ts:265-274` | `requireUser` → `checkRateLimit(authUserId,'parse-mood')` (fail-closed, eşikler `_shared/rateLimit.ts` — **okunmadı**) |
| `:184-245` | `checkSearchQuota`: `check_and_consume_quota(p_user_id, 'search')` **LLM'den ÖNCE** ve **gövde doğrulamasından önce** tüketir. RPC hatasında / istisnada **fail-open** (`:225,243`, Sentry'li) |
| `:295-315` | `!allowed` → 429 `QUOTA_EXCEEDED` |
| `:317-341` | `raw_input` doğrulaması **kotadan sonra**: geçersiz girdi (400) kotayı zaten yakmış |
| `:352-360,405-478` | LLM (`claude-haiku-4-5`, `max_tokens:1024`) hata → 503/500; kota **iade edilmiyor** |
| `:387-399,401-404` | `logMoodSearch` → `mood_searches` INSERT → `search_id` istemciye döner; INSERT başarısızsa `search_id: null` |
| `supabase/migrations/115:48-170` | `check_and_consume_quota`: atomik (`INSERT … ON CONFLICT DO NOTHING` + `SELECT … FOR UPDATE`), `legacy` ⇒ `-1`, `-1` = sınırsız. İade (decrement) yolu **yok** |
| `supabase/migrations/021:50-62` | `user_daily_quotas(user_id,date)` PK; `searches_used`, `bonus_searches_*`. Günlük satır, "bir kez" kavramı yok |
| `mood_searches` (canlı şema) | `id, user_id, search_date, searches_used, created_at, updated_at, + enrichment (032)`; 134 ile günlük UNIQUE kalktı. `search_id` = bu tablonun `id`'si |

İstemci tarafı ikinci bir sayaç tutuyor: `services/quotaEngine.ts:154-197` `checkAndConsumeQuota` **AsyncStorage** sayacı (limit `FREE_DAILY_LIMIT=3`, `constants/subscriptionPlans.ts:125`),
`MoodSearchScreen:388` çağırıyor. Sunucu sayacından bağımsız; cihaz yereli.

### 3.1 Canlı sürüm (v41) ↔ repo farkı

`supabase functions list`: `parse-mood` v41, güncelleme 2026-08-08 08:38 UTC. İndirilen canlı dosya ile repo `diff`'i (`index.ts` + `_shared/{auth,sentry}.ts`):

| fark | canlı v41 | repo |
|---|---|---|
| `appUserId===null` dalı | `{allowed:true}`, Sentry `warning`, kota atlanır, `logMoodSearch` atlanır → **sayaçsız, izsiz ücretli LLM** | `{allowed:false, reason:'APP_USER_MISSING'}`, Sentry `error`, 403 (`index.ts:193-203,285-293`) |
| `_shared/sentry.ts` | `SUPABASE_ENV` | `CHOSY_ENV`, `fingerprint` desteği |
| `_shared/auth.ts` | `requireServiceRole` yok | var (parse-mood kullanmıyor) |

Canlı ölçüm (orphan): `auth.users` 388 · anonim 304 · `public.users` satırı olmayan **55** (hepsi anonim) · son 30 günde auth 108, app satırsız **41**.
(`public.users.auth_id` **text**, `auth.users.id` uuid — sorguda `::text` eşleme gerekti.)

**(a) "parse-mood içinde" bu engel çözülmeden mümkün mü?** Teknik olarak evet: ücretsiz-hak kontrolü `appUserId` bilinen yolda çalışır, orphan dalı ayrı kalır. Ama:
- Canlıda orphan dalı fail-open olduğundan hak mantığı **atlanabilir**: app satırı olmayan kimlik hak tüketmeden, sınırsız arayabilir. Hak yalnızca repo sürümü deploy edilince anlamlı korunur.
- Repo sürümünü deploy etmek (C.0c) 403 üretir: canlı app-satırsız 55 kimlik aramaz. Şampiyon ekranına ulaşan kullanıcıda app satırı vardır (FK), yani funnel etkilenmez; ama `readAppUserId` bootstrap penceresindeki ilk dakikalar için **doğrulanamadı**.
- Deploy sırası: kısıtlayıcı değişiklik → `CLAUDE.md`/`chosy-conventions §9` "tüketici önce, üretici sonra" kuralı bu fonksiyon için geçerli değil (paylaşılan modül tüketicisi yok), ama `_shared/sentry.ts` değişimi (`CHOSY_ENV`) **tüm** fonksiyonlarda ortak; canlı `SUPABASE_ENV` secret'ı ve `CHOSY_ENV` secret'ı tanımlı mı → **doğrulanamadı** (secret listesine bakılmadı).

### 3.2 Seçenekler (mimari karar — CTO)

| | (a) `parse-mood` içinde | (b) ayrı RPC (ör. `consume_free_pro_search`) |
|---|---|---|
| Atomik tüketim | `UPDATE users SET free_search_used_at=now() WHERE id=$1 AND free_search_used_at IS NULL RETURNING` (tek ifade) — parse-mood service-role ile çağırır | Aynı ifade SECURITY DEFINER RPC'de; çağıran: parse-mood (service-role) **veya** istemci |
| "Yalnız başarılı aramada tüketim" | LLM **başarısından sonra** tüketilir (parse başarısı = LLM JSON'u geçerli). İzin reddi: `parse-mood` hiç çağrılmaz (`tasteParser.ts:95-97` istemci kapısı) → tüketmez. Ağ hatası: istek sunucuya ulaşmadıysa tüketmez; ulaşıp yanıt kaybolduysa **tüketilmiş ama sonuç yok** → idempotency gerekir. Boş sonuç: parse-mood, `match_films_v3` sonucunu bilmez (istemcide, `recommendations.ts`) → burada **ölçülemez** | Boş sonuç ancak istemci "commit" çağrısıyla bilinebilir; istemci commit'i atlarsa hak sonsuz (**istemciye güvenme**). Rezerve/commit (iki aşamalı) + zaman aşımıyla iade gerekir |
| `search_id` idempotency | İstemci üretir `client_search_id` (UUID) → body'de gönderilir (**istek sözleşmesi değişir**); sunucu aynı id'yi 2. kez görürse hak tüketmez, aynı sonucu (veya 409) döner. Bugünkü `search_id` (= `mood_searches.id`) yanıtla **sonradan** gelir, idempotency anahtarı olamaz | Aynı, RPC `p_search_id` alır, UNIQUE kayıt (yeni tablo/kolon) |
| Merge'de taşıma | `merge_anonymous_user` değişir (bkz. 3.3) | Aynı |
| Maliyet | Tek ağ turu | İki tur (rezerve + commit) |

Gerçekçi birleşik şekil (yalnız rapor, karar CTO'nun): hak **parse-mood içinde LLM başarısı sonrası** tüketilir, `client_search_id` ile idempotent; "boş sonuç iadesi" ayrı bir
sunucu RPC'si olarak gerekirse eklenir (istemci tetikler, sunucu yalnız hak **tüketilmişse ve 5 dk içindeyse** iade eder) — bu parça ayrıca CTO onayı ister.

### 3.3 Şema taslağı (UYGULANMADI — taslak)

Numaralandırma: `supabase migration list` → Local en yüksek **135**, Remote en yüksek **134** (`133|133`, `134|134`, `135| |`); 135 yerelde var, uzakta yok (MONEY-SEC-1 sırası bekliyor). CLAUDE.md kuralı: iki sütunun en yükseği +1 ⇒ **136**.

```sql
-- TASLAK — UYGULANMADI. Numara: 136 (Local 135 / Remote 134; 135 henüz push edilmedi).
-- Seçenek S1: kolon (NULL = hak duruyor)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pro_free_search_at timestamptz NULL,   -- NULL = kullanılmadı
  ADD COLUMN IF NOT EXISTS pro_free_search_id uuid NULL;          -- tüketen aramanın client_search_id'si (idempotency)

-- Atomik tüketim (parse-mood service-role ile; istemci yazamaz → 135 guard listesine eklenmeli)
-- UPDATE public.users
--    SET pro_free_search_at = now(), pro_free_search_id = $2
--  WHERE id = $1 AND (pro_free_search_at IS NULL OR pro_free_search_id = $2)
-- RETURNING (pro_free_search_id = $2) AS granted;   -- aynı id tekrar gelirse yine granted (idempotent)
```

Alternatif S2: ayrı tablo `pro_free_searches(user_id uuid PK, search_id uuid UNIQUE, consumed_at timestamptz)` — merge'de `INSERT … ON CONFLICT DO NOTHING` ile hedefe taşınabilir, `users`'a kolon eklemez;
ama **yeni tablo** (RLS + REVOKE + CASCADE FK + 111'deki FK kimlik uzayı notu) daha fazla yüzey. S1 daha küçük, S2 daha temiz denetim izi. **İkisi de DUR.**

**Yeni kolon guard'a (135) eklenmeli mi?** Evet, S1 seçilirse. Guard koşulu `current_user IN ('authenticated','anon')` ve korunan kolon listesi `135_subscription_write_guard.sql:46-65`'de açık:
`subscription_tier, subscription_active_until, subscription_will_renew, legacy_mood_access`. `users: self update` RLS'i (`001:147`, `userFlags.ts:13-14`) kullanıcıya **tüm** kolonlarda UPDATE veriyor; guard'a eklenmezse
istemci `UPDATE users SET pro_free_search_at=NULL` ile hakkı sıfırlayabilir. Ayrıca INSERT dalında `pro_free_search_at IS DISTINCT FROM NULL` denetimi eklenmeli (kendini "tüketilmiş" insert etmek zararsız ama simetri için).
135 henüz uzakta uygulanmadığı için iki yol var: 135'i push öncesi düzenlemek veya 136'da `CREATE OR REPLACE FUNCTION` ile genişletmek (**karar CTO'nun**; 135 şu an MONEY-SEC-1 sürecinde — dokunulmadı).

**`merge-anonymous-user`'da hakkın taşınması:**
- Canlı `merge_anonymous_user(p_from,p_to)` gövdesi (pg_get_functiondef): yalnız `daily_gauntlets`, `choice_events`, `context_corrections` taşıyor; sonra `DELETE FROM users WHERE id = p_from` (CASCADE).
  `user_daily_quotas` ve `mood_searches` cascade ile silinir; **hak durumu taşınmaz**.
- Kural önerisi seçenekleri: (i) `hedef.hak_tüketildi = hedef OR kaynak` (kullanılmış hak kaybolmaz; anonim hesapta harcayıp giriş yapınca yeni hak doğmaz); (ii) hiç taşıma (anonim hak kaybı + hedefin kendi hakkı korunur — kötüye kullanım yüzeyi: anonim harca → hesaba bağlan → hedefin tazesi duruyor).
  Hangisinin kullanılacağı ürün/CTO kararı. Uygulama = `merge_anonymous_user`'ın yeni migration'da yeniden tanımı (123 sonrası gövde) ve `merge-anonymous-user` Edge Function'da değişiklik gerekmez (RPC içinde kalır). **DUR.**

---

## 4. AI izni reddedilirse

| dosya:satır | açıklama |
|---|---|
| `components/Home/MoodSearchScreen/index.tsx:456-463` | `handleFindMovies`: rıza yoksa **hiçbir şey yapmaz**, `consented=false` yapar |
| `:706-727` | Rıza yokken alt bar: `aiConsent.inlineBody` + tek CTA `aiConsent.inlineEnableAndFind`. "Reddet" butonu yok; çıkış = geri hareketi (`ai_consent_dismissed`, `:221-232`) |
| `services/tasteParser.ts:95-97` | Son kapı: rıza yoksa `MoodParseError('AI_CONSENT_REQUIRED')`, metin sunucuya gitmez |
| `:424-428` | Arama sırasında rıza geri çekilirse inline blok geri gelir |
| `services/moodSearchState.ts:121-134`, `recommendations.ts:251,1061-1063`, `hooks/useFeedManager.ts:122`, `contexts/MoodContext.tsx:42` | `'basic'` mod okuyucuları. **Yazıcı yok**: `grep "'basic'"` / `setSearchMode('basic')` → 0; her aramada `setSearchMode('ai')` (`MoodSearchScreen:285,380`) |
| `services/tasteParser.ts:1436,1470` | `parseMoodLocal` (kural tabanlı) var; repoda çağıran **yok** (grep) |
| `services/aiConsent.ts:241-269` | `ensureAiConsent` sheet yolu; `declinedThisSession` yalnız bellek. MoodSearchScreen sheet değil **inline** yol kullanıyor |

**Sonuç:** basic arama yolu bugün **kalktı** (ölü kod olarak duruyor). Reddeden kullanıcı: arama ekranı + rıza açıklaması, arama yok; Spotlight/gauntlet etkilenmez (LLM kullanmıyor).
Davet akışı için çıkarım: şampiyon ekranındaki karttan Pro Mode'a girişte rıza adımı **araya girer** ve ret kullanıcıyı arama yapamadan bırakır; ücretsiz hak bu durumda tüketilmez (parse-mood çağrılmaz).
Ürün kararı gerektiren boşluk: reddeden kullanıcıya ne gösterilecek (bugünkü hâl ya da yerel `parseMoodLocal`) — `docs/os` altında bu karar **bulunamadı** (kontrol edilmedi: `docs/TEKNIK_BORC.md`, bible).

---

## 5. Teklif anı: deck-end ve desteden çıkış

| dosya:satır | açıklama |
|---|---|
| `app/discover.tsx:183-188` | `advanceToNext`: son karttan sonra `setDeckComplete(true)` |
| `app/discover.tsx:280-298` | `deckComplete` ⇒ `MoodDeckSummary` + `ContextualPaywall` (aynı ekranda hazır) |
| `components/MoodDeckSummary/index.tsx:43-51,69-106` | Aksiyonlar: `onNewMood` (yeni mood), `onClose` (X; DECK-END-1 `574b50a`, HEAD'de: `git merge-base --is-ancestor` evet), `onGoWatchlist`. Olaylar: `mood_deck_completed`, `mood_deck_summary_action {new_mood|close|watchlist}` |
| `app/discover.tsx:261-264,395-415` | Deste **içindeki** sağ üst `×` = `handleNewMood` (`clearMood()` + `/(tabs)`); desteden çıkışın tek açık UI'ı bu. Android/iOS geri hareketi için ayrı `beforeRemove`/özel handler **yok** (grep) |
| `app/discover.tsx:194-242` | Sağa kaydırma = kaydet (`addToWatchlist` arka planda, `:228-241`); free kullanıcıda **istemci slot kotası** (`TIER_LIMITS.free.dailySlotLimit=8`, `subscriptionPlans.ts:88`) aşılırsa deste dondurulup `quota_exceeded` paywall'ı açılır (`:216-221`). 8 filmlik deste + başka slot kullanımı 8'i aşabilir → ücretsiz arama destesinde **kaydet kesilebilir** |
| `app/discover.tsx:128-133,182` | "İlk beğeni" noktası: `handleSwipeRight` → `setLikedFilms` (`:226`), `showSaveToast` (`:231-234`, 1,2 sn) |

**"Hangisi önce gelirse" kuralı nasıl kurulur** (rapor; karar CTO'nun): iki bağımsız olay — `deckComplete` (`discover.tsx:186`) ve çıkış (`handleNewMood` / `MoodDeckSummary.onClose` / sistem geri).
Tekil gösterim için oturum başına tek bir ref/anahtar gerekir (ör. `offerShownForSearchId`: `search_id` başına bir kez), çünkü `discover.tsx` `deckComplete` render'ı yeniden mount edilebilir.
`search_id` istemcide `MoodContext.lastSearchId` (`setLastSearchId`, `MoodSearchScreen:275-278`) olarak var; teklif kaydı bu anahtarla yazılırsa iki yoldan biri önce gelince diğeri bastırılır.
Çıkış yolları: (1) deste içi `×`, (2) özet `onClose`, (3) özet `onNewMood`, (4) sistem geri — hepsi `router.dismissTo/navigate('/(tabs)')`; teklif **çıkıştan sonra** hedef ekranda (şampiyon) mı yoksa çıkış öncesi ara ekranda mı gösterilecek kararı açık.

**Kaydetme / izleme kesilmeden:** `MoodDeckSummary` hâlihazırda "Watchlist'e Git" taşıyor; teklif ayrı, kapatılabilir bir şerit olarak yerleştirilirse mevcut aksiyonlar yerinde kalır.
Modal paywall (`ContextualPaywall` `Modal`, `PaywallBase:604`) deste içinde açılırsa kaydırmayı keser — bu nedenle ilk beğeni sonrası **şerit** (modal değil) önerisi mantıklı.

**İlk beğeni sonrası satır içi şerit için yer:** `discover.tsx` içinde kart yığını `CARD_HEIGHT` ile hesaplanıyor (`:348-` kart alanı, `:395` `newMoodBtn`); `showSaveToast` (`styles.toast`, `:417-`) aynı bölgede, 1,2 sn.
Şerit, toast'ın yeri ya da ilerleme çubuğu (`progress` genişliği `((currentIndex+1)/deckSize)*100%`, `:395`) civarına eklenebilir; toast ile çakışmaması için sıralama/ofset gerekir. Düzen ölçümü yapılmadı (**doğrulanamadı**: cihazda görsel).

---

## 6. Teklif ekranı

**`PaywallBase` yeniden kullanılabilir mi?** Evet — mevcut desen birebir var:

| dosya:satır | açıklama |
|---|---|
| `components/paywalls/PaywallBase/index.tsx:99-132` | Props: `renderHeader(pricing, ctx)` ve `renderBelowPlans?`; `variant` (izleme için), `onConvert`, `onDismiss` |
| `components/paywalls/PaywallProfileUpgrade/index.tsx:35-62` | Yeni variant'ın şablonu: `PaywallBase` + `ProHero` (`hideSubhead={ctx.trialShown}`) + `ProBenefits` |
| `components/paywalls/ContextualPaywall.tsx:56-69` | Variant router (switch); yeni variant = yeni `case` |
| `services/conversion/types.ts:11-58`, `triggerOrchestrator.ts:44-82` | Yeni `TriggerType` + `PaywallVariantName` + `triggerToVariant` case'i |
| `triggerOrchestrator.ts:90-93,229-252` | Yeni kullanıcı 24 sa kapısı + 24 sa cooldown **yalnız `IMMEDIATE_TRIGGERS` dışı** için. Teklif kullanıcı eylemiyle (karta dokunuş) açılacaksa `IMMEDIATE_TRIGGERS`'a eklenmeli; yoksa ilk şampiyon (çoğunlukla ilk 24 saat) için **hiç görünmez** (D2) |
| `triggerOrchestrator.ts:104-135` | `VARIANT_CONFIG_KEYS`: yeni variant `app_config` bayrağına bağlanacaksa buraya; `isVariantEnabled` `=== true` ister ⇒ bayrak yoksa kapalı (kill-switch). `remoteConfig.ts` `SAFE_DEFAULTS`'a anahtar eklenmeli (MONEY-1 §W1) |

**Kullanıcının mood metnine atıf — veri akışı:**

| kaynak | ömür | not |
|---|---|---|
| `MoodContext.lastMoodText` (`contexts/MoodContext.tsx:31,71,109`) | oturum belleği; `clearMood` korur (`:79`); `handleBrowseMovies` set eder (`MoodSearchScreen:497-499`) | Deck-end / çıkış anında mevcut; **uygulama kapanınca yok** |
| `moodSearchState._pendingMoodText` | `consumePendingMoodText()` ilk batch'te sıfırlar (`recommendations.ts:1259`) | Teklif için güvenilmez |
| `mood_searches.mood_text` (sunucu, ≤500 karakter, `parse-mood:58`) | kalıcı | İstemci okuma yolu RLS'e bağlı (013/093) — teklif için gerekirse `search_id` ile; okuma izni **doğrulanmadı** |
| `MoodDeckSummary` | mood metni **almıyor** (props: liked/disliked/deckSize/…) | Atıf için prop eklemek gerekir |

Gizlilik notu: metin zaten kullanıcı cihazında; yeni sunucu aktarımı gerekmez. Kullanıcı metninin teklif ekranında yankılanması (trim/500 karakter sınırı, çok uzun metin) tasarım kararı.

**Trial eligibility (RevenueCat) bugün:**
`purchaseService.ts:545-592` `getTrialEligibility`: `Purchases.checkTrialOrIntroductoryPriceEligibility`; `ELIGIBLE→'eligible'`, `INELIGIBLE|NO_INTRO_OFFER_EXISTS→'ineligible'`, geri kalan `'unknown'` (iOS'ta Sentry `warning`, Android her zaman unknown). RC hazır değilse `unknown`.
`utils/paywallPricing.ts:137-190` `buildOffer`: deneme **yalnız annual** + ücretsiz intro tanımlı + `eligible`. **Uygun olmayana (`ineligible`/`unknown`):** deneme vaadi yok; CTA `paywall.ctaContinueAnnual/Monthly`, açıklama `offerPaidDescAnnual/Monthly` (fiyat + yenileme), plan kartı fiyat satırı — yani standart "devam et" ücretli teklif. Fiyat yoksa `kind:'unavailable'`, `canPurchase:false` (CTA devre dışı).
Teklif metni "1 ücretsiz arama + deneme" tonunda yazılırsa `ineligible`/`unknown` kullanıcıya deneme vaadi **göstermemeli** (Apple 3.1.2; kopya `trialShown` bağlamıyla koşullanır, `PaywallBase.PaywallHeaderContext`).

---

## 7. Analytics

Mevcut (grep `posthogAnalytics.track('…')`): `champion_viewed` (`GauntletShell:1518`), `spotlight_result_viewed`, `save_for_later`, `watch_now_tapped`, `ask_shown/accepted/dismissed`,
`ai_consent_shown/granted/declined/dismissed/revoked`, `pro_mode_opened {access_reason}`, `pro_mode_paywall_shown {source}`, `mood_searched {mood_text_length}`, `mood_search_failed {error,error_code}`,
`quota_exhausted`, `mood_deck_completed`, `mood_deck_summary_action`, `paywall_triggered`, `paywall_viewed {variant}`, `paywall_shown`, `paywall_converted`, `purchase_completed {package_id,product_id}`, `purchase_cancelled`, `first_open`.

Olmayan / eksik (grep ile **0 eşleşme** ya da çağıran yok):

| funnel adımı | durum | kanıt |
|---|---|---|
| install | `first_open` var (`services/firstOpen.ts`) | — |
| teklif kartı gösterildi (`offer_shown`) | **yok** | grep 0 |
| teklif kartına dokunuldu | **yok** | — |
| `ai_search_completed` (başarılı arama) | **yok**; yakın: `mood_searched` (başlangıç), `mood_search_failed`, `mood_deck_completed` (deste sonu). Başarı = sunucuda `mood_searches` satırı (`error_code IS NULL`) | grep 0 |
| `free_search_consumed` / `free_search_available` | **yok** (kavram yok) | — |
| `trial_started` | `recordTrialStarted` (`triggerOrchestrator.ts:351`) tanımlı, `conversion/index.ts:12` dışa aktarıyor, **hiç çağrılmıyor** (grep); PostHog'da `trial_started` olayı yok | grep |
| `paid` | `purchase_completed` var ama `isPremium` olunca yalnız paket/ürün; trial/ücretli ayrımı yok (`purchaseService.ts:654-657`); webhook `period_type` okumuyor (MONEY-1 §1.11) | — |
| `paywall_*` olaylarında giriş noktası | `trigger_type` + `variant` var (`trackFunnel`, `triggerOrchestrator:333-345`); `entry_point: champion|spotlight|deck_end|deck_exit|profile` **yok** | — |
| tüm olaylarda `search_id` | yok; funnel'ı aramaya bağlayacak anahtar `search_id` (client_search_id) | — |

Önerilen minimum olay/özellik seti (rapor, karar CTO'nun): `pro_invite_shown/tapped {entry_point, day_index}`, `pro_free_search_started/completed/failed {search_id, entry_point}`,
`pro_offer_shown/dismissed {entry_point: deck_end|deck_exit|first_like, search_id}`, `paywall_*` olaylarına `entry_point`, `trial_started` (RC `period_type=TRIAL` webhook'tan veya `CustomerInfo` entitlement `periodType`'tan), `purchase_completed`'a `entry_point`+`is_trial`.
Not: `paywall_events.trigger_context` (jsonb, `types.ts:77`) bu bağlamı taşıyabilir ama olay `action` CHECK'i yalnız `shown/dismissed/converted/trial_started` (`triggerOrchestrator:271-273`) — yeni `action` migration ister.

Küçük gözlem (kapsam dışı, düzeltilmedi): `PaywallBase/index.tsx:303` `recordPaywallShown(variant).catch(() => {})` — boş catch (CLAUDE.md kural 2).

---

## 8. Maliyet ve kötüye kullanım

### Ölçülen (`mood_searches`)
```sql
select count(*) n, round(avg(llm_tokens_in)) avg_in, round(avg(llm_tokens_out)) avg_out,
       percentile_disc(0.95) within group (order by llm_tokens_out) p95_out, round(avg(latency_ms)) avg_lat
from mood_searches where llm_tokens_in is not null;
```
→ n=**49** (114 satırdan; token kolonları sonradan eklenmiş), ort. giriş **1.292**, ort. çıkış **346**, p95 çıkış **380**, ort. gecikme **3.860 ms**.

Hesap (**varsayım**: `claude-haiku-4-5` liste fiyatı ~1 $/M giriş, 5 $/M çıkış — kod modeli `parse-mood:356`; fiyat bu turda doğrulanmadı): 1.292×1e-6 + 346×5e-6 ≈ **0,0030 $ / parse-mood çağrısı**.

### Rerank (ölçülemedi)
`rerank-films` token/kullanım **loglamıyor** (`grep usage|tokens` → yalnız `max_tokens: 64 + count*4`, `:146`; Haiku). İstemci ilk batch'te 30 aday gönderiyor (`recommendations.ts:761-762`), adaylar `slice(0,50)`, her biri overview ≤150 karakter (`rerank-films:121-126`).
Kaba tahmin (ölçülmedi): ~2–3k giriş token + ≤96 çıkış ⇒ ~0,003 $. Not: PRO-FIX-2 raporu "rerank'a 8 aday" diyor, kod `FIRST_BATCH_MATCH_COUNT=30` — aralarındaki fark bu turda çözülmedi.
Toplam ücretsiz arama başına büyüklük: **~0,006 $** (üst sınır tahmini; rerank kısmı ölçülmemiş). `rerank-films` rıza ve kota kontrolü yok (rıza istemcide; sunucuda `requireUser`+`checkRateLimit` var, `:80-87`) — yani hak tüketilmemiş kullanıcı da rerank'i doğrudan çağırabilir (rate limit eşiği **okunmadı**).

Ek maliyet kalemleri: `match_films_v3` 3,8 sn keyword'lü (PRO-FIX-2); `explain-match` (Anthropic) ayrı.

### Kötüye kullanım
| risk | kanıt |
|---|---|
| Anonim yeniden kurulum = yeni hak | `signInAnonymously` kimlik başına yeni `public.users` satırı; canlı auth: 304/388 anonim. `users` içinde cihaz kimliği / attestation kolonu yok (`information_schema` taraması: `%device%` eşleşmesi 0). Hak `users` kolonuna konursa her kurulumda yeniden doğar |
| Sunucu Pro kapısı yok | Madde 1: free tier günlük **3**; hak mantığı eklenmezse "1 ücretsiz" fiilen "3/gün (istemci engelli)" |
| Fail-open kota yolları | `parse-mood:225,243` RPC hatasında geçirir (Sentry'li); canlıda ayrıca orphan dalı |
| Kota LLM öncesi, iade yok | Geçersiz girdi / LLM hatası / 503 hakkı yakar (`parse-mood:295-341,405-478`); "yalnız başarılı aramada tüketim" için akış sırası değişmeli |
| `rerank-films` bağımsız çağrılabilir | Hak/kota yok; yalnız rate limit |
| Rate limit | `_shared/rateLimit.ts` eşikleri okunmadı — **doğrulanamadı** |

Üst sınır örneği (yalnız aritmetik): 1.000 ek ücretsiz arama ≈ 6 $; 100 yeni anonim kurulum/gün × 1 hak ≈ 0,6 $/gün. Mutlak risk düşük, asıl risk "hak sonsuz" semantiği (kolon sıfırlama, merge, fail-open).

---

## Uygulama planı taslağı (YALNIZ TASLAK — onay yok, uygulama yok)

**Ön koşullar (sıra 0):** (1) MONEY-SEC-1 / 135'in push durumu netleşsin (Local 135 / Remote boş); (2) `parse-mood` repo↔canlı farkının (C.0c) deploy kararı; (3) karar: free-hak saklama şekli (S1 kolon / S2 tablo), idempotency anahtarı, boş-sonuç iadesi, merge kuralı, rıza reddi davranışı, sunucu Pro kapısı.

**Dosya listesi (olası dokunuş):**

| katman | dosya | iş |
|---|---|---|
| DB | `supabase/migrations/136_*.sql` (+ gerekirse 135 guard genişletme) | hak kolonu/tablosu, guard listesi, `merge_anonymous_user` yeniden tanımı, (ops.) iade RPC'si |
| Edge | `supabase/functions/parse-mood/index.ts` | `client_search_id`, hak tüketimi (LLM başarısı sonrası), Pro kapısı (tier/legacy/hak), (ops.) iade; **önce repo sürümü deploy** |
| Edge | `supabase/functions/merge-anonymous-user/index.ts` | değişiklik beklenmiyor (kural RPC içinde) |
| İstemci hook | `hooks/useProModeAccess.ts`, `app/pro-mode.tsx`, `services/userFlags.ts` | `freeSearchAvailable` / `reason:'free_trial'`, önbellek geçersizleme |
| İstemci arama | `services/tasteParser.ts`, `components/Home/MoodSearchScreen/index.tsx` | `client_search_id` üretimi, hak durumu hataları (`FREE_SEARCH_USED` vb.), istemci `consumeQuota` sayacıyla ilişkisi (AsyncStorage sayacı hak ile çakışır) |
| Giriş | `components/gauntlet/GauntletShell/index.tsx`, `useBelowHeight.ts`, yeni `components/gauntlet/ProInvite/*` | şampiyon satır içi kart |
| Giriş | `components/games/Spotlight/SpotlightResult.tsx` | Spotlight sonuç kartı |
| Teklif | `app/discover.tsx`, `components/MoodDeckSummary/index.tsx`, `contexts/MoodContext.tsx` | deck-end / çıkış / ilk beğeni şeridi, mood metni atfı |
| Paywall | `services/conversion/{types,triggerOrchestrator}.ts`, `components/paywalls/ContextualPaywall.tsx`, yeni `PaywallMoodOffer/*` | yeni trigger + variant (`IMMEDIATE_TRIGGERS`) |
| Bayrak | `services/remoteConfig.ts` (SAFE_DEFAULTS), `app_config` satırı | `pro_free_search_enabled` (lazy `remoteConfig.get`; varsayılan false) — yalnız UX kill-switch, yetki sunucuda |
| i18n | `locales/en.json`, `locales/tr.json` | davet, teklif, hak bitti metinleri (tam parite) |
| Analytics | `services/posthog.ts` kullanımı, ilgili bileşenler | §7 olay seti |

**Sıra önerisi (rapor):** DB şeması → `parse-mood` (repo sürümü + hak) deploy → bayrak `app_config` (kapalı) → istemci hak kapısı (hook + pro-mode) → arama akışı (`client_search_id`) → teklif / paywall variant → giriş noktaları (önce Spotlight, çünkü ask çakışması yok) → şampiyon kartı → analytics → bayrak aç.
Deploy sırası: kısıtlayıcı sunucu kapısı **istemciden önce** değil, istemci `client_search_id` göndermeden sunucu onu zorunlu kılmamalı (eski binary'ler düşmesin); sunucu önce *opsiyonel* alanı kabul etmeli.

**Riskler:** (1) eski binary'ler (rc5 ve öncesi) Pro kapısı olmadan arıyor — sunucu Pro kapısı onları keser (34 kullanıcı/38 arama ölçümü); (2) 60 sn `userCache` ve hak durumu uyuşmazlığı; (3) ask dwell'in kartla bozulması; (4) 24 sa kapısı yüzünden ilk gün teklif görünmez; (5) merge kuralı yanlışsa hak çifte doğar/kaybolur; (6) tüketim öncesi/sonrası sıralama iadesiz kalan kota; (7) rıza reddi sonrası boş durum; (8) free slot kotası (8) deste içinde paywall açabilir; (9) `rerank-films` hak dışı çağrı.

**DUR noktaları (CTO onayı):**

| # | madde | neden |
|---|---|---|
| D1 | Yeni kolon/tablo (hak) + 135 guard genişletme + `merge_anonymous_user` yeniden tanımı | Yeni şema (CLAUDE.md: yeni tablo/kolon) |
| D2 | `parse-mood` davranış değişimi: hak, `client_search_id` (istek sözleşmesi), Pro kapısı, iade; repo (C.0c) sürümünün deploy edilmesi | Edge Function değişimi + canlı farkı; eski binary etkisi |
| D3 | `useProModeAccess` sözleşmesi (`reason` tipi, yeni alan) | Tek doğruluk kaynağı hook; birden çok tüketici (`pro-mode`, `discover`, `MoodSearchScreen`, `profile`) |
| D4 | `askDecision`/`useChampionAsk` ile teklif kartı sıralaması; `useBelowHeight` yeni anahtar | Ask kuralı CTO kararı (3 Eki); hero yükseklik hesabı |
| D5 | `IMMEDIATE_TRIGGERS`'a yeni trigger; 24 sa kapısı | Ürün kararı |
| D6 | Yeni paywall variant + bileşen + `PaywallVariantName`/`TriggerType` genişlemesi, `paywall_events.action` genişlemesi | Yeni pattern / veri |
| D7 | Rıza reddi davranışı (`parseMoodLocal` geri açılsın mı) | Ürün kararı; 5.1.2(i) |
| D8 | Anonim yeniden kurulum önlemi (DeviceCheck/App Attest vb.) | Yeni bağımlılık / mimari |
| D9 | `trial_started`/`period_type` webhook ayrımı | MONEY-1 D4 ile aynı; Edge deploy |

---

## Doğrulanamayanlar

1. 17 Ağu sonrası `legacy=false, tier=free` 34 kullanıcının 38 aramasının kaynağı (eski binary / başka yol / API). Sorgulanmadı: istemci sürümü `mood_searches`'te yok.
2. `_shared/rateLimit.ts` eşikleri okunmadı; `rerank-films` rate limit ve gerçek maliyeti ölçülmedi (token loglanmıyor).
3. Haiku 4.5 liste fiyatı (1/5 $ per M) varsayım; Anthropic faturası / konsol bu turda sorgulanmadı.
4. Canlı `SUPABASE_ENV` / `CHOSY_ENV` secret durumu; repo `_shared/sentry.ts` deploy edilirse environment etiketi.
5. `public.users` satırı olmayan 55 kimliğin ne kadarının gerçekten Pro Mode/şampiyon denediği (orphan Hipotez A'ya göre bounce; yeniden ölçülmedi).
6. `readAppUserId` bootstrap penceresinde (ilk saniyeler) 403 ihtimali.
7. `mood_searches` için istemci okuma izni (RLS 013/093) — teklifte `mood_text` sunucudan okunacaksa.
8. PostHog olay sayıları (`ask_*`, `ai_consent_*`, `paywall_*`, `purchase_completed`) sorgulanmadı; "olay yok" iddiaları yalnız kod grep'idir.
9. Deste içi satır içi şerit yerleşimi / ask dwell ölçüsüne etkisi cihazda görsel olarak doğrulanmadı.
10. Sistem geri hareketiyle desteden çıkışın ayrı handler'ı olmadığı (grep) — Expo Router varsayılan davranışı cihazda denenmedi.
11. `docs/TEKNIK_BORC.md` ve bible'daki rıza-reddi / basic-mod kararları okunmadı.
12. Bu turda mevcut worktree'lerdeki (`paywall-copy`, `search-ranking`, `spotlight-result`, `ai-consent`) uçuş halindeki değişiklikler incelenmedi; `askCoordinator`/`useChampionAsk`/paywall dosyalarında çakışma olabilir.
