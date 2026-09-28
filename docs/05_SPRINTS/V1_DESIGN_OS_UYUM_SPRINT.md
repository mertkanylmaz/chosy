# V-1 — Design OS Uyum Sprinti → TestFlight → App Store

> Konum önerisi: `docs/05_SPRINTS/ACTIVE/V1_DESIGN_OS_UYUM_SPRINT.md`
> Sahip: CTO oturumu (claude.ai) · Uygulayıcı: Claude Code (her tur yeni `/clear`)
> Kaynak: 27 Eylül 2026 UI denetimi + Design OS / Kapsam Kilidi uyum analizi

---

## 0. Çerçeve

**Amaç:** Build'i Design OS'a hizalamak, denetimde bulunan P0 bug'ları kapatmak, day-0 aktivasyon riskini doğrulamak/kapatmak.

**Kapsam dışı (bu sprintte dokunulmaz):**
- Cinema DNA radar (post-C.9 backlog)
- Yeni paywall tetikleyicisi (K-46 tek tetikleyici)
- Arşive bedava erişim / bekleme ekranında ikincil keşif rotası
- Tab bar değişikliği (K-01, K-04)
- `types/gauntlet.ts` sözleşmesi
- Yeni tablo/kolon (gerekirse DUR)

**R-B ile ilişki:** V-1 turları UI yüzeyine dokunur; R-B'nin kalan kalemleri (migration 107, K-42, Wave 2/3, K-37, K-43) backend/servis yüzeyindedir. **Paralel koşabilir, ama aynı anda aynı dosyaya dokunan iki oturum açılmaz.** Çakışma riski: `errorHelpers.ts` (Wave 3) ve Home state machine (K-42). Tur 3 başlamadan K-42 kod durumu teyit edilir.

**Launch kapısı:** V-1 bitmesi launch demek değildir. App Store'a çıkış = R-B kapanışı + R-C enstrümantasyonu + 6 release gate (K-52) + TMDB lisansı (K-56). Bkz. §9.

### Tur haritası

| Tur | İş | Model | Mod | Bağımlılık |
|---|---|---|---|---|
| 0 | Keşif envanteri (read-only) | Sonnet 4.6 | Plan | — |
| 1 | P0 bug'lar: hex ID, çift başlık, entitlement upsell, isimlendirme | Sonnet 4.6 | Normal | 0 |
| 2 | Day-0: 18:00 öncesi yeni kullanıcı | Opus 4.8 | **Plan + DUR** | 0 |
| 3 | Bekleme ekranı (seçenek C) | Opus 4.8 | Plan | 0, 2 |
| 4 | Profil K-08 hizalaması + avatar | Sonnet 4.6 | Normal | 1 |
| 5 | Settings standartlaştırma | Sonnet 4.6 | Normal | 0 |
| 6 | Playfair tasfiyesi + Pro Mode paleti | Sonnet 4.6 | Normal | 4, 5 |
| 7 | Entegrasyon doğrulaması + bible güncellemesi | Sonnet 4.6 | Normal | 1–6 |
| 8 | TestFlight toplu cihaz oturumu | Kurucu | — | 7 |

Önerilen sıra: `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`. Tur 4/5 bağımsızdır, istenirse yer değiştirir. Tur 6 en sona yakın kalır çünkü tipografi taraması diğer turların dokunduğu dosyaları da kapsar.

---

## Ortak kurallar (her prompt bunlara atıf yapar)

- `docs/os/4_CHOSY_CLAUDE_CODE_OS.md` §4 standart kısıt bloğu geçerli — oturum başında oku.
- `.claude` altındaki `chosy-conventions` kuralları geçerli.
- Tek mantıksal değişiklik = tek commit. `git add .` yasak; dosya bazında `git add`, parantezli Expo Router path'leri tırnakla.
- Commit formatı: `<tip>(<scope>): <açıklama>` (Türkçe).
- Gate'ler: `npm run typecheck` → **tam 14, hepsi `scripts/` altında**. `npm run typecheck:functions` → tur başında ölç, artmamalı.
- i18n: `en.json` + `tr.json` parite. Tur başında sayıyı ölç (son bilinen 1316/1316), tur sonunda eşit ve artmış/aynı olmalı.
- Renk/boşluk/tipografi yalnızca `constants/design/semantic.ts` üzerinden. Hardcoded değer yasak.
- Phosphor ve Ionicons aynı ekranda yan yana görünmez.
- Görsel retrofit'te **logic değişmez** — bu kuralı çiğneyen her değişiklik DUR.
- Rapor: onay alınan kararlar soru → cevap olarak açıkça listelenir.

---

## TUR 0 — Keşif envanteri 🔍 READ-ONLY

