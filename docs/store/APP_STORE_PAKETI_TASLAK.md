# App Store paketi — taslak (v2.1.0)

> **Durum:** TASLAK, 7 Eki 2026. App Store Connect'e henüz girilmedi.
> Kaynak: kod (dosya:satır aşağıda) + bible `7_CHOSY_V1_KAPSAM_KILIDI.md` v1.45.
> `docs/LAUNCH_CHECKLIST.md` (25 Nis 2026, mood-search dönemi) bu dosyanın
> kapsadığı alanlarda **geçersizdir**: inceleme notu, IAP tablosu, demo hesap,
> ekran görüntüsü planı.
> ⚠️ işaretli satırlar doğrulanmadı — ASC'ye girmeden önce kurucu kontrol eder.

---

## 1. App Review notları (EN, ASC "Notes" alanına)

```
Chosy is a nightly movie ritual: every evening the app shows four films,
the user picks between them in three quick rounds, and one film becomes
tonight's champion, with where to watch it.

NO LOGIN IS REQUIRED. The app starts with an anonymous session. Sign in
with Apple is optional and only offered later to keep picks across devices
(Profile > gear icon (Settings) > Sign in with Apple, or a prompt after a
champion from the second day on).

How to test:
1. Launch the app and go through the three intro cards.
2. The first set of four films appears immediately, at any time of day.
   (For regular use a new set unlocks every evening at 18:00 local time;
   a brand-new user is always given a set to play right away.)
3. Choose one film in each of three rounds. The champion screen shows the
   winner, where to watch it (TMDB / JustWatch data), Save for later and Share.
4. Below the champion there is an optional daily bonus game ("Spotlight":
   guess the film from a blurred frame).
5. After the champion, the Home screen shows a countdown to the next set.

In-App Purchases ("Chosy Plus", auto-renewable):
- Reachable at any time: Profile tab > "Upgrade to Plus".
- Monthly and Annual plans, each with a free trial. Restore Purchases is on
  the same screen.
- What Plus unlocks: replaying missed evenings from the archive, and
  unlimited searches in Pro Mode (mood-based search).

Account deletion (Guideline 5.1.1(v)):
Profile tab > gear icon (Settings) > "Delete Account" > "Delete Permanently".
This deletes the account and all associated data.

Film data and images are provided by TMDB. This product uses the TMDB API
but is not endorsed or certified by TMDB.
```

**Kaynaklar ve açık noktalar:**

| İddia | Kanıt | Durum |
|---|---|---|
| Giriş zorunlu değil, anonim başlangıç | K-12 (bible `:69`) | kod yolu bu turda okunmadı |
| SIWA isteğe bağlı: Settings modalı (yalnız anonim + iOS), gün 2+ prompt | K-60 (`:74`), `app/(tabs)/profile.tsx:550-551` | — |
| Yeni kullanıcı 18:00 öncesi de hemen oynar | E-21 (`:780`), TestFlight checklist B1 | ⚠️ cihazda doğrulanmadı (B1 `[ ]`) |
| Paywall'a her an erişim: Profile > Upgrade to Plus | `profile.tsx:581-585`, `locales/en.json` `profile.upgradePlus` | — |
| Restore aynı ekranda | `components/paywalls/PaywallBase/index.tsx:262,486` | — |
| Hesap silme yolu, anonim kullanıcıda da görünür | `profile.tsx:682-690` (Settings modalı, destructive grup, koşulsuz) | cihazda doğrulanmadı |
| TMDB atıf metni | `locales/en.json:326` | JustWatch atfı ⚠️ doğrulanmadı |

**⚠️ İnceleme riski — Plus'ın "replay missed days" değeri incelemede gösterilemez.**
Arşiv ancak 2. kaçırılan günde açılıyor (K-46); yeni bir inceleme hesabında
kaçırılmış gün yok. Apple, IAP'lerin inceleme sırasında erişilebilir ve işlevsel
olmasını istiyor (SONHALİ §70 Store Gate notu). Satın alma ekranına erişim var,
ama satın alınan ana değer test edilemiyor. Seçenekler (CTO kararı):
(a) notta açıkça yazmak ("archive becomes available after missed evenings");
(b) inceleme için hazırlanmış, geçmişi olan bir demo hesap (bkz. §3).

