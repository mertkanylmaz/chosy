/**
 * ArchiveTrigger — K-46'nın istemci tarafı (R-C Parça 2c).
 *
 * Ritüel ekranı dinlenme hâline geldiğinde bir kez `get-archive-status`
 * sorar ve üç dalın birine düşer:
 *
 *   missedCount === 0            → hiçbir şey göstermez.
 *   missedCount === 1            → ÜCRETSİZ telafi. Arşive doğrudan giriş.
 *   archiveEligible === true     → K-46 paywall'ı (2. kaçırılan gün).
 *
 * Paywall'ı AÇAN tek şey kullanıcının arşiv bağlantısına dokunmasıdır
 * (CTO kararı, 24 Eyl 2026). Durum sorgusu mount'ta yapılır ama kendiliğinden
 * hiçbir şey açmaz — bu bileşen şampiyon ekranının içinde yaşıyor ve dayatılan
 * bir paywall K-45'in "champion paywall'ı yok" yasağına komşu olurdu.
 *
 * ── "İlk kaçırma ücretsiz" nerede saklanıyor ────────────────────────────────
 * Hiçbir yerde. Kalıcı durum tutulmuyor (CTO kararı 31 Ağu 2026, Seçenek A):
 * kural `missedCount`'tan türetiliyor. Şemaya bir "hak tüketildi" kolonu
 * eklemek yerine `paywall_triggered` eventiyle ölçüp sonra karar veriyoruz —
 * ölçmeden migration açmıyoruz.
 *
 * ── Uygunluk kararı burada VERİLMEZ ─────────────────────────────────────────
 * `archiveEligible` sunucudan gelir ve katılım şartını (pencerede en az 1
 * tamamlanmış gün) içerir. İstemci eşiği kendisi hesaplasaydı, ara veren her
 * kullanıcı dönüş anında paywall görürdü — 31 Ağu 2026 canlı veri ölçümünde
 * 6/6 kullanıcı tam olarak bu durumdaydı.
 *
 * Sessiz fallback yok: durum alınamazsa Sentry servis katmanında yazıldı,
 * burada hiçbir şey gösterilmez (ritüelin üstüne hata basmak, kullanıcının
 * asıl işini bozar — arşiv ikincil bir yüzey).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { router } from 'expo-router';

import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import { QuietAction } from '@/components/gauntlet/QuietAction';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getArchiveStatus } from '@/services/gauntletService';
import { hapticLight } from '@/utils/haptics';

export function ArchiveTrigger(): React.JSX.Element | null {
  const { t } = useLanguage();
  const { isPremium } = useSubscription();
  const [missedCount, setMissedCount] = useState(0);
  const [eligible, setEligible] = useState(false);
  /** Aynı mount'ta durumu iki kez sormayı önler. */
  const askedRef = useRef(false);

  const openArchive = useCallback(() => {
    void hapticLight();
    router.push('/archive');
  }, []);

  const { triggerPaywall, paywallProps } = useContextualPaywall(() => {
    // Satın alma tamamlandı — kullanıcı zaten arşivi istemişti, oraya götür.
    openArchive();
  });

  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;

    void (async () => {
      try {
        const status = await getArchiveStatus();
        setMissedCount(status.missedCount);
        setEligible(status.archiveEligible);

        // Mount'ta paywall AÇILMAZ (CTO karari, 24 Eyl 2026). Bu bilesen
        // sampiyon ekraninin icinde yasiyor; kullanici hicbir seye basmadan
        // acilan bir paywall, K-45'in "champion paywall'i yok" yasagiyla ayni
        // pikselleri paylasirdi. Tek giris noktasi asagidaki `handlePress`:
        // kullanici arsiv baglantisina bilincli olarak dokunur.
      } catch {
        // Servis katmanı Sentry'ye yazdı. Arşiv ikincil yüzey — ritüelin
        // üstüne hata basılmaz, giriş bağlantısı hiç görünmez.
      }
    })();
    // Yalnız durum sorgusu — paywall tetiklemediği için abonelik/trigger
    // bağımlılığı yok, mount başına tek çalışır.
  }, []);

  if (missedCount === 0) return null;

  /**
   * Giriş bağlantısı — paywall'ın TEK giriş noktası. Ücretsiz dal (tek
   * kaçırma) ve premium kullanıcı doğrudan arşive gider; uygun ama ücretli
   * dalda bağlantı paywall'ı açar. Kullanıcının bilinçli dokunuşu,
   * `IMMEDIATE_TRIGGERS` dışı olduğu için cooldown'a tabidir ve gün içinde
   * tekrar tekrar açılmaz.
   */
  const handlePress = () => {
    if (isPremium || !eligible) {
      openArchive();
      return;
    }
    void hapticLight();
    void triggerPaywall({ type: 'missed_day_archive', missedDayCount: missedCount });
  };

  return (
    <View style={styles.wrapper}>
      <QuietAction
        label={t('archive.entry', { count: missedCount })}
        onPress={handlePress}
      />
      <ContextualPaywall {...paywallProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingTop: Theme.spacing.md,
  },
});
