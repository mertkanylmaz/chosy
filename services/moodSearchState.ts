/**
 * Module-level searchId store — React state/ref/effect timing sorununu bypass eder.
 *
 * Problem: MoodContext useState → useRef → useEffect zinciri, React Navigation'ın
 * screen pre-mounting ve render batching davranışı ile race condition yaratıyor.
 * searchId, useFeedManager'ın ilk batch'i yüklediği anda henüz ref'e yazılmamış
 * olabiliyor (useEffect render SONRASI çalışır).
 *
 * Çözüm: searchId'yi module-level değişkende tut. setState/useRef/useEffect
 * gerektirmez, set edildiği anda okunabilir.
 *
 * Kullanım:
 *   mood.tsx:        setPendingSearchId(searchId)
 *   useFeedManager:  consumePendingSearchId()  // bir kez okur, null'a sıfırlar
 */

import { posthogAnalytics } from './posthog';

/** Son parse-mood'dan dönen mood_searches row ID */
let _pendingSearchId: string | null = null;

/**
 * searchId'yi kaydeder — parseMood başarılı olduğunda çağrılır.
 * Module-level: React render cycle'ından bağımsız, anında erişilebilir.
 */
export function setPendingSearchId(id: string | null): void {
  _pendingSearchId = id;
  // DEBUG: setPendingSearchId çağrıldığını doğrula
  posthogAnalytics.track('pending_search_id_set', {
    searchId: id ?? null,
    isNull: id === null,
    isUndefined: id === undefined,
    type: typeof id,
  });
}

/**
 * searchId'yi okur ve sıfırlar (consume pattern).
 * İlk batch yüklendikten sonra tekrar kullanılmaması için null'a çekilir.
 */
export function consumePendingSearchId(): string | null {
  const id = _pendingSearchId;
  _pendingSearchId = null;
  return id;
}

/**
 * Mevcut searchId'yi okur (sıfırlamadan).
 * Debug/telemetri amaçlı.
 */
export function peekPendingSearchId(): string | null {
  return _pendingSearchId;
}

// ─── Search Keywords Store ─────────────────────────────────────────────────

/**
 * LLM'den çıkarılan tematik keyword'ler — match_films_v3 keyword overlap boost için.
 * searchId'den farklı olarak consume edilmez (tüm batch'lerde geçerli).
 * Yeni mood search'te üzerine yazılır.
 */
let _searchKeywords: string[] = [];

/**
 * search_keywords'ü kaydeder — parseMood başarılı olduğunda çağrılır.
 */
export function setSearchKeywords(keywords: string[]): void {
  _searchKeywords = keywords;
}

/**
 * Mevcut search_keywords'ü okur (sıfırlamadan — tüm batch'ler için geçerli).
 */
export function getSearchKeywords(): string[] {
  return _searchKeywords;
}

/**
 * search_keywords'ü temizler — yeni mood başlatıldığında çağrılır.
 */
export function clearSearchKeywords(): void {
  _searchKeywords = [];
}
