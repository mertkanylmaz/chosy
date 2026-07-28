# Yakinsama Analizi — "Hedefe Yaklastigimi Hissediyor muyum?"

> Tarih: 25 Temmuz 2026
> Tetikleyen: CineMetrics'in sonsuz arama uzayi + soyut feedback sorunu
> Amac: Her oyunu "oyuncu cevaba yakinsadigini hissediyor mu?" sorusuyla yeniden degerlendirmek
> Cikti: Her oyun icin yakinsamayi guclendirecek somut degisiklikler

---

## Yakinsama Nedir?

Iyi bir bulmaca oyununda her hamle oyuncuyu cevaba OLCULEBILIR sekilde yaklastirir. Oyuncu bunu HISSEDER:

- **Wordle**: Her tahmin harfleri daraltir. 5. tahminde "kelimeyi neredeyse biliyorum" hissi.
- **Sudoku**: Her sayi yerlesince secenekler azalir. Ilerleme GORSEL.
- **20 Questions**: Her soru aramayı yarıya böler. Yaklasma MATEMATIKSEL.

Yakinsamanin 3 bileseni:
1. **Bilgi birikimi**: Her yanlis tahmin yeni bilgi verir
2. **Arama uzayi daralmasi**: Kalan olasiliklar olculebilir sekilde azalir
3. **Ilerleme hissi**: Oyuncu "yaklasiyorum" veya "uzaklasiyorum" diyor

---

## Oyun-Oyun Yakinsama Degerlendirmesi

### 1. CineMetrics — YAKINSAMA VAR AMA GORULMUYOR

**Mevcut durum:**
Grid'de her tahmin sonrasi 6 hucre flip eder: ✓ / ~ / ✗
Yon oklari var: ↑ (daha yuksek) / ↓ (daha dusuk)

**Sorun: Yakinsama VARDIR ama oyuncu GOREMEZ.**

Ornek senaryo:
```
Tahmin 1: "The Godfather"  → Yil ✓, Tur ~, Yon ✗, Puan ↑, Sure ↓, Ulke ✓
Tahmin 2: "Goodfellas"     → Yil ✗↓, Tur ✓, Yon ✗, Puan ✓, Sure ~, Ulke ✓
```

Oyuncunun gordudu: iki satir ✓/~/✗ sembolleri.
Oyuncunun gormedigdi: "The Godfather 1972, Goodfellas 1990 — cevap 1972-1990 arasi."

**Kok neden: `formatCellValue` fonksiyonu (CineMetrics/index.tsx:329-337) sadece ✓/~/✗ donduruyor.**

Sunucuda `guessData` mevcut (submit-guess:598-605): year, genres, director, rating, runtime, country.
Ama response'a `feedback` (green/yellow/gray + direction) disinda gercek degerler EKLENMIYOR.

Bu, oyuncunun zihinsel modeli insaa edememesi demek:
- "Yil yesil" → Ama yil kac? Hatirlamiyorum, 10 tane film soyledim.
- "Puan yukari ok" → Ama mevcut puanim kac? 7.2 mi 8.5 mi?
- "Tur sari" → Ama hangi turler ortusuyor, hangileri uyusmuyor?

**COZUM: Gercek Metadata Degerleri Grid'de Gosterilsin**

```
Mevcut grid satiri:
  The Godfather | ✓ | ~ | ✗ | ↑ | ↓ | ✓

Yeni grid satiri:
  The Godfather | 1972 ✓ | Crime,Drama ~ | Coppola ✗ | 9.2 ↑ | 175m ↓ | US ✓
```

Simdi oyuncu:
- "1972 yesil → cevap 1972 civarinda"
- "9.2 yukari ok → cevap 9.2'den YUKSEK mi? 9.5+ mi?"
- "Crime,Drama sari → Drama var ama Crime degil, baska bir tur daha var"
- "175m asagi ok → cevap 175'ten kisa"

Her satir bir VERI NOKTASI. 3 tahmin sonrasi oyuncu:
"1970'lerin Amerikan drami, 9+ puan, 150 dk altinda, Coppola degil ama..." → Arama uzayi sonsuzdan ~20 filme dustu.

**Teknik degisiklik:**

1. **Backend**: `submit-guess` response'una `guess_values` ekle:
```typescript
// submit-guess/index.ts response'a eklenecek
guess_values: {
  year: guessData.year,           // 1972
  genres: guessData.genres,       // ["Crime", "Drama"]
  director: guessData.director,   // "Francis Ford Coppola"
  rating: guessData.vote_average, // 9.2
  runtime: guessData.runtime,     // 175
  country: guessData.country,     // ["US"]
}
```

