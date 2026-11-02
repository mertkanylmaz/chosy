/**
 * Giriş: serbest metin + 8 hızlı mood. Hızlı mood dokunuşu aramayı DOĞRUDAN başlatır
 * (metin kutusuna yazıp beklemez) ve `quick_mood_id` ile gider. Recent Searches'a
 * hiçbir şey yazılmaz (robotik hızlı-mood promptu ya da modifier'lı metin kaydedilmez).
 *
 * AI rızası: metin Anthropic'e gider → rıza yoksa satır içi blok gösterilir ve arama
 * ancak "Enable AI & Find Movies" ile (rıza kaydedildikten sonra) başlar.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, TextInput, View, Text, KeyboardAvoidingView, Platform } from 'react-native';

import MoodCardGrid, { MOOD_CARDS } from '@/components/Home/MoodCardGrid';
import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { useLanguage } from '@/contexts/LanguageContext';
import { hasAiConsent, recordAiConsent } from '@/services/aiConsent';
import { hapticSelection } from '@/utils/haptics';
import { isMoodInputSubmittable } from '@/utils/moodSearchInput';

import { styles } from './styles';
import type { StartInput } from './useMoodGauntlet';

interface EntryStageProps {
  onStart: (input: StartInput) => void;
}

export function EntryStage({ onStart }: EntryStageProps): React.JSX.Element {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [consented, setConsented] = useState<boolean | null>(null);
  // Yeni oturum her zaman en üstten başlar: her mount'ta konum açıkça sıfırlanır (Faz 2-9a).
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  useEffect(() => {
    let active = true;
    void hasAiConsent().then((ok) => {
      if (active) setConsented(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  /** Rıza yoksa kaydeder; başarısızsa kullanıcıya görünür hata (servis Sentry'ye yazar) ve false. */
  const ensureConsent = useCallback(async (): Promise<boolean> => {
    if (consented === true || (await hasAiConsent())) {
      setConsented(true);
      return true;
    }
    const result = await recordAiConsent();
    if (!result.ok) {
      Alert.alert(t('aiConsent.saveError'));
      return false;
    }
    setConsented(true);
    return true;
  }, [consented, t]);

  const submitFreeText = useCallback(async () => {
    const trimmed = text.trim();
    if (!isMoodInputSubmittable(trimmed)) return;
    if (!(await ensureConsent())) return;
    onStart({ text: trimmed, entry: 'free_text', label: trimmed });
  }, [text, ensureConsent, onStart]);

  const handleQuick = useCallback(
    async (prompt: string, cardId: string) => {
      hapticSelection();
      // Rıza yoksa kart aramayı BAŞLATMAZ: önce blok gösterilir (mevcut Pro Mode davranışı).
      if (consented !== true && !(await hasAiConsent())) {
        setConsented(false);
        return;
      }
      setConsented(true);
      const card = MOOD_CARDS.find((c) => c.id === cardId);
      onStart({ text: prompt, quickMoodId: cardId, entry: 'quick', label: card ? t(card.titleKey) : undefined });
    },
    [consented, onStart, t],
  );

  const canSubmit = isMoodInputSubmittable(text.trim());

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.entryTitle} accessibilityRole="header">
          {t('moodGauntlet.entryTitle')}
        </Text>
        <Text style={styles.entrySubtitle}>{t('moodGauntlet.entrySubtitle')}</Text>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={t('moodGauntlet.inputPlaceholder')}
          multiline
          maxLength={300}
          returnKeyType="go"
          blurOnSubmit
          onSubmitEditing={() => void submitFreeText()}
          accessibilityLabel={t('moodGauntlet.inputPlaceholder')}
        />

        {consented === false && <Text style={styles.consentBody}>{t('aiConsent.inlineBody')}</Text>}

        {/* Faz 2-9c: CTA yalnız gönderilebilir metin varken görünür; boşken yer kaplamaz, hızlı mood
            kartları yukarıda kalır. Return tuşu (`returnKeyType="go"`) aynı yolu çalıştırır. */}
        {canSubmit && (
          <View style={styles.ctaSlot}>
            <PrimaryAction
              label={consented === false ? t('aiConsent.inlineEnableAndFind') : t('moodGauntlet.startCta')}
              onPress={() => void submitFreeText()}
              variant="gold"
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.gridCaption}>{t('moodGauntlet.quickLabel')}</Text>
          <View style={styles.gridBleed}>
            <MoodCardGrid activeMoodText="" onSelect={(prompt, id) => void handleQuick(prompt, id)} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
