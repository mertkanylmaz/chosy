# 📍 CHOSY — DURUM DEVRİ

**Tarih:** 18 Ağustos 2026
**Son güncelleme:** 18 Ağustos 2026 — M1 + M3 tamamlandı, M2 Faz 2a tamam / Faz 2b bekliyor, canlı sayımlar tazelendi
**Amaç:** Bu doküman, yeni bir CTO sohbetinin sıfırdan bağlam kurmadan devam edebilmesi için mevcut durumu kaydeder.
**Kullanım:** Yeni sohbette bu dosya + `7_CHOSY_V1_KAPSAM_KILIDI.md` proje bilgisinde olmalı.

---

## 0. İKİ AYRI İŞ KOLU — KARIŞTIRMA

Şu anda **birbirinden bağımsız iki hat** var. Aynı sohbette ilerleyebilirler ama **kapsamları asla birleşmez**.

| Hat | Nedir | Statü |
|---|---|---|
| **HAT 1 — Ürün Sprintleri** | `7_CHOSY_V1_KAPSAM_KILIDI.md` (bible) doğrultusunda M0 → M1 → M2 → M3 → C.9a → … → R-D | M0 · M1 · M3 · C.9a · C.9a-2 tamamlandı. **M2 kısmi** (Faz 2a tamam, Faz 2b tetikleyici bekliyor). Sıradaki iş **C.9b** |
| **HAT 2 — Agent OS Tier 1** | Doküman hijyeni: bible tek konum, CLAUDE.md küçültme, skill envanteri, sprint dosya formatı, rapor arşivi | ✅ Tamamlandı — 17 Ağu 2026 (`docs/05_SPRINTS/ARCHIVE/TIER1_AGENT_OS_HIJYENI.md`) |

**Sıra kararı (17 Ağu):** Önce HAT 2 Tier 1, sonra HAT 1 devam.

**Gerekçe:** 17 Ağustos'ta üç ayrı kez bayat doküman yüzünden yanlış varsayımla başlandı (87 orphan → gerçekte 3 · `chosy_pro` → gerçekte `chosy_plus` · CLAUDE.md "migration 085" → gerçekte 090 · skill dosyası "068"). Tier 1 bu sınıf hatayı kaynağında kapatır.

