/**
 * "Gate tamam" bayrağının modül düzeyi tek örneği (mantık: utils/gateDecision.ts).
 *
 * Yazan: `app/gate.tsx` (karar verildiğinde, yönlendirmeden hemen önce).
 * Okuyan: `app/(tabs)/_layout.tsx` — bayrak kalkana kadar GauntletShell mount
 * edilmez. Cold start başına sıfırlanır (modül belleği).
 */
import { createGateDoneFlag } from '@/utils/gateDecision';

const gateDone = createGateDoneFlag();

export const markGateDone = (): void => gateDone.markDone();
export const isGateDone = (): boolean => gateDone.isDone();
