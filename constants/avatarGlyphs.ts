/**
 * Profil avatarı — saklanan değer → Phosphor glif eşleme tablosu (tek kaynak).
 *
 * V-1 Tur 3 (CTO D8): 9 PNG 3D asset yerine Phosphor duotone glifleri.
 * Saklanan değer FORMATI DEĞİŞMEDİ: AsyncStorage'da hâlâ aşağıdaki 9 id'den
 * biri durur. Bu yüzden eski kayıtlar için veri dönüşümü gerekmez — yalnızca
 * anahtar taşınır (`utils/avatarStorage.ts`).
 *
 * Phosphor'da birebir karşılığı olmayan üç prop için en yakın glif seçildi
 * (onaylı): yönetmen sandalyesi → `Chair`, stüdyo ışığı → `Lamp`,
 * tripod → `Aperture`.
 *
 * Not: PNG'leri (`AvatarIcons`) kullanan eski `app/setup-profile.tsx`
 * Sprint 4b'de silindi; `users.avatar_url`'e yazdığı id'ler yukarıdaki 9 id'ydi.
 */

import type { ComponentType } from 'react';
import {
  Aperture,
  Chair,
  FilmReel,
  FilmSlate,
  Lamp,
  Megaphone,
  Microphone,
  MonitorPlay,
  VideoCamera,
} from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';

/** Saklanan avatar değerleri — modal sırası bu dizinin sırasıdır. */
export const AVATAR_IDS = [
  'clapperboard',
  'pro_camera',
  'director_chair',
  'film_reel',
  'megaphone',
  'boom_mic',
  'studio_light',
  'edit_monitor',
  'tripod',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

interface AvatarGlyph {
  Icon: ComponentType<IconProps>;
  labelKey: string;
}

export const AVATAR_GLYPHS: Record<AvatarId, AvatarGlyph> = {
  clapperboard:   { Icon: FilmSlate,   labelKey: 'profile.avatarClapperboard' },
  pro_camera:     { Icon: VideoCamera, labelKey: 'profile.avatarProCamera' },
  director_chair: { Icon: Chair,       labelKey: 'profile.avatarDirectorChair' },
  film_reel:      { Icon: FilmReel,    labelKey: 'profile.avatarFilmReel' },
  megaphone:      { Icon: Megaphone,   labelKey: 'profile.avatarMegaphone' },
  boom_mic:       { Icon: Microphone,  labelKey: 'profile.avatarBoomMic' },
  studio_light:   { Icon: Lamp,        labelKey: 'profile.avatarStudioLight' },
  edit_monitor:   { Icon: MonitorPlay, labelKey: 'profile.avatarEditMonitor' },
  tripod:         { Icon: Aperture,    labelKey: 'profile.avatarTripod' },
};

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}
