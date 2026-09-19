# design/ — görsel kanıt klasörü

Kaynak: `docs/os/3_CHOSY_DESIGN_OS.md` §16 disiplin satırı —
*"Ekran başına tek commit · `design/before/` ve `design/after/` ekran
görüntüsü · DESIGN_SYSTEM.md'ye üstü çizili karar kaydı."*

Bu klasör C.9b-UI Faz 0'da **yokluğu tespit edilerek** kuruldu: §16 bu
disiplini şart koşuyordu ama altyapı hiç kurulmamıştı.

## Klasörler

| Klasör | İçerik | Kim koyar |
|---|---|---|
| `before/` | Kod değişmeden ÖNCEKİ ekran görüntüleri | CTO (cihaz erişimi gerekir) |
| `after/` | Değişiklik sonrası aynı ekranlar, aynı cihaz/koşul | CTO |
| `reference/` | Kompozisyon/hiyerarşi referans görselleri | CTO |

## Adlandırma

`<sprint>_<ekran>_<cihaz>.png` — örnek:

```
before/c9b-ui_gauntlet-round_standard.png
before/c9b-ui_champion_standard.png
after/c9b-ui_gauntlet-round_standard.png
```

Cihaz adı: bu turda tek cihaz kullanılıyor → `standard` (veya gerçek cihaz adı).

## C.9b-UI için gereken çekimler

| Dosya | Not |
|---|---|
| `before/c9b-ui_gauntlet-tur1_standard.png` | Aynı gün, aynı cihaz |
| `before/c9b-ui_gauntlet-tur2_standard.png` | " |
| `before/c9b-ui_gauntlet-final_standard.png` | " |
| `before/c9b-ui_champion_standard.png` | **Taze seçimle** (resume değil) |
| `before/c9b-ui_champion-dizi_standard.mp4` | **~10 sn ekran kaydı.** C5 prefetch ve §7.3 zamanlaması için hareket başlangıç noktası — durağan görüntü bunu kanıtlamaz |
| `reference/…` | Referans görsel(ler) |

## K-55 üç cihaz matrisi — bu turda GEÇERSİZ

Windows'ta iOS simülatörü yok (bible v1.8 / E-11: *"yerel dev build/simülatör
yok"*). Üç cihazlık K-55 matrisi (Small · Standard · Pro Max) bu tur için
gerçekçi değil ve **R-D release gate'ine taşındı** (CTO kararı, 19 Eyl 2026).

Bu turda: **tek cihaz + C.9b-UI Faz 0'ın geometri hesap tablosu.**
En sıkışık durum hesapla biliniyor — Small iPhone (375×667), ölü bant ~41pt.

## Kural

**`before/` görüntüsü alınmadan ilgili ekranın koduna dokunulmaz.**
Before kanıtı geri gelmez.

## `reference/` uyarısı

Referans görsel **yalnızca kompozisyon ve hiyerarşi** içindir. Çelişkide
token dosyaları ve bible kazanır. Kopyalanmaz: serif başlık, altın vurgu,
asimetrik poster boyutu, avatar, "LEARNING YOUR TASTE" benzeri metinler,
cam kapsül, tab bar'sız Gauntlet çizimi (bkz. DUR-3 — tab bar kalıyor).
