# K-54 — Accessibility Keşif Raporu

**Tarih:** 2026-09-01
**Mod:** READ ONLY keşif — hiçbir kod değişikliği yapılmadı.
**Kapsam:** 11 yüzey (Onboarding, Home, Gauntlet round, Champion, Where to Watch
sheet, Context edit sheet, Auth prompt, Profile, Saved for later,
Settings/Account, Paywall).

**Mimari not:** `app/(tabs)/index.tsx` tek satırlık bir mount noktasıdır
(`return <GauntletShell />`). "Home", "Gauntlet round" ve "Champion" — üçü de
aynı `components/gauntlet/GauntletShell/index.tsx` state makinesi içinde
yaşar; Champion görünümü ayrı bir alt bileşen olan `ChampionReveal`'dır. Bu
üç yüzey aşağıda tek bölüm altında raporlanmıştır.

**Kriterler:**
1. Dynamic Type — sabit `fontSize`, `allowFontScaling={false}`, `maxFontSizeMultiplier` eksikliği
2. VoiceOver — interaktif elemanlarda `accessibilityLabel`/`accessibilityRole` eksikliği
3. Reduce Motion — `Animated.*`/Reanimated kullanımında `AccessibilityInfo.isReduceMotionEnabled()` kontrolü
4. Hit target — 44×44pt altında kalan dokunma alanları, `hitSlop` eksikliği
5. Safe area — ekran kökünde `SafeAreaView`/`useSafeAreaInsets` kullanımı

Boyut: **S** (tek dosya/tek pattern, <1 gün) · **M** (birkaç dosya veya merkezi
hook değişikliği, 1-2 gün) · **L** (yüzey geneli, çok sayıda eleman, 2+ gün)

---

## Yönetici özeti

- `components/gauntlet/*` seti (PosterTile, ChampionReveal, RoundIndicator,
  ConfidenceMeter, QuietAction, ContextBar) **zaten a11y-bilinçli** yazılmış:
  `accessibilityRole/Label/State`, `hitSlop`, `useReducedMotion()` hepsi mevcut.
  Bu, projede bir referans desen olarak kullanılabilir.
