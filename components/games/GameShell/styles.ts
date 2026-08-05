/**
 * GameShell stilleri — Festival Layer.
 *
 * Anatomi: geri oku · (eyebrow + serif başlık) · sağ slot
 *          → altın segment çubuğu → içerik
 * Ayrıntı: DESIGN_SYSTEM.md › "Festival Layer — Games"
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  /**
   * paddingTop/paddingBottom runtime'da insets ile veriliyor (index.tsx).
   * Eski sabit `paddingBottom: 83` kaldırıldı — oyun ekranları root Stack'te,
   * tab bar yok, o 83px ölü alandı.
   */
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  /**
   * Ambiyans katmanı — `background` prop'u verilirse dolar. top/bottom
   * runtime'da negatif inset ile geçilir (index.tsx), burada yalnız yatay
   * kenarlar ve yığın sırası tanımlı.
   */
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    // zIndex verilmiyor: bu ilk çocuk, çizim sırası zaten header/içeriğin
    // altında bırakıyor. Negatif zIndex Android'de görünümü tamamen gizliyor.
  },
  /**
   * Yüzen cam chrome — `floatingHeader` açıkken header + progress'i sarar.
   * Ekranın üstüne yapışır, içerik altından kayar.
   *
   * Tam kanamalı olduğu için yan/üst kenarlık yok (GlassSurface'a `noBorder`
   * geçiliyor); ayrım yalnız alt hairline'dan gelir. `borderBottomWidth`
   * `borderWidth: 0`'dan daha spesifik olduğu için sonda uygulanır ve kazanır.
   */
  floatingChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.chromeGlassBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    // Dynamic Island nefesi: insets.top adanın ALT kenarına yapıştırıyor,
    // başlığın kendi üst boşluğu ayrıca gerekiyor. 8px yetmiyordu — eyebrow
    // satırı adanın dibine değiyordu.
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    minHeight: 56,
  },
  /** Geri butonu ve sağ slot aynı genişlikte — başlık optik olarak ortalanır */
  headerSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  eyebrow: {
    ...Theme.typography.eyebrow,
  },
  /**
   * Header başlığı serifTitle'ın (26) küçültülmüş hâli — üst barda 26 fazla
   * yer kaplıyor. serifTitle token'ı ekran içi dava/oyun başlıkları için durur.
   */
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Theme.fonts.display,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  // ─── Progress: altın segment çubuğu (nokta değil) ─────────────────────────
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  segmentUsed: {
    backgroundColor: Colors.gold,
  },
  /** white05 (%6 opak) koyu zeminde görünmüyordu — boş segment okunabilir olmalı */
  segmentEmpty: {
    backgroundColor: Colors.white10,
  },

  /**
   * Yatay padding sözleşmesi burada. Oyunlar bunun üstüne kendi
   * paddingHorizontal'ını EKLEMEZ — bkz. constants/gameLayout.ts
   */
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.md,
  },
  /** contentPadding={false} — tam kanamalı içerik, padding'i ekran yönetir */
  contentFlush: {
    flex: 1,
  },
});
