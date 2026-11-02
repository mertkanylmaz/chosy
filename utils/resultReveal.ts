/**
 * Pro Mode sonuç açılışı (Winner Reveal) gecikme zinciri. Saf, RN yok.
 * Sıra: poster → başlık → meta → gerekçe + alttaki her şey. Hepsi opaklık geçişidir; dokunuşlar
 * hiçbir aşamada engellenmez (yapay bekleme yok). Reduce Motion: gecikme yok, hepsi birlikte çapraz geçiş.
 */
export interface RevealDelays {
  title: number;
  meta: number;
  /** Gerekçe, çipler, CTA ve altındaki bloklar. */
  details: number;
}

export function revealDelays(titleDelay: number, metaDelay: number, reduced: boolean): RevealDelays {
  if (reduced) return { title: 0, meta: 0, details: 0 };
  return { title: titleDelay, meta: titleDelay + metaDelay, details: titleDelay + 2 * metaDelay };
}