```markdown
## BAĞLAM
V-1 Design OS uyum sprintinin ilk turu. 27 Eylül UI denetimi build'in Design OS'tan
saptığını gösterdi (Playfair hâlâ kullanımda, tür-kodlu mood paleti, entitlement'a
duyarsız upsell, K-08 dışı Profile bölümleri). Kod yazmadan önce gerçek durumu
envanterliyoruz. Bu tur HİÇBİR dosyayı değiştirmez.

## GÖREV
Aşağıdaki her madde için dosya:satır referansıyla cevap ver. Tahmin yok; bulamadığın
şeyi "bulunamadı" diye yaz.

1. Tipografi: `Playfair` geçen tüm dosyalar (font yükleme dahil). Toplam kullanım sayısı,
   ekran bazında dağılım. Archivo Expanded ve Martian Mono'nun yüklendiği yer ve
   kullanıldığı ekranlar.
2. Profile ekranı: render edilen bölümlerin sırası ve her birinin bileşeni.
   "Discovery Stats", "Taste DNA", kullanıcı adı altındaki hex ID'nin kaynağı
   (hangi alan, nasıl formatlanıyor).
3. SectionHeader + kart içi başlık tekrarı: bu desenin geçtiği tüm yerler.
4. Entitlement: "Explore in Pro Mode" ve "Chosy Plus Active" metinlerinin render koşulu.
   Entitlement kontrolü hangi hook/servisten okunuyor? `chosy_plus` aktif kullanıcı
   upsell görüyor mu — koşulu satır satır göster.
5. "Plus" / "Pro" isimlendirmesi: kullanıcıya görünen tüm "Plus" string'leri (locale key'leri).
6. Home state machine: mevcut state enum'u (K-03 ile karşılaştır). `waiting` state'ine
   hangi koşulda girilir? Gauntlet'in hazır olacağı zaman istemcide nereden geliyor —
   sunucudan bir timestamp mı, istemcide hardcoded 18:00 mı?
7. Day-0: temiz kurulum yapan, hiç gauntlet'i olmayan bir kullanıcı 18:00 öncesi
   onboarding'i bitirince hangi state'e düşer? Kod yolunu adım adım izle.
   `generate-gauntlet` tetikleme yolları (cron, istemci çağrısı, on-demand) neler?
8. Dünkü şampiyon: istemci dünkü champion verisine (poster/backdrop dahil) mevcut bir
   servis/sorgu ile erişebiliyor mu?
9. Bildirim izni: NotificationPromptSheet (K-15) tetikleme koşulu, izin durumunun
   okunduğu yer.
10. Settings: tüm satırlar, her toggle'ın yazdığı yer (AsyncStorage key / DB kolonu /
    OneSignal-Expo push tag vb.). "Daily Cinema Pick" ve "Watchlist Reminders"
    toggle'ları gerçekte bir şey tetikliyor mu?
11. Apple Sign In: kullanılan paket ve bileşen. `expo-apple-authentication` kurulu mu?
    K-14 e-posta magic link akışının Settings'te giriş noktası var mı?
12. Avatar modalı: asset'lerin konumu, seçimin yazıldığı yer, seçim state'i.
13. Pro Mode ekranı: mood kartı renklerinin kaynağı, CTA'nın disabled koşulu,
    "N left today" sayacının kaynağı ve limit değeri.
14. Streak ve Watched: Profile'da göstermek için gereken veri mevcut bir servis/sorgu ile
    okunabiliyor mu (`update_streak`, `watch_feedback`)? Yeni sorgu gerekir mi?
15. Gate baseline'ları: `npm run typecheck`, `npm run typecheck:functions` çıktı sayıları,
    `en.json`/`tr.json` key sayıları.

## KISITLAR
- Hiçbir dosyayı değiştirme, hiçbir komutla state yaratma (build, install, db push yok).
- Standart kısıt bloğu geçerli (4_CHOSY_CLAUDE_CODE_OS §4).

## DUR NOKTALARI
- Yok. Rapor bitince dur.

## DOĞRULAMA
- `git status` temiz olmalı. Çıktıyı yapıştır.

## RAPOR
15 maddenin her biri için: bulgu + dosya:satır. Sonunda "CTO kararı gerektiren
açık sorular" başlığıyla, envanterden çıkan belirsizlikleri listele.
```

**CTO notu:** Tur 0 raporu CTO oturumuna döner. Tur 2 ve Tur 3 promptları bu rapora göre kesinleştirilir (özellikle madde 6, 7, 8).

---

## TUR 1 — P0 bug'lar 🐛

