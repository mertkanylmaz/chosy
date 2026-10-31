/**
 * Aşama zamanlaması (MOOD-VEC-2e-2). Saf — ağ yok. Server-Timing başlığı + Sentry breadcrumb biçimi.
 */

export interface TimingEntry {
  name: string
  ms: number
}

export interface Timing {
  /** `fn`i çalıştırır, süresini `name` altında kaydeder (hata fırlatsa da kaydeder). */
  measure<T>(name: string, fn: () => Promise<T>): Promise<T>
  /** Dışarıda ölçülmüş süreyi ekler (paralel işler için). */
  add(name: string, ms: number): void
  entries(): TimingEntry[]
  /** `Server-Timing` başlık değeri: "auth;dur=12.0, claim;dur=80.0". Boşsa ''. */
  header(): string
}

const round1 = (n: number): number => Math.round(n * 10) / 10

export function createTiming(now: () => number = () => performance.now()): Timing {
  const list: TimingEntry[] = []
  return {
    async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const t0 = now()
      try {
        return await fn()
      } finally {
        list.push({ name, ms: round1(now() - t0) })
      }
    },
    add(name, ms) {
      list.push({ name, ms: round1(ms) })
    },
    entries() {
      return [...list]
    },
    header() {
      return list.map((e) => `${e.name};dur=${e.ms.toFixed(1)}`).join(', ')
    },
  }
}

/** Sentry store API `breadcrumbs.values` biçimi (aşama başına bir kayıt). */
export function timingBreadcrumbs(entries: TimingEntry[]): { category: string; message: string; level: 'info'; data: { ms: number } }[] {
  return entries.map((e) => ({ category: 'timing', message: e.name, level: 'info' as const, data: { ms: e.ms } }))
}
