/**
 * Merkezi loglama yardımcısı.
 * Prod build'lerde tüm çıktılar sessizleştirilir; yalnızca __DEV__ modunda aktiftir.
 */

/* eslint-disable no-console */

export const logger = {
  log: (...args: unknown[]): void => {
    if (__DEV__) console.log(...args);
  },
  warn: (...args: unknown[]): void => {
    if (__DEV__) console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    if (__DEV__) console.error(...args);
  },
};
