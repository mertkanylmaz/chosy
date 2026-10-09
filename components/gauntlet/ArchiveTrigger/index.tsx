/**
 * ArchiveTrigger — K-46'nın istemci tarafı (R-C Parça 2c, E-29 ile revize).
 *
 * Ritüel ekranı dinlenme hâline geldiğinde bir kez `get-archive-status`
 * sorar; kaçırılan gün varsa arşive giriş bağlantısını gösterir.
 *
 * ── E-29 (R-5): arşiv paywall AÇMAZ ─────────────────────────────────────────
 * Arşiv ücretsiz ve yalnız görüntülemedir (`app/archive.tsx`). Önceki
 * sürümde 2. kaçırılan gün paywall açıyordu ve paywall "yeniden oyna" /
 * "şampiyonunu kendi saatinde seç" vaat ediyordu; ikisi de 2.1.0'da yok
 * (arşivde gauntlet oynanmaz). Bağlantı artık HER durumda doğrudan
 * `/archive`'e gider. `missed_day_archive` varyantı ve tetikleyici tipi
 * silinmedi (docs/TEKNIK_BORC.md "R-5 ertelenenler"), yalnız buradan
 * çağrılmıyor. 2.1.0'da paywall'ın tek kullanıcı girişi Pro Mode kapısıdır.
 *
 * Sessiz fallback yok: durum alınamazsa Sentry'ye yazılır (ağ/sunucu
 * hatasında servis katmanı, 401'de bu bileşen), burada hiçbir şey gösterilmez
 * (ritüelin üstüne hata basmak, kullanıcının asıl işini bozar — arşiv
 * ikincil bir yüzey).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { GauntletAuthPendingError, getArchiveStatus } from '@/services/gauntletService';
import { hapticLight } from '@/utils/haptics';

export function ArchiveTrigger(): React.JSX.Element | null {
  const { t } = useLanguage();
  const [missedCount, setMissedCount] = useState(0);
  /** Aynı mount'ta durumu iki kez sormayı önler. */
  const askedRef = useRef(false);

  const openArchive = useCallback(() => {
    void hapticLight();
    router.push('/archive');
  }, []);

  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;

    void (async () => {
      try {
        const status = await getArchiveStatus();
        setMissedCount(status.missedCount);

      } catch (err) {
        // Arşiv ikincil yüzey — ritüelin üstüne hata basılmaz, giriş
        // bağlantısı bu mount boyunca görünmez. Ama sessiz değil:
        //   401 (bootstrap penceresi) → servis Sentry'ye YAZMAZ, burada yazılır;
        //   ağ yok / sunucu hatası   → servis zaten yazdı, çift event yerine
        //                              breadcrumb (GauntletShell waiting CTA deseni).
        if (err instanceof GauntletAuthPendingError) {
          Sentry.captureException(err, {
            level: 'warning',
            tags: {
              component: 'ArchiveTrigger',
              error_code: 'ARCHIVE_STATUS_AUTH_PENDING',
            },
          });
        } else {
          Sentry.addBreadcrumb({
            category: 'gauntlet.archive',
            level: 'warning',
            message: 'archive status okunamadı — arşiv bağlantısı gizli',
            data: { error: err instanceof Error ? err.message : String(err) },
          });
        }
      }
    })();
    // Yalnız durum sorgusu — mount başına tek çalışır.
  }, []);

  if (missedCount === 0) return null;

  return (
    <View style={styles.wrapper}>
      <QuietAction
        label={t('archive.entry', { count: missedCount })}
        onPress={openArchive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingTop: Theme.spacing.md,
  },
});