---

## 2. In-App Purchase tablosu

Kaynak: K-59 (bible `:137`, ASC + RevenueCat ölçümü, 24 Eyl 2026) ve
`constants/subscriptionPlans.ts:56-70`.

| Ürün ID | Tür | Fiyat (US) | Deneme | Uygulamada satılıyor mu |
|---|---|---|---|---|
| `com.chosy.monthly` | Auto-renewable | $6.99 / ay | 3 gün | Evet |
| `com.chosy.annual` | Auto-renewable | $39.99 / yıl | 7 gün | Evet (ön seçili) |
| `com.chosy.lifetime` | Non-consumable | $89.99 | — | **Hayır** — ASC'de Approved, uygulamada gösterilmiyor (D-08, `paywall_lifetime_enabled=false`) |
| `chosyai_weekly` / `chosyai_monthly` / `chosyai_yearly` | Eski (v1.x) | — | — | Hayır — yalnız mevcut aboneler için eşleniyor (`subscriptionPlans.ts:151-153`). ⚠️ ASC'deki durumları doğrulanmadı |

Entitlement: `chosy_plus` (K-48). Abonelik grubu adı: ⚠️ ASC'den okunacak
(eski doküman "Chosy Premium" diyor, güncelliği bilinmiyor).

⚠️ Lifetime ürünü ASC'de "satışta" görünüyor ama uygulamada satın alma yolu yok.
Bunun bir inceleme sorunu yaratıp yaratmayacağı doğrulanmadı.

---

## 3. Demo hesap

**Gerekmiyor** — uygulama girişsiz kullanılabiliyor (K-12). ASC'de "Sign-in
required" **kapalı** işaretlenir.

İstisna: §1'deki arşiv riski için (b) seçilirse, geçmişi olan bir test hesabı
hazırlanır. Bu durumda giriş yöntemi yalnız Sign in with Apple olduğu için
(K-14, e-posta UI kapalı) Apple'a kullanıcı adı/şifre verilemez. Bu seçenek
pratikte uygulanamayabilir — CTO kararı.

---

## 4. Kurucunun tamamlayacağı / doğrulayacağı alanlar

| Alan | Gereken | Durum |
|---|---|---|
| Gizlilik politikası | İçerik: anonim kimlik, PostHog, Sentry, RevenueCat, Apple girişi, hesap silme. URL: `abalone-dracopelta-382.notion.site/…Privacy-Policy…` (`profile.tsx:643`, `PaywallBase/index.tsx:62`) | ⚠️ içerik ve tarih okunmadı |
| Kullanım şartları | URL `www.notion.so/…Terms-of-Service…` (`profile.tsx:656`) — yayımlanmış `notion.site` alanı değil, giriş yapmamış kullanıcıya açılıyor mu? | ⚠️ |
| Support URL | Şu an gizlilik sayfası kullanılıyor | ⚠️ ayrı sayfa ya da e-posta |
| App Privacy etiketleri | PostHog (analitik), Sentry (tanılama), RevenueCat (satın alma), Apple girişi (e-posta/relay, isteğe bağlı) | ⚠️ ASC'deki mevcut beyan okunmadı |
| Ekran görüntüleri | R-10: tek sayfa, 6 ekranlık anlatı (Stop scrolling → Four films → Three choices → One winner → Your taste evolves → Tomorrow we know you better) | ⚠️ "Your taste evolves" K-32 gereği v1'de yok — R-16 (var olmayan özelliği satma) ile çelişir; 5. kare değişmeli |
| Ad / alt başlık / açıklama / anahtar kelimeler | Eski metin "Mood Movie Finder" | ⚠️ yeniden yazılacak (ayrı tur) |
| Kademeli dağıtım (E-06) | ASC Phased Release + durdurma ölçütü | ⚠️ plan yok |
