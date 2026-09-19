# 🔄 CHOSY IA REVİZE — KARAR GÜNLÜĞÜ

**Tarih:** 17 Ağustos 2026
**Bağlı:** `1_PRODUCT_OS` · `2_BUSINESS_MODEL` · `3_DESIGN_OS` · `4_CLAUDE_CODE_OS`
**Tetikleyici:** Faz C "tamamlandı" olarak işaretlenmişti ama cihaz testinde ortaya çıktı ki gauntlet mekaniği hiç production'a çıkmamış — üretim nav'ı hâlâ pre-pivot (v1/v2) mimariyi taşıyor.

> Bu doküman bir uygulama planı değil, **karar kaydıdır.** Uygulama C.9a-d Claude Code promptlarıyla ayrı ayrı yapılacak.

---

## 0. KÖK BULGU

`app/dev-gauntlet.tsx` — kök stack'te, `__DEV__` gated, production build'de `Redirect href="/"`. Tüm repoda oraya giden tek yol Home'daki geçici `__DEV__` test butonu (kendi yorumunda "GEÇİCİ, TestFlight öncesi kaldırılacak" yazıyor).

**Sonuç:** Faz C'de inşa edilen bileşenler (gauntlet, champion, contextbar, spotlight, watch feedback, poster fix) teknik olarak var ve `__DEV__` modunda cihazda doğrulandı — **ama gerçek kullanıcı hiçbir zaman gauntlet'i görmedi.** "Faz C tamamlandı" ifadesi bileşen envanteri anlamında doğru, ürün anlamında yanlıştı.

---

## 1. ENVANTER BULGULARI (özet)

| Alan | Bulgu |
|---|---|
| Tab bar | 3 görünür (Home=mood search, Discover=mood.tsx, Profile) + 1 gizli (Watchlist, `href:null`) |
| Home (`index.tsx`) | Tam eski mood search — arama kutusu, 8 mood kartı, `quotaEngine`'e bağlı "X left today" |
| Gauntlet | `dev-gauntlet.tsx`, production'da erişilemez |
| Discover (`mood.tsx`) | Trending This Week (canlı Supabase verisi) · Coming Soon (canlı) · Today's Pick (`preferences_vector` tabanlı, gauntlet'ten bağımsız 3. öneri motoru) · Cinema Games (temiz, `games_enabled` doğru okunuyor) |
| Profile | Quiz canlı (`archetype_id` yazıyor, §5.2 kilidiyle gerilimde) · iki ayrı paywall CTA'sı (Plus / Founding Member, iki farklı RevenueCat offering) · Badge sistemi (**yazan kod yok**, kalıcı 0/0, görsel olarak yanıltıcı) |
| Watchlist | İki ayrı ekran (`watchlist.tsx` gizli + `watchlist-detail.tsx` gerçek erişim yolu) |
| Poster bug | "Mother" (2009) posteri boş geldi — bilinen listeye (Kiki's, Godzilla Minus One, Peter Pan, Last Tango, Twin Peaks) yeni bir örnek eklendi, kök neden ayrı doğrulanmalı |
| C.6 (oyun budaması) | ✅ Temiz, regresyon yok |

---

## 2. IA KARARLARI

### 2.1 Tab yapısı — 2 tab

**Home + Profile.** Gerekçe: NYT Games vakası (5→3 tab, ama onların çoklu günlük oyunu var — Games/Stats/Leaderboard; Chosy'nin tek oyunu (gauntlet) onların 3 game-slotuna karşılık geliyor, "Stats" Profile'a denk düşüyor, "Leaderboard" eşleniği yok çünkü grup gauntlet Faz 2, veri/marka katmanı 36+ ay ötede). Apple HIG: az tab varsayılan tavsiye. Kurucunun felsefesi: "tek görev, ikinci görev yok."

### 2.2 Discover — nav'dan kalkıyor, kod donuyor

Trending/Coming Soon/Today's Pick karar felcini yeniden üretiyor (§1.3 "serbest metin değil" ruhuna aykırı: "işte daha fazla film, seç"). `app_config` flag ile kapatılır (C.6 deseni) — silinmez.

**Today's Pick (`preferences_vector` sistemi):** Discover ile birlikte söner, ayrı işlem gerekmiyor — gauntlet'in zaten çözdüğü sorunu tekrar çözmeye çalışan 3. bir öneri motoruydu.

### 2.3 Home — tek route, state machine

```
Uygulama açılır
   │
   ├─ Bekleyen "dün izledin mi?" var mı?  → PendingWatchFeedbackCard (C.4, mevcut) önce
   │
   ├─ Bugünün gauntlet'i henüz üretilmedi (18:00 öncesi) → bekleyiş ekranı
   │
   ├─ Bugünün gauntlet'i üretildi, bitmedi → ContextBar + Round N/3
   │
   └─ Bugünün gauntlet'i bitti → Şampiyon ekranı SABİT
          (tekrar girilince aynı ekran, yeniden oynatmaz)
          altında: "Bugünün bonusu: Spotlight" kartı
```

**Şampiyon ekranı gap'i (envanterde bulundu):** Şu an sadece "Share · Close" var. Eksik: **"Sonraya bırak"** (→ watchlist'e manuel giriş) ve **"Nerede izlenir"** (§3.9). C.9b kapsamına eklendi.

### 2.4 Watchlist — tek ekran, otomatik giriş yok

İki kopyadan biri kaldırılır, Profile altı alt sayfa olarak kalır (ayrı tab değil — haftada birkaç kez dönülen bir yüzey, günlük değil).

