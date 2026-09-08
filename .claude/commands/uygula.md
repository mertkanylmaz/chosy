---
description: Kod değişikliği uygulama — kapsam kilidi, doğrulama ve commit disipliniyle
argument-hint: [iş kodu + ne yapılacak, örn. "K-54 #3 PaywallBase VoiceOver etiketleri"]
---

# UYGULAMA: $ARGUMENTS

## MOD
Kod değişikliği. **Aşağıdaki kapsam dışına çıkmak protokol ihlalidir.**

## ÖN KOŞUL — ATLANAMAZ
1. `.claude/skills/chosy-conventions/SKILL.md` + `CLAUDE.md` oku.
2. Değiştireceğin dosyaları **önce oku**. Görmeden düzenleme.
3. Bu iş **mimari/schema değişikliği** içeriyorsa (yeni tablo, yeni pattern,
   yeni bağımlılık, `types/gauntlet.ts`, migration, RLS, Edge Function
   sözleşmesi) → **DUR. Kod yazma. CTO onayı iste.**
   Emin değilsen sor — yanlış varsayımla ilerlemek her zaman daha pahalı.

## KAPSAM
Yalnızca yukarıda tanımlanan iş. Yan yolda gördüğün sorunları **not et,
düzeltme** — ayrı iş kalemi olarak raporla.

## KURALLAR (chosy-conventions'tan, her uygulamada geçerli)
- **Sessiz fallback yasak** — her `catch` ya Sentry'ye ya kullanıcıya görünür
- Kullanıcıya görünen her string `t()` üzerinden · `en.json` ↔ `tr.json` **tam parite**
- Renk/space/radius **token'dan**, hardcoded değer yok
- Migration dosyaları **geriye dönük düzenlenmez** — yeni migration yazılır
- `SECURITY INVOKER` tercih edilir, `DEFINER` sadece gerekçeliyse
- Modül seviyesi sabit ekleme, lazy getter kullan

## DOĞRULAMA — ZORUNLU, ÇIKTIYI GÖSTER
```
npm run typecheck            # baseline: 14 (scripts/) — ARTMAYACAK
npm run typecheck:functions  # baseline: 32/45 — ARTMAYACAK
git status                   # beklenmeyen dosya var mı
git diff --staged            # commit'ten önce her satırı gör
```
Baseline arttıysa **commit etme**, sebebi bul.

## COMMIT
- `git add <dosya1> <dosya2>` — dosya listesi açıkça yazılır, **`git add .` yasak**
- Parantezli Expo Router yolları tırnaklanır: `git add "app/(tabs)/profile.tsx"`
- Tek commit = tek mantıksal birim. Birden fazla bağımsız değişiklik varsa
  ayrı commit'ler
- Format: `<tip>(<scope>): <Türkçe açıklama>`
- `git commit -- <path>` **kullanma** (`--only` semantiği index'i atlar)

## RAPOR
Bitirince şunları yaz:
1. Değişen dosyalar + her birinde ne yapıldı
2. Doğrulama çıktıları (baseline korunuyor mu)
3. Kapsam dışında bırakılan/fark edilen şeyler
4. Aldığın herhangi bir yorum kararı varsa gerekçesiyle

## YASAKLAR
- Mimari karar alma — protokol ihlali
- Doğrulamayı atlayıp "çalışmalı" demek
- `--dangerously-skip-permissions`
- Doğrulanmamış kapanış dili ("closed", "complete", "tamamlandı")
