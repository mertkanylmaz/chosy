# 🔒 CHOSY V1.0 — KAPSAM KİLİDİ VE KARAR ANAYASASI

**Sürüm:** 1.4
**Tarih:** 17 Ağustos 2026
**Statü:** KİLİTLİ — CTO onayı olmadan değiştirilemez
**Yetki seviyesi:** Bu doküman `1_PRODUCT_OS`, `2_BUSINESS_MODEL`, `3_DESIGN_OS`, `4_CLAUDE_CODE_OS`, `6_IA_REVIZE_KARAR_GUNLUGU` ile **eşit** seviyededir ve çelişki halinde **v1.0 kapsamı için bu doküman üstündür.**

**Kaynak girdiler:** `CHOSY_SONHALİ.txt` (Relaunch OS, 85 bölüm) · `CHOSY_EXIT_PLANI.txt` (10K Exit OS, 88 bölüm) · `CHOSY_BUSSINESS_MODEL_V2.txt` (40 bölüm) · GO/Relaunch OS v1.0 mesajı

---

## 0. BU DOKÜMANIN AMACI

Üç strateji dokümanı ~103.000 karakterlik proza üretti. İçlerinde **doğru fikirler**, **kilitli kararlarla çelişen fikirler**, **var olmayan özelliği varsayan fikirler** ve **63 kullanıcılık bir ürüne 10K ölçeğinde reçete yazan fikirler** iç içeydi.

Bu doküman o üçünü **tek karar setine** indirger. Üç kategori vardır ve dördüncüsü yoktur:

| Kod | Anlam |
|---|---|
| **K-xx** | Kilitli — v1.0'a aynen giriyor |
| **D-xx** | Değiştirilerek kabul — orijinali değil, buradaki hali geçerli |
| **R-xx** | Reddedildi — yerine konan çözüm belirtilmiştir veya açıkça kapatılmıştır |
| **E-xx** | Ek — hiçbir dokümanda olmayan, CTO tarafından eklenen madde |

> **Kural:** Bu dokümanda kodu olmayan hiçbir iş v1.0 kapsamına giremez. Giriş talebi ayrı DUR NOKTASI ve sürüm artışı gerektirir.

---

## 1. DEĞİŞMEZ ÇEKİRDEK (tartışmaya kapalı)

```
Positioning       Chosy turns movie selection into a daily ritual.
Core loop         4 films → 3 choices → 1 winner
User promise      Choose tonight.
Long-term         Chosy learns your cinema taste.
Premium           Make Chosy yours.
Gelir prensibi    Daily Gauntlet sonsuza kadar ücretsiz.
Marka prensibi    GAUNTLET = REKLAMSIZ.
North Star        Daily Gauntlet Completion
Product Truth     Watched-it Rate
```

**Chosy değildir:** film veritabanı · AI chatbot · social feed · oyun koleksiyonu · öneri listesi · streaming aggregator.

---

## 2. KİLİTLİ KARARLAR (K)

### 2.1 Bilgi mimarisi ve navigasyon

| # | Karar | Kaynak |
|---|---|---|
| **K-01** | 2 tab: **Home + Profile**. Üçüncü tab yok. | IA §2.1, SONHALİ §61 |
| **K-02** | Discover nav'dan kalkar, `app_config` flag ile donar, **silinmez**. Today's Pick onunla birlikte söner. | IA §2.2 |
| **K-03** | Home = **tek route, explicit state enum**: `waiting · ready · in_progress · completed · watch_feedback · error_recovery`. Ghost state yok. ⚠️ **Enum listesi D-12 ile güncellendi** — "tek route + explicit state + ghost state yok" ilkesi aynen geçerli, durum adları uygulamada farklı gerçekleşti. | SONHALİ §68 |
| **K-04** | Tab bar **native-feeling**. Custom glass taklidi yok; sistemin Liquid Glass davranışı kullanılır. C.9a'da doğrulanır. | SONHALİ §62 |
| **K-05** | Spotlight'ın ayrı hub'ı yok. Sadece champion ekranının altında "Bugünün bonusu" kartı. | IA §2.6 |
| **K-06** | Watchlist ayrı tab değil, Profile alt sayfası. Otomatik giriş yok — tek yol champion'daki manuel "Sonraya bırak". | IA §2.4 |
| **K-07** | Badge / Collections UI kaldırılır. Tablo ve seed'e dokunulmaz. | IA §2.7 |
| **K-08** | Profile sırası: **Cinema DNA → Streak → Watched → Saved → Pro → Settings**. | SONHALİ §57 |
| **K-09** | Sheet/full-screen ayrımı: Context edit = sheet · Film detay = sheet · Paywall = sheet · Gauntlet = full-screen. | SONHALİ §63 |
| **K-10** | Seçim anında onay alert'i yok. `choice → instantaneous`. | SONHALİ §64 |

### 2.2 İlk deneyim ve kimlik

| # | Karar | Kaynak |
|---|---|---|
| **K-11** | Onboarding = **3 kart**, slideshow değil, quiz yok, mood input yok. İlk değer ilk gauntlet'in içinde öğrenilir. | SONHALİ §2-3 |
| **K-12** | İlk açılış **anonim session**. "Sign in with Apple" ilk ekranda **yok**. | SONHALİ §4-5 |
| **K-13** | Auth **champion sonrası**, değer karşılığı: "Save your cinema journey" + "Not now". | SONHALİ §5 |
| **K-14** | Auth sağlayıcı: **Sign in with Apple (primary) + email magic link (secondary)**. Üçüncüsü yok. | SONHALİ §6 |
| **K-15** | Bildirim izni **ilk açılışta istenmez** — ilk champion'dan sonra, bağlam içinde: "Want your four ready every evening?" | SONHALİ §28 |
| **K-16** | Hesap silme **gerçek cascade**: auth user → profile → choice events → watch history → DNA → analytics identity. App Review blocker'ı, "polish" değil. | SONHALİ §7 |

### 2.3 Gauntlet ve champion

| # | Karar | Kaynak |
|---|---|---|
| **K-17** | Soru daima **"Which would you watch tonight?"** — asla "which is better". Kullanıcı jüri üyesi değil. | Relaunch §6, SONHALİ §10 |
| **K-18** | Mekanik görünür kalır: Context bar · Round indicator · "Choose one". Minimal ≠ ambiguous. | SONHALİ §9 |
| **K-19** | Motion: **CUT** = karar, **DISSOLVE** = geçiş. Champion = **720ms karanlık an**. Dekoratif animasyon değil, marka davranışı. | Design OS, EXIT §16 |
| **K-20** | Champion **end screen değil, activation bridge**: Nerede izlenir · Sonraya bırak · Paylaş. | SONHALİ §13-14 |
| **K-21** | Champion'da **tek cümlelik deterministic açıklama** ("Tonight you leaned toward intensity + realism"). LLM çağrısı yok, 6 eksenden türetilir. ⏸️ **ERTELENDİ** (19 Ağu 2026, C.9b-2 keşfi) — K-30'un 6 ekseni film başına HİÇBİR YERDE üretilmiyor. Yuvası: R-18 radar chart'ı ile aynı sprint (ortak eksen ingestion'ı). Bkz. §11 F-07. | SONHALİ §12, §20 |
| **K-22** | Champion ekranı **kalıcı**. Tekrar girişte aynı ekran, yeniden oynatmaz. | IA §2.3 |
| **K-23** | Ret merdiveni korunur (Ret 1 sessiz yeni çift · Ret 2 üç yön · Ret 3 liste/saved/yarın). Her ret **analytics sinyalidir**. | Product OS, Relaunch §9 |

