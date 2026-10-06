-- ============================================================================
-- 127 — deletion_requests: hesap silme tombstone'u (K-16, App Review 5.1.1(v))
--
-- Borç: docs/TEKNIK_BORC.md "🔴 Hesap silme 207 sonrası 'dirilen hesap'"
-- Karar: CTO, 7 Eki 2026 — seçenek B (tombstone + sunucu reconciler), P0.
--
-- SORUN:
--   delete-account public.users + CASCADE'i siler, sonra
--   auth.admin.deleteUser çağırır (delete-account/index.ts:313). Bu adım
--   başarısız olursa 207 döner: auth.users satırı ve cihazdaki oturum kalır.
--   Bir sonraki SIGNED_IN/INITIAL_SESSION'da ensureAppUser() boş, yeni id'li
--   bir public.users satırı açar. Kullanıcının sildiğini sandığı hesap boş
--   olarak geri gelir; PostHog silmesi (adım 5, :333) de hiç çalışmamıştır.
--
-- ÇÖZÜM (bu dosya yalnız VERİ KATMANI):
--   delete-account, silmeye başlamadan ÖNCE buraya bir satır yazar
--   (completed_at NULL). Tam başarıda completed_at doldurulur. 207 ya da
--   yarıda kalma durumunda satır bekleyen kalır; reconciler (Edge Function +
--   cron, ayrı iş) ve bir sonraki girişteki senkron reconcile, silmeyi
--   tamamlanana kadar idempotent olarak tekrarlar.
--   Edge Function, cron, delete-account değişikliği ve istemci tarafı bu
--   migration'ın KAPSAMI DIŞINDA.
--
-- KİMLİK UZAYI: auth_uid = auth.users.id (auth uzayı), public.users.id DEĞİL.
--   - FK YOK, bilerek: public.users silinmiş olabilir; auth.users satırı
--     reconcile'ın sonunda silinir ve tombstone ondan sonra da durmalıdır.
--   - PostHog distinct_id = auth.users.id (delete-account/index.ts:53), yani
--     bu kolon adım 5'i tek başına yeniden koşturmaya yeter.
--   - Kolon adı `user_id` değil `auth_uid`: bu projede `user_id` neredeyse
--     her tabloda public.users.id demek (migration 111'in ayırdığı iki uzay).
--     Aynı adı farklı uzayda kullanmak 111 sınıfı karışıklığı tekrar üretir.
--
-- ERİŞİM: yalnız service_role.
--   RLS açık, policy YOK (112 emsali). 096'nın default-privilege REVOKE'u yeni
--   tabloyu zaten kapsıyor; aşağıdaki açık REVOKE, 096'nın kapsamadığı
--   supabase_admin boşluğuna (8_DURUM_DEVRI §3/2) karşı savunma derinliğidir.
--
-- VERİ KORUMA: tombstone kişisel veri taşımaz (yalnız auth uid + zaman +
--   hata metni). Silinmiş kullanıcının uid'i kalıcı olarak tutulur; amaç
--   "bu uid silindi" bilgisinin kaybolmaması. last_error'a e-posta/PII
--   YAZILMAZ — yazıcı (delete-account / reconciler) bundan sorumludur.
--
-- GERİ ALMA: tablo yeni ve henüz yazıcısı yok, veri kaybı riski yok.
--   Geri alma ayrı migration'la (128): DROP TABLE public.deletion_requests.
--   Yazıcı deploy edildikten sonra geri alma, bekleyen silmeleri kaybettirir;
--   o noktada önce bekleyen satır sayısı ölçülür.
--
-- PUSH ÖNCESİ: supabase/migrations/ listesinde 127'nin tek olduğunu doğrula.
--   Şema değiştiren migration — bible §9 "Docker Desktop çalışmıyor" kalemi
--   gereği yedek kuralı; bu dosya yalnız YENİ tablo ekliyor, mevcut veriye
--   dokunmuyor.
-- ============================================================================

CREATE TABLE public.deletion_requests (
  auth_uid        uuid        PRIMARY KEY,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz NULL,
  attempts        integer     NOT NULL DEFAULT 0,
  last_attempt_at timestamptz NULL,
  last_error      text        NULL,
  CONSTRAINT deletion_requests_attempts_nonneg CHECK (attempts >= 0),
  CONSTRAINT deletion_requests_completed_after_requested
    CHECK (completed_at IS NULL OR completed_at >= requested_at),
  CONSTRAINT deletion_requests_last_error_len
    CHECK (last_error IS NULL OR length(last_error) <= 500)
);

-- Reconciler yalnız bekleyenleri tarar.
CREATE INDEX deletion_requests_pending_idx
  ON public.deletion_requests (requested_at)
  WHERE completed_at IS NULL;

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
-- Policy BİLİNÇLİ OLARAK YOK: istemci bu tabloyu okumaz/yazmaz.

REVOKE ALL ON TABLE public.deletion_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.deletion_requests FROM anon;
REVOKE ALL ON TABLE public.deletion_requests FROM authenticated;

COMMENT ON TABLE public.deletion_requests IS
  'Hesap silme tombstone''u (K-16, 127). auth_uid = auth.users.id (FK yok). completed_at NULL = silme bekliyor; reconciler tamamlanana kadar idempotent tekrar eder. Yalnız service_role.';
COMMENT ON COLUMN public.deletion_requests.auth_uid IS
  'auth.users.id — public.users.id DEĞİL. PostHog distinct_id ile aynı.';
COMMENT ON COLUMN public.deletion_requests.last_error IS
  'Son denemenin hata özeti (≤500). PII yazılmaz.';
