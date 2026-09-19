# G-6 — Çekirdek Event Listesi (20/20)

> **Sürüm:** 1.0 · **Tarih:** 31 Ağustos 2026
> **Kapı:** `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` §7.2 G-6 — "PostHog çekirdek
> eventleri doğrulanmış: 20/20"
>
> Bu doküman, G-6 kapısının **hangi 20 event'i** kastettiğini tanımlar. Bugüne
> kadar böyle bir liste yoktu: bible "20/20" diyordu, kod tabanında 93 farklı
> event adı vardı ve hangisinin çekirdek olduğunu söyleyen bir sözleşme yoktu.
> Kapı bu belge olmadan geçilemezdi çünkü neyin doğrulanacağı tanımsızdı.

---

## 0. Envanterin bugünkü hâli

| Ölçüm | Değer |
|---|---:|
| Repo genelinde farklı PostHog event adı | **93** |
| Çekirdek (bu listedeki) | **20** |
| Çekirdek dışı | 73 |

**Merkezi bir event sözlüğü YOKTUR.** Her event adı çağrı yerinde string
literal olarak yaşıyor; `services/posthog.ts` yalnızca ince bir SDK
sarmalayıcı (`track(eventName: string, …)`) ve tip kısıtı uygulamıyor — yani
bir yazım hatası derlemede yakalanmaz. Bu bilinçli olarak bu turda
değiştirilmedi (93 çağrı yerini tiplemek ayrı bir iş), ama G-6 doğrulaması
sırasında **event adları bu dosyadan kopyalanarak** aranmalı, hafızadan
yazılarak değil.

⚠️ Karıştırmayın: `services/analytics.ts` **ayrı ve ilgisiz** bir sistemdir.
Kendi `AnalyticsEvent` union'ı (11 slot/mood event'i) vardır ama PostHog'a
değil Supabase `roulette_picks` tablosuna yazar; tek çağıranı
`app/roulette.tsx`. G-6 kapsamında değildir.

---

## 1. Çekirdek 20

Liste dört soruya cevap verecek şekilde seçildi: **North Star** (Daily Gauntlet
Completion), **Product Truth** (Watched-it Rate), **aktivasyon köprüsü** (K-20)
ve **para funnel'ı** (E-09). Bir event yalnızca bu dördünden birini ölçüyorsa
listeye girdi.

### 1.1 Ritüel — North Star (5)

| # | Event | Nerede | Taşıdığı alanlar |
|---|---|---|---|
| 1 | `gauntlet_viewed` | `GauntletShell:248` | — |
| 2 | `gauntlet_started` | `GauntletShell:336` | gauntlet_id, algorithm_version |
| 3 | `choice_submitted` | `GauntletShell:597` | round, outcome, latency |
| 4 | `gauntlet_completed` | `GauntletShell:681` | **North Star'ın kendisi** |
| 5 | `choice_rejected` | `GauntletShell:745` | K-28 candidate quality teşhisi (R-02) |

`champion_revealed` (`GauntletShell:686`) bilinçli olarak listede DEĞİL:
`gauntlet_completed` ile aynı anda ve aynı koşulda ateşleniyor, ikisini birden
kapıya koymak 20 kontenjanının birini boşa harcardı. Event kodda kalıyor.

### 1.2 Watched-it Rate — Product Truth (3)

| # | Event | Nerede | Not |
|---|---|---|---|
| 6 | `watched_prompted` | `PendingWatchFeedbackCard:53` | E-07'nin paydası |
| 7 | `watched_confirmed` | `PendingWatchFeedbackCard:38` | payı |
| 8 | `watched_not_yet` | `PendingWatchFeedbackCard:40` | payı (negatif dal) |

**E-07 kuralı:** yanıtlanma oranı = (6+7) / 5. Bu oran %50'nin altındaysa
Watched-it Rate istatistiksel olarak yorumlanamaz ve **ürün kararı alınmaz.**

### 1.3 Aktivasyon köprüsü — K-20 (2)

| # | Event | Nerede |
|---|---|---|
| 9 | `provider_clicked` | `WatchProviders:133` |
| 10 | `save_for_later` | `ChampionReveal:148` |

`provider_clicked` aynı zamanda R-03'ün (streaming filtresi) karar verisidir:
filtre ancak bu tıklamalar onu haklı çıkarırsa inşa edilir.

### 1.4 Kimlik ve dönüş (3)

| # | Event | Nerede | Not |
|---|---|---|---|
| 11 | `app_launched` | `_layout.tsx:241` | tüm oranların paydası |
| 12 | `auth_prompt_completed` | `AuthPromptSheet:71,101` · `auth.tsx:110` | R-A auth-after-champion |
| 13 | `notification_prompt_answered` | `NotificationPromptSheet:65` | K-15 tek günlük push |

