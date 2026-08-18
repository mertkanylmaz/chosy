# 📍 CHOSY — DURUM DEVRİ

**Tarih:** 17 Ağustos 2026
**Son güncelleme:** 18 Ağustos 2026 — C.9a + C.9a-2 kapanışı, cold-start doğrulaması
**Amaç:** Bu doküman, yeni bir CTO sohbetinin sıfırdan bağlam kurmadan devam edebilmesi için mevcut durumu kaydeder.
**Kullanım:** Yeni sohbette bu dosya + `7_CHOSY_V1_KAPSAM_KILIDI.md` proje bilgisinde olmalı.

---

## 0. İKİ AYRI İŞ KOLU — KARIŞTIRMA

Şu anda **birbirinden bağımsız iki hat** var. Aynı sohbette ilerleyebilirler ama **kapsamları asla birleşmez**.

| Hat | Nedir | Statü |
|---|---|---|
| **HAT 1 — Ürün Sprintleri** | `7_CHOSY_V1_KAPSAM_KILIDI.md` (bible) doğrultusunda M0 → M1 → M2 → M3 → C.9a → … → R-D | M0 · C.9a · C.9a-2 tamamlandı. **M1, M2, M3 hâlâ açık** (bkz. §5 sıra sapması), sıradaki konuşulan iş C.9b |
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

| Metrik | Değer | Kaynak |
|---|---|---|
| `auth.users` toplam | 237 | M0 Faz 2, sunucu sayımı |
| — anonim | 172 | |
| — anonim olmayan | 64 | |
| `public.users` toplam | 234 | |
| Orphan (auth var / public yok) | 3 (hepsi eski test artığı, sıfır veri) | |
| Herhangi bir aktivitesi olan kullanıcı | 29 | |
| Ücretli kullanıcı | 3 (weekly_legacy ×2, monthly ×1) | |
| Watchlist satırı | 311 (0 duplicate) | |
| En yüksek migration | **090** | |
| Typecheck baseline | 14 hata (scripts) / 32 (functions) | |
| Canlı entitlement ID | **`chosy_plus`** (`chosy_pro` DEĞİL) | |

**Kritik gerçek:** Gauntlet hiç production'a çıkmadı (`__DEV__` gated). Watched-it verisi sıfır. Faz C bileşenleri yazıldı ve cihazda doğrulandı ama kullanıcıya ulaşmadı.

C.9a/C.9a-2 (nav + native tab bar) 18 Ağu 2026'da tamamlandı, gauntlet üretim geçişi hâlâ C.9b'de bekliyor.

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

| # | İş | Aciliyet | Durum |
|---|---|---|---|
| **1** | ~~**Cihazda cold-start doğrulaması.** Uygulamayı aç-kapat (iz yazılır) → yalnızca `sb-xpcwihldlnlmyopjubdc-auth-token` AsyncStorage anahtarını sil → yeniden aç → PostHog'da `identity_reset_detected` + `trigger: cold_start` görünmeli.~~ | ~~C.9a test build'i dağıtılmadan önce~~ | ✅ **KAPANDI — 18 Ağu 2026.** PostHog Live'da gözlemlendi. Kanıt olay sırası: `Application Backgrounded → app_launched → identity_reset_detected → Application Opened → Application Became Active` |
| **2** | ~~**`.claude/` ağacı + `CLAUDE.md` içeriği paylaşılmalı.** Tier 1 migration planı bunsuz yazılamaz. `agent-memory/` içeriği de bu paylaşımla birlikte read-only envanterlenecek (bkz. §0.1).~~ | ~~Tier 1'in ön koşulu~~ | ✅ **KAPANDI — Tier 1** (bkz. `docs/05_SPRINTS/ARCHIVE/TIER1_AGENT_OS_HIJYENI.md`) |
| **3** | ~~**Bible'ı repoya koy:** `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` + Claude proje bilgisine yükle.~~ | ~~Hemen~~ | ✅ **KAPANDI.** Tier 1'de tek konum kararı alındı (kanonik dosya belirlendi), 47a2a2c ile repoya girdi (`docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md`, ilk kez track edildi) |
| **4** | `deno.lock` senkron commit'i (M0 artığı, ayrı hijyen commit'i) | C.9a İş 0 | 🔴 Açık — `git status`'ta hâlâ `M deno.lock` |
| **5** | `.claude/skills/chosy-conventions/SKILL.md:57` — "068" yazıyor, gerçek 090 | C.9a İş 0 | ✅ **KAPANDI — Tier 1**, commit 91399c0 (sabit migration numarası kaldırıldı) |

---

## 4. HAT 2 — TIER 1 KAPSAMI (sıradaki iş)

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

## 5. TIER 1 SONRASI SPRINT SIRASI (bible §8)

```
M1  Ölçüm Önce        PostHog event dictionary · Sentry release health + EAS source map
M2  Zaman Mimarisi    kullanıcı-yerel 18:00 · timezone · DST
M3  Havuz Gerçeği     havuz derinliği ölçümü · poster_url bug · poster_quality_ok
C.9a  Nav             3→2 tab · Discover flag · deep link redirect          ✅ 18 Ağu 2026
C.9a-2 Native Tab Bar K-04 · unstable-native-tabs · Senaryo A               ✅ 18 Ağu 2026
C.9b Home             state machine · production gauntlet · C.4 AÇILMASI
C.9c Profile · C.9d Watchlist · R-A İlk Deneyim · R-B Güvenilirlik
R-C Para · R-D Çıkış
```

**Not:** C.9a Tier 1 sonrası çalıştırıldı ve tamamlandı; K-04 ayrı bir sprinte
(C.9a-2) bölünerek o da tamamlandı. Sprint kayıtları:
`docs/05_SPRINTS/ARCHIVE/C9A_NAV_RESTRUCTURE.md` ve `C9A2_NATIVE_TAB_BAR.md`.

⚠️ **Sıra sapması:** Yukarıdaki liste M1 → M2 → M3 → C.9a diyor, ama fiilen
C.9a ve C.9a-2 önce çalıştırıldı. **M1, M2, M3 hâlâ açık.** Sıradaki iş C.9b
olarak konuşuluyor — M1-M3'ün nereye gireceği CTO kararı bekliyor.

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
1. `7_CHOSY_V1_KAPSAM_KILIDI.md` (v1.3) — **anayasa**
2. `8_CHOSY_DURUM_DEVRI.md` (bu dosya) — **nerede kaldık**
3. Mevcut OS dokümanları (1-4, 6)

Açılış mesajı olarak yeterli:

> Chosy CTO sohbetine devam. Bible v1.3 ve durum devri dosyası proje bilgisinde. HAT 2 Tier 1 ile başlıyoruz — `.claude/` ağacını ve CLAUDE.md'yi paylaşıyorum.
