# MONEY-1C — `recommended_film_ids` neden boş görünüyordu (25 Eki 2026)

**Sonuç:** İstemcinin yazım yolu çalışıyor. Kod değişikliği gerekmedi. "Boş" görünüm,
test hesaplarının cascade ile silinmesi ve sunucu smoke testlerinin bıraktığı satırlardan
geliyor. Gerçek kullanıcı aramalarının ölçüm penceresindeki oranı 0 / 14 gün (kurucunun
tek aramasından başka örnek yok).

## Başlangıç hipotezi ve neden çürüdü

Hipotez: `mood_searches` UPDATE'i RLS/kolon guard'ı (135/137) yüzünden 0 satır etkiliyor.

- Canlı policy: SELECT, INSERT, UPDATE (`user_id = auth_user_id()`) var.
- `authenticated` rolünün `recommended_film_ids` ve `rpc_version` kolonlarında UPDATE yetkisi var; tabloda trigger yok.
- 135 ve 137 bu tabloya dokunmuyor.
- Sentry'de `success_path` / `fallback_path` 0-satır kaydı yok (yalnız REACT-NATIVE-H: `search_id_missing`, build 911, 2 olay).
- PostHog `mood_search_update_debug`: 21–24 Eki arasında `rowsAffected = 1`, `updateError = null`.

## Kök neden (canlı, salt okuma)

1. `mood_searches_user_id_fkey` → `users`, `ON DELETE CASCADE`. PostHog'da `rowsAffected = 1`
   olup tabloda bulunmayan 12 search_id, sonradan silinen test hesaplarına aittir; satırlar
   cascade ile gitti. Kontrol: PostHog'daki 12 search_id'den canlı `mood_searches`'te bulunan = 0.
2. Dolu tek satır: `b3c603e8…` (24 Eki 23:42 UTC) — kurucunun preview cihaz testi (rızası olan tek kullanıcı).
3. Boş satırların sahipleri hesap açılışından 3–7 sn sonra arama yapıyor, rıza yok,
   kota / `INVALID_INPUT` desenleri: `tests/founder-acceptance/runner.ts`
   (`signInAnonymously` + gerçek parse-mood) gibi sunucu smoke testleri. İstemci UPDATE yolu hiç çalışmıyor.

## Yazım yolunun doğruluğu (a2)

`services/recommendations.ts` başarı yolu `films.map(f => f.id)` yazar. `films`, sırasıyla:
rerank sırası → kalite süzgeci → `FINAL_CAP = 8` → `rowToFilm` → `injectUnexpectedTypes`
(1:1 `map`; sıra ve uzunluk değişmez, yalnız `pick_type` ekler). `useFeedManager` `ADD_FILMS`
bu diziyi aynı sırayla ekler (`markSurpriseCards` yalnız işaretler). Yani yazılan, kalite
süzgecinden sonraki gerçek ve sıralı ilk deste. Fallback yolu da son desteyi yazar.

**Bilinen sınır:** yalnız ilk batch (≤ 8). Sonraki batch'ler yazılmaz; MONEY-1C için yeterli.

## Açık nokta

PostHog `distinct_id`'leri PostHog'un kendi anonim kimlikleridir (UUIDv7); `users.id` ile
doğrudan eşleşmez (10 kimlikten 1'i eşleşti). Hesap eşlemesi için `identify` zinciri gerekir;
bu raporda gerekmedi.

## Sonraki adımlar

- Smoke testleri canlıda iz bırakmamalı → `docs/TEKNIK_BORC.md`, "Smoke test kirliliği".
- Yeni aramalarda `recommended_film_ids` güvenilirliği Faz 3 release engelidir; gerçek
  kullanıcıyla (rızalı, silinmemiş hesap) cihazda ölçülecek.
