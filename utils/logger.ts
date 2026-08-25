/**
 * Merkezi loglama yardımcısı.
 *
 * `log` ve `warn` yalnızca __DEV__ modunda konsola yazar — prod'da kasıtlı
 * olarak sessizdir (graceful degradation bildirimleri gürültü yapmasın diye).
 *
 * `error` ise prod'da da Sentry'ye bağlıdır. Daha önce üç dal da __DEV__
 * gate'liydi; bu, catch bloklarındaki her `logger.error` çağrısının sahada
 * hiçbir iz bırakmamasına yol açıyordu (K-44 kök nedeni).
 */

/* eslint-disable no-console */

import * as Sentry from '@sentry/react-native';

export interface LoggerMeta {
  /** Sentry tag'i olarak yazılır — `error_code` deseniyle tutarlı. */
  code?: string;
  /** 0–1 arası örnekleme oranı. Yüksek frekanslı noktalarda düşürülür. Default 1.0. */
  sampleRate?: number;
  /** Sentry `extra` alanına eklenecek ek bağlam. */
  extra?: Record<string, unknown>;
}

export const logger = {
  log: (...args: unknown[]): void => {
    if (__DEV__) console.log(...args);
  },
  warn: (...args: unknown[]): void => {
    if (__DEV__) console.warn(...args);
  },
  /**
   * Hata kaydı. __DEV__'de konsola, her ortamda Sentry'ye gider.
   *
   * @param message Sabit, tanımlayıcı mesaj — Sentry gruplaması buna dayanır.
   * @param error   Yakalanan değer. `Error` ise doğrudan raporlanır; değilse
   *                `message`'tan bir Error üretilir ve ham değer `extra.cause`
   *                olarak korunur (bilgi kaybı olmasın diye).
   * @param meta    Opsiyonel `code` / `sampleRate` / `extra`.
   */
  error: (message: string, error?: unknown, meta?: LoggerMeta): void => {
    if (__DEV__) console.error(message, error);

    const rate = meta?.sampleRate ?? 1.0;
    if (rate < 1.0 && Math.random() >= rate) return; // örneklendi — sessizce atla

    const isError = error instanceof Error;

    Sentry.captureException(isError ? error : new Error(message), {
      level: 'error',
      tags: {
        source: 'logger',
        code: meta?.code ?? 'UNTAGGED',
      },
      extra: {
        message,
        ...(isError ? {} : { cause: error }),
        ...meta?.extra,
      },
    });
  },
};
