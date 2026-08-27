/**
 * GauntletShell stilleri — DESIGN_OS §10.1 anatomisi: ink zemin (LightBleed),
 * poster çifti ~%70 genişlik alanında, soru callout/smoke, ikincil eylemler
 * metin bağlantısı. Drop shadow YOK (§4.3, PosterTile istisnası kendi içinde).
 */
import { StyleSheet } from 'react-native';

import { color, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.surface.base,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  /** §15.3 anahtar metinleri (Bekleyiş / Tükeniş) ve §15.2 hata mesajı */
  stateText: {
    ...type.body,
    color: color.text.secondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: space.base,
    paddingTop: space.xxl,
    paddingBottom: space.xl,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xl,
  },
  posterRow: {
    flexDirection: 'row',
    gap: space.base,
    width: '100%',
    paddingHorizontal: space.sm,
  },
  posterSlot: {
    flex: 1,
  },
  question: {
    ...type.callout,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.xl,
  },
  actionError: {
    ...type.caption,
    color: color.text.primary,
    textAlign: 'center',
    marginTop: space.sm,
  },
  /**
   * K-42: gösterilen liste bugünün değil. Hata DEĞİL, bir durum bildirimi —
   * bu yüzden `actionError`'ın vurgusunu almaz, ikincil renkte kalır.
   */
  offlineNotice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.sm,
  },
  /** K-42: seçim kuyrukta bekliyor. Aynı gerekçe — bekleyiş, hata değil. */
  pendingNotice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
  },
  actionSeparator: {
    ...type.caption,
    color: color.text.secondary,
    opacity: 0.7,
  },
  /** Bootstrapping — graphite iskelet (§10.1: spinner yok, §7.4 iskelet istisnası) */
  skeletonContent: {
    flex: 1,
    paddingHorizontal: space.base,
    paddingTop: space.xxl,
    alignItems: 'center',
    gap: space.xl,
  },
  skeletonPosterSlot: {
    flex: 1,
    aspectRatio: 2 / 3,
  },
  /** SkeletonLoader'ın inline height'ını ezer — slot aspectRatio belirler. */
  skeletonPoster: {
    width: '100%',
    height: '100%',
  },
});