- En büyük sistemik eksik: **ikon-only butonlarda `accessibilityLabel` yokluğu**
  (Profile gear/avatar/back butonları, Watchlist back/menü ikonları, Onboarding
  CTA/skip/option butonları, Settings modal'ın tamamı, PaywallBase CTA/dismiss).
- İkinci sistemik eksik: **Reanimated giriş animasyonlarında reduce-motion
  kontrolü yok** — `useStaggeredEntry.ts` hook'u merkezi; buraya tek bir guard
  eklemek Profile, Watchlist, TasteDNA, Onboarding genelinde birden fazla
  yüzeyi aynı anda kapsar (**M**, önerilen ilk yatırım).
- Dynamic Type tarafında proje genelinde `maxFontSizeMultiplier` hiç
  kullanılmıyor ama bu RN varsayılanını kapatmıyor (olumlu). Asıl risk sabit
  yükseklikli konteynerler (kart overlay'leri, toggle pilleri) — büyük
  accessibility font boyutlarında görsel QA gerekiyor.
- Safe area tarafında incelenen ekran kökleri (`onboarding.tsx`, `auth.tsx`)
  zaten doğru kullanıyor; sorun tespit edilmedi.

---

## 1. Onboarding

`app/onboarding.tsx`, `components/Onboarding/*`

| Dosya:Satır | Kriter | Açıklama | Boyut |
|---|---|---|---|
| `app/onboarding.tsx:165` | 2-VoiceOver | CTA `TouchableOpacity`'de accessibilityRole/Label yok | S |
| `components/Onboarding/TasteCalibration/index.tsx:115` | 2-VoiceOver | Skip butonunda accessibilityRole/Label yok | S |
| `components/Onboarding/TasteCalibration/styles.ts:27-30` | 4-Hit target | `skipBtn` dokunma alanı ~34px, hitSlop yok | S |
| `components/Onboarding/QuestionCard/index.tsx:88` | 2-VoiceOver | `OptionButton`'da accessibilityRole/Label yok, seçili/disabled durumu `accessibilityState` ile bildirilmiyor | S |
| `components/Onboarding/TasteSwipe/index.tsx:247,255` | 2-VoiceOver | İkon+metin aksiyon butonlarında (×2) accessibilityRole/Label yok | S |
| `components/Onboarding/TasteSwipe/index.tsx` (ör. 472,578,595) | 1-Dynamic Type | Sabit yükseklikli kart overlay'inde başlık/meta metni `maxFontSizeMultiplier` yok — büyük fontta taşma riski | M |
| `components/Onboarding/ArchetypeReveal/styles.ts:130,137` | 1-Dynamic Type | Arketip adı/açıklaması sabit fontSize, `numberOfLines`/`adjustsFontSizeToFit` yok | S |
| `TasteCalibration`, `QuestionCard`, `ProgressBar`, `ArchetypeReveal` (ör. `ArchetypeReveal/index.tsx:262-288`, `QuestionCard/index.tsx:53-69`) | 3-Reduce Motion | Spring/stagger/FadeIn-Out animasyonları reduce-motion kontrolsüz | M |

**Temiz:** `app/onboarding.tsx` (SafeAreaView, satır 141), `ArchetypeReveal`/`TasteCalibration` (`useSafeAreaInsets`) — kriter 5 sorunsuz.

---

## 2. Home / Gauntlet round / Champion

`components/gauntlet/GauntletShell`, `PosterTile`, `RoundIndicator`,
`ConfidenceMeter`, `LightBleed`, `QuietAction`, `ArchiveTrigger`,
`PendingWatchFeedbackCard`, `ChampionReveal`

**Bulgu yok** — bu set zaten a11y-bilinçli yazılmış: `accessibilityRole/Label`,
`hitSlop` ve `useReducedMotion()` mevcut (GauntletShell + PosterTile +
ChampionReveal). Genel proje geneli gözlem: hiçbir yerde
`maxFontSizeMultiplier` kullanılmıyor; `RoundIndicator`/`ConfidenceMeter`
segment satırları gibi sabit yükseklikli alanlar en büyük accessibility font
boyutlarında görsel olarak test edilmemiş görünüyor (kod değişikliği değil,
QA maddesi) — **M**.

---

## 3. Where to Watch sheet

`components/gauntlet/WatchProviders/index.tsx`

| Dosya:Satır | Kriter | Açıklama | Boyut |
|---|---|---|---|
| `index.tsx:190-204` | 4-Hit target | Sağlayıcı logosu `TouchableOpacity` 36×36 (`LOGO_SIZE`), hitSlop yok | S |

---

## 4. Context edit sheet

`components/gauntlet/ContextBar/index.tsx`

**Bulgu yok** — örnek iyi pratik: `accessibilityRole`, `accessibilityLabel`,
`accessibilityState`, `hitSlop` hepsi mevcut (satır 60-70, 126-136).

---

## 5. Auth prompt

`components/auth/AuthPromptSheet.tsx`, `components/auth/MagicLinkForm.tsx`, `app/auth.tsx`

| Dosya:Satır | Kriter | Açıklama | Boyut |
|---|---|---|---|
| `app/auth.tsx:181-188` | 2-VoiceOver | İkon-only geri butonu (`chevron-back`), accessibilityLabel yok (hitSlop var) | S |
| `components/auth/MagicLinkForm.tsx:155-157,200-212` | 4-Hit target | `linkButton` (changeEmail/resend) dokunma alanı ~26px, hitSlop yok — 3 kullanım yeri | S |
| `MagicLinkForm.tsx` / `AuthPromptSheet.tsx` geneli | 2-VoiceOver | Butonlar metin child'a güveniyor, açık `accessibilityRole="button"` set edilmemiş (düşük öncelik, kozmetik) | S |

**Temiz:** `app/auth.tsx` — `SafeAreaView` kullanıyor, kriter 5 sorunsuz.

---

## 6. Profile

`app/(tabs)/profile.tsx` (SettingsModal hariç), `components/Profile/*`

| Dosya:Satır | Kriter | Açıklama | Boyut |
|---|---|---|---|
| `profile.tsx:1208-1214` | 2-VoiceOver | `gearBtn` (Settings ikonu) accessibilityLabel/Role yok | S |
| `profile.tsx:1218-1242` | 2-VoiceOver | `avatarCircle` TouchableOpacity, etiketsiz | S |
| `profile.tsx:211-230` | 2-VoiceOver | Avatar seçim gridi (9 öğe), accessibilityLabel/Role/State(selected) yok | S |
| `hooks/useStaggeredEntry.ts:34-43` | 3-Reduce Motion | Merkezi hook, reduce-motion kontrolsüz. Kullanan yüzeyler: `profile.tsx:689-690`, `watchlist-detail.tsx`, `WatchlistCard/index.tsx` | **M (merkezi düzeltme 3+ yüzeyi kapsar)** |
| `components/Profile/TasteDNA/index.tsx:148,151-156` | 3-Reduce Motion | Genre chip fade-in, reduce-motion kontrolsüz (aynı desen) | S |

---

## 7. Saved for later

`app/watchlist-detail.tsx`, `components/Watchlist/SessionAccordion`, `components/Watchlist/WatchlistCard`

| Dosya:Satır | Kriter | Açıklama | Boyut |
|---|---|---|---|
| `watchlist-detail.tsx:343-694` | 2-VoiceOver | ~15 TouchableOpacity/Pressable (backBtn, arama/menü ikonları, chip'ler, uzun-basma ve menü modal seçenekleri) — hiçbirinde accessibilityLabel/Role yok | M |
| `watchlist-detail.tsx:343-349,735-742` | 4-Hit target | backBtn/iconBtn 40×40pt, hitSlop yok | S |
| `watchlist-detail.tsx:340,412` | 3-Reduce Motion | Header/chip stagger girişi (`Animated.View`) reduce-motion kontrolsüz | S |
| `SessionAccordion/index.tsx:112-115,181` | 3-Reduce Motion | Chevron `withTiming` + `FadeInDown`, `isReducedMotion` deseni yok (WatchlistCard'da var, burada yok) | S |

**Temiz:** `SessionAccordion` header'ı — `accessibilityRole/Label/State` zaten mevcut (satır 152-154), iyi pratik örneği.

---

## 8. Settings / Account

`app/(tabs)/profile.tsx` içindeki `SettingsModal` (≈satır 352-672) + `settingsModalStyles` (≈2306+)

| Dosya:Satır | Kriter | Açıklama | Boyut |
|---|---|---|---|
| `profile.tsx:413-668` | 2-VoiceOver | Modal içindeki **tüm** satırlar (dil, bildirim toggle'ları, hesap bağlama, abonelik yönetimi, paylaş, watchlist temizle, çıkış, gizlilik/koşullar, hesap sil) — sadece kapatma butonu (satır 429) hitSlop alıyor, hiçbiri accessibilityLabel/Role taşımıyor | **L (tüm modal)** |
| `profile.tsx:2343-2483` (`settingsModalStyles`) | 1-Dynamic Type | Sabit px fontSize (11-18 arası), `maxFontSizeMultiplier` hiç kullanılmıyor | M |
| `profile.tsx:444-536` (toggle pilleri) | 4-Hit target | hitSlop yok, boyut doğrulaması ek QA gerektiriyor | S |

---

## 9. Paywall

`app/paywall.tsx`, `components/paywalls/*`

`app/paywall.tsx` deprecated bir redirect stub'dır, gerçek UI taşımaz —
atlandı. Asıl yüzey `PaywallBase`; diğer 9 varyant dosyası kendi interaktif
elemanı taşımadan `PaywallBase`'i sarar (bulgu yok). `ContextualPaywall.tsx`
salt router/wrapper'dır, UI'ı yok — bulgu yok.

| Dosya:Satır | Kriter | Açıklama | Boyut |
|---|---|---|---|
| `PaywallBase/index.tsx:307-461` | 2-VoiceOver | Drag handle, retry, plan kartları (×3), CTA, dismiss, restore, legal linkler (×2) — hiçbirinde accessibilityLabel/Role yok; yalnız legal linkler hitSlop alıyor (450,457) | **L** |
| `PaywallBase/index.tsx:307-313` | 2-VoiceOver | Drag-handle alanı işlevsel olarak "kapat" anlamına geliyor ama accessibilityRole/Label yok — yukarıdaki bulguya dahil | (yukarıdakine dahil) |

**Not (bulgu değil):** `PaywallBase` `SafeAreaView`/`useSafeAreaInsets`
kullanmıyor ama bu bir bottom-sheet `Modal`'dır, ekran kökü değildir —
muhtemelen kasıtlı. **Olumlu:** fontSize'lar `Theme.typography.*`
token'larından geliyor, sabit px değil — Dynamic Type için ek iş gerekmiyor.

---

## Önerilen öncelik sırası

1. **M — `useStaggeredEntry.ts`'e reduce-motion guard'ı** (Profile, Watchlist,
   TasteDNA genelinde tek düzeltmeyle çok yüzeyi kapsar)
2. **L — Settings modal VoiceOver etiketleme** (en yoğun kullanılan, en büyük
   eksik yüzey)
3. **L — PaywallBase VoiceOver etiketleme** (gelir kritik yüzey, App Store
   erişilebilirlik incelemesinde öne çıkabilir)
4. **S grubu** — ikon-only buton etiketleri ve hitSlop eksikleri (Profile
   gear/avatar, Watchlist back/menü, Auth geri/link butonları, Onboarding
   skip/option/action butonları, WatchProviders logo) — düşük efor, yüksek
   sayıda dosyaya dağılmış, toplu bir "a11y polish" task'ında birlikte
   alınabilir.
5. **M — Onboarding/TasteSwipe kart overlay Dynamic Type QA** ve **Settings
   modal fontSize→token geçişi** — kod değişikliği öncesi görsel doğrulama
   gerektirir.
