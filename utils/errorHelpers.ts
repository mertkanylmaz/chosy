/**
 * Error helper utilities — hata tipini belirler ve kullanıcıya anlamlı mesaj uretir.
 *
 * Network hatalarını, Supabase hatalarını ve genel hataları ayırt eder.
 * Tüm API çağrılarında tutarlı hata mesajları sağlar.
 */

/** Hata tipi — UI'da farklı görsel gösterim için kullanılır */
export type ErrorType = 'network' | 'auth' | 'server' | 'empty' | 'unknown';

/** Kullanıcıya gösterilecek hata bilgisi */
export interface UserFacingError {
  type: ErrorType;
  title: string;
  message: string;
  retryable: boolean;
}

/**
 * Bir hatanın ağ bağlantısı sorunu olup olmadığını belirler.
 * fetch hatası, DNS hatası ve timeout durumlarını kapsar.
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Network request failed') {
    return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLocaleLowerCase('en-US');
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('abort') ||
      msg.includes('dns') ||
      msg.includes('econnrefused') ||
      msg.includes('fetch failed')
    );
  }
  return false;
}

/**
 * Supabase/auth hatalarını tespit eder.
 */
function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLocaleLowerCase('en-US');
    return (
      msg.includes('jwt') ||
      msg.includes('token') ||
      msg.includes('unauthorized') ||
      msg.includes('auth')
    );
  }
  return false;
}

/**
 * Herhangi bir hatayı kullanıcı dostu hata bilgisine dönüştürür.
 *
 * @param error   - Yakalanan hata
 * @param context - Hatanın oluştuğu bağlam ('feed' | 'mood' | 'watchlist' | 'general')
 */
export function toUserError(
  error: unknown,
  context: 'feed' | 'mood' | 'watchlist' | 'general' = 'general',
): UserFacingError {
  // Network hatası
  if (isNetworkError(error)) {
    return {
      type: 'network',
      title: 'No connection',
      message: 'Check your internet connection and try again',
      retryable: true,
    };
  }

  // Auth hatası
  if (isAuthError(error)) {
    return {
      type: 'auth',
      title: 'Session expired',
      message: 'Your session has expired. Restarting...',
      retryable: true,
    };
  }

  // Bağlam bazlı varsayılan hatalar
  switch (context) {
    case 'feed':
      return {
        type: 'server',
        title: 'Could not load films',
        message: 'Something went wrong loading recommendations. Try again.',
        retryable: true,
      };
    case 'mood':
      return {
        type: 'server',
        title: 'Analysis failed',
        message: 'Could not analyze your mood. Please try again.',
        retryable: true,
      };
    case 'watchlist':
      return {
        type: 'server',
        title: 'Could not load watchlist',
        message: 'Something went wrong. Pull down to refresh.',
        retryable: true,
      };
    default:
      return {
        type: 'unknown',
        title: 'Something went wrong',
        message: 'Please try again',
        retryable: true,
      };
  }
}
