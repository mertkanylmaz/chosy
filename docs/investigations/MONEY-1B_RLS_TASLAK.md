# MONEY-1B — subscriptions / users abonelik alanları: yazım yetkisi taslağı

Tarih: 24 Eki 2026 · SALT OKUNUR ölçüm + **UYGULANMAMIŞ** migration taslağı.
Numara yerel+uzak `supabase migration list` ile doğrulanmadan dosyalanmaz (CLAUDE.md "Migration numaralandırma").

## Canlı durum (ölçüm: `pg_policies`, `role_table_grants`, `column_privileges`)

| tablo | policy | komut | koşul |
|---|---|---|---|
| `subscriptions` | Users can insert own subscriptions | INSERT | `user_id = auth_user_id()` |
| `subscriptions` | Users can update own subscriptions | UPDATE | `user_id = auth_user_id()` (WITH CHECK yok) |
| `subscriptions` | Users can view own subscriptions | SELECT | `user_id = auth_user_id()` |
| `users` | users: self insert / self update / self read | INSERT / UPDATE / SELECT | `auth_id = auth.uid()::text` |

- RLS açık (`relrowsecurity=true`, force yok). Policy rolleri `{public}`.
- Tablo ve kolon GRANT'ları `anon` + `authenticated` için INSERT/UPDATE dahil tam (`subscription_tier`, `subscription_active_until`, `subscription_will_renew`; `subscriptions.status/plan/expires_at` dahil).
- Kolon kısıtı yok: kendi `users` satırını güncelleyen herhangi bir oturum `subscription_tier`'ı (ör. `'lifetime'`) kendisi yazabilir; kota RPC'leri ve `submit-choice` bu kolonu okur. Kendi `subscriptions` satırı için de aynı (status/plan/expires_at). **Canlıda yazma denenmedi**; sonuç policy + grant okumasından çıkarıldı. Güvenlik açığı sınıfı: kendini Pro yapma.
- Tetikleyiciler: `users` üzerinde `set_updated_at` (BEFORE UPDATE), `trg_generate_invite_code` (BEFORE INSERT). Abonelik kolonlarını koruyan yok. `subscriptions` üzerinde tetikleyici yok.
- `auth_user_id()` = `SELECT id FROM public.users WHERE auth_id = auth.uid()::text`.

## İstemcinin yazdığı TÜM yerler (kod taraması)

| dosya:satır | tablo / kolon | ne zaman |
|---|---|---|
| `components/paywalls/PaywallBase/index.tsx:357-363` → `subscriptionService.ts:75-130` | `subscriptions` INSERT/UPDATE (plan, status='active', rc_customer_id) | satın alma sonrası |
| `PaywallBase/index.tsx:368-378` | `users.subscription_tier` | satın alma sonrası |
| `PaywallBase/index.tsx:437-461` | `users.subscription_tier` + `subscriptions` (restore) | restore sonrası |
| `contexts/SubscriptionContext.tsx:590-605` | `users.subscription_tier` (RC listener "defansif sync") | her customerInfo değişiminde |
| `subscriptionService.ts:136-148` `updateSubscriptionStatus` | `subscriptions.status` | çağıran yok (ölü) |
| `services/auth-utils.ts:101,237` | `users` INSERT/UPSERT yalnız `auth_id` | abonelik kolonu yok |

Sunucu yazanlar (service role / SECURITY DEFINER): `revenuecat-webhook`, `_shared/rcTransfer.ts`, `claim_lifetime_spot`.

## Taslak (UYGULANMADI)

```sql
-- XXX_subscription_write_guard.sql  (numara: migration list Local+Remote en yükseği +1)

-- 1) subscriptions: istemci yazma policy'leri kalkar; SELECT kalır.
DROP POLICY "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY "Users can update own subscriptions" ON public.subscriptions;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;

-- 2) users: abonelik kolonlarına yalnız service role / SECURITY DEFINER yazar.
--    Kolon-bazlı REVOKE tablo-düzeyi GRANT varken işlemez; bu yüzden tetikleyici.
--    current_user: PostgREST isteğinde 'authenticated'/'anon'; service_role,
--    postgres (SECURITY DEFINER sahibi) ve migration'lar geçer.
CREATE OR REPLACE FUNCTION public.guard_users_subscription_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.subscription_tier IS DISTINCT FROM 'free'
         OR NEW.subscription_active_until IS NOT NULL THEN
        RAISE EXCEPTION 'subscription columns are server-managed' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
       OR NEW.subscription_active_until IS DISTINCT FROM OLD.subscription_active_until
       OR NEW.subscription_will_renew IS DISTINCT FROM OLD.subscription_will_renew THEN
      RAISE EXCEPTION 'subscription columns are server-managed' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_guard_users_subscription_columns
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users_subscription_columns();
```

Rollback: tetikleyici + fonksiyon DROP, iki policy ve GRANT'lar yeniden oluşturulur (yukarıdaki canlı tablo).
`subscriptions` için `lifetime_sales` vb. Uzay B tabloları kapsam dışı.

## Ön koşullar (bu taslak tek başına GÜVENLİ DEĞİL)

1. **Webhook INITIAL_PURCHASE `subscriptions` satırını yaratmıyor**: yalnız UPDATE yapar, 0 satırda `SUBSCRIPTION_ROW_NOT_FOUND` uyarısı verip çıkar (`revenuecat-webhook/index.ts:606-638`). Satırı bugün istemci yaratıyor. İstemci yazımı kapanırsa yeni alıcının satırı hiç oluşmaz ve MONEY-1A'nın `trial` yazımı sahipsiz kalır. Önce INITIAL_PURCHASE/RENEWAL dalı `onConflict: 'user_id'` upsert'e çevrilmeli (TRANSFER zaten böyle: `rcTransfer.ts` `upsertSubscription`).
2. Satın alma sonrası kota penceresi: kota RPC'leri `users.subscription_tier` okur; istemci sync'i kalkınca tier webhook gelene kadar (saniyeler) Free kalır (`PaywallBase:365-367` yorumu).
3. Yeni tetikleyici = yeni pattern → CTO onayı.
