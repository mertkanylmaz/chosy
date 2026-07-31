/**
 * Oyun ekranlarinin yerlesim sozlesmesi.
 *
 * ── SORUN (30 Tem 2026) ───────────────────────────────────────────────────
 * `GameShell` icerik alanina zaten `paddingHorizontal: Theme.spacing.md`
 * veriyor (components/games/GameShell/styles.ts). Uc oyun bunun USTUNE kendi
 * yatay padding'ini ekledi ve izgara genisliklerini `SCREEN_W - 32` varsayarak
 * hesapladi; gercek alan `SCREEN_W - 64` idi. Sonuc:
 *   - Detective: 12 kart 3 sutun yerine 2 sutuna dustu
 *   - CineMetrics: 6. sutun (Ulke) ekran disinda kirpildi
 *   - Imposter: izgara 1 sutuna dustu, tasan icerik erisilemez oldu
 *
 * ── SOZLESME ──────────────────────────────────────────────────────────────
 * 1. Yatay 16px padding'i GameShell verir. Oyunlar `content` icinde
 *    `paddingHorizontal` EKLEMEZ.
 * 2. Genislik hesabi yapan her oyun `gameContentWidth()` kullanir; ham
 *    `SCREEN_W - 32` yazmaz.
 * 3. Tam kanamali (edge-to-edge) ekran gereken yerde GameShell'e
 *    `contentPadding={false}` verilir ve padding'i ekran kendi yonetir.
 *
 * Dogru desen zaten projede vardi: components/games/Spotlight/styles.ts —
 * `STILL_W = SCREEN_W - Theme.spacing.md * 2`, scrollContent'te yatay padding
 * yok. Bu dosya o deseni tek kaynaga tasir.
 *
 * ── StyleSheet.create ZORUNLULUGU ile iliski ──────────────────────────────
 * Proje kurali "inline style YASAK" gecerliligini korur. Netlestirme:
 *   - Gorsel ozellikler (renk, kenarlik, radius, tipografi, bosluk) DAIMA
 *     `StyleSheet.create` icinde tanimlanir.
 *   - Yalnizca OLCUM (`width`/`height`) calisma zamaninda hesaplanip dizi ile
 *     birlestirilir: `style={[styles.card, { width }]}`.
 * Bu desenin mevcut ornegi: components/Home/MoodCardGrid/index.tsx.
 */
import { Theme } from '@/constants/theme';

/** GameShell icerik alaninin verdigi yatay padding (tek kenar). */
export const GAME_CONTENT_PADDING = Theme.spacing.md;

/**
 * GameShell icinde bir oyunun gercekten kullanabilecegi genislik.
 *
 * @param screenWidth - Ekran genisligi (`useWindowDimensions().width` tercih
 *                      edilir; stil dosyalarinda modul sabiti de kabul edilir)
 */
export function gameContentWidth(screenWidth: number): number {
  return screenWidth - GAME_CONTENT_PADDING * 2;
}

/**
 * N sutunlu bir izgarada tek ogenin genisligi.
 *
 * Asagi yuvarlar — toplam genislik konteynerden buyuk cikmasin diye. Bir
 * pikselin altinda bosluk kalabilir, tasma kalmaz.
 *
 * @param containerWidth - Izgarayi saran alanin genisligi
 * @param columns - Sutun sayisi (>= 1)
 * @param gap - Sutunlar arasi bosluk
 */
export function gridItemWidth(
  containerWidth: number,
  columns: number,
  gap: number,
): number {
  if (columns < 1) return containerWidth;
  return Math.floor((containerWidth - gap * (columns - 1)) / columns);
}
