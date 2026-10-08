/**
 * WaitingView stilleri — before_18 düzeni. GauntletShell/styles.ts'ten
 * taşındı (waitingScroll*); `title` eski `stateText`'in KOPYASIDIR — paylaşılan
 * `stateText` dört dalda kullanıldığı için before_18 kendi adını taşır.
 */
import { StyleSheet } from 'react-native';

import { color, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  /**
   * İçerik sığdığında dikeyde ortalı (`flexGrow` + `justifyContent`);
   * sığmadığında (AX5, küçük ekran) kaydırılır, kesilmez.
   */
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    gap: space.lg,
  },
  title: {
    ...type.body,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