> **Hard Rule kontrolu**: Bu gercek cevap degil, TAHMIN EDILEN filmin degerleri.
> Oyuncu zaten hangi filmi tahmin ettigini biliyor — bu onun kendi filminin metadata'si.
> Cozum (solution_ref) SIZMAZ. ✅

2. **Frontend**: `formatCellValue` fonksiyonunu guncelle — `guess_values`'dan gercek degerleri gostersin
3. **Grid genisligi**: Dar hucrelere siamayacak degerler icin tooltip veya compact format

**Ek: Proximity Meter (Opsiyonel)**

Grid altinda toplam yakinsama gostergesi:
```
Yakinsama: ████████░░ %80  (6 sutunun agirlikli ortalamasi)
```
- 6 yesil = %100
- Sari = %50 katkisi
- Gri = %0

Bu, oyuncuya "3. tahminim 1. tahminimden %30 daha yakindi" hissini verir.
Wordle'daki "4/5 harf dogru" hissinin karsiligi.

---

### 2. Logline — YAKINSAMA PASIF (kelime acilir ama strateji degismez)

**Mevcut durum:**
Yanlis tahmin → bir sansurlu kelime acilir. Ama tahmininin NEDEN yanlis oldugu hakkinda bilgi yok.

**Yakinsama skoru: 2/5**
- Bilgi birikimi: Sadece acilan kelimeden (pasif, oyuncunun kararindan bagimsiz)
- Arama uzayi daralmasi: Kelime acildikca daralir ama OLCULEMEZ — oyuncu kac film kaldıgini bilmiyor
- Ilerleme hissi: "Bir kelime daha acildi" var ama "yaklasiyorum" hissi yok

