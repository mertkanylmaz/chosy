import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'remote_config_cache';
const CACHE_TTL_MS = 5 * 60 * 1000;
const SAFE_DEFAULTS = { use_match_films_v2: true, use_hybrid_recommendation: false, use_llm_reranker: false } as const;

type ConfigKey = keyof typeof SAFE_DEFAULTS;
let memoryCache: { values: Record<string, any>; fetchedAt: number } | null = null;

export const remoteConfig = {
  async hydrate(): Promise<void> {
    try {
      const { data, error } = await supabase.from('app_config').select('key, value');
      if (error) throw error;
      const values: Record<string, any> = {};
      for (const row of data ?? []) values[row.key] = row.value;
      memoryCache = { values, fetchedAt: Date.now() };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
    } catch (e) {
      console.error('[remoteConfig] KRITIK: hydrate başarısız');
      if (e instanceof Error) console.error('[remoteConfig] Error message:', e.message);
      console.error('[remoteConfig] Error:', JSON.stringify(e));

      // Cache fallback — son başarılı config'i AsyncStorage'dan yükle.
      // Network/Supabase hatası durumunda kullanıcı SAFE_DEFAULTS yerine
      // son bilinen doğru config'i alır. Sessiz fallback DEĞİL — error log
      // yukarıda atıldı, sadece graceful degradation.
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) memoryCache = JSON.parse(cached);
      } catch {
        // Cache de yoksa get() SAFE_DEFAULTS'a düşer — son fallback
      }
    }
  },

  get<K extends ConfigKey>(key: K): typeof SAFE_DEFAULTS[K] {
    const cachedVal = memoryCache?.values?.[key];
    if (cachedVal !== undefined) return cachedVal;
    return SAFE_DEFAULTS[key];
  },
};
