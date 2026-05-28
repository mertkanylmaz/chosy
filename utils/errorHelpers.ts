/**
 * Error helper utilities — hata tipini belirler ve kullanıcıya anlamlı mesaj uretir.
 *
 * Network hatalarını, Supabase hatalarını ve genel hataları ayırt eder.
 * Tüm API çağrılarında tutarlı hata mesajları sağlar.
 *
 * Sprint 1 v5.0: MoodParseError support added — structured error codes
 * from edge functions are preserved for context-specific UI feedback.
 */

/** Hata tipi — UI'da farklı görsel gösterim için kullanılır */
export type ErrorType = 'network' | 'auth' | 'server' | 'quota' | 'empty' | 'unknown';

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
 * MoodParseError'u kontrol eder — structured error codes from edge functions.
 * Sprint 1 v5.0: Silent fallback yerine UI'a gercek hata gosterilir.
 */
function isMoodParseError(error: unknown): error is { code: string; userMessage: string; name: string } {
  return (
    error instanceof Error &&
    error.name === 'MoodParseError' &&
    'code' in error &&
    'userMessage' in error
  );
}

/**
 * Herhangi bir hatayı kullanıcı dostu hata bilgisine dönüştürür.
 *
 * Sprint 1 v5.0: MoodParseError support — edge function error codes
 * are preserved for context-specific UI feedback. Silent fallback
 * replaced with real error messages.
 *
 * @param error   - Yakalanan hata
 * @param context - Hatanın oluştuğu bağlam ('feed' | 'mood' | 'watchlist' | 'general')
 */
export function toUserError(
  error: unknown,
  context: 'feed' | 'mood' | 'watchlist' | 'general' = 'general',
): UserFacingError {
  // MoodParseError — structured error from tasteParser
  if (isMoodParseError(error)) {
    const code = error.code;

    if (code === 'NETWORK_ERROR') {
      return {
        type: 'network',
        title: 'No connection',
        message: error.userMessage,
        retryable: true,
      };
    }

    if (code === 'QUOTA_EXCEEDED') {
      return {
        type: 'quota',
        title: 'Limit reached',
        message: error.userMessage,
        retryable: false,
      };
    }

    if (code === 'RATE_LIMIT_EXCEEDED') {
      return {
        type: 'server',
        title: 'Too fast',
        message: error.userMessage,
        retryable: true,
      };
    }

    if (code === 'SERVICE_UNAVAILABLE') {
      return {
        type: 'server',
        title: 'Service unavailable',
        message: error.userMessage,
        retryable: true,
      };
    }

    // INVALID_INPUT, PARSE_FAILED, UNKNOWN_ERROR, etc
    return {
      type: 'server',
      title: 'Analysis failed',
      message: error.userMessage,
      retryable: code !== 'INVALID_INPUT',
    };
  }

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
