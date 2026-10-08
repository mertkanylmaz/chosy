/**
 * UnlockCountdown inline görünümünün süre biçimi — saf, import'suz (Deno
 * testi: tests/gauntlet/unlockCountdownFormat.test.ts).
 *
 * Girdi `displayParts` çıktısıdır (dakika TAVAN): 0 < kalan < 60 sn → "1m".
 * Metin şablonları çağıranın çevirisinden gelir (`t`), burada dil bilgisi yok.
 * Saat 0 ise yalnız dakika; saat > 0 ise dakika 0 olsa da yazılır ("1h 0m").
 */
export type DurationKey = 'durationHoursMinutes' | 'durationMinutes';

export type DurationTranslate = (
  key: DurationKey,
  vars: { hours: number; minutes: number },
) => string;

export function formatDuration(
  parts: { hours: number; minutes: number },
  translate: DurationTranslate,
): string {
  return parts.hours > 0
    ? translate('durationHoursMinutes', parts)
    : translate('durationMinutes', parts);
}
