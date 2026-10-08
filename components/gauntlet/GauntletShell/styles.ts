/**
 * GauntletShell stilleri — DESIGN_OS §10.1 anatomisi: ink zemin (LightBleed),
 * poster çifti ~%70 genişlik alanında, soru callout/smoke, ikincil eylemler
 * metin bağlantısı. Drop shadow YOK (§4.3, PosterTile istisnası kendi içinde).
 */
import { StyleSheet } from 'react-native';

import { POSTER_META_BLOCK_HEIGHT } from '@/components/gauntlet/PosterTile/styles';
import { color, radius, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';

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
   * V-2 Tur B: alt dolgu artık native tab bar payını İÇERİR — değer
   * `useTabBarInset()`'ten gelir (native ölçüm, sabit değil) ve inline
   * verilir; burada yalnız yerleşim.
   */
  insetLayer: {
    flex: 1,
  },
  /** V-2 Tur B: şampiyon bloğunun kaydırma alanı — `insetLayer`'ı doldurur. */
  championScroll: {
    flex: 1,
  },
  /**
   * `flexGrow: 1` — içerik kısa olduğunda `ChampionReveal`'ın flex:1 +
   * ortalaması eskisi gibi çalışır; uzun olduğunda (SE) kaydırılır.
   * Alt dolgu inline: ölçülen Spotlight kartı yüksekliğine bağlı.
   */
  championScrollContent: {
    flexGrow: 1,
  },
  /**
   * V-3 Tur G2 (C7): Spotlight kartı kaydırma içeriğinin SONUNDA, satır içi.
   * Yatay boşluk kartın kendi `marginHorizontal`'ında.
   */
  bonusCardInline: {
    marginTop: space.lg,
  },
  /**
   * V-3 Tur G2: bayat gösterge hero'nun üstünde sabit — `top` inline
   * (güvenli alan). Poster üstünde okunsun diye `ink@80%` zemin.
   */
  championStaleOverlay: {
    position: 'absolute',
    left: space.base,
    right: space.base,
    marginTop: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(color.surface.base, 0.8),
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
  },
  /**
   * C.9b-UI G4: film bloğu + soru + eylemler, header'dan artan alanın
   * ORTASINDA. Eskiden `content` hiç `justifyContent` taşımıyordu; her şey
   * üste yaslanıyor ve tüm boşluk ALTTA birikiyordu (Standard'da ~178pt,
   * Pro Max'te ~231pt ölü bant — cihaz görüntüsünde ekranın ~%22'si).
   * `flex: 1` + ortalama boşluğu bloğun altına ve üstüne böler.
   *
   * V-2 Tur C: ortalama KALDIRILDI — cihaz testinde ilerleme göstergesi ile
   * posterler arasında büyük ölü bant bırakıyordu. Blok artık üste yaslanır;
   * header ile arasındaki boşluk `headerGapFor()` ile ekran yüksekliğine
   * göre token merdiveninden seçilir (inline `marginTop`). Artan alan
   * eylemlerin ALTINDA kalır.
   */
  middle: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
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
  /**
   * V-3 referans uyumu: soru ince ve geri çekilmiş — `callout` (15/20),
   * `smoke` (ink üstünde 6.1:1). G5'in `body`/`bone@80%` hâli referansın
   * tersine büyümüştü. Serif DEĞİL — serif yalnız film adlarında (V3-D1).
   */
  question: {
    ...type.callout,
    color: color.text.secondary,
    textAlign: 'center',
    // V-2 Tur C: xl → lg — soru posterlerin hemen altında.
    marginTop: space.lg,
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
    color: color.text.primary,
    textAlign: 'center',
    paddingHorizontal: space.base,
  },
  /** K-42: seçim kuyrukta bekliyor. Aynı gerekçe — bekleyiş, hata değil. */
  pendingNotice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.sm,
  },
  /**
   * V-3 Tur G1 (G6): tam genişlik satır — iki `OutlineAction` `flex: 1` ile
   * eşit paylaşır. `·` ayırıcısı (`actionSeparator`) kaldırıldı.
   */
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    width: '100%',
    // V-2 Tur C: lg → base — eylem satırı soruya bağlı tek grup.
    marginTop: space.base,
  },
  /**
   * Bootstrapping — graphite iskelet (§10.1: spinner yok, §7.4 iskelet
   * istisnası). V-3 Tur G1: iskelet `content`/`header`/`middle`/`posterRow`/
   * `actions` stillerini ana dalla PAYLAŞIR; aşağıdakiler yalnız iskelete
   * özgü parçalar.
   */
  skeletonPosterFrame: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  /** SkeletonLoader'ın inline height'ını ezer — çerçeve aspectRatio belirler. */
  skeletonPoster: {
    width: '100%',
    height: '100%',
  },
  /** PosterTile'ın başlık (2 satır) + meta bloğu kadar yer. */
  skeletonMetaBlock: {
    height: POSTER_META_BLOCK_HEIGHT,
    paddingTop: space.sm,
    alignItems: 'center',
  },
  skeletonQuestion: {
    width: '100%',
    alignItems: 'center',
    marginTop: space.lg,
  },
  skeletonAction: {
    flex: 1,
  },
});

/**
 * V-2 Tur C: tur göstergesi → poster bloğu arası boşluk. Ekran yüksekliğine
 * göre token merdiveninden seçilir, ara değer üretilmez. Eşikler: SE/mini
 * (<700pt) · Standard (<850pt) · Plus/Pro Max.
 */
export function headerGapFor(windowHeight: number): number {
  if (windowHeight < 700) return space.base;
  if (windowHeight < 850) return space.lg;
  return space.xl;
}

/**
 * V-3 Tur G1: oyun dalının (ve iskeletinin) üst dolgusu. Yeni düzen (44pt
 * pill, 2 satır başlık payı, 44pt buton satırı) SE'de (667pt) `xxl` üst
 * dolguyla editoryal ipucu satırı göründüğünde butonları tab bar'ın altına
 * itiyordu. Aynı eşik: SE/mini (<700pt) `base`, diğerleri `content`'teki
 * `xxl` (değişmez).
 */
export function contentTopFor(windowHeight: number): number {
  if (windowHeight < 700) return space.base;
  return space.xxl;
}
