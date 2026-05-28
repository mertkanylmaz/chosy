/**
 * ErrorState — hata durumu bileşeni.
 * Hata tipine göre farklı başlık/mesaj gösterir (network, auth, server, generic).
 * Film yükleme hatalarında, feed'de ve watchlist'te kullanılır.
 */
import React from 'react';

import EmptyState from '@/components/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { type ErrorType } from '@/utils/errorHelpers';

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface ErrorStateProps {
  /** Hata mesajı (opsiyonel) */
  message?: string;
  /** Hata başlığı (opsiyonel) */
  title?: string;
  /** Hata tipi — ikonlar ve mesajlar buna göre ayarlanır */
  errorType?: ErrorType;
  /** Yeniden deneme callback'i */
  onRetry?: () => void;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** ErrorType → i18n anahtar çiftleri */
const ERROR_KEYS: Record<ErrorType, { titleKey: string; subtitleKey: string; mood: string }> = {
  network: {
    titleKey: 'errorState.networkTitle',
    subtitleKey: 'errorState.networkSubtitle',
    mood: 'calm',
  },
  auth: {
    titleKey: 'errorState.authTitle',
    subtitleKey: 'errorState.authSubtitle',
    mood: 'calm',
  },
  server: {
    titleKey: 'errorState.serverTitle',
    subtitleKey: 'errorState.serverSubtitle',
    mood: 'calm',
  },
  quota: {
    titleKey: 'errorState.quotaTitle',
    subtitleKey: 'errorState.quotaSubtitle',
    mood: 'calm',
  },
  empty: {
    titleKey: 'errorState.emptyTitle',
    subtitleKey: 'errorState.emptySubtitle',
    mood: 'searching',
  },
  unknown: {
    titleKey: 'errorState.unknownTitle',
    subtitleKey: 'errorState.unknownSubtitle',
    mood: 'calm',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Hata durumu bileşeni — ErrorType'a göre uygun mesaj ve Lumi mood gösterir.
 */
export default function ErrorState({ message, title, errorType = 'unknown', onRetry }: ErrorStateProps) {
  const { t } = useLanguage();
  const keys = ERROR_KEYS[errorType];

  return (
    <EmptyState
      lumiMood={keys.mood as 'calm' | 'searching'}
      title={title ?? t(keys.titleKey)}
      subtitle={message ?? t(keys.subtitleKey)}
      actionLabel={onRetry != null ? t('errorState.tryAgain') : undefined}
      onAction={onRetry}
    />
  );
}
