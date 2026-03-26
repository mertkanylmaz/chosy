/**
 * FeedbackModal — İzleme sonrası geri bildirim bottom sheet'i.
 *
 * Kullanıcıdan:
 *   1. 1-5 yıldız puanı
 *   2. "Öneri isabetli miydi?" (Evet / Hayır)
 * bilgisini alır ve kaydet butonuyla geri bildirir.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { styles } from './styles';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface FeedbackResult {
  starRating: number;
  onPoint: boolean;
}

interface Props {
  visible: boolean;
  filmTitle: string;
  onSubmit: (result: FeedbackResult) => Promise<void>;
  onClose: () => void;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const STARS = [1, 2, 3, 4, 5] as const;

// ─── Bileşen ──────────────────────────────────────────────────────────────────

/**
 * İzleme sonrası geri bildirim bottom sheet'i.
 * Yıldız seçilmeden ve evet/hayır belirtilmeden "Kaydet" aktif olmaz.
 */
export default function FeedbackModal({ visible, filmTitle, onSubmit, onClose }: Props) {
  const { t } = useLanguage();
  const [starRating, setStarRating] = useState<number | null>(null);
  const [onPoint, setOnPoint] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setStarRating(null);
    setOnPoint(null);
    setLoading(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (starRating === null || onPoint === null) return;

    setLoading(true);
    try {
      await onSubmit({ starRating, onPoint });
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = starRating !== null && onPoint !== null && !loading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>{filmTitle}</Text>
          <Text style={styles.subtitle}>{t('feedback.subtitle')}</Text>

          <Text style={styles.sectionLabel}>{t('feedback.rating')}</Text>
          <View style={styles.starsRow}>
            {STARS.map((star) => (
              <TouchableOpacity
                key={star}
                style={styles.starButton}
                onPress={() => setStarRating(star)}
                activeOpacity={0.7}>
                <Text style={styles.starText}>
                  {starRating !== null && star <= starRating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>{t('feedback.onPoint')}</Text>
          <View style={styles.onPointRow}>
            <TouchableOpacity
              style={[styles.onPointButton, onPoint === true && styles.onPointButtonActive]}
              onPress={() => setOnPoint(true)}
              activeOpacity={0.75}>
              <Text style={[styles.onPointText, onPoint === true && styles.onPointTextActive]}>
                {t('feedback.yes')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.onPointButton, onPoint === false && styles.onPointButtonActive]}
              onPress={() => setOnPoint(false)}
              activeOpacity={0.75}>
              <Text style={[styles.onPointText, onPoint === false && styles.onPointTextActive]}>
                {t('feedback.no')}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#0A0E27" />
                <Text style={styles.submitText}>{t('feedback.saving')}</Text>
              </View>
            ) : (
              <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
                {t('feedback.save')}
              </Text>
            )}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