### 2.4 Sonuç döngüsü

| # | Karar | Kaynak |
|---|---|---|
| **K-24** | Watched-it döngüsü **P0**. Ertesi gün: "Did you watch X?" → Yes · Not yet · **I watched something else**. | SONHALİ §15-16 |
| **K-25** | "Başka bir şey izledim" **opsiyonel film aramasıyla** kaydedilir. Recommendation rejection + competing movie verisi. | SONHALİ §16 |
| **K-26** | "No" başarısızlık değildir — cezalandırıcı copy yasak. | SONHALİ §15 |
| **K-27** | Watched-it ve satisfaction **ayrı metriklerdir**, karıştırılmaz. | Relaunch §13 |
| **K-28** | Teşhis matrisi: yüksek Neither → candidate quality · düşük Neither + düşük Watched → champion quality. | SONHALİ §51 |
| **K-29** | Watch feedback kararları korunur: `loved`/`ok`/`abandoned` → `watched_at` yazar · `not_watched`/`skipped` → yazmaz. Skip `asked_at` yazar, bir daha sorulmaz. | C.4 kilidi |

### 2.5 DNA ve gamification

| # | Karar | Kaynak |
|---|---|---|
| **K-30** | **6 eksen**: Tempo · Intensity · Darkness · Realism · Era · Language. 8 eksen yok, alt kırılım yok. | IA §4, SONHALİ §58 |
| **K-31** | Tek renk ailesi (`marquee`/`beam`). Tür-kodlu çoklu palet **kalıcı olarak ölü**. | Design OS §17 |
| **K-32** | DNA **dashboard değil narrative**. Üç yerde görünür: Champion ("Tonight you leaned…") · Profile ("You're becoming…") · Milestone ("Your taste has changed"). | SONHALİ §22 |
| **K-33** | Tek progression omurgası: **STREAK → DNA**. XP sayısı kullanıcıya gösterilmez. | SONHALİ §23-24 |
| **K-34** | Streak kaybı **cezalandırmaz**: "Tomorrow is another screening." | SONHALİ §26 |
| **K-35** | Gamification audit kuralı: Reward/Progress/Habit/Identity sorularının dördüne cevap vermeyen öğe **ürüne giremez**. | SONHALİ §54 |

### 2.6 Backend, veri, güvenilirlik

| # | Karar | Kaynak |
|---|---|---|
| **K-36** | 5 servis sınıfı (**AUTH · GAUNTLET · CHOICE · DNA · BILLING**) idempotent · observable · retryable · auditable olmak zorunda. | SONHALİ §35 |
| **K-37** | Gauntlet backend state machine: `GENERATING → READY → STARTED → ROUND_1 → ROUND_2 → FINAL → COMPLETED → WATCH_PENDING → WATCHED`. | SONHALİ §69 |
| **K-38** | Her gauntlet kaydı: `gauntlet_id · date · user_id · context · candidate_pool_version · algorithm_version · films · seed · generation_status`. "6 ay sonra neden bu 4 film?" sorusu cevaplanabilir olmalı. | SONHALİ §36 |
| **K-39** | Her seçim: `gauntlet_id · round · film_a · film_b · position · winner · latency_ms · context · algorithm_version`. | SONHALİ §37 |
| **K-40** | **Ham olay saklanır, profil türetilir.** `cinema_dna` cache'tir, kaynak `choice_events` + `watch_feedback`. Bu tablolar append-only. | Product OS, chosy-conventions §6 |
| **K-41** | Algoritma versiyonlaması: `gauntlet_algorithm · candidate_pool · diversity_model · context_model`. Cohort karşılaştırması bunsuz imkânsız. | SONHALİ §38 |
| **K-42** | Üretilmiş gauntlet **offline oynanabilir**. Fallback zinciri: cached today → last valid local state → recovery. Beyaz ekran / boş state **asla**. | SONHALİ §66-67 |
| **K-43** | Error copy ürün dilinde: "The screen went dark. We couldn't load tonight's films." — "Error 503" yasak. | SONHALİ §65 |
| **K-44** | Sessiz fallback yasağı, append-only film verisi, `supabase db push` zorunluluğu, lazy feature flag getter'ları, `src/types/gauntlet.ts` sözleşme kilidi **aynen geçerlidir**. | chosy-conventions |

### 2.7 Para

| # | Karar | Kaynak |
|---|---|---|
| **K-45** | Onboarding paywall'ı yok · first-session paywall'ı yok · champion paywall'ı yok · daily gauntlet paywall'ı yok. | SONHALİ §29 |
| **K-46** | **Tek paywall tetikleyicisi: 2. kaçırılan gün → arşiv.** İlk kaçırma ücretsiz telafi. Diğer 4 tetikleyici Faz 1. | IA §3 |
| **K-47** | Paywall'da **11 benefit değil 2 değer**: Functional ("Replay missed days") + Identity ("See how your taste evolves"). | SONHALİ §33 |
| **K-48** | Tek entitlement **`chosy_plus`** *(v1.1'de düzeltildi — bkz. §11 F-02/DUR NOKTASI B)*. Tüm gate'ler entitlement üzerinden, server-side. Webhook idempotent, retry'lı, reconciliation'lı, **silent downgrade yok**. | SONHALİ §34 |
| **K-49** | RevenueCat state matrisi test edilmeden release yok: restore · expiration · grace period · billing issue · refund · revoked. | SONHALİ §34 |
| **K-50** | **Gauntlet reklamsız.** Interstitial yok, sponsored film yok, banner yok, "watch ad before champion" yok. | V2 §15-16 |
| **K-51** | Veri satışı / data monetization yok. | EXIT §43 |

### 2.8 Kalite ve çıkış

> **Not (19.08.2026, C.9c Faz 1):** R-12'nin (§4) kaynak hücresindeki "IA §2.8"
> atfı **IA dokümanına** aittir, bu bölüme değil. §2.8 quiz hakkında hiçbir karar
> içermez. Quiz'in tek bağlayıcı hükümleri **K-11** (onboarding'de quiz yok) ve
> **R-12** (Profile giriş noktası kaldırılır, `archetype_id` verisi cold-start
> seed olarak korunur, şema değişikliği yok). Çakışma halinde R-12 geçerlidir.

| # | Karar | Kaynak |
|---|---|---|
| **K-52** | **6 release gate**: Product · Data · Reliability · Monetization · Accessibility · Store. Altısı birlikte geçmeden production yok. | SONHALİ §70 |
| **K-53** | DONE tanımı: **BUILD → MEASURE → RECOVER → VALIDATE**. "Kodlandı" DONE değildir. | GO OS §0 |
| **K-54** | Accessibility release koşuludur: Dynamic Type XS→AX5 · AX4/AX5'te gauntlet dikey · VoiceOver sırası · Reduce Motion · Reduce Transparency · Increase Contrast · 44×44pt · safe area · 60fps. | Design OS, GO OS §35 |
| **K-55** | QA cihaz matrisi: Small iPhone · Standard · Pro Max × (latest iOS + bir önceki). | SONHALİ §71 |
| **K-56** | TMDB ticari lisans + poster/still hakları **App Store release'inden önce** netleşir. 1K'da değil. | EXIT §44-45, §81 |
| **K-57** | Cihaz testi zorunlu kalite kapısıdır. Kod analizi tek başına yetersizdir. | Sprint disiplini |
| **K-58** | i18n paritesi: kullanıcıya görünen her string `t()` üzerinden, `en.json` ↔ `tr.json` tam parite. | chosy-conventions §7 |

