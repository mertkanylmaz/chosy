/**
 * Taste Calibration — 6 soru tanımı ve TasteProfile mapping yapılandırması.
 *
 * Her soru: senaryo metni (i18n key) ve 3-4 seçenek.
 * Her seçenek: image (custom PNG) + i18n key + TasteProfile üzerindeki etkileri.
 */

import type { ImageSourcePropType } from 'react-native';

import { CalibrationIcons } from '@/constants/icons';
import type { TasteProfile } from '@/types/index';

// ─── Tip Tanımları ────────────────────────────────────────────────────────────

/** Tek bir seçeneğin TasteProfile üzerindeki etkilerini tanımlar */
export interface OptionEffect {
  emotional_state?: Partial<TasteProfile['emotional_state']>;
  energy_level?: number;
  pace_preference?: TasteProfile['pace_preference'];
  visual_style?: TasteProfile['visual_style'];
  thematic_depth?: number;
  ending_preference?: TasteProfile['ending_preference'];
  narrative_style?: TasteProfile['narrative_style'];
  social_context?: TasteProfile['social_context'];
  era_preference?: TasteProfile['era_preference'];
}

/** Tek bir seçeneğin tanımı */
export interface CalibrationOption {
  /** Seçenek görseli — custom PNG */
  image: ImageSourcePropType;
  /** i18n key — seçenek metni */
  labelKey: string;
  /** Bu seçenek seçildiğinde TasteProfile'a uygulanacak etkiler */
  effect: OptionEffect;
}

/** Tek bir sorunun tanımı */
export interface CalibrationQuestion {
  /** Benzersiz soru kimliği (1-6) */
  id: number;
  /** i18n key — senaryo metni */
  scenarioKey: string;
  /** Seçenekler listesi (3 veya 4 seçenek) */
  options: CalibrationOption[];
}

/** Kullanıcının tek bir soruya verdiği cevap */
export interface CalibrationAnswer {
  questionId: number;
  optionIndex: number;
}

// ─── 6 Soru ───────────────────────────────────────────────────────────────────

/**
 * Tüm kalibrasyon sorularının statik tanımı.
 * Soru 3'te 3 seçenek, diğerlerinde 4 seçenek.
 */
export const CALIBRATION_QUESTIONS: readonly CalibrationQuestion[] = [
  // Q1 — Duygu Durumu
  {
    id: 1,
    scenarioKey: 'onboarding.q1',
    options: [
      {
        image: CalibrationIcons.q1_intensity,
        labelKey: 'onboarding.q1a',
        effect: {
          energy_level: 0.9,
          emotional_state: { fear: 0.6, anticipation: 0.7, anger: 0.6, disgust: 0.3 },
        },
      },
      {
        image: CalibrationIcons.q1_cerebral,
        labelKey: 'onboarding.q1b',
        effect: {
          thematic_depth: 0.85,
          emotional_state: { surprise: 0.7, anticipation: 0.6 },
        },
      },
      {
        image: CalibrationIcons.q1_emotional,
        labelKey: 'onboarding.q1c',
        effect: {
          thematic_depth: 0.7,
          emotional_state: { sadness: 0.8, trust: 0.5 },
        },
      },
      {
        image: CalibrationIcons.q1_bright,
        labelKey: 'onboarding.q1d',
        effect: {
          energy_level: 0.6,
          emotional_state: { joy: 0.9 },
        },
      },
    ],
  },

  // Q2 — Görsel Tercih
  {
    id: 2,
    scenarioKey: 'onboarding.q2',
    options: [
      {
        image: CalibrationIcons.q2_visual_art,
        labelKey: 'onboarding.q2a',
        effect: { visual_style: 'lush' },
      },
      {
        image: CalibrationIcons.q2_old_footage,
        labelKey: 'onboarding.q2b',
        effect: {
          visual_style: 'minimalist',
          era_preference: { from: 1940, to: 1985 },
        },
      },
      {
        image: CalibrationIcons.q2_galactic,
        labelKey: 'onboarding.q2c',
        effect: { visual_style: 'experimental' },
      },
      {
        image: CalibrationIcons.q2_cinematic,
        labelKey: 'onboarding.q2d',
        effect: { visual_style: 'cinematic' },
      },
    ],
  },

  // Q3 — Tempo (3 seçenek)
  {
    id: 3,
    scenarioKey: 'onboarding.q3',
    options: [
      {
        image: CalibrationIcons.q3_scifi,
        labelKey: 'onboarding.q3a',
        effect: { pace_preference: 'fast', energy_level: 0.3 },
      },
      {
        image: CalibrationIcons.q3_masks,
        labelKey: 'onboarding.q3b',
        effect: {
          pace_preference: 'medium',
          emotional_state: { anger: 0.7, disgust: 0.5 },
        },
      },
      {
        image: CalibrationIcons.q3_escape,
        labelKey: 'onboarding.q3c',
        effect: { pace_preference: 'slow', energy_level: -0.2 },
      },
    ],
  },

  // Q4 — Bitiş Tercihi
  {
    id: 4,
    scenarioKey: 'onboarding.q4',
    options: [
      {
        image: CalibrationIcons.q4_daydream,
        labelKey: 'onboarding.q4a',
        effect: { ending_preference: 'hopeful' },
      },
      {
        image: CalibrationIcons.q4_sadness,
        labelKey: 'onboarding.q4b',
        effect: {
          ending_preference: 'tragic',
          emotional_state: { disgust: 0.4 },
        },
      },
      {
        image: CalibrationIcons.q4_curious,
        labelKey: 'onboarding.q4c',
        effect: { ending_preference: 'open' },
      },
      {
        image: CalibrationIcons.q4_achievement,
        labelKey: 'onboarding.q4d',
        effect: { ending_preference: 'triumphant' },
      },
    ],
  },

  // Q5 — İzleme Ortamı
  {
    id: 5,
    scenarioKey: 'onboarding.q5',
    options: [
      {
        image: CalibrationIcons.q5_soundtrack,
        labelKey: 'onboarding.q5a',
        effect: { social_context: 'alone' },
      },
      {
        image: CalibrationIcons.q5_relationships,
        labelKey: 'onboarding.q5b',
        effect: { social_context: 'couple' },
      },
      {
        image: CalibrationIcons.q5_casual,
        labelKey: 'onboarding.q5c',
        effect: { social_context: 'friends' },
      },
      {
        image: CalibrationIcons.q5_cozy,
        labelKey: 'onboarding.q5d',
        effect: { social_context: 'family' },
      },
    ],
  },

  // Q6 — Anlatım Tercihi
  {
    id: 6,
    scenarioKey: 'onboarding.q6',
    options: [
      {
        image: CalibrationIcons.q6_social,
        labelKey: 'onboarding.q6a',
        effect: {
          narrative_style: 'dialogue-driven',
          thematic_depth: 0.2,
        },
      },
      {
        image: CalibrationIcons.q6_randomize,
        labelKey: 'onboarding.q6b',
        effect: {
          narrative_style: 'nonlinear',
          thematic_depth: 0.3,
        },
      },
      {
        image: CalibrationIcons.q6_continue,
        labelKey: 'onboarding.q6c',
        effect: { narrative_style: 'linear' },
      },
      {
        image: CalibrationIcons.q6_backstory,
        labelKey: 'onboarding.q6d',
        effect: { narrative_style: 'anthology' },
      },
    ],
  },
] as const;

