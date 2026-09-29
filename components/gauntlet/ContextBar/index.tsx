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
 *
 * V-2 Tur B: düzenleyici artık satır içinde AÇILMAZ — bottom sheet (repo
 * sheet deseni: `AuthPromptSheet` / `NotificationPromptSheet` ile aynı RN
 * `Modal` + backdrop). Satır içi panel oyun bloğunu aşağı itiyor, soru ve
 * "İkisi de değil · İzledim" satırı tab bar'ın altına düşüyordu. Davranış
 * aynı: Kaydet → `onCorrect(draft)` + kapan + "kaydedildi"; kaydetmeden
 * kapatmak (backdrop / geri hareketi) taslağı atar — eskiden satıra tekrar
 * dokunmak neyse o.
 *
 * V-4 Tur B (TestFlight 906: tam genişlik pill "ALO…" diye kesiliyordu):
 * pill içerik genişliğinde ve ortalı; sığmayan segment ellipsis yerine
 * DÜŞER. Bottom sheet ve düzeltme akışı aynen.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';

import { CaretDown, CaretUp, SlidersHorizontal } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, size, space } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import type { GauntletContext } from '@/types/gauntlet';

import { PILL_CHROME_WIDTH, styles } from './styles';

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

/**
 * V-4 Tur B: pill'e sığan en uzun önek. `prefixWidths[i]` = ilk `i + 1`
 * segmentin birleşik metninin ölçülen genişliği (artan). Kiminle (ilk
 * segment) HER ZAMAN gösterilir — tek başına sığmasa bile düşmez, çünkü
 * düşerse pill boş kalırdı. Ölçüm eksikse `null`: henüz karar verilemez.
 */
function fittingSegmentCount(
  prefixWidths: readonly (number | undefined)[],
  available: number,
): number | null {
  if (prefixWidths.some((w) => w === undefined)) return null;
  let count = 1;
  for (let i = 1; i < prefixWidths.length; i++) {
    const width = prefixWidths[i];
    if (width === undefined || width > available) break;
    count = i + 1;
  }
  return count;
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
  /** Sheet pencere seviyesinde çizilir — alt pay yalnız home indicator. */
  const insets = useSafeAreaInsets();

  // "Şu an" — tahmin değil, gözlemlenen gerçek gün/saat (§4.2 "Salı akşamı").
  const now = useMemo(() => new Date(), []);
  const day = useMemo(
    () => new Intl.DateTimeFormat(language, { weekday: 'long' }).format(now),
    [language, now],
  );
  const dayPart = t(`gauntlet.context.dayPart.${dayPartFor(now.getHours())}`);
  const companionLabel = t(`gauntlet.context.companion.${context.companion}`);
  const durationLabel = t(`gauntlet.context.duration.${context.duration}`);

  /** VoiceOver metni — kısaltılmaz, uzun etiketlerle tam cümle. */
  const collapsedLabel = t('gauntlet.context.label', {
    day,
    dayPart,
    companion: companionLabel,
    duration: durationLabel,
  });

  /**
   * V-4 Tur B: pill'in görsel özeti — segmentler ÖNCELİK sırasıyla, görsel
   * sıra da aynı (kurucu onayı): kiminle · enerji · süre · gün. Süre
   * yalnız "Doesn't matter" DIŞINDAYSA gösterilir, kısa karşılığıyla
   * ("~2 HR"). Büyük harf JS'te dile göre — `textTransform` TR'de i → İ
   * dönüşümünü yapmaz.
   *
   * Kısaltma kuralı: kesik metin YOK (ellipsis yok). Satıra sığmayan
   * segment sondan DÜŞER — önce gün, sonra süre, sonra enerji. Veri modeli
   * değişmez; yalnız mevcut `GauntletContext` alanları okunur. Tam cümle
   * VoiceOver'da (`collapsedLabel`) her zaman eksiksiz.
   */
  const segments = useMemo(() => {
    const list = [companionLabel, t(`gauntlet.context.energy.${context.energy}`)];
    if (context.duration !== 'any') {
      list.push(t(`gauntlet.context.pillDuration.${context.duration}`));
    }
    list.push(t('gauntlet.context.pillDay', { day, dayPart }));
    return list.map((segment) => segment.toLocaleUpperCase(language));
  }, [companionLabel, context.energy, context.duration, day, dayPart, language, t]);

  const separator = t('gauntlet.context.pillSeparator');
  /** Aday metinler: ilk 1, ilk 2, … segment. Her biri gizli katmanda ölçülür. */
  const prefixes = useMemo(
    () => segments.map((_, i) => segments.slice(0, i + 1).join(separator)),
    [segments, separator],
  );

  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [prefixWidths, setPrefixWidths] = useState<Record<string, number>>({});

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setContainerWidth((prev) => (prev === width ? prev : width));
  }, []);

  const handlePrefixLayout = useCallback((text: string, e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setPrefixWidths((prev) => (prev[text] === width ? prev : { ...prev, [text]: width }));
  }, []);

  const visibleCount =
    containerWidth === null
      ? null
      : fittingSegmentCount(
          prefixes.map((p) => prefixWidths[p]),
          containerWidth - PILL_CHROME_WIDTH,
        );
  const pillText = prefixes[(visibleCount ?? prefixes.length) - 1];

  const toggle = (): void => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setDraft(context);
    setJustSaved(false);
    setExpanded(true);
    posthogAnalytics.track('context_opened');
  };

  /** Kaydetmeden kapatma — taslak atılır (eski satır-içi kapatmayla aynı). */
  const close = (): void => {
    setExpanded(false);
  };

  const handleSave = (): void => {
    onCorrect(draft);
    setExpanded(false);
    setJustSaved(true);
  };

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      {/* V-4 Tur B: ölçüm katmanı — görünmez, dokunulmaz, VoiceOver'dan
          gizli. Aday metinler sınırsız genişlikte tek satır ölçülür. */}
      <View
        style={styles.measureLayer}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {prefixes.map((prefix) => (
          <Text
            key={prefix}
            style={[styles.summaryText, styles.measureText]}
            numberOfLines={1}
            onLayout={(e) => handlePrefixLayout(prefix, e)}
          >
            {prefix}
          </Text>
        ))}
      </View>

      <TouchableOpacity
        onPress={toggle}
        // Ölçüm gelene dek görünmez (tek kare) — taşan metin hiç çizilmez.
        style={[styles.collapsedRow, visibleCount === null && styles.pendingMeasure]}
        accessibilityRole="button"
        accessibilityLabel={collapsedLabel}
        accessibilityState={{ expanded }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <SlidersHorizontal size={size.iconInline} color={color.text.secondary} />
        <Text style={styles.summaryText} numberOfLines={1} ellipsizeMode="clip">
          {pillText}
        </Text>
        {expanded ? (
          <CaretUp size={size.iconInline} color={color.text.secondary} />
        ) : (
          <CaretDown size={size.iconInline} color={color.text.secondary} />
        )}
      </TouchableOpacity>

      <Modal visible={expanded} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t('gauntlet.close')}
          />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <View style={styles.handle} />
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
        </View>
      </Modal>

      {justSaved && !expanded && (
        <Text style={styles.savedNote}>{t('gauntlet.context.saved')}</Text>
      )}
    </View>
  );
}
