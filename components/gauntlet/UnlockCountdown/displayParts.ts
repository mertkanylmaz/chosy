/**
 * UnlockCountdown'un GÖRÜNÜM hesabı — saf, import'suz (Deno testi:
 * tests/gauntlet/unlockCountdownDisplay.test.ts).
 *
 * Saniye hanesi gösterilmediği için dakika TAVANA yuvarlanır: kalan
 * 0 < t < 60 sn iken "00:01" görünür, "00:00" yalnız gerçekten sıfırda.
 * (`countdownParts` dakikayı taban alır; "00:00" `onElapsed`'ten önce
 * görünürdü.) `useCountdown`/`countdownCore` DEĞİŞMEZ — kalan süre aynı,
 * yalnız gösterim farklı.
 */
export interface DisplayParts {
  hours: number;
  minutes: number;
}

export function displayParts(remainingMs: number): DisplayParts {
  const totalMinutes = Math.ceil(Math.max(0, remainingMs) / 60_000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
