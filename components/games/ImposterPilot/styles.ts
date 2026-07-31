/**
 * ImposterPilot stilleri — tek sayfa (kaydırmasız) düzen.
 *
 * Ölçüm gerektiren değerler (kart genişliği/yüksekliği, portre yüksekliği,
 * poster çerçevesi) runtime'da hesaplanıp dizi ile birleştirilir — bkz.
 * constants/gameLayout.ts dosya başındaki StyleSheet sözleşmesi.
 *
 * GameShell'e `contentPadding={false}` verildiği için yatay boşluk BURADA
 * yönetilir (`screen.paddingHorizontal`), ve genişlik hesabı
 * `useGameContentWidth()` ile aynı 16px'i varsayar.
 *
 * Renkler `PilotTokens` üzerinden gelir — Colors.ts'te olmayan neon/cam
 * değerleri global palete sızmasın diye (bkz. pilotTokens.ts).
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { GAME_CONTENT_PADDING } from '@/constants/gameLayout';

import { PilotTokens } from './pilotTokens';

export const styles = StyleSheet.create({
  /** Tek sayfa kabı — ScrollView YOK, yükseklik onLayout ile ölçülür */
  screen: {
    flex: 1,
    paddingHorizontal: GAME_CONTENT_PADDING,
    paddingBottom: Theme.spacing.sm,
  },

  // ─── Ambiyans (GameShell `background` slotu) ──────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  backdropBase: {
    ...StyleSheet.absoluteFillObject,
  },
  /**
   * Neon küreler. Yuvarlatılmış kutu + şeffafa inen gradyan = ucuz radyal
   * parıltı. Ekran dışına taşarlar; kenarları görünmesin diye kasıtlı.
   */
  glowTop: {
    position: 'absolute',
    top: -220,
    left: -140,
    width: 460,
    height: 460,
    borderRadius: 230,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -260,
    right: -160,
    width: 500,
    height: 500,
    borderRadius: 250,
  },

  // ─── Brief şeridi: TAM poster + film adı + soru ───────────────────────
  brief: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  /**
   * Poster çerçevesi. `contentFit="contain"` ile birlikte: afiş KIRPILMAZ,
   * oranı ne olursa olsun tamamı çerçevenin içine sığar. Zemin çerçeveyi
   * poster oranından farklı afişlerde de düzgün gösterir.
   */
  posterFrame: {
    borderRadius: Theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: PilotTokens.photoEmpty,
    borderWidth: 1,
    borderColor: PilotTokens.glassBorder,
  },
  posterImage: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Poster yanındaki metin sütunu — dikeyde ortalanır */
  briefText: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  roundPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: PilotTokens.roundWash,
    borderWidth: 1,
    borderColor: PilotTokens.roundAccent,
  },
  roundPillText: {
    ...Theme.typography.micro,
    color: PilotTokens.roundAccent,
    letterSpacing: 1.2,
  },
  /**
   * Film adı sans-serif. Pilot boyunca oynanış ekranında serif kullanılmıyor —
   * geri bildirim: "serif gazete manşeti gibi duruyor, tutarsız".
   */
  filmTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: Theme.fonts.inter,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: Colors.textPrimary,
  },
  /** Parlayan gradyan etiket — ana yönerge ekranda kaybolmaz */
  questionTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 7,
    borderRadius: Theme.borderRadius.full,
    shadowColor: PilotTokens.questionGlow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 10,
  },
  questionText: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: Theme.fonts.inter,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: Colors.white,
  },
  selectionHint: {
    ...Theme.typography.micro,
    color: PilotTokens.selectAccent,
    letterSpacing: 1,
  },

  // ─── Portre ızgarası ──────────────────────────────────────────────────
  /** Kalan tüm dikey alan — kartlar burada ortalanır */
  gridArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  /**
   * Kart = cam çerçeve. Dış katman yalnız yuvarlatma, kenarlık ve gölge
   * taşır; bulanıklık içteki BlurView'da. Gölge `overflow: 'hidden'` ile
   * aynı düğümde çalışmadığı için bu ayrım gerekli.
   */
  card: {
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: PilotTokens.glassShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 6,
  },
  cardGlass: {
    flex: 1,
    borderRadius: 17,
    overflow: 'hidden',
    padding: 5,
    backgroundColor: PilotTokens.glassSurface,
  },
  cardIdle: {
    borderColor: PilotTokens.glassBorder,
  },
  /** Seçili: neon camgöbeği kenar + hale */
  cardSelected: {
    borderColor: PilotTokens.selectAccent,
    shadowColor: PilotTokens.selectGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 12,
  },
  /** Öğrenme anı: sahtekâr olduğu açılan kart */
  cardImposter: {
    borderColor: Colors.success,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
  },
  /** Öğrenme anı: seçilmiş ama sahtekâr olmayan kart */
  cardWrong: {
    borderColor: Colors.error,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
  },
  photoWrap: {
    width: '100%',
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: PilotTokens.photoEmpty,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PilotTokens.photoEmpty,
  },
  initials: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: Theme.fonts.inter,
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  /** Seçili kartın portresine binen ince neon yıkama */
  selectWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PilotTokens.selectWash,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: '#07080F',
  },
  /**
   * İsim + rol adı bloğu — portrenin ALTINDA, gövde üstünde. Yüksekliği
   * index.tsx'teki LABEL_HEIGHT ile birebir tutulur; kart yüksekliği ondan
   * pay biçildiği için buraya sabit yükseklik yazılmaz, ortalama yeter.
   */
  labelBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    gap: 1,
  },
  name: {
    fontSize: 12.5,
    lineHeight: 16,
    fontFamily: Theme.fonts.inter,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  nameSelected: {
    color: PilotTokens.selectAccent,
  },
  /** Rol adı — ipucu katmanı, isimden bir kademe sönük */
  character: {
    fontSize: 10.5,
    lineHeight: 13,
    fontFamily: Theme.fonts.inter,
    fontWeight: '500',
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // ─── Reveal bandı — ızgaranın ÜSTÜNE biner, yer kaplamaz ──────────────
  revealWrap: {
    position: 'absolute',
    left: GAME_CONTENT_PADDING,
    right: GAME_CONTENT_PADDING,
    bottom: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PilotTokens.glassBorder,
  },
  revealBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.md,
    backgroundColor: PilotTokens.glassFallback,
  },
  revealBody: {
    flex: 1,
    gap: 2,
  },
  revealTitle: {
    ...Theme.typography.body,
    fontWeight: '700',
  },
  revealSubtext: {
    ...Theme.typography.caption,
  },

  // ─── Hata ─────────────────────────────────────────────────────────────
  errorBox: {
    position: 'absolute',
    left: GAME_CONTENT_PADDING,
    right: GAME_CONTENT_PADDING,
    bottom: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: PilotTokens.glassBorder,
    backgroundColor: PilotTokens.glassFallback,
  },
  errorText: {
    ...Theme.typography.caption,
  },
});
