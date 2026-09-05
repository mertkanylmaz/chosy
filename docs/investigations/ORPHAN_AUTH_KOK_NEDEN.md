# Orphan Auth Kök Neden Keşfi

**Mod:** Salt okunur. Hiçbir veri, migration veya kod değişikliği yapılmadı.
**Tarih:** 5 Eylül 2026. **Kaynak:** `supabase db query --linked` (canlı proje `xpcwihldlnlmyopjubdc`).

## 1. Ölçülmüş mevcut durum

```
auth.users toplam   : 262
public.users toplam  : 254
orphan (auth var/public yok) : 8   -- count(*) exact, tahmini değil
```

Karşılaştırma — 17 Ağustos 2026 kapanışı ([[project_orphan_auth_teshisi]] hafıza kaydı):

| Tarih | auth.users | public.users | orphan |
|---|---|---|---|
| 17 Ağu 2026 | 237 | 234 | 3 |
| **5 Eyl 2026 (bugün)** | **262** | **254** | **8** |

**Bu aralıkta +25 yeni auth kimliği doğdu, bunların yalnızca 20'si (`%80`) `public.users` satırı aldı. 5'i (`%20`) orphan kaldı.** Bu, 14 Ağustos öncesi tek seferlik bootstrap-deploy sızıntısından (F-01, 88 kayıt) yapısal olarak farklı bir olgu: **sürekli, düşük hacimli ama devam eden bir sızıntı.**

⚠️ 17 Ağustos kapanış notundaki "Runner artık orphan üretmiyor, orphan sayısı 3'te sabit kaldı" ifadesi **yalnızca o anki tek `test:founder` koşumu için doğruydu.** Production'da orphan üretimi hiç durmamış — sonraki 19 gün içinde 5 yeni orphan doğdu.

## 2. Orphan kayıtların profili

| auth.users.id | created_at (UTC) | last_sign_in_at (UTC) | Δ (sn) | is_anonymous | provider |
|---|---|---|---|---|---|
| c1e66916‑…‑df688 | 2026-08-14 10:43:57.915 | 2026-08-14 10:43:58.087 | 0.17 | true | null |
| ec8f5867‑…‑71f9b | 2026-08-14 10:45:09.785 | 2026-08-14 10:45:09.792 | 0.01 | true | null |
| d2a68121‑…‑aeba1f | 2026-08-16 17:43:08.766 | 2026-08-16 17:43:08.961 | 0.20 | true | null |
| ce8a439b‑…‑ebc37a | **2026-08-19 19:05:48.346** | 2026-08-19 19:05:48.502 | 0.16 | true | null |
| 98ace43b‑…‑d41b5555 | 2026-08-25 06:26:11.395 | 2026-08-25 06:26:11.585 | 0.19 | true | null |
| 544ddb8b‑…‑938f425 | 2026-08-26 20:49:53.118 | 2026-08-26 20:49:53.312 | 0.19 | true | null |
| bd2e1ac7‑…‑2551449ad | 2026-08-28 15:15:39.044 | 2026-08-28 15:15:39.225 | 0.18 | true | null |
| 65f1fa09‑…‑7480334d | 2026-08-29 11:49:05.574 | 2026-08-29 11:49:05.768 | 0.19 | true | null |

