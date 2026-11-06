/**
 * Giriş: serbest metin + 8 hızlı mood. Hızlı mood dokunuşu aramayı DOĞRUDAN başlatır
 * (metin kutusuna yazıp beklemez) ve `quick_mood_id` ile gider. Recent Searches'a
 * hiçbir şey yazılmaz (robotik hızlı-mood promptu ya da modifier'lı metin kaydedilmez).
 *
 * AI rızası: metin Anthropic'e gider. Rıza yokken (ya da okunamadıysa) kart dokunuşu rıza
 * YAZMAZ ve aramayı başlatmaz: kart "bekleyen" olur, kart seçili görünür ve ekranın altına
 * sabitlenmiş rıza adımı (metin + "Enable AI & Find Movies") çıkar — kaydırma gerekmez. Butona
 * basınca rıza yazılır ve bekleyen kartın `quickMoodId`'siyle arama başlar (utils/moodQuickConsent).
 * Her erken çıkış görünür bir durum ya da Sentry breadcrumb/warning üretir (kural 1).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, TextInput, View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

import MoodCardGrid, { MOOD_CARDS } from '@/components/Home/MoodCardGrid';
import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { useLanguage } from '@/contexts/LanguageContext';
import { readAiConsentState, recordAiConsent } from '@/services/aiConsent';
import { posthogAnalytics } from '@/services/posthog';
import { hapticSelection } from '@/utils/haptics';
import {
  confirmPendingQuick,
  tapQuick,
  type ConsentTrace,
  type PendingQuick,
  type QuickConsentDeps,
} from '@/utils/moodQuickConsent';
import { isMoodInputSubmittable } from '@/utils/moodSearchInput';

import { styles } from './styles';
import type { StartInput } from './useMoodGauntlet';

interface EntryStageProps {
  onStart: (input: StartInput) => void;
}

type ConsentSource = 'quick' | 'free_text';

/** Mevcut olaylar (yeni ad yok); `source` ayrımı için ortak props. */
function trackConsent(event: 'ai_consent_shown' | 'ai_consent_granted', source: ConsentSource): void {
  posthogAnalytics.track(event, { surface: 'mood_search', variant: 'inline', source });
}

/** Her erken çıkış iz bırakır; okuma/kayıt başarısızlıkları ayrıca Sentry warning'dir. */
function traceConsent(kind: ConsentTrace | 'free_text_not_submittable', data?: Record<string, string>): void {
  Sentry.addBreadcrumb({ category: 'mood_gauntlet', level: 'info', message: kind, data });
  if (kind === 'consent_read_failed' || kind === 'consent_save_failed') {
    Sentry.captureMessage(`[MoodGauntlet] ${kind}`, {
      level: 'warning',
      tags: { component: 'MoodGauntlet.EntryStage', flow: kind },
      extra: data,
    });
  }
}

