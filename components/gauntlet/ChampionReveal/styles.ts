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
  /** C1: alt geçiş — yükseklik inline (hero × SCRIM_HEIGHT_RATIO, V-4: 0.35). */
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  /** V-4 Tur A: posterin üst geçişi (heroScrim.ts TOP_SCRIM_*). Yükseklik inline. */
  topScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  /**
   * V-4 Tur B: `gap` 16 → 12, eylem yığını 12 → 8, `actionsWrapper`
   * `marginTop` 8 → 0 (toplam −24pt, kurucu onayı). Hero %46 ile birlikte
   * 844pt'de 1 satır başlık + "See all" ya da 2 satır başlık durumunda da
   * Paylaş tab bar'ın üstünde kalır; 2 satır + "See all" hâlâ kaydırma ister.
   */
  body: {
    alignItems: 'center',
    paddingHorizontal: space.lg,
    gap: space.md,
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
  /** V-4 Tur A (V4-D2): etiket her durumda başlığın hemen üstünde. */
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
  },
  /** F2.3: Watch now + kaydet + paylaş tek satırda; ikonlar 44pt (K-54). */
  actionsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  /** Birincil eylem kalan genişliği alır. */
  primarySlot: {
    flex: 1,
  },
  /** Pano / kaydetme onayı — kısa ömürlü, butonların ÜSTÜNDE (sabit sıra). */
  shareNotice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
