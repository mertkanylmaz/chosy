# Film Oneri Kalite Test Seti

Chosy.ai oneri algoritmasinin "termometresi". Her iyilestirmeden ONCE ve SONRA calistirilmali.

## Kurulum

Ortam degiskenlerini ayarla (`.env` dosyasinda zaten varsa otomatik yuklenir):

```bash
export EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
export EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Calistirma

```bash
npm run test:quality
```

veya dogrudan:

```bash
npx tsx tests/recommendation-quality/run-quality-test.ts
```

## Test Yapisi

20 test vakasi, 5 kategori:

| Kategori | Adet | Aciklama |
|----------|------|----------|
| mood | 6 | Saf mood ifadeleri (huzunlu, yorgun, adrenalin, vs.) |
| genre | 7 | Turkce input + genre derinligi (tea-time, couple, atypical horror) |
| director | 4 | Yonetmen referansi (Nolan, Wes Anderson, Tarantino, NBC) |
| edge_case | 3 | Bos input, celiskili input, minimal input |

## Sonuc Formati

- Konsola renkli ozet: `Quality Score: X/20 (Y%)`
- JSON rapor: `output/baseline-results-[timestamp].json`
- Exit code: 0 = tum testler gecti, 1 = en az 1 fail

## Yeni Test Ekleme

`test-cases.ts` dosyasina yeni bir `QualityTestCase` objesi ekle:

```typescript
{
  id: 'unique-id',
  mood_input: 'kullanici girdisi',
  archetype: '12 arketipten biri',
  taste_profile: { ... },  // TasteProfile objesi
  expected_films_must_include_any_of: ['Film A', 'Film B'],
  expected_films_must_not_include: ['Film X'],
  min_top10_matches: 1,
  category: 'mood' | 'genre' | 'director' | 'edge_case',
}
```

## Onemli Notlar

- Bu test SADECE olcum yapar, algoritmaya DOKUNMAZ
- vectorEncoder.ts dogrudan import edilir — tek kaynak (Single Source of Truth)
- Director filtresi JS tarafinda uygulanir (RPC parametresi yok)
- Her calistirmada Supabase'e ~20 RPC istegi gider
