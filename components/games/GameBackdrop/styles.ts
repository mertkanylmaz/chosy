import { Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * GameBackdrop stilleri.
 *
 * `orb*` ölçüleri eski `ImposterPilot/styles.ts:43-58`'ten birebir taşındı —
 * Imposter'ın oynanış görünümü promosyonun referansı, değişmemeli.
 *
 * Renkler burada YOK: hepsi `theme` üzerinden runtime'da geliyor. Bu dosya
 * yalnız geometri tanımlar.
 */
export const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
  },

  // ─── orbs — beş oyunun varsayılanı ────────────────────────────────────────
  /**
   * Parıltı küreleri. Yuvarlatılmış kutu + şeffafa inen gradyan = ucuz radyal
   * parıltı. Ekran dışına taşarlar; kenarları görünmesin diye kasıtlı.
   */
  orbTop: {
    position: 'absolute',
    top: -220,
    left: -140,
    width: 460,
    height: 460,
    borderRadius: 230,
  },
  orbBottom: {
    position: 'absolute',
    bottom: -260,
    right: -160,
    width: 500,
    height: 500,
    borderRadius: 250,
  },

  // ─── beam — yalnız Spotlight ──────────────────────────────────────────────
  /**
   * Projektör huzmesi. Küre yerine eğik, ekranı boydan boya geçen geniş bir
   * dikdörtgen: üst sağdan sola aşağı iner. Döndürme, koni izlenimini
   * yuvarlatılmış kenar olmadan verir.
   *
   * Genişlik ekran genişliğinin iki katı — döndürüldükten sonra köşelerde
   * boşluk kalmasın diye.
   */
  beamShaft: {
    position: 'absolute',
    top: -160,
    left: -SCREEN_W * 0.5,
    width: SCREEN_W * 2,
    height: 420,
    transform: [{ rotate: '-28deg' }],
  },
  /** Huzmenin yere düştüğü ışık havuzu — ekranın alt kenarına yayılır */
  beamPool: {
    position: 'absolute',
    bottom: -120,
    left: -SCREEN_W * 0.25,
    width: SCREEN_W * 1.5,
    height: 360,
    borderRadius: 180,
  },
});
