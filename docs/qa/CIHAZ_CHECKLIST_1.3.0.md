# Cihaz Checklist — v1.3.0 (Faz 1 kapanışı + UI tutarlılık geçişi)

> ~15 dakika. Gece yapılan işlerin hiçbiri cihazda görülmedi — bu liste onun yerine geçer.
> Sırayla git, kırmızı bulursan not düş; hiçbiri build'i durdurmaz ama hepsi düzeltilir.

## 0. Ön koşul
- [ ] Dev-client açılıyor, çökme yok
- [ ] Games hub açılıyor: DNA kartı → tema kartı → sandık → önerilen rota → 6 oyun kartı
- [ ] **Quoted kartı listede GÖRÜNMÜYOR** (havuz tükendi, `games_enabled` dışında)

## 1. Her oyun için (CineMetrics, Logline, Spotlight, Imposter, FadeIn, Detective)
- [ ] **Yükleme:** açılışta pulse eden iskelet görünüyor (eski "Loading..." metni değil)
- [ ] **Hata:** uçak modunda aç → bulut ikonu + başlık + alt metin + **"Tekrar Dene" butonu**; butona bas → yükleme tekrar deniyor
- [ ] **İkonlar:** ekranda Ionicons kalıntısı yok — hepsi Phosphor duotone (yumuşak dolgulu)
- [ ] **Oynanış:** tahmin gönderiliyor, hızlı çift dokunuşta ikinci istek gitmiyor (arama kutusu kilitleniyor)
- [ ] **Sonuç:** XP/DNA animasyonu, "Neden Bu Film?" kartı, "Listeye Ekle" → gerçekten ekleniyor (buton "Eklendi"ye dönüyor)
- [ ] **Paylaş:** kart üretiliyor ve **film adı/yılı kartta GÖRÜNMÜYOR** (yalnızca oyun adı + emoji grid + skor + `#bulmacaNo`)

## 2. Sonuç ekranı tutarlılığı (özellikle bakılacak)
CineMetrics / Spotlight / Detective sonuç ekranları bu gece ilk kez paylaşım ve keşif kartı aldı.
- [ ] Paylaş butonu çalışıyor (önceden hiçbir şey yapmıyordu)
- [ ] "Neden Bu Film?" kartı CineMetrics ve Spotlight'ta görünüyor
- [ ] Detective'de köprü butonları (İzle / Listeye Ekle / Yorumlar) çalışıyor — önceden boştu
- [ ] Kartların dikey sıralaması makul, üst üste binme/taşma yok

## 3. Renk ve tipografi (görsel karar gerektiren tek yer)
- [ ] **İki teal tonu:** Detective'in vurgusu koyu teal, keşif kartınınki parlak teal. Yan yana bakıldığında rahatsız edici mi? Kararı ver:
  - Aynı kalsın → not düş, kapandı
  - Birleşsin → hangisi? (`Colors.teal` parlak / `Colors.tealDeep` koyu)
- [ ] Detective aşama geçiş başlığı ve paylaşım kartındaki `#numara` artık Inter — Playfair sadece film adları ve skorlarda kaldı, doğru görünüyor mu?

## 4. Sandık ve tema
- [ ] 6 oyunu bitir → sandık açılabilir hale geliyor
- [ ] Sandığı aç → "Streak Kalkanı" ve "Yarın 2x XP" rozetleri görünüyor (DNA Boost rozeti KALDIRILDI — uygulanmıyordu)
- [ ] Uygulamayı kapat/aç → sandık "alındı" olarak kalıyor (durum sunucudan)
- [ ] Tema kartı `???` → temalı oyunlar bitince açılıyor, doğru filmleri gösteriyor

## 5. Erişilebilirlik (VoiceOver kısa tur)
- [ ] Geri butonu, paylaş, listeye ekle, tekrar dene → hepsi "buton" olarak okunuyor
- [ ] Devre dışı butonlar "devre dışı" olarak okunuyor

## 6. PostHog (cihaz turundan sonra)
- [ ] 6 oyunun her biri için: `game_daily_opened → game_guess_submitted → game_daily_completed → game_result_card_viewed` akıyor
- [ ] `game_share_card_rendered` / `game_share_completed` düşüyor (6 oyunda da)
- [ ] `game_watchlist_added` düşüyor
- [ ] Boş seri varsa: telemetri kırık demektir, oyun değil — `docs/analytics/FAZ1_OLCUM_PLANI.md` §6

---

## Bilinen açık işler (bu turda aranmayacak)
- `game_milestone_earned` hâlâ bağlı değil
- FadeIn'in net posteri payload'da (blur istemcide) — sunucu tarafı blur ayrı iş
- Eski `errorContainer` / `loadingContainer` stilleri bazı dosyalarda kullanılmadan duruyor (ölü kod, zararsız)