**Tier 2 ve Tier 3 (subagent'lar, MCP bağlantıları, otonom döngü) v1 kapısından (G-1…G-9) önce AÇILMAZ.** Bu bir erteleme değil, karardır.

### 0.1 Karar: `.claude/agent-memory/` (CDO/CEO/CMO/COO/CTO) — DONDURULDU

Repoda rol başına izole hafıza yapısı (`.claude/agent-memory/`) bulundu. **Bu Tier 2/3 sınıfına giriyor** — ne zaman kurulduğu değil, ne yaptığı belirleyici: rol başına kalıcı hafıza tutmak, "memory = repo, chat history değil" ilkesinin tersidir ve bu sabahki drift hastalığının (bible'ın iki kopyası, bayat skill/CLAUDE.md sayıları) beşinci versiyonu olma riski taşır. Ayrıca CEO/CMO/COO/CDO rolleri, Tier 2 için tasarlanan 3-agent şekliyle (cto/engineer/qa) uyuşmuyor — muhtemelen reddedilen 7-agent taslağının kalıntısı.

**Kilitlenen protokol (Tier 1 kapsamına dahil):**
1. İçerik **read-only** envanterlenir (her rol dosyasının ne tuttuğu raporlanır)
2. Bible ile çelişen bir şey çıkarsa not düşülür, **otomatik yedirilmez** — CTO onayı gerekir
3. Klasör bu turdan sonra **dondurulur**: Claude Code buraya yazmaz, buradan otorite olarak okumaz
4. Kurtarılabilir içerik varsa, v1 kapısı sonrası gerçek Tier 2 tasarımına elle taşınır — otomatik migrate edilmez

---

## 1. ÜRÜNÜN GERÇEK DURUMU (ölçülmüş, tahmin değil)

**Sayım tarihi: 18 Ağustos 2026** — hepsi canlı sorgu (service key, read-only),
dokümandan kopyalanmadı. Parantez içi değerler 17 Ağu sayımıdır.

| Metrik | Değer | Kaynak / not |
|---|---|---|
| `auth.users` toplam | **240** (17 Ağu: 237) | Admin API `listUsers` |
| — anonim | **176** (172) | |
| — anonim olmayan | **64** (64, değişmedi) | |
| `public.users` toplam | **237** (234) | |
| Orphan (auth var / `users.auth_id` yok) | **3** (3, değişmedi) | eski test artığı, sıfır veri |
| Herhangi bir aktivitesi olan kullanıcı | **29** (29, değişmedi) | `watchlist ∪ choice_events` distinct `user_id` |
| Ücretli kullanıcı | **3** (weekly_legacy ×2, monthly ×1) | `subscription_tier`; ikisi de `subscription_active_until` geçmişte — **aktif abone 0** |
| Watchlist satırı | **312** (311) — 0 duplicate | `(user_id, film_id)` çifti tekrarsız |
| — `watched_at` dolu | **6** | C.4 watched-it sinyali; kaynağı `watched_source` ile ayrıştırılmadı |
| `films` toplam | **3.413** | tier: core 864 · trending 56 · extended 949 · archive 1.544 |
| — `poster_url` dolu | **3.408** | |
| `choice_events` | **18** | tümü `__DEV__` test trafiği |
| `daily_gauntlets` | **17** (4'ünde `champion_film_id` dolu) | |
| `users.timezone` gerçek IANA | **8** / 229 `'UTC'` / 0 NULL | M2 write-through 18 Ağu'da açıldı — Faz 2b tetikleyicisi |
| En yüksek migration | **098** (17 Ağu: 090) | |
| Typecheck baseline | 14 hata (scripts) / 32 (functions) | 18 Ağu'da tekrar çalıştı — `typecheck`: **14, hepsi `scripts/`** · `typecheck:functions`: **32**. Baseline korunuyor, regresyon yok |
| Canlı entitlement ID | **`chosy_plus`** (`chosy_pro` DEĞİL) | |

**Kritik gerçek:** Gauntlet hâlâ production'a çıkmadı (`__DEV__` gated).
`choice_events` (18) ve `daily_gauntlets` (17) tamamen test trafiğidir,
kullanıcı davranışı değildir — algoritma ayarı için kullanılamaz.
Faz C bileşenleri yazıldı ve cihazda doğrulandı ama kullanıcıya ulaşmadı.

C.9a/C.9a-2 (nav + native tab bar) 18 Ağu 2026'da tamamlandı, gauntlet üretim
geçişi hâlâ **C.9b**'de bekliyor.

---

## 2. M0 — TAMAMLANDI

| Faz | İş | Sonuç |
|---|---|---|
| Faz 1 | Keşif (read-only) | 4 alanda envanter çıkarıldı, bibledaki 3 tahmin düzeltildi |
| Faz 2 | Orphan doğrulama · E-08 görünürlük · entitlement veri düzeltmesi · grandfathering | Commit 07e91d3 · migration 089, 090 |
| Faz 3 | Cold-start kimlik sıfırlama görünürlüğü · CLAUDE.md düzeltmesi | `utils/identityReset.ts` · 10/10 Deno testi |

**M0'dan çıkan kalıcı kararlar:**
- Entitlement hedef ismi `chosy_pro` → **`chosy_plus`** (bible K-48 güncellendi)
- C.7 backfill'e gerek yok — migration 082 zaten çalışmış
- Watchlist "duplicate" bir veri sorunu değil, kod sorunu (C.9d saf konsolidasyon)
- `expo-secure-store` **eklenmiyor** — reinstall senaryosu ölçülmüyor, bilinçli

---

## 2a. M1 — ÖLÇÜM ÖNCE — TAMAMLANDI (18 Ağu 2026)

**Bible:** D-01, D-04, E-04, K-38, K-39 · **Kayıt:** `docs/05_SPRINTS/ARCHIVE/M1_OLCUM_ONCE.md`

- PostHog event sözlüğü kuruldu: gauntlet/champion çekirdeği · watch feedback
  (C.4) · auth · onboarding · paywall/purchase · DNA (commit 7217639, 49b4355, a9c311a)
- `ChoiceResult`'a `gauntlet_id` + `algorithm_version` bağlandı (a8cfda5)
- Sentry `release`/`dist` alanları eklendi (c222742); **EAS native source map
  otomatik** — Sentry Expo plugin üzerinden geliyor, ek iş gerekmedi
- `v_algorithm_daily` view (D-04, migration **092**, c0b162d) — admin UI
  inşa edilmedi, SQL view + PostHog dashboard tercih edildi
- **Bonus:** güvenlik taraması — 3 view'da (`v_mood_searches_recent`,
  `user_swipe_history`, `detective_daily_scores`) `anon`/`authenticated`'a
  açık PII sızıntısı bulundu ve kapatıldı (**093-095**), kök neden
  (proje-bootstrap default privilege kuralı) **096** ile düzeltildi,
  **097** kasıtlı-açık view notu, **098** test view temizliği

**Kapsam dışı bırakılanlar:** OTA update source map'i (ayrı workflow, teknik
borç) · `save_for_later` / `provider_clicked` event'leri (CTA'lar henüz yok,
C.9b/C.9c'de gelecek).

---

## 2b. M2 — ZAMAN MİMARİSİ — KISMİ (Faz 2a tamam, Faz 2b bekliyor)

**Bible:** E-01, K-03, D-02 · **Kayıt:** `docs/05_SPRINTS/ARCHIVE/M2_ZAMAN_MIMARISI.md`

**Faz 2a — TAMAMLANDI 18 Ağu 2026:**
- `generate-gauntlet` sözleşmesine **write-through timezone** eklendi
  (5671714 sunucu, 51e5014 istemci). gauntlet-contract prosedürü izlendi,
  `types/gauntlet.ts` kilidine dokunulmadı
- `schedule-notifications` D-02 gereği **sabit 18:00** kullanıyor,
  `preferred_notification_hour` okumuyor (3678b7b)
- `send-daily-pick` **atıl** bulundu → D-02 şu an fiilen ihlal edilmiyor
- **Bulgu:** bildirim hattı çift-ölü (üretici de boşaltıcı da cron'a bağlı
  değil) — C.9b kapsamına not düşüldü

**Faz 2b — AÇIK:** `generate-gauntlet` ve `update_streak`'in gün anahtarını
UTC yerine `users.timezone`'a bağlaması.

> **Tetikleyici (net koşul):** `users.timezone` değeri `'UTC'` **olmayan**
> (gerçek IANA) kullanıcı sayısı **≥10'a ulaştığında** VEYA **25 Ağustos
> 2026'ya gelindiğinde** (write-through açılışı + 1 hafta) — hangisi önce
> olursa — sayım **tekrar alınır** ve Faz 2b değerlendirilir.
> **18 Ağu sayımı: 8 IANA / 229 `'UTC'` → eşik aşılmadı.**

---

## 2c. M3 — HAVUZ GERÇEĞİ — TAMAMLANDI (18 Ağu 2026)

**Bible:** E-02, D-03 · **Kayıt:** `docs/05_SPRINTS/ARCHIVE/M3_HAVUZ_GERCEGI.md`

- **Havuz derinliği canlı ölçüldü:** 1.847 düello-uygun film, **etkin havuz
  840**. 365 günlük tekrar simülasyonunda %10 eşiği `any`'de **97. günde**,
  `short`'ta **53. günde** aşılıyor → bible'ın "40. günde tekrar" endişesi
  çürütüldü, ama etkin havuzun nominalden küçüklüğü doğrulandı
- **"w92 bug'ı" bible'ın tarif ettiği haliyle YOK.** Gerçek bug:
  `generate-gauntlet` **cached yolunda** poster normalizasyonu eksikti —
  havuzun %100'ü etkilenmiş, ~21× bant israfı. Düzeltildi (e4fea12)
- **`poster_quality_ok` gate'i bilinçli olarak BAĞLANMADI.** Kolon var
  (084) ama LightBleed yan ürünü; dolduran script yerel `npx tsx`, cron'a
  bağlı değil. Fail-open gate bugün 0 film eler → sıfır kapsama + tam koruma
  görüntüsü = sahte güvence, reddedildi (66b4089)
- `imdb_votes` kirliliği doğrulandı — **yüzdelik yaklaşımı** hâlâ doğru savunma

**Kapsam dışı:** `recognition_band` / `MIN_SELECTION_WEIGHT` ayarı (C.9b
sonrası gerçek kullanıcı verisiyle) · `poster_quality_ok` gate bağlama
(ingestion-time otomasyon şart, tasarım notu yazıldı) ·
`compute-dominant-colors`'ı Edge Function'a taşımak (ayrı mimari sprint).

---

## 2d. C.9a — NAV YENİDEN YAPILANDIRMA — TAMAMLANDI (18 Ağu 2026)

**Bible:** K-01, K-02 · **Kayıt:** `docs/05_SPRINTS/ARCHIVE/C9A_NAV_RESTRUCTURE.md`

3 tab → 2 tab (Home + Profile). `discover_tab_enabled` `app_config` flag'i
(migration **091**), fail-closed lazy getter (`services/appConfigFlags.ts`),
`/mood` dead route'una redirect guard. Discover kodu **silinmedi**, donduruldu (K-02).

---

## 2e. C.9a-2 — NATIVE TAB BAR — TAMAMLANDI (18 Ağu 2026)

**Bible:** K-04 · **Kayıt:** `docs/05_SPRINTS/ARCHIVE/C9A2_NATIVE_TAB_BAR.md`

Tab bar `expo-router/unstable-native-tabs`'a taşındı (**Senaryo A** — tam
native geçiş, CTO kararı). `app/(tabs)/_layout.tsx` 258 → 71 satır.
İkonlar Phosphor → SF Symbols. Custom pill/shadow/bounce/dot bilinçli bırakıldı.

