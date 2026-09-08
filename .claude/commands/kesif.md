---
description: Salt okunur keşif turu — ölçüm ve rapor, hiçbir değişiklik yok
argument-hint: [iş kodu ve kapsam, örn. "K-55 QA matrisi hazırlığı"]
---

# KEŞİF TURU: $ARGUMENTS

## MOD
**READ ONLY.** Hiçbir dosya yazılmaz, düzenlenmez, silinmez. Hiçbir bağımlılık
kurulmaz. Hiçbir migration yazılmaz. Hiçbir Edge Function deploy edilmez.
Tek istisna: bu turun sonunda üretilecek rapor dosyası.

## PROTOKOL
1. Önce `.claude/skills/chosy-conventions/SKILL.md` ve `CLAUDE.md`'yi oku —
   bu turda geçerli kurallar oradadır.
2. Kapsamı yukarıdaki iş tanımıyla sınırla. Kapsam dışına çıkma, "bu arada
   şunu da düzelttim" yapma.
3. Her bulguyu **dosya:satır** referansıyla ver. Referanssız iddia kabul
   edilmez.
4. Bir dosyanın/değerin var olduğunu tahmin etme — açıp doğrula. Doğrulayamadığın
   şeyi "doğrulanamadı" diye işaretle, uydurma.
5. Canlı veri gerekiyorsa `supabase db query --linked` ile ölç (salt okunur
   SELECT). Dokümandan sayı alma — CTO'nun kuralı: ölçülmemiş sayı yoktur.

## ÇIKTI
`docs/investigations/<İŞ_KODU>_KESIF.md` dosyası:
- **Yönetici özeti** — en fazla 5 madde, en kritik bulgular
- **Bulgular tablosu** — dosya:satır · açıklama · tahmini iş büyüklüğü (S/M/L)
- **Ölçülmüş sayılar** — varsa, sorgusuyla birlikte
- **DUR NOKTASI gerektiren maddeler** — ayrıca işaretlenir, mimari/schema
  değişikliği gerektiren her şey buraya
- **Doğrulanamayanlar** — erişemediğin veri/araç varsa açıkça yaz

## COMMIT
`git add docs/investigations/<dosya>` (tek dosya, `git add .` yasak)
Format: `docs(investigation): <iş kodu> keşif raporu`

## YASAKLAR
- Mimari karar alma — bu CTO'nun yetkisi, sen sadece raporlarsın
- "Şunu düzeltmeliyiz" değil, "şu durum var" yaz
- Doğrulanmamış kapanış dili ("çözüldü", "tamam", "kapandı") kullanma