```markdown
## BAĞLAM
V-1 Tur 1. Tur 0 envanteri tamamlandı. Kullanıcıya görünen dört P0 hatayı kapatıyoruz.
Hepsi Profile yüzeyinde, logic değişikliği yalnızca 3. maddede (render koşulu).

## GÖREV
1. Hex ID: Profile'da kullanıcı adı altındaki ID satırını tamamen kaldır. Yerine hiçbir
   şey koyma. Alanın başka bir yerde (paylaşım, destek) kullanılıyorsa dokunma —
   yalnızca bu render kaldırılır.
2. Çift başlık: SectionHeader + kart içi aynı başlık desenini Profile'daki tüm
   örneklerde kaldır. Kart içi başlık silinir, SectionHeader kalır. Kart iç padding'i
   token'la yeniden hizala.
3. Entitlement upsell: `chosy_plus` aktif kullanıcıya "Explore in Pro Mode" gösterilmez.
   Koşul, Tur 0'da tespit edilen mevcut entitlement kaynağından okunur — yeni kaynak
   yaratma. Entitlement yüklenirken (unknown) upsell gösterilmez.
4. İsimlendirme: kullanıcıya görünen "Chosy Plus" → "Chosy Pro" (IA kararı: tek
   "Chosy Pro" adı). Yalnızca locale değerleri değişir; entitlement id `chosy_plus`,
   RevenueCat identifier'ları, analytics event property'leri DEĞİŞMEZ.

## KISITLAR
- Standart kısıt bloğu geçerli.
- `chosy_plus` entitlement id'si, RC offering/product id'leri, PostHog event adları ve
  property değerleri değişmez.
- Profile bölüm sırası bu turda değişmez (Tur 4'ün işi).
- Yeni locale key açma; mevcut key'lerin değerini değiştir. Key silinirse EN/TR birlikte.

## DUR NOKTALARI
- Entitlement kontrolü birden fazla kaynaktan okunuyorsa (ör. hem RC SDK hem DB),
  hangisini kullanacağını sorma — DUR ve durumu raporla.

## DOĞRULAMA
- `npm run typecheck` → 14, hepsi scripts/ altında.
- Locale parite: iki dosyanın key sayısı eşit (komut + çıktı).
- `git grep -n "Chosy Plus" -- locales` → kullanıcıya görünen değer kalmamalı.

## RAPOR
- 4 commit (madde başına bir). Commit hash'leri + mesajları.
- Madde 3 için: upsell'in gösterildiği/gizlendiği üç durum (aktif, pasif, loading) ve
  kod yolu.
- Onay alınan kararlar: soru → cevap.
```

Beklenen commit'ler:
`fix(profile): kullanıcı ID satırını kaldır` · `fix(profile): çift bölüm başlıklarını kaldır` · `fix(profile): aktif abonelere Pro Mode upsell gösterme` · `fix(i18n): Chosy Plus → Chosy Pro görünen ad`

---

## TUR 2 — Day-0: 18:00 öncesi yeni kullanıcı 🔴 PLAN MODU + DUR

**Karar çerçevesi (CTO oturumunda Tur 0 raporuna göre kesinleşir):**

| Tur 0 bulgusu | Aksiyon |
|---|---|
| Yeni kullanıcı 18:00 öncesi gauntlet alıyor | Tur 2 = yalnızca doğrulama testi eklenir, kod yok. Tur 3'e geç. |
| Yeni kullanıcı `waiting`'e düşüyor | **Seçenek A (önerilen):** hiç gauntlet'i olmayan kullanıcı için on-demand ilk gauntlet üretimi. **Seçenek B:** ilk oturumda bekleme ekranına onboarding bağlamı eklemek (aktivasyon değeri yine sıfır — reddedilmesi önerilir). |

Seçenek A'nın gerekçesi: SONHALİ §8 first-session hedefi 0:03'te ilk savaş. 18:00 öncesi kurulum yapan her kullanıcı için bu hedef şu an kırılıyor olabilir. Bu, D1 retention'ı herhangi bir görsel revizyondan daha çok etkiler.