---

## 2.1 C.9 KEŞİF BULGULARI (ürünle ilgisiz, gözlemlenebilirlik)

C.9a-2 sırasında keşfedilen, sprint kapsamı dışında ama **Kural 1'i (sessiz
fallback yasak) ihlal eden** üç gözlemlenebilirlik açığı. Üçü de aynı turda
düzeltildi.

| # | Bulgu | Neden önemli | Düzeltme | Commit |
|---|---|---|---|---|
| 1 | `posthogAnalytics.track()` **sessiz-null**: `posthog?.capture(...)` — PostHog init edilemediyse event hiçbir iz bırakmadan düşüyordu | Ölçüm katmanının kendisi sessizce ölürse, "event gelmiyor" ile "event hiç gönderilmedi" ayırt edilemez. M1 (Ölçüm Önce) bu zemine oturacak | `posthog` null ise `Sentry.captureMessage('PostHog not initialized, event "<ad>" dropped', 'warning')` + erken dönüş | da8b8c0 |
| 2 | `posthogAnalytics.init()` key/host eksikken yalnızca `__DEV__`-only `logger.log` yazıyordu — **production'da hiçbir sinyal yok** | Env değişkeni eksik bir build sessizce sıfır telemetriyle yayınlanabilirdi | Aynı desen: `Sentry.captureMessage('PostHog init skipped — missing key/host', 'warning')` | 4ca4067 |
| 3 | PostHog `flushAt: 20` / `flushInterval: 30_000` ile tamponluyor; uygulama arka plana alınınca tampondaki eventler kaybolabiliyordu | Cold-start doğrulaması (§3 madde 1) tam da bu sınırda ölçülüyor — kayıp event yanlış negatif üretir | `app/_layout.tsx`'te AppState `background` geçişinde flush tetikleniyor | cc82c63 |

