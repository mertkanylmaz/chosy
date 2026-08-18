# M2 — Zaman Mimarisi

**Başlangıç:** 18 Ağustos 2026
**Bağlı bible maddesi:** E-01, K-03, D-02

## Amaç
"18:00 kimin saatine göre?" sorusunu çözmek (E-01). Günlük ritüelin gün
sınırı ve bildirim saati bugün sunucu UTC'sine bağlı; ürünün tanımı ise
kullanıcının yerel akşamı.

---

## Faz 2a — Veri temeli (TAMAMLANDI)

### Kapsam
- **Write-through timezone:** `generate-gauntlet` istek gövdesi cihazın IANA
  saat dilimini kabul ediyor ve `users.timezone`'a yazıyor (commit 5671714).
  İstemci tarafı çağrıya cihaz saat dilimini ekliyor (commit 51e5014).
  Sözleşme değişimi **gauntlet-contract prosedürü** izlenerek yapıldı;
  `types/gauntlet.ts` kilidine dokunulmadı.
- **D-02 uyumu:** `schedule-notifications` ritüel push'u için **sabit 18:00**
  kullanıyor, `preferred_notification_hour` okumuyor (commit 3678b7b).
  Kolon şemada duruyor, dokunulmadı.
- **`send-daily-pick` aktiflik kontrolü:** Fonksiyon **atıl** bulundu —
  şu an D-02 fiilen ihlal edilmiyor.
- **Bulgu — bildirim hattı çift-ölü:** Hem üretici hem boşaltıcı tarafın
  cron'a bağlı olmadığı görüldü. Bildirim hattı bugün hiç çalışmıyor.
  C.9b kapsamına not düşüldü.

### Durum
Tamamlandı — 18 Ağustos 2026.

---

## Faz 2b — Gün anahtarını kullanıcıya bağlamak (BEKLİYOR)

### Kapsam (henüz yapılmadı)
- `generate-gauntlet` ve `update_streak`'in gün anahtarını UTC yerine
  `users.timezone`'a bağlaması.

### Neden bekliyor
Write-through verisi **18 Ağustos 2026'da** devreye girdi; henüz yeterli
örneklem birikmedi. Gün anahtarını gerçek IANA verisi olmadan değiştirmek,
ölçümsüz mimari değişiklik olurdu (E-01 ihlali).

### Tetikleyici (net koşul)
`users.timezone` değeri `'UTC'` **olmayan** (gerçek IANA) kullanıcı sayısı
**iki haneye (≥10) ulaştığında** VEYA **1 hafta geçtiğinde**
(**≥ 25 Ağustos 2026**) — hangisi önce gerçekleşirse — sayım tekrar alınır
ve Faz 2b değerlendirilir.

**Son sayım (18 Ağu 2026, canlı):** 237 satırın **8'i** gerçek IANA,
**229'u** hâlâ `'UTC'`, NULL yok. → Eşik henüz aşılmadı.

Sayım komutu (read-only, PostgREST üzerinden):
`users` tablosunda `timezone <> 'UTC'` satır sayısı.

### Durum
Açık.

---

## DUR NOKTALARI
| # | Soru | Cevap | Tarih |
|---|---|---|---|
| 1 | Timezone kaynağı nasıl kurulsun? | **Write-through** — istemci gönderir, sunucu `users.timezone`'a yazar; gauntlet-contract prosedürüyle, `types/gauntlet.ts` kilidine dokunmadan | 18 Ağu 2026 |
| 2 | Streak'te seyahat / DST kuralı ne olacak? | Mevcut ±1 gün toleransı korunur. Timezone-değişim damgası **ertelendi** — yeni kolon demek, ayrı onay gerektirir | 18 Ağu 2026 |
| 3 | `preferred_notification_hour` çelişkisi? | D-02 gereği ritüel push'u için **okunmuyor** artık; kolon şeması dokunulmadı | 18 Ağu 2026 |

## Doğrulama
| Komut | Beklenen | Sonuç |
|---|---|---|
| `npm run typecheck` | Baseline: 14 hata, hepsi `scripts/` | ✅ 14 hata, hepsi `scripts/` |
| Canlı `users.timezone` sayımı | Write-through sonrası `'UTC'` olmayan satır artmalı | ✅ 8 gerçek IANA / 229 `'UTC'` (18 Ağu 2026) |
| `send-daily-pick` aktiflik kontrolü | Cron'a bağlı mı? | ✅ Atıl — D-02 şu an ihlal edilmiyor |

## Commit'ler
`5671714` · `51e5014` · `3678b7b`

## Durum
**Kısmi** — Faz 2a Tamamlandı 18 Ağustos 2026 · Faz 2b Açık (tetikleyici yukarıda).
