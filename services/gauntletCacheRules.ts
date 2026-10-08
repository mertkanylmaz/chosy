/**
 * Gauntlet önbelleği: "bu kopya mevcut cycle'ın mı" kararı. SAF: ağ, depolama
 * ve saat yok (Deno testi: tests/gauntlet/gauntletCacheRules.test.ts).
 * Import'suz tutulur ki Deno `@/` alias'ı olmadan yükleyebilsin.
 *
 * Karar SUNUCUNUN söylediği geçiş anına bakar (`next_cycle_at`), cihaz yerel
 * tarihine DEĞİL: cycle sınırı yerel 18:00'dir ve cycle tarihini sunucu
 * hesaplar (F1). Yerel takvim günüyle karşılaştırmak, gece yarısı ile 18:00
 * arasında bugünün kopyasını "bugünün değil" diye etiketlerdi.
 */

/** Yanıtın nereden geldiği. `network` dışındakiler yerel kopyadır. */
export type GauntletSource = 'network' | 'cache_today' | 'cache_stale';

export type CacheSource = Exclude<GauntletSource, 'network'>;

/**
 * `cache_today`: kopyanın `next_cycle_at`'i hâlâ gelecekte.
 * `cache_stale`: geçiş anı geçmiş — ya da kopyada `next_cycle_at` yok / okunamıyor
 * (F1 öncesi yazılmış kayıt). İyimser varsayım YAPILMAZ.
 */
export function cacheSourceFor(nextCycleAt: string | undefined, now: Date): CacheSource {
  if (!nextCycleAt) return 'cache_stale';
  const boundary = Date.parse(nextCycleAt);
  if (Number.isNaN(boundary)) return 'cache_stale';
  return now.getTime() < boundary ? 'cache_today' : 'cache_stale';
}
