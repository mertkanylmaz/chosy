/**
 * GauntletShell stilleri — DESIGN_OS §10.1 anatomisi: ink zemin (LightBleed),
 * poster çifti ~%70 genişlik alanında, soru callout/smoke, ikincil eylemler
 * metin bağlantısı. Drop shadow YOK (§4.3, PosterTile istisnası kendi içinde).
 */
import { StyleSheet } from 'react-native';

import { color, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  /**
   * Dış kabuk — TAM EKRAN, dolgusuz. Işık sızması burada yaşar ve ekranın
   * kenarına kadar ulaşır (§5.1). Güvenli alan dolgusu `insetLayer`'da;
   * buraya konsaydı çentik ve home indicator şeritleri boyasız kalır,
   * tintli alanın bittiği yerde görünür bir kenar oluşurdu.
   */
  root: {
    flex: 1,
    backgroundColor: color.surface.base,
  },
  /**
   * İç katman — güvenli alan dolgusunu taşıyan TEK yer (C.9b-UI G4b).
   * Sekiz dal bunu miras alır.
   *
   * TODO(measure): native tab bar payı burada YOK. `expo-router`'ın
   * `unstable-native-tabs`'ı `BottomTabBarHeightContext` sağlamıyor
   * (`useBottomTabBarHeight()` throw eder), yani bar yüksekliği için JS
   * API'si yok. Ek dolgu ölçüm cihazda yapılana kadar EKLENMEZ — sabit
   * yazmak iOS sürümleri arasında sessizce yanlış olurdu.
   */
  insetLayer: {
    flex: 1,
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
  /**
   * C.9b-UI G4: bağlam çubuğu + tur göstergesi ÜSTTE sabit kalır.
   * VoiceOver sırası da buradan gelir (K-54): bağlam → tur → poster A →
   * poster B → eylemler.
   */
  header: {
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
  },
  /**
   * C.9b-UI G4: film bloğu + soru + eylemler, header'dan artan alanın
   * ORTASINDA. Eskiden `content` hiç `justifyContent` taşımıyordu; her şey
   * üste yaslanıyor ve tüm boşluk ALTTA birikiyordu (Standard'da ~178pt,
   * Pro Max'te ~231pt ölü bant — cihaz görüntüsünde ekranın ~%22'si).
   * `flex: 1` + ortalama boşluğu bloğun altına ve üstüne böler.
   */
  middle: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * C.9b-UI G4 geometri: yan boşluk 24 → **16** (`posterRow`'un kendi 8pt
   * dolgusu kaldırıldı, `content`'inki yeterli), poster aralığı 16 → **12**.
   * Spec aralığı yan boşluk 12-16 / aralık 8-12; 16 ve 12'den başlanıyor,
   * cihazda 12/8'e kadar denenebilir.
   */
  posterRow: {
    flexDirection: 'row',
    gap: space.md,
    width: '100%',
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
  /**
   * K-42 bayat göstergesinin Champion dalındaki hâli. `offlineNotice` ile
   * aynı dil ve renk; farkı yalnız kendi dolgusunu taşıması — Champion
   * dalında `content` sarmalayıcısı yok.
   */
  championStaleNotice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    paddingHorizontal: space.base,
    paddingTop: space.base,
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
