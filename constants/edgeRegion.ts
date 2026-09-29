/**
 * Gauntlet Edge Function'larının çalıştırılacağı bölge — TEK TANIM.
 *
 * ── Neden ─────────────────────────────────────────────────────────────────
 * TestFlight 906 ölçümü (29 Eyl 2026): istek en yakın edge'e (eu-central-1,
 * FRA) düşüyor, veritabanı ise us-west-1'de. submit-choice içinde 8-9 ardışık
 * DB çağrısı var; her biri FRA ↔ us-west-1 gidiş-dönüşü ödüyor, toplam ~3 s.
 * DB sorgularının kendisi <1 ms (pg_stat_statements). Fonksiyonu DB'nin
 * bölgesinde çalıştırmak bu gidiş-dönüşleri bölge içine indirir.
 *
 * ── Kural ─────────────────────────────────────────────────────────────────
 * - Değer DB bölgesiyle AYNI olmalıdır. DB taşınırsa değişecek tek yer burası.
 * - `.env`'den OKUNMAZ (CTO kararı): build'e göre değişen bir ayar değil,
 *   projenin fiziksel yerleşimidir.
 * - Otomatik yedek bölge YOK: bölge kesintisi Sentry'de görünür kalır
 *   (`services/gauntletService.ts` → `recordTiming`).
 * - Yalnız submit-choice, generate-gauntlet ve get-archive-status bu bölgeyle
 *   çağrılır; diğer fonksiyonlar kapsam dışıdır.
 */
import { FunctionRegion } from '@supabase/supabase-js';

export const GAUNTLET_EDGE_REGION = FunctionRegion.UsWest1;
