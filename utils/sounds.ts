/**
 * Platform-safe sound helper for slot machine.
 *
 * expo-av kullanarak ses dosyalarini yukler ve oynatir.
 * Dosya yoksa veya modul yuklenemezse sessizce atlar.
 *
 * TODO: assets/sounds/slot-spin.mp3 ve slot-stop.mp3 eklenince
 *       require('...') satirlarini aktifle.
 */
import { Platform } from 'react-native';
import { logger } from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Audio: Record<string, unknown> | null = null;
try {
  // Dynamic require: expo-av yoksa null kalir
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const av = require('expo-av');
  Audio = av.Audio;
} catch {
  Audio = null;
}

/** Minimal sound interface — expo-av Sound tipine bagimlilik yok */
interface SoundHandle {
  unloadAsync: () => Promise<void>;
  replayAsync: () => Promise<void>;
}

/** Ses yuklu mu flag'i */
let _soundsLoaded = false;
let _spinSound: SoundHandle | null = null;
let _stopSound: SoundHandle | null = null;

/**
 * Ses dosyalarini on-yukle. App baslangi veya ilk roulette acilisinda cagir.
 * Dosya yoksa veya hata olursa sessizce atlar.
 */
export async function preloadSlotSounds(): Promise<void> {
  if (Platform.OS === 'web' || !Audio || _soundsLoaded) return;

  try {
    // TODO: Ses dosyalari eklenince asagidaki satirlari aktifle
    // const { sound: spin } = await Audio.Sound.createAsync(
    //   require('../assets/sounds/slot-spin.mp3'),
    // );
    // _spinSound = spin;
    //
    // const { sound: stop } = await Audio.Sound.createAsync(
    //   require('../assets/sounds/slot-stop.mp3'),
    // );
    // _stopSound = stop;

    _soundsLoaded = true;
    logger.log('[sounds] Slot sounds preloaded (placeholder — no files yet)');
  } catch {
    logger.log('[sounds] Slot sound preload skipped — files not available');
  }
}

/** Slot spin ses efektini oynat */
export async function playSpinSound(): Promise<void> {
  if (!_spinSound) return;
  try {
    await _spinSound.replayAsync();
  } catch {
    // Ses hatas onemsiz
  }
}

/** Slot stop ses efektini oynat */
export async function playStopSound(): Promise<void> {
  if (!_stopSound) return;
  try {
    await _stopSound.replayAsync();
  } catch {
    // Ses hatasi onemsiz
  }
}

/** Bellegi temizle — ekran unmount'ta cagir */
export async function unloadSlotSounds(): Promise<void> {
  try {
    if (_spinSound) await _spinSound.unloadAsync();
    if (_stopSound) await _stopSound.unloadAsync();
  } catch {
    // Cleanup hatasi onemsiz
  }
  _spinSound = null;
  _stopSound = null;
  _soundsLoaded = false;
}
