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
import React from 'react';

import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GauntletFilm, WatchFeedbackResponse } from '@/types/gauntlet';

import { styles } from './styles';

interface PendingWatchFeedbackCardProps {
  film: GauntletFilm;
  onRespond: (response: WatchFeedbackResponse) => void;
}

export function PendingWatchFeedbackCard({
  film,
  onRespond,
}: PendingWatchFeedbackCardProps): React.JSX.Element {
  const { t } = useLanguage();

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
            onPress={() => onRespond('loved')}
          />
          <QuietAction
            label={t('gauntlet.pendingFeedback.ok')}
            onPress={() => onRespond('ok')}
          />
          <QuietAction
            label={t('gauntlet.pendingFeedback.abandoned')}
            onPress={() => onRespond('abandoned')}
          />
          <QuietAction
            label={t('gauntlet.pendingFeedback.notWatched')}
            onPress={() => onRespond('not_watched')}
          />
        </View>

        {/* Skip görsel olarak ayrık: eşit ağırlıklı 4 cevaptan sonra, tek
            başına, düşük vurgu — "bunu hiç yanıtlama" hissi verir. */}
        <View style={styles.skipRow}>
          <QuietAction
            label={t('gauntlet.pendingFeedback.skip')}
            onPress={() => onRespond('skipped')}
          />
        </View>
      </View>
    </View>
  );
}
