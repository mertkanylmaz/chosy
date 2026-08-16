/**
 * Gauntlet paylaşım metni — DESIGN_OS §16 madde 12, PRODUCT_OS §3.6.
 *
 * METİN ÖNCELİKLİ, tek bir görsel üretilmez:
 *   - Film still'i (`backdrop_url`) paylaşımda ASLA kullanılmaz (PRODUCT_OS
 *     §7.5 telif kararı).
 *   - Poster de kullanılmaz — paylaşılan şey braketin kendisi, film görseli
 *     değil. Bu yüzden `react-native-view-shot` bu yolda hiç devreye girmez.
 *
 * Dil (DESIGN_OS §15): sakin, kesin, kısa. Övgü yok, emoji yok, çağrı yok.
 * Marka yalnızca başlıktaki kelime markasında geçer.
 *
 * Saf fonksiyon — hiçbir yan etkisi yok, test edilebilir.
 */
import type { Locale } from '@/constants/i18n';

/** Tamamlanmış tek bir tur: kazanan ve elenen filmin ADLARI. */
export interface ShareRound {
  round: 1 | 2 | 3;
  winnerTitle: string;
  loserTitle: string;
}

export interface GauntletShareInput {
  championTitle: string;
  championYear: number;
  /** `DailyGauntlet.date` — YYYY-MM-DD. */
  date: string;
  /**
   * Bu oturumda ÖLÇÜLEN tur zinciri. Boş dizi geçerli bir durumdur: resume
   * yolunda (uygulama şampiyon ekranıyla açıldı) istemcide tur geçmişi YOKTUR
   * ve backend bunu taşımaz (`GauntletProgress` kilitli sözleşme, skor/gerekçe
   * taşımaz). Bu durumda braket satırları yazılmaz — uydurulmaz.
   */
  rounds: ShareRound[];
  locale: Locale;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/**
 * YYYY-MM-DD → yerel okunuş. Beklenmedik biçimde gelen değer OLDUĞU GİBİ
 * yazılır: tarihi uydurmaktansa ham değeri göstermek dürüst olandır.
 */
function formatShareDate(iso: string, locale: Locale): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  return locale === 'tr' ? `${day}.${month}.${year}` : `${month}/${day}/${year}`;
}

/**
 * Panoya kopyalanacak/paylaşılacak düz metin.
 *
 * Biçim (TR örneği):
 *
 *   CHOSY · 16.08.2026
 *
 *   Tur 1: Heat > Zodiac
 *   Tur 2: Heat > The Insider
 *   Tur 3: Heat > Michael Clayton
 *
 *   Bugünün filmi: Heat (1995)
 */
export function buildGauntletShareText(input: GauntletShareInput): string {
  const { championTitle, championYear, date, rounds, locale, t } = input;

  const header = t('gauntlet.share.header', { date: formatShareDate(date, locale) });
  const champion = t('gauntlet.share.championLine', {
    title: championTitle,
    year: championYear,
  });

  const bracket = rounds.map((r) =>
    t('gauntlet.share.roundLine', {
      round: r.round,
      winner: r.winnerTitle,
      loser: r.loserTitle,
    }),
  );

  const blocks = bracket.length > 0 ? [header, bracket.join('\n'), champion] : [header, champion];

  return blocks.join('\n\n');
}
