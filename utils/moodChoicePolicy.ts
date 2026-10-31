/** submit-mood-choice yanıt politikası — saf mantık (RN yok). */

/** Gateway'in "fonksiyon yok" yanıtı mı? (Yalnız platform kodu; kendi hata kodlarımız — SEARCH_NOT_FOUND vb. — değil.) */
export function isFunctionNotDeployed(status: number, body: unknown): boolean {
  return status === 404 && (body as { code?: unknown } | null)?.code === 'NOT_FOUND';
}
