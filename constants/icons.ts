/**
 * AppIcons — Merkezi ikon kaynağı.
 *
 * Tüm custom PNG ikonların tek require noktası.
 * Metro bundler statik path gerektirdiğinden her require ayrı satırda.
 *
 * Kullanım:
 *   import { EmotionIcons, ArchetypeIcons, MoodIcons } from '@/constants/icons';
 *   <Image source={EmotionIcons.joy} style={{ width: 24, height: 24 }} />
 */

import type { ImageSourcePropType } from 'react-native';

// ─── Duygu İkonları (Single Source of Truth) ──────────────────────────────────
// Hem MoodProfileResult hem TasteDNA bu map'i kullanır.

export const EmotionIcons: Record<
  'joy' | 'sadness' | 'fear' | 'anger' | 'surprise' | 'disgust' | 'anticipation' | 'trust',
  ImageSourcePropType
> = {
  joy:          require('../assets/icons/emotions/joy.png'),
  sadness:      require('../assets/icons/emotions/sadness.png'),
  fear:         require('../assets/icons/emotions/fear.png'),
  anger:        require('../assets/icons/emotions/anger.png'),
  surprise:     require('../assets/icons/emotions/surprise.png'),
  disgust:      require('../assets/icons/emotions/disgust.png'),
  anticipation: require('../assets/icons/emotions/anticipation.png'),
  trust:        require('../assets/icons/emotions/trust.png'),
};

// ─── Arketip İkonları ─────────────────────────────────────────────────────────
// archetypes.ts'deki ID (1-12) sırasıyla eşleşir.

export const ArchetypeIcons: Record<number, ImageSourcePropType> = {
  1:  require('../assets/icons/archetypes/adrenaline_junkie.png'),
  2:  require('../assets/icons/archetypes/mind_bender.png'),
  3:  require('../assets/icons/archetypes/the_empath.png'),
  4:  require('../assets/icons/archetypes/the_optimist.png'),
  5:  require('../assets/icons/archetypes/the_romantic.png'),
  6:  require('../assets/icons/archetypes/the_dark_soul.png'),
  7:  require('../assets/icons/archetypes/the_aesthete.png'),
  8:  require('../assets/icons/archetypes/the_cinephile.png'),
  9:  require('../assets/icons/archetypes/the_thrill.png'),
  10: require('../assets/icons/archetypes/the_escapist.png'),
  11: require('../assets/icons/archetypes/the_detective.png'),
  12: require('../assets/icons/archetypes/the_visionary.png'),
};

// ─── Hızlı Mood Chip İkonları ─────────────────────────────────────────────────

export const MoodIcons: Record<string, ImageSourcePropType> = {
  rainy:     require('../assets/icons/moods/rainy.png'),
  date:      require('../assets/icons/moods/date_night.png'),
  thrill:    require('../assets/icons/moods/thrill.png'),
  laugh:     require('../assets/icons/moods/laugh.png'),
  deep:      require('../assets/icons/moods/deep.png'),
  nostalgia: require('../assets/icons/moods/nostalgia.png'),
  chill:     require('../assets/icons/moods/chill.png'),
  cry:       require('../assets/icons/moods/cry.png'),
};

// ─── Gamification İkonları ────────────────────────────────────────────────────

export const GamificationIcons = {
  milestone100: require('../assets/icons/gamification/milestone_100.png') as ImageSourcePropType,
  streakPeak:   require('../assets/icons/gamification/streak_peak.png')   as ImageSourcePropType,
  streakActive: require('../assets/icons/gamification/streak_active.png') as ImageSourcePropType,
  curator:      require('../assets/icons/gamification/curator.png')       as ImageSourcePropType,
};

// ─── Avatar İkonları ──────────────────────────────────────────────────────────