```markdown
## BAĞLAM
V-1 Tur 2. Tur 0 envanterinin 7. maddesi, temiz kurulum yapan kullanıcının 18:00 öncesi
`waiting` state'ine düştüğünü gösterdi. First-session hedefi (SONHALİ §8): kullanıcı
açılıştan ~3 saniye sonra ilk savaşı görür. CTO kararı: hiç tamamlanmış/üretilmiş
gauntlet'i olmayan kullanıcı için ilk gauntlet on-demand üretilir.

## GÖREV (Plan modunda başla, planı onaya sun)
1. Mevcut `generate-gauntlet` tetikleme yollarını ve kullanıcı başına üretimin nasıl
   yapıldığını özetle.
2. On-demand ilk gauntlet için en dar değişikliği planla:
   - Koşul: kullanıcının hiç gauntlet kaydı yok VE bugünün gauntlet'i yok.
   - Tetikleyici: istemci, Home `waiting` kararını vermeden önce.
   - Aynı Edge Function mı kullanılacak, yeni parametre mi gerekecek, yetkilendirme nasıl
     (anon kullanıcı dahil)?
   - Idempotency: çift çağrı iki gauntlet üretmemeli (mevcut unique kısıt var mı?).
   - Bugünün gauntlet'i on-demand üretildiyse 18:00 cron'u aynı kullanıcı için ikinci
     gauntlet üretmemeli.
   - Streak etkisi: ilk gün on-demand oynanan gauntlet streak'i nasıl etkiler?
3. Onay sonrası uygula.

## KISITLAR
- Standart kısıt bloğu geçerli.
- `types/gauntlet.ts` sözleşmesi değişmez.
- Yeni tablo/kolon/Edge Function eklenmez — gerekiyorsa DUR.
- Hata sessizce `waiting`'e düşmez: on-demand üretim başarısızsa Sentry + K-03
  `error_recovery` state'i.
- Mevcut kullanıcıların (en az bir gauntlet'i olan) akışı değişmez.

## DUR NOKTALARI
- Plan onayı (zorunlu).
- Edge Function imzası/parametresi değişecekse.
- Idempotency için şema değişikliği gerekiyorsa.
- Yeni 4xx yolu açılıyorsa: client fix kullanıcılara ulaşmadan deploy edilmez (K-44).

## DOĞRULAMA
- `npm run typecheck` → 14. `npm run typecheck:functions` → baseline'dan artış yok.
- Canlı doğrulama: test anon kullanıcısıyla on-demand çağrı → `count=exact` ile tam 1
  gauntlet kaydı. İkinci çağrı → hâlâ 1.
- 18:00 cron simülasyonu (mevcut yol neyse) → aynı kullanıcı için ikinci kayıt yok.

## RAPOR
- Plan + onaylanan versiyon farkı.
- Idempotency mekanizması (hangi kısıt/kontrol).
- Streak etkisi kararı.
- Deploy sırası (function vs client) ve gerekçesi.
- Onay alınan kararlar: soru → cevap.
```

---

## TUR 3 — Bekleme ekranı (Seçenek C) ⏳

**Spesifikasyon:**

| Öğe | Kural |
|---|---|
| Arka plan | Dünkü şampiyon varsa backdrop, ağır blur + `ink` overlay. Yoksa düz zemin. Reduce Transparency → düz `charcoal`. |
| Merkez | Metin: "Bugünün dörtlüsü 18:00'de hazır." (Design OS §15.3). Altında geri sayım `meta` token (Martian Mono). |
| Hedef zaman | Sunucudan türetilir (Tur 0 madde 6). İstemcide hardcoded 18:00 yasak. |
| Sayaç sıfırlanınca | `waiting` içinde alt-faz: "Hazırlanıyor" + mevcut fetch yolunu tekrar dene. Yeni enum değeri açılmaz. |
| Dünkü şampiyon kartı | Poster küçük + başlık + "Dünün filmi". İkincil aksiyon yok. Veri yoksa kart hiç render edilmez. |
| Bildirim CTA | Yalnızca izin `undetermined` VE kullanıcının ≥1 champion'ı varsa. Mevcut NotificationPromptSheet'i açar (K-15). |
| A11y | Reduce Motion → saniye hanesi gizli. VoiceOver: "2 saat 49 dakika". |
| Analytics | Yeni event: `waiting_notify_tapped`. Mevcut event sözlüğüne uygun isim/property. |

