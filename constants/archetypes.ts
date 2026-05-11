/**
 * MoodFlix — 12 Cinephile Archetype Definitions
 *
 * Her arketip: id, i18n keys (name + desc), custom PNG image, colorPrimary, colorDim.
 * Skorlama mantigi `services/archetypeEngine.ts` icinde.
 * Gorseller: assets/icons/archetypes/
 */

import type { ImageSourcePropType } from 'react-native';

import { ArchetypeIcons } from './icons';

// ─── Tip Tanimi ───────────────────────────────────────────────────────────────

/** Bir sinefil arketipinin display verisi */
export interface Archetype {
  /** 1-12 arasi benzersiz kimlik */
  id: number;
  /** i18n key: archetype.N_name */
  nameKey: string;
  /** i18n key: archetype.N_desc */
  descKey: string;
  /** Custom PNG ikonu — assets/icons/archetypes/ */
  image: ImageSourcePropType;
  /** Onun renk paleti — ana renk (hex) */
  colorPrimary: string;
  /** Onun renk paleti — soluk arka plan (rgba) */
  colorDim: string;
}

// ─── 12 Arketip ───────────────────────────────────────────────────────────────

/**
 * 12 sinefil arketipinin tanimlanmis listesi.
 * index = id - 1 (0-bazli erisim icin ARCHETYPES_MAP kullan)
 */
export const ARCHETYPES: readonly Archetype[] = [
  {
    id: 1,
    nameKey: 'archetype.1_name',
    descKey: 'archetype.1_desc',
    image: ArchetypeIcons[1],
    colorPrimary: '#EF4444',
    colorDim: 'rgba(239,68,68,0.14)',
  },
  {
    id: 2,
    nameKey: 'archetype.2_name',
    descKey: 'archetype.2_desc',
    image: ArchetypeIcons[2],
    colorPrimary: '#6366F1',
    colorDim: 'rgba(99,102,241,0.14)',
  },
  {
    id: 3,
    nameKey: 'archetype.3_name',
    descKey: 'archetype.3_desc',
    image: ArchetypeIcons[3],
    colorPrimary: '#60A5FA',
    colorDim: 'rgba(96,165,250,0.14)',
  },
  {
    id: 4,
    nameKey: 'archetype.4_name',
    descKey: 'archetype.4_desc',
    image: ArchetypeIcons[4],
    colorPrimary: '#FBBF24',
    colorDim: 'rgba(251,191,36,0.14)',
  },
  {
    id: 5,
    nameKey: 'archetype.5_name',
    descKey: 'archetype.5_desc',
    image: ArchetypeIcons[5],
    colorPrimary: '#F472B6',
    colorDim: 'rgba(244,114,182,0.14)',
  },
  {
    id: 6,
    nameKey: 'archetype.6_name',
    descKey: 'archetype.6_desc',
    image: ArchetypeIcons[6],
    colorPrimary: '#DC2626',
    colorDim: 'rgba(220,38,38,0.14)',
  },
  {
    id: 7,
    nameKey: 'archetype.7_name',
    descKey: 'archetype.7_desc',
    image: ArchetypeIcons[7],
    colorPrimary: '#2DD4BF',
    colorDim: 'rgba(45,212,191,0.14)',
  },
  {
    id: 8,
    nameKey: 'archetype.8_name',
    descKey: 'archetype.8_desc',
    image: ArchetypeIcons[8],
    colorPrimary: '#D4A843',
    colorDim: 'rgba(212,168,67,0.14)',
  },
  {
    id: 9,
    nameKey: 'archetype.9_name',
    descKey: 'archetype.9_desc',
    image: ArchetypeIcons[9],
    colorPrimary: '#FB923C',
    colorDim: 'rgba(251,146,60,0.14)',
  },
  {
    id: 10,
    nameKey: 'archetype.10_name',
    descKey: 'archetype.10_desc',
    image: ArchetypeIcons[10],
    colorPrimary: '#4ADE80',
    colorDim: 'rgba(74,222,128,0.14)',
  },
  {
    id: 11,
    nameKey: 'archetype.11_name',
    descKey: 'archetype.11_desc',
    image: ArchetypeIcons[11],
    colorPrimary: '#94A3B8',
    colorDim: 'rgba(148,163,184,0.14)',
  },
  {
    id: 12,
    nameKey: 'archetype.12_name',
    descKey: 'archetype.12_desc',
    image: ArchetypeIcons[12],
    colorPrimary: '#EADBC6',
    colorDim: 'rgba(234,219,198,0.14)',
  },
];

/** id → Archetype hizli erisim haritasi */
export const ARCHETYPES_MAP: Readonly<Record<number, Archetype>> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
);

/**
 * Arketip ID'sinden Archetype nesnesini dondurur.
 * Gecersiz ID durumunda null doner.
 */
export function getArchetype(id: number | null | undefined): Archetype | null {
  if (id == null) return null;
  return ARCHETYPES_MAP[id] ?? null;
}
