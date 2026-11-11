/**
 * Loading L1 — `mood_first_poster_visible` ölçüm durumu. Saf: React/RN/PostHog yok.
 *
 * Akış: dokunuşta `arm` (başlangıç anı + bağlam), dörtlü ekrana uygulanınca `bind(setId, path)`,
 * her poster `onLoad`unda `posterLoaded(setId, now)`. Olay bağlanmış dörtlünün İLK posterinde,
 * dörtlü başına BİR KEZ döner; aynı dörtlünün diğer posterleri, eski dörtlünün geç gelen
 * onLoad'ları ve bağlanmamış (iptal edilmiş) ölçümler null döner.
 */
import {
  firstPosterVisibleEvent,
  type MoodEntryKind,
  type MoodEvent,
  type MoodPosterPath,
  type MoodPosterTrigger,
} from './moodGauntletAnalytics';

export interface PosterArm {
  startedAt: number;
  trigger: MoodPosterTrigger;
  entry: MoodEntryKind;
  quickMoodId: string | null;
  consentShown: boolean;
}

export interface FirstPosterTracker {
  /** Yeni ölçüm başlar; önceki (bağlanmış olsa da) ölçüm düşer. */
  arm(a: PosterArm): void;
  /** Ölçülen dörtlü ekrana geldi. Kurulu ölçüm yoksa (örn. iptal) hiçbir şey yapmaz. */
  bind(setId: string, path: MoodPosterPath): void;
  /** Poster görseli yüklendi: olay ya da null. */
  posterLoaded(setId: string, now: number): MoodEvent | null;
  /** Yeni arama / kapatma: bekleyen ölçüm düşer. */
  clear(): void;
}

export function createFirstPosterTracker(): FirstPosterTracker {
  let armed: PosterArm | null = null;
  let bound: { setId: string; path: MoodPosterPath; arm: PosterArm } | null = null;
  const fired = new Set<string>();
  return {
    arm(a) {
      // Yeni dokunuş öncekini geçersiz kılar: eski dörtlünün geç gelen onLoad'u olay üretmez.
      armed = a;
      bound = null;
    },
    bind(setId, path) {
      if (armed === null) return;
      bound = { setId, path, arm: armed };
      armed = null;
    },
    posterLoaded(setId, now) {
      if (bound === null || bound.setId !== setId || fired.has(setId)) return null;
      fired.add(setId);
      const { arm, path } = bound;
      bound = null;
      return firstPosterVisibleEvent({
        ms: now - arm.startedAt,
        entry: arm.entry,
        quickMoodId: arm.quickMoodId,
        path,
        trigger: arm.trigger,
        consentShown: arm.consentShown,
      });
    },
    clear() {
      armed = null;
      bound = null;
    },
  };
}