---

## 3. DEĞİŞTİRİLEREK KABUL EDİLENLER (D)

> Bu maddelerin **orijinal dokümanlardaki hali geçersizdir.** Aşağıdaki hali geçerlidir.

### D-01 — Uygulama sırası tersine çevrildi

**Dokümanda:** `R0 IA → R1 onboarding → R2 UX → R3 outcome → R4 recommendation → … → R8 observability` (SONHALİ §81)

**Kilitlenen:** Ölçüm ve kimlik **en başa** alınır.

**Gerekçe:** Enstrümantasyon sona konursa production'a çıkan ilk gauntlet, elimizdeki tek gerçek kohortu ölçülemez veri olarak yakar. Kill criteria (500 kullanıcıda watched-it <%20) çalıştırılamaz hale gelir. Ayrıca anonymous-first onboarding, 87 kimliği kaybetmiş bir katmanın üstüne kurulamaz.

---

### D-02 — Bildirim: 3 push → 1 push

**Dokümanda:** 18:00 "Your four are ready" · 20:30 "Still deciding?" · 22:00 "Tonight's waiting" (EXIT §19)

**Kilitlenen:** **Günde tek push**, kullanıcı-yerel 18:00, "Your four are ready.", doğrudan bugünkü gauntlet'e deep link.

**Gerekçe:** Günde üç push "cinema concierge" değil spam'dir ve bildirim izninin geri alınmasının en hızlı yoludur. İkinci temas noktası widget'tır, o da ertelenmiştir (R-09).

---

### D-03 — Poster Quality Gate mimarisi düzeltildi

**Dokümanda:** "Poster gelmiyorsa film gauntlet'e giremez" — generation anında URL/HTTP/aspect ratio kontrolü (SONHALİ §40, GO §33)

**Kilitlenen:** `poster_quality_ok` **bir kolondur**, ingestion/cron zamanında batch doğrulanır. `generate-gauntlet` sadece kolonu okur. Elenen her film Sentry breadcrumb'ı bırakır.

**Gerekçe:** Request-time HTTP kontrolü aday başına network çağrısı demektir → <500ms generation hedefi ölür. Daha kötüsü, başarısız kontrol **sessiz eleme** üretir — sessiz fallback yasağının doğrudan ihlali. Ek koşul: mevcut `poster_url` w92 normalizasyon bug'ı gate'ten **önce** kapanır; yoksa gate iyi filmleri sessizce eleyen bir makineye dönüşür.

---

### D-04 — Algorithm Report Card: panel değil, view

**Dokümanda:** Admin tarafında günlük rapor kartı ekranı (SONHALİ §53)