**Not:** Bu üç düzeltme olmasaydı §3 madde 1'in cihaz doğrulaması
kanıtlanamazdı — `identity_reset_detected` olayının PostHog Live'da
görülebilmesi (3) numaralı flush düzeltmesine bağlı.

---

## 3. AÇIK MADDELER — CTO'DAN BEKLENEN

**17 Ağustos listesindeki 5 maddenin 4'ü kapandı** (cold-start doğrulaması ·
`.claude/` paylaşımı · bible'ın repoya girmesi · `chosy-conventions` bayat
migration numarası). Detayları için commit geçmişi ve
`ARCHIVE/TIER1_AGENT_OS_HIJYENI.md`. Güncel liste:

| # | İş | Kaynak | Aciliyet | Durum |
|---|---|---|---|---|
| **1** | **M2 Faz 2b tetikleyicisi.** `users.timezone` `'UTC'` olmayan kullanıcı ≥10 olduğunda **veya** 25 Ağu 2026'ya gelindiğinde sayımı **tekrar al**, sonra Faz 2b'yi (gün anahtarı → user-tz) değerlendir. 18 Ağu: 8/237 | M2 | Tetikleyici gerçekleşince | 🟡 Bekliyor — sayım tazelenmeden Faz 2b'ye girilmez |
| **2** | **`supabase_admin` default privilege boşluğu.** Migration'la kapatılamıyor; Supabase **Dashboard** veya support gerekiyor. Kök neden düzeltmesi (096) bu rolü kapsamıyor | M1 | Orta — bugün bilinen bir sızıntı yok, ama 096'nın kapsama boşluğu | 🔴 Açık — CTO/manuel işlem gerekiyor |
| **3** | **`poster_quality_ok` ingestion-time otomasyonu.** `sync-trending` içinde yazma anında `w500` HEAD kontrolü. Tasarım notu **hazır** (`docs/TEKNIK_BORC.md`), kod yazılmadı — ayrı onayla açılacak küçük iş. Bu bitmeden D-03 gate'ini bağlamak anlamsız | M3 | Düşük-orta | 🔴 Açık — onay bekliyor |
| **4** | **OTA update source map pipeline.** Native source map otomatik çalışıyor; OTA update'ler için ayrı workflow gerekiyor | M1 | Düşük — OTA yayını başlayana kadar | 🔴 Açık — teknik borca kayıtlı |
| **5** | `deno.lock` senkron commit'i (M0 artığı, ayrı hijyen commit'i) | M0 | Düşük | 🔴 Açık — `git status`'ta hâlâ `M deno.lock` |
| **6** | **M1-M3'ün sıraya dönüşü tamamlandı** — sıradaki iş **C.9b** (Home state machine · production gauntlet · C.4 açılması). Bildirim hattının çift-ölü olduğu (M2 Faz 2a bulgusu) C.9b kapsamına alınmalı | M2 / bible §8 | Sıradaki sprint | 🟡 Karar verildi, başlatılmadı |

