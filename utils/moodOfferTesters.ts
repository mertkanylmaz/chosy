/**
 * `mood_offer_enabled` kararı + tester listesi (MONEY-1C). Saf mantık — RN/Supabase yok.
 *
 * Açık = `app_config.mood_offer_enabled === true` VEYA geçerli kimlik
 * `app_config.mood_offer_testers` (jsonb dizi) içinde. Bu bir UX bayrağıdır, yetki
 * değil (kotayı sunucu zorlar). Her belirsizlik KAPALI demektir: satır yok, dizi
 * değil, boş liste, kimlik yok, listede olmayan kimlik.
 *
 * Kimlik: `auth.users.id` (oturumdaki `session.user.id`). `public.users.id` DEĞİL —
 * o ek bir `users` sorgusu ister (bayrak okuması yeni istek açmamalı) ve bootstrap
 * bitmeden null olur. Bkz. services/appConfigFlags.ts.
 */

/** Liste tanımlı ve en az bir geçerli (boş olmayan string) kimlik içeriyor mu. */
export function hasTesterEntries(testers: unknown): boolean {
  return Array.isArray(testers) && testers.some((id) => typeof id === 'string' && id.length > 0);
}

export function evaluateMoodOfferEnabled(input: {
  flag: unknown;
  testers: unknown;
  userId: string | null;
}): boolean {
  if (input.flag === true) return true;
  if (!input.userId || !Array.isArray(input.testers)) return false;
  return input.testers.includes(input.userId);
}
