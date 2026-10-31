# MONEY-1C — `anon` / `authenticated` tablo yetkileri taraması (öneri raporu; HİÇBİR ŞEY UYGULANMADI)

Tarih: 25 Eki 2026. Kaynak: canlı `chosy ai` (`xpcwihldlnlmyopjubdc`), salt-okunur `has_table_privilege` + `pg_policies` + `pg_default_acl` sorguları.
Karar: yalnız `mood_searches` → migration 140. Aşağısı diğer tablolar için ÖNERİDİR; her madde ayrı onay ister.

## 1. Özet
- Taranan tablo: public şemada ~50; **hepsinde RLS açık**.
- `anon` ve `authenticated`, tabloların büyük çoğunluğunda `DELETE, TRUNCATE, REFERENCES, TRIGGER` taşıyor (Supabase varsayılan yetkisi). `pg_default_acl`: `supabase_admin` rolüyle oluşan tablolar hâlâ `arwdDxtm` alır; `postgres` rolüyle oluşanlar artık yalnız `postgres + service_role` alır — yani varsayılan bir noktada düzeltilmiş, ESKİ tablolar kalmış.
- Kapalı olanlar: `deletion_requests`, `editorial_calendar_days`, `editorial_calendar_films` (anon/auth yetkisi yok — örnek alınacak biçim). `subscriptions` ve `user_daily_quotas` için INSERT/UPDATE/DELETE zaten kapatılmış (135/137), ama TRUNCATE/REFERENCES/TRIGGER kalmış.
- **Gerçek risk:** `TRUNCATE` RLS'i ATLAR. PostgREST/Supabase istemcisi TRUNCATE sunmadığı için bugün istismar yolu yok; yetki yalnız derinlemesine savunma sorunu. REFERENCES/TRIGGER de SQL erişimi gerektirir.
- **Daha önemli ikinci bulgu:** `anon` çoğu tabloda `INSERT/UPDATE/SELECT` taşıyor. Bunları yalnız RLS koruyor. Bir policy hatalı yazıldığında sızar — `watchlist` (099/100) olayı tam buydu.
- Policy incelemesi (örneklem): `api_rate_limits`, `notification_log`, `referrals`, `winback_queue` policy'leri service_role'e kilitli; `custom_*`, `posterle_*`, `roulette_picks`, `watchlist`, `users`, `trial_claims` sahip-kapsamlı. Acil bir policy açığı görülmedi.

## 2. Tablo grupları (canlı durum → öneri)

| Grup | Tablolar | Mevcut | Öneri |
|---|---|---|---|
| A. Yalnız sunucu yazar (policy `service_role`) | `api_rate_limits`, `notification_log`, `referrals`, `winback_queue` | anon/auth tam yetki; policy yalnız service_role | anon+authenticated'tan **tüm** yetkileri al (`notification_log` hariç: sahibi SELECT eder) |
| B. Katalog / yapılandırma, istemci okur | `app_config`, `subscription_limits`, `promo_codes`, `films`, `film_profiles`, `daily_gauntlets`, `daily_puzzles`, `daily_themes`, `posterle_puzzles`, `milestones`, `milestone_collections`, `context_patterns`, `lifetime_sales` | anon/auth INSERT/UPDATE/DELETE dahil tam | istemciye yalnız `SELECT`; INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER al. **`app_config` ve `subscription_limits` en yüksek öncelik** (fiyat/limit/bayrak) |
| C. Kullanıcı-sahipli, istemci yazar | `users`, `watchlist`, `custom_lists`, `custom_list_films`, `roulette_picks`, `posterle_attempts`, `posterle_streaks`, `user_streaks`, `user_milestones`, `user_taste_signals`, `swipes`, `watch_feedback`, `game_scores`, `arcade_runs`, `feedback`, `sessions`, `trial_claims`, `paywall_events`, `choice_events`, `cinema_dna`, `context_corrections`, `daily_chest_log`, `duel_impressions`, `streak_rewards`, `referral_rewards`, `user_collection_progress`, `posterle_hint_reveals` | anon/auth tam | `anon`'dan yazma yetkilerini al; `authenticated`'tan `TRUNCATE, REFERENCES, TRIGGER` al; `DELETE`'i yalnız DELETE policy'si olan tablolarda bırak (`watchlist`, `custom_lists`, `custom_list_films`, `roulette_picks`, `posterle_*`) |
| D. Kota/abonelik (kısmen kilitli) | `subscriptions`, `user_daily_quotas` | yalnız SELECT + TRUNCATE/REFERENCES/TRIGGER kalmış | `TRUNCATE, REFERENCES, TRIGGER` al |
| E. Zaten kapalı | `deletion_requests`, `editorial_calendar_*` | yok | — |

> Grup üyelikleri tablo adı/policy'den çıkarıldı; her tablo için **istemci çağrı yerleri (tag 2.1.0–2.1.3) taranmadan** revoke yazılmaz.

## 3. Önerilen yol (karar bekler)
1. **Tek, risksiz adım:** `REVOKE TRUNCATE, REFERENCES, TRIGGER` — tüm public tablolarda `anon, authenticated`'dan. PostgREST bunları kullanmaz → istemci etkisi sıfır. Dry-run: `has_table_privilege` karşılaştırması + temsilci tablolarda eski istemci insert/update şekli (140_dryrun.sql kalıbı).
2. **`DELETE` daralt:** DELETE policy'si olmayan tablolarda DELETE zaten RLS ile reddedilir; revoke davranışı değiştirmez. service_role akışları (delete-account) etkilenmez, doğrulanmalı.
3. **`anon` yazma yetkilerini al (grup B/C):** her tablo için tag 2.1.x istemcilerinin yazdığı kolon/rol seti çıkarılmalı (139'da `mood_searches` için yapılan analiz kalıbı). Anonim oturum `authenticated` rolüyle gelir; `anon` yalnız oturumsuz istek. Daha büyük iş (≈0,5–1 gün), 140'tan ayrı.
4. **Grup B'de istemci yazma yetkisini kaldır** (`app_config`, `subscription_limits`, `promo_codes`, `lifetime_sales`): en yüksek değer, istemciden asla yazılmamalı.
5. **Önleme:** `supabase_admin` varsayılan ACL'ini (`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ... FROM anon, authenticated`) postgres'inkiyle hizala; aksi halde Dashboard/extension kaynaklı yeni tablolar aynı yetkileri alır. Platform tarafında kısıtlı olabilir — Supabase doküman/destek teyidi gerekir.
6. **Süreklilik:** "yeni tablo anon/auth'a gereksiz yetki almıyor" kontrolü migration-guard'a kural olarak eklenebilir.

## 4. Kapsam dışı notlar
- `mood_searches` için `MAINTAIN` ve `anon SELECT` ayrıca ele alınmadı (RLS `auth_user_id()` null döndüğünden anon satır göremez).
- `has_table_privilege` rol üyeliklerini de sayar; `PUBLIC`'e verilmiş yetki ayrıca sayılmadı.
