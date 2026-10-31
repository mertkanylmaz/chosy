# MOOD SEARCH (Pro Mode) ENVANTERİ

> **Tür:** Salt okunur keşif belgesi. Kod, migration, config, flag DEĞİŞMEDİ.
> **Tarih:** 25 Eki 2026 · **Dal:** `feat/money-1c` (HEAD 1902073 üzerine)
> **Yöntem:** Yalnızca kaynak kodu okundu. Canlı flag değerleri, canlı DB, Edge Function deploy durumu, PostHog/Sentry verisi **sorgulanmadı**; bu tür her iddia "doğrulanamadı" ile işaretlidir. "(kodda gözlem)" = koddan çıkarıldı, cihazda yeniden üretilmedi.
> **Kapsam dışı:** Gauntlet ritüeli, Spotlight, Discover sekmesi (`app/(tabs)/mood.tsx`, dondurulmuş, ilgisiz).

---

## 0. Yönetici özeti

- Pro Mode, eski mood-search'ün taşınmış hâlidir: rota `app/pro-mode.tsx` → `components/Home/MoodSearchScreen`. Serbest metin (veya 8 quick-mood kartı) → `parse-mood` (Claude Haiku 4.5) → 12 boyutlu TasteProfile → 384 boyutlu vektör → `match_films_v3` RPC → (bayrak açıksa) `rerank-films` (Haiku) → kalite süzgeci → **8 filmlik deste** (`app/discover.tsx`).
- Erişim: `isPremium || legacy_mood_access`. MONEY-1C ile, `mood_offer_enabled` açıkken ücretsiz kullanıcıya **sunucuda sayılan günlük ücretsiz arama** verilir; ücretsiz destede ilk `free_visible_count` (varsayılan 3) film görünür, kalanı kilit kartı arkasındadır.
- Sağ kaydırma = watchlist'e kaydet (+ kullanıcı vektörü EMA + taste signal); sol = geç (yalnız taste signal −0.2). `swipes` tablosuna yazılmaz. Öğrenme **vardır** ama iki yazarlı ve kısmen idempotent değil (bkz. §4).
- Öneri hattının asıl riskleri: (a) kullanıcı filtreleri (7+/8+/Top250/dönem) gevşetme zincirinde **sessizce** gevşer; (b) RPC hata/boş durumunda JS fallback tüm `films` tablosundan rastgele gürültülü, **uydurma eşleşme yüzdeli** deste üretir ve kullanıcı farkı görmez; (c) kart etiketleri ve hata mesajlarının bir kısmı `t()` dışı sabit İngilizce; (d) TR metinlerin bir kısmı aksansız.
- Doğrulanamayanlar: canlı flag değerleri (`use_hybrid_recommendation`, `use_llm_reranker` DB'de 042/044 ile `true` tohumlanmış ama güncel değer okunmadı), `mood_history` view tanımı (migration'larda yok), rerank-films / parse-mood güncel deploy sürümleri (runbook'a göre parse-mood v43 25 Eki'de deploy edildi).

---

## 1. Akış haritası: ekranlar ve durumlar

### 1.1 Giriş noktaları

| # | Giriş | Konum | Hedef | Not |
|---|---|---|---|---|
| E1 | Profil → "Pro Mode" satırı | `app/(tabs)/profile.tsx` (~2027) | `/pro-mode` | Kilit ikonu kozmetik; premiumda da görünür |
| E2 | Gauntlet şampiyon kartı daveti | `components/gauntlet/MoodInviteCard`, `GauntletShell` (~1818) | `/pro-mode?entry=champion_card` | Premium/trial kullanıcı daveti **görmez** |
| E3 | Spotlight sonucu daveti | `SpotlightResult` (~331) | `/pro-mode?entry=spotlight_card` | Aynı kart |
| — | Onboarding (`?onboarding=1`) | `MoodSearchScreen` içi dallar | — | Artık hiçbir çağıran bu parametreyi vermiyor; dallar fiilen ölü |

`(tabs)/mood.tsx` (dondurulmuş Discover sekmesi) Pro Mode'a **bağlı değildir**.

### 1.2 Kapı: `app/pro-mode.tsx`

Durumlar sırasıyla:

1. **Kontrol/yükleme** — spinner (erişim ve kota okunurken).
2. **Hata** — `proMode.errorTitle / errorBody`, yalnız "Geri" düğmesi.
3. **`gate === 'offer'`** (günlük ücretsiz hak bitti, bayrak açık) — `moodOffer.offerTitle / offerBody(Time) / offerCta`; CTA → paywall `mood_offer` (entry `quota_exhausted`). Paywall açılamazsa Sentry warning.
4. **`locked`** (hak yok/bayrak kapalı, premium değil) — `proMode.lockedTitle / lockedBody`, CTA `profile.chosyPro` → paywall `profile_upgrade` (entry `pro_mode_locked`).
5. **İzinli** — `MoodSearchScreen`. `gate === 'enter'` olunca `pro_mode_opened {access_reason: premium | legacy | free_search}` atılır.

Karar mantığı: `decideProModeGate` (`utils/searchQuota.ts`). Kota bilinmiyorsa "var" varsayılır; asıl zorlama sunucudadır (parse-mood).

### 1.3 `MoodSearchScreen` — 3 faz: `input → processing → result`

**Giriş fazı (input)** — yukarıdan aşağıya:

