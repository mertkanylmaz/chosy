-- ============================================================
-- 099_watchlist_drop_permissive_policies.sql
--
-- P0 — watchlist tablosu anon role'e tamamen açıktı.
-- Bulgu: C.9b keşfi (19 Ağu 2026), anon anahtarıyla oturumsuz probe
-- 312 satır / 27 benzersiz user_id döndürdü.
--
-- ─── Kök neden ──────────────────────────────────────────────────────────────
-- RLS'in kendisi AÇIKTI (pg_class.relrowsecurity = true) ve 008/083'ün
-- owner policy'leri DOĞRU yazılmıştı. Sorun, pg_policies'te bu 4 policy'nin
-- yanında duran ve MIGRATION GEÇMİŞİNDE HİÇ BULUNMAYAN 3 policy'ydi:
--
--   watchlist_select_all   SELECT  USING (true)
--   watchlist_insert_all   INSERT
--   watchlist_delete_all   DELETE  USING (true)
--
-- Bu üç ad supabase/ dizininin tamamında geçmiyor — yani bir migration
-- tarafından yaratılmadılar, Dashboard/SQL editor üzerinden elle eklenip
-- migration takibinin dışında kaldılar. CLAUDE.md kural 3'ün uyardığı
-- senaryonun sahada gerçekleşmiş hali.
--
-- Postgres'te aynı komut için birden çok PERMISSIVE policy VEYA (OR) ile
-- birleşir. `USING (true)` diyen bir policy eklendiği an, yanındaki doğru
-- owner policy'sinin hiçbir kısıtlayıcı etkisi kalmaz. Doğru policy'nin
-- varlığı yanlış policy'yi telafi ETMEZ — sızıntının mekanizması budur.
--
-- ─── Etki ───────────────────────────────────────────────────────────────────
-- select_all → oturumsuz okuma (ölçüldü: 312 satır, 27 kullanıcının
--              user_id/film_id/watched_at eşlemesi = PII)
-- delete_all → oturumsuz silme (27 kullanıcının watchlist'i silinebilir)
-- insert_all → oturumsuz ekleme (başkasının user_id'sine satır yazılabilir)
-- UPDATE'te karşılık gelen bir _all policy'si YOK — güncelleme owner-only.
--
-- Yazma yolları sahada DENENMEDİ (canlı veride yazma yapılmadı); çıkarım
-- policy tanımından, deneyden değil.
--
-- ─── Bu migration'ın YAPMADIKLARI (bilinçli) ────────────────────────────────
-- - ENABLE ROW LEVEL SECURITY yazılmadı: RLS zaten açık, gereksiz.
-- - 008/083'ün owner policy'lerine dokunulmadı: onlar doğru.
-- - anon/authenticated GRANT'ları REVOKE edilmedi: bunlar Supabase'in public
--   şema varsayılanı ve doğru policy'ler yürürlükteyken zararsız. Topluca
--   çekmek diğer akışları kırma riski taşır — ayrı ve ölçülmüş bir iş olmalı.
-- - Başka hiçbir tabloya dokunulmadı.
-- ============================================================

DROP POLICY IF EXISTS "watchlist_select_all" ON watchlist;
DROP POLICY IF EXISTS "watchlist_insert_all" ON watchlist;
DROP POLICY IF EXISTS "watchlist_delete_all" ON watchlist;

-- Sonraki durum (beklenen): watchlist üzerinde YALNIZCA 4 policy kalır —
--   "watchlist: owner read"   (008)
--   "watchlist: owner insert" (008)
--   "watchlist: owner delete" (008)
--   "watchlist: owner update" (083)

-- ─── DOWN SCRIPT ────────────────────────────────────────────────────────────
-- YOK — ve bilinçli olarak yok. Bu üç policy'yi geri yaratmak, kapatılan
-- P0 sızıntısını aynen yeniden açmak demektir. Geri alma gerekiyorsa sebebi
-- ayrıca incelenmeli; kör bir rollback script'i buraya YAZILMAZ.
-- ============================================================
