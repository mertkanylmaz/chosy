/**
 * WatchProvidersSection — veriyi çeken + `WatchProvidersRow`'u çizen ince sarmalayıcı (Faz 2-8).
 * Film detayı gibi kendi sağlayıcı durumu olmayan ekranlar için: bölge cihazdan/seçimden
 * (`useLanguage().region`), dört durum ve sheet `WatchProvidersRow` içinde.
 */
import React from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import type { ProviderClickSurface } from '@/utils/moodGauntletAnalytics';

import { WatchProvidersRow } from './index';
import { useWatchProviders } from './useWatchProviders';

interface WatchProvidersSectionProps {
  filmId: string;
  surface: ProviderClickSurface;
}

export function WatchProvidersSection({ filmId, surface }: WatchProvidersSectionProps): React.JSX.Element {
  const { region } = useLanguage();
  const { state, providers, retry } = useWatchProviders(filmId, region);
  return <WatchProvidersRow state={state} providers={providers} onRetry={retry} filmId={filmId} surface={surface} />;
}