```markdown
## BAĞLAM
V-1 Tur 3. Home `waiting` state'i şu an ortada tek satır metin olan çıkışsız bir ekran.
CTO kararı (Seçenek C): geri sayım + koşullu bildirim CTA'sı + dünkü şampiyon özeti.
Arşive ve mood keşfine rota AÇILMAZ (K-46, IA "tek görev"). Tur 0 envanterinin 6, 8, 9.
maddeleri ve Tur 2 sonucu bu turun girdisidir.

## GÖREV
1. `hooks/useCountdown.ts` oluştur: sunucu kaynaklı hedef ISO timestamp alır, saniyede
   bir günceller, AppState `active` olunca yeniden senkronlar, sıfırda `onElapsed`'i bir
   kez tetikler. Sayaç ayrı `memo` bileşende render edilir (her saniye Home yeniden
   çizilmez).
2. Bekleme ekranını yukarıdaki spesifikasyon tablosuna göre yeniden kur. Tüm metinler
   `t()`, EN/TR parite.
3. Sayaç sıfırlandığında "Hazırlanıyor" alt-fazı: mevcut gauntlet fetch yolunu
   sınırlı tekrarla çağır (backoff). Tekrar limiti aşılırsa K-03 `error_recovery`
   state'ine geç + Sentry.
4. Bildirim CTA koşulunu uygula, NotificationPromptSheet'i yeniden kullan.
5. `waiting_notify_tapped` event'ini ekle.

## KISITLAR
- Standart kısıt bloğu geçerli.
- K-03 state enum'una yeni değer eklenmez. "Hazırlanıyor" `waiting` içinde alt-faz.
- İstemcide 18:00 hardcode edilmez. Sunucudan hedef zaman gelmiyorsa DUR.
- Arşiv, Pro Mode veya mood keşfine giden buton/link eklenmez.
- Bildirim izni ilk açılışta istenmez (K-15). CTA koşulu dışında izin sheet'i açılmaz.
- Cam yalnızca chrome katmanında; backdrop blur bir cam yüzeyi değil, arka plan
  görselidir — `GlassSurface` kullanma.
- Gradient yığını yok; overlay tek renk `ink` alfa.

## DUR NOKTALARI
- Sunucudan hedef timestamp alınamıyorsa (yeni alan/sorgu gerekiyorsa).
- Dünkü champion için yeni sorgu/servis gerekiyorsa.
- K-42 offline queue ile Home state machine'de çakışan değişiklik varsa.

## DOĞRULAMA
- `npm run typecheck` → 14.
- Locale parite eşit.
- Birim test: `useCountdown` — geçmiş hedef (anında elapsed), null hedef, arka plandan
  dönüş senaryosu, `onElapsed` tek sefer.
- Manuel senaryo listesi (TestFlight için, Tur 8'e aktarılır): dünkü champion var/yok,
  izin undetermined/granted/denied, sayaç sıfırlanması, Reduce Motion, Reduce
  Transparency, VoiceOver.

## RAPOR
- Hedef timestamp'in kaynağı (dosya:satır).
- Alt-faz tekrar politikası (deneme sayısı, backoff, limit).
- Eklenen locale key'leri (EN/TR).
- Onay alınan kararlar: soru → cevap.
```

---

## TUR 4 — Profil K-08 hizalaması + avatar 👤

**Hedef sıra (K-08):** Cinema DNA → Streak → Watched → Saved → Pro → Settings

| Bölüm | Kural |
|---|---|
| Cinema DNA | "Taste DNA" → "Cinema DNA". Anlatı kopyası (K-32), radar yok. Yetersiz veri → "Seni %N tanıyorum" + 9 segmentli güven göstergesi (`marquee` dolu segment). "Swipe" kelimesi kalkar. |
| Streak | Mevcut streak verisi (Tur 0 madde 14). Sıfırsa: "Henüz oynamadın. İlk gauntlet 18:00'de." tarzı davet kopyası. |
| Watched | `watch_feedback` sayısı. Sıfırsa davet kopyası. |
| Saved | Watchlist satırı (mevcut). |
| Pro | Tur 1'deki entitlement koşuluna uygun tek "Chosy Pro" girişi. |
| Discovery Stats | **Tamamen kaldırılır** (Movies Saved / Mood Sessions / Movies Watched kutuları). |
| Avatar modalı | 3D asset'ler → 9 Phosphor duotone glif, `marquee` renk, `charcoal` zemin. Seçili: `beam` kenar. Label 2 satıra izinli ya da kaldırılır. "Seç" butonu seçim değişmeden disabled. |

