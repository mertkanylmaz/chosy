/**
 * PendingWatchFeedbackCard — "dün izledin mi?" sorusu (C.4).
 *
 * GauntletShell'in üstüne biner (ShellState'e YENİ bir üye eklenmez — CTO
 * onayı 14.08.2026 "BEŞ durum" sözleşmesi bozulmaz). Tamamen atlanabilir:
 * `skip` diğer 4 seçenekle eşit ağırlıkta bir çıkış yoludur, zorunlu değildir.
 *
 * Tüm seçenekler `QuietAction` — DESIGN_OS §10.1: ikincil eylemler metin
 * bağlantısıdır, buton değil. Bu ekranda birincil bir "buton" hiç yok.
 */
import React, { useEffect } from 'react';

import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import type { GauntletFilm, WatchFeedbackResponse } from '@/types/gauntlet';

import { styles } from './styles';

interface PendingWatchFeedbackCardProps {
  film: GauntletFilm;
  onRespond: (response: WatchFeedbackResponse) => void;
}

/**
 * K-29: `loved`/`ok`/`abandoned` → izlenmiş sayılır (watched_confirmed).
 * `not_watched`/`skipped` → izlenmemiş sayılır (watched_not_yet).
 *
 * ⚠️ Taxonomy'deki `watched_something_else` burada YOK — bu karta karşılık
 * gelen "İzledim ama X'i değil" akışı (SONHALİ §16, opsiyonel film arama)
 * henüz UI'da bulunmuyor. Uydurmak yerine bilinçli olarak eklenmedi.
 */
function trackWatchResponse(response: WatchFeedbackResponse): void {
  if (response === 'loved' || response === 'ok' || response === 'abandoned') {
    posthogAnalytics.track('watched_confirmed', { response });
  } else {
    posthogAnalytics.track('watched_not_yet', { response });
  }
}

export function PendingWatchFeedbackCard({
  film,
  onRespond,
}: PendingWatchFeedbackCardProps): React.JSX.Element {
  const { t } = useLanguage();

  // Kart yalnızca pendingWatchFeedback doluyken mount edilir (GauntletShell) —
  // mount = kullanıcıya soru gösterildi.
  useEffect(() => {
    posthogAnalytics.track('watched_prompted', { film_id: film.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRespond = (response: WatchFeedbackResponse): void => {
    trackWatchResponse(response);
    onRespond(response);
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Image
          source={{ uri: film.posterUrl }}
          style={styles.poster}
          contentFit="cover"
          accessible={false}
        />
        <Text style={styles.question}>{t('gauntlet.pendingFeedback.question')}</Text>

        <View style={styles.responses}>
          <QuietAction
            label={t('gauntlet.pendingFeedback.loved')}
            onPress={() => handleRespond('loved')}
          />
          <QuietAction
            label={t('gauntlet.pendingFeedback.ok')}
            onPress={() => handleRespond('ok')}
          />
          <QuietAction
            label={t('gauntlet.pendingFeedback.abandoned')}
            onPress={() => handleRespond('abandoned')}
          />
          <QuietAction
            label={t('gauntlet.pendingFeedback.notWatched')}
            onPress={() => handleRespond('not_watched')}
          />
        </View>

        {/* Skip görsel olarak ayrık: eşit ağırlıklı 4 cevaptan sonra, tek
            başına, düşük vurgu — "bunu hiç yanıtlama" hissi verir. */}
        <View style={styles.skipRow}>
          <QuietAction
            label={t('gauntlet.pendingFeedback.skip')}
            onPress={() => handleRespond('skipped')}
          />
        </View>
      </View>
    </View>
  );
}
