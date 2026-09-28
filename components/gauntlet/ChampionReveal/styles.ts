/**
 * ChampionReveal stilleri — V-3 Tur G2 (C1–C8). Drop shadow YOK (§4.3).
 *
 * Hero tam genişlik ve yüksekliği inline (pencere × HERO_HEIGHT_RATIO);
 * blok hero'nun altına `-TITLE_OVERLAP` ile biner (heroScrim.ts, kontrast
 * ölçümü orada). Yatay boşluk yalnız blokta — hero kenardan kenara.
 */
import { StyleSheet } from 'react-native';

import { color, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  /**
   * C.9b-UI G11: zemin ŞEFFAF — `GauntletShell` root'u `ink` boyuyor, ışık
   * sızması da orada. Buraya renk koymak o katmanı yeniden örter.
   */
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  /** C1: kenardan kenara, köşesiz. Yükseklik inline. */
  hero: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: color.surface.raised,
  },
  /** Dokunma alanı hero'nun TAMAMI — ayrı bir buton çizilmez (§10.2 sessizlik). */
  posterTouchable: {
    width: '100%',
    height: '100%',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  /** C1: poster yüklenemedi — düz `charcoal`, ortada sönük ikon, metin yok. */
  posterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
  },
  /** C1: geçiş hero'nun alt yarısında (SCRIM_HEIGHT_RATIO = 0.5). */
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  /**
   * V-3 referans uyumu: etiketin arkasındaki üst geçiş (heroScrim.ts
   * TOP_SCRIM_*). Yükseklik inline.
   */
  topScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  /** Etiket hero'nun tepesinde — `top` inline (güvenli alan + KICKER_TOP_GAP). */
  kickerOnHero: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: space.lg,
    gap: space.base,
  },
  /**
   * C2: büyük harf JS'te (`toLocaleUpperCase`) — TR i → İ. Renk `bone@80%`:
   * iki konumda da en kötü durum (saf beyaz poster) ≥ 4.5:1 heroScrim
   * testinde ölçülür; `smoke` 4.5'i tutturmazdı.
   */
  kicker: {
    ...type['label-caps'],
    color: color.text.primarySoft,
    textAlign: 'center',
  },
  /** Reduce Transparency / bayat gösterge: etiket başlığın üstünde (G2 yerleşimi). */
  kickerInBody: {
    marginBottom: space.sm,
  },
  /**
   * C3 başlık — `filmTitle` ailesi (V3-D1), C.9b-UI C8 kademesi korunur:
   * uzunluk eşiğine göre 40 → 32 → 28, en fazla 3 satır, runtime autoscale
   * YOK. Eşik ölçümü (19 Eyl, n=1907): >25 karakter 242 film, >35 64 film,
   * en uzun 68 ("Dr. Strangelove or: …"). Serif'te harf aralığı 0.
   */
  title: {
    ...type.filmTitle,
    fontSize: 40,
    lineHeight: 44,
    color: color.text.primary,
    textAlign: 'center',
  },
  titleMedium: {
    fontSize: 32,
    lineHeight: 36,
  },
  titleSmall: {
    fontSize: 28,
    lineHeight: 32,
  },
  /** C4: "1994 · 142 MIN" — Martian Mono. */
  metaLine: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'center',
  },
  actionsWrapper: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: space.base,
    marginTop: space.sm,
  },
  /** C6: tam genişlik, alt alta. */
  actionsStack: {
    alignSelf: 'stretch',
    gap: space.md,
  },
  /** Pano / kaydetme onayı — kısa ömürlü, butonların ÜSTÜNDE (sabit sıra). */
  shareNotice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
