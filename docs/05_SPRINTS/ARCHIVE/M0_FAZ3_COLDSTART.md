# M0 Faz 3 — Cold-Start Kimlik Sıfırlama

**Başlangıç:** (durum devrinde belirtilmemiş)
**Bağlı bible maddesi:** (durum devrinde belirtilmemiş)

## Amaç
Cold-start kimlik sıfırlama görünürlüğü, CLAUDE.md düzeltmesi.

## Kapsam
- `utils/identityReset.ts` çıktısı
- 10/10 Deno testi

## Kapsam DIŞI
(durum devrinde belirtilmemiş)

## DUR NOKTALARI
| # | Soru | Cevap | Tarih |
|---|---|---|---|
| (durum devrinde detay yok) | | | |

## Doğrulama
| Komut | Beklenen | Sonuç |
|---|---|---|
| Deno testleri | 10/10 geçmeli | 10/10 geçti |

## Açık Madde
Cihazda cold-start doğrulaması henüz yapılmadı: uygulamayı aç-kapat →
yalnızca `sb-xpcwihldlnlmyopjubdc-auth-token` AsyncStorage anahtarını sil →
yeniden aç → PostHog'da `identity_reset_detected` + `trigger: cold_start`
görünmeli. C.9a test build'i dağıtılmadan önce yapılmalı.

## Durum
Açık.