1. Kompakt arama çubuğu (placeholder `mood.discoverSearchPlaceholder`) + gönder oku; filtre tetikleyici (aktif sayı rozeti).
2. **FilterBottomSheet**: Dönem (Any / Recent / 2010s / 2000s / 90s / Classic) ve IMDb (Any / 7+ / 8+ / Top250). Eşleme: 7+ → `minRating 7`, 8+ → 8, Top250 → `'top250'` = **8.5**.
3. **MoodCardGrid** — 8 quick-mood kartı: rainy, mindbending, datenight, adrenaline, laugh, nostalgia, cozy, emotional. **Dokunmak yalnız metin kutusunu doldurur, aramayı başlatmaz.** Doldurulan metin kart başlığı değil, uzun bir İngilizce/Türkçe cümledir ("… not X" olumsuzlamaları içerir). Tam metinler §2.
4. **TodaySearchCard** — cihazda saklanan bugünün destesi (flag'e bağlı); dokununca `mood_today_deck_reopened`.
5. **"Son Aramalar"** — `mood_history` view'ından 3 kayıt (`getMoodHistory`). View tanımı migration'larda yok (doğrulanamadı).
6. Alt sabit düğme **Find My Movie** — ≥2 karakter olana kadar pasif (ipucu `mood.findMoviesHint`).
7. Rıza yoksa düğmenin üstünde **inline blok** (`aiConsent.inlineBody` + `aiConsent.inlineEnableAndFind`). Ayrı sheet yoktur.
8. Ücretsiz arama hakkı varsa `moodOffer.freeSearchHint`.
9. Hata bandı (kapatılabilir; tipe göre ikon).

**Gönderim (`handleFindMovies`) sırası:** (1) metin uzunluğu; (2) `hasAiConsent()` — **fail-closed**, rıza yoksa inline blok; (3) kota yolu (aşağıda); (4) `parseMood`; (5) öneri hattı; (6) sonuç fazı. Arama sırasında `AI_CONSENT_REQUIRED` dönerse giriş fazına dönülüp rıza bloğu gösterilir.

**Kota yolları**

| Durum | Davranış |
|---|---|
| `mood_offer_enabled` **kapalı** | İstemci AsyncStorage sayacı `consumeQuota('search')` (ücretsiz 3/gün, istemci sabiti). Duvar → `quota_exhausted` paywall, paywall çıkmazsa `QuotaExhausted` modal. |
| `mood_offer_enabled` **açık** | İstemci sayacı atlanır. Sunucu `parse-mood` 429 `QUOTA_EXCEEDED` → `mood_offer` paywall (olmazsa kota duvarı). |
| Legacy kohort (`quotaExempt`) | Yalnız **istemci** duvarı atlanır; sunucu tarafı migration 115 ile `-1 = sınırsız` (sayar ama kesmez). |
| Satın alma sonrası "aktifleştiriliyor" | En çok 10 deneme × 3 sn, aynı `client_search_id` ile (`moodOffer.activating / activatingTimeout`). |
| Aynı metin, bitmemiş deneme | `createSearchAttempts` aynı `client_search_id`'yi yeniden kullanır (yalnız bayrak açıkken) → sunucuda replay/idempotency. |

**Yükleme (AIProcessingOverlay)** — Minimum görünme 1500 ms (`MIN_PROCESSING_MS`); adımlar `aiProcessing.step1..3` (adım 0→1 zamanlı 1100 ms, adım 3 parse bitince); 12 sn (`TIMEOUT_MS`) sonra "Yeniden dene" + `slowConnection`. Retry yalnız `setPhase('input')` yapar, **uçuştaki isteği iptal etmez** (kodda gözlem).

**Sonuç fazı (result)**
- `MoodProfileResult`: 4 kart (emotion / energy / pacing / depth); profil adı **yerelde** baskın duygudan türetilir. LLM'in ürettiği `profile_name`/`profile_description` istemcide **kullanılmıyor**.
- "Share Your Mood" → `MoodShareCard` + `useShareCapture` (`app_share_initiated/completed`, `card_type` varsayılan `share_card`).
- "Browse Movies" → `handleBrowseMovies`: `setMoodResult` + `router.push('/discover')`. Önyükleme (`startPreload`) sonuç fazı başlarken zaten çalışır (`feed_preload_hit/awaited`).

### 1.4 Deste: `app/discover.tsx`

| Durum | Ne gösterilir |
|---|---|
| Yükleniyor | Skeleton kart |
| Hata | `ErrorState` (+ yeniden dene) |
| Boş | `EmptyState`: `discover.emptyTitle` / `tryNewMoodSubtitle`, düğme `newMoodButton` → `handleNewMood` |
| Normal | Üstte "x / y" ilerleme çubuğu, kaydırılabilir kart yığını, X ve kalp düğmeleri |
| Kaydet toast'ı | `discover.savedToWatchlist`, 1.2 sn |
| Kilit kartı | `MoodLockCard` (variant `lock` / `skeleton`). Koşul: bayrak açık + yetkisiz + ≥2 gizli film; `free_visible_count` filmden sonra. Gizli posterler önceden indirilmez. Kilitte deste "tamamlandı" sayılmaz. |
| Deste sonu | `MoodDeckSummary` |

**Sağ/sol kaydırma anlamları (`SwipeableCard`)**
- **Sağ** = kaydet (watchlist). **Sol** = geç. Eşik: ekran genişliğinin %30'u **veya** hız > 500. Pan `activeOffsetX ±15`, `failOffsetY ±10`. Düğmeler: X (sol), kalp (sağ).
- **Kart dokunuşu** → `/film/[id]` (kart detayı, §1.5).
- Kart üstü rozetler (sabit İngilizce): "💎 Hidden Gem", "⭐ AI Pick", "🎲 Unexpected"; "match" yüzdesi; şablon açıklamalar ("A %s film that perfectly matches your mood" …). `pick_type`: `determinePickType` — benzerlik ≥0.8 ⇒ `ai_pick`; 4≤oy<7 ve benzerlik ≥0.5 ⇒ `hidden_gem`; tür-aykırı ⇒ `unexpected`. `markSurpriseCards`: her 6. film (destede 6. sıra) sürpriz işaretlenir. **"AI Pick" LLM seçimi değil, benzerlik ≥0.8 anlamına gelir.**
- `matchScore = min(100, round(güçlendirilmiş benzerlik × 100))` — tier çarpanı 1.15 doygunluğa götürebilir.
- RPC yolunda `moodTags: []` olduğundan kart meta satırı yalnız yıl · puan gösterir; `whyThisFilm = "Matches your mood: <match_reason>"` — SQL `match_reason` eşleşen anahtar kelime yoksa ilk 3 `tmdb_keywords`'e düşer, bu yüzden önek yanıltıcı olabilir.

**Sağ kaydırma yan etkisi — slot kotası (`handleSwipeRight`)**: Premium/legacy/ücretsiz-arama-destesi muafiyeti yoksa istemci `checkAndConsumeQuota(uid,'slot')` (ücretsiz istemci limiti 8/gün). Tükenirse: `recordSwipeRight`, `setDeckFrozen(true)`, `triggerPaywall({quota_exhausted, slot})` — **dönüş değeri yok sayılır**. `quota_exhausted` anında tetiklenen türden değildir (yeni kullanıcı 24 sa, 24 sa soğuma, 3 kapatmadan sonra 7 gün), paywall `null` dönebilir ⇒ dondurulmuş, tepkisiz deste (kodda gözlem, üretilmedi).

**X düğmesi / "Yeni mood"**: `handleNewMood` → `clearMood(); router.navigate('/(tabs)')`. Yani kullanıcı **Gauntlet ana sayfasına** düşer, Pro Mode giriş ekranına değil.

**Deste sonu (`MoodDeckSummary`)**: beğenilen/geçilen/toplam; "kahraman" = beğenilenler arasında en yüksek `matchScore`; mini posterler; deste <8 ise yetersiz sonuç notu; düğmeler: yeni mood, watchlist (`/(tabs)/profile`), kapat (`dismissTo('/(tabs)')`).

### 1.5 Kart detayı: `app/film/[id].tsx`
- "Why this film?" — `explainBatch` (edge `explain-match`) **yalnız AI rızası varsa**; yoksa CTA `aiConsent.explainCta`.
- Watchlist ekle/çıkar, izlendi toggle, fragman, paylaş.
- Çıkışta ≥1 sn kalındıysa `tasteSignals.recordDetailView` (30 sn debounce).

### 1.6 Hata / boş durum matrisi

| Durum | Nerede | Kullanıcıya | Not |
|---|---|---|---|
| Rıza yok | MoodSearchScreen | Inline rıza bloğu | Fail-closed |
| Metin <2 karakter | MoodSearchScreen / parse-mood | Düğme pasif / `INVALID_INPUT` | Sunucu kotadan **önce** doğrular |
| Aynı arama sürüyor | parse-mood 409 `IN_PROGRESS` | Sessiz yeniden deneme (≤3, 1–8 sn) → `moodOffer.errorInProgress` | |
| Kota doldu | parse-mood 429 | `mood_offer` paywall / kota duvarı | |
| Kota servisi yok | 503 `QUOTA_UNAVAILABLE`/`TIER_NOT_CONFIGURED` | `moodOffer.errorQuotaUnavailable` | Fail-closed |
| Hesap kurulumu eksik | 403 `APP_USER_MISSING` | `errors.accountSetupIncomplete*` | |
| LLM/ağ hatası | parse-mood | `toUserError(...,'mood')` → **sabit İngilizce** (rule 7 ihlali) | Kota iadesi (refundPolicy) |
| Anthropic kredisi bitti | parse-mood | 503 `SERVICE_UNAVAILABLE` + Sentry fatal | |
| Sonuç yok | discover | `EmptyState` | |
| RPC hatası/boş | recommendations | **Kullanıcı farkı görmez**; JS fallback destesi | §3.8 |
| Deste yükleme hatası | discover | `ErrorState` (+ retry) | |
| 12 sn yükleme | Overlay | Retry + `slowConnection` | İptal etmez |

### 1.7 Paywall girişleri

| Tetik | Paywall | Entry/anahtar |
|---|---|---|
| Profil kilidi (`locked`) | `profile_upgrade` | `pro_mode_locked` |
| Günlük ücretsiz hak bitti (kapı) | `mood_offer` | `quota_exhausted` |
| Arama anında sunucu 429 (bayrak açık) | `mood_offer` | `quota_exhausted` |
| Arama anında istemci duvarı (bayrak kapalı) | `quota_exhausted` (PaywallQuotaExhausted) → yoksa `QuotaExhausted` modal | `search` |
| Kilit kartı (destede) | `mood_offer` (varyant "deck") | `moodLock.*` → `PaywallMoodOffer` (`paywallTitleDeck`) |
| Sağ kaydırma slot kotası | `quota_exhausted` | `slot` — dönüş değeri yok sayılır |
| Gauntlet/Spotlight daveti | paywall değil; Pro Mode'a götürür | `mood_invite_*` |

Paywall olayları: `paywall_triggered`, `paywall_variant_skipped`, `paywall_viewed`, `paywall_shown/dismissed/converted`, `paywall_plan_selected`, `mood_offer_shown/cta/dismissed`, `purchase_completed`.

---

## 2. Kullanıcıya görünen metinler (en / tr)

Aşağıdaki tablolar `locales/en.json` ve `locales/tr.json`'dan betikle üretildi (eksik anahtar: yok; en/tr parite tam). `⏎` = metin içi satır sonu.

#### Giriş kapısı (`app/pro-mode.tsx`) ve Profile satırı

| Anahtar | EN | TR |
|---|---|---|
| `proMode.title` | Pro Mode | Pro Mode |
| `proMode.lockedTitle` | Pro Mode is part of Chosy Pro | Pro Mode, Chosy Pro'nun parçası |
| `proMode.lockedBody` | Describe how you feel and get a film matched to your mood — beyond tonight's four. | Nasıl hissettiğini anlat, mood'una uyan filmi bul — bu akşamın dört filminin ötesinde. |
| `proMode.errorTitle` | We couldn't check your access | Erişimini kontrol edemedik |
| `proMode.errorBody` | The connection dropped before we could confirm your plan. Try again in a moment. | Planını doğrulayamadan bağlantı koptu. Birazdan tekrar dene. |
| `profile.proSection` | Membership | Üyelik |
| `profile.proMode` | Pro Mode | Pro Mode |
| `profile.proModeSubtitle` | Describe a mood, get a matching film | Bir mood anlat, sana uyan filmi bul |
| `profile.chosyPro` | Chosy Pro | Chosy Pro |
| `profile.chosyProSubtitle` | Find a film for the mood you're in | Bulunduğun ruh haline uygun bir film bul |
| `common.back` | Back | Geri |

#### Gauntlet daveti (`MoodInviteCard`)

| Anahtar | EN | TR |
|---|---|---|
| `moodOffer.inviteTitle` | Want a pick that matches your mood? | Mood'una uyan bir film ister misin? |

#### Giriş ekranı — arama çubuğu, buton, ipuçları, son aramalar

| Anahtar | EN | TR |
|---|---|---|
| `mood.discoverSearchPlaceholder` | What do you feel like watching? | Ne izlemek istiyorsun? |
| `mood.findMovies` | Find My Movie | Filmimi Bul |
| `mood.findMoviesHint` | Pick a mood | Bir ruh hali seç |
| `mood.onboardingFreeSearch` | ✨ Your first search is on us! | ✨ Ilk aramaniz bizden! |
| `mood.onboardingFreeHint` | Explore 5 films, then choose your plan | 5 film kesfedin, sonra planınızı secin |
| `mood.discoverRecentTitle` | Recent Searches | Son Aramalar |
| `moodOffer.freeSearchHint` | Today's free search · %{count} picks included | Bugünün ücretsiz araması · %{count} öneri dahil |
| `moodOffer.todayCardTitle` | Today's search | Bugünün araması |
| `moodOffer.todayCardCount` | %{count} picks | %{count} öneri |

#### Giriş ekranı — Quick mood kartları (başlık / alt başlık / aranan metin)

| Anahtar | EN | TR |
|---|---|---|
| `mood.moodCardRainyTitle` | Rainy Night | Yagmurlu Gece |
| `mood.moodCardRainySubtitle` | Films that pull you in deep | Icine cekilmek istedigin filmler |
| `mood.quickRainyPrompt` | A cozy, warm and peaceful evening, calm and contemplative, slow-paced and quiet, not action, not thriller | Sakin ve huzurlu, sıcak ve düşündürücü, yavaş tempolu rahatlatıcı bir akşam, aksiyon değil, gerilim değil |
| `mood.moodCardMindTitle` | Mind-Bending | Zihin Buken |
| `mood.moodCardMindSubtitle` | Stories that twist your brain | Kafani karistiracak hikayeler |
| `mood.quickDeepPrompt` | A deep and thought-provoking philosophical film, mind-bending and complex, not comedy, not lighthearted | Derin ve düşündüren felsefi bir film, zihin büken ve karmaşık, komedi değil, hafif değil |
| `mood.moodCardDateTitle` | Date Night | Romantik Aksam |
| `mood.moodCardDateSubtitle` | A romantic pick for two | Ikiniz icin romantik secim |
| `mood.quickDatePrompt` | Romantic and heartfelt, a tender love story for a couple, intimate and warm, not horror, not scary | Romantik ve duygusal bir aşk hikayesi, sevgiliyle sıcak ve huzurlu, korku değil, gerilim değil |
| `mood.moodCardAdrenalineTitle` | Adrenaline | Adrenalin |
| `mood.moodCardAdrenalineSubtitle` | Get your heart racing | Nabzini hizlandiracak aksiyon |
| `mood.quickThrillPrompt` | Adrenaline-fueled action, thrilling and exciting, fast-paced and intense, not comedy, not drama | Heyecan dolu aksiyon ve macera, hızlı tempolu gerilim, adrenalin, komedi değil, dram değil |
| `mood.moodCardLaughTitle` | Comedy | Komedi |
| `mood.moodCardLaughSubtitle` | Guaranteed laughs | Kahkaha garantili |
| `mood.quickLaughPrompt` | Something genuinely funny and lighthearted, a comedy to lift my spirits, not action, not thriller | Gerçekten komik ve eğlenceli, kahkaha attıran hafif bir komedi, aksiyon değil, gerilim değil |
| `mood.moodCardNostalgiaTitle` | Nostalgia | Nostalji |
| `mood.moodCardNostalgiaSubtitle` | A trip to the good old days | Eski guzel gunlere yolculuk |
| `mood.quickNostalgiaPrompt` | Nostalgic and sentimental, like a warm childhood memory, cozy and bittersweet, not scary, not intense | Nostaljik ve sıcak, çocukluk anısı gibi huzurlu, duygusal ve hafif hüzünlü, korku değil, aksiyon değil |
| `mood.moodCardCozyTitle` | Cozy Night | Rahat Aksam |
| `mood.moodCardCozySubtitle` | No thinking, just enjoy | Hic dusunmeden izlenecek |
| `mood.quickChillPrompt` | Light, fun and entertaining, relaxing and easy, chill and cozy, no heavy thinking, not scary, not sad | Hafif, eğlenceli ve rahatlatıcı, sakin ve huzurlu, korku değil, üzücü değil, aksiyon değil |
| `mood.moodCardEmotionalTitle` | Emotional | Duygusal |
| `mood.moodCardEmotionalSubtitle` | An emotional journey awaits | Duygusal bir yolculuk istiyorum |
| `mood.quickCryPrompt` | A sad and emotional tearjerker drama, melancholic and moving, heartbreaking and deep, not comedy, not action | Üzücü ve duygusal hüzünlü bir dram, derinden hissettiren gözyaşı, komedi değil, aksiyon değil |

#### Giriş ekranı — Filtre sayfası (FilterBottomSheet)

| Anahtar | EN | TR |
|---|---|---|
| `mood.filterTrigger` | Filter | Filtrele |
| `mood.filterActiveCount` | %{count} active | %{count} aktif |
| `mood.filterSheetTitle` | Filters | Filtreler |
| `mood.eraLabel` | ERA | DÖNEM |
| `mood.qualityLabel` | IMDb RATING | IMDb PUANI |
| `mood.chipAny` | Any | Farketmez |
| `mood.chipRecent` | Recent | Güncel |
| `mood.chip2010s` | 2010s | 2010'lar |
| `mood.chip2000s` | 2000s | 2000'ler |
| `mood.chip90s` | 90s | 90'lar |
| `mood.chipClassic` | Classic | Klasik |
| `mood.chip7plus` | IMDb 7+ | IMDb 7+ |
| `mood.chip8plus` | IMDb 8+ | IMDb 8+ |
| `mood.chipTop250` | IMDb Top 250 | IMDb Top 250 |
| `mood.filterClear` | Clear | Temizle |
| `mood.filterApply` | Apply | Uygula |

#### AI rızası (inline blok + sheet metinleri)

| Anahtar | EN | TR |
|---|---|---|
| `aiConsent.title` | Let Claude help you choose | Seçmene Claude yardım etsin |
| `aiConsent.intro` | Searches and personal explanations run on Claude, an AI from Anthropic. | Aramalar ve kişisel açıklamalar, Anthropic'in yapay zekâsı Claude ile çalışır. |
| `aiConsent.sentLabel` | Sent | Gönderilen |
| `aiConsent.sentText` | The text you type for a search and the mood profile taken from that search. | Arama için yazdığın metin ve bu aramadan çıkarılan mood profili. |
| `aiConsent.purposeLabel` | Used for | Amaç |
| `aiConsent.purposeText` | Picking films and explaining why they fit. | Film önermek ve neden uyduğunu açıklamak. |
| `aiConsent.notSentLabel` | Not sent | Gönderilmeyen |
| `aiConsent.notSentText` | Your email and account details. | E-postan ve hesap bilgilerin. |
| `aiConsent.accept` | Accept | Kabul |
| `aiConsent.decline` | Not now | Şimdi değil |
| `aiConsent.saveError` | Couldn't save your choice. Try again. | Seçimin kaydedilemedi. Tekrar dene. |
| `aiConsent.offBody` | AI suggestions are off. You can turn them on in Settings. | AI önerileri kapalı. Ayarlar'dan açabilirsin. |
| `aiConsent.openSettings` | Open Settings | Ayarlardan aç |
| `aiConsent.explainCta` | Turn on personal explanation | Kişisel açıklamayı aç |
| `aiConsent.inlineBody` | Your search text and the mood we detect from it are sent to Anthropic's AI to find films. No account info is shared. | Arama metnin ve ondan çıkardığımız ruh hâli, film bulmak için Anthropic'in yapay zekâsına gönderilir. Hesap bilgilerin paylaşılmaz. |
| `aiConsent.inlineEnableAndFind` | Enable AI & Find Movies | Yapay zekâyı aç ve film bul |

#### Yükleme (AIProcessingOverlay)

| Anahtar | EN | TR |
|---|---|---|
| `aiProcessing.title` | AI Processing | AI İşleniyor |
| `aiProcessing.subtitle` | Analyzing your mood... | Ruh halin analiz ediliyor... |
| `aiProcessing.step1` | Reading emotions | Duygular okunuyor |
| `aiProcessing.step2` | Finding patterns | Örüntüler bulunuyor |
| `aiProcessing.step3` | Matching films | Filmler eşleştiriliyor |
| `aiProcessing.retry` | Try Again | Tekrar Dene |
| `aiProcessing.slowConnection` | Connection seems slow | Bağlantı yavaş görünüyor |

#### Ara sonuç — Mood profili (MoodProfileResult) ve paylaşım

| Anahtar | EN | TR |
|---|---|---|
| `moodProfile.title` | Mood Profile Result | Ruh Hali Profil Sonucu |
| `moodProfile.currentProfile` | Current Mood: | Mevcut Ruh Hali: |
| `moodProfile.description` | This profile shapes your personalized film recommendations. | Bu profil kişiselleştirilmiş film önerilerini şekillendirir. |
| `moodProfile.browseMovies` | Browse Movies | Filmlere Göz At |
| `moodProfile.labelEmotion` | EMOTION | DUYGU |
| `moodProfile.labelEnergy` | ENERGY LEVEL | ENERJİ SEVİYESİ |
| `moodProfile.labelPacing` | PACING | TEMPO |
| `moodProfile.labelColorTone` | COLOR TONE | RENK TONU |
| `moodProfile.emotionJoyful` | Joyful | Neşeli |
| `moodProfile.emotionMelancholic` | Melancholic | Melankolik |
| `moodProfile.emotionIntense` | Intense | Yoğun |
| `moodProfile.emotionAnxious` | Anxious | Gergin |
| `moodProfile.emotionCurious` | Curious | Meraklı |
| `moodProfile.emotionCritical` | Critical | Seçici |
| `moodProfile.emotionEager` | Eager | Hevesli |
| `moodProfile.emotionSerene` | Serene | Huzurlu |
| `moodProfile.emotionCalm` | Calm | Sakin |
| `moodProfile.descJoyful` | Uplifted and bright | Neşe dolu ve parlak |
| `moodProfile.descMelancholic` | Deep emotional resonance | Derin duygusal yankı |
| `moodProfile.descIntense` | Passionate intensity | Tutkulu yoğunluk |
| `moodProfile.descAnxious` | Edge of your seat | Koltuğun ucunda |
| `moodProfile.descCurious` | Open to surprises | Sürprizlere açık |
| `moodProfile.descCritical` | Discerning taste | Seçici bir zevk |
| `moodProfile.descEager` | Eager for more | Daha fazlası için hevesli |
| `moodProfile.descSerene` | Warm and trusting | Sıcak ve güvenen |
| `moodProfile.energyVeryLow` | Very Low | Çok Düşük |
| `moodProfile.energyLow` | Low | Düşük |
| `moodProfile.energyMediumLow` | Medium-Low | Orta-Düşük |
| `moodProfile.energyMedium` | Medium | Orta |
| `moodProfile.energyMediumHigh` | Medium-High | Orta-Yüksek |
| `moodProfile.energyHigh` | High | Yüksek |
| `moodProfile.descEnergyLow` | Lower physical energy. | Düşük fiziksel enerji. |
| `moodProfile.descEnergyMedium` | Balanced energy level. | Dengeli enerji seviyesi. |
| `moodProfile.descEnergyHigh` | High-energy state. | Yüksek enerjili hal. |
| `moodProfile.paceSlow` | Slow | Yavaş |
| `moodProfile.paceMedium` | Balanced | Dengeli |
| `moodProfile.paceFast` | Fast-Paced | Hızlı Tempolu |
| `moodProfile.descPaceSlow` | A leisurely tempo. | Rahat bir tempo. |
| `moodProfile.descPaceMedium` | Steady narrative flow. | Sabit anlatı akışı. |
| `moodProfile.descPaceFast` | High-octane energy. | Yüksek oktanlı enerji. |
| `moodProfile.depthLight` | Light | Hafif |
| `moodProfile.depthModerate` | Moderate | Orta |
| `moodProfile.depthDeep` | Deep | Derin |
| `moodProfile.depthProfound` | Profound | Felsefi |
| `moodProfile.descDepthLight` | Easy and fun watching. | Kolay ve eğlenceli izleme. |
| `moodProfile.descDepthModerate` | Thought-provoking layers. | Düşündürücü katmanlar. |
| `moodProfile.descDepthDeep` | Philosophical depth. | Felsefi derinlik. |
| `share.shareYourMood` | Share Your Mood | Mood'unu Paylaş |
| `share.sharing` | Sharing... | Paylaşılıyor... |

#### Deste — ilerleme, toast, boş durum

| Anahtar | EN | TR |
|---|---|---|
| `deckSummary.deckProgress` | %{current} of %{total} | %{current} / %{total} |
| `discover.savedToWatchlist` | Saved to watchlist! | İzleme listesine eklendi! |
| `discover.emptyTitle` | That's all! | Hepsi bu kadar! |
| `discover.tryNewMoodSubtitle` | Try a new mood to discover more films | Daha fazla film keşfetmek için yeni bir mood dene |
| `discover.newMoodButton` | Try New Mood | Yeni Mood Dene |

#### Deste — kilit kartı (ücretsiz kullanıcı)

| Anahtar | EN | TR |
|---|---|---|
| `moodLock.title` | There's more to this mood. | Bu ruh halinde daha fazlası var. |
| `moodLock.counter` | %{visible} of %{total} | %{total} filmden %{visible} |
| `moodLock.cta` | See all %{total} with Chosy Pro | Chosy Pro ile %{total} filmin hepsini gör |
| `moodLock.keep` | Your first %{visible} are yours to keep. | İlk %{visible} öneri senin, kalıcı. |
| `moodLock.a11yLocked` | Locked picks. Double tap to see all with Chosy Pro. | Kilitli öneriler. Chosy Pro ile hepsini görmek için çift dokun. |

#### Deste sonu özeti (MoodDeckSummary)

| Anahtar | EN | TR |
|---|---|---|
| `deckSummary.title` | %{count} films added to watchlist | %{count} film watchlist'e eklendi |
| `deckSummary.noLikesTitle` | No matches this time | Bu sefer tutmadi |
| `deckSummary.subtitle` | Your watchlist just got better. Time to pick one for tonight! | Watchlist'in guclenmeye devam ediyor. Bu aksam icin birini sec! |
| `deckSummary.noLikesSubtitle` | Try a different mood — your perfect film is out there. | Farkli bir mood dene — sana gore filmler mutlaka var. |
| `deckSummary.liked` | Liked | Begendim |
| `deckSummary.passed` | Passed | Gectim |
| `deckSummary.total` | Total | Toplam |
| `deckSummary.tonightsPick` | TONIGHT'S PICK | BU AKSAMIN ONERISI |
| `deckSummary.topMatch` | TOP MATCH | EN IYI ESLESME |
| `deckSummary.addedToWatchlist` | ADDED TO WATCHLIST | WATCHLIST'E EKLENENLER |
| `deckSummary.insufficientNote` | We found fewer strong matches for this mood. | Bu mood icin sinirli sayida guclu eslesme bulduk. |
| `deckSummary.newMood` | Try New Mood | Yeni Mood Ara |
| `deckSummary.goWatchlist` | Go to Watchlist | Watchlist'e Git |
| `deckSummary.deckProgress` | %{current} of %{total} | %{current} / %{total} |
| `deckSummary.close` | Close | Kapat |

#### Hata / yükleme-hatası durumları (`ErrorState`, deste hata ekranı)

| Anahtar | EN | TR |
|---|---|---|
| `errorState.networkTitle` | No connection | Bağlantı yok |
| `errorState.networkSubtitle` | Check your internet connection and try again | İnternet bağlantını kontrol edip tekrar dene |
| `errorState.authTitle` | Session expired | Oturum süresi doldu |
| `errorState.authSubtitle` | Please restart the app to continue | Devam etmek için uygulamayı yeniden başlat |
| `errorState.serverTitle` | Couldn't reach the server | Sunucuya ulaşılamadı |
| `errorState.serverSubtitle` | Try again in a moment. | Birazdan tekrar dene. |
| `errorState.emptyTitle` | No results found | Sonuç bulunamadı |
| `errorState.emptySubtitle` | Try adjusting your filters or describing a different mood | Filtrelerini ayarla veya farklı bir ruh hali dene |
| `errorState.quotaTitle` | Daily limit reached | Günlük limit doldu |
| `errorState.quotaSubtitle` | Upgrade to Chosy Pro for more searches | Daha fazla arama için Chosy Pro'ya geç |
| `errorState.unknownTitle` | This couldn't load | Bu yüklenemedi |
| `errorState.unknownSubtitle` | Try again. | Tekrar dene. |
| `errorState.boundaryTitle` | The app stopped unexpectedly | Uygulama beklenmedik şekilde durdu |
| `errorState.boundaryMessage` | We've been notified. Try again. | Bildirim bize ulaştı. Tekrar dene. |
| `errorState.tryAgain` | Try Again | Tekrar Dene |

#### Arama hataları ve hak mesajları

| Anahtar | EN | TR |
|---|---|---|
| `errors.accountSetupIncomplete` | Mood search can't run on this account right now. We've been notified. | Bu hesapta mood araması şu an çalışmıyor. Bildirim bize ulaştı. |
| `errors.accountSetupIncompleteTitle` | Search unavailable | Arama kullanılamıyor |
| `errors.moodAnalyze` | Your mood couldn't be read. Try again. | Ruh halin okunamadı. Tekrar dene. |
| `errors.noMoviesFound` | No movies found. Try a different mood. | Film bulunamadı. Farklı bir mood dene. |
| `errors.loadRecommendations` | Recommendations couldn't load. Try again. | Film önerileri yüklenemedi. Tekrar dene. |
| `moodOffer.errorQuotaUnavailable` | Search is temporarily unavailable. You haven't used a search — try again in a moment. | Arama geçici olarak kullanılamıyor. Arama hakkın harcanmadı — birazdan tekrar dene. |
| `moodOffer.errorInvalidInput` | Add a few more words — at least 2 characters — and try again. | Biraz daha yaz — en az 2 karakter — ve tekrar dene. |
| `moodOffer.errorInProgress` | Your search is still being prepared. Try again in a moment. | Aramanın hazırlanması sürüyor. Birazdan tekrar dene. |
| `moodOffer.activating` | Activating Pro… | Pro etkinleştiriliyor… |
| `moodOffer.activatingTimeout` | Pro is taking a moment to activate. Try your search again shortly. | Pro'nun etkinleşmesi biraz sürüyor. Aramanı birazdan tekrar dene. |
| `quota.remaining` | %{count} searches left today | Bugün %{count} arama hakkın kaldı |
| `quota.remainingWeekly` | %{count} searches left this week | Bu hafta %{count} arama hakkın kaldı |
| `quota.exhaustedTitle` | Search limit reached | Arama limitine ulaştın |
| `quota.exhaustedDaily` | You've used all your daily searches. Come back tomorrow or upgrade for more. | Bugünkü arama hakkın doldu. Yarın tekrar gel veya yükselt. |
| `quota.exhaustedWeekly` | You've reached your weekly limit. Upgrade for more searches. | Haftalık limitine ulaştın. Daha fazlası için yükselt. |
| `quota.exhaustedFree` | You've used your free searches. Upgrade to Chosy Pro for more. | Ücretsiz arama hakkını kullandın. Daha fazlası için Chosy Pro'ya yükselt. |
| `quota.limitInfo` | %{used}/%{limit} used today | Bugün %{used}/%{limit} kullanıldı |
| `quota.upgradeButton` | Upgrade to Chosy Pro | Chosy Pro'ya Yükselt |
| `quota.waitUntil` | Resets %{time} | %{time} tarihinde sıfırlanır |

#### Hak bitti ekranı ve teklif (Pro Mode içinde + PaywallMoodOffer)

| Anahtar | EN | TR |
|---|---|---|
| `moodOffer.offerTitle` | You're out of free searches for today | Bugünlük ücretsiz aramaların bitti |
| `moodOffer.offerBodyTime` | More free searches in %{time}. Or search without limits with Chosy Pro. | %{time} sonra yeniden ücretsiz arama hakkın olacak. Ya da Chosy Pro ile sınırsız ara. |
| `moodOffer.offerBody` | Your free searches reset tomorrow. Or search without limits with Chosy Pro. | Ücretsiz arama hakların yarın yenilenir. Ya da Chosy Pro ile sınırsız ara. |
| `moodOffer.offerCta` | Unlimited with Pro | Pro ile sınırsız |
| `moodOffer.timeHoursMinutes` | %{hours}h %{minutes}m | %{hours} sa %{minutes} dk |
| `moodOffer.timeMinutes` | %{minutes}m | %{minutes} dk |
| `moodOffer.paywallTitleDeck` | Keep exploring this mood. | Bu ruh halini keşfetmeye devam et. |
| `moodOffer.paywallTitleQuota` | Ready for another search? | Bir arama daha ister misin? |
| `moodOffer.paywallBenefit1` | Every pick in every search | Her aramada tüm öneriler |
| `moodOffer.paywallBenefit2` | Search again, whenever you want | İstediğin zaman yeniden ara |
| `moodOffer.paywallBenefit3` | Explore films for any mood | Her ruh hali için film keşfet |
| `moodOffer.paywallNightly` | Your nightly 4 films stay free. | Gecelik 4 filmin ücretsiz kalır. |

#### Eski kota paywall'ı (`quota_exhausted`, bayrak kapalıyken) — PaywallQuotaExhausted

| Anahtar | EN | TR |
|---|---|---|
| `contextPaywall.quotaTitle` | Your discoveries are done for today | Bugünkü keşiflerin bitti |
| `contextPaywall.quotaSubtitle` | Unlimited mood searches with Chosy Pro | Chosy Pro ile sınırsız mood araması |
| `contextPaywall.quotaValueTitle` | Just %{price}/month for unlimited discoveries | Sınırsız keşif için ayda sadece %{price} |
| `contextPaywall.quotaValueSubtitle` | Annual plan saves you %{percent} compared to monthly. | Yıllık plan aylığa göre %{percent} tasarruf sağlar. |
| `contextPaywall.quotaCta` | Try %{days} Days Free | %{days} Gun Ucretsiz Dene |
| `contextPaywall.quotaCtaNoTrial` | Unlock Lifetime Access | Omur Boyu Erisimi Ac |
| `contextPaywall.quotaDismiss` | Come back tomorrow | Yarin tekrar gel |

#### Film detayı (kart dokunuşu) — mood bağlamlı kısımlar

| Anahtar | EN | TR |
|---|---|---|
| `filmDetail.whyThisFilm` | Why this film? | Neden bu film? |
| `aiConsent.explainCta` | Turn on personal explanation | Kişisel açıklamayı aç |
| `filmDetail.addToWatchlist` | Add to Watchlist | İzleme Listesine Ekle |
| `filmDetail.addedToWatchlist` | Added to List | Listeye Eklendi |
| `filmDetail.removeFromWatchlist` | Remove from List | Listeden Çıkar |
| `filmDetail.removeConfirmMessage` | Remove this film from your watchlist? | Bu filmi izleme listenden kaldırmak istiyor musun? |
| `filmDetail.watchedBtn` | Watched | Izledim |
| `filmDetail.trailer` | Trailer | Fragman |
| `filmDetail.watchTrailer` | Watch trailer | Fragmanı izle |
| `filmDetail.synopsis` | Synopsis | Konu |
| `filmDetail.cast` | Cast | Oyuncular |
| `filmDetail.directorAndCrew` | Director & Crew | Yonetmen & Ekip |
| `filmDetail.watchOn` | Watch On | Platformlar |
| `filmDetail.loadError` | Could not load film details. Check your connection and try again. | Film detayları yüklenemedi. Bağlantını kontrol edip tekrar dene. |
| `filmDetail.filmNotFoundTitle` | Film Not Found | Film Bulunamadı |
| `filmDetail.filmNotFoundText` | This film is no longer available. | Bu film artık mevcut değil. |
| `errors.watchlistSave` | Couldn't add to your list. Try again. | Listene eklenemedi. Tekrar dene. |
| `errors.watchlistRemove` | The film couldn't be removed. Try again. | Film kaldırılamadı. Tekrar dene. |
| `errors.watchedToggle` | Watched status couldn't be saved. Try again. | İzlendi durumu kaydedilemedi. Tekrar dene. |
| `errors.retry` | Retry | Tekrar Dene |
| `errors.openLink` | Couldn’t open the link. Try again. | Bağlantı açılamadı. Tekrar dene. |

#### 2.x `t()` dışı (sabit) kullanıcı metinleri

| Yer | Metin | Not |
|---|---|---|
| `SwipeableCard` rozetleri | "💎 Hidden Gem", "⭐ AI Pick", "🎲 Unexpected", "match" | Yalnız İngilizce |
| `SwipeableCard` / öneri servisi şablon açıklamaları | "A %s film that perfectly matches your mood" ve benzerleri | Yalnız İngilizce |
| `rowToFilm` `whyThisFilm` | "Matches your mood: <match_reason>" | Yalnız İngilizce; `match_reason` ham SQL çıktısı |
| `toUserError(…, 'mood')` | Genel arama hata mesajları | Yalnız İngilizce (istisna: `APP_USER_MISSING` ve bayrak-açık kodları `t()` kullanır) |

#### 2.y TR yazım gözlemi (aksansız Türkçe)

`mood.onboardingFreeSearch` ("Ilk aramaniz bizden!"), quick-mood kart alt başlıkları, `deckSummary.*`, `filmDetail.watchedBtn`, `filmDetail.director` gibi anahtarlarda ş/ı/ğ/ü/ö/ç eksik. Tam liste için yukarıdaki TR sütununa bakın.

---

## 3. Öneri hattı uçtan uca

```
metin ──► parseMood (istemci, 15sn abort, 5/60sn limit)
            └─► parse-mood (Edge) ─► Claude Haiku 4.5 ─► TasteProfile (12 boyut) + search_keywords
        ──► tasteProfileToVector ─► 384-d sorgu vektörü   (filtreler: yearRange→era, minRating)
        ──► getFilmsWithRelaxation (hedef 8)
              └─► match_films_v3 RPC (30 aday ilk parti / 12 sonraki)
        ──► [use_llm_reranker && rıza && mood metni] rerank-films (6sn) ─► sıra
        ──► kalite süzgeci (0.55 × max benzerlik) ─► ilk 8
        ──► discover destesi (+ kilit kartı)
```

### 3.1 `parse-mood` (`supabase/functions/parse-mood/index.ts`)

- **Sıra:** `requireUser` → rate limit → `raw_input` doğrulama (≥2 karakter, kotadan önce) → ANTHROPIC anahtarı kontrolü → kota talebi → LLM → yanıt.
- **Kota:** `client_search_id` varsa `claim_mood_search` RPC'si (sonuçlar: replay / `in_progress` 409 / claimed / `quota_denied` / unavailable); yoksa eski `check_and_consume_quota`. Fail-closed: 403 `APP_USER_MISSING`, 503 `TIER_NOT_CONFIGURED` / `QUOTA_UNAVAILABLE`, 429 `QUOTA_EXCEEDED`. LLM tarafı hatalarında kota iade edilir (refundPolicy).
- **Model:** `claude-haiku-4-5`, `max_tokens 1024`, zaman aşımı `ANTHROPIC_TIMEOUT_MS`, `maxRetries 0`.
- **Çıktı JSON'u:** `emotional_state` (8 değerli), `energy_level`, `pace_preference`, `visual_style`, `thematic_depth`, `ending_preference`, `era_preference`, `cultural_context`, `avoid_signals`, `narrative_style`, `social_context`, `rewatch_tolerance`, `profile_name`, `profile_description`, `search_keywords` (5–8 küçük harf, TMDB tarzı, en çok 8). Prompt'ta tür ayrıştırma kuralları var.
- **Yanıta eklenenler:** `search_id`, `remaining`, `limit`, `resets_at`.
- **Kalıcılık:** `mood_searches` satırı (`mood_text` ≤500, `parsed_profile`, gecikme, token, `error_code`).
- **Hatalar:** Sentry'ye gider; kredi bitti ⇒ fatal + 503.
- **İstemci (`tasteParser.parseMood`):** istemci limiti 5/60 sn, 15 sn abort, `IN_PROGRESS` için ≤3 yeniden deneme (1–8 sn bekleme), **anahtar kelime fallback'i yok** (bilinçli), `validateAndNormalize`.

### 3.2 Vektör ve filtreler

- 384 boyutlu yerleşim (duygu 0–63 … dolgu 352–383); tek kaynak `services/vectorEncoder` (`encodeVector`).
- Filtreler: `yearRange` → `era` (ayrıca `profile.era_preference`'ı **ezer**), `minRating`. `regions` ve `directors` bu arayüzde hep boş ve v3'e geçirilmez.
- Kullanıcı vektörü varsa harmanlama ağırlıkları (`calculateBlendWeights`, yalnız `use_hybrid_recommendation` açıkken):

| Sinyal sayısı | mood | user |
|---|---|---|
| <6 | 1.00 | 0 |
| 6–49 | 0.85 | 0.15 |
| 50–199 | 0.70 | 0.30 |
| ≥200 | 0.55 | 0.45 |

### 3.3 `match_films_v3` parametreleri (en güncel tanım: migration 133, 16 argüman)

| Parametre | İstemci değeri |
|---|---|
| `query_vector` | mood vektörü |
| `user_vector` | nullable (soğuk başlangıç → `rpc_version = v3_cold_start`) |
| `mood_weight` / `user_weight` | yukarıdaki tablo |
| `match_count` | 30 (ilk parti) / 12 (sonrakiler) |
| `min_similarity` | gevşetme zincirine göre (§3.4) |
| `min_rating` | kullanıcı filtresi veya zincir |
| `year_from` / `year_to` | era'dan |
| `exclude_ids` | ≤500: sert = watchlist + izlenmiş; yumuşak = son 3 destenin filmleri (`shownDecksStore`); sonuç <8 ise yumuşak kısım düşürülür (`first_batch_soft_exclusion_dropped`) |
| `search_keywords` | parse-mood'dan |
| `per_director_cap` | 1 |
| `tier_boost` | true (core 1.15 / extended 1.0 / archive 0.85) |
| `exclude_archive` | true |

**SQL mantığı:** adayları filtrele → ön vektör skoru → kısa liste (en az 600) → anahtar kelime boost'u (eşleşme başına +0.06, tavan +0.20; `strpos`, iki yönlü) → `skor = (harman + kw) × tier × trust` (trust 0.5: ≥2024, core olmayan ve imdb verisi eksik filmler) → sıralama `(1-(harman+kw)) / (tier × trust)` → `match_count × cap × 3` fazla örnekleme → yönetmen sınırı → `LIMIT`. `sort_key` içindeki `random()` kullanılmıyor ⇒ sonuç **deterministik**. Dönen `similarity` 1'i aşabilir. (keyword maliyeti sorunu PRO-FIX-2 keşfinde 3.8 sn idi; migration 133 ile giderildi.)

### 3.4 Gevşetme zinciri (`getFilmsWithRelaxation`, hedef 8)

| Deneme | min_similarity | min_rating | era |
|---|---|---|---|
| 1 | 0.45 | kullanıcı filtresi veya 6.5 | var |
| 2 | 0.42 | 6.0 | var |
| 3 | 0.40 | 5.5 | yok |
| 4 | 0.38 | yok | yok |

İlk ≥8 sonuç veren deneme döner; hiçbiri yoksa son denemenin sonucu. **Kullanıcı 7+/8+/Top250 veya dönem seçse bile 2. denemede 6.0'a düşer, bildirim yok.** v3 hata verirse v2, o da olmazsa v1; ağ benzeri hatalar fırlatılır (fallback'e gitmez).

### 3.5 `rerank-films`

- **Koşul (istemci):** yalnız **ilk parti**; `use_llm_reranker` açık + `hasAiConsent` (6 sn abort öncesi yeniden kontrol) + bekleyen mood metni.
- **Gönderilen:** ≤30 aday `{id, title, overview≤150, genres, year, similarity}`, `count = 8`.
- **Sunucu:** `requireUser`, rate limit, günlük limit (ücretsiz 15 / premium + legacy 60, UTC günü, `api_rate_limits`, 429 `RERANK_DAILY_LIMIT`, 503 fail-closed), Haiku sayı dizisi döner → id'lere eşlenir, `max_tokens 64+4×count`. Sunucu catch'i `fallback:true` + özgün sıra döner; yalnız `console.error`, **Sentry yok**.
- **İstemci hata nedenleri:** `no_consent / timeout / http_error / network_error / bad_body / server_fallback / empty_ids` → yalnız PostHog `llm_rerank_fallback` (+ http/network/bad_body için `logger.error`).
- `reorderByRerankedIds`: rerank'lı id'ler öne, kalanlar sona eklenir.

### 3.6 Kalite süzgeci (`utils/moodQualityGate.ts`)

Taban = 0.55 × **gerçek** maksimum aday benzerliği (data[0] değil). Önce süzülür, sonra `FINAL_CAP = 8`'e kesilir. Olay: `quality_gate_applied`.

### 3.7 8 film nasıl seçiliyor ve sıralanıyor (özet)

1. Parse-mood → vektör + anahtar kelimeler.
2. RPC 30 aday döner; sıralama = `(1-(harman+kw))/(tier×trust)` (yani tier ve trust çarpanlarıyla ağırlıklı benzerlik), yönetmen başına 1.
3. Yeterli (≥8) sonuç yoksa 4 kademe gevşetme.
4. Rerank açıksa Haiku sırayı değiştirir.
5. Kalite süzgeci: en iyi benzerliğin %55'inin altındakiler elenir; ilk 8 alınır.
6. `markSurpriseCards`: 6. konum "unexpected".
7. Kilit: bayrak açık ve yetkisizse ilk `free_visible_count` görünür, kalan gizli.

### 3.8 Fallback davranışı

RPC hatası veya boş sonuç ⇒ `getFallbackFromSupabase`: **tüm `films` tablosundan** (limit ve arşiv filtresi yok) seçip `scoreFilm` + `Math.random()` gürültüsüyle puanlar; `matchScore` **60–99 arası uydurulur**; yönetmen sınırı, anahtar kelime, rerank yok. İzleme: yalnız Sentry breadcrumb; searchId varsa `mood_searches` güncellemesinde `error_code` ve `mood_search_update_debug_fallback`. Kullanıcı arayüzde fark görmez. `getSurprisePicks` v1 `match_films` kullanır (`exclude_archive` yok).

### 3.9 Bayraklar (`services/remoteConfig.ts` SAFE_DEFAULTS)

| Bayrak | Güvenli varsayılan | Not |
|---|---|---|
| `use_hybrid_recommendation` | false | Migration 042/044 DB'de `true` tohumladı; **güncel değer doğrulanamadı** |
| `use_llm_reranker` | false | Aynı şekilde |
| `use_match_films_v2` | true | |
| `mood_offer_enabled` | false | + `mood_offer_testers` |
| `free_visible_count` | 3 | clamp 1..8 |

TTL 5 dk; bayraklar özellik bayrağıdır, yetki sunucudadır.

---

## 4. Etkileşim sonuçları nereye yazılıyor; öğrenme var mı?

| Eylem | Yazılan yer | Not |
|---|---|---|
| Sağ kaydırma | `watchlist` upsert `{user_id, film_id, added_from_session}` (`addToWatchlist(film, sessionId, {deferVectorUpdate:true})`) | `film_added_to_watchlist` olayı |
| Sağ kaydırma | `queueUserVectorUpdate` → `users.preferences_vector` EMA | `0.8×mevcut + 0.2×film vektörü`; deste sonu/blur/arka plan'da `flushUserVectorUpdates` |
| Sağ kaydırma | `tasteSignals.recordWatchlistAdd` | strength **+0.9** |
| Sol kaydırma | `tasteSignals.recordSwipeLeft` | strength **−0.2**; başka yazım yok |
| Detay görüntüleme | `recordDetailView` (≥1 sn) | 30 sn debounce |
| Sağ/sol kaydırma | `swipes` tablosu **yazılmaz** | Yalnız `userProfile.updateUserPreferenceVector` okur, çağıranı yok; tablo ~0 satır |
| Seçim tıklama | `recordPickClicked` | **Çağıranı yok** |
| Oturum | `sessions {raw_input, parsed_profile_json}` (`saveSession`, asenkron) | İlk kaydırmada session id hazır olmayabilir |
| Arama | `mood_searches` (parse-mood) + istemci UPDATE `recommended_film_ids`, `rpc_version` (`match_films_v3`/`v3_cold_start`/v2/v1) | `ensureAuthSession`; 0 satır güncelleme `reportMoodSearchWriteIssue` ile raporlanır |
| Deste gösterimi | AsyncStorage `chosy_recent_deck_ids` (son 3 deste, **8 id'nin hepsi**, kilitle gizlenenler dahil) | Yumuşak dışlama kaynağı |
| Bugünün destesi | AsyncStorage `chosy_today_mood_deck_v1` | Yalnız cihaz, bayrağa bağlı |

**Öğrenme:**
- İstemci EMA (yukarıda) `users.preferences_vector`'ü günceller; trigger 039 `preferences_vector_dirty` işaretler.
- `getFreshUserVector`, dirty >30 dk ise `recompute-user-vector` Edge Function'ını tetikler: son 90 gün sinyal, |strength| ≥ 0.2, 30 gün yarı ömür, ≥6 sinyal; sonuç = `0.5×base + 0.5×sinyal ort.` (<50 sinyal) veya `0.2/0.8` (≥50). **`base` = kolondaki mevcut `preferences_vector`'ün kendisi** ⇒ idempotent değil, her çalıştırmada sinyal ortalamasına doğru kayar; aynı kolonda iki yazar var (tasarım niyeti doğrulanamadı).
- `chosy_ai_preferences` (AsyncStorage; energy/pace/depth) `applyAIPreferences` ile profili ezer; **yazan kod bulunamadı** ⇒ eski bir değer sessizce profili geçersiz kılabilir.

---

## 5. Analitik olaylar ve özellikleri

Ortak mood çekirdeği: `{search_id, entry_point, is_pro, consent}` — kullanıcı metni **taşımaz** (istisna `mood_card_tapped`: ilk 40 karakter).

| Olay | Özellikler |
|---|---|
| `pro_mode_opened` | `access_reason` (premium/legacy/free_search) |
| `pro_mode_paywall_shown` | `source` |
| `mood_invite_shown` / `mood_invite_tapped` | `surface`, `access` |
| `mood_searched` | `mood_text_length` |
| `mood_search_free_started` | `entry_point`, `mood_text_length` |
| `mood_search_free_completed` | `entry_point`, `search_id`, `remaining` |
| `mood_search_failed` | `error`, `error_code`, `mood_length` |
| `mood_activation_timeout` | `attempts` |
| `quota_exhausted` | `quota_type` |
| `mood_card_tapped` | `mood_text` (≤40 karakter) |
| `discover_recent_search_tapped` | `mood_text_length` |
| `mood_today_deck_reopened` | `search_id`, `deck_size` |
| `ai_consent_shown/granted/declined/dismissed/revoked` | `surface`, `variant` |
| `mood_deck_started` / `mood_deck_resumed` | `film_ids` (≤8), `deck_size`, `search_mode` + çekirdek |
| `mood_lock_viewed` / `mood_lock_tapped` / `mood_deck_unlocked` | çekirdek |
| `mood_deck_completed` | `liked_count`, `disliked_count`, `deck_size`, `reranked` |
| `mood_deck_summary_action` | `action` |
| `film_added_to_watchlist` | `film_id` |
| `feed_preload_hit` / `feed_preload_awaited` | — |
| `keyword_boost_active` | `keyword_count` |
| `quality_gate_applied`, `insufficient_results`, `mood_relaxation_timing`, `first_batch_soft_exclusion_dropped` | hat içi tanılama |
| `reranker_condition_check`, `llm_rerank_applied`, `llm_rerank_fallback`, `llm_rerank_mood_text_null` | rerank tanılaması (fallback: neden kodu) |
| Hata ayıklama: `feed_batch_search_id_debug`, `mood_search_debug_entry`, `mood_search_update_debug` (+`_fallback`) | G6 belgesi bunları metrik-dışı sayar |
| Paywall: `paywall_triggered`, `paywall_variant_skipped`, `paywall_viewed` (+mood çekirdek), `paywall_shown/dismissed/converted`, `paywall_plan_selected`, `mood_offer_shown/cta/dismissed` (`entry_point`, `search_id`), `purchase_completed` | |
| Paylaşım: `app_share_initiated` / `app_share_completed` | `card_type` |

`services/analytics.ts` içindeki `trackMoodSearch*` sarmalayıcılarının Pro Mode'da çağıranı yok (ölü).

---

## 6. Bilinen sorunlar

### 6.1 `docs/TEKNIK_BORC.md` içindeki ilgili maddeler

| Madde (yaklaşık satır) | Durum |
|---|---|
| parse-mood `APP_USER_MISSING` (~836) | Kapalı |
| `useFeedManager` boş küme izlenmiş-fallback (~2974) | Açık |
| AI rızası sunucuda zorlanmıyor, E-26 (~3993) | Açık (yalnız istemci) |
| "Sunucu maliyeti ve kota" (~4115) — madde 1: rerank günlük sınırı yok | **Bayat**: günlük limit eklendi (c81e450); token loglama hâlâ yok; deploy durumu doğrulanamadı |
| aynı bölüm madde 2: parse-mood fail-open | **Bayat**: artık fail-closed |
| aynı bölüm madde 3: Pro kapısı istemci tarafı, ücretsiz=3, Faz 3 planı 3→1 | Geçerli |
| quotaEngine istemci AsyncStorage sayacı (~2666–2673) | Açık |
| MONEY-SEC-1 (~4268) ve MONEY-1C Faz 2 inceleme maddeleri: B-4 (shown çift tetik), B-5/B-8 (`mood_offer_cta` belirsiz), B-9 (`refreshSearchQuota` kullanılmıyor notu — **şimdi MoodSearchScreen focus effect'te kullanılıyor, bayat**), B-10, D8 (anonim yeniden kurulum = yeni ücretsiz hak), tester id önbelleği | Çoğu açık |
| Yetki taraması (~4351) | Açık |
| Ölü varyantlar / `quotaCtaNoTrial` "Unlock Lifetime Access" metni (~4130) | Açık |
| BUG-005 (kota sonrası paywall atlanıyor, build 6), BUG-011 (Top250 filtresi ile Schindler's List) | Tarihsel, doğrulanamadı |

İlgili belgeler: `MONEY-1C_KESIF`, `FAZ3_ROLLOUT`, `DEPLOY_RUNBOOK`, `IDEMPOTENCY`, `PRO-FIX-2_KESIF`, `tests/moodoffer/*`, `tests/recommendation-quality/*`. Runbook: migration 139 (idempotency), 140/141 (revoke), 142 uygulandı; parse-mood v43 25 Eki'de deploy edildi.

### 6.2 Bu keşifte koddan çıkan yeni gözlemler (üretilmedi; doğrulama gerekir)

1. Deste X / "Yeni mood" / boş durum eylemi Pro Mode girişine değil, Gauntlet ana sayfasına (`/(tabs)`) gider.
2. Slot kotası tükenince deste donar; `triggerPaywall` dönüşü yok sayılır, paywall `null` dönerse tepkisiz deste.
3. AIProcessingOverlay "Yeniden dene" ve rerank yeniden denemesi uçuştaki isteği iptal etmez.
4. Gevşetme zinciri kullanıcının 7+/8+/Top250/dönem seçimini sessizce gevşetir (2. denemede min puan 6.0).
5. `toUserError(…,'mood')` mesajları, kart rozetleri, şablon açıklamalar ve `whyThisFilm` `t()` dışı sabit İngilizce (rule 7).
6. TR metinlerde aksan eksikliği (bkz. 2.y).
7. JS fallback: sessiz, tüm tabloyu tarar, arşiv filtresi yok, rastgele gürültü, uydurma yüzde.
8. Sunucu rerank fallback'i Sentry'ye gitmez.
9. LLM `profile_name`/`profile_description` üretiliyor ama kullanılmıyor (boşa token); `chosy_ai_preferences` yazarsız okuyucu; `recordPickClicked` ve `trackMoodSearch*` ölü; `swipes` tablosu kullanılmıyor.
10. `recordShownDeck` kilitle gizlenen filmleri de "gösterildi" olarak kaydeder (yumuşak dışlamada kayıp).
11. `recompute-user-vector` tabanı mevcut kolon olduğundan tekrarlı çalıştırma ile kayar.
12. "AI Pick" etiketi LLM seçimi değil, benzerlik ≥0.8.
13. `match_reason` boş eşleşmede tmdb_keywords'e düşer; "Matches your mood: …" önekiyle yanıltıcı olabilir.

### 6.3 Doğrulanamayanlar

Canlı flag değerleri · `mood_history` view tanımı ve kaydırma sayaçları · rerank-films / recompute-user-vector güncel deploy sürümü · PostHog'da olayların gerçek hacmi · Sentry'de bu akışa ait açık sorunlar.

---

## Ek: incelenen kaynaklar

`app/pro-mode.tsx` · `app/discover.tsx` · `app/film/[id].tsx` · `app/(tabs)/profile.tsx` · `components/Home/MoodSearchScreen/*` · `components/gauntlet/MoodInviteCard` · `SwipeableCard` · `MoodLockCard` · `MoodDeckSummary` · `AIProcessingOverlay` · `services/recommendations.ts` · `services/tasteParser.ts` · `services/aiConsent.ts` · `services/remoteConfig.ts` · `services/tasteSignals.ts` · `services/watchlist.ts` · `utils/searchQuota.ts` · `utils/moodQualityGate.ts` · `supabase/functions/{parse-mood,rerank-films,recompute-user-vector,explain-match}` · migration 039, 042, 044, 115, 133, 139–142 · `locales/{en,tr}.json` · `docs/TEKNIK_BORC.md`.
