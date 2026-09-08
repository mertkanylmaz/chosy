---
description: Bible'a karar işleme — sürüm artışı ve karar günlüğü zorunlu
argument-hint: [karar özeti, örn. "E-14 ilk kullanıcı gauntlet fallback kararı"]
---

# BIBLE GÜNCELLEMESİ: $ARGUMENTS

## MOD
Doküman düzenleme. **Kod değişikliği yok.** Bu bir karar kaydıdır, kararın
kendisi CTO tarafından zaten verilmiştir — sen yalnızca yazıya geçiriyorsun.

## HEDEF DOSYA
`docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md`

## ÖN KOŞUL
1. Dosyanın **mevcut sürüm numarasını** oku (başlıkta).
2. İlgili bölümü oku — kararın hangi bölüme gireceğini belirle:
   - **§2 (K)** — yeni kilitli karar
   - **§3 (D)** — bir dokümandaki karar değiştirilerek kabul edildi
   - **§4 (R)** — reddedildi + yerine ne konuldu
   - **§5 (E)** — hiçbir dokümanda olmayan CTO eki
   - **§9** — açık teknik borç
3. Bu karar **mevcut bir maddeyle çelişiyorsa** → DUR, CTO'ya sor.
   Çelişkiyi sessizce çözme.

## TEMEL KURAL
> **Bible gerçeğe uydurulur, gerçek bible'a değil.** (D-12/D-13 emsali)

Koddaki gerçek davranış bible'la çelişiyorsa, doğru hamle bible'ı düzeltmektir
— kodu bible'a uydurmak değil. Bu durumu fark edersen ayrıca raporla.

## ZORUNLU ADIMLAR
1. Kararı ilgili bölüme, o bölümün mevcut formatına **birebir uyarak** ekle
2. Karar bir başka maddeyi geçersiz kılıyorsa, eski maddeye "geçersiz —
   bkz. <yeni madde>, <tarih>" notu düş (**silme**)
3. **§10 Karar Günlüğü'ne yeni satır** ekle: sürüm · tarih · değişiklik özeti
4. Dosya başındaki **sürüm numarasını artır** (v1.9 → v1.10 gibi)

Adım 3 ve 4 atlanırsa iş eksiktir — sürümsüz bir bible güncellemesi,
sonraki oturumların bayat kopya okumasına sebep olur.

## DOĞRULAMA
- Değişen tek dosya bible olmalı — `git status` ile teyit et
- Diff'i göster, her eklenen maddeyi tek tek listele
- Sürüm numarasının hem başlıkta hem karar günlüğünde tutarlı olduğunu doğrula

## COMMIT
`git add docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md`
Format: `docs(bible): <karar özeti> (v<yeni sürüm>)`
