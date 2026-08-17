# M0 Bulguları — Faz 1 / Faz 2 / Faz 3

**Not:** Süre kısıtı nedeniyle Faz 1/2/3 için ayrı rapor dosyası yerine tek
birleşik dosya seçildi. Kaynak: `docs/os/8_CHOSY_DURUM_DEVRI.md` §1-§3 ve
`docs/os/7_CHOSY_V1_KAPSAM_KILIDI (1).md` §11-§12 (F-01 → F-06, E-08).

## Ölçülmüş Ürün Durumu (Faz 2 sonu itibarıyla)

| Metrik | Değer |
|---|---|
| `auth.users` toplam | 237 (anonim 172 · anonim olmayan 64) |
| `public.users` toplam | 234 |
| Orphan (auth var / public yok) | 3 (hepsi eski test artığı, sıfır veri) |
| Herhangi bir aktivitesi olan kullanıcı | 29 |
| Ücretli kullanıcı | 3 (weekly_legacy ×2, monthly ×1) |
| Watchlist satırı | 311 (0 duplicate) |
| En yüksek migration | 090 |
| Typecheck baseline | 14 hata (scripts) / 32 hata (functions) |
| Canlı entitlement ID | `chosy_plus` (`chosy_pro` DEĞİL) |

## F-01 — C.7 backfill'e gerek yok

Bibledeki tahmin: 87 yetim kimlik, backfill zorunlu.
Gerçek: Migration 082 zaten çalışmış. 3 orphan kaldı, hepsi test runner
artığı (üretim yolu değil), 0'ı gerçek veri taşıyor (FK zorunluluğu
nedeniyle yapısal olarak imkânsız). Kök neden d9b22e2 (17 Ağu) ile kapatıldı
ama sahada doğrulanmadı.

## F-02 — Entitlement isimleri gerçekle uyuşmuyor

Bibledeki tahmin: `legacy_lifetime` / `legacy_quota` / `chosy_pro` kodda/DB'de var.
Gerçek: Kodda `chosy_plus`, DB'de `premium` yazıyordu — ikisi birbirini
tutmuyordu. `legacy_lifetime` sahibi 0, `legacy_quota` karşılığı 3 kullanıcı
(weekly_legacy ×2, monthly ×1).

**DUR NOKTASI kararı (17 Ağu):** Seçenek B — bible ismi gerçeğe uyar.
K-48 `chosy_pro` → `chosy_plus` olarak düzeltildi. RC dashboard'a
dokunulmadı, sadece DB'deki 3 satır (`entitlement_id`: `'premium'` →
`'chosy_plus'`) M0 Faz 2'de düzeltildi.

## F-03 — Watchlist "duplicate" veri sorunu değil, kod sorunu

`UNIQUE(user_id, film_id)` kısıtı zaten var, 311/311 satır benzersiz, 0
duplicate. C.9d artık saf kod konsolidasyonu (iki ekran → bir ekran), veri
merge riski yok.

## F-04 / E-08 — Sessiz kimlik sıfırlama riski (yeni bulgu)

Anonim session sessiz sıfırlanabiliyordu (`_layout.tsx:324-335`, üç `catch`
bloğu Kural 1 ihlali — sessiz fallback yasak). Bu, G-9 gate'ini (relaunch
sonrası mevcut kullanıcı kaybı <%20) doğrudan tehdit ediyor: bir kullanıcı
sessizce sıfırlanırsa hem kendisi hem biz fark etmeyiz. M0 Faz 2 kapsamına
alındı.

**F-05 (Faz 2 sonrası):** In-app `SIGNED_OUT` yolu görünür hale getirildi
(`app/_layout.tsx`, commit 07e91d3). Ancak en sık kayıp yolu — cold start'ta
AsyncStorage restore başarısızlığı — hiç `SIGNED_OUT` yayınlamıyor, temiz
kurulum gibi görünüyor ve mevcut event bunu yakalamıyor. **Karar (17 Ağu, M0
Faz 3 olarak kilitlendi):** yeni, auth session'dan bağımsız bir diagnostic
persistence key (`chosy_last_known_auth_id_suffix`, AsyncStorage, hassas
veri değil) eklenir; cold start'ta karşılaştırma yapılır, farklıysa
`identity_reset_detected` `trigger: 'cold_start'` ile ateşlenir.

**F-06 (Faz 3 sonrası):** Mantık `utils/identityReset.ts`'e izole edildi ve
10/10 Deno birim testiyle kanıtlandı — iz yok/aynı/farklı, callback hatası,
yazma sırası, üç-açılışlık uçtan uca senaryo. Apple/Google girişinde iz
tazeleme de eklendi (kasıtlı hesap geçişini yanlış pozitif saymamak için).

**Açık kalan tek madde:** cihaz üzerinde canlı doğrulama yapılmadı (Claude
Code'un cihaz erişimi yok) — CTO'ya devredildi, C.9a test build'i
dağıtılmadan önce manuel olarak yapılacak.

## Yan Bulgular (M0 Faz 2/3 raporlarından, bible §9)

| Bulgu | Not |
|---|---|
| `subscriptions.entitlement_id` kolonu migration geçmişinde yok, canlıda var (schema drift) | R-B'de "yakalama" migration'ı yazılacak. Temiz `db reset` şu an bu kolonu üretmiyor. |
| `npm run test:founder` 3/5 (wong_kar_wai, no_marvel FAIL) | Ayrı incelenecek, v1 kapsamı dışı. |
| Cold-start identity reset — cihaz doğrulaması yapılmadı | CTO tarafından C.9a build'i dağıtılmadan önce elle doğrulanacak. |
| Tam depo silinmesi (reinstall) kimlik kaybını ölçmüyor | Bilinçli olarak ertelendi — `expo-secure-store` yeni bağımlılık gerektirir, v1 sonrası yeniden değerlendirilecek. |