---

## 4. HAT 2 — TIER 1 KAPSAMI — ✅ TAMAMLANDI (17 Ağu 2026)

> Bu bölüm **kapanmıştır**, tarihsel kayıt olarak bırakıldı. Sprint kaydı:
> `docs/05_SPRINTS/ARCHIVE/TIER1_AGENT_OS_HIJYENI.md`.

| İş | Çözdüğü gerçek sorun |
|---|---|
| Bible tek konumda, tek yazma yolu | Bible'ın iki kopya halinde yaşaması ve drift etmesi |
| CLAUDE.md küçültme — **sadece kurallar, durum/sayı yok** | "En yüksek migration 085" bayatlığı |
| Skill dosyalarında **durum bilgisi yasağı** | `chosy-conventions/SKILL.md:57` yanlış bilgi verdi |
| Skill envanteri: KEEP / MERGE / RETIRE | Donmuş oyun sistemlerine ait ölü skill'ler |
| Sprint dosya formatı → `docs/05_SPRINTS/ACTIVE/` | Sprint tanımlarının sohbette yaşaması |
| Rapor arşivi → M0 Faz 1-2-3 raporları repoya | 6 ay sonra "neden böyle yapmıştık" sorusunun cevabı |
| Commit formatı (`feat(c9a): …`) | Bedava, git log mühendislik hafızası olur |

**Tier 1 kesinlikle şunları İÇERMEZ:** yeni agent, subagent, MCP bağlantısı, otonom döngü, `.agent/` klasörü, AGENTS.md, `agent:prepare` scripti, decision ledger (üçüncü ledger drift üretir).

**Üçüncü bir karar günlüğü açılmayacak.** Mevcut iki tane var: `6_CHOSY_IA_REVIZE_KARAR_GUNLUGU.md` ve bible §10.

---

## 5. SPRINT SIRASI VE DURUMU (bible §8)

| Sprint | İçerik | Durum |
|---|---|---|
| **M0** | Keşif · orphan/entitlement · cold-start | ✅ Tamamlandı |
| **Tier 1** | Agent OS hijyeni (HAT 2) | ✅ 17 Ağu 2026 |
| **C.9a** | 3→2 tab · Discover flag · dead route redirect | ✅ 18 Ağu 2026 |
| **C.9a-2** | K-04 · `unstable-native-tabs` · Senaryo A | ✅ 18 Ağu 2026 |
| **M1** | PostHog event sözlüğü · Sentry release/dist · `v_algorithm_daily` · güvenlik taraması | ✅ 18 Ağu 2026 |
| **M3** | Havuz derinliği ölçümü · cached-yol poster bug'ı · `poster_quality_ok` kararı | ✅ 18 Ağu 2026 |
| **M2** | Kullanıcı-yerel 18:00 · timezone · DST | 🟡 **Kısmi** — Faz 2a ✅, Faz 2b tetikleyici bekliyor (§2b) |
| **C.9b** | Home state machine · **production gauntlet** · C.4 AÇILMASI | ⬜ Sıradaki iş |
| **C.9c** | Profile | ⬜ Bekliyor |
| **C.9d** | Watchlist konsolidasyonu | ⬜ Bekliyor |
| **R-A** | İlk deneyim | ⬜ Bekliyor |
| **R-B** | Güvenilirlik | ⬜ Bekliyor |
| **R-C** | Para | ⬜ Bekliyor |
| **R-D** | Çıkış | ⬜ Bekliyor |