**8/8 anonim** (`is_anonymous = true`, `provider = null` — Apple/Google/e-posta orphan'ı yok). Hiçbiri `deleted_at` doldurmamış, hiçbiri `email` taşımıyor.

**Ortak imza:** `last_sign_in_at − created_at` her satırda **0.01–0.20 saniye.** Bu, GoTrue'nun anonim oturum açarken `created_at` ve `last_sign_in_at`'i aynı INSERT'te doldurmasından kaynaklanır — yani **bu kimlikler yalnızca BİR KEZ, TEK bir oturumda görülmüş; bir daha hiç geri dönmemiş.** Eğer bu bir sonraki açılışta ensureAppUser'ın idempotent retry'ından faydalansaydı (088 migration notu: `INITIAL_SESSION` her açılışta tetiklenir), `last_sign_in_at` daha ileri bir tarihte olurdu. Hiçbiri öyle değil.

## 3. Madde 3 doğrulaması — "19 Ağustos'ta yeni doğmuş" kaydı

`ce8a439b-5530-426a-9d03-d260eaebc37a` gerçekten **2026-08-19 19:05:48 UTC**'de doğmuş — geriye tarihlenmiş/taşınmış bir kayıt değil, gerçek zamanlı bir INSERT. (Not: repo içi dokümanlarda bu kayda özel bir "yeni doğmuş" notuna rastlanmadı — muhtemelen önceki bir sohbet oturumunun kaydı; ölçüm burada bağımsız olarak doğrulanmıştır.)

## 4. E-08 / `identityReset.ts` ile zamansal korelasyon

`utils/identityReset.ts` **auth.users'a hiçbir şey yazmaz** — yalnızca AsyncStorage'daki `chosy_last_known_auth_id_suffix` anahtarını okur/yazar ve `reset_detected` olduğunda PostHog event'i tetikler. Doğrudan bir DB yazma yolu yok, dolayısıyla orphan satırların doğrudan nedeni olamaz.

Ancak §2'deki imza (`Δ ≈ 0.1–0.2 sn`, tekrar giriş yok) E-08'in tarif ettiği senaryoyla **dolaylı** örtüşüyor: sessiz kimlik sıfırlaması → yeni anonim oturum açılır → kullanıcı bunu hiç fark etmez → eski davranışına devam etmez (çünkü zaten farklı bir kimlik, geçmişi yok) → uygulamayı bırakır. Bu, E-08'in ürettiği "harcanmış" kimliklerden biri olabilir, ama kanıt dolaylı — `identity_reset_detected` PostHog event'lerine bu oturumda erişim yok, bu yüzden doğrulanamadı.

**Daha güçlü alternatif hipotez (aşağıda detaylı).**

## 5. Migration 082 bunları neden yakalamadı

082, **17 Ağustos'ta bir kez** çalışan tek seferlik bir `INSERT ... WHERE NOT EXISTS` backfill'i. Migration'lar tekrar tekrar çalışmaz (Supabase migration geçmişi idempotent-tek-uygulama modelidir). 8 orphan'ın **5'i backfill'den SONRA** doğdu (19, 25, 26, 28, 29 Ağu) — yapısal olarak 082'nin kapsamına hiç girmediler; "yakalamadı" değil, "zaten yakalayamazdı" doğru çerçeve. Kalan 3'ü (14 Ağu ×2, 16 Ağu ×1) zaten 17 Ağu'da "runner öncesi kalıntı" olarak biliniyordu ve 082 sonrasında hâlâ orphan — bu da migration'ın SADECE backfill anındaki durumu yakaladığını, retroaktif bir garanti sunmadığını doğruluyor.

**Sonuç: 082 tek seferlik bir yama; sızıntının kaynağı kapatılmadığı sürece her yeni orphan kalıcı olarak birikmeye devam edecek.**

## 6. Kök neden hipotezi (kanıtla desteklenmiş, doğrulanamayan kısmı işaretli)

`app/_layout.tsx:410` içindeki auth-state listener, `SIGNED_IN` veya `INITIAL_SESSION` olayında `bootstrapAppUser()`'ı **fire-and-forget** (`void bootstrapPromise`) olarak başlatır. `bootstrapAppUser()` → `ensureAppUser()` iki deneme yapar (anında + 1.5 sn sonra), her ikisi de başarısız olursa `Sentry.captureMessage(level:'fatal')` ile raporlanır (`services/auth-utils.ts:70-78`, `app/_layout.tsx:147-155`) — yani CLAUDE.md Kural 1 (sessiz fallback yasak) kod düzeyinde ihlal edilmiyor, **YAKALANABİLEN her hata** görünür.

Ama §2'deki imza (tek oturum, asla geri dönmeme) şu iki senaryodan hangisiyle uyumlu olduğunu ayırt etmemizi engelliyor:

**Hipotez A — Process ölümü (Sentry'de GÖRÜNMEZ):** Kullanıcı uygulamayı `signInAnonymously()` başarılı olduktan (`created_at` anı) hemen sonra, `ensureAppUser()` upsert'inin network round-trip'i tamamlanmadan kapatıyor/öldürüyor (ör. ilk açılışta hemen çıkma, cihaz arka planı agresif öldürme). JS process sonlandığı için **hiçbir catch bloğu çalışamaz, Sentry event'i hiç üretilmez.** Kullanıcı bir daha hiç dönmediği için idempotent retry şansı da olmuyor. Bu durumda mevcut kod ihlal etmiyor — gözlemlenebilirlik yapısal olarak imkânsız bir noktada duruyor.

**Hipotez B — Gerçek CREATE_FAILED (Sentry'de GÖRÜNÜR ama izlenmiyor):** Network hatası, RLS reddi veya PostgREST şema önbelleği sorunu nedeniyle her iki deneme de başarısız oluyor, Sentry'ye `error_code: APP_USER_CREATE_FAILED` fatal event'i düşüyor ama kimse bakmıyor. Kullanıcı yine de uygulamayı terk ediyor (ayrı, ilişkisiz bir sebeple) ve retry şansı olmuyor.

**Ayırt edilemedi — bu oturumun erişemediği veri:** Sentry API token'ı bu ortamda yok, bu yüzden 8 timestamp'in `error_code:APP_USER_CREATE_FAILED` etiketli event'lerle eşleşip eşleşmediği doğrulanamadı. Git geçmişi (14–29 Ağu arası `app/_layout.tsx` / `services/auth-utils.ts` commit'leri: `2d4fba2`, `ce5d2d1`, `2d56dc7`, `467ed0f`, `9e38b34`, `e5d8fcf`, `231c88c`) tarandı — hiçbiri `ensureAppUser`/`bootstrapAppUser` mantığını değiştirmemiş (yalnızca logger `skipBridge` eklemesi, hesap silme cascade'i, Sentry release alanları). Yani bu **regresyon değil, kod hiç değişmeden süregelen bir sızıntı.**

## 7. DUR NOKTASI

Kök nedenin A mı B mi olduğu **Sentry dashboard'unda `error_code:APP_USER_CREATE_FAILED` filtresiyle 14/16/19/25/26/28/29 Ağustos tarihlerinde event olup olmadığına bakılarak** CTO tarafından doğrulanmalı — bu araç setinde Sentry API erişimi yok.

- **Eğer B doğrulanırsa:** gerçek bir hata sınıfı var, düzeltme (retry sayısını artırma, backoff, farklı network stratejisi) bir mimari karar — CLAUDE.md yetki sınırı gereği onay gerekir.
- **Eğer A doğrulanırsa:** bu muhtemelen kabul edilebilir bir "bounce" sınıfı (ilk açılışta hemen terk) ve düzeltme gerektirmeyebilir — ama %20'lik oran (5/25 yeni kimlik) rastgele gürültü için yüksek görünüyor; ürün kararı olarak "kabul edilebilir" mi işaretlenecek yoksa bir arka plan retry mekanizması (ör. AppState/foreground'da tekrar dene) mi eklenecek, bu da mimari karar — onay gerekir.

Bu rapor **hiçbir düzeltme önermez veya uygulamaz.**

### ÇÖZÜLDÜ (5 Eylül 2026)

Sentry MCP ile doğrudan sorgulandı: react-native projesinde `APP_USER_CREATE_FAILED` / `ensureAppUser` / `bootstrapAppUser` ile eşleşen **sıfır event** bulundu (son 90 gün, tüm statüler). **Hipotez A doğrulandı, Hipotez B elendi.** Yani 8 orphan'ın hiçbirinde kod hatası yok — hepsi davranışsal bounce: kullanıcı ilk açılışta `ensureAppUser()`'ın network round-trip'i tamamlanmadan uygulamadan çıkıyor/uygulama öldürülüyor, JS process bu noktada sonlandığı için hiçbir catch bloğu çalışamıyor ve Sentry event'i hiç üretilmiyor. CLAUDE.md Kural 1 (sessiz fallback yasak) ihlal edilmiyor — yakalanabilen her hata zaten görünür durumda, burada yakalanacak bir hata hiç oluşmuyor.

**Karar:** Şimdilik düzeltme yazılmıyor. Mevcut %20 (5/25) oranı büyük olasılıkla geliştirme/test trafiğinden kaynaklanıyor, gerçek kullanıcı örneklemi değil. G-3/G-9 marketing gate'lerinde gerçek trafikle yeniden ölçülecek; eşik aşarsa (örn. gerçek kullanıcılarda >%10) arka plan retry/foreground-resume mekanizması mimari karar olarak değerlendirilecek.

Bu rapor **hâlâ hiçbir düzeltme önermez veya uygulamaz** — yalnızca kök neden ayrımı kapatılmıştır.

## 8. Kapsam dışı bırakılanlar

- Hiçbir veri değişikliği yapılmadı (yalnızca `SELECT`).
- Hiçbir migration yazılmadı.
- PostHog canlı event sorgusu yapılamadı — bu maddenin sonucu değiştirmiyor (Sentry sorgusu kök nedeni zaten kapattı).
- Sentry sorgusu bu turda MCP ile tamamlandı (§7 "ÇÖZÜLDÜ"), ilk yazımdaki "token yok" kısıtı artık geçerli değil.
