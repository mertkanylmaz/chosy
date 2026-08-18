# M3 — Havuz Gerçeği

**Başlangıç:** 18 Ağustos 2026
**Bağlı bible maddesi:** E-02, D-03

## Amaç
Ölçüm önce, kod sonra (E-02). Film havuzunun gerçek derinliğini canlı veriyle
ölçmek, bible'ın havuzla ilgili varsayımlarını (tekrar eşiği, "w92 bug'ı",
`poster_quality_ok` gate'i) doğrulamak veya çürütmek — ve yalnızca ölçüm
doğrulanmışsa kod yazmak.

## Kapsam

### 1. Havuz derinliği — canlı ölçüm
- **1.847 düello-uygun film**, ancak **etkin havuz 840**.
  Nominal derinlik ile algoritmanın fiilen seçtiği havuz aynı değil.
- **365 günlük tekrar simülasyonu:** %10 tekrar eşiği `any` bağlamında
  **97. günde**, `short` bağlamında **53. günde** aşılıyor.
- Bible'ın "havuz 40. günde tekrar başlıyor" endişesi **çürütüldü** —
  ama etkin havuzun nominalden küçük olduğu doğrulandı.

### 2. "w92 bug'ı" — bible'ın tarif ettiği haliyle YOK
Araştırıldı; bible'daki tanımıyla böyle bir bug bulunmadı.
**Gerçek bug başkaydı:** `generate-gauntlet`'in **cached yolunda** poster
normalizasyonu eksikti — cached yol `original` boyutlu poster URL'i
döndürüyordu. Etki: **havuzun %100'ü**, yaklaşık **21× bant israfı**.
Düzeltildi (commit e4fea12) — `toW500PosterUrl` normalizasyonu cached yola
da uygulandı.

### 3. `poster_quality_ok` — kolon var, gate yok
- Kolon **mevcut** (migration 084) ama D-03'ün istediği gate değil;
  LightBleed çalışmasının yan ürünü.
- Kolonu dolduran `scripts/compute-dominant-colors.ts` **yerel bir `npx tsx`
  script'i** — Edge Function değil, cron'a bağlı değil, elle çalıştırılıyor.
- **Gate bağlanmadı.** Fail-open gate bugün yapısal olarak 0 film eler
  (`= false` olan 5 satır zaten `archive` tier'da ve `poster_url` NULL),
  ama kod okuyana "poster kalitesi kontrol ediliyor" izlenimi verir.
  Sıfır kapsama + tam koruma görüntüsü = **sessiz sahte-güvence**, reddedildi.
- Gerçek çözümün tasarım notu yazıldı (aşağıda, Kapsam DIŞI).

### 4. `imdb_votes` kirliliği — doğrulandı
OMDb ve TMDb'nin iki farklı metriği aynı kolonda duruyor. Mutlak eşik yerine
**yüzdelik yaklaşımı** hâlâ doğru savunma. Ek bulgu: `gauntletCore.ts:64`'teki
"havuzda `imdb_votes = 0` olan 0 satır" notu bayat — 18 Ağu ölçümünde 2 satır
var; `NEUTRAL_RECOGNITION_SCORE` katmanı yine de ulaşılamaz, çünkü o 2 film
`recognitionMissing` ile havuz dışına düşüyor. Teknik borca kaydedildi.

## Kapsam DIŞI
- **`recognition_band` / `MIN_SELECTION_WEIGHT` ayarı** — C.9b sonrası
  gerçek kullanıcı verisiyle yapılacak. Bugün ayarlamak, sentetik veriye
  göre tuning olurdu (commit c782cd0'da teknik borca kaydedildi).
- **`poster_quality_ok` gate'ini bağlamak** — ingestion-time otomasyon
  olmadan anlamsız. Tasarım notu yazıldı (`sync-trending` içinde
  ingestion anında `w500` HEAD kontrolü, fail-open değil fail-visible),
  kod YAZILMADI, ayrı onayla uygulanacak (commit 66b4089).
- **`compute-dominant-colors`'ı Edge Function'a taşımak** — reddedilmedi,
  **ertelendi**: yeni Deno görsel indirme/decode mimarisi + yeni cron demek,
  kendi sprint'ini hak ediyor.
- **`seed-database.ts` teknik borcu** — c782cd0 ile kaydedildi, çözülmedi.

## DUR NOKTALARI
| # | Soru | Cevap | Tarih |
|---|---|---|---|
| 1 | Havuz gerçekten 40. günde tekrara mı düşüyor? | Hayır — `any`'de 97. gün, `short`'ta 53. gün. Ama **etkin havuz (840)** nominalden (1.847) küçük, bu gerçek risk | 18 Ağu 2026 |
| 2 | `poster_quality_ok` gate'i bugün bağlansın mı? | **Hayır** — fail-open gate 0 film eler ama sahte güvence yaratır; reddedildi | 18 Ağu 2026 |
| 3 | Gerçek çözüm ne? | `sync-trending`'de **ingestion-time HEAD kontrolü** (haftada bir, ~9 film, request-time değil → D-03 ihlali değil). Tasarım notu yazıldı, ayrı onayla uygulanacak | 18 Ağu 2026 |

## Doğrulama
| Komut | Beklenen | Sonuç |
|---|---|---|
| `npm run typecheck` | Baseline: 14 hata, hepsi `scripts/` | ✅ 14 hata, hepsi `scripts/` |
| Canlı havuz sayımı | Düello-uygun havuz ölçülmeli | ✅ 1.847 düello-uygun / etkin havuz 840 |
| 365 günlük tekrar simülasyonu | %10 eşiğinin hangi günde aşıldığı | ✅ `any` 97. gün · `short` 53. gün |
| Poster normalizasyon fix'i | Cached yol da `w500` döndürmeli | ✅ e4fea12 ile düzeltildi |

## Commit'ler
`e4fea12` (poster normalizasyon fix) · `c782cd0` (tuning + seed-database
teknik borç kayıtları) · `66b4089` (`poster_quality_ok` gate erteleme kaydı +
ingestion-time tasarım notu)

## Durum
Tamamlandı — 18 Ağustos 2026.
