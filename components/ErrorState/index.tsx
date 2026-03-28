/**
 * ErrorState — hata durumu bileşeni.
 * Hata tipine göre farklı başlık/mesaj gösterir (network, auth, server, generic).
 * Film yükleme hatalarında, feed'de ve watchlist'te kullanılır.
 */
import React from 'react';

import EmptyState from '@/components/EmptyState';
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

const ERROR_CONFIG: Record<ErrorType, { title: string; subtitle: string; mood: string }> = {
  network: {
    title: 'No connection',
    subtitle: 'Check your internet connection and try again',
    mood: 'calm',
  },
  auth: {
    title: 'Session expired',
    subtitle: 'Please restart the app to continue',
    mood: 'calm',
  },
  server: {
    title: 'Something went wrong',
    subtitle: 'Our servers are having trouble. Please try again.',
    mood: 'calm',
  },
  empty: {
    title: 'No results found',
    subtitle: 'Try adjusting your filters or describing a different mood',
    mood: 'searching',
  },
  unknown: {
    title: 'Something went wrong',
    subtitle: 'Please try again',
    mood: 'calm',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Hata durumu bileşeni — ErrorType'a göre uygun mesaj ve Lumi mood gösterir.
 */
export default function ErrorState({ message, title, errorType = 'unknown', onRetry }: ErrorStateProps) {
  const config = ERROR_CONFIG[errorType];

  return (
    <EmptyState
      lumiMood={config.mood as 'calm' | 'searching'}
      title={title ?? config.title}
      subtitle={message ?? config.subtitle}
      actionLabel={onRetry != null ? 'Try Again' : undefined}
      onAction={onRetry}
    />
  );
}
