/**
 * explain-match HTTP hatası beklenen bir sınır mı? (145, güvenlik P0)
 *
 * 429 = sunucunun günlük tavanı (`EXPLAIN_DAILY_LIMIT`) ya da dakikalık limiti. Bu durumda
 * şablon açıklama gösterilir ve Sentry'ye exception yazılmaz (iz kaydı yeterli; aşımı sunucu
 * loglar). Diğer her durum (401, 5xx, ağ hatası → null) hatadır.
 *
 * Saf modül — `matchExplanation.ts` React Native bağımlılıkları yüzünden test koşucusunda
 * import edilemiyor; karar burada, testi `tests/security/securityP0.test.ts`.
 */
export function isExpectedExplainThrottle(httpStatus: number | null): boolean {
  return httpStatus === 429;
}