```markdown
## BAĞLAM
V-1 Tur 4. Profile, K-08'deki kilitli sırayla çelişiyor ve K-35 gamification audit'ini
geçmeyen "Discovery Stats" bölümünü taşıyor. Tur 1 tamamlandı (hex ID, çift başlık,
entitlement upsell). Bu tur bölüm sırasını, DNA anlatısını ve avatar modalını düzeltir.

## GÖREV
1. Profile bölümlerini K-08 sırasına diz: Cinema DNA → Streak → Watched → Saved → Pro →
   Settings.
2. Discovery Stats bölümünü ve bileşenlerini kaldır. Bileşen başka yerde kullanılmıyorsa
   dosyayı sil; kullanılıyorsa DUR.
3. Cinema DNA kartını anlatı moduna çevir (K-32): başlık "Cinema DNA", güven yüzdesi +
   9 segment. Mevcut veri kaynağını kullan, yeni hesaplama yazma.
4. Streak ve Watched satırlarını ekle (Tur 0 madde 14'teki mevcut kaynaklardan). Sıfır
   durumunda davet kopyası (Design OS §15.2 "Boşluk davettir").
5. Avatar modalı: asset'leri Phosphor duotone ile değiştir, seçim state'ini görünür yap,
   label kesilmesini kaldır, CTA disabled mantığını ekle. Seçimin yazıldığı yer ve
   saklanan değer DEĞİŞMEZ — mevcut kullanıcıların kayıtlı avatar değerleri yeni
   gliflere eşlenir (eşleme tablosu tek dosyada).
6. Eski 3D avatar asset'lerini bundle'dan çıkar (başka referans yoksa).

## KISITLAR
- Standart kısıt bloğu geçerli.
- Streak/Watched için yeni sorgu, RPC veya tablo yazılmaz — gerekiyorsa DUR.
- DNA hesaplama mantığına dokunulmaz (K-40: cache türetilir, kaynak değişmez).
- Avatar'ın saklanan değer formatı değişmez; eşleme istemci tarafında.
- Phosphor (marka anı: DNA, streak, avatar) ile Ionicons (fonksiyonel: ayar dişlisi,
  chevron) aynı satırda yan yana gelmez. Çakışma varsa raporla.

## DUR NOKTALARI
- Streak veya Watched verisi mevcut servisle okunamıyorsa.
- Discovery Stats bileşeni Profile dışında kullanılıyorsa.
- Kayıtlı avatar değerlerinden biri yeni glif setine eşlenemiyorsa.

## DOĞRULAMA
- `npm run typecheck` → 14.
- Locale parite eşit.
- `git grep -n "Discovery Stats\|Taste DNA\|Swipe more" -- locales app components` → 0.
- Asset boyutu: kaldırılan dosyaların toplam byte'ı.

## RAPOR
- Yeni bölüm sırası (bileşen listesi).
- Avatar eşleme tablosu (eski değer → yeni glif).
- Silinen dosyalar ve kaldırılan asset byte'ı.
- Onay alınan kararlar: soru → cevap.
```

---

## TUR 5 — Settings standartlaştırma ⚙️

| Satır | Kural |
|---|---|
| Dil | Tek satır "Dil · Türkçe ›" → action sheet (EN/TR). Mevcut dil değiştirme mantığı korunur. |
| Bildirim | **Tek** native `Switch`: "Akşam 18:00 bildirimi" (kilitli karar: günde tek push). "Daily Cinema Pick" ve "Watchlist Reminders" kaldırılır. |
| Hesap bağlama | `AppleAuthenticationButton` (native, HIG uyumlu, tam genişlik, `WHITE_OUTLINE` stil) + K-14 e-posta giriş noktası. |
| Abonelik | Mevcut satır; açıklama metni sistem dili taşımıyor mu kontrol (K-43). |
| Destructive grup | En altta: "İzleme listesini temizle" + "Hesabı sil". Aynı stil (kırmızı metin, kutu yok), ikisi de onay sheet'i. |

```markdown
## BAĞLAM
V-1 Tur 5. Settings ekranı HIG dışı bileşenler (On/Off hap butonlar, özel Apple butonu)
ve kilitli "günde tek push" kararıyla çelişen üç bildirim toggle'ı taşıyor. Tur 0
envanterinin 10 ve 11. maddeleri bu turun girdisidir.

## GÖREV
1. Dil seçimini tek satır + action sheet'e çevir. Dil değiştirme mantığı aynen korunur.
2. Üç bildirim toggle'ını tek native `Switch`'e indir. Bu switch'in yazdığı yer, Tur 0'da
   tespit edilen mevcut "Notifications" toggle'ının yazdığı yerdir.
3. Kaldırılan iki toggle'ın yazdığı depolama değerlerine dokunma (okumayı/yazmayı bırak,
   silme). Bu değerler bir şey tetikliyorsa (Tur 0 madde 10) DUR.
4. Apple butonunu `expo-apple-authentication`'ın `AppleAuthenticationButton`'ı ile
   değiştir. Auth akışının kendisi değişmez.
5. K-14 e-posta magic link giriş noktasını ekle (akış mevcutsa yalnızca giriş noktası;
   yoksa DUR).
6. Destructive aksiyonları alt gruba taşı, stili birleştir, ikisine onay sheet'i ekle
   (hesap silmede mevcut onay varsa onu kullan).
7. Settings'teki tüm On/Off hap bileşenlerinin başka ekranda kullanımı yoksa bileşeni sil.

## KISITLAR
- Standart kısıt bloğu geçerli.
- `expo-apple-authentication` kurulu değilse yeni bağımlılık = DUR.
- Hesap silme cascade'ine (K-16) dokunulmaz — yalnızca UI.
- Anon → authenticated yükseltme akışı (`updateUser` + `verifyOtp`) değişmez.
- DB kolonu/AsyncStorage key silinmez; yalnızca kullanım bırakılır. Bıraktığın her
  key'i rapora yaz (TEKNIK_BORC.md adayı).

## DUR NOKTALARI
- Yeni bağımlılık gerekiyorsa.
- Kaldırılacak toggle'lardan biri aktif bir push/cron yolunu besliyorsa.
- K-14 akışının Settings'e bağlanması auth kodunda değişiklik gerektiriyorsa.

## DOĞRULAMA
- `npm run typecheck` → 14.
- Locale parite eşit.
- VoiceOver: her Switch `accessibilityRole="switch"` + durum okunuyor.

## RAPOR
- Kullanımı bırakılan depolama key'leri/kolonları (TEKNIK_BORC adayı).
- Silinen bileşenler.
- Onay alınan kararlar: soru → cevap.
```

