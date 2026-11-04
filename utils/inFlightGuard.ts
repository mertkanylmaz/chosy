/**
 * Uçuştaki istek kilidi (Mood Gauntlet: Another four ve Calmer / More intense aynı kilidi paylaşır).
 * Saf, RN / ağ yok. Kilit sahibini çağıranın verdiği `runId` ile tutar:
 *  - tryAcquire(id): kilit boşsa alır (true), doluysa dokunmaz (false).
 *  - release(id):    yalnız sahip `id` ise açar; iptal edilmiş eski isteğin finally'si yeni isteğin kilidini AÇMAZ.
 *  - clear():        oturum sıfırlanır / yeni arama başlar → kilit sahibi ne olursa olsun düşer.
 */
export interface InFlightGuard {
  tryAcquire(id: number): boolean;
  release(id: number): void;
  clear(): void;
}

export function createInFlightGuard(): InFlightGuard {
  let owner: number | null = null;
  return {
    tryAcquire(id: number): boolean {
      if (owner !== null) return false;
      owner = id;
      return true;
    },
    release(id: number): void {
      if (owner === id) owner = null;
    },
    clear(): void {
      owner = null;
    },
  };
}
