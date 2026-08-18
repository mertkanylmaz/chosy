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

## Cihaz Doğrulaması
Cihaz doğrulaması 18 Ağu 2026'da tamamlandı — PostHog Live'da
`identity_reset_detected` event'i gözlemlendi (`Application Backgrounded →
app_launched → identity_reset_detected → Application Opened → Application
Became Active` sırası). Bkz. durum devri §3.

## Durum
Tamamlandı — 18 Ağu 2026.