`identity_reset_detected` (`_layout.tsx:323,482`) listede DEĞİL — E-08'in
sinyali ve **Sentry'ye de** yazılıyor, yani görünürlüğü PostHog kapısına bağlı
değil. Çekirdek dışı ama **izlenmeye devam ediyor.**

### 1.5 Arşiv — K-46 (1)

| # | Event | Nerede | Alanlar |
|---|---|---|---|
| 14 | `archive_viewed` | `app/archive.tsx:66` | missed_count, completed_count, eligible |

### 1.6 Para funnel'ı — E-09 (6)

E-09 bu altısını adıyla şart koşuyor; altısı da çekirdektedir.

| # | Event | Nerede | Alanlar | E-09 karşılığı |
|---|---|---|---|---|
| 15 | `paywall_triggered` | `triggerOrchestrator:~262` | trigger_type, variant, missed_day_count | aynen |
| 16 | `paywall_viewed` | `ContextualPaywall:45` | variant | aynen |
| 17 | `paywall_dismissed` | `triggerOrchestrator` (`recordPaywallDismissed`) | dismiss_method, variant, trigger_type | aynen |
| 18 | `purchase_started` | `purchaseService:415` | package_id, product_id | E-09'daki `purchase_initiated` |
| 19 | `purchase_completed` | `purchaseService:425` | package_id, product_id | aynen |
| 20 | `restore_attempted` | `purchaseService` (3 dal) | result: success / no_data / error | aynen |

**İki isim notu (ikisi de kapalı karar, 31 Ağu 2026):**

1. E-09 metni `purchase_initiated` diyor, kod `purchase_started` diyor. **Kod
   kazandı** — ödeme-kritik bir dosyayı yalnız isim tutarlılığı için
   değiştirmenin riski kazancından yüksek.
2. `paywall_triggered` Supabase `paywall_events` tablosuna **yazılmaz**: o
   tablonun `action` CHECK'i yalnız `shown|dismissed|converted|trial_started`
   kabul eder (023:14). Aynı bilgi `action='shown'` satırında
   `trigger_context.missedDayCount` ile duruyor. Veri kaybı yok, isim farkı var.

---

## 2. Çekirdek dışı 73 — neden dışarıda

| Grup | Adet | Gerekçe |
|---|---:|---|
| `game_*` | ~22 | Dondurulmuş 6 oyun (`app_config`). Kod silinmiyor, kapıya girmiyor. |
| `mood_*`, `discover_*` | ~10 | Emekli mood-search dönemi. Pro katmanına taşındı. |
| `*_debug`, `llm_rerank_*`, `keyword_boost_active`, `reranker_condition_check`, `quality_gate_applied`, `insufficient_results` | ~10 | Teşhis event'i — ürün metriği değil, algoritma iç gözlemi. |
| `feed_*` | 3 | Emekli swipe feed'i. |
| `referral_*`, `app_share_*`, `archetype_share_*` | 6 | R-11: growth motorları v1 sonrası. |
| Diğer (`ota_update_*`, `context_opened`, `dna_viewed`, `pro_mode_*`, `quota_exhausted`, `champion_revealed`, `restore_completed`, `purchase_cancelled`, `entitlement_pending`, `identity_reset_detected`, `paywall_variant_skipped`, `save/watchlist` yardımcıları …) | ~22 | Faydalı ama kapı şartı değil. |

**Kapı şartı olmamak, ölçülmemek demek değildir.** Özellikle
`entitlement_pending` (K-49 matrisinin ölçülmemiş hücresi),
`purchase_cancelled` ve `identity_reset_detected` (E-08) R-C ve R-D'de elle
kontrol edilir — sadece 20 kontenjanının içinde değiller.

---

## 3. G-6 doğrulama prosedürü

Kapı "tanımlı" değil **"canlı doğrulanmış"** istiyor. 20/20 sayılması için her
event PostHog'da gerçek bir cihaz oturumundan gelmiş olmalı:

1. Gerçek cihazda (TestFlight build'i — E-11 gereği) tam bir akış:
   açılış → gauntlet → 3 tur → champion → "nerede izlenir" → ertesi gün watch
   feedback.
2. Arşiv akışı: en az 1 tamamlanmış + 2 kaçırılmış günü olan test hesabı ile
   `archive_viewed` + `paywall_triggered`.
3. Sandbox satın alma: `purchase_started` → `purchase_completed`; ayrıca iptal
   (`purchase_cancelled`) ve restore'un üç dalı.
4. Her event PostHog'da **alanlarıyla birlikte** doğrulanır — event'in düşmesi
   yetmez, `gauntlet_id` / `variant` / `result` boş gelirse o satır sayılmaz.

Eksik çıkan her event için: kod yolu mu tetiklenmiyor, yoksa event mi
düşmüyor — ayrımı yapılmadan "geçti" denmez.
`services/posthog.ts:init()` anahtar yoksa **sessizce devre dışı kalır** ve
`track()` çağrıları Sentry'ye uyarı yazıp düşer; doğrulama build'inde
`EXPO_PUBLIC_POSTHOG_KEY` ve `_HOST` dolu olmalıdır.

---

## 3.1 `gauntlet_viewed` — semantik netleştirmesi ve funnel baseline kayması

**Tarih:** 19 Eylül 2026 · **Kaynak:** C.9b-UI Faz 0 bulgusu **F-C** ·
**Statü:** yön kilitli, uygulama **G10 ölçümüne bağlı**

### Sorun

Bu listede `gauntlet_viewed` (§1.1 sıra 1) **alan taşımıyor** ("—") ve
sözlük onun *mount başına* mı *gün başına* mı ateşleneceğini **söylemiyor**.
Kodda `useEffect` dep listesi `[]` ile **her mount'ta** ateşleniyor.

`GauntletShell` bugün `app/(tabs)/index.tsx`'in altında yaşıyor. Sekme
değişimi ekranı unmount ediyorsa, Profile'a gidip dönmek event'i yeniden
ateşler ve North Star funnel'ının (`viewed → started → completed`)
**paydasını şişirir** — yani Daily Gauntlet Completion olduğundan **düşük**
görünür.

Aynı yerde ikinci risk: `gauntlet_started`'ın tekrar koruması
`startedTrackedGauntletIdsRef` bir **ref**'tir; ref bileşen örneğine bağlı,
unmount'ta sıfırlanır.

### Kilitlenen yön (CTO, 19 Eyl 2026)

> **`gauntlet_id` başına bir kez, kalıcı set.** Bu turda **yalnız dedupe**,
> **yeni alan yok** (alan eklemek M1'in işi).

Dedupe `gauntlet_id`'yi **yalnızca içeride** anahtar olarak kullanır; event'e
alan olarak **eklenmez** — 20/20 event sözleşmesi bozulmaz.

### ⚠️ Funnel baseline kayması

Dedupe'un `gauntlet_id` başına çalışması, event'in **ateşlenme noktasını
değiştirmeyi gerektirir**: bugün mount'ta, yani gauntlet **yüklenmeden önce**
ateşleniyor; o anda `gauntlet_id` henüz **yok**. Anahtar ancak yüklemeden
sonra bilinebilir.

Bu, event'in **ne saydığını** değiştirir:

| | Bugün | Dedupe sonrası |
|---|---|---|
| Sayılan | Ekran açıldı | Gauntlet yüklendi |
| `before_18` (18:00 öncesi) | **Sayılıyor** | **Sayılmıyor** |
| `bootstrapping` hata durumu | **Sayılıyor** | **Sayılmıyor** |
| Sekme dönüşü | Tekrar sayılıyor | Sayılmıyor |

**Sonuç:** `gauntlet_viewed` sayısı **düşer**, `started/viewed` ve
`completed/viewed` oranları **yükselir**. Bu bir düzelme değil, **tanım
değişikliğidir** — kesim tarihinden önceki ve sonraki funnel değerleri
**doğrudan karşılaştırılamaz**.

**Yapılacak:** uygulandığı gün bu bölüme kesim tarihi ve ilk/son 7 günlük
oran yazılır; panolarda o tarihe dikey bir işaret konur.

**Kaybedilen sinyal telafisi:** `before_18` ve yükleme hatası artık funnel'da
görünmeyecek. İkisi de ayrı ölçülmek isteniyorsa bu **yeni event** demektir
ve **M1'in kapsamıdır** — C.9b-UI'da yapılmaz.

### Önce ölçülecek (C.9b-UI G10)

`NativeTabs` `GauntletShell`'i gerçekten unmount ediyor mu?
**Unmount etmiyorsa hiçbir değişiklik yapılmaz** — sorun yoktur, bu bölüm
yalnız sözlük netleştirmesi olarak kalır.

---

## 4. İlgili

- `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` — G-6 (§7.2), E-07, E-09, E-11
- `docs/analytics/FAZ1_OLCUM_PLANI.md` — 29 Tem 2026, **gauntlet öncesi**;
  oyun dönemi panosunu anlatır, bu listenin yerini tutmaz
- `services/posthog.ts` — SDK sarmalayıcı (tip kısıtı yok)
