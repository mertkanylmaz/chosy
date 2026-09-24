-- ============================================================================
-- 116 — app_config: paywall_lifetime_enabled (varsayılan false)
--
-- KARAR: CTO onayı, 24 Eylül 2026. Seçenek B — **D-08 korunuyor.**
--   D-08 ve §7.3 "v1'de yeni lifetime satılmaz" diyor, ama `PaywallBase`
--   üç plan kartından birini Lifetime olarak satıyordu. Kart ve satın alma
--   yolu SİLİNMEDİ; bu flag'in arkasına alındı.
--
-- VARSAYILAN false: kart gizli, yalnız Monthly/Annual görünür (annual ön
--   seçili davranış değişmedi). Geri açmak tek satırlık UPDATE:
--     UPDATE app_config SET value = 'true'::jsonb
--       WHERE key = 'paywall_lifetime_enabled';
--   R-E'de değerlendirilecek.
--
-- FAIL-CLOSED: `services/remoteConfig.ts` SAFE_DEFAULTS'ta da `false`.
--   Satır okunamazsa (ağ/hydrate hatası) kart yine gizli kalır — güvenli
--   yön D-08 yönüdür. Bu migration yalnızca flag'i **görünür ve
--   çevrilebilir** kılar; kodun davranışı satır olmadan da doğrudur.
--
-- GERİ ALMA: `DELETE FROM app_config WHERE key = 'paywall_lifetime_enabled';`
--   Şema değişikliği yok, mevcut satırlara dokunulmuyor (ON CONFLICT DO
--   NOTHING — 012 dersi: var olan satırı ezme).
-- ============================================================================

INSERT INTO app_config (key, value, description) VALUES
  (
    'paywall_lifetime_enabled',
    'false'::jsonb,
    'PaywallBase Lifetime plan karti gorunur mu. D-08 geregi v1 varsayilani false; true = kart + satin alma yolu acilir (R-E).'
  )
ON CONFLICT (key) DO NOTHING;
