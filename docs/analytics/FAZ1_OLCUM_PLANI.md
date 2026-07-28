# Faz 1 Ölçüm Planı ve Haftalık Karar Ritüeli

> Sprint planındaki TASK G2.5'in karşılığı. Faz 1 kapandı; buradan sonrası
> yeni feature değil, **haftalık analitik okuması + tek darboğaz düzeltmesi**.
>
> Son güncelleme: 29 Temmuz 2026 — kapanış sprinti sonunda yazıldı.

---

## 0. Bu doküman niçin var

Faz 1 boyunca 7 oyun, ortak DNA/XP sistemi, günlük tema, sandık ve keşif köprüsü
kuruldu. Kapanış denetiminde çıkan ders net: **ölçülmeyen şey çürüyor.** WhyThisMovie
kartı hiç render edilmiyordu, Detective'in keşif butonları boş handler'dı, sandık
ödülleri hiç uygulanmıyordu — hiçbiri fark edilmemişti çünkü hiçbiri panoda
görünmüyordu. Bu doküman panoyu tanımlar ve panonun her hafta nasıl okunacağını
yazar.

---

## 1. Kapı metrikleri (Faz 2 kararı bunlara bakar)

| Metrik | Hedef | Kaynak | Rol |
|---|---|---|---|
| D7 farkı: ilk 3 günde ≥1 görev tamamlayan vs tamamlamayan | **≥ +10 puan** | PostHog cohort | **Birincil kapı** |
| 7 günlük tamamlama medyanı | **≥ 3/7** | PostHog | **İkincil kapı** |
| Paylaşım oranı (`game_share_completed` / `game_daily_completed`) | ≥ %8 | PostHog funnel | İzleme |
| `guesses_used` medyanı (CineMetrics) | 4/6 | PostHog | Zorluk kalibrasyonu |
| Crash-free sessions | ≥ %99.5 | Sentry | Release sağlığı |

**Kill-criteria (onaylı):** İki kapı metriği 4 haftada karşılanmazsa Faz 2 tab
mimarisine geçilmez; oyunlar hub'da kalır ve strateji oturumu yeniden açılır.

---

## 2. Kurulacak 4 PostHog insight'ı

### 2.1 D7 cohort farkı (birincil kapı)
- **Cohort A:** kayıt tarihinden itibaren 3 gün içinde ≥1 `game_daily_completed`
- **Cohort B:** aynı pencerede hiç `game_daily_completed` yok
- **Ölçüm:** Retention insight, 7. gün dönüş oranı, A − B (puan farkı)
- Not: cohort tanımı kayıt tarihine göre kurulur; aksi halde eski kullanıcılar
  A'yı şişirir.

### 2.2 Oyun funnel'ı
```
game_daily_opened
  → game_guess_submitted
  → game_daily_completed
  → game_result_card_viewed
  → game_share_card_rendered
  → game_share_completed
```
- `game_id` ile kır (breakdown) — 6 aktif oyunun her biri ayrı seri olmalı.
- **Seri boşsa telemetri kırılmıştır, oyun ölü değildir** — önce event'i doğrula.

### 2.3 Haftalık tamamlama dağılımı
- Kullanıcı başına haftalık `game_daily_completed` sayısı (tekil gün), histogram
- Hedef: medyan ≥ 3/7

### 2.4 `guesses_used` dağılımı
- `game_daily_completed` → `guesses_used` breakdown, `game_id` kırılımlı
- Tüm oyunlar aynı alanı gönderir (kapanışta düzeltildi; önceden Spotlight
  `turns_used`, Detective `total_guesses` gönderiyordu ve dağılımdan düşüyorlardı)

---

## 3. Keşif dönüşümü (ürünün asıl bahsi)

Chosy'nin tezi "oyun → film keşfi". Bu zincir ayrı bir funnel olarak kurulur:

```
game_daily_completed
  → game_why_this_movie_viewed
  → game_film_page_opened
  → game_watchlist_added
```

