/**
 * MoodGauntletShell — Pro Mode'un yeni kabuğu (Faz 2-1), `mood_gauntlet_enabled` arkasında.
 * Giriş → Yükleme → Gauntlet → Sonuç. X her durumdan Giriş'e döner; Giriş'te router.back()
 * (Profil'e). Rota ve yetki kapısı `app/pro-mode.tsx`'te kalır; burası yalnız `allowed` dalıdır.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';

import { EntryStage } from './EntryStage';
import { GauntletStage } from './GauntletStage';
import { ResultStage } from './ResultStage';
import { ErrorStage, ExhaustedStage, LoadingStage } from './StatusStage';
import { styles } from './styles';
import { useMoodGauntlet } from './useMoodGauntlet';

export function MoodGauntletShell(): React.JSX.Element {
  const { t } = useLanguage();
  const router = useRouter();
  const g = useMoodGauntlet();

  const handleClose = (): void => {
    if (g.stage === 'entry') router.back();
    else g.reset();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={g.stage === 'entry' ? t('common.back') : t('moodGauntlet.close')}
        >
          <Ionicons
            name={g.stage === 'entry' ? 'chevron-back' : 'close'}
            size={24}
            color={color.text.primary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('proMode.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {g.stage === 'entry' && <EntryStage onStart={(input) => void g.startFromEntry(input)} />}
      {g.stage === 'loading' && <LoadingStage text={g.loadingText} />}
      {g.stage === 'gauntlet' && g.set && g.flow && (
        <GauntletStage
          set={g.set}
          flow={g.flow}
          notices={g.notices}
          onChoose={g.chooseFilm}
          onNone={g.noneOfThese}
        />
      )}
      {g.stage === 'result' && g.champion && g.set && (
        <ResultStage
          champion={g.champion}
          set={g.set}
          notices={g.notices}
          onAnotherFour={g.anotherFour}
          onIntensify={g.intensify}
        />
      )}
      {g.stage === 'error' && <ErrorStage kind={g.errorKind} onRetry={g.retry} onNewSearch={g.reset} />}
      {g.stage === 'exhausted' && <ExhaustedStage onNewSearch={g.reset} />}
    </SafeAreaView>
  );
}

export default MoodGauntletShell;
