# 🔒 CHOSY V1.0 — KAPSAM KİLİDİ VE KARAR ANAYASASI

**Sürüm:** 1.47
**Tarih:** 9 Ekim 2026
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
| **K-03** | Home = **tek route, explicit state enum**: `waiting · ready · in_progress · completed · watch_feedback · error_recovery`. Ghost state yok. *(v1.46, 7 Eki 2026 — watch-feedback Home state'inde tab bar **görünür**; diğer immersive ritual ekranlarındaki mevcut gizleme kuralları değişmez. Gerekçe: Profile'a erişim gauntlet'in bu durumunda da açık kalmalı, pending feedback Skip sayılmamalı.)* ⚠️ **Enum listesi D-12 ile güncellendi** — "tek route + explicit state + ghost state yok" ilkesi aynen geçerli, durum adları uygulamada farklı gerçekleşti. | SONHALİ §68 |
| **K-04** | Tab bar **native-feeling**. Custom glass taklidi yok; sistemin Liquid Glass davranışı kullanılır. C.9a'da doğrulanır. | SONHALİ §62 |
| **K-05** | Spotlight'ın ayrı hub'ı yok. Sadece champion ekranının altında "Bugünün bonusu" kartı. *(v1.42, 3 Eki 2026 — kartın girişi, durumları ve champion ask dwell'iyle ilişkisi: **K-61**.)* *(v1.44, 5 Eki 2026 — **değişmedi:** bekleyiş ekranındaki kilitli kare (**K-62**) dokunulamaz, ikinci bir giriş değildir.)* | IA §2.6 |
| **K-06** | Watchlist ayrı tab değil, Profile alt sayfası. Otomatik giriş yok — tek yol champion'daki manuel "Sonraya bırak". | IA §2.4 |
| **K-07** | Badge / Collections UI kaldırılır. Tablo ve seed'e dokunulmaz. | IA §2.7 |
| **K-08** | Profile sırası: **Cinema DNA → Streak → Watched → Saved → Pro → Settings**. *(v1.31, 28 Eyl 2026 — **sapma:** Streak bölümü **ertelendi**; build'deki sıra Cinema DNA → Watched → Saved → Üyelik (Pro) + Settings başlıktaki dişli. Sıra hedefi geçerli, Streak geri geldiğinde yerine girer. Gerekçe ve kanıt: bkz. E-22.)* *(v1.33, 30 Eyl 2026 — **sapma:** Cinema DNA bölümü v1'de **gizli** (CTO kararı; bkz. K-32 notu). Build'deki sıra Watched → Saved → Üyelik.)* | SONHALİ §57 |
| **K-09** | Sheet/full-screen ayrımı: Context edit = sheet · Film detay = sheet · Paywall = sheet · Gauntlet = full-screen. | SONHALİ §63 |
| **K-10** | Seçim anında onay alert'i yok. `choice → instantaneous`. | SONHALİ §64 |

### 2.2 İlk deneyim ve kimlik

| # | Karar | Kaynak |
|---|---|---|
| **K-11** | Onboarding = **3 kart**, slideshow değil, quiz yok, mood input yok. İlk değer ilk gauntlet'in içinde öğrenilir. | SONHALİ §2-3 |
| **K-12** | İlk açılış **anonim session**. "Sign in with Apple" ilk ekranda **yok**. | SONHALİ §4-5 |
| **K-13** | Auth **champion sonrası**, değer karşılığı: ~~"Save your cinema journey"~~ **"Don't lose tonight's pick"** + "Not now". *(v1.24, 26 Eyl 2026: başlık ve açıklama değişti — ~~"Your streak and taste profile are saved here — free, no subscription needed."~~ Eski metin geçersiz; akış ve konum değişmedi.)* *(v1.41, 3 Eki 2026 — **açıklama:** **"Every night's pick and your watchlist stay saved here — free, no subscription needed."** Gerekçe: kodda gauntlet streak kavramı yok, metin var olmayan bir şeyi vaat ediyordu; "pick" başlıkla aynı kavram. Not: v1.24 satırı "taste profile" yazıyordu, canlı metin "streak and watchlist"ti — bible gerçeğe uyduruldu. Commit `7f645e7`. **Konum ve sıklık K-60'a tabidir:** gün 2+, 3 gün cooldown, en fazla 3 gösterim.)* | SONHALİ §5 |
| **K-14** | Auth sağlayıcı: **Sign in with Apple (primary) + email magic link (secondary)**. Üçüncüsü yok. ⚠️ **v1.24, 26 Eyl 2026: email magic link UI'dan kaldırıldı** — `AuthPromptSheet` ve `app/auth.tsx`'te yalnız Apple + "Not now" kaldı. Altyapı **uyuyan hâlde duruyor** (`MagicLinkForm`, `sendMagicLink`, `verifyMagicLinkCode` silinmedi, çağıranı yok); geri açmak yalnız UI işidir. **Android:** Apple butonu yalnız iOS'ta render edildiği için Android'de giriş yolu **yok**. v1 iOS-only olduğu için (R-15, §7.3) bugün canlı bir risk değil; R-15 açılırsa ön koşul. Commit: `f3610ad`. | SONHALİ §6 |
| **K-15** | Bildirim izni **ilk açılışta istenmez** — ilk champion'dan sonra, bağlam içinde: "Want your four ready every evening?" *(v1.31, 28 Eyl 2026 — **ek:** akşam 18:00 bildirimi **cihazda yerel planlanır** (sunucu push'u değil). ~~**KARAR VERİLDİ, UYGULANMADI** — bkz. E-22.~~)* *(v1.45, 6 Eki 2026 — **"uygulanmadı" ifadesi geçersiz:** kodda yerel hatırlatıcı var — `ensureDailyReminderScheduled()` (`services/pushNotifications.ts`), sabit kimlik `chosy_daily_reminder`, günlük `UNLOCK_HOUR` tetiği; kayıt `data.locale` ve `data.copyVersion` taşır, dil ya da metin sürümü (`DAILY_REMINDER_COPY_VERSION`, şu an 2) değişince bir sonraki açılışta yeniden planlanır. Commit'ler `e6e87be` (V-2 Tur E1, 28 Eyl) · `fdcae78` (P-5, copyVersion 2). **Cihaz doğrulaması bekliyor** — V1_TESTFLIGHT_CHECKLIST O7.)* *(v1.41, 3 Eki 2026 — champion sheet'inin sırası **K-60**'a tabidir: gün 1'de Spotlight'tan sonra.)* | SONHALİ §28 |
| **K-16** | Hesap silme **gerçek cascade**: auth user → profile → choice events → watch history → DNA → analytics identity. App Review blocker'ı, "polish" değil. ✅ **KAPALI** — denetlendi, analytics identity ayağı uygulandı ve canlıda uçtan uca doğrulandı (deploy v26, iki test senaryosu, PostHog + Sentry kanıtı); bkz. **E-20**, 26 Eyl 2026. | SONHALİ §7 |
| **K-60** | **Champion sonrası ask sırası (3 Eki 2026).** Bir champion oturumunda **tek modal ask**, günde en fazla bir (yerel gün). Hiçbir ask Spotlight kartını (K-05) örtmez, oyun sırasında ask çıkmaz. **Gün 1:** champion → Spotlight (oyna ya da geç) → bildirim izni (K-15), hiç sorulmadıysa. **Gün 2+:** auth (K-13). Koşul: anonim ∧ girişe dönüşmemiş ∧ toplam gösterim < 3 ∧ son gösterimden ≥ 3 gün. Değilse bildirim izni, hiç sorulmadıysa. Spotlight yarıda bırakıldıysa (`in_progress`) ask yok. **Tetik:** Spotlight dönüşünde bulmaca tamamlanmışsa ya da kart ≥ 8 sn görünür ve etkileşimsiz kalırsa. Blur/AppState tetiği yok; reveal'dan 1800 ms sonraki eski tetik kaldırıldı. **Gün** = kişisel champion günü sayısı (`daily_gauntlets`), streak değil. **Depolama:** `chosy_ask_state` (AsyncStorage, migration yok; yeniden kurulumda sıfırlanır, bilinen kabul). `users.auth_prompt_seen` yalnız gerçek giriş tamamlanınca yazılır. ~~R-A-2 sırası (22 Ağu 2026): auth önce, "Not now" bayrağı yazar, ömür boyu tek gösterim~~ — geçersiz, gerekçe: auth sheet Spotlight'ı örtüyordu, kullanıcı bonusu hiç görmüyordu. Saf karar fonksiyonu birim testli. Commit'ler `1d49d4d` · `70ef249`. Cihaz doğrulaması TestFlight toplu oturumunda (V1_TESTFLIGHT_CHECKLIST J3). Bilinçli tavizler §9'da. *(v1.42, 3 Eki 2026 — dwell sayacı yalnız kart **mount edildikten** sonra başlar; küçük cihazlarda kaydırma sonrası başlar, bkz. **K-61**.)* | CTO kararı, S-1 |

### 2.3 Gauntlet ve champion

| # | Karar | Kaynak |
|---|---|---|
| **K-17** | Soru daima **"Which would you watch tonight?"** — asla "which is better". Kullanıcı jüri üyesi değil. | Relaunch §6, SONHALİ §10 |
| **K-18** | Mekanik görünür kalır: ~~Context bar~~ · Round indicator · "Choose one". Minimal ≠ ambiguous. *(v1.38, 3 Eki 2026: Context bar `app_config.gauntlet_context_bar_enabled` ile varsayılan **gizli** — yeniden açma koşulu "Faz 1: bağlam tahmin modeli gelince". Round indicator ve "Choose one" aynen geçerli.)* | SONHALİ §9 |
| **K-19** | Motion: **CUT** = karar, **DISSOLVE** = geçiş. Champion = **720ms karanlık an**. Dekoratif animasyon değil, marka davranışı. | Design OS, EXIT §16 |
| **K-20** | Champion **end screen değil, activation bridge**: Nerede izlenir · Sonraya bırak · Paylaş. | SONHALİ §13-14 |
| **K-21** | Champion'da **tek cümlelik deterministic açıklama** ("Tonight you leaned toward intensity + realism"). LLM çağrısı yok, 6 eksenden türetilir. ⏸️ **ERTELENDİ** (19 Ağu 2026, C.9b-2 keşfi) — K-30'un 6 ekseni film başına HİÇBİR YERDE üretilmiyor. Yuvası: R-18 radar chart'ı ile aynı sprint (ortak eksen ingestion'ı). Bkz. §11 F-07. | SONHALİ §12, §20 |
| **K-22** | Champion ekranı **kalıcı**. Tekrar girişte aynı ekran, yeniden oynatmaz. | IA §2.3 |
| **K-23** | Ret merdiveni korunur (Ret 1 sessiz yeni çift · Ret 2 üç yön · Ret 3 liste/saved/yarın). Her ret **analytics sinyalidir**. | Product OS, Relaunch §9 |
| **K-61** | **Spotlight kartı girişi ve fold (3 Eki 2026, K-05 detayı).** **Giriş:** canlı finalde kart, reveal'ın **görsel bitişinden ~1000 ms sonra** 360 ms **dissolve** ile girer (K-19; token `BONUS_CARD_ENTRY`, süre `newContender`'ın aynısı). Resume'da ve Reduce Motion'da **gecikmesiz ve animasyonsuz**. Kart sarmalayıcısı giriş anına kadar **mount edilmez** → K-60'ın dwell sayacı görünmeyen kartta başlamaz. ~~Kart champion ile aynı anda mount edilir (V3-D6)~~ — geçersiz, gerekçe: dwell ölçümü kartın düzene girdiği anda başlıyordu, kullanıcı kartı görmeden önce sayıyordu. **Fold:** champion'da tek birincil eylem (Watch Now; yoksa dolgulu "Sonraya bırak", V3-D3), Sonraya bırak + Paylaş 44pt ikon satırına indi (K-20'nin üç eylemi aynen var); kart 72pt, bugünün karesi oyunun başladığı bulanıklıkta. Sonuç: 844pt ve üstünde kart kaydırmadan tamamen görünür. **Bilinçli taviz:** küçük cihazlarda (≤ 812pt, SE sınıfı) ve 2 satırlık başlıkta dwell **kaydırmadan sonra** başlar; hero oranı (0.46) **poster-first** gereği değişmedi, film başlığı kırpılmaz. **Durumlar:** Play / Continue / Çözüldü·Başarısız özeti, sunucu ilerlemesinden; bitmiş oyun yeniden oynatılmaz (K-22). Deneme sayısı gösterilmez (`get-daily-challenge` döndürmüyor, S-3 adayı). **Event'ler:** `spotlight_card_viewed` (`state`, `resumed`, `window_height`) ve `spotlight_card_pressed`. `spotlight_started` / `spotlight_completed` **eklenmedi** — oyun funnel'ı mevcut `game_daily_opened` / `game_daily_completed` (`game_id: 'spotlight'`) ile kurulur. Geometri Deno testli (`tests/gauntlet/championFold.test.ts`); 8 sn tetiğin cihaz doğrulaması bekliyor (V1_TESTFLIGHT_CHECKLIST N4). Commit'ler `9457185` · `4ed069c`. | CTO kararı, S-2 |
| **K-62** | **Spotlight ritüelin ikinci yarısı (5 Eki 2026).** Günlük ritüel iki parçalı: önce dörtlü (3 tur → champion), sonra bugünün karesi (Spotlight). Bekleyiş ekranında (`before_18`) bugünün karesi **kilitli ve bulanık** gösterilir (`SPOTLIGHT_MAX_BLUR`, Phosphor kilit, nötr kenar — mor yalnız champion kartında): "Bugünün karesi seni bekliyor. Dörtlünden sonra açılır." / "Today's frame is waiting. It opens after your four." **Dokunulamaz** — Pressable, dokunma geri bildirimi ve rota yok. **K-05 değişmez** (ayrı hub yok; Spotlight'ın tek girişi champion ekranındaki bonus kartı). **Paywall kapısı yok — değişmez.** **Gizlenir:** "Dün izledin mi?" kartı ekrandayken · bugün bulmaca yokken (`NO_PUZZLE`) · Spotlight `app_config.games_enabled.games`'te değilken (liste okunamazsa da gizli, fail-closed) · bugünün Spotlight'ı zaten başlamış ya da bitmişken (E-21 önceki döngü champion'ı 18:00'den önce açtırabiliyor) · gauntlet sırasında ve champion'da. Bekleyiş içeriği kaydırılabilir oldu (AX5 / küçük ekran, salt düzen). **Akşam bildirimi** (K-15 yerel, D-02 tek push): gövdenin ikinci cümlesi ~~"Bu akşamın şampiyonunu seç."~~ → **"Sonra bugünün karesi."** (en ~~"Pick tonight's champion."~~ → **"Then today's frame."**); metin sürümü (`copyVersion`) değişince mevcut planlı hatırlatıcı bir sonraki açılışta yeniden planlanır. **Event:** `spotlight_teaser_viewed` (yerel günde bir kez). **Guardrail:** teaser kullanıcıyı dörtlüyü aceleyle geçmeye itmemeli — `choice_events.latency_ms` medyanı ve `low_confidence` oranı izlenir. Taban (CTO brifi, 5 Eki 2026; bu turda yeniden ölçülmedi): 27 seçim / 7 kullanıcı, medyan 2500 ms, `low_confidence` %14,8. ~~Tetik eşiği bu kayıtta tanımlanmadı.~~ *(v1.45, 6 Eki 2026 — **eşikler tanımlandı:** medyan `latency_ms` **≤ 1750 ms** ya da `low_confidence` **≥ %24,8** → **inceleme tetikleyicisi**; otomatik alarm **değildir**, tetiklenince kullanıcı bazında dağılıma bakılır (birkaç kullanıcının sürüklediği medyan ürün sinyali sayılmaz). **Kapı:** yayından sonra **≥ 14 gün ve ≥ 150 seçim**; altında sonuç "yetersiz veri" olarak raporlanır, eşik değerlendirilmez. **Taban yayın gününde yeniden ölçülür** — yukarıdaki 27 seçimlik taban geçicidir.)* **Bilinen risk:** kare 18:00'den saatler önce istemciye iner (§9). Gösterim kuralı Deno testli (`tests/gauntlet/spotlightTeaser.test.ts`); cihaz doğrulaması V1_TESTFLIGHT_CHECKLIST §O. | CTO kararı, P-5 |

### 2.4 Sonuç döngüsü

| # | Karar | Kaynak |
|---|---|---|
| **K-24** | Watched-it döngüsü **P0**. Ertesi gün: "Did you watch X?" → Yes · Not yet · **I watched something else**. | SONHALİ §15-16 |
| **K-25** | "Başka bir şey izledim" **opsiyonel film aramasıyla** kaydedilir. Recommendation rejection + competing movie verisi. | SONHALİ §16 |
| **K-26** | "No" başarısızlık değildir — cezalandırıcı copy yasak. | SONHALİ §15 |
| **K-27** | Watched-it ve satisfaction **ayrı metriklerdir**, karıştırılmaz. | Relaunch §13 |
| **K-28** | Teşhis matrisi: yüksek Neither → candidate quality · düşük Neither + düşük Watched → champion quality. | SONHALİ §51 |
| **K-29** | Watch feedback kararları korunur: `loved`/`ok`/`abandoned` → `watched_at` yazar · `not_watched`/`skipped` → yazmaz. Skip `asked_at` yazar, bir daha sorulmaz. *(v1.46, 7 Eki 2026 — **`disliked` additive eklendi** ("Not for me", satisfaction sinyali): `loved`/`ok`/`disliked`/`abandoned` → `watched_at` yazar. **`abandoned` legacy davranış sinyali olarak enum'da kalır**, "Not for me" değildir, yeni UI'dan çıkar; silinmedi, yeniden anlamlandırılmadı. `types/gauntlet.ts` değişikliği CTO tarafından onaylandı (salt ekleme). **Not yet (`not_watched`) ve Skip persistence'ı T1'de değişmedi:** ikisi de soruyu kalıcı kapatır, veri düzeyinde `answered_at` ayrımı korunur (Not yet dolu, Skip NULL). Not yet sonrası follow-up **ayrı karar olarak backlog'da** ⚠️ hipotez: Not yet oranı yüksek çıkarsa (ör. > %30) tasarlanır; şimdilik veri yok (3 satır) ve 400 aktif kullanıcı altında kohort gürültü. `UNIQUE (user_id, gauntlet_id)` eklenmeyecek — mevcut kısmi `UNIQUE (gauntlet_id, film_id)` yeterli, yenisi sonradan cevaplama yolunu kapatır. `watched_other` ("I watched something else") bu kayıtta YOK, T1b.)* | C.4 kilidi |

### 2.5 DNA ve gamification

| # | Karar | Kaynak |
|---|---|---|
| **K-30** | **6 eksen**: Tempo · Intensity · Darkness · Realism · Era · Language. 8 eksen yok, alt kırılım yok. | IA §4, SONHALİ §58 |
| **K-31** | Tek renk ailesi (`marquee`/`beam`). Tür-kodlu çoklu palet **kalıcı olarak ölü**. *(v1.31, 28 Eyl 2026 — **istisna, kurucu kararı:** Pro Mode mood grid'inin kart zemin renkleri/gradient'leri (`MoodCardGradients`) korunur. İstisna yalnız bu yüzeyle sınırlı; başka ekrana tür-kodlu palet girmez. Bkz. E-22 (V1-D11).)* | Design OS §17 |
| **K-32** | DNA **dashboard değil narrative**. Üç yerde görünür: Champion ("Tonight you leaned…") · Profile ("You're becoming…") · Milestone ("Your taste has changed"). *(v1.33, 30 Eyl 2026 — **v1'de yok, v1.1'e ertelendi (CTO kararı).** Keşif `cf97732`: Profile kartı `cinema_dna` değil `sessions` okuyor, `recompute-taste-vector` tetiklenmiyor, D-06 eşiğini karşılayan kullanıcı 0. v1'de DNA vaadi yok, kart gizli. Boru hattı ön koşulları `docs/TEKNIK_BORC.md` ve §9.)* | SONHALİ §22 |
| **K-33** | Tek progression omurgası: **STREAK → DNA**. XP sayısı kullanıcıya gösterilmez. | SONHALİ §23-24 |
| **K-34** | Streak kaybı **cezalandırmaz**: "Tomorrow is another screening." | SONHALİ §26 |
| **K-35** | Gamification audit kuralı: Reward/Progress/Habit/Identity sorularının dördüne cevap vermeyen öğe **ürüne giremez**. | SONHALİ §54 |

### 2.6 Backend, veri, güvenilirlik

| # | Karar | Kaynak |
|---|---|---|
| **K-36** | 5 servis sınıfı (**AUTH · GAUNTLET · CHOICE · DNA · BILLING**) idempotent · observable · retryable · auditable olmak zorunda. | SONHALİ §35 |
| **K-37** | Gauntlet backend state machine: `GENERATING → READY → STARTED → ROUND_1 → ROUND_2 → FINAL → COMPLETED → WATCH_PENDING → WATCHED`. ⚠️ **Durum listesi D-13 ile güncellendi** — 9 durumlu makine hiç implement edilmedi; gerçek model `deriveProgress` ile türetilen 5 konumdur (`in_progress(0/1/2) → champion \| exhausted`), yeni kolon yok. "Ghost state yok" ilkesi aynen geçerli. | SONHALİ §69 |
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
| **K-46** | **Tek paywall tetikleyicisi: 2. kaçırılan gün → arşiv.** İlk kaçırma ücretsiz telafi. Diğer 4 tetikleyici Faz 1. *(v1.43, 3 Eki 2026 — **degrade:** arşivin içeriği o günün `scope='global'` satırı; global slot 1 Eyl'den beri üretilmiyor, 1 Eyl sonrası her kaçırılan gün `unavailable`. Karar değişmedi, bkz. §9.)* | IA §3 |
| **K-47** | Paywall'da **11 benefit değil 2 değer**: Functional ("Replay missed days") + Identity (~~"See how your taste evolves"~~ **"Pick your champion on your own time"**). *(v1.33, 30 Eyl 2026 — **Identity değeri geçersiz, gerekçe: özellik v1'de yok.** Zevk değişimini gösteren bir yüzey yok ve `recompute-taste-vector` hiçbir yerden tetiklenmiyor (keşif `cf97732`); R-16 gereği yerine gerçekte sunulan konuldu. TR: "Şampiyonunu kendi saatinde seç". "İki değer" kuralı değişmedi.)* | SONHALİ §33 |
| **K-48** | Tek entitlement **`chosy_plus`** *(v1.1'de düzeltildi — bkz. §11 F-02/DUR NOKTASI B)*. Tüm gate'ler entitlement üzerinden, server-side. Webhook idempotent, retry'lı, reconciliation'lı, **silent downgrade yok**. | SONHALİ §34 |
| **K-49** | RevenueCat state matrisi test edilmeden release yok: restore · expiration · grace period · billing issue · refund · revoked. | SONHALİ §34 |
| **K-50** | **Gauntlet reklamsız.** Interstitial yok, sponsored film yok, banner yok, "watch ad before champion" yok. | V2 §15-16 |
| **K-51** | Veri satışı / data monetization yok. | EXIT §43 |
| **K-59** | **Paywall v1 gerçek durumu ölçüldü (24 Eyl 2026).** Trial **gerçektir ve canlıdır**: Monthly 3 gün · Annual 7 gün (ASC, 18 May 2026'dan beri). Fiyat ASC ↔ kod senkron: `$6.99` / `$39.99` / `$89.99`. Faz 0'da fiyat değişmez. | ASC + RevenueCat ölçümü |

> **Not (24.09.2026, K-46 eki — paywall giriş noktaları denetimi).**
>
> 9 paywall varyantının tamamı kod düzeyinde tarandı; K-46'nın "tek tetikleyici"
> hükmünün kapsamı aşağıdaki gibi netleştirildi.
>
> **Yetkilendirilen (CTA-tabanlı, kullanıcı-başlatmalı).** `profile_upgrade`
> (Profile › ~~"Chosy Pro"~~ **"Chosy Plus"** *(v1.29 metni, v1.31'de kayda geçti — bkz. E-22)* CTA'sı ve Pro Mode kilitli ekranı) ile `mood_history`
> (Profile › Taste DNA dokunuşu) **yükseltme girişi** olarak kalır. Gerekçe:
> K-45'in yasakladığı şey kullanıcıya **dayatılan** anlardır (onboarding · ilk
> oturum · şampiyon · günlük gauntlet); bu ikisi kullanıcının kendi bastığı
> düğmelerdir ve ritüeli hiçbir noktada kesmez. İçerik kuralı değişmez: her
> ikisi de **K-47**'nin iki değerine ve **R-16**'nın "var olmayan özelliği
> satmak yasak" hükmüne tabidir.
>
> **Durum notu (30 Eyl 2026, v1.33).** `mood_history` girişi **v1'de fiilen
> kapalı**: Profile'daki Cinema DNA kartı gizlendi (`isCinemaDnaEnabled()` →
> `false`, `constants/config.ts`), dokunulacak yüzey kalmadı. Tetikleme kodu
> (`triggerOrchestrator`, `PaywallMoodHistory`) değişmedi, silinmedi; yetki
> hükmü geçerli, kart v1.1'de dönerse giriş de döner.
>
> **Kaldırılan duvar.** `quota_exhausted`, grandfathered kohort
> (`legacy_mood_access`, migration 090) için kaldırıldı: erişimi bırakıp kotayla
> kesmek aynı sözü iki kez bozardı. Frustration'ı paraya çevirmeden önce nedenini
> öğrenme ilkesiyle (**R-02**) uyumludur. Slot kotası yalnız istemcide zorlandığı
> için bu dal fiilen sınırsızdır; **arama kotası `check_and_consume_quota` ve
> `parse-mood` ile sunucuda da sayılır** — o taraf için ayrı karar gerekir,
> §9'a alındı.
>
> **Düzeltilen sınır.** `missed_day_archive` artık **yalnız kullanıcı eylemiyle**
> açılır. Bileşen şampiyon ekranının içinde yaşadığı için mount anında
> kendiliğinden açılan paywall K-45'in "champion paywall'ı yok" yasağına
> komşuydu; durum sorgusu kalır, dayatma kalkar.
>
> **~~Ölü kod (dokunulmadı).~~** `streak_milestone` · `watchlist_full` ·
> `streaming_link` · `lifetime_soldout` kullanıcıya ulaşamıyor (tetikleyici hiç
> gönderilmiyor, giriş yolu yok veya `app_config` kapalı). `roulette_limit`
> 24 Eyl 2026'da ölçüldü: `discover_tab_enabled=false`,
> `games_enabled.roulette=false`, `paywall_roulette_limit=false` — üç kat kapalı.
> Temizlikleri **R-D kalemi** olarak ayrıldı, bu turda kod silinmedi.
>
> ⚠️ **Düzeltme (26 Eyl 2026, v1.22).** "Beşi de ölü" tespiti **fazla genişti**;
> tespit silinmedi, üstü çizildi (D-12/D-13 emsali). Beş aday tek tek
> sınıflandırıldı: **3 gerçek ölü (A) + 2 uyuyan ama planlı (B)**.
>
> | Varyant | Sınıf | Gerekçe |
> |---|---|---|
> | `watchlist_full` | **A** | Tetikleyicisi (`watchlist_full`, `custom_list_attempt`) hiçbir yerden gönderilmiyor; **flag'i de yok** (`VARIANT_CONFIG_KEYS` dışı → daima "aktif"). Tek kilidi emitter yokluğuydu. §6 tetikleyici tablosunda ve §8 faz planında adı geçmiyor. |
> | `roulette_limit` | **A** | Üç kat kapalı. Plan **kaldırma**, açma değil: Product OS §436 *"Roulette / Slot ❌ Kaldırılacak"*, CLAUDE_CODE_OS C.6. |
> | `streak_milestone` | **A** | `streak_milestone` hiç gönderilmiyor; tek dolaylı yol `game_perfect_streak` → çağıranları **dondurulmuş 4 oyun** (`fadein` · `imposter` · `logline` · `quoted`; Spotlight kullanmıyor). Flag `false`. §8 Faz 1 *"2 varyant"* diyor, canlı ikisi `missed_day_archive` + `quota_exhausted`. |
> | `streaming_link` | **B** | **Ölü değil, uyuyan/planlı.** BM OS §4 Katman 2 (Affiliate): *"`paywall_streaming_link` anahtarı zaten var ✅ — altyapı kısmen hazır"*; affiliate **§8 Faz 1** (1K–10K kullanıcı) kalemidir. Bileşen başlığı da *"V1.1 feature, ileride aktif olacak"* diyor. **Dokunulmadı.** |
> | `lifetime_soldout` | **B** | **Uyuyan/planlı.** Tetikleyicisi gerçekten gönderiliyor (`app/lifetime.tsx:160`). BM OS §5 *"1.000 ile sınırla; sınır `app_config`'ten lazy okunsun"* + §9 *"göç öncesi `app_config.paywall_lifetime_soldout` durumundan okunmalı"*; **R-E**'de `paywall_lifetime_enabled` ile birlikte değerlendirilir. **Dokunulmadı.** |
>
> **A grubu uygulandı (26 Eyl 2026).** Üç bileşen `components/paywalls/_archive/`
> altına taşındı (silinmedi, geri getirme adımları klasör README'sinde).
> `watchlist_full` tam söküldü; `roulette_limit` ve `streak_milestone` **minimum
> dokunuşla** kapatıldı — tipleri korundu, `triggerToVariant` null döndürüyor
> (`share_card_generated` emsali), böylece `app/roulette.tsx` ve **dondurulmuş
> oyun kodu hiç değişmedi** (CLAUDE.md: dondurulan oyunların kodu silinmez).
> `app_config` satırları DB'de **duruyor**, yalnız `SAFE_DEFAULTS`'tan çıkarıldı
> (`profile_upgrade` emsali). i18n anahtarları korundu — `en.json` ↔ `tr.json`
> paritesi bozulmadı.

> **Not (24.09.2026, K-59 ölçüm detayı) — bible gerçeğe uydurulmuştur (D-12/D-13 emsali).**
>
> **Tetikleyici/içerik.** K-46/K-47 doğru uygulanmış. Paywall'da toggle yok, 3 radio
> kartı var, annual ön seçili. `app/paywall.tsx` deprecated stub'tır.
>
> ⚠️ **Güncelleme (24.09.2026, aynı gün):** "3 radio kartı" tescili artık **flag'e
> bağlıdır.** Lifetime kartı D-08 ile çeliştiği için `paywall_lifetime_enabled`
> arkasına alındı (varsayılan `false`) — v1'de kullanıcı **iki kart** görür,
> Monthly ve Annual. Üç kartlı hâl yalnız flag açıkken geçerlidir.
> Bkz. §3 D-08 notu.
>
> **Trial — gerçek, kod hatalıydı.** App Store Connect'te Monthly 3 gün, Annual 7 gün
> ücretsiz deneme 18 Mayıs 2026'dan beri canlıdır. **R-01'in trial reddi geçersizdir**
> (bkz. §4 R-01 notu). Kod tarafındaki hata: `contextPaywall.trialInfo` statik
> "3 days free" yazıyordu ve tüm paywall varyantlarında ortaktı — Annual varsayılan
> seçiliyken yanlış bilgi (gerçek 7 gün). Metin seçili plana göre dinamikleşir;
> `ctaDefault` korunur.
>
> **Fiyat — kod ASC ile zaten senkron, yalnız metin tutarsızlığı vardı.**
> Monthly `$6.99` ve Annual `$39.99` ASC ↔ kod eşleşiyor, değişiklik yok; Lifetime
> ASC'de `$89.99`, kodda teyit edildi. Bazı doküman metinleri Annual'ı yanlışlıkla
> `$29.99` diye anıyordu — bu referanslar `$39.99`'a düzeltildi. `2_BUSINESS_MODEL`
> §5'teki **$4.99 / $29.99 / $79.99 hedefleri Faz 1'e aittir** ve hedef olarak kalır;
> Faz 0'da fiyat değiştirilmez (Faz 0 ilkesi: optimizasyona değil sinyale ihtiyaç var,
> bkz. E-10).
>
> **Lifetime IAP — ek işlem gerekmiyor** *(25 Eyl 2026'da düzeltildi).* "Chosy Plus
> Lifetime" (Non-Consumable IAP) ASC'de **zaten Approved ve canlıdır**; Save / Add for
> Review butonlarının pasif olması normal davranıştır — submit edilecek yeni bir şey
> yok. 24 Eyl'de bu satır "zorunlu bir alan eksik olabilir, submit'ten önce
> tamamlanmalı" diyordu; o teşhis **yanlıştı**, R-D kapsamından ve §9'dan düşürüldü.

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
| **K-55** | QA cihaz matrisi: Small iPhone · Standard · Pro Max × (latest iOS + bir önceki). *Not (v1.36, B-1 / Fix 8):* klavye içeren oyun ekranlarında matris **en uzun film adı × en büyük Dynamic Type (AX5) × açık sistem klavyesi (QuickType açık/kapalı)** eksenleriyle koşulur. Sabit kutulu metinler (oyun klavyesi tuşu, başlık maskesi slotu, arama input'u) `maxFontSizeMultiplier` **1.3** ile sınırlıdır (`Theme.fontScale.fixedBoxMax`); etiket ve gövde metni tam ölçeklenir (K-54). | SONHALİ §71 |
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

> **Not (24.09.2026):** D-08 **korunuyor**, ancak 24 Eyl 2026'da bir ihlal ölçüldü:
> `PaywallBase` üç plan kartından birini Lifetime (`$89.99`, "BEST VALUE") olarak
> satıyordu ve bu, bugün canlı olan `profile_upgrade` / `mood_history` girişlerinin
> altındaki yüzeydi. Profile'dan `/lifetime` linkinin kaldırılmış olması yetmiyordu —
> asıl satış yüzeyi paywall'ın kendisiydi.
>
> **Düzeltme: kart silinmedi, `paywall_lifetime_enabled` flag'inin arkasına alındı**
> (migration 116, varsayılan `false`; `remoteConfig` SAFE_DEFAULTS'ta da `false`,
> yani okuma hatası D-08 yönünde fail-closed). Flag false iken yalnız Monthly/Annual
> görünür, annual ön seçili davranış değişmez. Geri açmak tek satırlık `app_config`
> güncellemesidir — **R-E'de değerlendirilecek**. Kart tasarımına ve satın alma
> yoluna dokunulmadı.

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
| `waiting` | `before_18` **+** `bootstrapping` | **İkiye ayrıldı.** Bekleyiş (18:00 kapısı, gauntlet ÇAĞRILMAZ — PRODUCT_OS §3.6) ile yükleme (401 bootstrap penceresi, graphite iskelet) farklı ekranlar ve farklı hata yollarıdır; tek ad ikisini gizlerdi. ⚠️ **İstisna — E-21 (27 Eyl 2026):** "gauntlet ÇAĞRILMAZ" kuralı, sıfır kişisel `daily_gauntlets` satırı olan kullanıcı için kalkar (önceki döngü). Beş durum sözleşmesi değişmez. **Uygulandı — v1.30, bkz. E-21.1.** |
| `ready` | `ready` | Birebir. |
| `in_progress` | `in_progress` | Birebir. |
| `completed` | `completed_today` | Ad netleşti; iki dallı — champion (`ChampionReveal`) ya da exhausted (§15.3). |
| `watch_feedback` | **gömülü** | Ayrı enum dalı değil: `pendingFeedbackVisible && gauntlet.pendingWatchFeedback` erken dönüşü (`index.tsx:760`), enum kontrolünün ÖNÜNDE. Backend alanına bağlı olduğu için client-side bir durum değildir. |
| `error_recovery` | **gömülü** | Ayrı enum dalı değil: `loadError` (`bootstrapping` dalı içinde, `:781`) ve `actionError` (oyun görünümünde inline, `:897`). Hata, içinde bulunulan durumun görünümüdür; ayrı durum yapmak kullanıcıyı bağlamından koparırdı. |

**Gerekçe:** K-03'ün korunması gereken özü — **tek route · explicit state · ghost state yok** — ihlal edilmedi, aksine daha sıkı karşılandı: her durumun tek bir render dalı var ve hiçbiri belirsiz ara durumda kalmıyor. Değişen yalnızca adlar ve granülerlik. Bible'daki altı ad bir *tahminden* yazılmıştı; GauntletShell yazılırken 18:00 kapısının yüklemeden ayrılması ve hata/feedback'in ayrı durum olmaması **ölçülerek** ortaya çıktı. Çalışan, cihazda doğrulanmış 861 satırlık bileşeni literal uyum için yeniden yazmak, kanıtlanmış kodu kanıtlanmamış bir isim listesine feda etmek olurdu.

**Karar (C.9b, 19.08.2026): Seçenek A — GauntletShell'e dokunulmaz, bible gerçeğe uyar.** Bu, F-02'de kurulan aynı yöntemdir (bible ismi gerçeğe uyar).

**Kapsam:** Yalnızca K-03'ün enum listesi. K-03'ün kendisi, diğer K/D/R/E maddeleri ve `types/gauntlet.ts` sözleşmesi değişmedi.

---

### D-13 — K-37 state machine: 9 varsayılan durum → 5 gerçek durum (türetme modeli)

**Dokümanda (K-37):** Gauntlet backend state machine: `GENERATING → READY → STARTED → ROUND_1 → ROUND_2 → FINAL → COMPLETED → WATCH_PENDING → WATCHED` (SONHALİ §69).

**Kilitlenen: bu 9 durumlu makine hiç implement edilmedi ve edilmeyecek.** Gerçekte durum hiçbir yerde saklanmaz; her istekte `choice_events` + `daily_gauntlets.film_ids`'ten `deriveProgress` ile deterministik **türetilir** (Seçenek 1 — yeni kolon yok, `generation_status` açılmaz).

Gerçek durum uzayı `types/gauntlet.ts`'te kilitlidir: 3 değerli `GauntletProgress.status` + `completedRounds` (0-3) → fiilen ayırt edilebilir **5** konum:

```
in_progress(0) → in_progress(1) → in_progress(2) ─┬─→ champion
                                                  └─→ exhausted
```

Bible'ın dokuz adının uygulamadaki karşılığı:

| Bible (K-37) | Uygulama | Not |
|---|---|---|
| `GENERATING` | **yok** | Üretim `generate-gauntlet` isteğinin içinde senkron çalışır; INSERT başarılı olana kadar satır yoktur. Yarım kalan üretim iz bırakmaz. |
| `READY` | `in_progress(0)` | Ad farkı. |
| `STARTED` | **READY ile aynı** | "Üretildi" ile "kullanıcı açtı" arasında ayrım yapan kolon yok. |
| `ROUND_1` | `in_progress(1)` | Eşleşiyor. |
| `ROUND_2` | `in_progress(2)` | Eşleşiyor. |
| `FINAL` | **ROUND_2 ile aynı** | "3. tur oynanıyor" = `completedRounds === 2`; ayrı temsili yok. |
| `COMPLETED` | `champion` | `completedRounds === 3` + `champion_film_id` son kazananla doğrulanır. |
| `WATCH_PENDING` | **bu makinenin durumu değil** | Çapraz satır türetmesi (`date < bugün` + şampiyon var + `watch_feedback` yok), yanıtta ayrı alan: `pendingWatchFeedback`, farklı `gauntletId`. |
| `WATCHED` | **bu makinenin durumu değil** | `watch_feedback.response` + `watchlist.watched_at`. |

Buna karşılık bible'da **adı olmayan** gerçek bir durum vardır: `exhausted`, iki gerekçeyle (`timeout_no_winner` · `no_candidates`).

**Gerekçe:** K-37'nin korunması gereken özü — *gauntlet'in nerede kaldığı her an kesin bilinmeli, ghost state olmamalı* — türetme modeliyle **daha sıkı** karşılanıyor: saklanan durum yoktur, dolayısıyla "durum kolonu gerçekle uyuşmuyor" sınıfı bir hata sınıfı hiç doğmaz. `deriveProgress` tutarsızlık gördüğünde sessizce düzeltmez, **throw eder** (CLAUDE.md #1). Dokuz ad bir *tahminden* yazılmıştı; `generate-gauntlet` yazılırken beş konumun yettiği ve `GENERATING`/`STARTED`/`FINAL`'ın komşularından ayrışmadığı **ölçülerek** ortaya çıktı.

**Karar (27.08.2026): Seçenek A — kod korunur, bible gerçeğe uyar.** D-12'de K-03 için kurulan aynı emsal.

**Kapsam:** Yalnızca K-37'nin durum listesi. K-38 (kayıt alanları), K-39, K-40 ve `types/gauntlet.ts` sözleşmesi değişmedi. `generation_status` kolonu **açılmadı** — `092_v_algorithm_daily`'nin `champion_film_id IS NOT NULL` vekili yerinde kalır (bilinen sapması: `exhausted` biten gauntlet'leri tamamlanmamış sayar).

**Kaynak:** `docs/os/K37_GAUNTLET_STATE_MACHINE.md` — 27 Ağustos 2026 keşfi (tam türetme tablosu, sapmalar, client haritalaması, ara durum riskleri). Önceki tespit: `docs/05_SPRINTS/ARCHIVE/M1_OLCUM_ONCE.md` DUR NOKTASI #2 (18 Ağu 2026).

---

## 4. REDDEDİLENLER VE YERİNE KONAN ÇÖZÜM (R)

| # | Reddedilen | Kaynak | Yerine konan çözüm |
|---|---|---|---|
| **R-01** | 7 günlük trial | SONHALİ §31 | ⚠️ **Trial reddi geçersiz — bkz. K-59 notu, 24 Eyl 2026.** ASC'de Monthly 3 gün / Annual 7 gün trial 18 May 2026'dan beri canlıdır; ret maddesi gerçekle çelişiyordu, bible gerçeğe uyduruldu. Freemium omurgası (daily gauntlet sonsuza kadar ücretsiz) **değişmez** ve E-10 ile korunur. Orijinal metin: "Ürünün kendisi trial'dır… Paywall CTA'sı doğrudan `$39.99/yıl`. Trial state'leri, churn muhasebesi ve review yükü ortadan kalkar. Faz 1'de A/B ile bakılır." |
| **R-02** | Reroll paywall'ı (Free 2 / Pro sınırsız) | EXIT §38, V2 §11 | **Ret merdiveni ücretsiz kalır ve monetizasyon değil ölçüm aracına dönüşür.** `choice_rejected` eventi candidate quality teşhisini besler (K-28). Frustration'ı paraya çevirmeden önce nedenini öğreniriz. |
| **R-03** | Streaming / servis filtresi (Pro) | V2 §8-9 | **Önce talep ölçülür, sonra inşa edilir.** v1'de `provider_clicked` eventi hangi sağlayıcıların gerçekten tıklandığını kaydeder. Filtre, availability'yi champion-sonrası sorgudan candidate pool kolonuna taşıyan ayrı bir pipeline gerektirir — Faz 1+, ve ancak tıklama verisi bunu haklı çıkarırsa. ⚠️ **Ölçüm mekanizması kalktı — bkz. v1.23, 26 Eyl 2026.** Şampiyon ekranındaki sağlayıcı logoları artık dokunulmaz; `provider_clicked` gönderilmiyor. Reddin kendisi geçerli kalır, talep ölçümü §9'da açık borç. |
| **R-04** | Rewarded ads | V2 §17-18 | **Kapatıldı — ikame yok.** İhtiyacı karşılayan mekanizma zaten var: ilk kaçırılan gün ücretsiz telafi (K-46). 3K DAU'da ~$450–1.350/ay karşılığında yeni SDK + ATT akışı + privacy manifest + nutrition label + pozisyon hasarı kabul edilemez. Reklam v1 gelir modelinde **yoktur**. |
| **R-05** | Sponsorlu champion / "Tonight's screening partner" | V2 §17 | **Kapatıldı.** K-50 ile doğrudan çelişiyor. Recommendation trust'ı zedeleyen her şey, ürünün tek savunulabilir varlığını zedeler. |
| **R-06** | Affiliate'in Tier 2 gelir kalemi olması | V2 §39, EXIT §37 | **Özellik kalır, gelir tezinden çıkar.** "Nerede izlenir" bir **ürün kalitesi metriğidir** (champion → watch köprüsü). Abonelik-içi başlıklarda komisyon genelde yoktur. 1K'da gerçek tıklama verisi + doğrulanmış program şartlarıyla yeniden değerlendirilir. ⚠️ **Tıklama verisi kaynağı kalktı — bkz. v1.23, 26 Eyl 2026** (`provider_clicked` gönderilmiyor). Karar geçerli kalır; yeniden değerlendirme için ölçüm §9'da açık borç. |
| **R-07** | Rank sistemi (Observer → Auteur) | SONHALİ §25 | **Kimlik yükünü DNA milestone copy'si taşır.** Day 1 "forming" → Day 7 "taking shape" → Day 30 "becoming an Archivist" → Day 90 "your taste evolved". Eşik ekonomisi, progression tasarımı ve yeni copy sistemi gerektirmez; K-33'ün omurgasına zaten bağlıdır. |
| **R-08** | Friend challenge altyapısının şimdiden hazırlanması | EXIT §9 | **Share deep-link'i zaten `gauntlet_id` taşıyor** (attribution için gerekli). Tohum budur. Ayrıca challenge ID sistemi kurmak, kullanılmayacak altyapı = teknik borç demektir. |
| **R-09** | Home Screen widget | EXIT §18 | **Ertelendi (1K–3K).** WidgetKit + Expo, config plugin ve native extension gerektirir; managed workflow'da tek sprintlik iş. Retention hipotezi test edilecek kohort mevcut değil. |
| **R-10** | 5 Custom Product Page | EXIT §21 | **Tek sayfa + 6 ekranlık anlatı** (Stop scrolling → Four films → Three choices → One winner → Your taste evolves → Tomorrow we know you better). CPP/PPO testleri trafik ister; trafik yokken varyant üretmek gürültüdür. |
| **R-11** | 6 growth engine (ASO derinliği, social content, creator seeding, referral, App Store events, seasonal gauntlet) | EXIT §20-31 | **Kapatıldı — tanım gereği v1 sonrası.** Marketing, bu dokümanın kapısından geçildikten sonra başlar. CMO projesinde bekletilir. |
| **R-12** | Quiz'in kalması | IA §2.8'de açık bırakılmıştı *(IA dokümanının §2.8'i — bu belgenin §2.8'i değil, bkz. oradaki not)* | **Karar veriliyor: giriş noktası kaldırılır.** `archetype_id`'yi quiz'den yazmak "arketip davranıştan kazanılır" kilidiyle çelişir ve DNA anlatısını yalanlar. Mevcut değerler **silinmez**, cold-start seed olarak kalır. Şema değişikliği yok. |
| **R-13** | Grup gauntlet altyapısı | V2 §13, EXIT §29 | **Faz 2. Kapatıldı.** |
| **R-14** | Cinema Compatibility / sosyal karşılaştırma | EXIT §29 | **10K sonrası. Kapatıldı.** |
| **R-15** | Android | EXIT §69 | **3–5K MAU + stabil retention sonrası. Kapatıldı.** *(v1.24 notu: Android açılırsa auth yolu yok — email UI geri açılmalı ya da auth prompt Android'de gösterilmemeli. Bkz. K-14.)* |
| **R-16** | Paywall benefit listesinde "Unlimited rerolls" + "Streaming filters" | SONHALİ §31 | **Var olmayan özelliği satmak yasak.** Paywall yalnızca K-47'deki iki değeri gösterir. |
| **R-17** | Champion sonrası anlık feedback ekranı | SONHALİ §73 | D-11'e devredildi — Faz 1. |
| **R-18** | 8 eksenli çoklu-hue radar mockup'ı | IA §4 | Zaten reddedilmişti; **C.9 sonrası, 6 eksenli tek renk ailesiyle** yeniden tasarlanacak. v1 kapsamı dışı. |
| **R-19** | Mevcut kullanıcı köprü aksiyonları: **"Chosy değişti" köprü ekranı** + **63 kişiye kurucu mesajı** + **G-9 kapısı** (relaunch sonrası 14 günde kayıp <%20) | Bu doküman E-05 / §6 / §7.4 | **Kapatıldı — CTO kararı, 26 Eyl 2026. İkame yok.** Gerekçe: korunacak bir alışkanlık yok. Ölçüm (26 Eyl 2026, 1 Eyl öncesi açılmış **253** `public.users` hesabı; mood araması + watchlist + `choice_events` toplamı): **192 hesapta hiç etkileşim yok**, 49'unda 1–5, 11'inde 6–20, yalnız 1'inde >20; ≥7 aktif gün **2**, streak ≥3 **1** hesap. G-9'un koruma amacı bu tabanda uygulanamaz. Kullanıcı verisi (auth, `public.users`, watchlist, streak) zaten korunuyor; §6'nın veri koruyan satırları geçerli kalır. **Kod durumu:** köprü ekranı `1d2a66f` ile **uygulanmıştı** (`app/relaunch-intro.tsx`, yönlendirme `app/gate.tsx:118-126`, bayrak migration 103). Yönlendirmenin kapatılması **ayrı kod işi** (§9); kapatılana kadar 2.1.0 build'i ekranı eski kohorta gösterir. *(Not: CTO gerekçesindeki "22 kayıttan 12'si" yalnız 1–25 Eyl kohortuydu; 22 kaydın 3'ü 26 Eyl test kimliği. Yerine tam taban ölçümü yazıldı, karar değişmedi.)* |
| **R-20** | ~~**Editoryal gün yenileme kilidi**~~ — E-19.1 `submit-choice` guard'ı (`refreshBlockedReason: 'editorial_day'`, editoryal günde `neither`/`seen` yeni çift getirmez) + DAL A'da watched-dışlamasının uygulanmaması | E-19.1 (19 Eyl 2026) | **Kaldırıldı — CTO Karar 2a, 2 Eki 2026.** Editoryal dörtlü bir **başlangıç dörtlüsüdür**; yenileme / `neither` / `seen` algoritmik gündeki gibi normal boru hattından (`buildScoredPool` + `pickReplacements`) çalışır, yenileme hakkı limiti aynen geçerli. Kullanıcının izlediği (`watchlist.watched_at`) editoryal film üretimde çıkarılır ve **aynı pozisyonda** normal havuzdan yedeklenir; `slot_types=['editorial'×4]` ve `algorithm_version='v1-editorial-calendar'` korunur. Gerekçe: G-5 (neither rate) editoryal kilit altında ürün davranışını değil kilidi ölçüyordu; ortak zemini zaten `1_PRODUCT_OS` §6.9 Slot-1 global sağlıyor. İstemcideki `editorial_day` işleme yolu ve `gauntlet.editorialNoRefresh` anahtarı silinmedi (eski sunucu yanıtıyla geriye dönük uyum) — `TEKNIK_BORC.md`. Deploy sırası: sunucu önce. |
| **R-21** | **`initializePurchases`'ı `getSession()`'ın önüne almak** (RC `configure`'ı oturumdan bağımsız, hemen başlatmak) — REACT-NATIVE-7'nin "en kısa" çözümü olarak önerildi | E-28 (9 Eki 2026) | **Reddedildi (CTO).** `appUserID`'siz `configure` RC'de `$RCAnonymousID` doğurur; oturum sonra gelince `logIn` fazladan bir anonim→kullanıcı TRANSFER üretir (CHOSY-EDGE-FUNCTIONS-14'ün sebep olduğu olay sınıfı). **Yerine:** `configure` sırası aynen kalır (oturum → `appUserID` ile configure); bekleyenler `rcReady`/`identityReady` sinyallerini bekler (bkz. E-26). |

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

Modellenecek: günlük generation batch maliyeti · Edge invocation sayısı · pgvector sorgu maliyeti · TMDB/OMDb rate limit tavanları · Haiku çağrı maliyeti · Supabase depolama (session replay dahil). Çıktı: **kullanıcı başına aylık maliyet** ve `$39.99/yıl`'ın hangi conversion oranında başabaş verdiği.

### E-04 — Sentry release health + EAS source map pipeline

SONHALİ §43'ün istediği "bug ↔ sürüm korelasyonu" source map upload'ı olmadan çalışmaz. EAS build hook'una eklenecek. Aksi halde production stack trace'leri okunamaz ve release health verisi anlamsızdır.

### E-05 — Mevcut kullanıcı göçü *(Bölüm 6'da detaylandırılmıştır)*

Üç dokümanda da **yok**. C.9, mevcut 63 kullanıcının bildiği tek yüzeyi siliyor. Göç planı olmadan relaunch, elimizdeki tek gerçek sinyali yok eder.

> ⚠️ **v1.26, 26 Eyl 2026:** §6'daki köprü ekranı ve kurucu mesajı **v1 kapsamı dışı** — bkz. **R-19**. Veri koruyan önlemler (grandfathering, backfill, watchlist merge, entitlement, redirect, anonim oturum sürekliliği) geçerli kalır.

### E-06 — Kademeli dağıtım

63 kullanıcı tek gerçek sinyalimizdir. Önce TestFlight alt kümesi, doğrulandıktan sonra genel dağıtım. Bozuk bir build kohortun tamamını aynı anda yakamaz.

### E-07 — Watch feedback **yanıtlanma oranı** ayrı metrik

Watched-it rate'i ölçebilmenin ön koşulu, sorunun cevaplanmasıdır. Yanıt oranı <%50 ise watched-it rate'i istatistiksel olarak yorumlanamaz — ürün kararı **yanıt oranı düzeltilmeden** alınmaz.

### E-09 — Paywall funnel enstrümantasyonu (R-C önkoşulu)

Freemium modelinde (R-01) dönüşümün kaldıracı paywall'ın tasarımı değil, tetiklendiği anın kalitesidir. K-46 tetikleyiciyi doğru kurmuş (2. kaçırılan gün → arşiv), ama bugün çalışıp çalışmadığını ölçecek enstrümantasyon doğrulanmamıştır.

Gereken eventler (G-6'nın "PostHog 20/20" kapısının parçası): `paywall_triggered` (trigger_type, missed_day_count) · `paywall_viewed` · `paywall_dismissed` (dismiss_method) · `purchase_initiated` (package_id) · `purchase_completed` · `restore_attempted` (sonuç: no_data / success / error).

**Kilitlenen sıra: R-C'de paywall ekranı yapılmadan ÖNCE enstrümantasyon tanımlanır ve doğrulanır.** Aksi halde dönüşmeyen bir paywall'ın nedeni ölçülemez — `recompute-taste-vector`'ün hiç çağrılmaması sınıfı bir kör nokta tekrarlanır.

Kaynak: RevenueCat State of Subscription Apps 2026 incelemesi, 27 Ağustos 2026 CTO oturumu.

### E-10 — Fiyat testi Faz 1'e kilitlendi (R-01 korunuyor)

SOSA 2026 verisi: yüksek fiyatlı uygulamalar indirmeleri düşük fiyatlılara göre 2 kat daha iyi dönüştürüyor (yüksek fiyat medyanı %2,8 · düşük fiyat medyanı %1,4). Mevcut $39.99/yıl düşük-orta bantta *(24 Eyl 2026'da ASC ile doğrulandı — daha önce bu satırda yanlışlıkla $29.99 yazıyordu; bkz. K-59)*.

Aynı rapor sert paywall'ın freemium'a göre 35. günde 5 kat daha iyi dönüştüğünü söylüyor (%10,7 vs %2,1), ancak bir yıl sonra elde tutma oranları eşitleniyor.

**Karar (27 Ağu 2026): R-01 (freemium, "ürünün kendisi trial'dır") DEĞİŞTİRİLMİYOR.** Gerekçe: (a) G-9 kapısı — 255 mevcut kullanıcının önüne sert paywall koymak "14 günde kayıp <%20" hedefini doğrudan tehdit eder; (b) gauntlet'i paywall arkasına almak fiyatlama değil ürün kararı olur, §1 Değişmez Çekirdek'e aykırı; (c) 0 ödeyen kullanıcıyla model değişikliği veriye değil tahmine dayanır.

Fiyat, R-01'i bozmadan test edilebilen tek değişkendir. **Faz 1 kalemi olarak kilitlendi**, tetikleyici: G-2 geçildikten sonra ilk A/B adayı. v1'de fiyat değişmez.

### E-11 — K-42 cihaz doğrulaması TestFlight'a ertelendi

27 Ağu 2026: yerel dev build (netinfo native modül derlemesi) ve simülatör mevcut değil. Expo Go/Metro dev server üzerinden test denendi, ancak JS bundle'ın kendisi ağ bağımlı olduğu için uçak modu testi K-42'nin kod yolunu hiç değerlendiremedi (bundle yüklenemedi) — sonuç yorumlanamaz, K-42'nin başarısızlığı değil.

**Karar: R-C açılıyor.** K-42'nin 8 senaryolu cihaz doğrulaması ilk TestFlight build'inde yapılacak — R-D (App Store submission) açılmadan önce zorunlu ön koşul. R-C'nin kendi kapısı (K-49, RevenueCat durum matrisi) zaten gerçek cihaz/sandbox gerektirdiği için TestFlight'a çıkış doğal olarak bu sıraya oturuyor, ayrı adım eklenmedi.

Ayrı bulgu: "Unlock the full experience" ekranında geri gezinme eksikliği tespit edildi (`TEKNIK_BORC.md`'ye eklendi), R-D öncesi çözülecek.

### E-12 — RC Paywalls v2: hibrit korunuyor, tam geçiş yapılmadı

31 Ağu 2026 fizibilite turu: RC native template'e tam geçiş, Wave 2'de kurulan hata sınıflandırmasını (`errorKind`, `entitlement_pending`, `dismiss_method`) ve offline görünür-hata+retry davranışını kaybettirir — RC offering'leri diske persist etmez (bilinçli tasarım: "bayat fiyat gösterme"), K-42'nin gauntlet cache'i bunu tamamlamıyor. Ayrıca R-C'nin çıkış kriteri (K-49, 6 state testi) sıfırdan başlardı.

**Karar: hibrit mimari korunuyor** — offering yönetimi RC'de, sunum katmanı (`PaywallBase` + variant'lar) bizde kalıyor. `react-native-purchases-ui` kurulmadı. Yeniden değerlendirme tetikleyicisi: gerçek A/B trafiği (G-2 sonrası) RC'nin native targeting'inin bize değer katıp katmadığını ölçmemizi sağladığında.

Ölçülen sürüm durumu (31 Ağu 2026): `react-native-purchases` 10.0.1 kurulu — temel Paywalls v2 için yeterli (8.11.3+), multipage için değil (10.6.0+). `react-native-purchases-ui` kurulu değil ve bu turda kurulmuyor.

### E-13 — K-56 TMDB lisans netleştirmesi ertelendi (Mertkan kararı)

1 Eyl 2026: K-56'nın "App Store release'inden önce netleşir" şartı bilinçli olarak ertelendi. Gerekçe (Mertkan): mevcut sürüm zaten App Store'da TMDB API ile sorunsuz çalışıyor; ücretsiz API kullanım hakkının gelir elde edilene kadar geçerli olduğu değerlendirmesi.

Risk notu: TMDB'nin ticari kullanım tanımı "gelir elde etme" değil "parayla ilişkili ürün" eşiğine dayanıyor olabilir — paywall'ın varlığı (henüz satış olmasa dahi) bu eşiği geçmiş olabilir. Bu hukuki bir değerlendirme değildir, CTO teknik gözlemidir.

Yeniden değerlendirme tetikleyicisi: ilk gerçek satış (R-C'nin K-49 sandbox testi tamamlanıp canlı satış başladığında).

### E-14 — Güvenlik ve veri bütünlüğü turu (8–11 Eyl 2026)

Plansız, R-D dışı bir güvenlik sprint'i. Supabase MCP bağlantısı rutin bir verimlilik adımı olarak kuruldu; tarama kendiliğinden genişledi ve **üç bağımsız üretim sorunu** bulunup kapatıldı.

**1. RLS — sahte "service role" politikaları.** `referrals`, `winback_queue` ve `lifetime_sales`'te adı "Service role can/manages …" olan ama `TO` clause'u taşımayan 3 politika vardı. `TO` yokken politika PUBLIC role'e uygulanır; `USING (true)` / `WITH CHECK (true)` ile birleşince tablolar fiilen **anon'a açıktı**. Üçü de `TO service_role` + `auth.role()` kontrolüne çevrildi (migration 111). Aynı hata sınıfı 099'da `watchlist` için bir kez yaşanmıştı.

**2. SECURITY DEFINER — kimlik doğrulama eksikliği.** 22 fonksiyon `p_user_id` parametresini çağıranın gerçek kimliğine karşı hiç doğrulamıyordu; SECURITY DEFINER RLS'i bypass ettiği için anon istemci rastgele bir id vererek başka kullanıcıların verisini okuyup değiştirebiliyordu. `claim_lifetime_spot`'ta bu doğrudan finansal istismardı (1000 kişilik lifetime kontenjanı bedava talep edilebiliyordu). Migration **109** (guard) + **110** (PUBLIC revoke) ile kapatıldı; 44 test (negatif + pozitif) geçti.

**3. FK kimlik uzayı çatallanması.** `public.users.id` ile `auth.users.id` **tamamen ayrık** iki UUID uzayı (ölçüm: 260 / 272, kesişim **0**); tek köprü `public.users.auth_id`. `lifetime_sales.user_id`, `referral_rewards.user_id`, `referrals.referrer_id`, `referrals.referee_id` ve `users.referred_by` **`auth.users(id)`'yi** hedefliyordu — oysa bu tablolara yazan fonksiyonların gövdeleri (`apply_invite_code`, `activate_referral`, `claim_lifetime_spot`) ve 109'un guard'ı **public uzayı** dayatıyordu. Sonuç: referral akışı **koşulsuz kırıktı** (260 kullanıcıya karşılık 0 referral satırı), lifetime'ın tier UPDATE'leri ise sessizce 0 satır ediyordu.

Migration **111** beş FK'yi `public.users(id)`'ye çevirdi. `winback_queue.user_id` ve `user_collection_progress.user_id` bilinçli olarak `auth.users`'ta bırakıldı (gerekçeleri 027/101'de yazılı) — bunlar hata değildir.

> **Kök neden tekrar ediyor:** migration **014** tam bu hata sınıfını `mood_searches`/`subscriptions` için bir kez teşhis edip düzeltmişti ("kota hep 0 → ödeme bypass"). Hatanın kendisi 014'ten *sonra* yazılan 025/026'da tekrarlandı. Yeni bir tabloya `user_id` yazan her kodda FK hedefi `pg_get_constraintdef` ile doğrulanmalıdır.

Dört çağıran auth id yerine public id gönderecek şekilde düzeltildi: `services/referralService.ts` (→ `getAppUserId()`), `process-referral`, `revenuecat-webhook`, `process-lifetime-purchase`.

**Uygulama durumu.** Migration 109, 110, 111 uzakta uygulandı. Edge Function deploy (11 Eyl 2026, hepsi ACTIVE): `revenuecat-webhook` v25, `process-lifetime-purchase` v22, `process-referral` v22. Deploy edilmiş artefakt canlı smoke test edildi — `process-referral` → `apply_invite_code` HTTP 200 ve dönen `referrer_id` doğru id uzayında. Regresyon testi ayrıca şunu kanıtladı: FK değişikliği tek başına yetmiyordu, auth id ile çağrı hâlâ 42501 veriyordu; çağıran düzeltmesi zorunluydu.

**Açık kalanlar** (hiçbiri launch-blocking değil, §9'da ve `TEKNIK_BORC.md`'de kayıtlı):
- `claim_lifetime_spot`'un canlı satın alma simülasyonu yapılmadı — `nextval('lifetime_sale_number')` geri alınamaz (ilk gerçek kurucu üye "#2" olurdu). İlk gerçek satışta 3 kontrolle doğrulanacak.
- `activate_referral` → `claim_lifetime_spot` iç çağrısı: fonksiyon `service_role` dışı bir bağlamda doğrudan çağrılırsa guard baypası çalışmaz (latent; tek çağıran service_role olduğu için şu an güvenli).
- `record_posterle_hint` anon'a açık ve `p_attempt_id` sahipliğini doğrulamıyor — ayrı güvenlik iş kalemi.
- `.env`'deki `SUPABASE_SERVICE_ROLE_KEY` bu projeye kayıtlı değil (HTTP 401); 16 yerel script etkileniyor. **Üretim etkilenmiyor** — Edge runtime kendi secret'ını enjekte ediyor.

### E-19 — 100 günlük editoryal takvim + kalıcı gün-teması yapısı (18 Eyl 2026)

**Yetki dayanağı.** `1_PRODUCT_OS` §1.3 "4 filmin seçim algoritması" satırını **🔓 Sürekli iyileşecek** olarak işaretler. Bu karar o açık alanı kullanır; §1.3'ün 🔒 satırlarının hiçbirine dokunmaz (çekirdek eylem 4 film/3 tur/1 şampiyon · ritüel kuralı · bağlam girdisi · veri felsefesi). §6.10 v0'ı "kişiselleştirme yok: bağlam filtresi + çeşitlilik + rastgele" olarak tanımladığı için bu karar **çalışan bir kişiselleştirme sistemini değiştirmiyor** — henüz var olmayan bir sistemin (Faz F) yerini bootstrap döneminde dolduruyor.

**1. İlk 100 gün editoryal.** Gauntlet'in 4 filmi **ve eşleşmeleri** (hangi film hangi turda kiminle karşılaşır) CTO tarafından elle kurgulanır: **400 benzersiz film, 300 head-to-head eşleşme kararı.** Kaynak algoritmik havuz (bugün 1.867 aktif film) değil, editoryal takvimdir.

**2. Gün-teması tablosu** *(tamamlandı 18 Eyl 2026)*. Haftanın her günü sabit bir tür/mod taşır:

| Gün | Tema | Tanım |
|---|---|---|
| **Pazartesi** | Arthouse / Bağımsız (Mubi tarzı) | Haftaya sakin, derinlikli, ödüllü bağımsız yapımlarla başlangıç |
| **Salı** | Kültler | Sinema tarihinin mihenk taşları, garantili sinema zevki |
| **Çarşamba** | Animasyon / Cozy | İzlemesi keyifli, yormayan filmler |
| **Perşembe** | Modern Keşifler & Gizli Cevherler | Gişe yapmamış ama eleştirmen/izleyici puanı yüksek son dönem bağımsızlar; yabancı dilde (Fransız, Kore, İskandinav vb.) çarpıcı işler |
| **Cuma** | Popcorn & Gişe / Blockbuster | Hafta sonu eşiğinde kafa yormayan, yüksek prodüksiyonlu, aksiyon/macera odaklı popüler filmler |
| **Cumartesi** | Epik Anlatılar & Uzun Metrajlar | 2,5–3+ saatlik başyapıtlar, sinematik evrenler, biyografiler, geniş ölçekli dünyalar. ⚠️ Bu gün için bağlam-tabanlı runtime tavanı devre dışı bırakılır veya gevşetilir — **ayrı teknik karar**, aşağıdaki açık maddeye bakınız |
| **Pazar** | Prestij & Akademi / Festival Seçkisi | Oscar/Cannes/Venedik tescilli, güçlü oyunculuk/yönetmenlik |

**2b. Takvim başlangıç kuralı.** Gün 1, **gerçek yayın tarihinin hafta gününe** bağlanır: yayın Salı günüyse 1. gün Salı temasıyla başlar. Sabit "Gün 1 = Pazartesi" yapısı **DEĞİLDİR** — takvim hafta gününe göre hizalanır, sıra numarasına göre değil.

**3. Gün-teması KALICI yapısal kuraldır.** 100 gün bitip algoritmik faza geçildiğinde de yürürlükte kalır; orada `generate-gauntlet`'in sert filtre katmanına (`1_PRODUCT_OS` §6.4) **gün bazlı tür/tier ağırlığı** olarak bağlanır (örn. Pazar çekimi ödüllü-tier havuzuna öncelik verir). Yani editoryal dönem geçici, gün-teması kalıcıdır.

**4. 100. gün geçişi.** Kullanılan 400 film algoritmik havuzda **kalıcı olarak "gösterildi"** işaretlenir — mevcut 21 günlük cooldown'dan ayrı bir işaret. Teknik detay ayrı `/kesif` ile netleşecek.

**5. Veri felsefesi korunur** (§1.3 🔒). Bu dönemde üretilen seçim zincirleri normal gauntlet verisi gibi işlenir; `choice_events` append-only kalır, `algorithm_version` zorunluluğu sürer.

**Uygulama biçimi.** Haftalık/günlük kurgu CTO ile konuşularak yapılır — otomatik üretim veya kendi kendine dolan bir sheet değildir.

**Açık kalanlar** *(18 Eyl 2026 itibarıyla — güncel statüler için bkz. **E-19.1 Uygulama kapanışı**, 19 Eyl 2026)* — bu maddenin kararı değil, uygulamasının önkoşuludur:

- **Ret merdiveni ile kesişim (K-23, 🔒).** K-23 "Ret 1 → sessiz yeni çift" diyor ve `submit-choice`'ın `neither` dalı iki filmi de eleyip **yedek film** istiyor. Günde tam 4 film taşıyan bir editoryal takvimde yedek YOKTUR. Ya editoryal gün 4'ten fazla film taşıyacak (yedek kulübesi) ya da ret algoritmik havuza düşecek — ikincisi günün editoryal kurgusunu kırar. **Karar verilmedi.**
- **`slotTypes` dürüstlüğü.** `DailyGauntlet.slotTypes` bugün `['global','personal','personal','discovery']` dönebiliyor (`gauntletCore`/`slotTypesFor`). Editoryal günde dört slot da editoryaldir; mevcut değerleri dönmek veriyi yanlış etiketler. Kilitli sözleşme (`types/gauntlet.ts`) `slotTypes`'ı taşıdığı için bu bir sözleşme sorusudur. **Karar verilmedi.**
- **Cumartesi teması ↔ bağlam runtime tavanı (§4).** `1_PRODUCT_OS` §4 bağlamı "kaç saatin var" diye sorar ve bu, kodda **sert bir filtreye** dönüşür: `gauntletCore.ts` `CONTEXT_MAX_RUNTIME = { short: 110, medium: 150, any: 999 }` ve havuz sorgusu `.lte('films.runtime', maxRuntime)`. Cumartesi'nin "2,5–3+ saat" tanımı `short` (110 dk) ve `medium` (150 dk) bağlamlarıyla **doğrudan çelişir** — kullanıcı "yorgunum, kısam var" derse Cumartesi havuzu boşalır. Ölçüldü (18 Eyl 2026): aktif havuzda `runtime >= 150` olan **202** film, `runtime >= 170` olan **96** film, `runtime <= 110` olan **792** film. Gün-teması mı bağlamı ezecek, bağlam mı temayı, yoksa Cumartesi için tavan mı gevşetilecek — **karar verilmedi.** İlk 100 günde sorun yok (editoryal seçki bağlam filtresinden geçmiyor); yalnızca 100 gün sonrası algoritmik faz için geçerli.
- **E-02 ile etkileşim.** 400 filmin kalıcı yakılması, aktif havuzun **%21,4'ünü** (400/1.867) devre dışı bırakır. E-02'nin "tekrar oranının %10'u geçtiği gün" ölçümü bu karardan SONRA yeniden yapılmalıdır. Gün-teması ayrıca havuzu **yedi alt havuza böler** — E-02 derinlik matematiği artık tek havuz üzerinden değil, tema başına yapılmalıdır (Cumartesi'nin 202 filmlik tavanı burada en dar kısıttır).
- **Şema/migration ihtiyacı** ayrı `/kesif` ile belirlenecek (E-18 genre-verisi keşfiyle birleştirilebilir).

**Kaynak:** kullanıcı önerisi, 18 Eyl 2026 tasarım oturumu.

---

### E-19.1 — Uygulama kapanışı: editoryal takvim canlıya alındı (19 Eyl 2026)

E-19'un **uygulaması** tamamlandı ve prod'a alındı. Karar değişmedi; bu madde neyin
gerçekleştiğini ve hangi önkoşulun nasıl kapandığını kayda geçirir.

> ⚠️ **Düzeltme (v1.25, 26 Eyl 2026):** "prod'a alındı" yalnız **DB katmanı** için doğruydu
> (migration 111–113 + ingest). `generate-gauntlet` ve `submit-choice` **deploy edilmemişti** —
> canlıda 18 Ağu (v32) ve 27 Ağu (v31) sürümleri çalışıyordu. İlk editoryal üretim
> **26 Eyl 2026 14:45 UTC** (generate-gauntlet v33 · submit-choice v32). Bkz. §9, v1.25.

**Zincir — Excel kürasyonundan `generate-gauntlet`'e:**

| Katman | Ne yapıldı |
|---|---|
| Migration 111 | FK kimlik uzayı çatallanması kapatıldı (E-14 kapsamında, E-19'un önkoşuluydu) |
| Migration 112 | `editorial_calendar_days` (100 satır) + `editorial_calendar_films` (400 satır). Takvimde DATE kolonu YOK — `date = launch_date + (day_number - 1)` okuma anında hesaplanır |
| Migration 113 | `app_config.launch_date` koda bağlandı. Satır prod'a elle yazılmıştı, şemada izi yoktu; `ON CONFLICT DO NOTHING` ile belgelendi, mevcut değer bozulmadı (doğrulandı: `value`/`description`/`updated_at` değişmedi) |
| Ingest | 96 eksik film `films` tablosuna eklendi. **İki fazlı tasarım** (`resolve-editorial-films` → `ingest-editorial-films`): TMDB başlık belirsizliği ampirik olarak ölçülmüş bir riskti (`/search/movie?query=The Killer&primary_release_year=2023` → 45 sonuç, 2'si tam eşleşme), `results[0]` yasağıyla kapatıldı |
| `generate-gauntlet` | **DAL A / DAL B ayrımı.** `launch_date`'e göre hesaplanan `day_number` 1-100 aralığındaysa editoryal, değilse mevcut v0 algoritmik akış **değişmeden** devam eder |
| `submit-choice` | Editoryal gün guard'ı (aşağıda) |

**DAL A'nın tanımı.** Editoryal dalda `buildScoredPool` **hiç çağrılmaz** — boru
hattının beş adımının hiçbiri çalışmaz. Çözümleme `fetchCandidatesByIds` +
`rowToCandidate` + `toGauntletFilm` üzerinden yapılır; yeni dönüştürücü
yazılmadı. `arrangeUnseen` çağrılmaz: editoryal günde **sıra bracket'in
kendisidir** (position 1 = defender, 2/3/4 = tur 1/2/3 challenger).
`slot_types = ['editorial'×4]`, `algorithm_version = 'v1-editorial-calendar'`
(algoritmik dönemden ayırt edilebilsin diye ayrı etiket — §6 veri felsefesinin
gereği). Mevcut hata yolu korunuyor: eksik ya da çözümlenemeyen film sessizce
atlanmaz, `throw` → Sentry fatal → 503.

**Kapanan önkoşullar:**

- ✅ **`slotTypes` dürüstlüğü.** `types/gauntlet.ts` union'ına `'editorial'` eklendi
  (CTO onayı, 19 Eyl 2026). DB tarafı ek migration istemedi —
  `069_gauntlet_events.sql:172` yalnız `array_length = 4` kontrol ediyor.
- ✅ **K-23'ün launch-blocking yarısı.** `submit-choice` guard'ı: gauntlet
  editoryalse (`slot_types` 'editorial' içeriyor) `neither`/`seen` dalı
  `buildScoredPool` + `pickReplacements`'ı **çağırmaz**, yani algoritmik havuzdan
  yedek çekilmez ve günün kurgusu korunur. Ham olay yine yazılır (§6 append-only),
  `seen` yine `watchlist`e işlenir; yalnız yeni çift verilmez. Kullanıcıya açık
  metin gösterilir (`gauntlet.editorialNoRefresh`, EN/TR parite) ve "İkisi de
  değil" kapanır — sessiz davranış yok (K-43 tonunda).
  ⚠️ **Geçersiz — bkz. R-20, 2 Eki 2026.** Guard kaldırıldı; editoryal günde
  yenileme normal havuzdan çalışır.
- ✅ **Cumartesi teması ↔ runtime tavanı (ilk 100 gün).** v1.12'nin "editoryal
  seçki bağlam filtresinden geçmiyor" varsayımı **kodda kanıtlandı**: DAL A
  `fetchPool`'u hiç çağırmadığı için `CONTEXT_MAX_RUNTIME` devreye girmiyor
  (birim testi: editoryal üretimde okunan tablolar yalnız
  `editorial_calendar_films` + `films`; `film_profiles` hiç okunmuyor).
  ⚠️ **Algoritmik faz için karar HÂLÂ VERİLMEDİ** — v1.12'deki açık madde
  100. gün sonrası için aynen yürürlükte.

**Bilinçli tasarım kararı — watched-dışlaması editoryal günde uygulanmaz.**
DAL A `fetchExclusions`'ı da çağırmaz: kullanıcı `watchlist.watched_at` ile zaten
izlediği bir filmi editoryal günde görebilir; 21 günlük "gösterildi" ve 45 günlük
"reddedildi" cooldown'ları da bu dalda geçerli değildir. **Bu bir bug değil,
ritüelin gereğidir:** editoryal gün herkes için aynıdır (E-19 madde 1 — 400 film,
300 eşleşme, elle kurgu). Kullanıcıya göre film çıkarmak günün bracket'ini
kişiselleştirir ve 4'ten az filmle kalan kullanıcılar için kaçınılmaz olarak
algoritmik bir yedek gerektirirdi — yani guard'ın engellemek için var olduğu şeyi.
İzlenmiş film çıkması kayıp değil sinyaldir: kullanıcı `seen` der, `watchlist`
güncellenir, tur harcanmaz. Gerekçe kodda da yorum olarak duruyor
(`generate-gauntlet/index.ts`, `generateEditorialQuartet` docblock'u).
⚠️ **Geçersiz — bkz. R-20, 2 Eki 2026.** İzlenen editoryal film artık dörtlüden
çıkarılır ve aynı pozisyonda normal havuzdan yedeklenir (yalnız `watched`;
21/45 günlük cooldown'lar editoryal filmlere hâlâ uygulanmaz).

**Ölçülmüş durum (19 Eyl 2026).** `launch_date = 2026-09-18` (Cuma) · bugünün
`day_number = 2` · tema `epic` · Gün 2 dörtlüsü Oppenheimer (181 dk) ·
Killers of the Flower Moon (206) · The Godfather (175) · Seven Samurai (207).
Gün 1 `popcorn` (Cuma) — §E-19.2b'nin hafta günü hizalaması veride doğrulandı.

**Açık kalan (launch-blocking DEĞİL, §9'a alındı):** yedek kulübesi (position 5-6)
hâlâ 0 satır · gün 100 sonrası kalıcı "gösterildi" işareti · yönetmen tekrarı
ihlalleri · canlı tetikleme doğrulaması.

**Kaynak:** `docs/investigations/E19_GENERATE_GAUNTLET_KESIF.md` · uygulama turu
19 Eyl 2026.

### E-20 — K-16 hesap silme denetimi + analytics identity ayağı (25 Eyl 2026)

**Ölçülmüş gerçek.** Hesap silme akışı **zaten vardı ve uygulamanın içindeydi**:
Profil → Ayarlar → "Delete Account" (`app/(tabs)/profile.tsx:696`), iki aşamalı
onay, `services/authService.ts:644`, Edge Function `delete-account` (canlıda
ACTIVE v23, 24 Nis 2026). App Store Guideline 5.1.1(v) şartı karşılanıyor.
> ⚠️ **Kısmen geçersiz — bkz. E-27, 9 Eki 2026.** Bu cümle yalnız hesap/veri silmeyi
> ölçtü; Sign in with Apple kullanıcıları için Apple tarafındaki **token revoke**
> yoktu. 5.1.1(v) o boşluk kapanana kadar tam karşılanmıyordu.
Deploy edilen kodun repo ile aynı olduğu dolaylı kanıtlandı (dosya mtime deploy'dan
29 dk önce, o tarihten sonra tek commit ve o da salt ekleme).

**~~Ön teşhis: "auth.users silinince subscriptions / notification_log / public.users
ayakta kalıyor — ters orphan"~~** — **geçersiz, 25 Eyl 2026.** Bu tespit yalnızca
`auth.users`'ın **doğrudan** (Dashboard / Admin API tek başına) silindiği senaryoda
doğrudur. Uygulamanın akışı **önce `public.users`'ı** siler, cascade oradan tetiklenir;
canlı FK envanteri ölçüldü: `public.users`'a bağlı **26 FK'nin biri hariç hepsi
ON DELETE CASCADE** (`users.referred_by` = SET NULL, 102'nin gerekçesi), `subscriptions`
ve `notification_log` bu listede. Auth tarafındaki iki FK (`user_collection_progress`,
`winback_queue`) da CASCADE, yani son adım FK ihlaliyle bloke olmuyor. Tespit
silinmedi, üstü çizildi (D-12/D-13 emsali).

**Gerçek açık üç noktaydı, üçü de bu turda kapatıldı:**

1. **`auth_only` dalı sessiz başarı üretiyordu.** `.single()`'ın her hatası
   "kullanıcı yok" sayılıyordu — geçici bir arama hatası (RLS, timeout, PostgREST
   5xx) public tarafı duran kullanıcının auth kaydını kazara silebilirdi; ayrıca
   `deleteUser` dönüşü hiç kontrol edilmiyordu ve dal `console.warn` ile geçiliyordu
   (Sentry'ye iz yok). Artık: **PGRST116** (gerçek "satır yok") diğer hatalardan
   ayrıldı — diğer hatalarda **hiçbir şey silinmez**, `profile_lookup_failed` döner.
   Gerçek "satır yok" dalında auth silme **tam silmedir** (bu kullanıcılarda public
   tarafta veri yoktur), bu yüzden `success:true` + `note:'auth_only'` döner ve anomali
   **fatal Sentry** olarak kayda geçer. **CTO kararı:** dalın `success:false` dönmesi
   reddedildi — token silindikten sonra "tekrar dene" imkânsızdır ve ölçülen **15
   auth-only kullanıcı** (auth 281 / public 266) hesabını hiç silemez hâle gelirdi.
2. **Analytics identity ayağı hiç uygulanmamıştı.** K-16 "…→ analytics identity"
   diyordu, kod ise "backlog" yorumu taşıyordu. Bu bir çelişki değil, **kararın
   uygulanmamış hâliydi.** `delete-account` artık PostHog kişisini **ve tüm event
   geçmişini** siliyor (`delete_events=true`, distinct_id = `auth.users.id`).
   Başarısızlık **fatal Sentry** yazar ama hesap silmeyi başarısız saymaz — asıl veri
   (Postgres + auth) o noktada zaten silinmiştir.
3. **Sessiz fallback temizliği.** Fonksiyondaki tüm `console.warn` / `console.error`
   çağrıları `sentryCapture`'a çevrildi (kural 1).

**Ön koşul (deploy öncesi):** `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID`
secret'ları kurulmadan PostHog silme çalışmaz — secret yoksa fonksiyon **fatal Sentry**
yazıp devam eder, sessizce atlamaz. Mevcut `POSTHOG_API_KEY` secret'ı proje yazma
anahtarıdır (`phc_…`), bu iş için **yetersizdir**. ✅ **Karşılandı, 26 Eyl 2026** —
iki secret kuruldu ve fonksiyon **v26** olarak redeploy edildi (secret → redeploy
sırası kuralı uygulandı).

### E-20.1 — K-16 canlı doğrulama kanıtı (26 Eyl 2026) — ZİNCİR KAPALI

Kod doğrulaması yeterli sayılmadı; `delete-account` **v26** deploy'u üzerinde iki
gerçek silme senaryosu koşturuldu ve dört bağımsız kanıt toplandı. K-53 DONE tanımı
(BUILD → MEASURE → RECOVER → VALIDATE) bu maddede tamamlandı.

| Kanıt | Senaryo | Sonuç |
|---|---|---|
| **DB cascade** | Test 1 — `public.users` satırı olan normal kullanıcı | `auth.users`, `public.users`, `subscriptions`, `watchlist` → **hepsi 0 satır**. Cascade public'ten tetikleniyor, E-20'nin FK envanteri ölçümü canlıda doğrulandı. |
| **PostHog silme** | Test 1 | Silme sonrası PostHog persons API sorgusu (curl, `distinct_id` = auth uid) → **`{"results":[]}`**. Kişi ve event geçmişi gerçekten silinmiş — `posthog_deleted:true` response alanı değil, **dış sistemden okunan** doğrudan kanıt (bkz. §9 "PostHog silme doğrulama kısıtı" gerekçesi böylece aşıldı). |
| **`auth_only` dalı** | Test 2 — `public.users` satırı olmayan (15 auth-only kohortundan) kullanıcı | Sentry'de **`level: fatal`, `tags.step = auth_only`** event'i, saat 12:21. Dal beklendiği gibi tetiklendi, auth kaydı silindi, kullanıcıya `success:true` + `note:'auth_only'` döndü — anomali sessiz kalmadı. |
| **`posthog_lookup` davranış ayrımı** | Test 1 ↔ Test 2 | Test 2'de **`level: info`, `step = posthog_lookup`** event'i (aynı istek, 12:21). Bu seviye+step kombinasyonunu üreten tek kod yolu `index.ts:113` = *"PostHog kişisi bulunamadı, silme gereksiz"* — yani kişi hiç yoktu. Test 1'de bu event **yok**, çünkü başarılı silme yolu event yazmaz. İki dal birbirinden ayırt edilebiliyor. |

**Doğrudan ↔ dolaylı ayrımı:** PostHog tarafının kanıtı **curl'ün boş listesi**dir
(doğrudan). "Test 1'de info event'i yok" tek başına kanıt değil, yalnızca curl ile
tutarlı ikinci bir gözlemdir; bu ayrım kayda geçirilmiştir ki sonraki oturum yokluğu
kanıt sanmasın (`sentry.ts:23` — DSN yoksa capture sessizce atlanır, event yokluğu
her zaman "hata olmadı" demez).

**Kalan:** Bu tur K-16 zincirini kapatır. §9'daki üç E-20 kalemi (`game_scores`
FK'siz · `auth.tsx:96-105` kimlik uzayı uyuşmazlığı) **R-D'de açık kalır** — K-16'nın
kendisine bağlı değiller.

**Kaynak:** `docs/investigations/K16_HESAP_SILME_KESIF.md` (25 Eyl 2026) + uygulama turu.

---

### E-21 — Yeni kullanıcıya önceki döngü: 18:00 öncesi ilk açılış (27 Eyl 2026) — ~~KARAR VERİLDİ, UYGULANMADI~~ **UYGULANDI (27 Eyl 2026, v1.30 — bkz. E-21.1)**

**Sorun.** P0-1 (`3fd787f`) sonrası 18:00 öncesi açan yeni kullanıcı yalnız
"Bugünün dörtlüsü 18:00'de hazır" metnini görüyor. İlk açılışta ritüelle hiç
karşılaşmadan çıkıyor.

**Karar (CTO, 27 Eyl 2026).** Sıfır kişisel `daily_gauntlets` satırı olan
kullanıcı 18:00 öncesi açarsa **etkin ritüel döngüsünün** (son yerel 18:00'de
açılmış olanın) gauntlet'ini görür. PRODUCT_OS §3.6 ("Gauntlet 18:00'den önce
açılmaz") ve D-12'nin "`before_18`'de gauntlet ÇAĞRILMAZ" kuralı **yalnız bu
kohort için** istisna alır. Diğer herkes için ikisi de yürürlükte kalır.

| Alt karar | İçerik |
|---|---|
| **Sözleşme** | `generate-gauntlet` isteğine `cycle: 'previous'` niyet bayrağı. İstemci **tarih göndermez**; tarih sunucuda hesaplanır. Açık ret kodları: `PREVIOUS_CYCLE_NOT_ELIGIBLE` (kişisel satır > 0) · `PREVIOUS_CYCLE_OUT_OF_WINDOW` (`editorialDayNumber < 1`). ⚠️ **v1.30 — OUT_OF_WINDOW anlamı genişletildi (CTO onaylı):** "önceki döngü şu an sunulamaz" = anahtar `launch_date` öncesi **veya** 18:00 kapısı açıkken satırı olmayan kullanıcı **veya** yaz saati gününde anahtarın o akşamın anahtarıyla çakışması. Yeni kod açılmadı, tip şekli aynı. Sessiz algoritmik geri dönüş yok; istemci ret kodunda bekleyiş metnini gösterir. Gauntlet-contract prosedürüne tabi. |
| **Anahtar hesabı** | "Son yerel 18:00 anının UTC tarihi". Kaynak **isteğin kendi `timezone` alanı**; `users.timezone` kolonu değil (kolon write-through için kalır). Gerekçe ölçüldü: kolonda gerçek değer **12/270 (%4,4)**, 258 satır `DEFAULT 'UTC'` (27 Eyl 2026). İstemci alanı her çağrıda gönderiyor (`services/gauntletService.ts:244`), ama `deviceTimeZone()` `Intl` yoksa `undefined` dönebiliyor (`:146-155`). ⚠️ Bu durumda `cycle:'previous'` için davranış **uygulama turunda netleşmeli** (öneri: açık ret). **v1.30: açık ret uygulandı** — sunucu 400 `INVALID_INPUT`; istemci timezone yoksa hiç sormaz ve Sentry'ye `PREVIOUS_CYCLE_NO_TZ` uyarısı yazar. "Önceki UTC günü" tanımı **yanlış**: saat dilimine bağlı (İstanbul 00:00–03:00 iki gün geri düşer, UTC− bölgelerde anahtar yerel tarihin önündedir). Bu yüzden M2 Faz 2b öne çekilmiyor. |
| **Satır tarihi** | `daily_gauntlets.date` = **önceki döngünün anahtarı**, bugün değil. Bugünün tarihiyle yazılırsa 18:00'de idempotency aynı (tamamlanmış) satırı döner ve kullanıcı o akşamın gauntlet'ini alamaz. Gauntlet'e bağlı bir `user_streaks` yazımı yok (yalnız eski swipe akışı); "tamamlama" = `champion_film_id`, arşiv anchor'ı = ilk kişisel satır (`get-archive-status`). Önceki döngünün anahtarıyla ikisi de tutarlı kalır. |
| **18:00 geçişi** | Oyun bitmesine izin verilir (`submit-choice` tarih bakmaz, `gauntletId` ile çalışır). Kabuk yüklü gauntlet'in `date`'ini döngü anahtarı olarak taşır. Dakikalık nabız, önceki döngü `completed_today`'deyken 18:00 geçince `bootstrapping`'e geçer. Bu yapılmazsa ekran gece yarısına kadar eski şampiyonda kalır, sonra `before_18`'e düşer ve o akşamın gauntlet'i kaçırılır. **v1.30 inceltmesi (onaylı):** şampiyon reveal'ı yalnız **o oturumda** görünür; uygulama yeniden açılırsa bitmiş önceki döngü gösterilmez, `before_18` gelir. Nabız kuralı aynen uygulandı. |
| **"Dün izledin mi?"** | Sabah seçilen şampiyon 18:00'de "dün" diye sorulur. **Kabul edilen istisna**: tek seferlik, zararsız, ek karmaşıklığa değmez. |

**Uygulama zamanlaması.** Build 903'e **girmez**. Ayrı, taze bir oturumda kendi
salt okunur keşfiyle ele alınacak. Gerekçe: state machine, sözleşme ve gün sınırı
mantığına aynı anda dokunuyor.

**Ölçülemeyen.** Son 24 saatte `none -> before_18` geçiş sayısı (kohort büyüklüğü).
`gauntlet.state` breadcrumb'ı `85ffafd` ile geldi ama sahaya yeni build'le ulaşır
ve Sentry erişimi yok. **Yeni build sonrası bakılacak.**

**Kaynak:** keşif turu (27 Eyl 2026, sohbet içi) · `BUILD_ONCESI_GAUNTLET_KESIF.md`.

### E-21.1 — E-21 uygulama kaydı (27 Eyl 2026)

Commit'ler: `0d59234` (migration 118) · `531686a` (kod + testler). Canlı:
`generate-gauntlet` **v34**, `get-archive-status` **v12** (canlıdan indirilen kod
repo ile birebir). İstemci **henüz sahada değil** — TestFlight build'i bekliyor.

**Karardan sapmalar ve netleştirmeler** (hepsi uygulama turunda onaylandı):

| Konu | E-21 metni | Uygulanan | Gerekçe |
|---|---|---|---|
| Önceki döngü satırının izi | Belirtilmemiş | **Yeni kolon** `daily_gauntlets.cycle` (`current` \| `previous`, migration **118**, metadata-only) | DUR noktası, onaylı. Tarihten türetme UTC+ bölgelerde yerel 00:00–03:00 kurulumunu ayırt edemiyor; ayırt edilemezse K-46 bedava kaçırma hakkı tüketiliyor ve tek satırlı mevcut kullanıcı dünkü yarım oyununu sabah sürdürebiliyordu. |
| Sözleşme | `cycle:'previous'` | `types/gauntlet.ts`'e **salt ekleme**: `GauntletCycle`, `PreviousCycleRejectCode`, `isPreviousCycleRejectCode`. HTTP **409**, gövde mevcut `{error, message}`. `DailyGauntlet` değişmedi. | Gauntlet-contract prosedürü, onaylı. |
| Anahtar | "Son yerel 18:00 anının UTC tarihi" | **Dün yerel 18:00'in UTC tarihi.** Kapı kapalıyken bu etkin döngüdür (tanımla aynı); kapı açıkken yalnız sabah başlamış önceki döngü oyununun **sürdürülmesine** hizmet eder, yeni üretim yok. | "Oyun bitmesine izin verilir" alt kararı. |
| Previous isteğine current yanıt | — | **Hiçbir zaman.** Kapı açıkken satırı olmayan kullanıcı → `OUT_OF_WINDOW` (satır üretilmez). | Yanıt şekli aynı olduğu için istemci döngüyü ayırt edemez; ilk sürümde bugünün gauntlet'i "önceki" diye etiketleniyordu (CTO incelemesi SARI-3). |
| **Yaz saati çakışması** (yeni bulgu) | — | İki yerel 18:00 arası 23 saate indiğinde önceki döngü anahtarı o akşamın UTC anahtarıyla **aynı güne** düşebiliyor — ölçüldü: `America/Chicago` / `America/Winnipeg` yaz saatine geçiş günü (ör. 2027-03-14). Açık ret (`OUT_OF_WINDOW`). | Satır açılsaydı 18:00'de mükerrer istek kontrolü o satırı döner, kullanıcı o akşamı kaçırırdı — E-21 "satır tarihi" kuralının tam kendisi (SARI-1). |
| `choice_events` "önceki döngü tarihiyle" | Görev metni | Tabloda **`date` kolonu yok**; tarih `gauntlet_id → daily_gauntlets.date` join'iyle. Yeni kolon açılmadı. `algorithm_version` satırdan kopyalanıyor, `submit-choice` değişmedi (K-40 append-only korunur). | Şema gerçeği. |
| Arşiv (K-46) | "Anchor önceki döngü anahtarıyla tutarlı kalır" | Önceki döngü satırı **ne kaçırma ne tamamlama** sayılır; anchor = o satırın tarihi **+1** (ilk gerçek döngü). | Yarım kalan önceki döngü bedava kaçırma hakkını tüketiyordu. |
| İstemci tetik | "Sıfır kişisel satır" | **Cache + marker:** cihazda gauntlet cache'i olan kullanıcı 18:00 öncesi ~~**hiç ağ çağrısı yapmaz**~~ **`generate-gauntlet` çağırmaz** *(v1.34 — bekleyiş ekranı son şampiyon için tek bir RLS tablo okuması yapar, bkz. E-24)*; yoksa sorar, retde `closed` iz'i yazılır. Önceki döngü cache'lenmez. | Mevcut kullanıcı akışı değişmez. |
| Hata yolu | `error_recovery` | Böyle bir state yok (D-12); karşılığı `bootstrapping` + `loadError`. Yalnız 409 + bilinen kod bekleyiş ekranına düşürür; 5xx/400 hata ekranına. Açılışta ağ yoksa bekleyiş ekranı + Sentry uyarısı (iz yazılmaz). | Sessiz `before_18` yasak. |
| Analytics | `cycle:'previous'` | 5 event (`gauntlet_started`, `choice_submitted`, `choice_rejected`, `gauntlet_completed`, `champion_revealed`) `cycle: 'previous' \| 'current'` taşır; gauntlet kimliğiyle eşlenir. | — |

**Kanıt:**

| Doğrulama | Sonuç |
|---|---|
| Birim testleri | `npm run test:previous-cycle` — istemci **27/27**, sunucu **25/25** (2026–27 boyunca 12 dilimde anahtar/akşam çakışma taraması dahil); `test:editorial` 17/17 |
| Tip kontrolü | `typecheck` 14 (baseline, hepsi `scripts/`) · `typecheck:functions` 32 (baseline) |
| Canlı (4 test anon kullanıcısı) | **21/21.** Önceki döngü satırı `count=exact` = 1, `date` = önceki anahtar, `cycle='previous'`; ardışık ve **paralel** çift çağrı → hâlâ 1; 3 tur → şampiyon, `choice_events` 3 satır; `get-archive-status` kaçırma 0 / eligible false / anchor = anahtar+1; mevcut kullanıcı → 409 `NOT_ELIGIBLE`; kapı açıkken → 409 `OUT_OF_WINDOW` ve 0 satır; timezone yok/geçersiz → 400. Test kullanıcıları `delete-account` ile silindi, kalan satır 0. |
| Paywall event'i | **Doğrudan ölçülmedi** — `paywall_triggered` istemci event'idir; sunucu tarafında yalnız `archiveEligible:false` dolaylı kanıttır. |

**Açık kalanlar:** §9'a işlendi (istemci cihaz doğrulaması). `v_algorithm_daily`
metrik kirliliği `docs/TEKNIK_BORC.md`'de.

### E-22 — V-1 Design OS uyum sprinti: CTO kararları ve sapmalar (27–28 Eyl 2026)

Kaynak plan: `docs/05_SPRINTS/V1_DESIGN_OS_UYUM_SPRINT.md` (sprint v1). Uygulama
turları plan numaralarından saptı (ör. geri sayım "Tur 6", Playfair "Tur 7" olarak
koştu); aşağıdaki tur adları **commit mesajlarındaki** adlardır.

> ⚠️ **Adlandırma:** Sprint oturumunun karar numaraları burada **V1-D1…V1-D11**
> olarak yazılır. Bunlar §3'teki **D-xx** ("değiştirilerek kabul") maddeleri
> **değildir**; kodda ve commit'lerde "CTO D3", "D10" gibi geçen atıflar bu
> tabloya işaret eder.

**Kararlar.** Yalnız repoda izi (commit mesajı / kod yorumu) olanlar işlendi.

| Kod | Karar | Uygulama | İz |
|---|---|---|---|
| V1-D1 | — | **Metin bible'a işlenmedi** — CTO oturumunda, repoda izi yok. | — |
| V1-D2 | — | **Metin bible'a işlenmedi** — CTO oturumunda, repoda izi yok. | — |
| V1-D3 | Premium durumu üç hâlli tek kaynak: `premiumStatus` = `loading` / `premium` / `free`. RC `chosy_plus` aktif ⇒ premium (DB satırı olmasa da). `loading`'de paywall/upsell açılmaz, özellik kapıları fail-closed. | ✅ `84cd018` + 5 tüketici commit'i (Tur 1), Profile `6a6e96e`. Karar mantığı `utils/premiumStatus.ts`, test 9 senaryo. Kalan istemci borçları `TEKNIK_BORC.md`. | `contexts/SubscriptionContext.tsx:63` |
| V1-D4 | — | **Metin bible'a işlenmedi** — CTO oturumunda, repoda izi yok. | — |
| V1-D5 | — | **Metin bible'a işlenmedi** — CTO oturumunda, repoda izi yok. | — |
| V1-D6 | Watched sayısının kaynağı `watch_feedback` (`loved`/`ok`/`abandoned`; `not_watched`/`skipped` sayılmaz). Hata/null → bölüm çizilmez + Sentry, sessiz 0 yok. | ✅ `468242f` | `app/(tabs)/profile.tsx:832` |
| V1-D7 | Bekleme ekranında ~~dünkü şampiyon,~~ arşiv, Pro Mode ve keşif rotası **yok** (K-46, IA "tek görev"). *(v1.34, 30 Eyl 2026 — **"dünkü şampiyon yok" kısmı geçersiz — bkz. E-24.** Arşiv / Pro Mode / keşif rotası yasağı aynen geçerli.)* | ✅ `f8f2e6d` — ekran = metin + geri sayım. Sprint v1'in "dünkü şampiyon kartı" maddesi bu kararla düştü. | `components/gauntlet/GauntletShell/index.tsx:1284-1285` |
| V1-D8 | Avatar: 9 PNG → Phosphor duotone glif; saklama anahtarı cihaz bazlı → kullanıcı bazlı (`chosy_user_avatar_{publicUserId}`), eski anahtar tek seferlik taşınır. | ✅ `61f9993`. PNG'ler bundle'da (`setup-profile.tsx`, `PersonaBadge`). Avatar yalnız AsyncStorage'da — DB senkronu yok (`TEKNIK_BORC.md`). | `constants/avatarGlyphs.ts:4` |
| V1-D9 | 18:00 kapısı istemcide **tek tanım** (`UNLOCK_HOUR`, `unlockClock.ts`); geri sayım hedefi buradan türetilir. Sprint v1'in "istemcide 18:00 hardcode yasak, hedef sunucudan" kısıtının yerine geçer. | ✅ `f8f2e6d`. Sunucu anahtarı hâlâ UTC (§9 "UTC gün anahtarı ↔ yerel ritüel"). | `components/gauntlet/GauntletShell/unlockClock.ts:19` |
| V1-D10 | ~~Playfair canlı ekranlarda Design OS §3.3 rollerine taşınır~~ **Kısmen geri alındı (28 Eyl 2026, v1.32 — bkz. E-23 V3-D1):** Playfair **yalnız film adlarında** (`type.filmTitle`) geri döndü — kurucu referans tasarımı. Film adı dışındaki taşımalar geçerli (token katmanı SF Pro 600; DNA arketip adı Archivo `display-l`); **font yüklemesi bundle'da kalır**, donmuş oyun dosyalarına dokunulmaz. | ✅ `054f4ba`, `dab1e53`. Kalıntılar `TEKNIK_BORC.md` (28 Eyl). | `constants/theme.ts:32` |
| V1-D11 | Pro Mode mood kartı zemin renkleri/gradient'leri **değişmez** → K-31 istisnası (kurucu kararı). | ✅ `d873f37` — yalnız hardcoded hex semantik ada bağlandı, değer aynı. | `components/Home/MoodCardGrid/index.tsx:172` |

**Kilitli maddelerden sapmalar.**

| Madde | Sapma | Gerekçe |
|---|---|---|
| **K-08** | Streak bölümü **ertelendi**. Watched (V1-D6) eklendi, Discovery Stats kaldırıldı (`df38f0b`, K-35), Taste DNA → Cinema DNA (`b8e23f9`). | Streak verisi gauntlet ritüelinden **beslenmiyor**: `user_streaks`'i yazan yollar `/discover` swipe'ı (`hooks/useFeedManager.ts:631` `recordActivity`, `discover_tab_enabled=false`) ve Spotlight'ın `submit-guess`'i; `generate-gauntlet` / `submit-choice` streak'e dokunmuyor. Bugün gösterilecek sayı K-33'ün "STREAK → DNA" omurgasını değil, emekli swipe davranışını ölçerdi. Bağlanması streak yazımının gauntlet tamamlanmasına taşınmasını ister (sunucu değişikliği → ayrı karar). `StreakCard` bileşeni silinmedi. |
| **K-31** | Pro Mode mood grid'i tür-kodlu paleti korur (V1-D11). | Kurucu kararı; istisna tek yüzeyle sınırlı. |
| **K-15** | Akşam 18:00 bildirimi **cihazda yerel planlanacak**. *(v1.45, 6 Eki 2026 — aşağıdaki "uygulanmadı" durumu **geçersiz** — bkz. K-15, 6 Eki 2026: `ensureDailyReminderScheduled()` `e6e87be`'de geldi; cihaz doğrulaması bekliyor.)* **UYGULANMADI:** sprint v1'in Settings turu (tek native switch) koşmadı; `ensureDailyReminderScheduled()` yok; Profile ayar modalı hâlâ üç toggle ile `users` kolonlarına yazıyor (push durumu · `daily_pick_enabled` · `watchlist_notifications_enabled`); bekleme ekranı bildirim CTA'sı ve `waiting_notify_tapped` bu yüzden ertelendi (`f8f2e6d`). | Karar kaydı; uygulama ayrı tur. Bırakılacak kolonlar `TEKNIK_BORC.md`'de "planlanan bırakma" olarak. |
| **Görünen ad** | Sprint v1 Tur 1 madde 4 ("Chosy Plus" → "Chosy Pro") **iptal**. Uygulanan ters yön: abonelik görünen adı **"Chosy Plus"** (`904e157`, v1.29). "Pro Mode" özellik adıdır, abonelik adı değildir. Entitlement id `chosy_plus`, RC identifier'ları ve analytics adları değişmedi. | Entitlement (K-48) ve ASC ürün adı ("Chosy Plus Lifetime", K-59 notu) ile tek ad. |
| **Day-0** | Sprint v1 Tur 2 Seçenek A ("on-demand ilk gauntlet") yerine **E-21** (önceki döngü) uygulandı. | Bkz. E-21 / E-21.1 — **UYGULANDI** (v1.30); istemci TestFlight'ta doğrulanacak (§9). |

**Doğrulama (V-1 Tur 8, 28 Eyl 2026):** `typecheck` 14 (hepsi `scripts/`) ·
`typecheck:functions` 32 · i18n 1367/1367 · `test:previous-cycle` 27+25 ·
`test:waiting` 15 · `test:editorial` 17 · subscription + avatarStorage + posterUrl 31.
V-1 diff'i sıfır hardcoded renk ve sıfır boş catch **ekledi** (6 hardcoded renk
kaldırdı). Dokunulan dosyalarda önceden var olan hardcoded renk / boş catch ve
Phosphor+Ionicons birlikteliği düzeltilmedi, Tur 8 raporunda listelendi.
`test:founder` (ücretli, parse-mood) koşulmadı. Cihaz senaryoları:
`docs/05_SPRINTS/ACTIVE/V1_TESTFLIGHT_CHECKLIST.md`.

### E-23 — V-3 gauntlet + şampiyon görsel retrofiti: CTO kararları (28 Eyl 2026)

Kaynak: kurucu referans tasarımı (tur ekranı + şampiyon ekranı). Üç tur:
**G1** tur ekranı + Home tab ikonu (`682b793`, `6389234`, `2b89338`) · **G2**
şampiyon ekranı (`0b4de00`, `e40cbaf`, `9dd6b34`, `4cbcaac`) · **G3** kapanış
(bu kayıt). CLAUDE.md kural 10 gereği oyun/gauntlet **mantığı değişmedi**:
submit akışı, editoryal dallanma, K-42 kuyruğu, reveal sekansı, kaydetme/paylaşım
ve Spotlight görünme koşulu aynı.

> ⚠️ **Adlandırma:** E-22'deki gibi sprint karar numaraları ayrı ad uzayındadır:
> **V3-D1…V3-D7**. §3'teki **D-xx** maddeleri değildir; kod yorumlarındaki
> "V3-Dn" atıfları bu tabloya işaret eder.

| Kod | Karar | Uygulama | İz |
|---|---|---|---|
| V3-D1 | **Serif yalnız film adında.** Playfair Display 700 tek bir rolle döner: `type.filmTitle` (17/22). Tur ekranı poster başlığı ve şampiyon başlığı (C.9b-UI C8 kademesi 40/32/28 korunur; Archivo `display-xl` şampiyon ekranından çıktı). Gauntlet sorusu dahil arayüzün kalanı SF Pro. **V1-D10'u kısmen geri alır** (satırında üstü çizildi, silinmedi). Gerekçe: kurucu referans tasarımı, serif yalnızca film adı. | ✅ `682b793` (token), `6389234` (PosterTile), `9dd6b34` (şampiyon). | `constants/design/semantic.ts:105` |
| V3-D2 | **Altın yalnız ödül katmanında.** Gauntlet kenarları (bağlam pill'i, `OutlineAction`) `graphite`, altın değil. Şampiyon ekranında `marquee` **yalnız Watch Now**'da: düz dolgu, `ink` metin, gradient yok. | ✅ `6389234`, `9dd6b34`. | `components/gauntlet/ContextBar/styles.ts:21` · `components/gauntlet/ChampionActionButton/index.tsx:6` |
| V3-D3 | **Watch Now = TMDB'nin bölgeye özel `link`'i, uygulama içi tarayıcıda** (`WebBrowser.openBrowserAsync`). Sağlayıcı ya da `link` yoksa buton **render edilmez** (devre dışı değil); o durumda "Sonraya bırak" birincil (`bone` dolgu). `TmdbWatchProviders.link` tipe geri eklendi (alan yanıtta hep vardı). Açılamazsa Sentry + görünür mesaj. **v1.23'ü kısmen geçersiz kılar.** ⚠️ Açılan sayfa v1.23'te sorun olan **aynı toplu TMDB sayfasıdır**; fark: logolar hâlâ dokunulmaz, bağlantı tek ve açıkça etiketli bir butonda. | ✅ `9dd6b34`. Event `watch_now_tapped`. | `components/gauntlet/ChampionReveal/index.tsx:277` |
| V3-D4 | **Tam genişlik poster hero.** Şampiyon posteri ekranın ~%60'ı, alt yarısı `ink`'e düz alfa geçişi; etiket + başlık geçişin üstünde. Kontrast ≥ 4.5:1 en kötü durum (saf beyaz poster) için Deno'da ölçülür. Reduce Transparency'de sert kenar + düz `ink`; poster yüklenemezse `charcoal` + yer tutucu + Sentry breadcrumb. | ✅ `e40cbaf` (`test:champion`), `9dd6b34`. | `components/gauntlet/ChampionReveal/heroScrim.ts:2` |
| V3-D5 | **En fazla 3 logo + "See all".** Sıralama flatrate > free > ads > rent > buy (kova içinde TMDB `display_priority`, tekilleştirme kesmeden önce); fazlası Stream/Rent/Buy gruplu sheet'te. Logolar ve sheet satırları **dokunulmaz** kalır; JustWatch atfı sheet'te de görünür. **v1.23'ün "en fazla 6 logo, sheet yok" kısmını geçersiz kılar.** | ✅ `0b4de00` (6 Deno case'i), `9dd6b34`. Event `providers_see_all_opened`. | `components/gauntlet/WatchProviders/index.tsx:48` |
| V3-D6 | **Spotlight kartı kaydırma içeriğinin sonunda, satır içi.** Yüzen/mutlak konum kaldırıldı; görünme koşulu (şampiyon varsa) aynı. *(v1.42 — görünme koşuluna giriş anı eklendi: canlı finalde reveal bitişi + ~1000 ms, bkz. **K-61**. Konum aynı.)* | ✅ `9dd6b34`. | `components/gauntlet/GauntletShell/index.tsx:1481` |
| V3-D7 | **Home tab ikonu film** (SF Symbol `film` / `film.fill`), aktif ikon rengi `marquee` — yalnız bu ikonda. Phosphor yerine SF Symbol: native tab `Icon`'u SVG bileşeni kabul etmiyor (kurucu onaylı sapma). Tab yapısı (K-01/K-04) değişmedi. | ✅ `2b89338`. | `app/(tabs)/_layout.tsx:74` |

**Etkilenen maddeler.** v1.23 günlük satırı ve §7.1 Champion / Where to Watch
satırları **kısmen geçersiz** işaretlendi (üstü çizildi, silinmedi). §9
"Sağlayıcı talebi ölçülmüyor" satırına not düşüldü, madde **açık** kalır:
`watch_now_tapped` toplu TMDB sayfasına gidiş sayar, sağlayıcı bazlı talebi
ölçmez → R-03/R-06'nın istediği ikame değildir; ikame kararı CTO'da.
Design OS §3 (tipografi) ve §4 (uzay/yapı) notları aynı gün eklendi.

**Doğrulama (V-3 Tur G3, 28 Eyl 2026):** `typecheck` 14 (hepsi `scripts/`) ·
`typecheck:functions` 32 · i18n **1387/1387** · Deno: `test:taste` 22 ·
`test:seed` 12 · `test:editorial` 17 · `test:previous-cycle` 27+25 ·
`test:waiting` 15 · `test:champion` 16 · posterUrl + avatarStorage +
premiumStatus 31 · identityReset 10 · game-system 17+22+44+27 — hepsi yeşil.
`tests/game-system/e2e-api.test.ts` **koşulmadı** (production'a yazar).
G1/G2 dosya taraması: sıfır hardcoded renk, sıfır boş catch, `marquee` yalnız
Watch Now + Home tab aktif ikonu, serif yalnız `filmTitle` (film adları).
`test:founder` (ücretli) koşulmadı. Cihaz senaryoları:
`docs/05_SPRINTS/ACTIVE/V1_TESTFLIGHT_CHECKLIST.md` (K ve L bölümleri).

### E-24 — Bekleyiş ekranında son şampiyon: V1-D7 kısmen geri alındı (30 Eyl 2026)

Kaynak: kurucu cihaz testi. 18:00 öncesi ekran (metin + sayaç) "çok boş".
Kararlar kurucu tarafından AskUserQuestion ile verildi (üç soru, üç seçim):

| Soru | Karar |
|---|---|
| Veri kaynağı | **`getLastChampion`**: Profil'in kullandığı `daily_gauntlets` personal RLS okuması (`daily_gauntlets_personal_read`). Yerel önbellek reddedildi: yalnız `generate-gauntlet` anında yazılıyor, final sonrası güncellenmiyor, kart çoğu kullanıcıda boş kalırdı. |
| İçerik | **Hafif perde.** Tam ekran bulanık şampiyon afişi (Profil header perdesiyle aynı dil) + sayacın altında afiş · "Your last pick" · film adı (`filmTitle` serif). Tam `ChampionReveal` reddedildi (tam `GauntletFilm` gerekir → yeni sorgu/servis). |
| Hangi şampiyon | **Son şampiyon, tarih filtresi yok.** Kullanıcı dün oynamadıysa daha eski son şampiyon görünür; etiket bu yüzden "dünkü" değil "son seçimin" (`profile.lastPickLabel`, yeni string yok). |

**Değişen kurallar.** (1) **V1-D7**'nin "dünkü şampiyon yok" kısmı geçersiz
(satırında üstü çizildi). Arşiv / Pro Mode / keşif rotası yasağı **aynen
geçerli**: ~~kart dokunulamaz, hiçbir rotaya gitmez~~ *(v1.39 — **yalnız afiş**
film detayına gider, bkz. E-24.1; kartın geri kalanı hâlâ dokunulamaz)*
(K-46 korunur).
(2) "before_18'de ağ çağrısı yok" → **"before_18'de `generate-gauntlet`
çağrılmaz"** olarak daraldı (E-21.1 "İstemci tetik" satırına not düşüldü).
D-12'nin `waiting` satırındaki "gauntlet ÇAĞRILMAZ" ifadesi zaten bu dar
anlamdadır, değişmedi.

**Değişmeyen.** Beş durumlu kabuk, dakikalık nabız, gece yarısı
sıfırlaması (PRODUCT_OS §3.6 "dünün şampiyonu gösterilmez", şampiyon
**ekranının** gece yarısında kapanmasını anlatır; o geçiş aynen duruyor),
E-21 önceki döngü akışı.

**Hata yolu.** Sorgu hatası servis katmanında Sentry'ye yazılır. Kimlik
okunamazsa breadcrumb düşer. İki durumda da perde ve kart çizilmez, sayaç
her koşulda görünür. Reduce Transparency açıkken bulanık afiş yerine düz
`charcoal` çizilir.

**Uygulama.** `3b197ee`: `components/gauntlet/WaitingChampion/` (yeni),
`components/gauntlet/GauntletShell/index.tsx` (perde kökte, kart sayacın
altında). **Doğrulama:** `typecheck` 14 (hepsi `scripts/`) ·
`typecheck:functions` 32 · `test:waiting` 15 · `test:previous-cycle` 25,
hepsi yeşil. Cihaz doğrulaması yapılmadı: `before_18` yalnız TestFlight'ta
test edilebilir.

### E-24.1 — Bekleyiş afişi film detayına gidiyor (3 Eki 2026)

Kurucu kararı (3 Eki 2026). E-24'ün ~~"kart dokunulamaz, rota yok"~~ maddesi
**yalnızca afiş görseli için** değişti. **Gerekçe:** kullanıcı son seçtiği filmin
künyesine/izleme bilgisine bekleme ekranından ulaşabilmeli; afiş zaten ekranın
tek görsel öğesi ve dokunma beklentisi yaratıyor.

- Afişe dokunma → `router.push('/film/<champion_film_id>')` (`films.id` UUID;
  `app/film/[id].tsx` `.eq('id', id)` ile aynı kolonu okur). Salt navigasyon,
  hiçbir şey yazılmaz. Geri dönüşte bekleme ekranı korunur.
- Erişilebilirlik: `accessibilityRole="button"`, etiket `gauntlet.waitingChampionOpen`
  ("View {title}" / "{title} filmini görüntüle"). Hafif haptic (`hapticLight`).
- PostHog: `champion_poster_tapped`, alan yalnız `screen: 'waiting'` (`film_id` yok).
- **Değişmeyen:** sayaç, "Your last pick" etiketi, geri sayım, film adı; tüm kart
  değil yalnız afiş dokunulabilir. Arşiv / Pro Mode / keşif yasağı (K-46) aynen.
- **Detay ekranından çıkış yolları (kod taramasıyla):** Pro Mode / arşiv / benzer
  film / keşif rotası **yok** (`film/[id].tsx` tek `router` kullanımı `back()`).
  Var olanlar: fragman/Watch Now (`Linking.openURL`, harici), watchlist'e ekle /
  çıkar, izlendi işaretle (`watchlist.watched_at`), paylaş. Hiçbiri gauntlet
  durumunu değiştirmez; hiçbiri kapatılmadı.

### E-25 — Spotlight içerik sürekliliği: editoryal çözüm havuzu, acil havuz, haftalık cron (30 Eyl 2026)

**Olay.** Spotlight 11 Ağu – 30 Eyl 2026 arası bulmacasızdı. `generate-puzzles`
elle tetikleniyordu, cron'u hiç yoktu (son elle koşum 29 Tem). Şampiyon
ekranındaki bonus kartı (C.9b-UI C4) 50 gün boyunca `NO_PUZZLE` (404) açtı.
Kurucu TestFlight'ta fark etti. Kararlar kurucu tarafından AskUserQuestion
ile verildi.

| Konu | Karar |
|---|---|
| Çözüm havuzu | **100 günlük editoryal takvim** (`editorial_calendar_films`), genel `films` DEĞİL. Gerekçe: o gün gauntlet'te dönen filmler Spotlight'ta çıkmasın, "sürekli aynı içerik" hissi olmasın. Havuz tükenirse genel havuza sessiz düşüş yok → Sentry error. |
| Sıra | **Her günden bir film, 100. günden geriye**: önce tüm günlerin 1. filmi (100 → 1), sonra 2. filmler (position artan, day_number azalan). Gün gün gitmek gün içi aynı temayı (ör. 97. gün dört Pixar) art arda döndürürdü. Oynanamaz başlıklar (A-Z dışı, slot 3..30 dışı) baştan elenir. |
| Kart | Gizlenmez; hedef "her gün bulmaca olsun". |
| Acil havuz | **Onarıldı** (migration 119): `daily_puzzles.date` NOT NULL'dı, acil satırlar `date: null` ile eklendiği için hepsi 23502 ile reddedilmiş ve üretici hatayı yutmuştu — 10 oyun türünün hiçbirinde tek acil satır yoktu. `date` NULL kabul eder + `CHECK (date IS NOT NULL OR is_emergency_pool)`. İstemci görünümü `public_daily_puzzles` tarihsizleri zaten filtreliyor. Ekleme hatası artık Sentry'ye yazılır. |
| Süreklilik | **Haftalık cron** (migration 120): `generate-puzzles-spotlight`, Pazartesi 02:00 UTC, `?game=spotlight`, timeout 150 sn. 14 günlük ufukla her zaman 7–14 günlük tampon. **Ön koşul:** Vault `cron_service_role_key` 31 Ağu'dan beri ölü (CRON_ANAHTAR_KESIF.md, seçenek A) — kurucu canlı anahtarla günceller; bu aynı zamanda üç ölü cron'u da canlandırır. |

**Uygulama.** `1adc164`, `7a281bd` (havuz ve sıra), `320e2c5` (119 +
görünür hata), `6bfaea7` (120). İlk üretim 30 Eyl: 14 bulmaca (30 Eyl –
13 Eki), çözümler 100 → 86. günlerin 1. filmleri; kullanılabilir havuz 340.
Görünüm yalnız `v`, `title_mask`, `backdrop_url`, `letter_count` döndürüyor
(maske harf taşımıyor). **Açık:** cron'un canlı olduğu yalnız ilk Pazartesi
koşumundan sonra `net._http_response` ile kanıtlanır; `job_run_details`
kanıt değildir.

### E-26 — Third-party AI rızası: Anthropic'e veri giden her eylemden önce just-in-time rıza (9 Eki 2026)

CTO kararı (9 Eki 2026), Apple 5.1.2(i). **Gerekçe:** Pro Mode ve film detayı,
kullanıcının yazdığı metni ve ondan çıkarılan mood profilini üçüncü taraf bir
AI'a (Anthropic/Claude) gönderiyor; bunun için açık rıza alınmıyordu. Hiçbir
dokümanda yoktu.

- **Kapsam (ölçüldü, Edge Function gövdeleri okundu):** istemciden Anthropic'e
  veri götüren **tam 4 çağrı** var. `parse-mood` → yalnız yazılan metin
  (`raw_input`); `rerank-films` → mood metni (en fazla 500 karakter) + en fazla
  50 aday filmin başlık/yıl/tür/150 karakterlik özeti; `explain-match` → o
  aramadan çıkarılan `TasteProfile` + film boyut vektörü; `slot-mood-filtered` →
  preset ya da yazılan mood metni. **Hiçbirinde e-posta, `user_id` veya
  `auth_id` LLM gövdesine girmiyor** (yalnız sunucuda kota/rate-limit için
  kullanılıyor). Gönderilen "film tercih profili" uzun vadeli
  `preferences_vector` DEĞİL, o aramanın mood profilidir.
  `parse-taste`, `recommend`, `generate-puzzles`, `profile-missing-films` de
  Anthropic çağırır ama istemciden çağrılmaz; kapı gerekmez.
- **Tek kapı:** `services/aiConsent.ts`. `ensureAiConsent(surface, {explicit?})`
  rıza yoksa sheet açar; `hasAiConsent()` sessiz okur (sheet açmaz, otomatik
  tetiklenen çağrılar için). **LLM'e giden her çağrı bu modülden geçer; modül
  dışında rıza kontrolü yazılmaz.** Kapı dışında LLM çağrısı: grep ile 0.
- **Saklama:** `public.users.ai_consent_at timestamptz NULL` +
  `ai_consent_version smallint NULL` (migration **131**). DEFAULT ve CHECK
  bilinçli yok: NULL = "rıza yok / geri çekildi". Rıza =
  `ai_consent_at IS NOT NULL` VE `ai_consent_version >= AI_CONSENT_VERSION`
  (kodda 1; metin esaslı değişince artırılır, eski sürüm "rıza yok" sayılır).
  Yeni policy gerekmedi: "users: self update" (`auth_id = auth.uid()::text`)
  kolonları kapsıyor. Yazma `.eq('auth_id', user.id)` ile; **etkilenen satır 1
  değilse başarı sayılmaz** (Sentry error, LLM çağrısı yapılmaz, sheet açık
  kalıp tekrar denenebilir — sessiz 0-row dersi). Canlı doğrulama: iki kolon
  `timestamptz`/`smallint`, `is_nullable = YES`, default NULL; 304 satırın 304'ü
  iki kolonda NULL (backfill yok).
- **Yüzeyler:** Mood Search — kota tüketilmeden **önce** sor (ret halinde arama
  hakkı harcanmaz); ret → kısa açıklama + "Ayarlardan aç". Film detay — rıza
  yoksa otomatik `explain-match` **yok**, "Kişisel açıklamayı aç" CTA'sı.
  Rerank — rıza yoksa atlanır, vektör sıralaması kalır. Roulette mood spin
  (flag kapalı, kod kapıda). Gauntlet / Spotlight / watchlist **değişmedi**.
- **Ret:** uygulama kullanılabilir kalır. Ret yalnız **oturum belleğinde**
  (kalıcı yazılmaz); örtük tetikleyiciler aynı oturumda sheet'i yeniden açmaz,
  bilinçli eylem (Ayarlar anahtarı, CTA) açar.
- **Ayarlar:** `profile.tsx` ayarlar modalında push anahtarının altında "AI
  önerileri" anahtarı. Kapatmak `ai_consent_at = NULL` yazar. Ayarlar bir Modal
  olduğundan iOS kök VC'den ikinci Modal sunamaz → host kaydı yığın (son kayıtlı
  aktif), ayarlar modalı kendi `AiConsentHost`'unu içine monte eder.
- **Sheet metni (EN/TR):** Anthropic (Claude); giden = arama için yazılan metin
  ve o aramadan çıkarılan mood profili; amaç = film önermek ve nedenini
  açıklamak; gitmeyen = e-posta ve hesap bilgileri. İki eşit ağırlıkta buton
  (Kabul / Şimdi değil), hiçbiri accent dolgusu almaz.
- **PostHog:** `ai_consent_shown {surface}`, `ai_consent_granted {surface}`,
  `ai_consent_declined {surface}`, `ai_consent_revoked`. Çekirdek 20'ye girmez
  (G-6 §1.2.1 gibi).
- **Sunucu tarafı zorlama BU SPRİNTTE YOK** (Edge Function 403 eski istemcileri
  kilitlerdi) → §9 ve `docs/TEKNIK_BORC.md`. Bu kapı **istemci beyanıdır.**
- **Bible gerçeğe uyduruldu:** `CLAUDE.md` "Serbest metin girdisi yok" diyordu;
  Pro Mode'da serbest metin vardır (PRODUCT_OS §2.5 / IA kararı). Düzeltme
  `CLAUDE.md`'de, Product OS 🔒 satırı (ritüel girdisi) **değişmedi**.
- **Migration numarası dersi:** yerelde en yüksek 129'du, uzakta zaten 130
  (`subscriptions_environment`, `fix/rc-webhook-env`) uygulanmıştı → rıza
  migration'ı **131**; 130 dosyası yalnız dosya düzeyinde yerel takibe alındı
  (içerik uzaktaki `statements` ile birebir). CLAUDE.md numaralandırma kuralı
  `supabase migration list` (uzak dahil) ile güncellendi.
- **Kod:** `d0d88fc` (130 takibi) · `9dc9b54` (131) · `914f630` (servis + sheet) ·
  `d78135d` (4 çağrı yeri) · `439c525` (Ayarlar). Dal `fix/ai-consent`, **push /
  OTA / build yapılmadı**; cihaz doğrulaması yapılmadı.

### E-27 — Sign in with Apple token revoke: hesap silmede (R-3, 9 Eki 2026)

**Boşluk.** `delete-account` veriyi ve auth kaydını siliyordu ama Apple'a revoke
çağrısı yapmıyordu; Apple ile girmiş kullanıcının Apple tarafındaki oturumu/tokenı
açık kalıyordu (Guideline 5.1.1(v)). E-20 bunu ölçmemişti (bkz. oradaki not).
Kararlar CTO tarafından, keşif sonrası DUR NOKTASI 1'de onaylandı.

| Konu | Karar |
|---|---|
| Token saklama | **Saklanmaz, migration yok.** Silme anında Apple ile yeniden doğrulama. |
| İstemci | Silme onayından sonra `supabase.auth.getUserIdentities()` (ağ, taze; `app_metadata.provider` birincil sağlayıcıdır ve `linkIdentity` sonrası bayat kalabilir). Okuma başarısızsa silme **başlamaz**. Apple identity varsa `signInAsync({ requestedScopes: [] })` → `authorizationCode` → **hemen** `delete-account` gövdesine (`appleAuthorizationCode`; code ~5 dk geçerli, tek kullanımlık). Kullanıcı Apple ekranını iptal ederse silme **iptal**, hiçbir veri silinmez, `t()` mesajı. Apple identity yoksa (anonim / e-posta) adım atlanır. |
| Karar yeri | Apple identity kararı **sunucuda** (`getUser().identities`). Gövde alanı opsiyonel → eski client geriye uyumlu. |
| Karar tablosu | Identity yok → hiçbir şey · identity var + code yok → silme devam, Sentry `warning` `APPLE_REVOKE_SKIPPED_OLD_CLIENT` · identity var + code var → revoke dene. |
| Sunucu akışı | `client_secret` = ES256 JWT (`npm:jose`, kid=`APPLE_KEY_ID`, iss=`APPLE_TEAM_ID`, sub=`APPLE_CLIENT_ID`, aud=`https://appleid.apple.com`, exp=iat+300; `APPLE_PRIVATE_KEY` literal `\n` → satır sonu) → `/auth/token` (code → refresh_token) → **sub eşleştirmesi** → `/auth/revoke`. Her Apple çağrısı tek deneme, 10 sn timeout. |
| `APPLE_CLIENT_ID` | **Bundle id `com.chosy.ai`**, Services ID değil: native akışta authorization code `signInAsync`'in client'ına bağlıdır. |
| sub eşleştirmesi | `/auth/token` yanıtındaki `id_token`'ın `sub`'ı, Apple identity'nin `provider_id`'si ile karşılaştırılır (token doğrudan Apple'dan TLS ile geldiği için imza doğrulanmaz, yalnız payload decode). Uyuşmazlıkta (veya karşılaştırılamıyorsa) **revoke yok**, Sentry `warning` `APPLE_REVOKE_SUB_MISMATCH`, silme devam. Gerekçe: kullanıcı yeniden doğrulamada başka Apple ID seçerse başka hesabın tokenı revoke edilmesin. |
| Hata sözleşmesi | Revoke/token hatası ve eksik secret **silmeyi engellemez**; Sentry `error` `APPLE_REVOKE_FAILED` / `APPLE_SECRETS_MISSING`. code, token, secret, private key **asla** loglanmaz (testle doğrulandı). |
| Yerleşim | JWT doğrulamasından hemen sonra, **ilk silme adımından önce**; satırlı ve satırsız (auth-only) dalların ikisini de kapsar. `verify_jwt` ve mevcut silme sırası değişmedi. Yanıta `apple_revoke` alanı eklendi (geriye uyumlu). |

**Uygulama.** `9f4231c` (`_shared/appleRevoke.ts` + `test:apple-revoke`, 18 test, Apple
uçları mock) · `af02ed3` (`delete-account` entegrasyonu) · `9f3d22a` (istemci
yeniden doğrulama + `deleteAccountAppleCancelled` / `deleteAccountIdentitiesError`,
en/tr parity 1440). Doğrulama: `test:apple-revoke` 18/18, `tsc` 14/14,
`typecheck:functions` 32/32 (baseline), `deno check delete-account` temiz.

**Sapma (kayıtlı).** Apple identity var ama cihazda Apple girişi kullanılamıyor /
`authorizationCode` yok / beklenmedik hata (`unavailable`): silme **engellenmez** —
kullanıcı hesabını silebilmeli. İstemci `logger.error` (Sentry) yazar, sunucu code
alamadığı için `APPLE_REVOKE_SKIPPED_OLD_CLIENT` warning yazar. Gövde parse'ı
başarısızsa boş gövde sayılır (eski client gövdesizdir).

**Açık / ölçülmemiş.** (1) `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_CLIENT_ID` /
`APPLE_PRIVATE_KEY` secret'ları 9 Eki 2026'da `supabase secrets list` ile **ölçüldü:
yok**. Kurulmadan canlıda her Apple kullanıcısı için `APPLE_SECRETS_MISSING` düşer
(silme yine çalışır). (2) Canlı uçtan uca doğrulama (gerçek Apple revoke) **yapılmadı**;
testler Apple uçlarını mock'luyor. (3) Deploy edilmedi.

### E-28 — RevenueCat sıralaması: hazırlık sinyalleri (R-2, 9 Eki 2026)

CTO kararları (9 Eki 2026), dal `fix/rc-sequencing`. Sentry ölçümü: **REACT-NATIVE-7**
(`addSubscriptionListener` → `RC_NOT_INITIALIZED`) 45 olay · 4 kullanıcı · ilk görülme
5 Eyl, son 8 Eki; **CHOSY-EDGE-FUNCTIONS-14** (TRANSFER hedefi `$RCAnonymousID`,
"çözülemedi") 3 olay (5, 7, 8 Eki), Users Impacted 0. Üç olayın `transferred_from`
değerleri birbirinden farklı; anonim hedefler zincir kuruyor (her olayın hedefi
bir sonrakinin kaynağı) — restore/alımın anonim RC kimliğindeyken koştuğuyla
uyumlu (çıkarım, doğrulanmadı).

| # | Karar |
|---|---|
| 1 | `purchaseService` iki hazırlık sinyali verir: **`rcReady`** (`Purchases.configure` bitti) ve **`identityReady`** (RC appUserID = Supabase auth id; `configure` aynı kimlikle yapıldıysa hemen hazır, değilse ilk `identifyUser` → `logIn`). Export: `whenRcReady(ms)`, `whenIdentityReady(ms)`. Zaman aşımı → tipli hata (`RcReadinessError`) + Sentry error. |
| 2 | **Kimlik değişimi sinyali yeniden kurar** (hesap silme → yeni anonim, mevcut hesaba geçiş). Bekleyen bir geçiş varken yeni geçiş gelirse deferred **değiştirilmez**, hedef güncellenir; yalnız **son hedef** için `logIn` bitince resolve olur (aksi hâlde eski bekleyenler timeout'a düşer). `logIn` hatasında bekleyenler hızlı hata alır. `logOutPurchases` kimliği pending yapar. |
| 3 | `addSubscriptionListener` `rcReady`'yi bekleyip bağlanır; bekleme normal akıştır, log yok. Cleanup bağlanmadan önce çağrılırsa bağlama iptal. 30 sn'de bağlanamazsa Sentry error. |
| 4 | **`identifyUser` `'not_initialized'` dönmek yerine `whenRcReady(10 sn)` bekler**, sonra `logIn`. **Kapsama alındı** (yeni kurulumda `SIGNED_IN`'in `configure`'dan önce gelme yarışı): App Review temiz kurulumla test eder; `logIn` kaçarsa alım `$RCAnonymousID`'ye yazılır, webhook eşleyemez, Pro açılmaz. Zaman aşımında Sentry error + eski `'not_initialized'` dönüşü korunur. |
| 5 | **`restorePurchases` ve `purchasePackage` `rcReady` + `identityReady` bekler** (10 + 10 sn). Satın alma/restore anonim RC kimliğinde **asla başlamaz**. Hazır olunamazsa RC çağrılmaz; yeni `PurchaseErrorKind` **`'not_ready'`** + `errors.accountNotReady` (en/tr). `configure` hiç yapılamadıysa eski `'not_initialized'` korunur. |
| 6 | Zaman aşımları: `rcReady` 10 sn · `identityReady` 10 sn · listener 30 sn. |
| 7 | `PaywallBase`'in restore sonrası `users`/`subscriptions`'a kendi yazdığı ikinci yol **değiştirilmedi** → `TEKNIK_BORC.md` "çift yazma yolu". |
| 8 | **R-2 ek kapsamı:** `getOfferings`, `getSubscriptionStatus` ve `getTrialEligibility` da `whenRcReady(10 sn)` bekler (`ab8fd1a`); zaman aşımında `RC_READY_TIMEOUT` (Sentry), mevcut dönüşler korunur: `getOfferings` boş liste + `'not_initialized'`, `getSubscriptionStatus` varsayılan durum + `errorKind: 'not_initialized'`, `getTrialEligibility` hepsi `'unknown'` (trial vaat edilmez, Apple 3.1.2). |
| — | Reddedilen: `initializePurchases`'ı `getSession`'dan öne almak → **R-21**. |

**Uygulama.** `5f88bc8` (sinyaller + `utils/rcReadiness.ts`, 14 Deno testi),
`75b39bb` (`identifyUser` bekler; `_layout` ikinci rapor bloğu kaldırıldı —
servis zaten yazıyor), `9eed468` (listener), `114258a` (restore + alım,
`'not_ready'`, locale, `PaywallBase` iki dal). **Durum:** commit'lendi; push, OTA,
build ve cihaz doğrulaması **yok**. `tsc` 14 · `tsc:functions` 32 (ikisi de
baseline, 9 Eki 2026 ölçümü).

**Doğrulanmadı.** (a) "Aynı `transferred_from` için ikinci TRANSFER yok" çıkarımı
yalnız üç olayın `transferred_from` karşılaştırmasına dayanır; her olayla aynı
saniyedeki `RC_TRANSFER_LIFETIME` (applied) kaydının aynı webhook çağrısına
ait olduğu zaman damgasından çıkarıldı, `rc_event_id` eşleşmesi okunamadı.
(b) Soğuk açılış sırası ve hesap silme sonrası kimlik geçişi gerçek cihazda
(TestFlight) ölçülmedi.

---

## 6. MEVCUT KULLANICIYI KAÇIRMAMA PLANI (E-05 detayı)

**Mevcut durum:** 63 gerçek hesap · 87 yetim anonim kimlik (`public.users` satırı yok, 23 Nisan'dan beri) · kullanıcıların bildiği Home = mood search + quota · quiz arketipleri · iki ayrı watchlist ekranı · iki paywall CTA'sı / iki RevenueCat offering'i · 0/0 gösteren badge'ler.

| Risk | Önlem | Sprint |
|---|---|---|
| ~~**Alışkanlık kırılması** — açtığında bambaşka uygulama, açıklama yok~~ | ~~Sürüme özel **tek seferlik "Chosy değişti" köprü ekranı**: 3 satır + "Bu geceki gauntlet'i gör". Onboarding değil, yeniden tanıştırma. `has_seen_relaunch_intro` flag'i.~~ ⚠️ **v1 dışı — bkz. R-19, 26 Eyl 2026.** | ~~R-A~~ |
| **Özellik kaybı algısı** — mood search paywall arkasına gidiyor | **Grandfathering:** relaunch tarihinden önce oluşmuş hesaplara mood search ücretsiz kalır. Maliyet ≈ 0, 1-yıldız riski ≈ 0, Faz 0 "her şey ücretsiz" kuralıyla uyumlu. | M0 |
| **87 yetim kimlik** | C.7 backfill migration **ilk iş**. Idempotent. | M0 |
| **Watchlist birleştirmede satır kaybı** | Merge kuralı: **union, DELETE yok**, `(user_id, film_id)` üzerinde en erken `created_at` korunur. Dry-run count raporu zorunlu. | C.9d |
| **Entitlement kaybı** | Yok — `chosy_plus` zaten canlı entitlement; sadece DB'deki 3 satırın `entitlement_id` değeri (`'premium'` → `'chosy_plus'`) düzeltiliyor. Eski CTA'lar (Plus / Founding Member) C.9c'de konsolide ediliyor. | M0 (veri) · C.9c (CTA) |
| **Kırık deep link** — `/mood`, `/discover` | 404 değil, Home'a redirect. | C.9a |
| **Zorla yeniden giriş** | Anonim session'lar güncellemeden sağ çıkmalı. Regresyon test maddesi. | M0 |
| ~~**Sessiz kayıp**~~ | ~~**Kurucudan 63 kişiye kişisel mesaj**: "Chosy'yi baştan kurduk, ilk 63 kişisin." Elimizdeki en yüksek getirili retention aksiyonu ve hiçbir dokümanda yok.~~ ⚠️ **v1 dışı — bkz. R-19, 26 Eyl 2026.** | ~~R-D öncesi~~ |
| **Bozuk build'in kohortu yakması** | E-06 kademeli dağıtım. | R-D |

---

## 7. NİHAİ ÜRÜN DURUMU — `CHOSY v1.0 MARKET READY`

### 7.1 Yüzeyler (11 — fazlası yok)

```
1.  Onboarding           3 kart · ilk açılış · atlanabilir
2.  Home                 state machine (K-03)
3.  Gauntlet round       Home içinde · full-screen
4.  Champion             Home içinde · kalıcı
                           ~~Sonraya bırak (birincil) · Nerede izlenir (bilgi) · Paylaş~~
                           v1.32 (E-23 V3-D3): tam genişlik poster hero · Watch Now
                           (TMDB link varsa, birincil) · Sonraya bırak · Paylaş —
                           link yoksa Sonraya bırak birincil
                           (v1.22'ye kadar: Nerede izlenir · Sonraya bırak · Paylaş)
                           tek cümlelik "neden bu film"
                           altında: Bugünün bonusu — Spotlight
5.  Where to Watch       (v1.22'ye kadar: sheet) → Champion içinde satır içi, dokunulmaz logo satırı (v1.23)
                           v1.32 (E-23 V3-D5): en fazla 3 logo + "See all" sheet'i
                           (Stream/Rent/Buy, satırlar dokunulmaz)
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

> **Bu 9 eşik tutmadan tek dolar ve tek saat marketinge harcanmaz.** *(v1.26: G-9 kapatıldı → **8 eşik**, bkz. R-19.)*

| # | Ölçüm | Eşik |
|---|---|---|
| G-1 | Crash-free | ≥ 99.5% |
| G-2 | 20 kullanıcı × 7 ardışık gün gauntlet completion | ≥ 70% |
| G-3 | Watch feedback **yanıtlanma** oranı (E-07) | ≥ 50% |
| G-4 | Watched-it ilk sinyal | ≥ 25% *(kill eşiği %20 · hedef %35, 500 kullanıcıda)* |
| G-5 | Neither rate | %15–30 bandında |
| G-6 | PostHog çekirdek eventleri doğrulanmış | 20/20 — liste: `docs/analytics/G6_CEKIRDEK_EVENTLER.md` |
| G-7 | Açık P0/P1 | 0 |
| G-8 | App Review | geçilmiş |
| ~~G-9~~ | ~~**Relaunch sonrası 14 günde mevcut kullanıcı kaybı**~~ | ~~< %20~~ ⚠️ **Kapatıldı — R-19, 26 Eyl 2026** |

~~G-9 kritiktir: relaunch mevcut kullanıcıyı kaybettiriyorsa, marketing sadece zararı büyütür.~~ *(v1.26: korunacak alışkanlık yok — R-19.)*

---

## 8. SPRINT PLANI — CLAUDE CODE UYGULAMA SIRASI

**Protokol (her sprint için istisnasız):**
- Ayrı `/clear` · keşif read-only ("no schema changes, read only") · ölçüm önce · DUR NOKTASI'nda CTO onayı · `git add` dosya listesi açıkça belirtilir · doğrulanmamış kapanış dili ("closed/complete") kullanılmaz.
- Claude Code'un **mimari karar yetkisi yoktur** (chosy-conventions §9). Yeni tablo/kolon, yeni pattern, yeni bağımlılık, sözleşme değişikliği, Edge Function ekleme/kaldırma → DUR ve sor.
- Yeni kullanıcı stringi eklendiğinde `en.json` + `tr.json` paritesi aynı commit'te (K-58).

| Sprint | Amaç | Kapsam | Ön koşul | DUR NOKTASI | Model |
|---|---|---|---|---|---|
| **M0** Göç & Kurtarma | Kimseyi kaybetmeden zemini hazırla | Orphan fix'in sahada doğrulanması (d9b22e2) · E-08 sessiz kimlik sıfırlama düzeltmesi · `subscriptions.entitlement_id` veri düzeltmesi (`premium`→`chosy_plus`) · `legacy_mood_access` grandfathering kolonu | Faz 1 keşif (tamamlandı) | Orphan sayımı 0 kalıcı · `identity_reset_detected` eventi Sentry+PostHog'da görünür · 3 satır düzeltildi · grandfathering flag'i doğru kohortta true | Sonnet 4.6 |
| **M1** Ölçüm Önce | Production'a çıkmadan ölçüm hazır | PostHog event dictionary (20 event — `docs/analytics/G6_CEKIRDEK_EVENTLER.md`) · `gauntlet_id`/`algorithm_version` alan bağlaması · Sentry release health + EAS source map (E-04) · `v_algorithm_daily` view onayı (D-04) | M0 | 20/20 event canlı doğrulanmış · test crash'i doğru release'e düşüyor | Sonnet 4.6 |
| **M2** Zaman Mimarisi | "18:00" sorusunu çöz (E-01) | Kullanıcı timezone kaydı · saat dilimi bazlı batch üretim · DST · gün sınırı ve streak etkileşimi | M1 | 3 farklı timezone'da üretim saati doğrulaması | Fable 5 |
| **M3** Havuz Gerçeği | Ölçüm sonra kod (E-02, D-03) | Havuz derinliği ölçümü · `poster_url` w92 bug fix · `poster_quality_ok` batch kolonu + cron | M1 | Etkin havuz boyutu · tekrar oranı eğrisi · gate'in elediği film sayısı | Sonnet 4.6 |
| **C.9a** Nav | 3 tab → 2 tab | Tab bar · Discover `app_config` flag · native tab bar (K-04) · `/mood` `/discover` redirect | M0 | Cihazda 2 tab · Discover erişilemez · deep link redirect çalışıyor | Sonnet 4.6 |
| **C.9b** Home | Ritüel production'a çıkar | Home state machine (K-03) · dev-gauntlet → production · mood search çıkar · champion CTA gap ("Sonraya bırak" + "Nerede izlenir") · **C.4'ün production'a AÇILMASI** (yeniden yazımı değil) · tek cümlelik açıklama (K-21) | M1·M2·M3·C.9a | Cihazda tam akış: bekleyiş → 3 tur → champion → ertesi gün watch feedback | Fable 5 |
| **C.9c** Profile | Profil sadeleşir | Profile sırası (K-08) · Pro Mode girişi · paywall CTA konsolidasyonu · badge UI kaldırma · **quiz girişi kaldırma (R-12)** | C.9b | Tek CTA · badge yok · quiz girişi yok · arketip verisi duruyor | Sonnet 4.6 |
| **C.9d** Watchlist | İkili kopya biter | Tek ekran · merge kuralı (union, DELETE yok) | C.9c | Dry-run count raporu · sıfır satır kaybı | Sonnet 4.6 |
| **R-A** İlk Deneyim | Yeni ve mevcut kullanıcı ayrı ayrı karşılanır | Onboarding 3 kart · auth-after-champion · bildirim izni (K-15) · ~~**"Chosy değişti" köprü ekranı**~~ *(v1 dışı, R-19)* · hesap silme cascade (K-16) | C.9d | Yeni kullanıcı ilk oturumu + ~~mevcut kullanıcı köprü akışı~~ cihazda | Fable 5 |
| **R-B** Güvenilirlik | "Çalışıyor" → "güvenilir" | Backend state machine (K-37) · idempotency · offline fallback (K-42) · error copy (K-43) | R-A | Uçak modu senaryosu · generation failure senaryosu · beyaz ekran yok *(K-42 cihaz doğrulaması E-11 ile TestFlight'a taşındı, 31 Ağu 2026)* | Fable 5 |
| **R-C** Para | Tek tetikleyici, tek entitlement | Arşiv paywall'ı (K-46) · RevenueCat state matrisi (K-49) · restore · paywall funnel enstrümantasyonu (E-09) · RC Paywalls v2 fizibilitesi + offline davranış ölçümü | R-B | 6 state test edilmiş · sandbox satın alma + restore · E-09 eventleri PostHog'da doğrulanmış | Sonnet 4.6 |
| **R-D** Çıkış | Store'a hazır | A11y (K-54) · QA matrisi (K-55) · App Store paketi · **TMDB lisansı (K-56)** · kademeli dağıtım (E-06) · ~~63 kişiye kurucu mesajı~~ *(v1 dışı, R-19)* · **Docker Desktop'ın çalışır hâle getirilmesi** · **ölü paywall varyantlarının temizliği (K-46 eki)** | R-C | 6 release gate (K-52) yeşil | Sonnet 4.6 |

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
| Orphan auth bounce oranı (~%20, muhtemelen test trafiği) | G-3 ~~/G-9~~ *(G-9 kapatıldı, R-19)* gate'lerinde gerçek kullanıcı verisiyle yeniden ölçülecek, v1 kapsamı dışı. Kaynak: `docs/investigations/ORPHAN_AUTH_KOK_NEDEN.md` (5 Eyl 2026, Sentry MCP ile Hipotez A doğrulandı — kod hatası yok). |
| `claim_lifetime_spot` canlı satın alma simülasyonu yapılmadı | İlk gerçek satışta 3 kontrolle doğrulanacak (`lifetime_sales` satırı · `users.subscription_tier` · `subscriptions.plan`). `nextval` geri alınamaz olduğu için bilinçli ertelendi. Kaynak: E-14. |
| `activate_referral` → `claim_lifetime_spot` iç çağrısı, service_role dışı bağlamda guard baypasını kaybeder | Latent; tek çağıran service_role olduğu için şu an güvenli. Dashboard SQL editor yasağı (CLAUDE.md kural 3) bu riski kapatıyor. Kaynak: E-14. |
| `record_posterle_hint` anon'a açık, `p_attempt_id` sahipliğini doğrulamıyor | Ayrı güvenlik iş kalemi. 109'un kapsamı dışında bırakıldı. Kaynak: E-14. |
| `.env` → `SUPABASE_SERVICE_ROLE_KEY` projeye kayıtlı değil (HTTP 401), 16 yerel script etkileniyor | Üretim etkilenmiyor (Edge runtime kendi secret'ını enjekte ediyor). Çalışan anahtar: `SUPABASE_SECRET_KEY`. Kaynak: E-14. |
| **E-19 yedek kulübesi boş** — `editorial_calendar_films` position 5-6 bandı şemada var, **0 satır** | K-23'ün ikinci yarısı. Launch-blocking DEĞİL: `submit-choice` guard'ı editoryal günde algoritmik yedeği zaten kapatıyor, yani kurgu korunuyor — eksik olan "ret sonrası yerine ne gelecek" cevabı. Kaynak: E-19.1. ⚠️ **Geçersiz — bkz. R-20, 2 Eki 2026:** guard kaldırıldı, ret sonrası yedek normal havuzdan gelir; yedek kulübesi artık bir ihtiyaç değil. |
| **E-19 gün 100 geçişi** — kullanılan 400 filmin kalıcı "gösterildi" işareti yok | §E-19.4 kalıcı işaret istiyor; `daily_gauntlets` tabanlı `recentlyShown` yalnız 21 gün tutuyor, yani 100. günde 400 film havuza geri döner. Editoryal dal bunsuz da çalışır. Kaynak: E-19.1 (keşif DUR-6). |
| **E-19 yönetmen tekrarı** — takvimde 17 küçük "aynı yönetmen ≤1" ihlali | Düşük öncelik, elle kürasyon kaynaklı. Kural `1_PRODUCT_OS` §6 çeşitlilik tablosunda ("Aynı yönetmen ≤1") — editoryal dal çeşitlilik kurallarını zaten çalıştırmadığı için kod seviyesinde bir ihlal değil, kürasyon seviyesinde. ⚠️ CTO bu kalemi "K-04 istisnası" diye adlandırdı; bu dokümandaki K-04 tab bar maddesidir, referans doğrulanamadı. |
| **E-19 canlı tetikleme doğrulanmadı** — gerçek deploy + gerçek kullanıcı akışı | Editoryal dal ve guard birim testi + statik kanıt düzeyinde doğrulandı (17/17 Deno testi); gerçek cihazda tetiklenmedi. K-42/K-49/K-55 cihaz testi turunda yapılacak. Kaynak: E-19.1. **v1.25 (26 Eyl 2026) — kısmen kapandı:** deploy yapıldı, `generate-gauntlet` editoryal dalı canlıda doğrulandı (aşağıdaki satır). `submit-choice` editoryal guard'ı (`refreshBlockedReason: 'editorial_day'`) ve gerçek cihaz akışı **hâlâ doğrulanmadı**. |
| ~~**Arama kotası legacy kohortta sunucuda hâlâ sayılıyor**~~ | ✅ **KAPANDI — migration 115, 24 Eyl 2026.** `check_and_consume_quota` artık `legacy_mood_access = true` kohortunu sınırsız sayıyor (muafiyet mevcut `-1` yoluna bağlandı, sayaçlar artmaya devam ediyor). Canlı doğrulandı: legacy kullanıcıda 5 ardışık `search` çağrısının beşi de `allowed:true` / `limit:999999`, `searches_used` 5'e çıktı (limit 3); legacy olmayan kullanıcıda 4. çağrı `QUOTA_EXCEEDED` verdi ve sayaç 3'te kaldı. `INVALID_QUOTA_TYPE` ve `USER_NOT_FOUND` dalları bozulmadı. |
| **Docker Desktop çalışmıyor** — `supabase db dump` ve yerel `pg_dump` alınamıyor | 115 bu yüzden yedeksiz push edildi (kabul edildi: şema/veri değişmiyor, geri alma tek `CREATE OR REPLACE`, pre-image 021'de). **Gerçek şema değiştiren ilk migration'da yedek ZORUNLU olacak** — R-D kapsamına alındı. Kaynak: migration 115 turu, 24 Eyl 2026. |
| **Legacy kohortta bonus aramalar artık tüketilmiyor** — `grant_bonus_searches` ile verilen bonuslar `bonus_searches_used` sayacında donuk kalıyor | Amaçlanan davranış (muaf kullanıcı bonusu boşuna yakmasın, migration 115 üçüncü delta). Streak ödül raporlarında "verildi / kullanılmadı" olarak görünecek — raporu okuyanın bilmesi gereken bir gözlem, hata değil. Kaynak: migration 115, 24 Eyl 2026. |
| **Lifetime ürünü iki ayrı offering'te aranıyor** — `getLifetimeOffering()` önce `lifetime_founding`'e bakıyor, `PaywallBase` ise yalnız default (`offerings.current`) paketlerini görüyor | **R-E'de `paywall_lifetime_enabled` açılmadan ÖNCE** RC dashboard'da `com.chosy.lifetime`'ın **default offering'de paketli** olduğu teyit edilmeli; aksi halde kart görünür ama satın alma `paywall.purchaseError` ile hata verir (`PaywallBase` paketi bulamaz). Flag `false` olduğu sürece tetiklenmez. Kaynak: Lifetime IAP kod denetimi, 24 Eyl 2026. |
| ~~**Ölü paywall varyantlarının temizliği** — beş varyant~~ | ✅ **A grubu KAPANDI — 26 Eyl 2026.** Beş aday **3 A + 2 B** olarak sınıflandırıldı. A (`watchlist_full` · `roulette_limit` · `streak_milestone`) `components/paywalls/_archive/` altına taşındı, orphan tip/mapping/helper'lar temizlendi. B (`streaming_link` → BM §4 Katman 2 / §8 **Faz 1** affiliate · `lifetime_soldout` → BM §5 + §9, **R-E**) **planlı**, dokunulmadı. Ayrıntı: K-46 eki düzeltmesi, v1.22. |
| **`app/lifetime.tsx` ekranına navigasyon girişi yok** | Rota `app/_layout.tsx:652`'de kayıtlı, ama repoda `router.push('/lifetime')` / `Href` referansı **sıfır** — ekran yalnız deep link ile açılabiliyor. `lifetime_soldout` paywall'ının tetikleyicisi bu ekranın içinde (`app/lifetime.tsx:160`), yani **flag açmak tek başına yetmez**. R-E'nin *"RC default offering'de paketli mi"* ön koşulunun **yanına ikinci ön koşul** olarak yazıldı. Ölçüm: 26 Eyl 2026, ölü varyant sınıflandırma turu. |
| **`npm run test:founder` 3/5 ölçüyor — kota kısıtı, ürün regresyonu değil** | Test hesabı free kohortta ve **arama kotası 3**; ilk üç case kotayı tüketiyor, `wong_kar_wai` + `no_marvel` `parse-mood`'dan **HTTP 429 `QUOTA_EXCEEDED`** alıyor ve `runner.ts:275-277` bunu `FAIL` yazıyor. **En az 17 Ağu 2026'dan beri böyle**: `baselines/2026-08-17`, `-19`, `-21` ve `2026-09-26` dosyalarının hepsinde aynı iki case `verdict:FAIL`, `top10_titles: []`, `avgSimilarity: 0`. Bu iki case'i gerçekten ölçmek **test hesabına kota muafiyeti** (`legacy_mood_access` benzeri) gerektirir — E-19'un "ölçülemez" kalemleriyle aynı sınıf. Ölçüm: 26 Eyl 2026. |
| **`.claude/skills/health-check/SKILL.md:16` bayat beklenti** | *"Beklenen: 5 case yeşil"* diyor; gerçek en az 6 haftadır 3/5 ve nedeni bilinen bir kota kısıtı (üstteki kalem). Skill dosyasının kendi düzeltmesi **ayrı bir iş kalemi** — bu turda dokunulmadı, çünkü tur kapsamı paywall temizliğiydi. Ölçüm: 26 Eyl 2026. |
| ~~**Lifetime IAP ASC'de tamamlanamıyor**~~ | ✅ **Zaten Approved, canlı (CTO teyidi, 25 Eyl 2026).** Save / Add for Review pasifliği **normal davranış** — submit edilecek yeni bir şey yok. "Tamamlanamıyor" tespiti yanlıştı. Kaynak: K-59. |
| **`game_scores` FK'siz + 12 orphan satır** | Tablonun `user_id` kolonunda FK yok; hesap silme akışı da cascade de bu satırlara dokunmuyor. Ölçüm (25 Eyl 2026): 12 satır, **hepsi zaten orphan** — ne `public.users` ne `auth.users` uzayında karşılığı var, yani aktif bir kullanıcıya ait değil. Gizlilik riski değil, temizlik/bütünlük kalemi. FK eklemek şema değişikliğidir → **R-D kalemi, ayrı karar.** Kaynak: E-20. |
| **`auth.tsx:96-105` — PostHog identify öncesi kimlik uzayı uyuşmazlığı** | Sorgu `auth uid` ile `public.users.id`'yi karşılaştırıyor (migration 111'in ayırdığı iki uzay), kesişim **0**. Sonuç: `archetype` her zaman `null`, `subscription_tier` her zaman `'free'` olarak PostHog'a gidiyor — analytics verisi baştan yanlış. Ayrıca boş `catch {}` (kural 2 ihlali). **R-D'ye kod değişikliği olarak eklendi, bu turda dokunulmadı.** App Review blocker'ı değil, analytics veri kalitesi sorunu. Kaynak: E-20. |
| ~~**`delete-account` PostHog secret'ları kurulmadı**~~ | ✅ **KAPANDI — 26 Eyl 2026.** `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` kuruldu, fonksiyon **v26** olarak redeploy edildi. Canlı doğrulandı: silme sonrası PostHog persons sorgusu `{"results":[]}` döndü. Kaynak: E-20.1. |
| **Sağlayıcı talebi ölçülmüyor** — `provider_clicked` 26 Eyl 2026'dan beri gönderilmiyor | R-03 (streaming filtresi) ve R-06 (affiliate) "önce talep ölçülür" çözümünü bu event'e dayandırıyordu. Şampiyon ekranındaki logolar dokunulmaz olunca event'in anlamı kalmadı. İkame ölçüm yöntemi seçilmedi; R-03/R-06 yeniden açılmadan önce belirlenmeli. Kaynak: v1.23. *(v1.32 notu: V-3 G2 `watch_now_tapped` + `providers_see_all_opened` ekledi — biri toplu TMDB sayfasına gidişi, diğeri tam listeye ihtiyacı sayar; **sağlayıcı bazlı talebi ölçmez**, ikame değildir. Madde açık, ikame kararı CTO'da. Bkz. E-23.)* |
| **`auth.tsx`'te kullanılmayan kalıntılar (Google buton stilleri, eski welcomeTitle) — temizlik, ayrı iş.** | **R-D kalemi.** Kapsam: `ActivityIndicator` import'u · `googleButton*` / `skip*` stilleri · mood-search döneminden kalan `auth.welcomeTitle` / `welcomeSubtitle` metni ("Your mood. Your movies."). Email UI kaldırma turunda (v1.24) fark edildi, kapsam dışı bırakıldı. |
| **E-19 deploy edildi ve doğrulandı + P0-1 düzeltmesi — cihaz testi bekliyor** | **E-19:** `generate-gauntlet` **v33** + `submit-choice` **v32**, 26 Eyl 2026 14:43–14:44 UTC (E-19.1'den bu yana deploy edilmemişti; bkz. oradaki düzeltme notu). Deploy'a E-19 dışında tek değişiklik girdi: `8705931` (aynı gün tekrar açılan gauntlet'lerde posterler w500, v32'ye 36 dk geç kalmıştı, CTO onayıyla dahil edildi). Canlı doğrulama: deploy'dan sonra gelen yeni istek → `algorithm_version = v1-editorial-calendar`, `slot_types` dördü de `editorial`, **9. gün (`epic`)**, `film_ids` takvimin 1–4. pozisyonlarıyla **sırası dahil birebir aynı**. Test kimliği K-16 cascade sırasıyla silindi (önce `public.users` → `daily_gauntlets`, sonra auth; hepsi 0 satır). Bugün 12:58 UTC'de deploy'dan önce üretilmiş bir v0 gauntlet bugün öyle kalır (aynı gün tekrar açılınca kayıtlı satır döner), tasarım gereği. **P0-1** (`3fd787f`): `GauntletShell` bağlantı-geri-geldi tetikleyicisi `before_18`'de artık `flushThenLoad` çağırmıyor; `in_progress`'teki bekleyen seçim flush'ı (K-42) korunuyor. İstemci düzeltmesi — **yeni build ile ulaşır.** **Cihaz testi kısıtı:** `chosy://e2e/set-offline`/`set-online` yalnız `preview-e2e` build'inde dinleniyor, ama o build'de ve `__DEV__`'de `isUnlockedNow()` hep `true` döndüğü için `before_18` durumu **oluşmuyor** — deep link'lerle bu düzeltme test edilemez. Geçerli test: düzeltmeyi içeren **preview / preview-store (TestFlight) build**, yerel saat **18:00'den önce**, bekleme ekranında **elle** uçak modu aç → kapat → ekran bekleme ekranında kalmalı, gauntlet yüklenmemeli. **v1.27 (27 Eyl 2026) — P0-1'in sahada yaşandığı kesinleşti:** kullanıcının ilk açılışta gördüğü "önce gauntlet yok dedi, sonra geldi" dizisi P0-1'in kapattığı bağlantı-geri-geldi (T3) yoluydu. Kanıt: cihaz **TestFlight production build 902**, P0-1'i **içermiyor** (`3fd787f` 902'den sonra atıldı); o cihazın tek gauntlet'i (`Europe/Istanbul` kullanıcısı) **15:58 yerel saatte** üretilmiş. Release build'de `before_18`'den ağ çağrısına giden tek yol T3'tür (mount/auth `bootstrapping` guard'lı, dakikalık nabız kapı kapalıyken ateşlemez, "Tekrar dene" `before_18`'de render edilmez). Dizinin "sonra çıktı, tekrar girdi" kısmı **muhtemelen kullanıcının kendi uygulamadan çıkıp girmesi — doğrulanmadı**; oyun ortası 401'in (tek remount'suz çıkış yolu) tetiklendiğine dair belirti yok. **Gün 9 yeniden teyit edildi** (26 Eyl 19:30 UTC, yeni test kimliği): `generate-gauntlet` 200, `v1-editorial-calendar`, `slot_types` dördü `editorial`, `film_ids` = takvim gün 9 pozisyon 1–4 **id ve sıra birebir** (DB karşılaştırması `true`); test kimliği K-16 sırasıyla silindi (`public.users` → auth), üç tabloda 0 satır. Saha teşhisi için **B5 telemetrisi** eklendi (`85ffafd`, yalnız breadcrumb, kota sıfır): `gauntlet.state` (her ShellState geçişi + tetikleyici · `loadError` · düşürülen ikinci `load`) ve `network.status` (offline↔online). Hepsi **yeni build ile ulaşır.** Kaynak: `docs/investigations/BUILD_ONCESI_GAUNTLET_KESIF.md`. |
| **`daily_gauntlets` 1–25 Eyl 2026 arası hiç satır yazmamış** | **R-D kalemi, ayrı keşif gerekiyor — neden bilinmiyor.** Ölçüm (26 Eyl 2026): global cron (`scope=global`, `v0-global-random-diverse`, her gün 00:05 UTC) son satırını **31 Ağu**'da yazdı, sonra durdu. Kişisel (`scope=personal`) tarafta da 31 Ağu'dan sonraki ilk satır 26 Eyl 12:58 UTC. 1–25 Eyl aralığında iki scope'ta da **0 satır**. Kişisel taraf kullanıcı gelmemesiyle açıklanabilir; global cron'un durması ise açıklanamıyor. **v1.26 — kişisel taraf AÇIKLANDI, kırık değil:** o dönemde gelen tüm gerçek kullanıcılar (user-agent `Chosyai/31`, biri `/23`) App Store'daki **v1.1.0 build 31**'i (20 May 2026) kullanıyordu; o build'de gauntlet yok (`generate-gauntlet` 7 Ağu, Home'a bağlanışı 19 Ağu `5ea880b`). **Global cron — kök neden bulundu (26 Eyl keşfi):** Vault `cron_service_role_key` 31 Ağu'dan beri projeye kayıtlı değil (`net._http_response` → 401 `Unregistered API key`); aynı sır `weekly-trending-sync` ve `profile-missing-films` cron'larını da besliyor. Düzeltme ayrı kalem, onay bekliyor. |
| **Köprü ekranı yönlendirmesinin kapatılması (R-19)** | **Ayrı kod işi.** `app/gate.tsx:118-126` eski kohortu (`legacy_mood_access = true` + `has_seen_relaunch_intro = false`) `/relaunch-intro`'ya yönlendiriyor; ekran `app/relaunch-intro.tsx` (`1d2a66f`). Kapatılana kadar bible (v1 dışı) ile kod (canlı) ayrışık. Kaynak: v1.26. |
| **Rulet slot ek-spin kırığı — dokunulmayacak, rulet ile birlikte kaldırılacak** | **R-D "kaldırılacak" notu.** `slot_spins` tablosu ile `earn_slot_token` / `spend_slot_token` RPC'leri canlıda **yok** (022 uygulanmış, kaldıran migration yok → migration dışı silinmiş, şema kayması). v1.1.0'da kota bitince token ile ek spin (`roulette.tsx:300`) sessizce `success:false` dönüyor; ana spin çalışıyor (`slot-*` fonksiyonlarının `slot_spins` insert hatası yutuluyor). Rulet Product OS §436 / CLAUDE_CODE_OS C.6 ile tamamen kaldırılacak; bu alt özellik onunla birlikte gider. Kaynak: v1.26. |
| ~~**v1.1.0 (App Store build 31) backend ile kırık mı?**~~ | ✅ **KAPANDI — kırık değil, 26 Eyl 2026.** Kimlik baştan `auth.users` + `public.users.auth_id` tabanlı (`device_id` yok, C.7 etkilemiyor). `parse-mood` kullanıcı token'ı alıyor, `requireUser()` geçiyor: 9 Eyl'de iki gerçek kullanıcı başarılı parse aldı (v38 / 8 Ağu sonrası); 401 / `APP_USER_MISSING` izi yok. v1.1.0'ın çağırdığı 19 RPC'nin 17'si, 21 tablonun 20'si canlıda; eksikler yalnız slot token'ı (üstteki satır). Satırsız 4 anonim kimlik v1.1.0'ın giriş duvarında ayrılan kullanıcılar (`gate.tsx`: "Apple/Google ile giriş zorunlu") — tasarım gereği. Doğrulanmayan: `match_films` sonuç kalitesi (istemcide, loglanmıyor) · build 31'in birebir kaynağı (`c7a7b9f` repoda yok, `4cc98d1` vekil). |
| **E-19 → E-02 yeniden ölçümü** | 400 filmin yakılması aktif havuzun %21,4'ünü devre dışı bırakıyor ve gün-teması havuzu yedi alt havuza bölüyor. E-02 derinlik matematiği tema başına yeniden yapılmalı — E-19 kapanışıyla birlikte hâlâ açık. Kaynak: E-19 "Açık kalanlar". |
| **Resume ile doğrudan tur 3'e girişte finalist w780 prefetch'i yok** | **R-D kalemi.** Son tur finalist ısıtması yalnız canlı tur 2→3 geçişinde çalışıyor (`GauntletShell` `handleChoice`); resume yolu (`applyGauntlet`, `completedRounds > 0`) yapmıyor → Champion w780 soğuk yüklenir, 1,5 sn siyah bekleme tavanına takılma olasılığı artar. Oran ölçülmedi. Kaynak: v1.27, keşif B9. |
| **Soğuk açılış süresi — sabit splash + `generate-gauntlet`** | **R-D kalemi.** `app/gate.tsx` `MIN_SPLASH_MS = 3000` + `LoadingScreen` `FADE_OUT_MS = 500` gauntlet'ten önce **sabit 3,5 sn**. `generate-gauntlet` **tek ölçüm: 5096 ms** (26 Eyl 2026, yeni üretim yolu, istemci tarafı round-trip; ortalama değil). Toplam soğuk açılış **~8,5 sn olabilir** (tek ölçüme dayalı tahmin). Sahada `gauntlet.perf` breadcrumb'ı var ama Sentry'den okunmadı. Kaynak: v1.27, keşif B10. |
| **UTC gün anahtarı ↔ yerel ritüel ayrışması (önceden var olan, E-21'den bağımsız)** | **R-D / M2 Faz 2b kalemi, bugün dokunulmuyor.** ⚠️ **Tanım düzeltmesi:** CTO notu "İstanbul 00:00–03:00'da kullanıcılar yanlışlıkla `before_18`'e düşüyor olabilir" diyordu. Bu **spec gereği doğru davranış**: PRODUCT_OS §3.6 "Gün dönümü yerel gece yarısı", yerel saat 0–2 < 18 → `before_18` (`GauntletShell/index.tsx:117-127`). O pencerede kapı hatası yok. Gece yarısı sonrası cihaz testinde görülecek bekleme ekranı beklenen sonuçtur. **Ayrışmanın ölçülen gerçek etkileri:** **(a)** UTC− bölgelerinde anahtar akşamın ortasında döner. `generate-gauntlet/index.ts:771` `utcDateString()`; New York (EDT, UTC−4) 20:00 = 00:00 UTC. 18:00–20:00 arası D, 20:00 sonrası D+1 üretilir. 20:00 sonrası bir yeniden yükleme (remount/reconnect) aynı akşam ikinci bir gauntlet verir; ertesi akşam 18:00–20:00'de de zaten oynanmış D+1 döner. Canlıda `America/New_York` 4 kullanıcı (`users.timezone`, 27 Eyl 2026; ancak kolonun %95,6'sı `DEFAULT 'UTC'`, gerçek dağılım bilinmiyor). **(b)** K-42 önbelleği UTC anahtarla yazıyor (`services/gauntletCache.ts:112-117`), yerel tarihle okuyor (`:162`). UTC− bölgelerinde akşam çevrimdışı açılışta bugünün kopyası `cache_stale` sayılır ve yanlış "Bu bugünün listesi değil" uyarısı çıkar. İstanbul'da uyumsuzluk 00:00–03:00'a düşer, kapı kapalı olduğu için görünmez. Cihaz testi: saat dilimi `America/New_York`, 20:00 EDT öncesi ve sonrası. Kaynak: v1.28, E-21 keşfi. |
| **`weekly_legacy` tier'ı — ücretli, 117'de ele alınmadı** | **R-D kalemi, ayrı karar gerekiyor.** Migration 117 (27 Eyl 2026) monthly/annual/lifetime arama limitini sınırsız (-1) yaptı; `weekly_legacy` **14/gün**'de kaldı (canlıda 2 kullanıcı, `users.subscription_tier`). Ücretli bir tier olarak Plus'ın sınırsız aramasından yararlanıp yararlanmayacağı açık. Kaynak: v1.29. |
| **Free slot limiti istemci ↔ sunucu tutarsız (önceden var olan)** | **R-D kalemi.** `constants/subscriptionPlans.ts` `TIER_LIMITS.free.dailySlotLimit = 8`, canlı `subscription_limits.free.daily_slot_limit = 100` (27 Eyl 2026). Aynı dosya kendini "DB ile tam sync" diye tanımlıyor. Kod değişikliği yapılmadı. Kaynak: v1.29, 117 turu. |
| **E-21 istemci cihaz doğrulaması** | **TestFlight turu kalemi.** Sunucu canlıda doğrulandı (E-21.1), istemci sahada değil. `before_18` akışı yalnız TestFlight'ta test edilebilir (`__DEV__`'de 18:00 kapısı açık). Senaryolar: (i) uçak modunda temiz kurulum 18:00 öncesi → bekleyiş, hata ekranı değil; (ii) önceki döngüde 3. tur çevrimdışı seçilip bağlantı açılır → şampiyon görünür; (iii) önceki döngü bitince uygulama kapatılıp açılır → bekleyiş; (iv) önceki döngü ortasında çevrimdışı kapatılıp açılır → sunucuya sorulur. **Bilinen boşluklar:** son seçim çevrimdışı yapılıp uygulama kapatılırsa açılışta şampiyon gösterilmez; cihazında gauntlet cache'i olmayan mevcut kullanıcı (kimlik sıfırlanmış / K-42'den beri açmamış) bir kez iskelet + 409 görür. `none -> before_18` kohort büyüklüğü (E-21 "Ölçülemeyen") yeni build sonrası `gauntlet.cycle` breadcrumb'ıyla bakılacak. Kaynak: v1.30. |
| **K-15 yerel 18:00 bildirimi — karar verildi, uygulanmadı** | *(v1.45, 6 Eki 2026 — "uygulanmadı" **geçersiz** — bkz. K-15, 6 Eki 2026: yerel hatırlatıcı kodda (`e6e87be`, copyVersion `fdcae78`); açık kalan cihaz doğrulaması, V1_TESTFLIGHT_CHECKLIST O7. Satırın geri kalanının güncelliği bu turda ölçülmedi.)* **Ayrı kod turu.** Tek native switch + cihazda yerel planlama + bekleme ekranı CTA'sı (`waiting_notify_tapped`). Uygulanınca `users.daily_pick_enabled` / `watchlist_notifications_enabled` okuması/yazması bırakılır (kolonlar silinmez). Kaynak: v1.31, E-22. |
| **K-08 Streak bölümü ertelendi** | Streak yazımı gauntlet tamamlanmasına bağlanmadan Profile'a girmez (sunucu değişikliği → ayrı karar). Kaynak: v1.31, E-22. |
| **K-32 Cinema DNA boru hattı — v1.1** | Kart gizli, vaat metinleri çıkarıldı (v1.33). Ön koşullar ve son tarih `docs/TEKNIK_BORC.md` "Cinema DNA boru hattı" kaydında. Kaynak: v1.33. |
| **K-60 eski "Not now" kohortu auth ask'ini görmez** | **Bilinçli taviz.** R-A-2 döneminde "Not now" diyen anonim kullanıcının `auth_prompt_seen` değeri `true`. K-60 bu bayrağı "girişe dönüşmüş" olarak okuduğu için bu kohort auth ask'ini bir daha görmez; eski "ömür boyu bir kez" davranışı korunur. Veri düzeltmesi yapılmadı. Kaynak: v1.41, `docs/TEKNIK_BORC.md`. |
| **`isPermissionGranted` fail-open** | OS izni okunamazsa `false` dönüyor, bildirim ask'i bu dalda açılır. Sentry `warning` var, sessiz değil. **Tetikleyici:** bildirim opt-in verisinde anomali ya da K-55 cihaz matrisi. Kaynak: v1.41, `docs/TEKNIK_BORC.md`. |
| **Global slot 1 Eylül'den beri üretilmiyor — K-46 arşivi degrade** | **Açık, P0 ile bağlı (Vault anahtarı).** `global-slot-daily` (jobid 7, her gün 00:05 UTC) koşuyor ve `cron.job_run_details` `succeeded` yazıyor, ama `daily_gauntlets scope='global'` son satır **2026-08-31**; 09-01 → 10-03 **0**. `net._http_response` 10-03 00:05 → **401** `Invalid API key`. Vault `cron_service_role_key` 13 karakter (geçerli anahtar 41), 10-01 06:23 UTC'de güncellenmiş, hâlâ geçersiz. **Etki:** günlük gauntlet etkilenmiyor (aşağıdaki satır); **K-46 arşivi** kaçırılan günün içeriğini global satırdan okuduğu için (`get-archive-status/index.ts:202-234`) 1 Eyl sonrası her kaçırılan gün `unavailable` — tetikleyici açılır, içerik yok. Aynı anahtar `generate-puzzles-spotlight` (jobid 19, ilk koşum 5 Eki 02:00) ve `profile-missing-films`'i de besliyor. Düzeltme: kurucu Dashboard'dan Vault'u günceller (kod değişikliği yok). Kaynak: v1.43, `docs/investigations/P1c_ADIM0_KESIF.md` §1–2. |
| **`generate-gauntlet` global satırı okumuyor — Product OS §6.9 ile fark** | **Bible gerçeğe uyduruldu, karar bekliyor.** §6.9 "Slot 1 → GLOBAL (herkese aynı)" diyor; gerçekte `generate-gauntlet` `scope='global'` satırını **hiç okumuyor** — dört film kişisel boru hattından (ilk 100 gün E-19 editoryal takvimden) gelir, `global` yalnız slot ETİKETİ (`generate-gauntlet/index.ts:285-297`: "Üretici hazır, tüketici değil"). Global satırın bugünkü tek tüketicileri arşiv (K-46) ve `gauntletCore` 21 günlük dışlama kümesi. Editoryal fazda (ilk 100 gün) herkes zaten aynı takvimi gördüğü için ortak zemin fiilen sağlanıyor; algoritmik faza geçişte (E-19 sonrası) §6.9 ya uygulanır ya da Product OS düzeltilir. Kaynak: v1.43, `P1c_ADIM0_KESIF.md` §2. |
| **`sync-trending` 31 Ağustos'tan beri ölü** | **Açık, P0 ile bağlı (Vault anahtarı).** `weekly-trending-sync` (jobid 6, Pzt 06:00 UTC) her hafta `succeeded` yazıyor; `films`'e son ekleme **2026-08-31 06:00** (15 film); 09-07/14/21/28 koşumlarında **0** yeni film (09-19'daki 94 film editoryal ingest, elle). Trending tier'ı bir aydır tazelenmiyor. Aynı Vault anahtarı — anahtar düzelince sonraki Pazartesi koşumu doğrular. Kaynak: v1.43, `P1c_ADIM0_KESIF.md` §1. |
| **K-61 küçük cihazda dwell kaydırma sonrası** | **Bilinçli taviz.** ≤ 812pt (SE sınıfı dahil), 2 satır başlık, "See all" ya da arşiv bağlantısı varken Spotlight kartı ilk ekranda tamamen görünmez; K-60 dwell'i kullanıcı kaydırıp bırakınca başlar. SE'de kart ilk ekranda ~%35 görünür. Hero oranı poster-first gereği değişmedi. Tab bar payı ölçülmedi (iOS standart varsayımı, telemetri kaydı Sentry'de bulunamadı). Kaynak: v1.42, `docs/investigations/S2_CHAMPION_SPOTLIGHT_KESIF.md` §5. |
| **K-62 kare erken iniyor** | **Bilinen risk, kabul edildi.** Bekleyiş teaser'ı bugünün Spotlight karesini (`backdrop_url`, TMDb `/original/`) 18:00'den saatler önce indirir; bulanıklık yalnız istemcide uygulanır, bulanık olmayan dosya ağ yanıtında ve cihaz önbelleğinde durur. Erken bakan kullanıcı kareyi tersine görsel aramayla çözebilir. `get-daily-challenge` gauntlet durumuna bakmıyor; S-2'den beri champion kartı da aynı dosyayı indiriyordu, K-62 pencereyi 18:00 öncesine genişletti. **Tetikleyici:** Spotlight çözüm süresinde/oranında anomali ya da sunucu tarafı kare kapısı kararı. Kaynak: v1.44, `docs/TEKNIK_BORC.md`. |
| **Third-party AI rızası sunucuda zorlanmıyor (E-26)** | **Bilinçli taviz, bu sprintte yok.** Edge Function'lar `ai_consent_at`'e bakmıyor; zorlama (403) rıza kapısı olmayan eski istemcileri kilitlerdi. Bugün rıza **istemci beyanıdır**: kapısız eski build'ler aynı fonksiyonları çağırmaya devam eder, kullanıcı kendi satırındaki kolonu (RLS self-update) değiştirebilir. **Tetikleyici:** eski build payı ihmal edilebilir seviyeye inince (EAS/TestFlight sürüm dağılımı) ya da App Review geri bildirimi. Kaynak: v1.47, `docs/TEKNIK_BORC.md`. |
| **E-26 cihaz doğrulaması yapılmadı** | **TestFlight turu kalemi.** Kod dalda (`fix/ai-consent`), push/OTA yok. Senaryolar: (i) Pro Mode ilk arama → sheet, Kabul → arama sürer; (ii) "Şimdi değil" → arama hakkı harcanmaz, "Ayarlardan aç" görünür, aynı oturumda ikinci aramada sheet yeniden açılmaz; (iii) Ayarlar'da anahtar aç → sheet **ayarlar modalının üstünde** görünür (iOS iç içe Modal varsayımı, cihazda görülmedi); (iv) anahtarı kapat → film detayda CTA, otomatik açıklama yok; (v) uçak modunda Kabul → hata metni, tekrar denenebilir. Roulette flag kapalı → mood spin yolu cihazda görülemez. Kaynak: v1.47. |
| **Apple revoke: secret'lar yok, deploy edilmedi (E-27)** | **Açık, P0 (App Store 5.1.1(v)).** `APPLE_*` dört secret kurulmadan revoke çalışmaz (`APPLE_SECRETS_MISSING`). Sıra: secret'lar → `delete-account` deploy → client OTA. Canlı revoke bir TestFlight hesabıyla Sentry'de `APPLE_*` kodu olmadığı ve Apple'ın Hesap ayarlarında uygulamanın düştüğü görülerek doğrulanır. Kaynak: v1.47, E-27. |
| **Apple revoke gate'i geniş: eski client uyarısı** | Apple identity var + code yok → `APPLE_REVOKE_SKIPPED_OLD_CLIENT` warning (silme sürer). Eski sürümler OTA ile gidince gate daraltılır; o zamana kadar warning gürültüsü beklenir. Kaynak: v1.47, `docs/TEKNIK_BORC.md`. |
| **`PaywallBase` restore sonrası çift yazma yolu** | **Bilinçli bırakıldı (E-28 #7).** Restore başarısında `PaywallBase` (`handleRestore`) `users.subscription_tier` + `subscriptions` satırını webhook'tan bağımsız kendisi yazıyor; sunucu yazımıyla iki yol var. R-2'de dokunulmadı. Ayrıntı ve tetikleyici `docs/TEKNIK_BORC.md` "çift yazma yolu". |

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
| 1.7 | 27 Ağu 2026 | SOSA 2026 incelemesi. R-01 korundu (gerekçe E-10). E-09 paywall enstrümantasyonu R-C önkoşulu olarak eklendi. Paywall vendor kararı: RevenueCat Paywalls v2 ile devam, ikinci vendor (Superwall/Adapty) marketing gate sonrası değerlendirilecek. |
| 1.8 | 31 Ağu 2026 | **E-11.** K-42'nin 8 senaryolu cihaz doğrulaması TestFlight build'ine ertelendi (yerel dev build/simülatör yok; Expo Go üzerinden uçak modu testi kod yolunu değerlendiremiyor). R-C açıldı; K-42 doğrulaması R-D önkoşulu olarak kaldı. Paywall ekranında geri gezinme eksikliği `TEKNIK_BORC.md`'ye alındı. |
| 1.10 | 11 Eyl 2026 | **E-14.** Plansız güvenlik ve veri bütünlüğü turu (8–11 Eyl), üç bağımsız üretim sorunu kapatıldı: (1) `referrals`/`winback_queue`/`lifetime_sales`'te `TO` clause'suz, fiilen anon'a açık 3 "service role" politikası; (2) 22 SECURITY DEFINER fonksiyonunda `p_user_id` kimlik doğrulaması eksikliği (`claim_lifetime_spot` dahil finansal istismar) — migration 109+110, 44 test geçti; (3) FK kimlik uzayı çatallanması — 5 FK `auth.users(id)`'den `public.users(id)`'ye çevrildi (migration 111), referral akışı koşulsuz kırıktı. 4 çağıran düzeltildi, 3 Edge Function deploy edildi (webhook v25, lifetime v22, referral v22) ve canlı smoke test edildi. Kök neden migration 014'te bir kez düzeltilmiş, 025/026'da tekrarlanmıştı. 4 açık madde §9'a alındı. |
| 1.9 | 31 Ağu 2026 | **E-12.** RC Paywalls v2 fizibilitesi tamamlandı: hibrit mimari korunuyor, tam geçiş yapılmadı, `react-native-purchases-ui` kurulmadı. R-C ilerlemesi: K-46 (arşiv tetikleyicisi + `get-archive-status` deploy edildi), E-09 (paywall/purchase event dalları tamamlandı) ve G-6 çekirdek event listesi (`docs/analytics/G6_CEKIRDEK_EVENTLER.md`) kapandı. Kalan: K-49 sandbox durum matrisi. |
| 1.11 | 18 Eyl 2026 | **E-19.** İlk 100 gün gauntlet'in 4 filmi ve 3 eşleşmesi editoryal takvimden gelecek (400 film, 300 eşleşme, elle kurgu); haftanın her günü sabit bir tür/mod taşıyacak ve bu gün-teması 100 gün sonrası algoritmik fazda da **kalıcı** kalıp §6.4 sert filtresine gün bazlı ağırlık olarak bağlanacak. Yetki dayanağı `1_PRODUCT_OS` §1.3'ün 🔓 "4 filmin seçim algoritması" satırı; hiçbir 🔒 madde değişmedi. Kullanılan 400 film 100. günde kalıcı "gösterildi" işareti alacak (21 günlük cooldown'dan ayrı). Üç uygulama önkoşulu açık bırakıldı: K-23 ret merdiveninin yedek film ihtiyacı, `slotTypes` etiket dürüstlüğü, E-02 havuz derinliği ölçümünün yenilenmesi. Şema/migration ihtiyacı ayrı `/kesif`'e bırakıldı. |
| 1.12 | 18 Eyl 2026 | **E-19 güncellemesi.** Haftalık gün-tema tablosu tamamlandı (Pzt arthouse · Sal kült · Çar animasyon/cozy · Per modern keşif/gizli cevher · Cum popcorn/gişe · Cmt epik & uzun metraj · Paz prestij/akademi). Takvim başlangıç kuralı eklendi: Gün 1 gerçek yayın tarihinin **hafta gününe** hizalanır, sabit "Gün 1 = Pazartesi" değildir. Yeni açık teknik madde: Cumartesi'nin "2,5–3+ saat" tanımı §4 bağlam runtime tavanıyla (`CONTEXT_MAX_RUNTIME` short 110 / medium 150, sert `.lte` filtresi) çelişiyor — ilk 100 gün etkilenmiyor (editoryal seçki bağlam filtresinden geçmiyor), yalnız algoritmik faz için karar gerekiyor. E-02 notu genişletildi: gün-teması havuzu yedi alt havuza böldüğü için derinlik matematiği tema başına yapılmalı. |
| 1.13 | 19 Eyl 2026 | **E-19 uygulama kapanışı — editoryal takvim canlıya alındı.** Bkz. yeni §5 E-19.1. Zincir tamamlandı: migration 111 (FK kimlik uzayı) → 112 (`editorial_calendar_days`/`films`, 100 gün / 400 slot) → 113 (`app_config.launch_date` koda bağlandı, mevcut satır bozulmadan), 96 eksik film iki fazlı resolve+ingest ile eklendi (`results[0]` yasağı ampirik TMDB belirsizlik ölçümüne dayanıyor). `generate-gauntlet` **DAL A / DAL B** ayrımına geçti: `day_number` 1-100 ise editoryal takvim (boru hattı hiç çalışmaz, `arrangeUnseen` çağrılmaz, `slot_types=['editorial'×4]`, `algorithm_version='v1-editorial-calendar'`), değilse mevcut v0 akış **değişmeden** sürüyor. `submit-choice` guard'ı editoryal günde algoritmik yedek çekmeyi kapattı ve kullanıcıya açık metin gösteriyor (`gauntlet.editorialNoRefresh`) — **K-23'ün launch-blocking yarısı kapandı**, yedek kulübesi §9'a alındı. `slotTypes` dürüstlüğü kapandı (`'editorial'` kilitli sözleşmeye CTO onayıyla eklendi). Cumartesi ↔ runtime tavanı çelişkisi ilk 100 gün için **kodda kanıtlandı** (DAL A `fetchPool`'a hiç girmiyor), **algoritmik faz kararı hâlâ açık**. Watched-dışlamasının editoryal günde uygulanmaması bilinçli tasarım kararı olarak kayda geçti. Ölçüldü: `launch_date=2026-09-18`, bugünün `day_number=2`, tema `epic`. Beş yeni madde §9'a eklendi. |
| 1.14 | 24 Eyl 2026 | **K-59 — Paywall v1 gerçek durumu ölçüldü (ASC + RevenueCat).** Trial'ın gerçek ve canlı olduğu ölçüldü (Monthly 3 gün · Annual 7 gün, 18 May 2026'dan beri); **R-01'in trial reddi geçersiz ilan edildi**, madde silinmeden not düşüldü (D-12/D-13 emsali). Freemium omurgası ve E-10 fiyat kilidi değişmedi. Fiyatın ASC ↔ kod senkron olduğu doğrulandı ($6.99 / $39.99 / $89.99); E-03 ve E-10'daki yanlış `$29.99` Annual referansları `$39.99`'a düzeltildi (`2_BUSINESS_MODEL` §5'teki $4.99/$29.99/$79.99 **Faz 1 hedefi** olduğu için korundu). Kod tarafında `contextPaywall.trialInfo`'nun statik "3 days free" metni tüm varyantlarda yanlış bilgi veriyordu — seçili plana göre dinamikleştirildi. Lifetime IAP'ın ASC'de tamamlanamaması §9'a açık madde olarak alındı (R-D önkoşulu). |
| 1.15 | 24 Eyl 2026 | **K-46 eki — paywall giriş noktaları denetimi.** 9 varyant tarandı. `profile_upgrade` ve `mood_history` CTA-tabanlı, kullanıcı-başlatmalı yükseltme girişleri olarak **yetkilendirildi** (K-45 dayatılan anları yasaklar, bunlar kullanıcının bastığı düğmelerdir; K-47 ve R-16 içerik kuralına tabi). `quota_exhausted` duvarı grandfathered kohort için **kaldırıldı** (R-02 uyumu) — slot dalı fiilen sınırsız, arama dalı sunucuda saymaya devam ettiği için §9'a açık madde olarak alındı. `missed_day_archive` artık yalnız kullanıcı dokunuşuyla açılıyor; şampiyon ekranında mount anında açılan dayatma kaldırıldı (K-45 ile net ayrım). Ölü doğrulanan 5 varyant (`streak_milestone` · `watchlist_full` · `streaming_link` · `lifetime_soldout` · `roulette_limit`) **silinmedi**, temizlik R-D kalemi olarak §9'a yazıldı. `app_config` ölçümü: `discover_tab_enabled` false · `games_enabled={games:[spotlight], roulette:false}` · dört `paywall_*` flag'i false. |
| 1.16 | 24 Eyl 2026 | **Migration 115 — K-46 borç kapanışı.** `check_and_consume_quota` `legacy_mood_access` muafiyeti canlıya alındı; K-46 ekinin açık bıraktığı sunucu yarısı kapandı ve §9'daki ilgili borç satırı ✅ işaretlendi. Gövde 021'den birebir, toplam **dört işaretli delta**: `v_legacy` okuması · muafiyet bloğu (`v_limit := -1`, `INVALID_QUOTA_TYPE` sonrası / `TIER_NOT_CONFIGURED` öncesi) · search bonus dalına `v_limit != -1` koruması · `SET search_path = public, pg_temp` sertleştirmesi. Sertleştirme `CREATE OR REPLACE`'in `proconfig`'i sıfırlamasına karşı **ölçüm yerine garanti** olarak eklendi (ölçüm kanalı yoktu: psql kurulu değil, `db dump` Docker istiyor). migration-guard iki turda da denetledi: bloke edici bulgu yok, ACL (109/110) ve JSONB sözleşmesi etkilenmiyor. Canlı doğrulama 4/4 geçti. Yedeksiz push bilinçli kabul edildi; Docker Desktop R-D'ye alındı. R-D kapsamına ayrıca Lifetime IAP (K-59) ve ölü paywall varyantlarının temizliği yazıldı. |
| 1.17 | 24 Eyl 2026 | **D-08 ihlali kapatıldı + lifetime claim akışı sessiz kayıptan arındırıldı.** (1) `PaywallBase`'in Lifetime kartı D-08/§7.3 ile çelişiyordu (canlı paywall v1'de lifetime satıyordu); kart **silinmedi**, `paywall_lifetime_enabled` flag'inin arkasına alındı — migration 116, varsayılan `false`, SAFE_DEFAULTS'ta da `false` (fail-closed, D-08 yönünde). R-E'de geri açılabilir. (2) `claimLifetimeSpot` artık her hatayı `SOLD_OUT`'a genellemiyor: `SOLD_OUT` / `ALREADY_LIFETIME` (RPC'nin kendi iş kuralı) ile `FORBIDDEN` (109 guard'ı, 42501) / `RPC_FAILED` (taşıma) ayrıldı. (3) `app/lifetime.tsx` ödeme sonrası **hiçbir dalda sessizce annual'a yazmıyor** — eski davranış $89.99 tek seferlik ödeyen kullanıcıyı izsiz şekilde abonelik kaydına çeviriyordu (kural 1 ihlali). Gerçek SOLD_OUT'ta açık mesaj + `error` Sentry; taşıma/izin hatalarında **fatal** Sentry + "ödemen alındı, destek ile iletişime geç"; başarı mesajı yalnız kayıt tuttuysa. (4) `ALREADY_LIFETIME` dalı kasıtlı hâle getirildi (idempotent başarı + warning Sentry). i18n 4 yeni anahtar, parite 1365/1365. |
| 1.18 | 25 Eyl 2026 | **Düzeltme: Lifetime IAP açık maddesi geçersizdi.** CTO teyidi: "Chosy Plus Lifetime" ASC'de zaten **Approved ve canlı**; Save / Add for Review butonlarının pasif olması normal davranıştır (submit edilecek yeni bir şey yok). v1.14'te §9'a alınan "tamamlanamıyor" maddesi yanlış teşhisti, ✅ olarak kapatıldı. Kod tarafında değişiklik yok. |
| 1.19 | 25 Eyl 2026 | **Lifetime IAP tutarsızlıkları kapatıldı.** v1.18 §9'daki maddeyi düzeltmişti ama aynı tespitin izi iki yerde daha duruyordu: §8 **R-D kapsamından** "Lifetime IAP'ın ASC'de tamamlanması (K-59)" çıkarıldı (yapılacak iş yok) ve §2.7 **K-59 notundaki** "Açık madde … zorunlu bir alan eksik … tamamlanmalıdır" cümlesi gerçekle uyumlu hâle getirildi (zaten Approved ve canlı, ek işlem gerekmiyor). Kod değişikliği yok. |

| 1.47 | 9 Eki 2026 | **Tek release (2.1.0), üç madde.** **(1) E-26 — Third-party AI (Anthropic/Claude) rızası, Apple 5.1.2(i).** CTO kararı: kullanıcı verisini LLM'e götüren **4 istemci çağrısı** (`parse-mood`, `rerank-films`, `explain-match`, `slot-mood-filtered`) tek kapıdan (`services/aiConsent.ts`: `ensureAiConsent` sheet açar, `hasAiConsent` sessiz okur) geçer; kapı dışı LLM çağrısı grep ile 0. Saklama `users.ai_consent_at` + `ai_consent_version` (migration **131**, DEFAULT/CHECK yok, 304/304 satır NULL doğrulandı). Rıza = `ai_consent_at NOT NULL` ve `version >= 1`; yazma `.eq('auth_id')`, **0 satır = başarı değil**. Ret yalnız oturum belleğinde; Mood Search kotadan önce sorar; film detayda otomatik `explain-match` yerine CTA; Ayarlar'da "AI önerileri" anahtarı. LLM gövdelerinde e-posta/hesap kimliği yok (4 gövde okundu); gönderilen profil `TasteProfile` (mood), `preferences_vector` değil. **Sunucu zorlaması yok** (§9, TEKNIK_BORC). **Migration numarası olayı:** uzakta 130 (`subscriptions_environment`) zaten uygulanmıştı → rıza 131; 130 dosyası yalnız dosya düzeyinde takibe alındı. `CLAUDE.md` "Serbest metin girdisi yok" ifadesi gerçeğe uyduruldu (Pro Mode istisnası), numaralandırma kuralı uzak dahil olacak şekilde güncellendi. Kod dalda (`fix/ai-consent`: `d0d88fc`, `9dc9b54`, `914f630`, `d78135d`, `439c525`), push/OTA yok, cihaz doğrulaması açık. Doğrulama: `typecheck` 14/14 baseline, i18n 1458/1458 parite, `lint:all` temiz. **(2) E-27 — Sign in with Apple token revoke (R-3, CTO onaylı).** Hesap silmede Apple token revoke yoktu (E-20'nin "5.1.1(v) karşılanıyor" cümlesi kısmen geçersiz ilan edildi, silinmedi). Karar: token saklanmaz/migration yok; silme anında yeniden doğrulama → `authorizationCode` → sunucuda code → refresh_token → `sub` eşleştirme → revoke. Revoke hatası silmeyi engellemez (Sentry `APPLE_*` kodları); kullanıcı Apple ekranını iptal ederse silme iptal. `APPLE_CLIENT_ID` = bundle id. Uygulama `9f4231c` `af02ed3` `9f3d22a`; `test:apple-revoke` 18/18, tsc 14, functions 32. Deploy edilmedi, `APPLE_*` secret'ları yok (ölçüldü). §9'a iki madde. **(3) E-28 — RevenueCat sıralaması: hazırlık sinyalleri (R-2, CTO kararları, yeni §5 E-28).** REACT-NATIVE-7 (45 olay · 4 kullanıcı) ve CHOSY-EDGE-FUNCTIONS-14 (3 olay) için: `rcReady` + `identityReady` sinyalleri; kimlik değişiminde sinyal yeniden kurulur, bekleyen geçişte deferred değişmez, yalnız son hedef için resolve; `addSubscriptionListener` configure'ı bekler (30 sn); `identifyUser` configure'ı bekler (yeni kurulum yarışı kapsama alındı); `restorePurchases` + `purchasePackage` anonim RC kimliğinde başlamaz, yeni `PurchaseErrorKind` `'not_ready'` + `errors.accountNotReady`. **R-21:** `initializePurchases`'ı `getSession`'dan öne almak reddedildi (fazladan `$RCAnonymousID` TRANSFER). §9'a `PaywallBase` çift yazma yolu borcu eklendi. İkinci-TRANSFER yokluğu ve soğuk açılış sırası **çıkarım/cihazda doğrulanmadı** olarak kayıtlı. **R-2 ek kapsamı:** `getOfferings` / `getSubscriptionStatus` / `getTrialEligibility` `whenRcReady(10 sn)` bekler; timeout'ta `RC_READY_TIMEOUT`, mevcut dönüşler korunur. Kod `5f88bc8`…`114258a`; push/OTA yok. |
| 1.46 | 7 Eki 2026 | **Watch-feedback T1 kararları (CTO).** (1) **K-29:** `disliked` additive eklendi ("Not for me"); `abandoned` legacy davranış sinyali olarak kalır, yeni UI'dan çıkar. `types/gauntlet.ts` salt-ekleme değişikliği onaylandı. (2) Not yet / Skip persistence'ı değişmedi; Not yet follow-up'ı backlog'da (hipotez, eşik ≈ %30). (3) `UNIQUE (user_id, gauntlet_id)` önerisi geri çekildi. (4) `watched_other` T1b'ye ayrıldı. (5) **K-03:** watch-feedback Home state'inde tab bar görünür; Design OS §10.1'e not düşüldü, §10.5.2 / §10.5.9 / 13.08 satırlarına dokunulmadı — çelişki `TEKNIK_BORC.md`'ye kaydedildi. (6) `disliked` taste ağırlığı başlangıçta `abandoned` ile aynı (-3.0), `app_config`'ten ayarlanır. Bu kayıtta kod yok; uygulama T1 migration ve kodunda. |
| 1.45 | 6 Eki 2026 | **K-62 guardrail eşikleri + K-15 durum düzeltmesi (CTO kararı).** (1) **K-62:** v1.44 tetik eşiği tanımlamamıştı, guardrail ölçülse de ne zaman bakılacağı belirsizdi. Eşikler: medyan `latency_ms` ≤ 1750 ms ya da `low_confidence` ≥ %24,8 → **inceleme tetikleyicisi, otomatik alarm değil** (kullanıcı bazında dağılıma bakılır). Kapı: yayından sonra ≥ 14 gün ve ≥ 150 seçim, altında "yetersiz veri". Gerekçe: taban örneklemi küçük (27 seçim / 7 kullanıcı); kapı ve "alarm değil, dağılıma bak" şartı küçük örneklem gürültüsüne karar bağlamamak için. Taban yayın gününde yeniden ölçülür. (2) **K-15:** "KARAR VERİLDİ, UYGULANMADI" (v1.31) gerçekle çelişiyordu — yerel hatırlatıcı `e6e87be`'den (28 Eyl) beri kodda, P-5'te `copyVersion` ile metin değişiminde yeniden planlanıyor. Bible gerçeğe uyduruldu (D-12/D-13 emsali): ifade üstü çizildi, **cihaz doğrulaması bekliyor** (V1_TESTFLIGHT_CHECKLIST O7). Aynı bayat ifadeye E-22 tablosundaki K-15 satırında ve §9'daki K-15 satırında "geçersiz — bkz. K-15" notu düşüldü (silinmedi). Kod değişikliği yok. |
| 1.44 | 5 Eki 2026 | **K-62: Spotlight ritüelin ikinci yarısı (CTO kararı, P-5 Aşama 1).** Bekleyiş ekranında (`before_18`) bugünün karesi kilitli ve bulanık, dokunulamaz; metin "Bugünün karesi seni bekliyor. Dörtlünden sonra açılır." Akşam bildirimi gövdesinin ikinci cümlesi "Sonra bugünün karesi." oldu (tek push, D-02; yerel planlama, sunucu değişmedi). **Değişmeyenler:** K-05 (ayrı hub yok, tek giriş champion kartı) ve paywall kapısı yok. Not: brifte üstü çizilmesi istenen "dessert" ifadesi Product OS §7.1'de bulunamadı (`docs/os/` altında hiç geçmiyor); yalnız `SpotlightBonusCard` yorumunda vardı, orası güncellendi. Product OS §7.1'e K-62 satırı eklendi. Guardrail: `choice_events.latency_ms` medyanı + `low_confidence` oranı (taban CTO brifinden: 27 seçim / 7 kullanıcı, 2500 ms, %14,8). §9'a bir satır (kare erken iniyor). K-05 satırına not düşüldü. Edge Function, şema ve `askCoordinator` değişmedi. |
| 1.43 | 3 Eki 2026 | **Cron anahtarı ölçümü — üç §9 kalemi (P-1c keşfi, `docs/investigations/P1c_ADIM0_KESIF.md`).** Yeni karar YOK (K numarası tüketilmedi); ölçülmüş durum kaydı. (1) **Global slot 1 Eyl'den beri üretilmiyor** — `global-slot-daily` 401, son global satır 08-31; **K-46 arşivi degrade** (1 Eyl sonrası kaçırılan günler `unavailable`), K-46 satırına not düşüldü. (2) **`generate-gauntlet` global satırı okumuyor** — Product OS §6.9 "Slot 1 → GLOBAL" ile gerçek ayrışıyor; `global` yalnız etiket. Bible gerçeğe uyduruldu, karar algoritmik faza bırakıldı. (3) **`sync-trending` 31 Ağu'dan beri ölü** — son yeni film 08-31. Üçünün ortak kökü Vault `cron_service_role_key` (13 karakter, geçersiz); `cron.job_run_details` her koşumu `succeeded` yazdığı için bir ay görünmedi. Aynı turda (ayrı commit'ler): migration **124** (editoryal 33 filmin ham poster yolu), `generate-puzzles` ham-URL guard'ı (v54), `get-daily-challenge` kuyruk ≤5 Sentry uyarısı (v31), istemcide NO_PUZZLE ayrı durumu. |
| 1.42 | 3 Eki 2026 | **K-61: Spotlight kartı girişi ve fold (CTO kararı, S-2, K-05 detayı).** Kart champion ile aynı anda mount ediliyordu ve fold altında kalıyordu: 844pt'de kartın ancak %46'sı görünüyordu, K-60 dwell'i görünmeyen kartta sayabiliyordu. ~~Kart champion ile aynı anda mount edilir (V3-D6)~~ → **canlı finalde reveal'ın görsel bitişinden ~1000 ms sonra mount + 360 ms dissolve; resume ve Reduce Motion'da gecikmesiz/animasyonsuz; kart mount edilmeden dwell sayacı başlamaz.** Champion eylemleri: tek birincil (Watch Now ya da dolgulu Sonraya bırak) + 44pt ikon satırı (Sonraya bırak, Paylaş) — 844pt ve üstünde kart kaydırmadan tamamen görünür. Gerekçe: K-60 bonusun gerçekten görülmesine dayanıyor; hero (0.46) poster-first gereği küçültülmedi, bu yüzden ≤ 812pt'de dwell kaydırma sonrası (bilinçli taviz, §9). Event'ler `spotlight_card_viewed` · `spotlight_card_pressed`; `spotlight_started/completed` eklenmedi, `game_daily_opened` / `game_daily_completed` (`game_id`) kullanılır. K-05, K-60 ve V3-D6 satırlarına not düşüldü (silinmedi). Commit'ler `9457185` · `4ed069c` · `9378ff1` (ArchiveTrigger boş catch'i). Cihaz doğrulaması V1_TESTFLIGHT_CHECKLIST §N. |
| 1.41 | 3 Eki 2026 | **K-60: champion sonrası ask sırası (CTO kararı, S-1).** AuthPromptSheet reveal'dan 1800 ms sonra açılıp Spotlight kartını (K-05) örtüyordu; kullanıcı bonusu hiç görmüyordu. ~~Auth önce, "Not now" ömür boyu tek gösterim (R-A-2, 22 Ağu 2026)~~ → **champion oturumunda tek modal ask, günde en fazla bir. Gün 1 bildirim izni, gün 2+ auth (3 gün cooldown, en fazla 3 gösterim). Spotlight sonrası ya da kart dwell'inde tetiklenir, Spotlight yarıdayken ask yok.** Gerekçe: hiçbir ask bonusu örtmez, değer verilmeden izin istenmez. **K-13** açıklaması değişti: ~~"Your streak and …"~~ → "Every night's pick and your watchlist stay saved here …". Gerekçe: kodda gauntlet streak yok. v1.24'teki "taste profile" metni canlı metinle de uyuşmuyordu, düzeltildi. **K-15**'e K-60 referansı düşüldü. **R-A-2 `_layout` push çağrısı kapandı:** `registerForPushNotifications` artık `_layout`'tan çağrılmıyor (`app/_layout.tsx:680-684`), tek istek yüzeyleri champion sheet'i ve `before_18` CTA'sı. R-A-1 ve R-A-2 cihaz testi J3'te açık kalıyor. §9'a iki satır eklendi (eski "Not now" kohortu, `isPermissionGranted` fail-open). Commit'ler: `1d49d4d` · `70ef249` · `7f645e7`. |
| 1.40 | 3 Eki 2026 | **Sprint 10b — `app_config` okuması 5 dk TTL'li tek kaynağa taşındı; Claude Code OS Kural 6 değişti (CTO kararı).** Soğuk açılışta 3 eşzamanlı `app_config` isteği vardı (ort 1,1 sn, p95 18 sn). ~~"`app_config` değerleri istek başına lazy okunur, modül seviyesinde cache yok"~~ → **"`services/remoteConfig.ts` 5 dk TTL'li tek kaynaktır (bellek + AsyncStorage, tek `select key, value`, eşzamanlı çağrılar tek-uçuş)."** Bayrak değişikliği **en geç 5 dk'da yansır**; bunlar **özellik bayrağıdır, güvenlik bayrağı değil** (yetki sunucuda). AppState `active`'e dönüşte TTL dolduysa yenilenir. Okuma hatasında **eski önbellek korunur** (stale-while-error); önbellek yoksa okuyucunun yazılı varsayılanı AYNEN geçerli: `gauntlet_context_bar_enabled` yok/hata = **gizli** (v1.38 / K-18), `discover_tab_enabled` yok/hata = kapalı, `games_enabled.roulette` yok/hata = kapalı, `dna_config`/`games_enabled.games` yok/hata = null. Hata Sentry'ye, kullanıcıya metin yok. Kural 5 (lazy getter, modül seviyesi sabit yasak) **değişmedi**. Etkilenen belgeler: `CLAUDE.md` kural 6, `chosy-conventions` §2, `4_CLAUDE_CODE_OS` standart kısıt bloğu. |
| 1.39 | 3 Eki 2026 | **Bekleyiş afişi film detayına gidiyor — E-24 "kart dokunulamaz" maddesi yalnız afiş için değişti (kurucu kararı, bkz. §5 E-24.1).** E-24'te ~~"kart dokunulamaz, rota yok"~~ üstü çizildi (silinmedi); gerekçe: kullanıcı son seçtiği filmin detayına ulaşabilmeli. Afiş → `/film/<champion_film_id>`, `accessibilityRole="button"`, `gauntlet.waitingChampionOpen`, `hapticLight`, PostHog `champion_poster_tapped` (`screen: 'waiting'`, `film_id` yok). Sayaç / etiket / geri sayım / K-46 yasakları değişmedi. Detay ekranında Pro Mode/arşiv/benzer film/keşif çıkışı yok (taranıp raporlandı). `LastChampion`'a `filmId` eklendi (salt okuma). Doğrulama: typecheck 14, functions 32, i18n parite. Cihaz doğrulaması TestFlight/OTA. |
| 1.38 | 3 Eki 2026 | **K-18 — Context bar varsayılan gizli (Sprint 4 / 4c, CTO talimatı).** Bağlam düzeltmesi henüz bir tahmin modelini beslemiyor; editördeki "yarının tahminini iyileştirir" notu doğrulanamaz bir iddia ve kontrol etkisiz. `ContextBar`, `app_config.gauntlet_context_bar_enabled` bayrağının arkasına alındı; varsayılan **gizli** (satır yok = gizli; okuma hatası Sentry'ye düşer, yine gizli). Kod silinmedi, bayrak `true` olunca çubuk geri gelir. K-18'de yalnız "Context bar" ifadesi üstü çizildi (satır silinmedi); Round indicator ve "Choose one" aynen geçerli. Yeniden açma koşulu: "Faz 1: bağlam tahmin modeli gelince". Bayrak satırı seed EDİLMEDİ (migration ayrı DUR işi, bkz. TEKNIK_BORC). |
| 1.37 | 2 Eki 2026 | **R-20 — ~~Editoryal gün yenileme kilidi~~ kaldırıldı (CTO Karar 2a).** Editoryal dörtlü = başlangıç dörtlüsü; `submit-choice` editoryal guard'ı (`refreshBlockedReason: 'editorial_day'`) silindi, `neither`/`seen` normal boru hattından yenilenir. `generate-gauntlet` DAL A'ya watched-dışlaması eklendi: izlenen editoryal film aynı pozisyonda normal havuzdan yedeklenir. Gerekçe: G-5 ölçümü kilidi değil ürünü ölçmeli; §6.9 Slot-1 global ortak zemini zaten sağlıyor. E-19.1'in K-23 maddesi, watched-dışlama kararı ve §9 yedek kulübesi satırına "geçersiz — bkz. R-20" notu düşüldü (silinmedi). İstemci `editorial_day` yolu + `gauntlet.editorialNoRefresh` geriye dönük uyum için korunuyor (`TEKNIK_BORC.md`). |
| 1.36 | 2 Eki 2026 | **B-1 / Fix 8 — Spotlight yerleşim kararları (CTO yazılı onayı, keşif raporundaki 4 karar).** (1) **Design OS Kural 7 ("tek sayfa, ScrollView YOK") için Spotlight'a özel istisna:** oynanış ekranının **yalnız üst bölgesi** (kare + başlık maskesi) kendi içinde kayar; harf klavyesi + arama alanı (aksiyon barı) dipte sabit, sistem klavyesi açıkken klavyenin hemen üstünde. Gerekçe: açık klavye + uzun başlık — ölçüm iPhone SE'de klavye açıkken kısa başlıkta bile ~158px, 37 karakterlik başlıkta klavye kapalıyken ~106px taşma; taşma aksiyon barını ekran dışına itiyordu. İstisna **diğer oyunlara genişlemez** (aramalı 5 donmuş oyun aynı risk sınıfında, `TEKNIK_BORC.md`'ye yazıldı). (2) Başlık maskesi kelime bütünlüğünü korur (satır kelimeler arasında kırılır); slot boyutu 2 satıra sığmak için **0.8'e** kadar küçülür, daha uzun başlık 3+ satırla kayan bölgede kalır. (3) **Sabit kutulu metinlerde `maxFontSizeMultiplier` 1.3** (tuş · slot · input) — token `Theme.fontScale.fixedBoxMax`; etiket/gövde tam ölçeklenir (K-54 korunur). K-55 satırına not. (4) `gameService.searchFilms`'in `catch {}`'i Sentry'ye raporluyor (davranış aynı, `[]`): aynı hata türü 60 sn'de en fazla bir capture, gerisi breadcrumb; çevrimdışıyken capture yok. Kullanıcıya hata metni yok (K-43). Oyun mantığı ve puanlama değişmedi. |
| 1.35 | 30 Eyl 2026 | **Spotlight içerik sürekliliği** (bkz. yeni §5 **E-25**, kurucu kararları, AskUserQuestion). Spotlight 11 Ağu'dan beri bulmacasızdı (cron yoktu). Çözüm havuzu 100 günlük editoryal takvim, her günden bir film, 100. günden geriye; genel havuza sessiz düşüş yok. Migration **119** (`daily_puzzles.date` NULL — acil havuz hiçbir oyunda hiç çalışmamıştı) ve **120** (haftalık `generate-puzzles-spotlight` cron'u; ön koşul Vault anahtarının canlandırılması). Uygulama `1adc164` `7a281bd` `320e2c5` `6bfaea7`. |
| 1.34 | 30 Eyl 2026 | **Bekleyiş ekranında son şampiyon — V1-D7 kısmen geri alındı** (bkz. yeni §5 **E-24**, kurucu kararı, AskUserQuestion). Tam ekran bulanık perde + sayacın altında afiş · "Your last pick" · film adı; veri `getLastChampion` (RLS tablo okuması), tarih filtresi yok. Kart dokunulamaz, rota yok; K-46 ve V1-D7'nin arşiv/Pro Mode/keşif yasağı aynen geçerli. "before_18'de ağ çağrısı yok" → "`generate-gauntlet` çağrılmaz" olarak daraldı (E-21.1 satırına not). Uygulama `3b197ee`. |
| 1.33 | 30 Eyl 2026 | **Cinema DNA v1'de gizli, DNA vaadi çıkarıldı (CTO kararı).** Keşif `cf97732`: kart `cinema_dna` okumuyor, `recompute-taste-vector` tetiklenmiyor, D-06 eşiğini karşılayan kullanıcı yok. **K-47** Identity değeri ~~"See how your taste evolves"~~ → **"Pick your champion on your own time"** (gerekçe: özellik v1'de yok; üstü çizildi, silinmedi). Aynı gerekçeyle `profile.chosyProSubtitle` → "Replay the evenings you missed · last 7 days" ve `contextPaywall.moodHistorySubtitle` → "Replay any evening you missed in the last 7 days." (arşiv penceresi 7 gün, `get-archive-status`). Metinler AskUserQuestion ile onaylı. **K-46 ekine** durum notu: `mood_history` girişi kart gizli olduğu için fiilen kapalı, tetikleme kodu değişmedi. **K-08** ve **K-32** satırlarına sapma notu; §9'a K-32 boru hattı satırı. |
| 1.32 | 28 Eyl 2026 | **V-3 gauntlet + şampiyon görsel retrofiti kaydı** (bkz. yeni §5 **E-23**). Sprint kararları **V3-D1…V3-D7** ayrı ad uzayında: serif yalnız film adında (`filmTitle`) · altın yalnız ödül katmanında, Watch Now düz `marquee` · Watch Now = TMDB bölge `link`'i, uygulama içi tarayıcı · %60 poster hero + `ink` geçişi · en fazla 3 logo + "See all" · Spotlight kaydırma sonunda · Home tab ikonu film. **V3-D1, V1-D10'u kısmen geri aldı** (gerekçe: kurucu referans tasarımı, serif yalnızca film adı) — V1-D10 satırında üstü çizildi. **v1.23 kısmen geçersiz** (link, logo sayısı, birincil eylem) — v1.23 satırı ve §7.1 Champion/Where to Watch satırlarına not (CTO onayı, AskUserQuestion). §9 sağlayıcı talebi satırına not, madde açık. Design OS §3/§4 notları. Doğrulama: typecheck 14, functions 32, i18n 1387/1387, tüm Deno testleri yeşil (e2e-api hariç, prod'a yazar). Kod değişikliği yok. |
| 1.31 | 28 Eyl 2026 | **V-1 Design OS uyum sprinti kaydı** (bkz. yeni §5 **E-22**). Sprint karar numaraları **V1-Dn** olarak ayrı ad uzayına alındı (§3 D-xx ile karışmasın). Repoda izi olan **V1-D3, D6, D7, D8, D9, D10, D11** işlendi; **V1-D1, D2, D4, D5** metni CTO oturumunda, bible'a işlenmedi (uydurulmadı). Sapmalar: **K-08** Streak ertelendi (streak verisi gauntlet'ten beslenmiyor) · **K-31** Pro Mode mood grid istisnası (kurucu kararı) · **K-15** bildirim cihazda yerel planlanır — **karar verildi, uygulanmadı** · sprint v1'deki "Chosy Pro" görünen ad maddesi **iptal**, ad "Chosy Plus" (K-46 notundaki metin düzeltildi) · Day-0 Seçenek A yerine **E-21 — UYGULANDI** (v1.30, durum teyit edildi). §9'a iki satır. Doğrulama: typecheck 14, functions 32, i18n 1367/1367, deno testleri yeşil. Kod değişikliği yok. |
| 1.30 | 27 Eyl 2026 | **E-21 uygulandı** (bkz. yeni §5 **E-21.1**). Migration **118** (`daily_gauntlets.cycle`, DUR onaylı) · sözleşmeye salt ekleme (`GauntletCycle`, `PreviousCycleRejectCode`, 409) · `generate-gauntlet` v34 + `get-archive-status` v12 canlı, indirilen kod repo ile birebir. **`PREVIOUS_CYCLE_OUT_OF_WINDOW` anlamı genişletildi (CTO onaylı):** launch öncesi + 18:00 kapısı açık + yaz saati çakışması (yeni bulgu: Chicago/Winnipeg). Previous isteğine hiçbir zaman current gauntlet dönmez. Anahtar = dün yerel 18:00'in UTC tarihi. "18:00'e kadar şampiyon" inceltildi: reveal yalnız o oturumda, yeniden açılışta `before_18`. Arşiv önceki döngü satırını saymaz (anchor +1). `choice_events`'te `date` kolonu olmadığı kayda geçti (tarih join ile). Kanıt: birim 27+25, canlı 21/21. İstemci TestFlight bekliyor → §9. `v_algorithm_daily` kirliliği `TEKNIK_BORC.md`'ye. |
| 1.29 | 27 Eyl 2026 | **Ücretli tierlarda Pro Mode araması sınırsız (CTO kararı) + Plus adlandırması + Profile çift başlık.** Migration **117** canlıda: `subscription_limits.daily_search_limit` monthly/annual/lifetime **-1** (önceki 15/25/50 — BM v2'nin emekli ettiği kota modelinin kalıntısı; ücretli abone 429 alıyordu). free 3 ve weekly_legacy 14 değişmedi. İstemci: `TIER_LIMITS` senkron, `quotaEngine` -1 eşlemesi, "N left today" sınırsızda gizli (`b24e77c`). migration-guard: bloke edici yok; canlı CHECK yok, 115 canlıda doğrulandı. `schedule-notifications` `limit !== -1` korumasıyla deploy edildi — ⚠️ **fonksiyonun ilk deploy'u (v1)**, daha önce canlıda yoktu; cron'u yok, çağıranı yok, çağıran doğrulaması yok (ayrı karar bekliyor). i18n: Chosy Pro → Chosy Plus (3 metin), `profile.proSection` → Membership/Üyelik (`904e157`). Profile: DiscoveryStats + TasteDNA çift başlık kaldırıldı (`49c9d36`). §9'a iki R-D kalemi: weekly_legacy kararı · free slot limiti 8↔100. Doğrulama: typecheck 14/14, functions 32/32, i18n 1367/1367. |
| 1.28 | 27 Eyl 2026 | **E-21 — yeni kullanıcıya önceki döngü: karar verildi, uygulanmadı.** Sıfır kişisel satırı olan kullanıcı 18:00 öncesi etkin döngünün gauntlet'ini görür. PRODUCT_OS §3.6 ve D-12 (`waiting` satırına not düşüldü) yalnız bu kohort için istisna alır. Alt kararlar: `cycle:'previous'` + iki açık ret kodu · anahtar isteğin `timezone` alanından hesaplanır, `users.timezone` kullanılmaz (ölçüm: gerçek değer 12/270, %4,4) · satır önceki döngünün tarihiyle yazılır · 18:00 geçişinde nabız `bootstrapping`'e geçer · "Dün izledin mi?" tuhaflığı kabul edilen istisna. Build 903'e girmez, ayrı oturumda uygulanacak. §9'a R-D kalemi: UTC anahtar ↔ yerel ritüel ayrışması. ⚠️ CTO'nun "İstanbul 00:00–03:00 bug'ı" tespiti **düzeltildi**: o pencerede `before_18` §3.6 gereği doğru. Ölçülen gerçek etki UTC− bölgelerinde: anahtar New York'ta 20:00'de dönüyor, K-42 önbelleği yanlış stale uyarısı veriyor. `none -> before_18` sayımı ölçülemedi (Sentry erişimi yok, telemetri yeni build'le gelir). Kod değişikliği yok. |
| 1.27 | 27 Eyl 2026 | **Build öncesi keşif bulguları** (`docs/investigations/BUILD_ONCESI_GAUNTLET_KESIF.md`). **P0-1 sahada yaşandı — kesinleşti:** "gauntlet yok dedi → geldi" TestFlight production build 902'de (P0-1 içermiyor) bağlantı-geri-geldi (T3) yoluydu; cihazın gauntlet'i 15:58 yerel saatte üretilmiş. "Çıktı, tekrar girdi" muhtemelen kullanıcının kendi çıkışı — **doğrulanmadı**. Gün 9 canlıda yeniden teyit edildi (`v1-editorial-calendar`, id + sıra birebir), test kimliği K-16 sırasıyla silindi. B5 saha telemetrisi `85ffafd` (yalnız breadcrumb: `gauntlet.state` + `network.status`). Takvim bütünlüğü ölçüldü: 100 gün × 4, 400 benzersiz film, tema/hafta günü 100/100. §9 P0-1 satırına not; §9'a iki R-D kalemi: resume'de finalist prefetch yok (B9) · soğuk açılış 3,5 sn sabit splash + `generate-gauntlet` tek ölçüm 5096 ms, toplam ~8,5 sn olabilir (B10). Doğrulama: `typecheck` 14/14, `typecheck:functions` 32/32 baseline. |
| 1.26 | 26 Eyl 2026 | **v1.1.0 risk değerlendirmesi kapandı + mevcut kullanıcı köprü aksiyonları v1 dışı (R-19).** CTO kararı: "Chosy değişti" köprü ekranı, 63 kişiye kurucu mesajı ve **G-9 kapısı** kapatıldı, ikame yok. Gerekçe ölçüldü: 1 Eyl öncesi 253 hesabın 192'sinde sıfır etkileşim, ≥7 aktif gün yalnız 2. CTO gerekçesindeki "22 kayıttan 12'si" yalnız Eylül kohortuydu, tam taban ölçümüyle değiştirildi. §7.4 dokuz eşikten **sekize** indi; **K-52'nin 6 release gate'i etkilenmedi**. E-05, §6 (iki satır), §7.4, §8 R-A/R-D ve §9 orphan satırı işaretlendi (üstü çizildi, silinmedi). Köprü ekranı kodda zaten uygulanmıştı (`1d2a66f`) → yönlendirmenin kapatılması §9'a ayrı kod işi. §9 ekleri: rulet slot ek-spin kırığı (dokunulmayacak, C.6 ile gider) · v1.1.0 kırık mı → **KAPANDI, kırık değil** · 1–25 Eyl `daily_gauntlets` kişisel taraf **AÇIKLANDI** (tüm gerçek kullanıcılar gauntlet'siz v1.1.0 build 31'de), global cron kök nedeni kaydedildi (Vault anahtarı kayıtsız). Kod değişikliği yok. |
| 1.25 | 26 Eyl 2026 | **E-19 nihayet deploy edildi + P0-1 düzeltmesi.** Deploy öncesi canlı kaynak kodla repo karşılaştırıldı: paylaşılan dosyalar aynı, farklar E-19 + tek bir dış commit `8705931` (poster normalizasyonu, CTO onayıyla dahil). Canlı ölçümde takvim 100 gün / 400 film, `launch_date = 2026-09-18`. Deploy: generate-gauntlet v33, submit-choice v32. Canlı doğrulama geçti: 9. gün `epic`, `v1-editorial-calendar`, film sırası birebir aynı; test kimliği K-16 cascade sırasıyla silindi. **E-19.1'e düzeltme notu:** "prod'a alındı" yalnız DB katmanı için doğruydu, fonksiyonlar 19–26 Eyl arası deploy edilmemişti (silinmedi, not düşüldü). §9'daki "E-19 canlı tetikleme" satırı **kısmen kapandı** (guard + cihaz akışı açık). **P0-1** (`3fd787f`): bağlantı-geri-geldi tetikleyicisi 18:00 kapısına uyuyor. Cihaz testi kısıtı §9'a yazıldı (e2e deep link build'lerinde kapı yok → TestFlight + 18:00 öncesi + elle uçak modu). §9'a R-D kalemi: `daily_gauntlets` 1–25 Eyl arası 0 satır, global cron 31 Ağu'dan beri sessiz. Doğrulama: `typecheck` 14/14, `typecheck:functions` 32/32 baseline. |
| 1.24 | 26 Eyl 2026 | **Auth ekranı — email girişi UI'dan kaldırıldı, üyelik mesajı değişti.** `AuthPromptSheet` ve `app/auth.tsx`'ten `MagicLinkForm` çağrısı, "or" ayracı, klavye sarmalayıcısı ve ölü stiller söküldü; yalnız Apple + "Not now" kaldı. Apple hata satırı korundu (kural 1). Magic-link altyapısı (`MagicLinkForm`, `sendMagicLink`, `verifyMagicLinkCode`) **silinmedi**, uyuyan hâlde. `authPrompt.title/body` yeni metin (en/tr), kullanılmayan `authPrompt.or` silindi. **K-13** (metin) ve **K-14** (email sağlayıcı) satırlarına not düşüldü (silinmedi). **Android doğrulaması:** Apple yalnız iOS'ta render ediliyor → Android'de giriş yolu yok; v1 iOS-only (R-15 kapalı, §7.3 donmuş listede, `eas.json`'da preview/store submit yalnız iOS, production'da Android yalnız `internal` track) → canlı risk değil, R-15'e ön koşul notu düşüldü. §9'a R-D kalemi: `auth.tsx` kalıntıları. Doğrulama: `typecheck` 14/14 baseline (hepsi `scripts/`), i18n 1367/1367 parite, aktif kodda kaldırılan UI'a 0 referans. Kod commit'i: `f3610ad`. |
| 1.23 | 26 Eyl 2026 | **Şampiyon ekranı Where-to-watch — tıklanabilir TMDB linki kaldırıldı, logo satırına çevrildi.** TestFlight 2.1.0 cihaz testi: logolar sağlayıcıya değil TMDB'nin toplu "nerede izlenir" sayfasına gidiyordu (her logoda aynı adres). `WatchProvidersSheet` + `Linking.openURL` + `TmdbWatchProviders.link` silindi; yerine dokunulmaz `WatchProvidersRow` (36pt, en fazla 6 logo, isim yok) + "Availability from TMDB · JustWatch" atfı (yalnız logo varken). **Birincil eylem her durumda "Sonraya bırak"**; hata durumunda "Tekrar dene" sessiz bağlantı. GauntletShell'deki sheet-sıralama kodu (`watchSheetOpen`) temizlendi. Veri akışı (`useWatchProviders`, cihaz bölgesi, prefetch) değişmedi. K-20'nin üç ayağı korunuyor; **`provider_clicked` artık gönderilmiyor** → R-03 ve R-06'ya not düşüldü (silinmedi), talep ölçümü §9'a açık borç olarak eklendi. §7.1 Champion ve Where to Watch satırları gerçeğe uyduruldu (üstü çizildi, silinmedi). Commit: `ce4ff2a`. ⚠️ **Kısmen geçersiz — bkz. E-23 V3-D3/V3-D5, 28 Eyl 2026 (v1.32):** ~~`TmdbWatchProviders.link` silindi~~ (tipe geri eklendi, Watch Now butonunda) · ~~en fazla 6 logo~~ (3 + "See all" sheet'i) · ~~Birincil eylem her durumda "Sonraya bırak"~~ (Watch Now varsa o birincil). Logoların dokunulmazlığı ve `provider_clicked`'in gönderilmemesi **geçerli**. |
| 1.22 | 26 Eyl 2026 | **Ölü paywall varyantlarının temizliği — A grubu uygulandı, B grubu netleştirildi.** K-46 ekinin *"beşi de ölü"* tespiti **fazla geniş** ilan edildi (üstü çizildi, silinmedi — D-12/D-13 emsali): beş aday **3 A + 2 B** olarak sınıflandırıldı. **A:** `watchlist_full` (emitter yok, flag'i de yoktu), `roulette_limit` (üç kat kapalı + Product OS §436 "kaldırılacak"), `streak_milestone` (tek dolaylı yolu dondurulmuş 4 oyun) → bileşenler `components/paywalls/_archive/` altına taşındı, orphan tipler/mapping'ler/0-çağıranlı helper'lar (`isWatchlistFull`, `isStreakMilestone`) ve `paywall_streak_v1` A/B deneyi kaldırıldı; `roulette_limit`+`streak_milestone` **minimum dokunuşla** kapatıldı, `app/roulette.tsx` ve dondurulmuş oyun kodu değişmedi. **B:** `streaming_link` (BM §4 Katman 2 → §8 **Faz 1** affiliate) ve `lifetime_soldout` (BM §5 + §9 → **R-E**) **planlı**, dokunulmadı; fazları bible'a yazıldı. §9'a üç yeni kalem: `app/lifetime.tsx` ekranına **navigasyon girişi yok** (R-E'nin ikinci ön koşulu) · `test:founder` **3/5** ölçüyor, 17 Ağu'dan beri süren **kota kısıtı** (`parse-mood` 429), ürün regresyonu değil · `health-check` skill'indeki "5 case yeşil" beklentisi **bayat** (ayrı iş). Doğrulama: `typecheck` 14/14 baseline (hepsi `scripts/`), `typecheck:functions` 32/32 baseline, grep taramasında aktif kodda 0 referans. Kod commit'i: `67e3e52`. |
| 1.21 | 26 Eyl 2026 | **E-20.1 — K-16 canlı doğrulama kanıtı, zincir KAPALI.** `delete-account` **v26** deploy'u üzerinde iki senaryo koşuldu ve dört kanıt toplandı: (1) **DB cascade** (test 1, normal kullanıcı) — `auth.users` / `public.users` / `subscriptions` / `watchlist` hepsi **0 satır**, E-20'nin FK envanteri canlıda teyit edildi; (2) **PostHog silme** — silme sonrası persons API curl'ü **`{"results":[]}`**, yani kişi + event geçmişi gerçekten silinmiş (dış sistemden okunan doğrudan kanıt, response alanı değil); (3) **`auth_only` dalı** (test 2, public satırı olmayan kullanıcı) — Sentry `fatal` / `step=auth_only` event'i 12:21'de, dal doğru tetiklendi ve anomali sessiz kalmadı; (4) **`posthog_lookup` davranış ayrımı** — test 2'de `info` / `step=posthog_lookup` (tek üretici kod yolu `index.ts:113` = "kişi bulunamadı"), test 1'de bu event yok çünkü başarılı silme yolu event yazmaz. "Test 1'de event yok" ifadesi **dolaylı** gözlem olarak işaretlendi, doğrudan kanıt curl'dür (`sentry.ts:23`: DSN yoksa capture sessizce atlanır → event yokluğu hata yokluğu değildir). §9'daki **PostHog secret'ları kurulmadı** kalemi KAPANDI olarak işaretlendi (üstü çizildi, silinmedi). §2 K-16 satırı ✅ KAPALI. §9'da R-D'ye bağlı iki E-20 kalemi (`game_scores` FK'siz, `auth.tsx:96-105` kimlik uzayı uyuşmazlığı) **açık kalır** — K-16'ya bağlı değiller. Kod değişikliği yok, bu tur yalnız karar kaydıdır. |
| 1.20 | 25 Eyl 2026 | **E-20 — K-16 hesap silme denetimi + analytics identity ayağı uygulandı.** Keşif: akış zaten vardı ve App Store 5.1.1(v) şartını karşılıyordu; ön teşhis "subscriptions/notification_log ayakta kalıyor" **geçersiz ilan edildi** (üstü çizildi, silinmedi — D-12/D-13 emsali): canlı FK envanteri ölçüldü, `public.users`'a bağlı 26 FK'nin biri hariç hepsi CASCADE ve akış public'i önce siliyor. Gerçek açık üç noktaydı: (1) `auth_only` dalı `.single()`'ın **her** hatasını "kullanıcı yok" sayıp sessizce başarı dönüyordu → PGRST116 ayrıştırıldı, diğer hatalarda hiçbir şey silinmiyor, gerçek "satır yok" dalında auth silinip fatal Sentry yazılıyor; dalın `success:false` dönmesi **CTO kararıyla reddedildi** (token ölünce retry imkânsız, 15 auth-only kullanıcı hesabını silemez hâle gelirdi). (2) K-16'nın **analytics identity** ayağı hiç uygulanmamıştı — `delete-account` artık PostHog kişisini + event geçmişini siliyor (`delete_events=true`), başarısızlık fatal Sentry ama hesap silme yine başarılı (asıl veri gitmiştir). (3) Tüm `console.warn`/`console.error` → `sentryCapture` (kural 1). Doğrulama: `deno check` temiz, `typecheck` 14/14 baseline, `typecheck:functions` 32/32 baseline. §9'a üç madde: `game_scores` FK'siz + 12 orphan satır (R-D) · PostHog secret'larının (`POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`) kurulup redeploy edilmesi — ölçüldü, **ikisi de yok**, mevcut `POSTHOG_API_KEY` proje yazma anahtarıyla aynı digest'te · `auth.tsx:96-105` kimlik uzayı uyuşmazlığı (R-D, bu turda dokunulmadı). |

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
