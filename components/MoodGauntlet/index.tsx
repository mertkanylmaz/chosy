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
      {g.stage === 'loading' && <LoadingStage label={g.moodLabel} kind={g.loadingKind} />}
      {g.stage === 'gauntlet' && g.set && g.flow && (
        <GauntletStage
          set={g.set}
          reasons={g.reasons}
          reasonsLoading={g.reasonsLoading}
          dims={g.dims}
          flow={g.flow}
          notices={g.notices}
          moodLabel={g.moodLabel}
          tapHint={g.tapHint}
          onChoose={g.chooseFilm}
          onFourViewed={g.fourViewed}
          onFourPosterTapped={g.fourPosterTapped}
          onFourStart={g.fourStarted}
          onNone={g.noneOfThese}
          onJustPick={g.justPick}
        />
      )}
      {g.stage === 'result' && g.champion && g.set && (
        <ResultStage
          champion={g.champion}
          setIndex={g.set.setIndex}
          backups={g.set.backups}
          reasons={g.reasons}
          reasonsLoading={g.reasonsLoading}
          dims={g.dims[g.champion.id]}
          pattern={g.pickPattern}
          moodLabel={g.moodLabel}
          notices={g.notices}
          canLighter={g.canLighter}
          canStronger={g.canStronger}
          onAnotherFour={g.anotherFour}
          onIntensify={(d) => void g.intensify(d)}
        />
      )}
      {g.stage === 'error' && <ErrorStage kind={g.errorKind} onRetry={g.retry} onNewSearch={g.reset} />}
      {g.stage === 'exhausted' && <ExhaustedStage onNewSearch={g.reset} />}
    </SafeAreaView>
  );
}

export default MoodGauntletShell;