Bugün için **taban çizgisi yok**: kapanış sprintine kadar `game_watchlist_added`
hiç ateşlenmiyordu (buton izleme listesine eklemiyor, yalnızca yönlendiriyordu)
ve `why_this_movie` yalnızca Detective'te üretiliyordu. İlk 2 haftanın verisi
taban çizgisidir; hedef sonra konur.

---

## 4. Telemetri taksonomisi

Tek kaynak: `utils/gameAnalytics.ts`. Event adı uydurulmaz; yeni ad önce
`.claude/game-system-brief.md` listesine eklenir.

| Event | Ne zaman | Kritik alanlar |
|---|---|---|
| `game_daily_opened` | Oyun ekranı açıldı | game_id, puzzle_no, source |
| `game_guess_submitted` | Tahmin gönderildi | game_id, guess_no, latency_ms |
| `game_hint_used` | İpucu açıldı (FadeIn) | game_id, hint_type, hint_no |
| `game_confidence_set` | Güven bahsi (Imposter) | game_id, round, confidence |
| `game_daily_completed` | Oyun bitti | game_id, won, guesses_used, xp, time_to_solve_s |
| `game_result_card_viewed` | Sonuç kartı göründü | game_id, solved |
| `game_why_this_movie_viewed` | Keşif kartı göründü | game_id |
| `game_film_page_opened` | Film sayfasına geçildi | game_id, film_id |
| `game_watchlist_added` | Listeye eklendi | game_id, film_id |
| `game_share_card_rendered` | Paylaşım başlatıldı | game_id |
| `game_share_completed` | Paylaşım tamamlandı | game_id, channel |
| `game_play_next_tapped` | Sonraki oyuna geçildi | from_game, to_game |
| `game_daily_chest_opened` | Sandık açıldı | — |
| `game_theme_teaser_viewed` / `game_theme_revealed` | Günlük tema | completed/total, theme_type |
| `game_hub_dna_card_viewed`, `game_recommended_route_tapped`, `game_milestone_earned` | Hub | — |

**Bilinen boşluk:** `game_milestone_earned` hâlâ hiç çağrılmıyor (koleksiyon
seviye atlama noktasına bağlanmadı). Sıradaki haftalık turda kapatılacak.

---

## 5. Haftalık ritüel (Pazartesi, tek sayfa)

Kural: **her hafta yalnızca BİR darboğaz.** Yeni fikir eklenmez; funnel'daki en
büyük düşüş neredeyse oraya dokunulur.

1. **Funnel'daki en büyük düşüş hangi adımda?** (oyun kırılımıyla)
2. **Geçen haftanın değişikliği metriği hareket ettirdi mi?**
   - Evet → tut, bir sonraki darboğaza geç
   - Hayır → **geri al veya bırak**, üstüne yeni katman ekleme
3. **Kapı metrikleri nerede?** (D7 farkı, haftalık medyan — trend olarak)
4. **Sentry:** crash-free oran ve en sık 3 hata
5. **Bu hafta dokunulacak tek şey:** …

Bu 5 maddelik notu `docs/analytics/haftalik/YYYY-MM-DD.md` altına yaz. Karar
geçmişi olmadan "bu değişiklik işe yaradı mı" sorusu 3 hafta sonra
cevaplanamıyor.

---

## 6. Ölçüm sağlığı kontrolü (her release öncesi)

- [ ] 6 aktif oyunun her biri oynanınca `opened → guess → completed → result_card`
      zinciri PostHog'da görünüyor (boş seri yok)
- [ ] `game_daily_completed` içinde `guesses_used` her oyunda dolu
- [ ] Paylaşım akışı `game_share_card_rendered` + `game_share_completed` üretiyor
- [ ] `deno test tests/game-system/ --allow-net --allow-env --allow-read` yeşil
      (S0 çözüm sızıntı testi dahil — release-blocker)
