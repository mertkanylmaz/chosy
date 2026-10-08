/**
 * useBelowHeight — şampiyon hero'sunun ALTINDAKİ içeriğin (Spotlight kartı,
 * sayaç satırı, arşiv bağlantısı) ölçülen toplam yüksekliği. F2.3.
 *
 * Her parça kendi `onLayout`'unu bağlar; hero yüksekliği bu toplamla
 * hesaplanır (`ChampionReveal/heroHeight.ts`). Parçalar birbirinin içinde
 * değil — kart koordinatları (`useChampionAsk`) kaydırma içeriğine göre kalır.
 */
import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export type BelowPart = 'card' | 'cycle' | 'archive';

export interface BelowHeight {
  /** Çizilmeyen parçalar (ör. kart yok) sayılmaz. */
  total: (rendered: Record<BelowPart, boolean>) => number;
  onLayoutOf: (part: BelowPart) => (e: LayoutChangeEvent) => void;
}

/**
 * @param initialCard kartın ölçülmeden önceki yer ayırma yüksekliği — kart
 *   giriş gecikmesiyle mount edildiğinde hero zıplamasın.
 */
export function useBelowHeight(initialCard: number): BelowHeight {
  const [heights, setHeights] = useState<Record<BelowPart, number>>({
    card: initialCard,
    cycle: 0,
    archive: 0,
  });

  const onLayoutOf = useCallback(
    (part: BelowPart) => (e: LayoutChangeEvent) => {
      const next = Math.round(e.nativeEvent.layout.height);
      setHeights((prev) => (prev[part] === next ? prev : { ...prev, [part]: next }));
    },
    [],
  );

  const total = useCallback(
    (rendered: Record<BelowPart, boolean>) =>
      (rendered.card ? heights.card : 0) +
      (rendered.cycle ? heights.cycle : 0) +
      (rendered.archive ? heights.archive : 0),
    [heights],
  );

  return { total, onLayoutOf };
}
