/**
 * ErrorState — hata durumu için EmptyState wrapper'ı.
 * Film yükleme hatalarında, feed'de ve watchlist'te kullanılır.
 */
import React from 'react';

import EmptyState from '@/components/EmptyState';

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface ErrorStateProps {
  /** Hata mesajı (opsiyonel, varsayılan: 'Please try again') */
  message?: string;
  /** Yeniden deneme callback'i */
  onRetry?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Hata durumu bileşeni — EmptyState üzerine sarılmış wrapper.
 */
export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <EmptyState
      lumiMood="calm"
      title="Something went wrong"
      subtitle={message ?? 'Please try again'}
      actionLabel={onRetry != null ? 'Try Again' : undefined}
      onAction={onRetry}
    />
  );
}
