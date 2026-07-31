/**
 * ImposterPilot — GEÇİCİ görsel dil token'ları.
 *
 * ── BU DOSYA NEDEN VAR ────────────────────────────────────────────────────
 * `DESIGN_SYSTEM.md` "Festival Layer" (29 Tem 2026) oyun ekranları için
 * bağlayıcı bir doktrin tanımlıyor:
 *   Kural 1 — tek altın vurgu. "Reddedilen yön: oyun başına neon renk."
 *   Kural 5 — "Kenarlık, gölge değil. Neon glow yok."
 * Detective bu kural gereği yakın zamanda teal'den altına çevrildi.
 *
 * Bu pilot o iki kuralı BİLEREK esnetiyor. Amaç doktrini değiştirmek değil,
 * kullanıcının iki dili aynı cihazda yan yana görüp karar verebilmesi.
 *
 * ── TUR 2 (30 Tem 2026) ───────────────────────────────────────────────────
 * Birinci turda yalnız vurgu rengi değişmişti; ekran hâlâ "zifiri siyah üstüne
 * opak kutular" idi. Geri bildirim maddeleri ve bu dosyadaki karşılıkları:
 *   "arka plan zifiri siyah"   → `ambient*` — derin lacivert gradyan + parıltı
 *   "kartlar opak, nefes yok"  → `glassSurface` / `glassBorder` (BlurView üstü)
 *   "seçim belirsiz"           → `select*` — neon camgöbeği kenar + hale
 *   "soru kayboluyor"          → `questionGradient` — parlayan mor→pembe etiket
 *   "progress bar sönük"       → `progressGradient`
 *
 * ── KAPSAM VE SÜRE ────────────────────────────────────────────────────────
 * - Yalnızca Imposter (oynanış ekranı + yalnız Imposter'ın kullandığı
 *   `components/games/QuickResult`). Diğer beş oyun mevcut dilde kalır.
 * - `constants/Colors.ts` ve `DESIGN_SYSTEM.md` bu iş kapsamında DEĞİŞTİRİLMEZ.
 *   Aşağıdaki neon/cam değerleri Colors.ts'te YOK ve bilerek buraya, pilotun
 *   kendi dosyasına yazıldı — global palet pilot kararı verilmeden kirlenmesin.
 *
 * ── KARAR SONRASI ─────────────────────────────────────────────────────────
 * KABUL  → DESIGN_SYSTEM.md Kural 1 ve 5 güncellenir, bu token'lar global
 *          katmana taşınır ve diğer oyunlar sırayla geçirilir.
 * RED    → `components/games/ImposterPilot/` dizini silinir, `imposter.tsx`
 *          kendi oynanış JSX'ine geri döner, `QuickResult` bu dosyaya olan
 *          import'unu bırakıp `Colors`/`Theme`'e döner ve `GameShell`'in
 *          `background` + `progressGradient` prop'ları kaldırılır (ikisi de
 *          opsiyonel, verilmediğinde davranış değişmiyor).
 *
 * Karar verilmeden bu token'lar başka bir oyunda kullanılmamalı — doktrin
 * sessizce çürümesin.
 */
import { Colors } from '@/constants/Colors';

export const PilotTokens = {
  // ─── Ambiyans: derin gece mavisi + neon parıltı ────────────────────────
  /**
   * Ekran zemini. Colors.background (#0A0A0F) nötr siyaha çok yakın; burada
   * yukarıdan aşağı ısınan bir gece mavisi kullanılıyor ki cam yüzeyler
   * arkalarında bir şey olduğunu hissettirsin.
   */
  ambientBase: ['#0B1026', '#0A0C1C', '#07080F'] as const,
  /** Sol üstte mor parıltı — hero'nun arkasına denk gelir */
  ambientGlowViolet: ['rgba(139,92,246,0.30)', 'rgba(139,92,246,0)'] as const,
  /** Sağ altta camgöbeği parıltı — ızgaranın arkasına denk gelir */
  ambientGlowCyan: ['rgba(34,211,238,0.20)', 'rgba(34,211,238,0)'] as const,

  // ─── Cam yüzey (glassmorphism) ─────────────────────────────────────────
  /** BlurView'ın ÜSTÜNE binen ince beyaz yıkama — camın kendi kalınlığı */
  glassSurface: 'rgba(255,255,255,0.06)',
  /** Cam kenarı — üstten gelen ışığın yakaladığı hat */
  glassBorder: 'rgba(255,255,255,0.16)',
  /** Cam altına düşen gölge — spatial depth */
  glassShadow: '#000000',
  /** BlurView desteklenmeyen/az performanslı durumda düşülen opak zemin */
  glassFallback: 'rgba(20,24,48,0.86)',

  // ─── Seçim: neon camgöbeği ─────────────────────────────────────────────
  /** Seçili kart kenarlığı ve tik rengi */
  selectAccent: '#22D3EE',
  /** Seçili kart halesi (shadowColor) */
  selectGlow: 'rgba(34,211,238,0.75)',
  /** Seçili kartın üstüne binen ince renk yıkaması */
  selectWash: 'rgba(34,211,238,0.12)',

  // ─── Vurgu: soru etiketi ve round rozeti ───────────────────────────────
  /** Soru etiketi zemini — mor → pembe */
  questionGradient: ['#8B5CF6', '#EC4899'] as const,
  /** Soru etiketinin halesi */
  questionGlow: 'rgba(168,85,247,0.55)',
  /** Round rozeti metni/kenarı */
  roundAccent: '#C4B5FD',
  roundWash: 'rgba(139,92,246,0.18)',

  // ─── İlerleme çubuğu ───────────────────────────────────────────────────
  progressGradient: ['#8B5CF6', '#EC4899'] as const,
  progressEmpty: 'rgba(255,255,255,0.10)',

  // ─── Scrim'ler ─────────────────────────────────────────────────────────
  /**
   * Hero posterinin altına inen gradyan. Artık düz siyaha değil ambiyansın
   * üst tonuna iniyor — poster ekranın içinden çıkıyormuş gibi dursun.
   */
  heroScrim: ['transparent', 'rgba(11,16,38,0.55)', '#0B1026'] as const,
  /** Portre kartın altındaki isim şeridi — kesme yerine okunur zemin */
  cardScrim: ['transparent', 'rgba(7,10,24,0.55)', 'rgba(7,10,24,0.94)'] as const,

  // ─── Sonuç ekranı (QuickResult) ────────────────────────────────────────
  /** Kazanılan tur işareti */
  scoreHit: '#22D3EE',
  /** Kaçırılan tur işareti */
  scoreMiss: 'rgba(255,255,255,0.22)',
  /** XP rozeti — mor, altın değil */
  xpAccent: '#A78BFA',
  xpWash: 'rgba(139,92,246,0.16)',
  /** Seri (streak) rozeti */
  streakAccent: '#FB7185',

  // ─── Değişmeyenler ─────────────────────────────────────────────────────
  /** Fotoğrafı olmayan aktör kartının zemini */
  photoEmpty: Colors.bgElevated,
} as const;