export function EntryStage({ onStart }: EntryStageProps): React.JSX.Element {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [consented, setConsented] = useState<boolean | null>(null);
  /** Rıza yokken dokunulan kart; rıza adımı onu bekler. */
  const [pending, setPending] = useState<PendingQuick | null>(null);
  const pendingRef = useRef<PendingQuick | null>(null);
  /** Geride kalan bir kart okumasının sonucu yeni dokunuşu ezmesin. */
  const tapSeq = useRef(0);
  const confirming = useRef(false);
  const freeShownTracked = useRef(false);
  // Yeni oturum her zaman en üstten başlar: her mount'ta konum açıkça sıfırlanır (Faz 2-9a).
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  useEffect(() => {
    let active = true;
    void readAiConsentState().then((state) => {
      if (!active) return;
      if (state === 'unknown') {
        // Okunamadı: "belirsiz" bırakılmaz — rıza adımı görünür olur, kullanıcı bilinçli onaylar.
        traceConsent('consent_read_failed', { source: 'mount' });
        setConsented(false);
        return;
      }
      setConsented(state === 'granted');
    });
    return () => {
      active = false;
    };
  }, []);

  const setPendingBoth = useCallback((next: PendingQuick | null) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  const quickDeps = useMemo<QuickConsentDeps>(
    () => ({
      readConsent: readAiConsentState,
      recordConsent: recordAiConsent,
      start: (input) => onStart(input),
      trace: traceConsent,
    }),
    [onStart],
  );

  /** Serbest metin: rıza yoksa CTA ("Enable AI & Find Movies") bilinçli dokunuşla kaydeder. */
  const ensureConsent = useCallback(async (): Promise<'already' | 'recorded' | 'failed'> => {
    if ((await readAiConsentState()) === 'granted') {
      setConsented(true);
      return 'already';
    }
    const result = await recordAiConsent();
    if (!result.ok) {
      traceConsent('consent_save_failed', { source: 'free_text' });
      Alert.alert(t('aiConsent.saveError'));
      return 'failed';
    }
    setConsented(true);
    return 'recorded';
  }, [t]);

  const submitFreeText = useCallback(async () => {
    const trimmed = text.trim();
    if (!isMoodInputSubmittable(trimmed)) {
      traceConsent('free_text_not_submittable');
      return;
    }
    const outcome = await ensureConsent();
    if (outcome === 'failed') return;
    if (outcome === 'recorded') trackConsent('ai_consent_granted', 'free_text');
    setPendingBoth(null);
    onStart({ text: trimmed, entry: 'free_text', label: trimmed });
  }, [text, ensureConsent, onStart, setPendingBoth]);

  const handleQuick = useCallback(
    async (prompt: string, cardId: string) => {
      hapticSelection();
      const card = MOOD_CARDS.find((c) => c.id === cardId);
      const picked: PendingQuick = { cardId, prompt, label: card ? t(card.titleKey) : undefined };
      const seq = ++tapSeq.current;
      const outcome = await tapQuick(quickDeps, picked);
      if (seq !== tapSeq.current) return; // daha yeni bir dokunuş bu sonucu geçersiz kıldı
      if (outcome.kind === 'started') {
        setConsented(true);
        setPendingBoth(null);
        return;
      }
      // Görünür rıza adımı: kart seçili, altta metin + buton. Adım ilk açıldığında bir kez `shown`.
      if (pendingRef.current === null) trackConsent('ai_consent_shown', 'quick');
      setConsented(false);
      setPendingBoth(picked);
    },
    [quickDeps, t, setPendingBoth],
  );

  const handleEnableAndFind = useCallback(async () => {
    const current = pendingRef.current;
    if (current === null || confirming.current) return;
    confirming.current = true;
    try {
      const outcome = await confirmPendingQuick(quickDeps, current);
      if (outcome === 'save_failed') {
        Alert.alert(t('aiConsent.saveError'));
        return;
      }
      if (outcome === 'recorded_started') trackConsent('ai_consent_granted', 'quick');
      setConsented(true);
      setPendingBoth(null);
    } finally {
      confirming.current = false;
    }
  }, [quickDeps, t, setPendingBoth]);

  const canSubmit = isMoodInputSubmittable(text.trim());

  // Serbest metin yolunda rıza adımı (CTA etiketi "Enable AI & Find Movies") ilk göründüğünde bir kez `shown`.
  const freeConsentVisible = consented === false && canSubmit && pending === null;
  useEffect(() => {
    if (!freeConsentVisible || freeShownTracked.current) return;
    freeShownTracked.current = true;
    trackConsent('ai_consent_shown', 'free_text');
  }, [freeConsentVisible]);

  const activeCard = pending ? MOOD_CARDS.find((c) => c.id === pending.cardId) : undefined;

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

        {consented === false && pending === null && (
          <Text style={styles.consentBody}>{t('aiConsent.inlineBody')}</Text>
        )}

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
            <MoodCardGrid
              activeMoodText={activeCard ? t(activeCard.titleKey) : ''}
              onSelect={(prompt, id) => void handleQuick(prompt, id)}
            />
          </View>
        </View>
      </ScrollView>

      {/* Rıza yokken kart dokunuşu: ekranın altına sabit, kaydırma gerekmez (iPhone SE dahil). */}
      {pending !== null && (
        <View style={styles.consentDock}>
          <Text style={styles.consentDockBody}>{t('aiConsent.inlineBody')}</Text>
          <PrimaryAction
            label={t('aiConsent.inlineEnableAndFind')}
            onPress={() => void handleEnableAndFind()}
            variant="gold"
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
