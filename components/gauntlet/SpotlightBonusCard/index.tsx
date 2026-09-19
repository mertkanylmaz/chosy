/**
 * SpotlightBonusCard — "Bugünün bonusu" (C.9b-UI C4, IA §2.6).
 *
 * IA kararı §2.6: *"Spotlight sadece şampiyon ekranının altında 'bugünün
 * bonusu' kartı olarak yaşar. Kalıcı, geri dönülebilir bir erişim noktası
 * yok."* Ayrı hub YOK — Discover kalktığı için Cinema Games section'ı da
 * gitti; tek giriş burası.
 *
 * §7.1 ile uyumlu: bonus ritüelin ÇIKIŞINDA durur, içinde değil. Gauntlet
 * bitmeden görünmez; günün işi bitti, isteyen devam eder.
 *
 * ── Tek hedef ───────────────────────────────────────────────────────────────
 * Kartın tamamı tek dokunma alanıdır. İkinci bir eylem (kapat, gizle, "daha
 * fazla oyun") YOK — ikinci hedef bu yüzeyi bir hub'a çevirmeye başlar.
 *
 * ── Renk ────────────────────────────────────────────────────────────────────
 * Mor (`#8B5CF6`) YALNIZ bu kartta. Karanlık Salon paletine sızmaz; değer
 * `GAME_THEMES.spotlight.accent`'ten okunur, hardcode edilmez — oyunun kendi
 * kimliği zaten orada tanımlı (tek kaynak).
 *
 * ── Analytics ───────────────────────────────────────────────────────────────
 * YENİ EVENT YOK (M1 kapsamı). Oyun tarafının kendi enstrümantasyonu
 * değişmedi.
 */
import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useRouter } from 'expo-router';

import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';

import { styles } from './styles';

export function SpotlightBonusCard(): React.JSX.Element {
  const { t } = useLanguage();
  const router = useRouter();

  const handlePress = useCallback(() => {
    void hapticLight();
    router.push('/games/spotlight');
  }, [router]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${t('gauntlet.bonus.label')}: ${t('gauntlet.bonus.title')}`}
    >
      {/* Mor işaret — kartın tek renkli öğesi, metin değil kenar. */}
      <View style={styles.accentBar} />
      <View style={styles.textBlock}>
        <Text style={styles.label}>{t('gauntlet.bonus.label')}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {t('gauntlet.bonus.title')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
