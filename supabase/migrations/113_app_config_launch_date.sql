-- ============================================================================
-- 113 — app_config.launch_date'i koda bağla (E-19)
--
-- Keşif: docs/investigations/E19_GENERATE_GAUNTLET_KESIF.md ("Doğrulanamayanlar")
-- Şema:  112_editorial_calendar.sql (takvimde DATE kolonu yok — gerekçe orada)
-- Desen: 035_app_config.sql (aynı durum: prod'da elle çalıştırılmış içeriğin
--        versiyon kontrole geriye dönük yazılması)
--
-- ── NEDEN BU MİGRATION VAR ──────────────────────────────────────────────────
-- `launch_date` satırı prod'a `scripts/ingest-editorial-films.ts` koşumu
-- sırasında CTO tarafından elle yazıldı (19 Eyl 2026) ve hiçbir migration'da
-- izi yoktu. Yani şemanın kendisi bu anahtarın varlığını GARANTİ ETMİYORDU.
--
-- Bu, E-19 dalı canlıya çıktıktan sonra taşıyamayacağımız bir boşluk:
-- `generate-gauntlet` artık HER yeni üretimde bu anahtarı okuyor
-- (`_shared/editorialCalendar.ts` → `fetchLaunchDate`) ve anahtar yoksa
-- `getAppConfig` throw eder → dış catch → Sentry fatal → 503. Kayıp bir satır
-- yalnız editoryal günleri değil, 100. gün SONRASINI da düşürür: gün numarası
-- hesaplanamadan hangi dalın çalışacağına karar verilemez.
--
-- Throw davranışı bilinçlidir ve bu migration onu DEĞİŞTİRMEZ: varsayılan bir
-- tarihe düşmek 100 günün tamamını yanlış güne kaydırır ve hata ancak kullanıcı
-- "yanlış günün temasını" gördüğünde fark edilirdi (CLAUDE.md #1 — sessiz
-- fallback yasak). Çözüm fallback eklemek değil, anahtarın varlığını şemaya
-- yazmak.
--
-- ── MEVCUT SATIRA DOKUNULMAZ ────────────────────────────────────────────────
-- `ON CONFLICT (key) DO NOTHING` — satır zaten var (ölçüldü 19 Eyl 2026:
-- value = "2026-09-18", description dolu). Bu migration onu ÜZERİNE YAZMAZ.
--
-- Gerekçe: `launch_date` yayın kaydıkça değişebilen CANLI bir değerdir
-- (Bible §E-19.2b — Gün 1 gerçek yayın tarihinin hafta gününe hizalanır).
-- `DO UPDATE` kullanılsaydı, bu migration'ın her yeniden koşumu CTO'nun
-- sonradan girdiği tarihi sessizce 2026-09-18'e geri alırdı. Buradaki değer
-- bir VARSAYILAN'dır, bir DAYATMA değil: yalnız satır hiç yoksa (yeni ortam,
-- kazara silinmiş satır) devreye girer.
--
-- ⚠️ Yayın tarihi değişirse bu dosya GERİYE DÖNÜK DÜZENLENMEZ (chosy-conventions
-- §3). Değer `app_config` üzerinden güncellenir; gerekiyorsa yeni bir migration
-- yazılır. Ayrıca tarih değişimi 100 satırın HAFTA GÜNÜ hizalamasını da kaydırır
-- (§E-19.2b) — `editorial_calendar_days.theme` yeniden hesaplanmadan tek başına
-- tarih güncellemek takvimi tema bazında yanlışlar.
--
-- ── SATIRIN `description` KOLONU DA KORUNUR ─────────────────────────────────
-- `DO NOTHING` yalnız `value`yu değil `description`ı da korur: prod'daki satır
-- CTO'nun 19 Eyl'de girdiği metni taşımaya devam eder, aşağıdaki zengin metin
-- oraya YAZILMAZ. Bu bilinçli — satıra dokunmamak bu migration'ın tek sözü.
-- Anahtarın kaybının sonucu DB tarafında `COMMENT ON TABLE app_config`
-- üzerinden kayda geçer (aşağıda); satır metninin güncellenmesi gerekiyorsa
-- bu ayrı bir karardır ve ayrı bir migration ister.
-- ============================================================================

INSERT INTO app_config (key, value, description) VALUES
  (
    'launch_date',
    '"2026-09-18"'::jsonb,
    'E-19 editoryal takvim gün 1 tarihi (UTC, YYYY-MM-DD metni). '
    'day_number = launch_date + (day_number - 1) çapası. '
    'KAYBI EDİTORYAL TAKVİMİ TAMAMEN DURDURUR: generate-gauntlet bu anahtarı '
    'her yeni üretimde okur, yoksa 503 döner (fallback YOK, bilinçli).'
  )
ON CONFLICT (key) DO NOTHING;

-- ─── COMMENT ON ─────────────────────────────────────────────────────────────
-- Postgres yorumları satıra değil nesneye bağlanır; anahtar bazlı uyarının
-- yeri `app_config.description` kolonudur (yukarıda). Tablo yorumu 035'in
-- cümlesini KORUR, üstüne taşıyıcı-anahtar uyarısını ekler — `\d+ app_config`
-- bakan kişi "burası sadece feature flag değil" bilgisini görebilsin diye.

COMMENT ON TABLE app_config IS
  'Remote feature flags. Hot-toggleable from SQL editor without app rebuild. '
  'DİKKAT: bazı anahtarlar feature flag DEĞİL, taşıyıcı veridir ve silinmeleri '
  'üretimi durdurur — örn. launch_date (E-19 editoryal takvimin çapası, '
  'migration 113). Silmeden önce description kolonunu oku.';

COMMENT ON COLUMN app_config.description IS
  'Anahtarın ne işe yaradığı ve kaybının sonucu — satır bazlı COMMENT ON '
  'olmadığı için anahtar başına dokümantasyonun yeri. Taşıyıcı anahtarlarda '
  'doldurulması beklenir; migration''lar mevcut satırın bu kolonunu '
  'ÜZERİNE YAZMAZ (ON CONFLICT DO NOTHING), gerekiyorsa açık bir UPDATE ister.';

-- ============================================================================
-- DOWN SCRIPT — geri alma (elle calistirilir, migration olarak DEGIL)
--
-- ⚠️ SATIRI SİLME. `launch_date` taşıyıcı veridir: silinmesi generate-gauntlet'i
-- her yeni üretimde 503'e düşürür (yukarıdaki gerekçe). Bu migration prod'da
-- zaten no-op'tur — INSERT çakışıp düşer, geri alınacak bir satır oluşmaz.
-- Geri alınabilir tek şey iki COMMENT ifadesidir:
--
-- COMMENT ON TABLE app_config IS
--   'Remote feature flags. Hot-toggleable from SQL editor without app rebuild.';
-- COMMENT ON COLUMN app_config.description IS NULL;
-- ============================================================================
