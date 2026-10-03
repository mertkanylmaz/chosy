/**
 * Bildirim izni sheet'i gösterilmeli mi — saf mantık.
 *
 * `services/pushNotifications.shouldAskForNotificationPermission()` bunun
 * AsyncStorage / expo-notifications / Sentry ile bağlanmış hâlidir. Burada
 * React Native bağımlılığı YOKTUR; bağımlılıklar enjekte edilir ki hata dalı
 * cihaz gerektirmeden test edilebilsin (`tests/gauntlet/notificationAskCheck.test.ts`).
 *
 * Hata (Kural 1): depolama okunamaz ya da yazılamazsa sheet GÖSTERİLMEZ
 * (fail-closed) ve hata `reportError` ile raporlanır — yalnız log yetmez.
 */

export interface NotificationAskDeps {
  /** `chosy_push_permission_asked` ham değeri. */
  readAsked: () => Promise<string | null>;
  /** OS izni şu an verilmiş mi. */
  isGranted: () => Promise<boolean>;
  /** "Sorduk" bayrağını yazar. */
  markAsked: () => Promise<void>;
  /** Hata raporu (Sentry). */
  reportError: (err: unknown) => void;
}

/** @returns Daha önce sorulmadıysa ve izin zaten verilmemişse true */
export async function checkShouldAskForNotification(deps: NotificationAskDeps): Promise<boolean> {
  try {
    const asked = await deps.readAsked();
    if (asked === 'true') return false;

    // İzin zaten verilmiş (ör. kullanıcı Ayarlar'dan açmış) — sormaya gerek yok.
    if (await deps.isGranted()) {
      await deps.markAsked();
      return false;
    }

    return true;
  } catch (err) {
    deps.reportError(err);
    return false;
  }
}
