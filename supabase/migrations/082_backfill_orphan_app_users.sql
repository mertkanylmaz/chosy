-- ============================================================================
-- Migration 082: orphan auth kimlikleri icin public.users backfill
--
-- ── Teshis (14 Agustos 2026) ─────────────────────────────────────────────────
-- auth.users 227 / public.users 139 / orphan (auth var, public yok) 88.
-- 88'in tamami (87 anonim + 1 email test hesabi test@chosy.ai) 10 Agustos 2026
-- bootstrap deploy'undan (f44fac2, ensureAppUser INITIAL_SESSION+SIGNED_IN)
-- ONCE dogmus. Deploy sonrasi doganlarin 2/2'si satiri ~1 saniyede aldi —
-- bootstrap bugun sizdirmiyor.
--
-- ── Gerekce ───────────────────────────────────────────────────────────────
-- Bootstrap istemci kodunda (app/_layout.tsx). Eski bir build'le donen bir
-- orphan kimlik ensureAppUser()'i hic calistirmaz: app_user_id() NULL doner,
-- ve `user_id = (SELECT public.app_user_id())` desenindeki RLS policy'leri
-- (069, 070) bunu HATA VERMEDEN, sessizce 0 satirla yanitlar (fiilen olculdu:
-- anon rolde game_scores 12→0, cinema_dna 1→0, users 139→0, hepsi HTTP 200).
-- Kullanici bos bir uygulama gorur, Sentry'ye hicbir sey dusmez — CLAUDE.md
-- kural 1'in (sessiz fallback yasak) istemci disi bir yoldan ihlali. Bu
-- backfill o yolu kapatir: geri donen her eski build de artik dolu bir
-- public.users satirina sahip olur.
--
-- ── Kapsam ────────────────────────────────────────────────────────────────
-- Yalniz INSERT. UPDATE/DELETE yok, mevcut 139 satirin hicbirine dokunulmaz
-- (NOT EXISTS + ON CONFLICT DO NOTHING cift guvence). auth.users'a yazilmaz.
-- created_at auth.users'tan tasinir (NOW() DEGIL) — 88 kullanicinin "bugun
-- kaydolmus" gorunmesi kohort analizini (docs/os/1_CHOSY_PRODUCT_OS.md §8.6)
-- kalici olarak bozar. test@chosy.ai dahildir, ozel durum kodu yazilmaz.
--
-- ── Bilinen etki: kullanici sayisi enflasyonu ────────────────────────────────
-- public.users 139 → 227. PRODUCT_OS §8.6 ve BUSINESS_MODEL §2'deki "135/139
-- kullanici" ifadeleri bu migration sonrasi UC PARCALI okunmali:
--   auth.users 227 · public.users 227 (88'i backfill, aktivitesiz) ·
--   davranis gecmisi olan 139
-- 1.000 kullanici kapisi aktivite tabanli (son 28 gunde >=1 tamamlanmis
-- gauntlet) tanimli oldugu icin kapi bozulmuyor, yalniz belgedeki ciplak
-- sayi guncellenmelidir (ayri dokuman isi, bu migration'in kapsami disi).
--
-- ── "Kurucu Uye" rozeti ile kesismez ─────────────────────────────────────────
-- BUSINESS_MODEL §9 rozeti bu 88 backfill satirina VERILMEMELI — mantik
-- users tablosu uyeliginden degil aktiviteden (>=1 mood_search / game_score /
-- watchlist satiri) turetilmeli. Bu C.7 kapsaminda ayrica ele alinacak, bu
-- migration rozet mantigina dokunmaz.
--
-- ── DOWN SCRIPT YOK — bilincli karar ─────────────────────────────────────────
-- users uzerinde DELETE'li bir geri alma yazilmiyor (CLAUDE.md kural 4: film
-- verisinde DELETE yok ilkesiyle ayni ruh, users'a da uygulaniyor). Geri alma
-- gerekirse asagidaki tespit sorgusuyla backfill satirlari gozle secilip elle
-- silinir — hicbir zaman migration olarak degil:
--
--   SELECT pu.id, pu.auth_id, pu.created_at
--   FROM public.users pu
--   WHERE pu.created_at < '2026-08-10'
--     AND NOT EXISTS (SELECT 1 FROM choice_events ce WHERE ce.user_id = pu.id)
--     AND NOT EXISTS (SELECT 1 FROM game_scores gs WHERE gs.user_id = pu.id)
--     AND NOT EXISTS (SELECT 1 FROM watchlist w WHERE w.user_id = pu.id);
-- ============================================================================

INSERT INTO public.users (auth_id, created_at)
SELECT au.id::text, au.created_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.auth_id = au.id::text
)
ON CONFLICT (auth_id) DO NOTHING;
