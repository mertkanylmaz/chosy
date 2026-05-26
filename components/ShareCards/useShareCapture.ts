/**
 * useShareCapture — PNG capture + native share sheet hook.
 *
 * ViewShot ref'i alir, 3x scale'de PNG'ye cevirir, expo-sharing ile paylasirir.
 * Native modüller dev-client build'ında yoksa graceful fallback uygular.
 *
 * Spec: .claude/specs/SOCIAL_SHARE_SPEC.md — useShareCapture Hook
 *
 * Güvenli yükleme stratejisi:
 *   react-native-view-shot: NativeRNViewShot.ts, modül scope'unda
 *     TurboModuleRegistry.getEnforcing() çağırır → modül binary'de yoksa
 *     Invariant Violation fırlatır → Metro ERROR loglar → dev build kırmızı overlay.
 *   expo-sharing: SharingNativeModule.js, modül scope'unda
 *     requireNativeModule('ExpoSharing') çağırır → aynı sorun.
 *
 *   Çözüm: import() tetiklenmeden önce güvenli null-döndüren checker'larla
 *   binary varlığı kontrol edilir. Modül yoksa import() hiç çağrılmaz.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, TurboModuleRegistry, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { i18n } from '@/constants/i18n';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';

// ─── Module cache ─────────────────────────────────────────────────────────────

let _captureRef: typeof import('react-native-view-shot').captureRef | null = null;
let _Sharing: typeof import('expo-sharing') | null = null;

/** Yükleme bir kez yapılır — concurrent share() çağrılarında race condition önlenir */
let _loadPromise: Promise<void> | null = null;

/** Yükleme tamamlandı mı */
let _loaded = false;

/**
 * Native modülleri lazy ve güvenli şekilde yükler.
 *
 * ÖNCE binary'de varlık kontrolü (null döner, throw etmez):
 *   - TurboModuleRegistry.get('RNViewShot')   → react-native-view-shot
 *   - requireOptionalNativeModule('ExpoSharing') → expo-sharing
 *
 * Modül binary'de yoksa import() ÇAĞIRILMAZ → getEnforcing() asla çalışmaz
 * → Invariant Violation yok → kırmızı overlay yok.
 *
 * Modül binary'de varsa import() çağrılır ve tam işlevsellik sağlanır.
 */
async function loadNativeModules(): Promise<{
  captureRef: typeof import('react-native-view-shot').captureRef | null;
  Sharing: typeof import('expo-sharing') | null;
}> {
  if (!_loaded) {
    if (!_loadPromise) {
      _loadPromise = (async () => {

        // ── react-native-view-shot ────────────────────────────────────────────
        // TurboModuleRegistry.get() null döner (throw etmez) modül yoksa.
        // null ise import() çağrılmaz → NativeRNViewShot.ts'deki getEnforcing() asla
        // çalışmaz → Invariant Violation oluşmaz.
        const rnvsNative = TurboModuleRegistry.get<object>('RNViewShot');
        if (rnvsNative != null) {
          try {
            const viewShot = await import('react-native-view-shot');
            const fn = viewShot?.captureRef;
            if (fn != null && typeof fn === 'function') {
              _captureRef = fn;
            } else {
              logger.warn('[share] react-native-view-shot captureRef bulunamadi');
            }
          } catch (e) {
            logger.warn('[share] react-native-view-shot yuklenemedi:', e);
          }
        } else {
          logger.warn('[share] RNViewShot native binary\'de yok — share devre disi (native rebuild gerekli)');
        }

        // ── expo-sharing ──────────────────────────────────────────────────────
        // requireOptionalNativeModule null döner (throw etmez) modül yoksa.
        // null ise import() çağrılmaz → SharingNativeModule.js'deki requireNativeModule()
        // asla çalışmaz → 'ExpoSharing' hatası oluşmaz.
        const sharingNative = requireOptionalNativeModule('ExpoSharing');
        if (sharingNative != null) {
          try {
            const sharing = await import('expo-sharing');
            if (sharing?.isAvailableAsync != null && typeof sharing.isAvailableAsync === 'function') {
              _Sharing = sharing;
            } else {
              logger.warn('[share] expo-sharing isAvailableAsync bulunamadi');
            }
          } catch (e) {
            logger.warn('[share] expo-sharing yuklenemedi:', e);
          }
        } else {
          logger.warn('[share] ExpoSharing native binary\'de yok — share devre disi (native rebuild gerekli)');
        }

        _loaded = true;
      })();
    }
    await _loadPromise;
  }

  return { captureRef: _captureRef, Sharing: _Sharing };
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Hook donus tipi */
export interface UseShareCaptureReturn {
  /** Share card'in render edilecegi ref */
  cardRef: React.RefObject<View | null>;
  /** PNG capture + native share tetikleme */
  share: () => Promise<void>;
  /** Capture islemi devam ediyor mu */
  isCapturing: boolean;
  /** Native share modülleri bu build'da mevcut mu */
  isShareAvailable: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Share card'i PNG'ye cevirir ve native share sheet acar.
 * Capture boyutu: 1080x1350 (3x scale).
 *
 * Native modüller yoksa (dev-client yeniden build edilmemiş) kullanıcıya
 * bilgi mesajı gösterir ve işlemi iptal eder.
 */
export function useShareCapture(): UseShareCaptureReturn {
  const cardRef = useRef<View | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  // isShareAvailable: mount'ta eager yükleme ile doğru state — share butonu
  // native modüller yokken disabled/hidden olarak render edilir
  const [isShareAvailable, setIsShareAvailable] = useState(false);

  // Mount'ta modülleri eager yükle — ilk render'da buton durumu doğru olsun
  useEffect(() => {
    loadNativeModules().then(({ captureRef, Sharing }) => {
      setIsShareAvailable(captureRef !== null && Sharing !== null);
    }).catch(() => {
      setIsShareAvailable(false);
    });
  }, []);

  const share = useCallback(async () => {
    if (!cardRef.current || isCapturing) return;

    // PostHog: app_share_initiated — card_type is determined by caller context
    // TODO: Accept card_type param if distinct tracking per card type is needed
    posthogAnalytics.track('app_share_initiated', { card_type: 'share_card' });

    setIsCapturing(true);
    try {
      const { captureRef, Sharing } = await loadNativeModules();

      // Native modüller bu build'da mevcut değil — graceful degradation
      if (captureRef == null || typeof captureRef !== 'function' || Sharing == null) {
        Alert.alert(
          i18n.t('share.notAvailableTitle'),
          i18n.t('share.notAvailableMessage'),
        );
        return;
      }

      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        width: 1080,
        height: 1350,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        logger.log('[share] Sharing not available on this device');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (err) {
      logger.error('[share] Capture/share error:', err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  return { cardRef, share, isCapturing, isShareAvailable };
}
