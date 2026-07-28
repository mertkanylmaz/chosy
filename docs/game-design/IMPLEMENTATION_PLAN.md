# Faz 1 Implementasyon Plani

> Oncelik: DNA/XP animasyonu (tum oyunlar) > Imposter V2 > Logline feedback
> Karar: Tum oyunlar Edge Function'a tasinacak, sonra ortak animasyon

---

## Sprint 1: DNA/XP Animasyonu (4-5 gun)

### Adim 1: 4 eski oyunu Edge Function'a bagla (3 gun)

Imposter, Logline, Quoted, FadeIn su anda `gameService.ts` ile local cache kullaniyor.
CineMetrics ve Spotlight zaten `gameApi.ts` + Edge Function kullaniyor.

#### 1a. submit-guess Edge Function'a 4 oyun ekle

`supabase/functions/submit-guess/index.ts` suan CineMetrics, Logline, Spotlight destekliyor.
Eklenecekler:
- `imposter` game_type — 3 actor secenekten fake'i bul
- `quoted` game_type — 4 attempt, hint reveal
- `fadein` game_type — 6 attempt, blur step

Her oyun icin:
- Dogru cevap kontrolu (solution_ref karsilastirmasi)
- XP hesaplama (mevcut CineMetrics ladder'i kullan)
- DNA signal yazimi (her oyuna ozel dimension'lar)
- progress_json guncelleme

#### 1b. generate-puzzles'a 4 oyun ekle (zaten var mi kontrol et)

`supabase/functions/generate-puzzles/index.ts` kontrol edilmeli.
Logline, FadeIn, Imposter, Quoted icin puzzle uretimi zaten var mi?

#### 1c. Client tarafinda gameApi.ts'e yeni fonksiyonlar ekle

```typescript
submitImposterGuess(puzzleId, selectedActorId)
submitQuotedGuess(puzzleId, guessFilmId)
submitFadeInGuess(puzzleId, guessFilmId)
```

Her fonksiyon `ensureAuthSession()` sarili, `submit-guess` Edge Function'a POST.

#### 1d. 4 oyun ekranini guncellle

Her oyun ekraninda:
- `gameService.ts` (local cache) yerine `gameApi.ts` (Edge Function) kullan
- `getCachedResult()` yerine `fetchDailyChallenge()` ile server state kontrol et
- Submit sonucu `GuessResult` tipinde gelecek (xp_awarded, dna_updated)
- Completed state'te xpAwarded ve dnaUpdated state'lerini set et

### Adim 2: Ortak DnaXpReveal component'i yarat (1 gun)

`components/games/DnaXpReveal/index.tsx` + `styles.ts`

Props:
```typescript
interface DnaXpRevealProps {
  xpAwarded: number;
  dnaUpdated: boolean;
  dnaSignals?: { dimension: string; delta: number }[]; // Opsiyonel: hangi boyut ne kadar degisti
  solved: boolean;
}
```

UI:
- XP badge: Gold yildiz + "+{xp} XP" — animasyonlu sayi sayaci (0'dan xp'ye)
- DNA chip: Her degisen dimension icin ayri satir:
  - "Knowledge +6" (yesil ok animasyonu)
  - "Deduction +4" (yesil ok animasyonu)
- Staggered giris: XP 200ms, DNA 400ms, her dimension +100ms
- Reanimated: FadeInUp + withSpring scale

### Adim 3: DnaXpReveal'i tum oyunlara entegre et (1 gun)

- **ResultCard** kullanan oyunlar (Imposter, Logline, Quoted, FadeIn):
  - ResultCard'a `xpAwarded` ve `dnaUpdated` prop'lari ekle
  - ResultCard icinde DnaXpReveal render et
  - Eski hardcoded XP hesaplamasini kaldir

- **Custom UI** kullanan oyunlar (CineMetrics, Spotlight):
  - Mevcut XP chip + DNA chip yerine DnaXpReveal component'i koy

---

## Sprint 2: Imposter V2 — 3 Tur (3-4 gun)

Tasarim: `docs/game-design/GAME_MECHANICS_V2.md` Bolum 6

### Backend
- `generate-puzzles`: Imposter icin 3 ayri tur puzzle_data ureti
  - R1: film + 4 actor (3 real, 1 fake)
  - R2: film + 5 actor (3 real, 2 fake)
  - R3: film + 6 actor (4 real, 2 fake)
- `submit-guess`: Imposter tur bazli validasyon
  - current_round parametresi
  - Her turda dogru/yanlis kontrol
  - 3/3 = perfect, XP: 90, DNA: Knowledge 0.8 + Deduction 0.4

### Client
- `app/games/imposter.tsx` yeniden yaz
- 3 tur state machine: round1 > round2 > round3 > completed
- Her turda yeni film + actor grid
- Yanlis secimde tur biter, oyun devam eder (sonraki tura gecmez)
- Sonuc: "Round X/3" gosterimi

---

## Sprint 3: Logline Per-Guess Feedback (2 gun)

Tasarim: `docs/game-design/GAME_MECHANICS_V2.md` Bolum 3

### Backend
- `submit-guess`: Logline yanlis tahmin sonrasi ek feedback dondu
  - Tahmin edilen filmin genre'leri vs cevap filmin genre'leri karsilastirilir
  - "Warmer" (2+ ortak genre) / "Colder" (0 ortak genre)
  - "Same era" (±10 yil) / "Different era" (>10 yil)
  - Feedback `GuessResult`'a yeni alan: `semantic_hint?: string`

### Client
- `app/games/logline.tsx`: Yanlis tahmin sonrasi hint chip goster
  - "Warmer — Same era" (yesil text)
  - "Colder — Different era" (kirmizi text)
  - FadeIn animasyonu, 1.5 saniye sonra soluklasmasi

---

## Kritik Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| `supabase/functions/submit-guess/index.ts` | 4 yeni game_type ekle |
| `supabase/functions/generate-puzzles/index.ts` | Imposter V2 puzzle_data |
| `services/gameApi.ts` | 3 yeni submit fonksiyonu |
| `types/game.ts` | GuessResult'a semantic_hint ekle |
| `components/games/DnaXpReveal/index.tsx` | YENi component |
| `components/games/ResultCard/index.tsx` | DnaXpReveal entegrasyonu |
| `components/games/CineMetrics/index.tsx` | DnaXpReveal entegrasyonu |
| `components/games/Spotlight/index.tsx` | DnaXpReveal entegrasyonu |
| `app/games/imposter.tsx` | Edge Function + 3 tur yeniden yazim |
| `app/games/logline.tsx` | Edge Function + semantic feedback |
| `app/games/quoted.tsx` | Edge Function gecisi |
| `app/games/fadein.tsx` | Edge Function gecisi |

## Hard Rule Kontrol Listesi

- [ ] Solution client'a inmiyor (submit-guess server-side)
- [ ] Config lazy getter (app_config'ten)
- [ ] Silent failure yok (Sentry + user error state)
- [ ] Tum metinler t() ile (en.json + tr.json)
- [ ] Phosphor duotone ikonlar oyun ekranlarinda
- [ ] Share card'da film adi yok