export const AvatarIcons = {
  clapperboard:   require('../assets/icons/avatars/clapperboard.png')   as ImageSourcePropType,
  pro_camera:     require('../assets/icons/avatars/pro_camera.png')     as ImageSourcePropType,
  director_chair: require('../assets/icons/avatars/director_chair.png') as ImageSourcePropType,
  film_reel:      require('../assets/icons/avatars/film_reel.png')      as ImageSourcePropType,
  megaphone:      require('../assets/icons/avatars/megaphone.png')      as ImageSourcePropType,
  boom_mic:       require('../assets/icons/avatars/boom_mic.png')       as ImageSourcePropType,
  studio_light:   require('../assets/icons/avatars/studio_light.png')   as ImageSourcePropType,
  edit_monitor:   require('../assets/icons/avatars/edit_monitor.png')   as ImageSourcePropType,
  tripod:         require('../assets/icons/avatars/tripod.png')         as ImageSourcePropType,
};

// ─── TasteDNA İkonları ────────────────────────────────────────────────────────

export const TasteDNAIcons = {
  dnaHeader:    require('../assets/icons/taste_dna/dna_header.png')    as ImageSourcePropType,
  cardEnergy:   require('../assets/icons/taste_dna/card_energy.png')   as ImageSourcePropType,
  cardFilmTaste:require('../assets/icons/taste_dna/card_film_taste.png') as ImageSourcePropType,
  cardGenre:    require('../assets/icons/taste_dna/card_genre.png')    as ImageSourcePropType,
  stats:        require('../assets/icons/taste_dna/stats.png')         as ImageSourcePropType,
};

// ─── Kalibrasyon Seçenek İkonları ─────────────────────────────────────────────
// Soru → Şık sırası: Q1(a,b,c,d) Q2(a,b,c,d) Q3(a,b,c) Q4(a,b,c,d) Q5(a,b,c,d) Q6(a,b,c,d)

export const CalibrationIcons = {
  // Q1 — Duygu Durumu
  q1_intensity: require('../assets/icons/calibration/q1_intensity.png') as ImageSourcePropType,
  q1_cerebral:  require('../assets/icons/calibration/q1_cerebral.png')  as ImageSourcePropType,
  q1_emotional: require('../assets/icons/calibration/q1_emotional.png') as ImageSourcePropType,
  q1_bright:    require('../assets/icons/calibration/q1_bright.png')    as ImageSourcePropType,
  // Q2 — Görsel Tercih
  q2_visual_art:  require('../assets/icons/calibration/q2_visual_art.png')  as ImageSourcePropType,
  q2_old_footage: require('../assets/icons/calibration/q2_old_footage.png') as ImageSourcePropType,
  q2_galactic:    require('../assets/icons/calibration/q2_galactic.png')    as ImageSourcePropType,
  q2_cinematic:   require('../assets/icons/calibration/q2_cinematic.png')   as ImageSourcePropType,
  // Q3 — Tempo
  q3_scifi:  require('../assets/icons/calibration/q3_scifi.png')  as ImageSourcePropType,
  q3_masks:  require('../assets/icons/calibration/q3_masks.png')  as ImageSourcePropType,
  q3_escape: require('../assets/icons/calibration/q3_escape.png') as ImageSourcePropType,
  // Q4 — Bitiş Tercihi
  q4_daydream:   require('../assets/icons/calibration/q4_daydream.png')   as ImageSourcePropType,
  q4_sadness:    require('../assets/icons/calibration/q4_sadness.png')    as ImageSourcePropType,
  q4_curious:    require('../assets/icons/calibration/q4_curious.png')    as ImageSourcePropType,
  q4_achievement:require('../assets/icons/calibration/q4_achievement.png') as ImageSourcePropType,
  // Q5 — İzleme Ortamı
  q5_soundtrack:   require('../assets/icons/calibration/q5_soundtrack.png')   as ImageSourcePropType,
  q5_relationships:require('../assets/icons/calibration/q5_relationships.png') as ImageSourcePropType,
  q5_casual:       require('../assets/icons/calibration/q5_casual.png')       as ImageSourcePropType,
  q5_cozy:         require('../assets/icons/calibration/q5_cozy.png')         as ImageSourcePropType,
  // Q6 — Anlatım Tercihi
  q6_social:    require('../assets/icons/calibration/q6_social.png')    as ImageSourcePropType,
  q6_randomize: require('../assets/icons/calibration/q6_randomize.png') as ImageSourcePropType,
  q6_continue:  require('../assets/icons/calibration/q6_continue.png')  as ImageSourcePropType,
  q6_backstory: require('../assets/icons/calibration/q6_backstory.png') as ImageSourcePropType,
};