**COZUM: Semantic Feedback (GAME_INNER_DYNAMICS.md'de detayli)**

Yanlis tahmin sonrasi 2 satir bilgi:
```
"Finding Nemo" ✗
  Donem: Benzer (~2000'ler)     ← zaman yakinligi
  Tur: Farkli (animasyon degil) ← tur bilgisi
+ Bir sansurlu kelime acilir
```

Bu feedback her tahmini bir VERI NOKTASINA donusturur.
3 tahmin sonrasi: "2000'lerin dram filmi, ABD yapimi, aksiyon degil..." → Yakinsama HISSEDILIR.

**Yakinsama skoru degisiklik sonrasi: 4/5**

---

### 3. FadeIn — YAKINSAMA GORSEL AMA TEK BOYUTLU

**Mevcut durum:**
Her yanlis tahmin → blur bir kademe azalir. Poster gittikce netlesiyor.

**Yakinsama skoru: 3/5**
- Bilgi birikimi: Gorsel (pasif — oyuncunun stratejisi yok)
- Arama uzayi daralmasi: Poster nettlestikce aday filmler azalir — ama bu TANINMA, deduction degil
- Ilerleme hissi: Var! Blur azalmasi gorsel olarak tatmin edici. AMA ilk 2 adimda fark GORULMUYOR.

**Sorunlar:**
1. Blur egrisi: 50→40→28→18→10→4 — ilk adim (50→40) gorsel fark uretmiyor
2. Tek boyutlu: Sadece "bu posteri taniyor musun?" Baska bilgi yok.

**COZUM: Hint katmani + blur egrisi duzeltmesi (GAME_INNER_DYNAMICS.md'de detayli)**

```
[50px blur]           → "Bu posteri tanıyor musun?"
Yanlis → [30px blur]  + "2000'lerde cikti" (donem ipucu)
Yanlis → [18px blur]  + "Yonetmeni suc filmleriyle taninir"
Yanlis → [10px blur]  + "Basrolde Oscar odullu bir aktor var"
```

Her adimda IKI bilgi kanali: gorsel + metin. Bu yakinsamayi cifte katliyor.

**Blur egrisi fix:** [50, 40, 28, 18, 10, 4] → [45, 30, 20, 12, 6, 2]
Ilk adimda gorsel fark net olacak (45→30 = bariz degisim).

**Yakinsama skoru degisiklik sonrasi: 4.5/5** (gorsel + metin = cok guclu combo)

---

### 4. Quoted — YAKINSAMA YOK (binary bilgi/bilmeme)

**Mevcut durum:**
Replik gosterilir. Ya bilirsin ya bilmezsin. Hint'ler (karakter→oyuncu→yonetmen) daraltir ama tahmininin kendisinden bilgi yok.

**Yakinsama skoru: 1.5/5**
- Bilgi birikimi: Sadece hint'lerden (pasif, oyuncunun tahminine bagli degil)
- Arama uzayi daralmasi: Hint'ler daraltir ama 1. tahmin ile 2. tahmin arasinda KALITATIF fark yok
- Ilerleme hissi: "Ipucu acildi" var ama "yaklasiyorum" yok — repliği ya tanirsin ya tanimazsin

**COZUM: Baglamsal onbilgi + hint siralamasi (GAME_INNER_DYNAMICS.md'de detayli)**

```
[Tur 0 — replik oncesi] "1990'larin bir dram filmi"     ← arama uzayini BASTAN daralt
[Tur 1] Replik goster: "The reality is..."
[Tur 2] Yanlis → "Karakter askeri bir figur"
[Tur 3] Yanlis → "Basrolde Jack Nicholson"
```

Tur 0'daki baglamsal onbilgi KRITIK: oyuncuya "sonsuz film" yerine "90'lar drami" gibi bir baslangic noktasi veriyor. Her hint bu aramayi daha da daraltir → YAKINSAMA.

**Yakinsama skoru degisiklik sonrasi: 3/5** (hala recall-based ama en azindan deduction katmani var)

---

### 5. Spotlight — YAKINSAMA MEKANIK AMA ANLAMSIZ

**Mevcut durum:**
4 poster + ipucu. Yanlis secim → o poster elenir. Kalan secenekler azalir.

**Yakinsama skoru: 2/5 (sahte yakinsama)**
- Bilgi birikimi: Sadece eliminasyon (en sip bilgi turu)
- Arama uzayi daralmasi: 4→3→2→1 (matematiksel ama brute force)
- Ilerleme hissi: "Bir secenek elendi" var ama "dusundum ve eledim" hissi YOK — cunku ipuclari ayirt edici degil

**Sorun: Eliminasyon = yakinsama DEGILDIR.**

Wordle'da yanlis harf BILGI verir → sonraki tahminini SEKILLENDIRRIR.
Spotlight'ta yanlis secim sadece BIR SECENEGI KALDIRIR → sonraki kararin kalitesi ARTMAZ.

4 secenekten 1'ini eleyince kalan 3'te hala %33 sans. Bilgi artisi sifir.

**COZUM: Ipucularinin ayirt edici olmasini ZORUNLU kil**

Bu UI degisikligi degil, generate-puzzles seviyesinde iyilestirme:
- Her ipucu 4 filmden EN AZ 1'ini KESIN elemeli
- Ipucu siralama: genis → dar (decade → genre → director → specific scene)
- Oyuncu ipucunu OKUYUP dusunerek eleme yapabilmeli — sans degil

Ek: Poster kartlarinda metadata gosterme (yil, tur bilgisi gizlensin — oyuncu ipucudan cikarsin)

**Yakinsama skoru degisiklik sonrasi: 3.5/5** (ipucuyla deduction mumkun hale gelir)

---

### 6. Imposter — YAKINSAMA MEVCUT DEGIL (tek hamle)

**Mevcut durum:**
1 film, 4 isim, 1 hak. Yakinsama OLAMAZ — tek hamle var.

**Yakinsama skoru: 0/5**
Yakinsama icin en az 2 hamle gerekir. Imposter'da 1 hamle var. Yok.

**COZUM: 3 turlu format (GAME_INNER_DYNAMICS.md'de detayli)**

3 round = 3 bagimsiz yakinsama firsati degil (her round ayri film).
AMA round-arasi ZORLUK ARTISI yakinsama HISSI verir:
- Round 1: Kolay (bariz sahte) → "Bunu bildim, devam"
- Round 2: Orta (inandirici sahte) → "Hmm, dusunmem lazim"
- Round 3: Zor (cok inandirici sahte) → "Bu gercekten zor"

Bu tam yakinsama degil ama GERILIM EGRISI olusturur — "gittikce zorlasıyor" hissi.

Her round sonrasi dogru cevabi gostererek OGRENME anı yarat:
"Mark Ruffalo The Dark Knight'ta degil — The Avengers kadrosundan."
Bu "yarin daha iyi olacagim" motivasyonunu besler.

**Yakinsama skoru degisiklik sonrasi: 2/5** (format geregi yakinsama sinirli ama gerilim egrisi var)

---

## OZET TABLOSU

| Oyun | Mevcut Yakinsama | Degisiklik Sonrasi | Ana Mudahale |
|------|-----------------|--------------------|--------------|
| CineMetrics | 3/5 (var ama gorunmez) | **5/5** | Grid'de gercek metadata degerleri goster |
| FadeIn | 3/5 (gorsel ama tek boyutlu) | **4.5/5** | Hint katmani + blur egrisi fix |
| Logline | 2/5 (pasif) | **4/5** | Semantic feedback (tur/donem bilgisi) |
| Spotlight | 2/5 (sahte — brute force) | **3.5/5** | Ayirt edici ipucu zorunlulugu |
| Quoted | 1.5/5 (binary) | **3/5** | Baglamsal onbilgi + deduction katmani |
| Imposter | 0/5 (tek hamle) | **2/5** | 3 turlu format + ogrenme anlari |

## ONCELIK SIRASI (Yakinsama etkisine gore)

1. **CineMetrics grid metadata** — En buyuk etki, en kolay degisiklik.
   Backend: `guess_values` ekle (guessData zaten mevcut, sadece response'a koy).
   Frontend: `formatCellValue` guncelle.
   Etki: 3/5 → 5/5 (+2 puan, oyunun en guclulugu GORULUR hale gelir)

2. **Logline semantic feedback** — Orta eforu, buyuk etki.
   Backend: Tahmin edilen filmin tur/donem bilgisini cevapla karsilastir, sonuc don.
   Frontend: Yanlis tahmin altina 2 satirlik bilgi goster.
   Etki: 2/5 → 4/5

3. **FadeIn hint + blur** — Dusuk efor, iyi etki.
   Backend: generate-puzzles zaten hint uretiyor, sadece puzzle_data'ya koy.
   Frontend: Blur egrisi degistir + hint satirini goster.
   Etki: 3/5 → 4.5/5

4. **Imposter V2** — Yuksek efor (backend + client tam yeniden yazim).
   Etki: 0/5 → 2/5 (format geregi sinirli ama UX dramatik iyilesir)

5. **Quoted baglamsal onbilgi** — Orta efor.
   Etki: 1.5/5 → 3/5

6. **Spotlight ipucu kalitesi** — generate-puzzles seviyesinde.
   Etki: 2/5 → 3.5/5

---

## CINEMETRICS DETAYLI IMPLEMENTASYON PLANI

### Adim 1: Backend — guess_values response'a ekle

```typescript
// submit-guess/index.ts — response objesi
const response = {
  correct: isCorrect,
  feedback: puzzle.game_type === 'cinemetrics' ? feedback : null,
  // YENİ: Tahmin edilen filmin metadata degerleri
  guess_values: puzzle.game_type === 'cinemetrics' ? {
    year: guessData.year,
    genres: guessData.genres,
    director: guessData.director,
    rating: guessData.vote_average,
    runtime: guessData.runtime,
    country: guessData.country,
  } : null,
  // ... geri kalan ayni
}
```

Hard Rule kontrolu: Bu TAHMIN EDILEN filmin bilgileri — oyuncu zaten hangi filmi sectığini biliyor. Cozum (solution) sizmaz. ✅

### Adim 2: types/game.ts — GuessValues tipi

```typescript
export interface GuessValues {
  year: number;
  genres: string[];
  director: string | string[];
  rating: number;
  runtime: number;
  country: string[];
}

// GuessResult'a ekle
export interface GuessResult {
  // ... mevcut
  guess_values: GuessValues | null;
}

// GuessEntry'ye ekle (progress icin)
export interface GuessEntry {
  // ... mevcut
  values?: GuessValues;
}
```

### Adim 3: CineMetrics/index.tsx — formatCellValue guncelle

```typescript
const formatCellValue = (key: keyof FeedbackRow, guess: GuessEntry): string => {
  if (!guess.values) {
    // Eski format — fallback
    const cell = guess.feedback[key];
    if (cell.result === 'green') return '✓';
    if (cell.result === 'yellow') return '~';
    return '✗';
  }

  switch (key) {
    case 'year': return String(guess.values.year);         // "1972"
    case 'rating': return guess.values.rating.toFixed(1);   // "9.2"
    case 'runtime': return `${guess.values.runtime}m`;      // "175m"
    case 'genres': return guess.values.genres.slice(0, 2).join(', '); // "Crime, Drama"
    case 'director': {
      const d = guess.values.director;
      return Array.isArray(d) ? d[0] : d;                  // "Coppola"
    }
    case 'country': return guess.values.country[0] ?? '?';  // "US"
    default: return '?';
  }
};
```

### Adim 4: Grid hucre genisligi ayarlama

Mevcut: Dar hucreler, tek karakter icin optimize.
Yeni: "1972", "Crime, Drama", "Coppola" gibi metinler icin genisletme gerekir.
- Year: 4 karakter → mevcut genislik yeterli
- Rating: 3 karakter → yeterli
- Runtime: 4 karakter → yeterli
- Genres: 15+ karakter → hucreyi genislet veya 2 satirlik compact
- Director: 10+ karakter → soyadı only veya truncate
- Country: 2-3 karakter → yeterli

En buyuk zorluk: Genres ve Director sutunlari. Cozum: numberOfLines={1} + ellipsis.

### Adim 5 (Opsiyonel): Proximity Meter

Grid altinda:
```
[████████░░] Yaklasma: 4/6 sutun eslesme
```
6 sutunun ortalama yakinlik skoru. Her tahmin sonrasi guncellenir.
Gorsel olarak "yaklasiyorum" hissini pekistirir.