---

## TUR 6 — Playfair tasfiyesi + Pro Mode paleti ✍️

```markdown
## BAĞLAM
V-1 Tur 6. Design OS §3.2 Playfair Display'i emekliye ayırdı, ama Tur 0 envanteri
kullanımın sürdüğünü gösterdi. Pro Mode ekranı da K-31'i (tür-kodlu çoklu palet
kalıcı olarak ölü) ihlal ediyor. Tur 1–5 tamamlandı.

## GÖREV
1. Tipografi eşlemesi (Design OS §3.3):
   - Ekran/bölüm başlıkları → `title` (SF Pro Display 600).
   - Marka anları (champion adı, DNA arketip adı, paylaşım kartı) → Archivo Expanded
     `display-*`.
   - Sayılar/meta → Martian Mono `meta`.
   Her Playfair kullanımını bu üç rolden birine ata; belirsiz olanları listele.
2. Tüm Playfair referanslarını kaldır. Kullanım sıfırsa font dosyasını ve yükleme
   kodunu bundle'dan çıkar.
3. Pro Mode mood grid:
   - Tüm kartlar `charcoal` zemin + `graphite` kenar. Seçili kart `beam` kenar.
   - Kart ikonları Ionicons, tek renk, daire arka planı yok.
   - Alt açıklama metni kontrastı: 13pt altında `smoke` kullanılmaz → `bone`@70%.
4. Pro Mode CTA:
   - Disabled: `graphite` zemin + altında "Bir ruh hali seç" yardımcı metni.
   - Enabled: `bone` dolgu, `ink` metin, basışta hafif haptic (motion.ts).
   - Gradient yok, `marquee` yok.
5. Kalan hak sayacı yalnızca kalan ≤ 10 iken görünür. Limit ve sayım mantığı değişmez.

## KISITLAR
- Standart kısıt bloğu geçerli.
- Görsel retrofit: logic değişmez (limit, mood parsing, entitlement).
- Feedback renkleri ve ödül altını (`marquee`) değişmez.
- Mood kartı renk token'ları başka yerde (Spotlight, gameThemes) kullanılıyorsa
  token'ı silme, yalnızca Pro Mode'dan referansı kaldır.

## DUR NOKTALARI
- Bir Playfair kullanımı üç role de uymuyorsa.
- Pro Mode limit değeri istemcide hardcoded ise (sunucu kaynaklı olmalı — raporla, düzeltme).

## DOĞRULAMA
- `git grep -n -i "playfair"` → 0 (docs/ hariç).
- `npm run typecheck` → 14.
- Locale parite eşit.
- Kontrast: değişen metin/zemin çiftleri için oran listesi (≥4.5:1 gövde, ≥3:1 büyük).

## RAPOR
- Playfair → yeni rol eşleme listesi (dosya:satır).
- Bundle'dan çıkan font byte'ı.
- Kontrast tablosu.
- Onay alınan kararlar: soru → cevap.
```

---

## TUR 7 — Entegrasyon doğrulaması + bible 📘

```markdown
## BAĞLAM
V-1 Tur 7, son kod turu. Tur 1–6 commit'lendi. Bu tur yeni özellik yazmaz: bütünlüğü
doğrular ve karar günlüğünü günceller.

## GÖREV
1. Gate'ler: typecheck (14), typecheck:functions (baseline), locale parite, mevcut
   testler.
2. Tarama:
   - Hardcoded renk: V-1'de dokunulan dosyalarda `#[0-9a-fA-F]{3,8}` ve `rgb(` → 0.
   - Phosphor + Ionicons aynı ekranda: V-1'de dokunulan ekranların listesi, her biri için
     kullanılan ikon aileleri.
   - Boş catch / sessiz fallback: V-1 diff'lerinde → 0.