**Sıra sapması kapandı.** Bible §8 sırası M1 → M2 → M3 → C.9a diyordu; fiilen
C.9a ve C.9a-2 önce çalıştırıldı, ardından M1-M2-M3 telafi edildi.
**18 Ağustos itibarıyla ölçüm hattında (M1-M2-M3) açık kalan tek iş M2 Faz
2b'dir** ve o da veri eşiği bekliyor, kod engeli değil. Sıradaki sprint C.9b;
M2 Faz 2b tetikleyicisi gerçekleştiğinde ayrıca ele alınır.

Sprint kayıtları: `docs/05_SPRINTS/ARCHIVE/` altında
`M0_FAZ1_KESIF.md` · `M0_FAZ2_ORPHAN_ENTITLEMENT.md` · `M0_FAZ3_COLDSTART.md` ·
`TIER1_AGENT_OS_HIJYENI.md` · `C9A_NAV_RESTRUCTURE.md` ·
`C9A2_NATIVE_TAB_BAR.md` · `M1_OLCUM_ONCE.md` · `M2_ZAMAN_MIMARISI.md` ·
`M3_HAVUZ_GERCEGI.md`.

---

## 5.1 AÇIK TEKNİK BORÇ ÖZETİ

Teknik borç kalemleri **burada tekrarlanmaz.** Tek kaynak:
**`docs/TEKNIK_BORC.md`**. M1/M2/M3 sırasında eklenen kalemler orada,
tetikleyici koşullarıyla birlikte duruyor:

- 🟡 OTA update source map upload'ı kurulu değil (M1)
- 🟡 M1 event enstrümantasyonu eski/eksik UI'ya bağlı — C.9b'de taşınacak (M1)
- 🟡 `recognition_band` / `MIN_SELECTION_WEIGHT` tuning'i C.9b sonrasına ertelendi (M3)
- 🟡 `seed-database.ts:283` ham `poster_path` yazıyor (949 satır) (M3)
- 🟡 `poster_quality_ok` doldurulmuyor — D-03 gate'i bilinçli bağlanmadı + ingestion-time tasarım notu (M3)
- ✅ RLS bypass / PII sızıntısı taraması — **çözüldü**, `supabase_admin` boşluğu hariç (M1, bkz. §3/2)

Daha eski kalemler (`remoteConfig.ts` kural 6 ihlali · `discoverEnabled`
remount riski · RevenueCat webhook fail-open · 63 sessiz `.update()` vb.)
aynı dosyada.

Yalnızca **CTO kararı veya repo dışı işlem** gerektiren borçlar §3'te ayrıca
listelenir.

---

## 6. ÇALIŞMA PROTOKOLÜ (değişmez)

- Her sprint ayrı `/clear` · read-only keşif önce · DUR NOKTASI'nda CTO onayı
- Claude Code'un **mimari karar yetkisi yok** — yeni tablo/kolon, yeni pattern, yeni bağımlılık, sözleşme değişikliği → DUR ve sor
- Ölçüm önce, kod sonra. Doküman alıntısı canlı ölçümün yerine geçmez
- Sessiz fallback yasak · append-only film verisi · sadece `supabase db push`
- Cihaz testi zorunlu kalite kapısı
- Commit mesajlarında doğrulanmamış kapanış dili ("tamamlandı/kapatıldı") yok
- **Bible sadece şu iki durumda değişir:** (a) dokümante edilmiş bir varsayım ölçümle çürütüldüğünde, (b) yeni bir mimari karar alındığında. Rutin implementasyon detayı için değişmez.

---

## 7. YENİ SOHBETE BAŞLARKEN

Proje bilgisinde bulunması gerekenler:
1. `7_CHOSY_V1_KAPSAM_KILIDI.md` (**v1.4** — F-06 kapandı, commit 31f0590) — **anayasa**
2. `8_CHOSY_DURUM_DEVRI.md` (bu dosya) — **nerede kaldık**
3. Mevcut OS dokümanları (1-4, 6)

Açılış mesajı olarak yeterli:

> Chosy CTO sohbetine devam. Bible v1.4 ve durum devri dosyası proje bilgisinde. Ölçüm hattı (M1/M3) kapandı, M2 Faz 2b veri eşiği bekliyor. Sıradaki iş C.9b — Home state machine, production gauntlet ve C.4'ün açılması.