**Kilitlenen:** Admin UI **inşa edilmez**. Bir SQL view + PostHog dashboard. (View oluşturma DDL'dir → CTO onayı gerektirir, M1 kapsamında ayrıca onaylanacaktır.)

**Gerekçe:** 63 kullanıcıda admin paneli israftır ve bakım yükü yaratır. Aynı bilgi sıfır ürün koduyla elde edilir.

---

### D-05 — Share: 3 format → 1 format

**Dokümanda:** Type A Winner · Type B Battle · Type C Streak (EXIT §8)

**Kilitlenen:** Tek format — **Battle**: "Ben Heat seçtim. Sen ne seçerdin?"

**Gerekçe:** Viral asimetrisi olan tek format budur; diğer ikisi "bak benim sonucum" der ve konuşma başlatmaz. Üç layout = 3× tasarım + 3× QA, sıfır ek öğrenme.

---

### D-06 — DNA yüzdesi eşiğe bağlandı

**Dokümanda:** "We know you 37%" + confidence meter (EXIT §11, SONHALİ §58, Relaunch §16)

**Kilitlenen:** Kullanıcı **≥7 tamamlanmış gauntlet**'e ulaşmadan yüzde gösterilmez. O ana kadar: "Your Cinema DNA is forming."

**Gerekçe:** 2 gauntlet sonrası "%37 tanıyoruz" demek doğrulanabilir biçimde yanlıştır ve ürünün tüm zekâ iddiasını tek hamlede çürütür.

---

### D-07 — Session replay daraltıldı

**Dokümanda:** first session · first champion · aborted gauntlet · paywall · where to watch (SONHALİ §48)

**Kilitlenen:** Sadece **first session** ve **aborted gauntlet**. Privacy masking zorunlu; şifre/email/ödeme/kişisel veri kaydedilmez.

**Gerekçe:** Bu ölçekte replay en yüksek getirili araçtır (20 kayıt izlemek 20 funnel grafiğinden fazla öğretir) — ama beş segment depolama ve gözden geçirme maliyetini gereksiz üçe katlar.

---

### D-08 — Lifetime / Founder Edition v1'de satılmaz

**Dokümanda:** $79.99 lifetime, ilk 1.000 üyeyle sınırlı Founder Edition (EXIT §40, V2 §26)

**Kilitlenen:** v1'de **yeni lifetime satılmaz**. Mevcut lifetime benzeri satın alma yapan olursa `chosy_plus`'a migrate edilir. 1K'da yeniden değerlendirilir. *(v1.1: `chosy_pro` → `chosy_plus`, bkz. §11 F-02)*

**Gerekçe:** Pivot ihtimali kapanmamış bir üründe kalıcı yükümlülük satmak, gelecekteki her ürün kararını ipotek altına alır. Ayrıca mevcut `legacy_lifetime`/`legacy_quota` teknik borcu zaten temizlenmeyi bekliyor — üstüne yenisini eklemeyiz.

---

### D-09 — Master spec yerine kapsam kilidi

**Dokümanda:** Kod yazmadan önce 22 bölümlük `CHOSY RELAUNCH OS v1.0` master spec'i üretilsin (SONHALİ §85)

**Kilitlenen:** Bu doküman + sprint başına prompt. 22 bölümlük yeni master spec **yazılmaz**.

**Gerekçe:** 103.000 karakterlik prozayı üreten refleks tam olarak budur. Dört OS dokümanı ve bir karar günlüğü zaten mevcut. Eksik olan spesifikasyon değil, **kapsam kilidi ve uygulama**.

---

### D-10 — Exit çerçevesi yeniden tanımlandı

**Dokümanda:** 10K MAU + $3–10K MRR = satış eşiği; 88 bölümlük exit scorecard (EXIT tümü)

**Kilitlenen:** 10K MAU bir satış eşiği değil, **ürün doğrulama eşiğidir**. Exit planı hedef tablosu olarak değil, **disiplin dokümanı** olarak kullanılır. Ondan alınan ve korunanlar: TMDB/IP due diligence, founder bağımsızlığı, dokümantasyon, veri sahipliği, repo hijyeni.

**Gerekçe:** 10K MAU + $60K ARR profili stratejik alıcı profili değil, app marketplace profilidir. Letterboxd/streaming tarafı bu ölçekte metrik satın almaz. Hedefi buraya çivilemek, ürün kararlarını yanlış alıcıya göre optimize ettirir.

---

### D-11 — Feedback yorgunluğu: 3 soru → 1 soru/24 saat

**Dokümanda:** Champion sonrası "Did Chosy get tonight right?" (SONHALİ §73) + ertesi gün "Did you watch?" (§15) + ardından "Worth the pick?" (§74)

**Kilitlenen:** **24 saatte en fazla bir feedback isteği.** v1'de: ertesi gün watch feedback + (yalnızca "izledim" denirse) aynı ekranda satisfaction. Champion sonrası anlık feedback ekranı **Faz 1'e** ertelenir.

**Gerekçe:** Üç ayrı soru, 40 saniyelik ritüeli anket hattına çevirir ve üçünün de yanıt oranını düşürür.

---

### D-12 — K-03 state enum'u: 6 varsayılan durum → 5 gerçek durum + 2 gömülü semantik

**Dokümanda (K-03):** Home = tek route, explicit state enum: `waiting · ready · in_progress · completed · watch_feedback · error_recovery` (SONHALİ §68).

**Kilitlenen:** **K-03 uygulamada 5 durum + 2 gömülü semantik olarak gerçekleşti (ölçüm varsayımı çürüttü).** `components/gauntlet/GauntletShell/index.tsx` (C.2-2, 14.08.2026 CTO onaylı, cihazda doğrulanmış) şu enum'u taşır:

```ts
type ShellState = 'before_18' | 'bootstrapping' | 'ready' | 'in_progress' | 'completed_today';
```

Bible'ın altı adının uygulamadaki karşılığı:

| Bible (K-03) | Uygulama | Not |
|---|---|---|
| `waiting` | `before_18` **+** `bootstrapping` | **İkiye ayrıldı.** Bekleyiş (18:00 kapısı, gauntlet ÇAĞRILMAZ — PRODUCT_OS §3.6) ile yükleme (401 bootstrap penceresi, graphite iskelet) farklı ekranlar ve farklı hata yollarıdır; tek ad ikisini gizlerdi. |
| `ready` | `ready` | Birebir. |
| `in_progress` | `in_progress` | Birebir. |
| `completed` | `completed_today` | Ad netleşti; iki dallı — champion (`ChampionReveal`) ya da exhausted (§15.3). |
| `watch_feedback` | **gömülü** | Ayrı enum dalı değil: `pendingFeedbackVisible && gauntlet.pendingWatchFeedback` erken dönüşü (`index.tsx:760`), enum kontrolünün ÖNÜNDE. Backend alanına bağlı olduğu için client-side bir durum değildir. |
| `error_recovery` | **gömülü** | Ayrı enum dalı değil: `loadError` (`bootstrapping` dalı içinde, `:781`) ve `actionError` (oyun görünümünde inline, `:897`). Hata, içinde bulunulan durumun görünümüdür; ayrı durum yapmak kullanıcıyı bağlamından koparırdı. |

**Gerekçe:** K-03'ün korunması gereken özü — **tek route · explicit state · ghost state yok** — ihlal edilmedi, aksine daha sıkı karşılandı: her durumun tek bir render dalı var ve hiçbiri belirsiz ara durumda kalmıyor. Değişen yalnızca adlar ve granülerlik. Bible'daki altı ad bir *tahminden* yazılmıştı; GauntletShell yazılırken 18:00 kapısının yüklemeden ayrılması ve hata/feedback'in ayrı durum olmaması **ölçülerek** ortaya çıktı. Çalışan, cihazda doğrulanmış 861 satırlık bileşeni literal uyum için yeniden yazmak, kanıtlanmış kodu kanıtlanmamış bir isim listesine feda etmek olurdu.

**Karar (C.9b, 19.08.2026): Seçenek A — GauntletShell'e dokunulmaz, bible gerçeğe uyar.** Bu, F-02'de kurulan aynı yöntemdir (bible ismi gerçeğe uyar).

**Kapsam:** Yalnızca K-03'ün enum listesi. K-03'ün kendisi, diğer K/D/R/E maddeleri ve `types/gauntlet.ts` sözleşmesi değişmedi.

---

## 4. REDDEDİLENLER VE YERİNE KONAN ÇÖZÜM (R)

| # | Reddedilen | Kaynak | Yerine konan çözüm |
|---|---|---|---|
| **R-01** | 7 günlük trial | SONHALİ §31 | **Ürünün kendisi trial'dır.** Daily gauntlet sonsuza kadar ücretsiz; deneme süresi satmaya gerek yok. Paywall CTA'sı doğrudan `$29.99/yıl` ("$2.50/ay karşılığı"). Trial state'leri, churn muhasebesi ve review yükü ortadan kalkar. Faz 1'de A/B ile bakılır. |
| **R-02** | Reroll paywall'ı (Free 2 / Pro sınırsız) | EXIT §38, V2 §11 | **Ret merdiveni ücretsiz kalır ve monetizasyon değil ölçüm aracına dönüşür.** `choice_rejected` eventi candidate quality teşhisini besler (K-28). Frustration'ı paraya çevirmeden önce nedenini öğreniriz. |
| **R-03** | Streaming / servis filtresi (Pro) | V2 §8-9 | **Önce talep ölçülür, sonra inşa edilir.** v1'de `provider_clicked` eventi hangi sağlayıcıların gerçekten tıklandığını kaydeder. Filtre, availability'yi champion-sonrası sorgudan candidate pool kolonuna taşıyan ayrı bir pipeline gerektirir — Faz 1+, ve ancak tıklama verisi bunu haklı çıkarırsa. |
| **R-04** | Rewarded ads | V2 §17-18 | **Kapatıldı — ikame yok.** İhtiyacı karşılayan mekanizma zaten var: ilk kaçırılan gün ücretsiz telafi (K-46). 3K DAU'da ~$450–1.350/ay karşılığında yeni SDK + ATT akışı + privacy manifest + nutrition label + pozisyon hasarı kabul edilemez. Reklam v1 gelir modelinde **yoktur**. |
| **R-05** | Sponsorlu champion / "Tonight's screening partner" | V2 §17 | **Kapatıldı.** K-50 ile doğrudan çelişiyor. Recommendation trust'ı zedeleyen her şey, ürünün tek savunulabilir varlığını zedeler. |
| **R-06** | Affiliate'in Tier 2 gelir kalemi olması | V2 §39, EXIT §37 | **Özellik kalır, gelir tezinden çıkar.** "Nerede izlenir" bir **ürün kalitesi metriğidir** (champion → watch köprüsü). Abonelik-içi başlıklarda komisyon genelde yoktur. 1K'da gerçek tıklama verisi + doğrulanmış program şartlarıyla yeniden değerlendirilir. |
| **R-07** | Rank sistemi (Observer → Auteur) | SONHALİ §25 | **Kimlik yükünü DNA milestone copy'si taşır.** Day 1 "forming" → Day 7 "taking shape" → Day 30 "becoming an Archivist" → Day 90 "your taste evolved". Eşik ekonomisi, progression tasarımı ve yeni copy sistemi gerektirmez; K-33'ün omurgasına zaten bağlıdır. |
| **R-08** | Friend challenge altyapısının şimdiden hazırlanması | EXIT §9 | **Share deep-link'i zaten `gauntlet_id` taşıyor** (attribution için gerekli). Tohum budur. Ayrıca challenge ID sistemi kurmak, kullanılmayacak altyapı = teknik borç demektir. |
| **R-09** | Home Screen widget | EXIT §18 | **Ertelendi (1K–3K).** WidgetKit + Expo, config plugin ve native extension gerektirir; managed workflow'da tek sprintlik iş. Retention hipotezi test edilecek kohort mevcut değil. |
| **R-10** | 5 Custom Product Page | EXIT §21 | **Tek sayfa + 6 ekranlık anlatı** (Stop scrolling → Four films → Three choices → One winner → Your taste evolves → Tomorrow we know you better). CPP/PPO testleri trafik ister; trafik yokken varyant üretmek gürültüdür. |
| **R-11** | 6 growth engine (ASO derinliği, social content, creator seeding, referral, App Store events, seasonal gauntlet) | EXIT §20-31 | **Kapatıldı — tanım gereği v1 sonrası.** Marketing, bu dokümanın kapısından geçildikten sonra başlar. CMO projesinde bekletilir. |
| **R-12** | Quiz'in kalması | IA §2.8'de açık bırakılmıştı *(IA dokümanının §2.8'i — bu belgenin §2.8'i değil, bkz. oradaki not)* | **Karar veriliyor: giriş noktası kaldırılır.** `archetype_id`'yi quiz'den yazmak "arketip davranıştan kazanılır" kilidiyle çelişir ve DNA anlatısını yalanlar. Mevcut değerler **silinmez**, cold-start seed olarak kalır. Şema değişikliği yok. |
| **R-13** | Grup gauntlet altyapısı | V2 §13, EXIT §29 | **Faz 2. Kapatıldı.** |
| **R-14** | Cinema Compatibility / sosyal karşılaştırma | EXIT §29 | **10K sonrası. Kapatıldı.** |
| **R-15** | Android | EXIT §69 | **3–5K MAU + stabil retention sonrası. Kapatıldı.** |
| **R-16** | Paywall benefit listesinde "Unlimited rerolls" + "Streaming filters" | SONHALİ §31 | **Var olmayan özelliği satmak yasak.** Paywall yalnızca K-47'deki iki değeri gösterir. |
| **R-17** | Champion sonrası anlık feedback ekranı | SONHALİ §73 | D-11'e devredildi — Faz 1. |
| **R-18** | 8 eksenli çoklu-hue radar mockup'ı | IA §4 | Zaten reddedilmişti; **C.9 sonrası, 6 eksenli tek renk ailesiyle** yeniden tasarlanacak. v1 kapsamı dışı. |

---

## 5. CTO EKLERİ — HİÇBİR DOKÜMANDA OLMAYANLAR (E)

### E-01 — Zaman dilimi mimarisi ⚠️ EN BÜYÜK GİZLİ BAĞIMLILIK

Üç doküman da "18:00'de gauntlet hazır" ve "18:00 bildirim" diyor. **Kimin 18:00'i sorusu hiçbirinde sorulmamış.** pg_cron şu anda UTC'de çalışıyor.

Gereken: kullanıcı başına timezone kaydı · saat dilimi bazlı batch üretim pencereleri · DST davranışı · seyahat eden kullanıcı davranışı (gün sınırının kayması streak'i bozmamalı).

**K-03'teki `waiting` state'i ve D-02'deki tek push doğrudan buna bağımlıdır.** M2 sprint'i olarak kilitlenmiştir.

### E-02 — Havuz derinliği matematiği

Günlük kullanıcı yılda **4 × 365 = 1.460 film gösterimi** tüketir. 6 eksenli diversity kısıtları etkin havuzu daraltır; `poster_quality_ok` gate'i (D-03) ayrıca keser.

Ölçülmesi gereken: mevcut `curation_tier` havuzunun etkin boyutu · tekrar oranının %10'u geçtiği gün · diversity kısıtları altında kalan gerçek aday sayısı.

**C.9b'den önce ölçülür.** Retention'ı öldüren şey kötü UI değil, 40. günde tanıdık posterdir.

### E-03 — Altyapı birim maliyet modeli

Hiçbir dokümanda tek bir dolar rakamı yok. 10K MAU hedefi koyup birim maliyeti bilmemek, gelir tarafındaki her hesabı anlamsız kılar.

Modellenecek: günlük generation batch maliyeti · Edge invocation sayısı · pgvector sorgu maliyeti · TMDB/OMDb rate limit tavanları · Haiku çağrı maliyeti · Supabase depolama (session replay dahil). Çıktı: **kullanıcı başına aylık maliyet** ve `$29.99/yıl`'ın hangi conversion oranında başabaş verdiği.

### E-04 — Sentry release health + EAS source map pipeline

SONHALİ §43'ün istediği "bug ↔ sürüm korelasyonu" source map upload'ı olmadan çalışmaz. EAS build hook'una eklenecek. Aksi halde production stack trace'leri okunamaz ve release health verisi anlamsızdır.

### E-05 — Mevcut kullanıcı göçü *(Bölüm 6'da detaylandırılmıştır)*

Üç dokümanda da **yok**. C.9, mevcut 63 kullanıcının bildiği tek yüzeyi siliyor. Göç planı olmadan relaunch, elimizdeki tek gerçek sinyali yok eder.

### E-06 — Kademeli dağıtım

63 kullanıcı tek gerçek sinyalimizdir. Önce TestFlight alt kümesi, doğrulandıktan sonra genel dağıtım. Bozuk bir build kohortun tamamını aynı anda yakamaz.

### E-07 — Watch feedback **yanıtlanma oranı** ayrı metrik

Watched-it rate'i ölçebilmenin ön koşulu, sorunun cevaplanmasıdır. Yanıt oranı <%50 ise watched-it rate'i istatistiksel olarak yorumlanamaz — ürün kararı **yanıt oranı düzeltilmeden** alınmaz.

---

## 6. MEVCUT KULLANICIYI KAÇIRMAMA PLANI (E-05 detayı)

**Mevcut durum:** 63 gerçek hesap · 87 yetim anonim kimlik (`public.users` satırı yok, 23 Nisan'dan beri) · kullanıcıların bildiği Home = mood search + quota · quiz arketipleri · iki ayrı watchlist ekranı · iki paywall CTA'sı / iki RevenueCat offering'i · 0/0 gösteren badge'ler.

| Risk | Önlem | Sprint |
|---|---|---|
| **Alışkanlık kırılması** — açtığında bambaşka uygulama, açıklama yok | Sürüme özel **tek seferlik "Chosy değişti" köprü ekranı**: 3 satır + "Bu geceki gauntlet'i gör". Onboarding değil, yeniden tanıştırma. `has_seen_relaunch_intro` flag'i. | R-A |
| **Özellik kaybı algısı** — mood search paywall arkasına gidiyor | **Grandfathering:** relaunch tarihinden önce oluşmuş hesaplara mood search ücretsiz kalır. Maliyet ≈ 0, 1-yıldız riski ≈ 0, Faz 0 "her şey ücretsiz" kuralıyla uyumlu. | M0 |
| **87 yetim kimlik** | C.7 backfill migration **ilk iş**. Idempotent. | M0 |
| **Watchlist birleştirmede satır kaybı** | Merge kuralı: **union, DELETE yok**, `(user_id, film_id)` üzerinde en erken `created_at` korunur. Dry-run count raporu zorunlu. | C.9d |
| **Entitlement kaybı** | Yok — `chosy_plus` zaten canlı entitlement; sadece DB'deki 3 satırın `entitlement_id` değeri (`'premium'` → `'chosy_plus'`) düzeltiliyor. Eski CTA'lar (Plus / Founding Member) C.9c'de konsolide ediliyor. | M0 (veri) · C.9c (CTA) |
| **Kırık deep link** — `/mood`, `/discover` | 404 değil, Home'a redirect. | C.9a |
| **Zorla yeniden giriş** | Anonim session'lar güncellemeden sağ çıkmalı. Regresyon test maddesi. | M0 |
| **Sessiz kayıp** | **Kurucudan 63 kişiye kişisel mesaj**: "Chosy'yi baştan kurduk, ilk 63 kişisin." Elimizdeki en yüksek getirili retention aksiyonu ve hiçbir dokümanda yok. | R-D öncesi |
| **Bozuk build'in kohortu yakması** | E-06 kademeli dağıtım. | R-D |

---

## 7. NİHAİ ÜRÜN DURUMU — `CHOSY v1.0 MARKET READY`

### 7.1 Yüzeyler (11 — fazlası yok)

```
1.  Onboarding           3 kart · ilk açılış · atlanabilir
2.  Home                 state machine (K-03)
3.  Gauntlet round       Home içinde · full-screen
4.  Champion             Home içinde · kalıcı
                           Nerede izlenir · Sonraya bırak · Paylaş
                           tek cümlelik "neden bu film"
                           altında: Bugünün bonusu — Spotlight
5.  Where to Watch       sheet
6.  Context edit         sheet
7.  Auth prompt          champion sonrası · atlanabilir
8.  Profile              DNA → Streak → Watched → Saved → Pro → Settings
9.  Saved for later      Profile alt sayfası
10. Settings / Account   hesap silme cascade dahil
11. Paywall              sheet · tek tetikleyici (K-46)
```

### 7.2 Production-grade olması zorunlu sistemler

`identity` · `gauntlet state machine` · `choice events + versioning` · `watch feedback` · `poster quality gate` · `where-to-watch` · `tek günlük push` · `PostHog event dictionary` · `Sentry release health` · `RevenueCat tek entitlement` · `offline fallback` · `account deletion cascade`

### 7.3 Kapalı / donmuş

Discover · Today's Pick · Cinema Games hub · Badge/Collections UI · Quiz girişi · Rank · Radar · Widget · Grup gauntlet · Reklam · Trial · Reroll gate · Streaming filtresi · Lifetime satışı · Android · 5 CPP · Referral · Creator seeding · Seasonal gauntlet · Social feed · Chatbot

### 7.4 Marketinge çıkış kapısı

> **Bu 9 eşik tutmadan tek dolar ve tek saat marketinge harcanmaz.**

| # | Ölçüm | Eşik |
|---|---|---|
| G-1 | Crash-free | ≥ 99.5% |
| G-2 | 20 kullanıcı × 7 ardışık gün gauntlet completion | ≥ 70% |
| G-3 | Watch feedback **yanıtlanma** oranı (E-07) | ≥ 50% |
| G-4 | Watched-it ilk sinyal | ≥ 25% *(kill eşiği %20 · hedef %35, 500 kullanıcıda)* |
| G-5 | Neither rate | %15–30 bandında |
| G-6 | PostHog çekirdek eventleri doğrulanmış | 20/20 |
| G-7 | Açık P0/P1 | 0 |
| G-8 | App Review | geçilmiş |
| G-9 | **Relaunch sonrası 14 günde mevcut kullanıcı kaybı** | < %20 |

G-9 kritiktir: relaunch mevcut kullanıcıyı kaybettiriyorsa, marketing sadece zararı büyütür.

---

## 8. SPRINT PLANI — CLAUDE CODE UYGULAMA SIRASI

**Protokol (her sprint için istisnasız):**
- Ayrı `/clear` · keşif read-only ("no schema changes, read only") · ölçüm önce · DUR NOKTASI'nda CTO onayı · `git add` dosya listesi açıkça belirtilir · doğrulanmamış kapanış dili ("closed/complete") kullanılmaz.
- Claude Code'un **mimari karar yetkisi yoktur** (chosy-conventions §9). Yeni tablo/kolon, yeni pattern, yeni bağımlılık, sözleşme değişikliği, Edge Function ekleme/kaldırma → DUR ve sor.
- Yeni kullanıcı stringi eklendiğinde `en.json` + `tr.json` paritesi aynı commit'te (K-58).

| Sprint | Amaç | Kapsam | Ön koşul | DUR NOKTASI | Model |
|---|---|---|---|---|---|
| **M0** Göç & Kurtarma | Kimseyi kaybetmeden zemini hazırla | Orphan fix'in sahada doğrulanması (d9b22e2) · E-08 sessiz kimlik sıfırlama düzeltmesi · `subscriptions.entitlement_id` veri düzeltmesi (`premium`→`chosy_plus`) · `legacy_mood_access` grandfathering kolonu | Faz 1 keşif (tamamlandı) | Orphan sayımı 0 kalıcı · `identity_reset_detected` eventi Sentry+PostHog'da görünür · 3 satır düzeltildi · grandfathering flag'i doğru kohortta true | Sonnet 4.6 |
| **M1** Ölçüm Önce | Production'a çıkmadan ölçüm hazır | PostHog event dictionary (20 event) · `gauntlet_id`/`algorithm_version` alan bağlaması · Sentry release health + EAS source map (E-04) · `v_algorithm_daily` view onayı (D-04) | M0 | 20/20 event canlı doğrulanmış · test crash'i doğru release'e düşüyor | Sonnet 4.6 |
| **M2** Zaman Mimarisi | "18:00" sorusunu çöz (E-01) | Kullanıcı timezone kaydı · saat dilimi bazlı batch üretim · DST · gün sınırı ve streak etkileşimi | M1 | 3 farklı timezone'da üretim saati doğrulaması | Fable 5 |
| **M3** Havuz Gerçeği | Ölçüm sonra kod (E-02, D-03) | Havuz derinliği ölçümü · `poster_url` w92 bug fix · `poster_quality_ok` batch kolonu + cron | M1 | Etkin havuz boyutu · tekrar oranı eğrisi · gate'in elediği film sayısı | Sonnet 4.6 |
| **C.9a** Nav | 3 tab → 2 tab | Tab bar · Discover `app_config` flag · native tab bar (K-04) · `/mood` `/discover` redirect | M0 | Cihazda 2 tab · Discover erişilemez · deep link redirect çalışıyor | Sonnet 4.6 |
| **C.9b** Home | Ritüel production'a çıkar | Home state machine (K-03) · dev-gauntlet → production · mood search çıkar · champion CTA gap ("Sonraya bırak" + "Nerede izlenir") · **C.4'ün production'a AÇILMASI** (yeniden yazımı değil) · tek cümlelik açıklama (K-21) | M1·M2·M3·C.9a | Cihazda tam akış: bekleyiş → 3 tur → champion → ertesi gün watch feedback | Fable 5 |
| **C.9c** Profile | Profil sadeleşir | Profile sırası (K-08) · Pro Mode girişi · paywall CTA konsolidasyonu · badge UI kaldırma · **quiz girişi kaldırma (R-12)** | C.9b | Tek CTA · badge yok · quiz girişi yok · arketip verisi duruyor | Sonnet 4.6 |
| **C.9d** Watchlist | İkili kopya biter | Tek ekran · merge kuralı (union, DELETE yok) | C.9c | Dry-run count raporu · sıfır satır kaybı | Sonnet 4.6 |
| **R-A** İlk Deneyim | Yeni ve mevcut kullanıcı ayrı ayrı karşılanır | Onboarding 3 kart · auth-after-champion · bildirim izni (K-15) · **"Chosy değişti" köprü ekranı** · hesap silme cascade (K-16) | C.9d | Yeni kullanıcı ilk oturumu + mevcut kullanıcı köprü akışı cihazda | Fable 5 |
| **R-B** Güvenilirlik | "Çalışıyor" → "güvenilir" | Backend state machine (K-37) · idempotency · offline fallback (K-42) · error copy (K-43) | R-A | Uçak modu senaryosu · generation failure senaryosu · beyaz ekran yok | Fable 5 |
| **R-C** Para | Tek tetikleyici, tek entitlement | Arşiv paywall'ı (K-46) · RevenueCat state matrisi (K-49) · restore | R-B | 6 state test edilmiş · sandbox satın alma + restore | Sonnet 4.6 |
| **R-D** Çıkış | Store'a hazır | A11y (K-54) · QA matrisi (K-55) · App Store paketi · **TMDB lisansı (K-56)** · kademeli dağıtım (E-06) · 63 kişiye kurucu mesajı | R-C | 6 release gate (K-52) yeşil | Sonnet 4.6 |

**Paralel iş yok.** Her sprint bir öncekinin DUR NOKTASI'ndan onay almadan başlamaz.

---

## 9. AÇIK TEKNİK BORÇ (v1 kapsamı dışı, takip ediliyor)

| Borç | Statü |
|---|---|
| 63/75 `.update()` çağrısı 0-satır sonucuna kör | `TEKNIK_BORC.md` · v1 sonrası |
| Light Bleed chroma taban problemi (düşük-chroma filmler sönük kalıyor) | Görsel kalibrasyon turu · v1 sonrası |
| C.1 design token katmanı — space/radius export boşluğu | C.7 sonrası |
| Parse-mood 403 gate deploy'u | Client fix kullanıcıya ulaştıktan sonra (K-44 gate kuralı) |
| Typecheck baseline: 14 hata (scripts) / 32 (functions) | Azaltılıyor, artırılmıyor |
| E-03 altyapı maliyet modeli | M1 sonrası ayrı analiz |
| `subscriptions.entitlement_id` kolonu migration geçmişinde yok, canlıda var (schema drift) | R-B'de "yakalama" migration'ı yazılacak. Temiz `db reset` şu an bu kolonu üretmiyor. Kaynak: M0 Faz 2 raporu. |
| `npm run test:founder` 3/5 (wong_kar_wai, no_marvel FAIL) | Ayrı incelenecek, v1 kapsamı dışı. Kaynak: M0 Faz 2 raporu. |
| Cold-start identity reset — cihaz doğrulaması yapılmadı | CTO tarafından C.9a build'i dağıtılmadan önce elle doğrulanacak (Claude Code'un cihaz erişimi yok). Kaynak: M0 Faz 3 raporu. |
| Tam depo silinmesi (reinstall) kimlik kaybını ölçmüyor | Bilinçli olarak ertelendi — `expo-secure-store` yeni bağımlılık gerektirir ve gerçek kurtarma sağlamaz, sadece ölçüm. v1 sonrası yeniden değerlendirilecek. Kaynak: M0 Faz 3 raporu. |
| `.claude/skills/chosy-conventions/SKILL.md:57` bayat migration numarası (068 yazıyor, gerçek 090) | CLAUDE.md düzeltildi, bu dosya kapsam dışı bırakıldı — küçük iş, C.9a başlangıcında düzeltilecek. |

---

## 10. KARAR GÜNLÜĞÜ

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 1.0 | 17 Ağu 2026 | İlk kilit. 58 kilitli karar (K), 11 değiştirilerek kabul (D), 18 ret + ikame (R), 7 CTO eki (E). Kaynak: SONHALİ · EXIT PLANI · BUSINESS MODEL V2 · GO OS. |
| 1.1 | 17 Ağu 2026 | M0 Faz 1 keşif raporu bibledeki tahminleri düzeltti. Bkz. §11. |
| 1.2 | 17 Ağu 2026 | M0 Faz 2 tamamlandı (orphan doğrulama, E-08 görünürlük, entitlement veri düzeltmesi, grandfathering). Cold-start kör noktası bulundu, M0 Faz 3 olarak kilitlendi. Bkz. §11 F-05. |
| 1.3 | 17 Ağu 2026 | M0 kapandı (mantık seviyesinde). Cold-start event mantığı Deno birim testleriyle kanıtlandı, cihaz doğrulaması CTO'ya devredildi — açık kalan tek madde. Full-wipe/reinstall kör noktası bilinçli olarak backlog'a alındı (`expo-secure-store` bu turda eklenmiyor). Bkz. §11 F-05, §9. |
| 1.4 | 18 Ağu 2026 | Cold-start cihaz doğrulaması tamamlandı (F-06 kapandı) — M0'ın son açık maddesi kapandı. C.9a ve C.9a-2 (nav restructure, native tab bar) tamamlandı. |
| 1.5 | 19 Ağu 2026 | **C.9b swap.** Home route'u gauntlet'e geçti (`dev-gauntlet` → production), mood search `components/Home/MoodSearchScreen/`'e taşındı (silinmedi, C.9c'ye devredildi). **D-12 eklendi** — K-03 state enum'u 5 durum + 2 gömülü semantik olarak gerçekleşti; §2.1'deki K-03 satırına D-12 referansı düşüldü. Champion CTA'ları ("Sonraya bırak" · "Nerede izlenir") ve K-21 tek cümlelik açıklama **C.9b-2'ye** ayrıldı — bu swap cihazda doğrulandıktan sonra. |
| 1.6 | 19 Ağu 2026 | **C.9b-2.** Champion CTA'ları tamamlandı: "Sonraya bırak" (`submit-choice`'a `save_for_later` action'ı — yeni Edge Function YOK, şema/migration YOK, yüzey şampiyonla sınırlı) ve "Nerede izlenir" (`WatchProviders` bileşeni, `fetchMovieWatchProviders`). K-20 activation bridge'inin üç ayağı da bağlandı. **K-21 ERTELENDİ** — 6 eksen verisi hiçbir katmanda üretilmiyor; Post-C.9 radar chart sprint'ine taşındı. Bkz. §11 F-07. |

## 11. M0 KEŞİF DÜZELTMELERİ (v1.1)

Bu doküman yazılırken hafızadaki "87 yetim kimlik" ve `legacy_lifetime`/`legacy_quota`/`chosy_pro` isimleri **tahminle** yazılmıştı. 17 Ağustos keşif raporu gerçeği ölçtü. Aşağıdaki maddeler bu raporla düzeltilmiştir; K-38/K-48 kararlarının kendisi değişmiyor, dayandıkları sayılar değişiyor.

| # | Düzeltme | Eski varsayım | Gerçek durum |
|---|---|---|---|
| **F-01** | C.7 backfill'e gerek yok | 87 yetim kimlik, backfill zorunlu | Migration 082 zaten çalışmış. 3 orphan kaldı, hepsi test runner artığı (üretim yolu değil), 0'ı gerçek veri taşıyor (FK zorunluluğu nedeniyle yapısal olarak imkânsız). Kök neden d9b22e2 (17 Ağu) ile kapatıldı ama sahada doğrulanmadı. |
| **F-02** | Entitlement isimleri gerçekle uyuşmuyor | `legacy_lifetime` / `legacy_quota` / `chosy_pro` kodda/DB'de var | Kodda `chosy_plus`, DB'de `premium` yazıyor — ikisi birbirini tutmuyor. `legacy_lifetime` sahibi 0, `legacy_quota` karşılığı 3 kullanıcı (weekly_legacy ×2, monthly ×1), hedef entitlement zaten kodda `chosy_plus` olarak var. **DUR NOKTASI kararı (17 Ağu): Seçenek B — bible ismi gerçeğe uyar.** K-48 `chosy_pro` → `chosy_plus` olarak düzeltildi. RC dashboard'a dokunulmuyor, sadece DB'deki 3 satır (`entitlement_id`: `'premium'` → `'chosy_plus'`) M0 Faz 2'de düzeltiliyor. |
| **F-03** | Watchlist "duplicate" veri sorunu değil, kod sorunu | İkili kopyada satır kaybı riski | `UNIQUE(user_id, film_id)` kısıtı zaten var, 311/311 satır benzersiz, 0 duplicate. C.9d artık **saf kod konsolidasyonu** (iki ekran → bir ekran), veri merge riski yok. |
| **F-04** | **Yeni bulgu — E-08 olarak eklendi** | — | Anonim session sessiz sıfırlanabiliyor (`_layout.tsx:324-335`, üç `catch` bloğu Kural 1 ihlali). Rapor detayı §12'de. |

### E-08 — Sessiz kimlik sıfırlama riski *(yeni CTO eki, F-04 kaynaklı)*

Refresh token geçersizleşirse (süre dolumu, reuse-detection, sunucu iptali) `SIGNED_OUT` event'i yeni bir anonim kimlik açıyor; eski `public.users` satırı, watchlist, choice_events geçmişi eski `auth_id`'de kilitli kalıyor ve kurtarma mekanizması yok (088 `claim_device_data()`'yı kaldırmış). Üç `signInAnonymously()` çağrısının hata yolu da yalnızca `__DEV__` konsoluna yazıyor — production'da bu **hiç görünmüyor**.

Bu, G-9 gate'ini (relaunch sonrası mevcut kullanıcı kaybı <%20) doğrudan tehdit ediyor: bir kullanıcı sessizce sıfırlanırsa hem kendisi hem biz fark etmeyiz. **M0 Faz 2 kapsamına alınmıştır.**

**Durum (M0 Faz 2 sonrası, F-05):** In-app `SIGNED_OUT` yolu görünür hale getirildi (`app/_layout.tsx`, commit 07e91d3). **Ancak** en sık kayıp yolu — cold start'ta AsyncStorage restore başarısızlığı — hiç `SIGNED_OUT` yayınlamıyor, temiz kurulum gibi görünüyor ve mevcut event bunu yakalamıyor. **Karar (17 Ağu, M0 Faz 3 olarak kilitlendi):** yeni, auth session'dan bağımsız bir diagnostic persistence key (`chosy_last_known_auth_id_suffix`, AsyncStorage, hassas veri değil) eklenir; cold start'ta karşılaştırma yapılır, farklıysa `identity_reset_detected` `trigger: 'cold_start'` ile ateşlenir. C.9a'dan önce tamamlanır — build'ler test kohortuna gitmeden enstrümantasyon hazır olmalı.

**Durum (M0 Faz 3 sonrası, F-06):** Mantık `utils/identityReset.ts`'e izole edildi (test edilebilirlik için, `_shared/confidence.ts` deseniyle tutarlı) ve 10/10 Deno birim testiyle kanıtlandı — iz yok/aynı/farklı, callback hatası, yazma sırası, üç-açılışlık uçtan uca senaryo. Apple/Google girişinde iz tazeleme de eklendi (kasıtlı hesap geçişini yanlış pozitif saymamak için). **Açık kalan tek madde: cihaz üzerinde canlı doğrulama yapılmadı** (Claude Code'un cihaz erişimi yok) — CTO'ya devredildi, C.9a test build'i dağıtılmadan önce manuel olarak yapılacak.

**Durum (18 Ağu 2026):** Cihaz doğrulaması tamamlandı. Kanıt: PostHog Live'da olay sırası — Application Backgrounded → app_launched → identity_reset_detected → Application Opened → Application Became Active. F-06 kapandı.

**Bilinçli olarak kapatılmayan kör nokta:** Tam depo silinmesi (uygulama kaldırılıp kurulması) senaryosunda hem auth token hem diagnostic iz birlikte gider, olay `first_install` gibi sınıflanır. Bunu yakalamak `expo-secure-store` (yeni bağımlılık) gerektirir ve gerçek kurtarma sağlamaz — sadece ölçüm sağlar (Supabase token'ı zaten AsyncStorage'da, Keychain'de olsa bile session geri gelmez). **Karar: bu turda eklenmiyor**, backlog'a yazıldı (§9).

### F-07 — K-21'in eksen verisi yok *(C.9b-2 keşfi, 19 Ağu 2026)*

K-21 açıklama cümlesini "6 eksenden türetilir" diye tanımlıyor. **Bu 6 eksen (K-30:
Tempo · Intensity · Darkness · Realism · Era · Language) film başına hiçbir katmanda
üretilmiyor.** Ölçüm:

- `GauntletFilm` (kilitli sözleşme) = `id · title · year · runtime · posterUrl ·
  dominantColor?` — eksen alanı yok.
- Backend `Candidate` (`_shared/gauntletCore.ts`) = `director · primaryGenre ·
  language · imdbVotes · voteAverage` — eksen yok; `toGauntletFilm()` bunların
  hiçbirini istemciye geçirmiyor.
- `film_profiles.dimensions_json` VAR ama K-30'un ekseni DEĞİL: mood-search dönemine
  ait 12 boyutlu ayrı bir şema (`emotional_state`, `pace_preference`, `visual_style`…)
  ve `services/matchExplanation.ts`'in girdisi.

**Değerlendirilen ve REDDEDİLEN üç ikame (CTO, 19 Ağu 2026):**

| İkame | Ret gerekçesi |
|---|---|
| `ChoiceResult`'a yapısal sinyal alanı (sözleşme değişmeden) | Resume yolunda çalışmıyor — orada champion kilitli `DailyGauntlet.progress`'ten geliyor. Aynı gün cihazda 7/7 doğrulanmış `completed_today` resume davranışına yeni kırılganlık sokardı. |
| İstemci tarafı, tur zincirinden türetme | Yalnız 2 eksen (süre + yıl) üretir. D-06'nın reddettiği kalıbın aynısı: "6 eksenden geliyor" izlenimi veren ama 2 eksenden türeyen bir cümle ürünün zekâ iddiasını sahte temsil eder. |
| `GauntletFilm`'e eksen alanı (sözleşme değişikliği) | İki katmanlı iş: kilitli sözleşme + olmayan verinin ingestion'da üretilmesi. Tek sprint'e sığmaz. |

**Karar:** K-21 **ertelendi**. Yuvası C.9c DEĞİL (o Profile sadeleşmesi, eksen verisiyle
ilgisi yok) — **Post-C.9 "Cinema DNA radar chart (6-axis alignment, data
infrastructure)"** sprint'i. R-18 radar chart'ı ile K-21 aynı ingestion çalışmasına
muhtaç; ikisi birlikte ele alınır ki "eksen verisi yok" keşfi ikinci kez yapılmasın.

**Gate riski yok:** K-21 G-1…G-9 kriterlerinin hiçbirine girmiyor (crash-free,
tamamlama oranı, watch feedback, kullanıcı kaybı — hiçbiri açıklama cümlesine bağlı
değil).

**Değiştirme protokolü:** Herhangi bir K/D/R/E maddesinin değişmesi CTO onayı + sürüm artışı + bu tabloya satır ekleme gerektirir. Claude Code bu dokümandaki hiçbir maddeyi tek başına değiştiremez, esnetemez veya yorumlayamaz.

---

*Bu doküman Chosy v1.0'ın tek doğruluk kaynağıdır. Çelişki halinde bu doküman kazanır.*
