import { I18n } from 'i18n-js';

import en from '@/locales/en.json';
import tr from '@/locales/tr.json';

/** Desteklenen dil kodları */
export type Locale = 'en' | 'tr';

/**
 * Uygulama genelinde kullanılan i18n instance'ı.
 * Varsayılan dil İngilizce; LanguageContext üzerinden değiştirilebilir.
 */
export const i18n = new I18n({ en, tr });
i18n.defaultLocale = 'en';
i18n.locale = 'en';
i18n.enableFallback = true;
