/**
 * Sonuç görünümü olayının tek-atış koruması — saf (React/RN importu yok).
 *
 * `spotlight_result_viewed` bir render olayı DEĞİLDİR: bulmaca başına bir kez
 * gider. Re-render, Kaydet durumu değişimi ve `useFocusEffect` kaynaklı
 * yeniden yükleme (Where to Watch'tan geri dönüş dahil) tekrar üretmemeli.
 * Küme `Spotlight/index.tsx`'te `useRef` ile tutulur — sonuç bileşeni yeniden
 * mount olabilir, ebeveyn olmaz.
 *
 * DİKKAT: `seen` DEĞİŞTİRİLİR — ilk çağrıda anahtar kümeye eklenir. Aynı
 * mekanizma, öneki farklı anahtarlarla, tek-seferlik Sentry raporları için de
 * kullanılır (ayrı bir küme ile).
 *
 * Test: `tests/games/spotlightResultViewed.test.ts`.
 */
export function shouldFireResultViewed(seen: Set<string>, puzzleId: string): boolean {
  if (puzzleId === '') return false;
  if (seen.has(puzzleId)) return false;
  seen.add(puzzleId);
  return true;
}