**Kilidin teyidi (§3.7):** Şampiyon otomatik watchlist'e gitmez. Tek giriş yolu: şampiyon ekranındaki manuel "Sonraya bırak" dokunuşu. Watch feedback döngüsü (C.4) ile karıştırılmaz — o her gün otomatik sorulur, şampiyon olsun olmasın; watchlist sadece manuel.

### 2.5 Mood search → Pro Mode

Home'dan çıkar, Profile altına "Pro Mode" girişi olarak taşınır (paywalled, Business Model OS §4 Katman 1 ile eşleşir).

### 2.6 Spotlight — ayrı hub yok

Discover kalktığı için Cinema Games section de gidiyor. Spotlight sadece şampiyon ekranının altında "bugünün bonusu" kartı olarak yaşar (§7.1 "ritüelin çıkışında" ilkesiyle tam uyumlu). Kalıcı, geri dönülebilir bir erişim noktası yok — veri/kullanıcı sayısı arttığında genişletilebilir, şimdi değil.

### 2.7 Badge / Collections sistemi — UI kaldırılıyor

Yazan kod hiç yok (`user_collection_progress` tablosuna hiçbir INSERT/UPDATE/trigger/RPC yazmıyor), kalıcı 0/0, görsel olarak yanıltıcı. Tablo/seed'e dokunulmuyor, sadece UI kaldırılıyor.

### 2.8 Kapsam dışı bırakılanlar (bu tur)

- **Quiz** ("Discover your type" / "Retake Quiz") — dokunulmuyor. Not: §5.2 kilidiyle gerilimde olduğu envanterde işaretlendi, ayrı bir turda karar bekliyor.
- **Onboarding zorunluluğu** — `/onboarding` route'unun ilk açılışta zorunlu mu opsiyonel mi olduğu doğrulanmadı, tahmin edilmedi. Ayrı envanter sorusu olarak açık.

---

## 3. BUSINESS MODEL / PAYWALL KARARLARI

**63 gerçek kullanıcı ✅ → hâlâ Faz 0 (0-1K).** Business Model OS §8.10 kuralı: *"Her şey ücretsiz. Tek istisna: arşiv paywall'ı."* Mevcut iki-CTA'lı Profile yapısı Faz 1 davranışıydı — bu turda geri Faz 0'a hizalanıyor.

| Karar | Detay |
|---|---|
| Tek paywall tetikleyicisi | İlk kaçırılan gün — arşivden oyna. İlk kaçırma ücretsiz telafi edilir, ikinciden Pro. |
| Ertelenen tetikleyiciler | 7. gün DNA reveal · 3. "izledim" onayı · grup moduna tıklama · 3. yenileme denemesi — hepsi Faz 1'e |
| CTA konsolidasyonu | "Upgrade to Plus" + "Founding Member" iki butonu → **tek "Chosy Pro" CTA'sı** (Founding Member aynı akışın parçası, ayrı buton değil) |
| Affiliate | Arka planda aktif kalır ("nerede izlenir" linkleri), paywall olarak gösterilmez |
| Gerekçe | 63 kullanıcıda 5 varyant istatistiksel gürültü üretir (§8.7'nin kendi uyarısı). Tek tetikleyici, tek varyant, temiz sinyal. |

---

## 4. CINEMA DNA RADAR GÖRSELLEŞTİRME — kavramsal onay, uygulama ertelendi

Kurucunun paylaştığı radar chart mockup'ı konsept olarak benimsendi (§5.4'ü zenginleştiriyor) ama olduğu gibi alınmadı — üç çelişki tespit edildi:

| Mockup'ta | Sorun | Karar |
|---|---|---|
| 8 eksenli çoklu-hue renk sistemi | Design OS §17'nin öldürdüğü "tür-kodlu 5 renkli palet" kararına geri dönüş | Tek `marquee`/`beam` ailesi |
| 8 eksenli "kalite" taksonomisi (Hikaye, Yönetmen, Görsel, Aksiyon, Duygu, Gerilim, Felsefe, Karakter) | Product OS §6.5'teki 6 çeşitlilik ekseniyle (tempo→yoğunluk→karanlık→gerçekçilik→dönem→dil) uyuşmuyor — biri film kalitesi, diğeri kullanıcı zevk tercihi ölçüyor | Mevcut 6 eksene hizala |
| Alt-kırılım (Empati, Bağ Kurma, Duygusal Etki, Hüzün) | Bu granülerlikte veri toplanmıyor, `cinema_dna` tek cache | Ertele |
| 5 tab nav (Ana Sayfa/Keşfet/Oyunlar/Watchlist/Profil) | Bu oturumun 2-tab kararıyla çakışıyor | Yok say |

**Zamanlama:** C.9 dizisi (nav restructure) bittikten sonra, ayrı bir turda — basitleştirilmiş 6 eksenli, tek renk ailesiyle, alt-kırılımsız versiyon tasarlanacak.

---

## 5. UYGULAMA SIRASI (Claude Code, ayrı `/clear`, ayrı DUR NOKTASI)

| # | İş | Kapsam |
|---|---|---|
| **C.9a** | Tab bar 3→2 + Discover `app_config` flag'iyle kapatma | Nav iskeleti |
| **C.9b** | Home state machine (dev-gauntlet → production Home, mood search çıkar, bekleme/şampiyon durumları, şampiyon ekranına "Sonraya bırak" + "Nerede izlenir" ekleme) | Home |
| **C.9c** | Profile restructure — Pro Mode girişi, paywall CTA konsolidasyonu, badge UI kaldırma | Profile |
| **C.9d** | Watchlist ikili kopya temizliği | Watchlist |

---

*17 Ağustos 2026 · Sonraki adım: C.9a promptu*