// ─── Profile Builder ──────────────────────────────────────────────────────────

/**
 * 6 sorunun cevaplarından yaklaşık bir TasteProfile üretir.
 * Başlangıç profili nötr, her cevap üstüne efektler uygulanır.
 *
 * @param answers - Kullanıcının verdiği cevaplar
 * @returns Kalibrasyondan çıkan TasteProfile
 */
export function buildCalibrationProfile(answers: CalibrationAnswer[]): TasteProfile {
  const profile: TasteProfile = {
    emotional_state: {
      joy: 0.3,
      sadness: 0.3,
      anger: 0.2,
      fear: 0.2,
      surprise: 0.3,
      disgust: 0.1,
      anticipation: 0.3,
      trust: 0.3,
    },
    energy_level: 0.5,
    pace_preference: 'medium',
    visual_style: 'cinematic',
    thematic_depth: 0.5,
    ending_preference: 'hopeful',
    era_preference: { from: 1990, to: 2026 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'alone',
    rewatch_tolerance: true,
  };

  for (const answer of answers) {
    const question = CALIBRATION_QUESTIONS.find((q) => q.id === answer.questionId);
    if (!question) continue;

    const option = question.options[answer.optionIndex];
    if (!option) continue;

    const { effect } = option;

    // Scalar overrides
    if (effect.pace_preference !== undefined) {
      profile.pace_preference = effect.pace_preference;
    }
    if (effect.visual_style !== undefined) {
      profile.visual_style = effect.visual_style;
    }
    if (effect.ending_preference !== undefined) {
      profile.ending_preference = effect.ending_preference;
    }
    if (effect.narrative_style !== undefined) {
      profile.narrative_style = effect.narrative_style;
    }
    if (effect.social_context !== undefined) {
      profile.social_context = effect.social_context;
    }
    if (effect.era_preference !== undefined) {
      profile.era_preference = { ...effect.era_preference };
    }

    // Numeric deltas — clamp to [0, 1]
    if (effect.energy_level !== undefined) {
      profile.energy_level = Math.max(0, Math.min(1, profile.energy_level + effect.energy_level));
    }
    if (effect.thematic_depth !== undefined) {
      // Q6: thematic_depth deltas are additive, others are absolute
      const isQ6 = answer.questionId === 6;
      if (isQ6) {
        profile.thematic_depth = Math.max(
          0,
          Math.min(1, profile.thematic_depth + effect.thematic_depth),
        );
      } else {
        profile.thematic_depth = Math.max(0, Math.min(1, effect.thematic_depth));
      }
    }

    // Emotional state merges
    if (effect.emotional_state) {
      const es = effect.emotional_state;
      for (const key of Object.keys(es) as Array<keyof typeof es>) {
        const val = es[key];
        if (val !== undefined) {
          profile.emotional_state[key] = Math.max(0, Math.min(1, val));
        }
      }
    }
  }

  return profile;
}
