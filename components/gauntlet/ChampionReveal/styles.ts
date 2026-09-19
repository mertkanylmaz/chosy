/**
 * ChampionReveal stilleri — DESIGN_OS §10.2: tek poster ortalanmış,
 * display-xl başlık (Archivo Expanded — bu ekrandaki TEK kullanım),
 * meta satırı Martian Mono. Drop shadow YOK (§4.3).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  /**
   * C.9b-UI G11: zemin ŞEFFAF. Eskiden opak `ink` boyuyordu ve arkasındaki
   * ışık sızmasını tamamen örtüyordu — §10.2 "sızma burada en güçlü" derken
   * Champion ekranı pratikte düz siyahtı (cihaz görüntüsüyle doğrulandı:
   * baştan aşağı turkuaz bir poster, zemin nötr siyah).
   *
   * Zemini artık `GauntletShell`'in dış root'u boyuyor (`ink`), sızma da
   * orada. Buraya renk koymak o katmanı yeniden örter.
   */
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: space.lg,
    gap: space.lg,
  },
  posterWrapper: {
    width: '58%',
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    overflow: 'hidden',
    backgroundColor: color.surface.raised,
  },
  /** Dokunma alanı afişin TAMAMI — ayrı bir buton çizilmez (§10.2 sessizlik). */
  posterTouchable: {
    width: '100%',
    height: '100%',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  kicker: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  /**
   * Baslik kademesi — C.9b-UI C8.
   *
   * Eskiden `numberOfLines={2} adjustsFontSizeToFit` vardi:
   * `minimumFontScale` verilmedigi icin RN varsayilani 0.01'e kadar
   * kuculebiliyordu. Yani 68 karakterlik bir baslik teorik olarak
   * okunamayacak kadar kucuk cizilebilirdi ve hangi boyutta cizilecegi
   * CIHAZA gore degisiyordu — ayni film iki telefonda farkli gorunur.
   *
   * Artik kademe DETERMINISTIK: uzunluk esigine gore 40 -> 32 -> 28.
   * En fazla 3 satir. Runtime autoscale YOK.
   *
   * Esikler havuz olcumunden (19 Eyl, n=1907 core+extended):
   *   >25 karakter: 242 film (%12,7)
   *   >35 karakter:  64 film
   *   en uzun:       68 karakter
   *     ("Dr. Strangelove or: How I Learned to Stop Worrying...")
   *
   * 32 ve 28 `display-l`/`display-m` DEGIL (onlar 30/22) — C8 bu uc
   * degeri acikca kilitliyor. Aile ve letterSpacing orani korunuyor.
   */
  title: {
    ...type['display-xl'],
    color: color.text.primary,
    textAlign: 'center',
  },
  titleMedium: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.6,
  },
  titleSmall: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1.4,
  },
  metaLine: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'center',
  },
  /** "Paylaş · Kapat" — sessiz eylemler, cam yok (§4.4 muafiyet listesi). */
  actionsWrapper: {
    marginTop: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  actionSeparator: {
    ...type.caption,
    color: color.text.secondary,
    opacity: 0.7,
  },
  /**
   * C2e durum satırı — "bölgende akışta yok" / "yüklenemedi". smoke, tek
   * satır, birincil eylemin ÜSTÜNDE. Özür dilemez, durumu söyler (§15.2).
   */
  stateLine: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },
  /** Pano onayı — kısa ömürlü, eylemin ÜSTÜNDE (düzen zıplamasın diye sabit sıra) */
  shareNotice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