3. `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` karar günlüğüne V-1 kararlarını ekle
   (üstü çizili tersine çevirme kuralı geçerli, sessiz düzenleme yok):
   - Bekleme ekranı Seçenek C, arşiv/keşif rotası reddi
   - Day-0 on-demand ilk gauntlet (Tur 2 sonucu)
   - Tek bildirim switch'i
   - Discovery Stats kaldırıldı, Profile K-08'e hizalandı
   - "Chosy Pro" görünen ad, entitlement id `chosy_plus` korunur
4. `TEKNIK_BORC.md`: Tur 5'te kullanımı bırakılan key/kolonları ekle.
5. Tur 3'teki manuel senaryo listesini `docs/05_SPRINTS/ACTIVE/V1_TESTFLIGHT_CHECKLIST.md`
   dosyasına taşı (Tur 8 için).

## KISITLAR
- Kod davranışı değişmez. Bulunan ihlaller düzeltilmez, raporlanır.
- Bible, gerçeğe göre güncellenir; gerçek bible'a göre değil.

## DUR NOKTALARI
- Herhangi bir gate kırmızıysa.

## DOĞRULAMA
- Tüm komutların çıktısı rapora yapıştırılır.

## RAPOR
- Gate tablosu (beklenen / ölçülen).
- Tarama bulguları.
- Bible ve TEKNIK_BORC diff'i.
```

---

## TUR 8 — TestFlight toplu cihaz oturumu 📱

Tek build, tek cihaz oturumunda **bekleyen tüm doğrulamalar** birleştirilir (cihaz testi toplu yapılıyor):

| Grup | Kaynak | Madde |
|---|---|---|
| V-1 | Tur 7 checklist | Bekleme ekranı senaryoları, Profile, Settings, avatar, Pro Mode |
| Day-0 | Tur 2 | **Temiz kurulum, 18:00 öncesi** → ilk savaş ≤ ~3 sn |
| K-42 | E-11 | Offline queue-and-freeze |
| K-54 | E-11 | A11y: Reduce Motion, VoiceOver, radio plan kartları |
| R-A | 9 madde | R-A-1 + R-A-2 bekleyen toplu test |
| Auth | Manuel ön koşul | Supabase Email provider açık + `{{.Token}}` şablonları eklenmiş olmalı (yoksa K-14 testi kırmızı çıkar) |

Build: `eas build --platform ios --profile preview --auto-submit` (sürüm numarası EAS remote).

**Çıkış kriteri:** checklist'te kırmızı madde yok. Kırmızı → CTO oturumunda triyaj → düzeltme turu → yeni build.

---

## 9. App Store launch kapısı

V-1 + Tur 8 yeşil olduktan sonra launch için **hâlâ açık olan kalemler** (Kapsam Kilidi'nden):

| Kalem | Durum | Blocker mı? |
|---|---|---|
| Migration 107 (`winback_queue.rc_event_id` UNIQUE) | Yarım — `event.id` NULL kontrolü bekliyor | Evet (R-B) |
| K-42 offline | Kod var, E-11 bekliyor | Evet (R-B) — Tur 8'de |
| Wave 2 / Wave 3 / K-37 / K-43 | Açık | Evet (R-B) |
| R-C paywall hunisi enstrümantasyonu (E-09) | Kısmi | Evet — launch sonrası dönüşümü ölçemezsek fiyat/paywall kararı kör |
| **K-56 TMDB ticari lisansı + poster hakları** | Açık | **Evet — kod dışı, en uzun süren kalem. Hemen başlat.** |
| JustWatch attribution | Kontrol | Evet (lisans şartı) |
| App Privacy etiketleri | PostHog, Sentry, e-posta (K-14), RC | Evet |
| TOS / Privacy Policy güncellemesi | K-16, K-14, analytics, JustWatch | Evet |
| App Review notları | Anonim auth akışı, abonelik, hesap silme yolu | Evet |
| Store paketi | Ekran görüntüleri V-1 sonrası çekilir | Evet |
| Kademeli dağıtım (E-06, Phased Release) | Plan | Evet |
| 63 kullanıcıya kurucu mesajı | R-D öncesi | G-9 için kritik |

**6 release gate (K-52):** Product · Data · Reliability · Monetization · Accessibility · Store — altısı birlikte yeşil olmadan production yok.

### Paralel kritik yol

```
Kod hattı:   V-1 (Tur 0–7) ─┬─ Tur 8 TestFlight ─ R-C enstrümantasyon ─ Store paketi ─ Submit
R-B hattı:   M107 · Wave 2/3 · K-37 · K-43 ─┘
Kod dışı:    K-56 TMDB lisansı ─── TOS/Privacy ─── App Privacy etiketleri ───────────┘
```

Kod dışı hattın hemen bugün başlaması gerekir: TMDB ticari lisans yanıt süresi bizim kontrolümüzde değil ve launch'ı tek başına bloklayabilir.
