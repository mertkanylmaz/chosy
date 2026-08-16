/**
 * ContextBar — bağlam satırı, "Salı akşamı · Yalnız · ~2 saat ⌄". C.3,
 * PRODUCT_OS §4.2, DESIGN_OS §10.1/§10.3.
 *
 * CTO kararı (16.08.2026, kilitli):
 *   1. companion/duration/energy üçü de gösterilir ve düzeltilebilir —
 *      duration bugün gerçek filtre, companion/energy henüz filtreye
 *      girmez ama choice_events.context'e yazılır (Faz F veri temeli).
 *   2. İdempotency korunur: düzeltme BUGÜNÜN dörtlüsünü DEĞİŞTİRMEZ, yalnız
 *      `context_corrections`'a yazılıp YARINKİ tahmini besler. PRODUCT_OS
 *      §4.2'deki "anında yeni çift" bu fazda ERTELENDİ.
 *   3. Bu dürüstçe söylenir (§4.3 "gizli tahmin yasak") — `honestNote`
 *      metni her zaman görünür, gizlenmez.
 *
 * Yazı girişi yok, yalnız dokunma (§4.1). Kaydetme GauntletShell'in işi:
 * bu bileşen yalnızca `onCorrect` ile düzeltilmiş context'i bildirir —
 * PendingWatchFeedbackCard/`onRespond` ile aynı desen, network sonucu
 * beklenmez (bugünün ekranını bloklayacak bir şey zaten yok).
 */
import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';
import type { GauntletContext } from '@/types/gauntlet';

import { styles } from './styles';

const COMPANIONS: readonly GauntletContext['companion'][] = ['alone', 'partner', 'friends', 'family'];
const DURATIONS: readonly GauntletContext['duration'][] = ['short', 'medium', 'any'];
const ENERGIES: readonly GauntletContext['energy'][] = ['drained', 'normal', 'open'];

type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

function dayPartFor(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

interface SegmentRowProps<T extends string> {
  options: readonly T[];
  selected: T;
  labelFor: (value: T) => string;
  onSelect: (value: T) => void;
}

function SegmentRow<T extends string>({
  options,
  selected,
  labelFor,
  onSelect,
}: SegmentRowProps<T>): React.JSX.Element {
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segmentPill, active && styles.segmentPillActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {labelFor(option)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface ContextBarProps {
  /** DailyGauntlet.context — tahmin edilen (bugün hep nötr) bağlam. */
  context: GauntletContext;
  /** Kullanıcı düzeltip kaydettiğinde çağrılır. Bugünü DEĞİŞTİRMEZ. */
  onCorrect: (corrected: GauntletContext) => void;
}

export function ContextBar({ context, onCorrect }: ContextBarProps): React.JSX.Element {
  const { t, language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<GauntletContext>(context);
  const [justSaved, setJustSaved] = useState(false);

  // "Şu an" — tahmin değil, gözlemlenen gerçek gün/saat (§4.2 "Salı akşamı").
  const now = useMemo(() => new Date(), []);
  const day = useMemo(
    () => new Intl.DateTimeFormat(language, { weekday: 'long' }).format(now),
    [language, now],
  );
  const dayPart = t(`gauntlet.context.dayPart.${dayPartFor(now.getHours())}`);
  const companionLabel = t(`gauntlet.context.companion.${context.companion}`);
  const durationLabel = t(`gauntlet.context.duration.${context.duration}`);

  const collapsedLabel = t('gauntlet.context.label', {
    day,
    dayPart,
    companion: companionLabel,
    duration: durationLabel,
  });

  const toggle = (): void => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setDraft(context);
    setJustSaved(false);
    setExpanded(true);
  };

  const handleSave = (): void => {
    onCorrect(draft);
    setExpanded(false);
    setJustSaved(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={toggle}
        style={styles.collapsedRow}
        accessibilityRole="button"
        accessibilityLabel={collapsedLabel}
        accessibilityState={{ expanded }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.label}>{collapsedLabel}</Text>
        <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>{t('gauntlet.context.editorTitle')}</Text>

          <SegmentRow
            options={COMPANIONS}
            selected={draft.companion}
            labelFor={(v) => t(`gauntlet.context.companion.${v}`)}
            onSelect={(v) => setDraft((prev) => ({ ...prev, companion: v }))}
          />
          <SegmentRow
            options={DURATIONS}
            selected={draft.duration}
            labelFor={(v) => t(`gauntlet.context.duration.${v}`)}
            onSelect={(v) => setDraft((prev) => ({ ...prev, duration: v }))}
          />
          <SegmentRow
            options={ENERGIES}
            selected={draft.energy}
            labelFor={(v) => t(`gauntlet.context.energy.${v}`)}
            onSelect={(v) => setDraft((prev) => ({ ...prev, energy: v }))}
          />

          {/* §4.3 "gizli tahmin yasak" — bu her zaman görünür, gizlenmez. */}
          <Text style={styles.honestNote}>{t('gauntlet.context.honestNote')}</Text>

          <TouchableOpacity
            onPress={handleSave}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel={t('gauntlet.context.save')}
          >
            <Text style={styles.saveButtonText}>{t('gauntlet.context.save')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {justSaved && !expanded && (
        <Text style={styles.savedNote}>{t('gauntlet.context.saved')}</Text>
      )}
    </View>
  );
}
