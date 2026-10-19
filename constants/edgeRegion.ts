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
 * - Bu bölgeyle çağrılanlar: submit-choice, generate-gauntlet, get-archive-status,
 *   submit-watch-feedback, submit-context-correction, explain-match (`invoke`
 *   `region`) ve merge-anonymous-user (ham fetch: `x-region` başlığı +
 *   `forceFunctionRegion` sorgusu — `invoke`'un yaptığının aynısı). Diğer
 *   fonksiyonlar kapsam dışıdır (parse-mood ham fetch, bölgesiz).
 *
 * ── Spotlight (20 Eki 2026, SPOT-1 / SPOT-2) ──────────────────────────────
 * docs/investigations/SPOT-1_KESIF.md (b5ed3bf): Spotlight harf isteği
 * (`submit-guess`) eu-central-1'de koştu ve sunucuda 3152 ms sürdü (tek örnek);
 * aynı pencerede bu bölgeye sabitli fonksiyonlar 0.6–1.4 s ortalamada kaldı.
 * Artık bu bölgeyle çağrılanlar: `submitSpotlightLetter` ve
 * `submitSpotlightGuess` (services/gameApi.ts → `submit-guess`). Sabitleme
 * tutmazsa `SPOTLIGHT_EDGE_REGION_MISMATCH` Sentry uyarısı yazılır.
 * Bilerek BIRAKILANLAR: `get-daily-challenge` (Spotlight dışında 5 oyun ekranı
 * da çağırıyor — CTO onayı bekliyor) ve `submit-guess`'in diğer oyun
 * sarmalayıcıları (donmuş oyunlar). Film arama (`searchFilms*`) Edge Function
 * değil, doğrudan PostgREST — bölge kavramı yok.
 */
import { FunctionRegion } from '@supabase/supabase-js';

export const GAUNTLET_EDGE_REGION = FunctionRegion.UsWest1;
