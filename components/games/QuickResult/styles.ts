/**
 * QuickResult stilleri.
 *
 * Olculer bilerek ResultCard'dan kucuk: sonuc ekrani oyunun kendisinden
 * uzun surmemeli.
 *
 * Tur 2 (30 Tem 2026):
 * - "tek ekran, scroll yok" varsayimi kirildi. Kesif karti acilinca icerik
 *   ekrandan tasip kirpiliyordu; artik ScrollView, kisa icerikte hala
 *   dikeyde ortali duruyor.
 * - Serif film adi sans-serif oldu (geri bildirim: "gazete mansetli tutarsizlik").
 *
 * 1 Agu 2026 — odul katmani:
 * - Renkler artik ALTIN. Bu bilesen yalnizca Imposter'da kullaniliyor ama odul
 *   ekrani, yani oynanis temasini DEGIL Chosy'nin kimlik sabitini konusur.
 *   Ayrinti: index.tsx dosya basi.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  /** Paylasim karti yakalama alani — ekran disinda tutulur */
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  scroll: {
    flex: 1,
  },
  /** flexGrow + center: kisa sonuc ortali, uzun sonuc kayiyor */
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },

  // ── Film ──────────────────────────────────────────────────────────────
  /** Golge overflow ile ayni dugumde calismaz — sarmalayici tasiyor */
  posterWrap: {
    borderRadius: Theme.borderRadius.lg,
    shadowColor: Colors.shadowBlack,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.cardSolid,
  },
  /** Sans-serif — pilot boyunca Imposter'da serif kullanilmiyor */
  filmTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: Theme.fonts.inter,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
  },
  filmYear: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },

  // ── Skor ──────────────────────────────────────────────────────────────
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  /**
   * Kazanilan turun altin halesi.
   *
   * shadowColor DUZ renk olmali: `Colors.goldGlow` zaten rgba 0.18 tasiyor,
   * shadowOpacity ile carpilinca hale gorunmez oluyordu. Eski `selectGlow`
   * alfayi kendi tasiyip shadowOpacity:1 kullaniyordu — burada siddet
   * shadowOpacity'ye tasindi.
   */
  dotHit: {
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 10,
    elevation: 6,
  },
  scoreLine: {
    ...Theme.typography.body,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  scoreLineSolved: {
    color: Colors.gold,
  },

  // ── XP + DNA tek satir ────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 7,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSeal,
  },
  metaText: {
    ...Theme.typography.caption,
    fontWeight: '700',
    color: Colors.gold,
  },
  metaDivider: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },
  metaDna: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },

  // ── Streak ────────────────────────────────────────────────────────────
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },

  // ── Kesif koprusu — dar sarmalayici ───────────────────────────────────
  funnelWrap: {
    alignSelf: 'stretch',
    marginTop: Theme.spacing.xs,
  },

  // ── Aksiyonlar ────────────────────────────────────────────────────────
  actions: {
    alignSelf: 'stretch',
    alignItems: 'stretch',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  /** Birincil eylem — altin gradyan dolgu + yukselti (siddet: dotHit ile ayni gerekce) */
  shareButton: {
    borderRadius: Theme.borderRadius.full,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 10,
  },
  shareFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.full,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareText: {
    fontSize: 15,
    fontFamily: Theme.fonts.inter,
    fontWeight: '700',
    // Altın zeminde koyu metin (1 Ağu 2026) — beyaz, gold #D4A843 üstünde
    // kontrast eşiğini geçmiyordu.
    color: Colors.textOnAccent,
  },
  /** Ikincil eylem — cam yuzey */
  hubButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.chromeGlassBorder,
    backgroundColor: Colors.chromeGlassSurface,
  },
  hubText: {
    fontSize: 14,
    fontFamily: Theme.fonts.inter,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
