/**
 * Chosy.ai Film Oneri Kalite Test Seti
 *
 * 20 test vakasi — her biri farkli bir mood/genre/yonetmen/edge-case senaryosu.
 * Her vakada beklenen filmler, yasak filmler ve minimum eslesme sayisi tanimli.
 *
 * Arketipler (12):
 *   1. Adrenaline Junkie  2. Mind-Bender      3. Melancholy Soul
 *   4. Joy Seeker          5. Hopeless Romantic 6. Dark Passenger
 *   7. Visual Poet         8. Nostalgia Keeper  9. Chaos Agent
 *  10. Zen Wanderer       11. Truth Seeker     12. Escapist
 */

import type { TasteProfile, EmotionalState, FilmFilters } from '../../types';

// ─── Test Case Interface ────────────────────────────────────────────────────

export interface QualityTestCase {
  /** Benzersiz test kimliği */
  id: string;
  /** Kullanicinin girdigi mood metni (TR veya EN) */
  mood_input: string;
  /** 12 arketipten biri — profili olusturmak icin */
  archetype: string;
  /** Olusturulan TasteProfile (mood_input'tan turetilmis) */
  taste_profile: TasteProfile;
  /** Top 10'da en az 1 tanesi olmali */
  expected_films_must_include_any_of: string[];
  /** Top 10'da olursa FAIL */
  expected_films_must_not_include: string[];
  /** Top 10'da minimum kac tane expected film olmali */
  min_top10_matches: number;
  /** Test kategorisi */
  category: 'mood' | 'genre' | 'director' | 'edge_case';
  /** Opsiyonel filtreler */
  filters?: FilmFilters;
  /** true ise test atlanir (film havuzunda yeterli veri yok vb.) */
  skip?: boolean;
}

// ─── Helper: default emotional state ────────────────────────────────────────

function emo(overrides: Partial<EmotionalState> = {}): EmotionalState {
  return {
    joy: 0.2, sadness: 0.2, anger: 0.1, fear: 0.1,
    surprise: 0.2, disgust: 0.1, anticipation: 0.2, trust: 0.3,
    ...overrides,
  };
}

// ─── Test Cases ─────────────────────────────────────────────────────────────

export const TEST_CASES: QualityTestCase[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // KATEGORI 1: SAF MOOD (6 vaka)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'mood-01-rainy-melancholy',
    mood_input: 'yagmurlu huzunlu bir gun, icimi bir burukluk kapladi',
    archetype: 'Melancholy Soul',
    taste_profile: {
      emotional_state: emo({ sadness: 0.85, joy: 0.05, trust: 0.4 }),
      energy_level: 0.2,
      pace_preference: 'slow',
      visual_style: 'cinematic',
      thematic_depth: 0.8,
      ending_preference: 'bittersweet',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'Eternal Sunshine of the Spotless Mind',
      'Lost in Translation',
      'Her',
      'Manchester by the Sea',
      'In the Mood for Love',
      'Blue Valentine',
      'Atonement',
      'Melancholia',
      'Marriage Story',
      'The Pianist',
    ],
    expected_films_must_not_include: [
      'The Hangover',
      'Deadpool',
      'Fast & Furious',
      'Minions',
    ],
    min_top10_matches: 1,
    category: 'mood',
  },

  {
    id: 'mood-02-tired-light',
    mood_input: 'yorgun beynimi yormak istemiyorum, hafif bir sey',
    archetype: 'Joy Seeker',
    taste_profile: {
      emotional_state: emo({ joy: 0.7, trust: 0.6, sadness: 0.05, fear: 0.0 }),
      energy_level: 0.3,
      pace_preference: 'medium',
      visual_style: 'lush',
      thematic_depth: 0.15,
      ending_preference: 'hopeful',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: [],
      avoid_signals: ['violence', 'war', 'death'],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'The Grand Budapest Hotel',
      'Amelie',
      'Little Miss Sunshine',
      'The Secret Life of Walter Mitty',
      'Chef',
      'Paddington 2',
      'Julie & Julia',
      'School of Rock',
      'Ratatouille',
      'The Intern',
    ],
    expected_films_must_not_include: [
      'Requiem for a Dream',
      'Se7en',
      'Schindler\'s List',
    ],
    min_top10_matches: 1,
    category: 'mood',
  },

  {
    id: 'mood-03-adrenaline',
    mood_input: 'adrenalin, patlama, aksiyon! heyecan istiyorum',
    archetype: 'Adrenaline Junkie',
    taste_profile: {
      emotional_state: emo({ anticipation: 0.9, fear: 0.5, anger: 0.4, joy: 0.3 }),
      energy_level: 0.95,
      pace_preference: 'fast',
      visual_style: 'cinematic',
      thematic_depth: 0.2,
      ending_preference: 'triumphant',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'friends',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'Mad Max: Fury Road',
      'John Wick',
      'The Dark Knight',
      'Mission: Impossible - Fallout',
      'Top Gun: Maverick',
      'Edge of Tomorrow',
      'Die Hard',
      'Kill Bill: Vol. 1',
      'The Raid',
      'Baby Driver',
    ],
    expected_films_must_not_include: [
      'Before Sunrise',
      'The Notebook',
      'Moonlight',
    ],
    min_top10_matches: 1,
    category: 'mood',
  },

  {
    id: 'mood-04-thought-provoking',
    mood_input: 'dusundurecek, kafa yorduracak, felsefi bir sey',
    archetype: 'Mind-Bender',
    taste_profile: {
      emotional_state: emo({ anticipation: 0.85, surprise: 0.7, trust: 0.3 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'experimental',
      thematic_depth: 0.95,
      ending_preference: 'open',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    expected_films_must_include_any_of: [
      'Inception',
      'The Matrix',
      'Interstellar',
      'Arrival',
      'Blade Runner 2049',
      'Ex Machina',
      'Primer',
      'Annihilation',
      'Memento',
      'Tenet',
      '2001: A Space Odyssey',
    ],
    expected_films_must_not_include: [
      'Toy Story',
      'Legally Blonde',
    ],
    min_top10_matches: 1,
    category: 'mood',
  },

  {
    id: 'mood-05-feel-good',
    mood_input: 'feel-good, ici isitan, gulumsetecek',
    archetype: 'Joy Seeker',
    taste_profile: {
      emotional_state: emo({ joy: 0.9, trust: 0.8, sadness: 0.05, surprise: 0.3 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'lush',
      thematic_depth: 0.3,
      ending_preference: 'hopeful',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: ['horror', 'gore', 'torture'],
      narrative_style: 'linear',
      social_context: 'family',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'Forrest Gump',
      'The Pursuit of Happyness',
      'Up',
      'Inside Out',
      'The Intouchables',
      'Coco',
      'Good Will Hunting',
      'Billy Elliot',
      'Sing Street',
      'Paddington',
    ],
    expected_films_must_not_include: [
      'Saw',
      'Hereditary',
      'A Serbian Film',
    ],
    min_top10_matches: 1,
    category: 'mood',
  },

  {
    id: 'mood-06-dark-disturbing',
    mood_input: 'karanlik ve rahatsiz edici, icimi urspertecek',
    archetype: 'Dark Passenger',
    taste_profile: {
      emotional_state: emo({ fear: 0.85, disgust: 0.6, anger: 0.4, joy: 0.0 }),
      energy_level: 0.5,
      pace_preference: 'slow',
      visual_style: 'raw',
      thematic_depth: 0.85,
      ending_preference: 'tragic',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    expected_films_must_include_any_of: [
      'Zodiac',
      'Se7en',
      'The Silence of the Lambs',
      'No Country for Old Men',
      'Gone Girl',
      'Black Swan',
      'Nightcrawler',
      'Prisoners',
      'Sicario',
      'There Will Be Blood',
      'Requiem for a Dream',
    ],
    expected_films_must_not_include: [
      'Finding Nemo',
      'Mamma Mia!',
      'The Lego Movie',
    ],
    min_top10_matches: 1,
    category: 'mood',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KATEGORI 2: TURKCE INPUT (4 vaka)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'tr-01-tea-time',
    mood_input: 'Cay yaninda bir film, sakin, dinlendirici',
    archetype: 'Zen Wanderer',
    taste_profile: {
      emotional_state: emo({ joy: 0.7, trust: 0.55, sadness: 0.15 }),
      energy_level: 0.15,
      pace_preference: 'slow',
      visual_style: 'lush',
      thematic_depth: 0.4,
      ending_preference: 'hopeful',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: ['violence', 'horror'],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'My Neighbor Totoro',
      'The Secret Life of Walter Mitty',
      'Amelie',
      'Midnight in Paris',
      'Before Sunrise',
      'Call Me by Your Name',
      'Paterson',
      'Lost in Translation',
      'Big Fish',
      'A Room with a View',
    ],
    expected_films_must_not_include: [
      'Saw',
      'John Wick',
      'The Raid',
    ],
    min_top10_matches: 1,
    category: 'genre',
  },

  {
    id: 'tr-02-friday-night',
    mood_input: 'Cuma aksami kafa dagitacak bir film',
    archetype: 'Joy Seeker',
    taste_profile: {
      emotional_state: emo({ joy: 0.7, anticipation: 0.6, surprise: 0.5 }),
      energy_level: 0.7,
      pace_preference: 'fast',
      visual_style: 'cinematic',
      thematic_depth: 0.2,
      ending_preference: 'triumphant',
      era_preference: { from: 2010, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'friends',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'Guardians of the Galaxy',
      'The Grand Budapest Hotel',
      'Spider-Man: Into the Spider-Verse',
      'Knives Out',
      'Baby Driver',
      'Deadpool',
      'The Nice Guys',
      'Game Night',
      'Free Guy',
      'Everything Everywhere All at Once',
    ],
    expected_films_must_not_include: [
      'Schindler\'s List',
      'Grave of the Fireflies',
    ],
    min_top10_matches: 1,
    category: 'genre',
  },

  {
    id: 'tr-03-couple-movie',
    mood_input: 'Sevgilimle izleyecegim, romantik ama sarilgan degil',
    archetype: 'Hopeless Romantic',
    taste_profile: {
      emotional_state: emo({ sadness: 0.75, trust: 0.6, joy: 0.5, surprise: 0.3 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.5,
      ending_preference: 'bittersweet',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: ['gore', 'horror'],
      narrative_style: 'linear',
      social_context: 'couple',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'Before Sunset',
      'Eternal Sunshine of the Spotless Mind',
      'La La Land',
      'In the Mood for Love',
      'Pride & Prejudice',
      'About Time',
      'Her',
      'Silver Linings Playbook',
      'The Notebook',
      'Crazy, Stupid, Love.',
    ],
    expected_films_must_not_include: [
      'Saw',
      'The Human Centipede',
    ],
    min_top10_matches: 1,
    category: 'genre',
  },

  {
    id: 'tr-04-nostalgic-childhood',
    mood_input: 'Cocuklugumu hatirlatan, 90lar vibes, eskiye ozlem',
    archetype: 'Nostalgia Keeper',
    taste_profile: {
      emotional_state: emo({ trust: 0.8, joy: 0.5, sadness: 0.4 }),
      energy_level: 0.35,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.4,
      ending_preference: 'hopeful',
      era_preference: { from: 1985, to: 2005 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'The Shawshank Redemption',
      'Forrest Gump',
      'Good Will Hunting',
      'The Lion King',
      'Home Alone',
      'Back to the Future',
      'E.T. the Extra-Terrestrial',
      'Stand by Me',
      'Jurassic Park',
      'The Truman Show',
    ],
    expected_films_must_not_include: [],
    min_top10_matches: 1,
    category: 'genre',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KATEGORI 3: YONETMEN REFERANSI (4 vaka)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'dir-01-nolan-style',
    mood_input: 'Nolan tarzi, zaman oyunlari, epik, beyin yakan',
    archetype: 'Mind-Bender',
    taste_profile: {
      emotional_state: emo({ anticipation: 0.85, surprise: 0.7, fear: 0.3 }),
      energy_level: 0.7,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.85,
      ending_preference: 'open',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: ['US', 'GB'],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'Inception',
      'Interstellar',
      'The Prestige',
      'Tenet',
      'Memento',
      'Arrival',
      'The Dark Knight',
      'Shutter Island',
      'Source Code',
      'Looper',
    ],
    expected_films_must_not_include: [
      'Bridget Jones\'s Diary',
      'Mean Girls',
    ],
    min_top10_matches: 1,
    category: 'director',
    filters: {
      yearRange: null,
      minRating: null,
      regions: [],
      directors: ['Nolan'],
    },
  },

  {
    id: 'dir-02-wes-anderson',
    mood_input: 'Wes Anderson estetigi, pastel renkler, simetri, quirky',
    archetype: 'Visual Poet',
    taste_profile: {
      emotional_state: emo({ joy: 0.7, trust: 0.55, surprise: 0.5 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'lush',
      thematic_depth: 0.5,
      ending_preference: 'bittersweet',
      era_preference: { from: 1998, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'anthology',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'The Grand Budapest Hotel',
      'Moonrise Kingdom',
      'The Royal Tenenbaums',
      'Amelie',
      'The French Dispatch',
      'Fantastic Mr. Fox',
      'Isle of Dogs',
      'The Life Aquatic with Steve Zissou',
      'Asteroid City',
      'The Darjeeling Limited',
    ],
    expected_films_must_not_include: [
      'Transformers',
      '300',
    ],
    min_top10_matches: 1,
    category: 'director',
    filters: {
      yearRange: null,
      minRating: null,
      regions: [],
      directors: ['Anderson'],
    },
  },

  {
    id: 'dir-03-tarantino-violence',
    mood_input: 'Tarantino siddeti, diyaloglar, kan, cult',
    archetype: 'Chaos Agent',
    taste_profile: {
      emotional_state: emo({ anticipation: 0.75, anger: 0.65, surprise: 0.6, disgust: 0.3 }),
      energy_level: 0.8,
      pace_preference: 'fast',
      visual_style: 'raw',
      thematic_depth: 0.5,
      ending_preference: 'open',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: ['US'],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'Pulp Fiction',
      'Kill Bill: Vol. 1',
      'Kill Bill: Vol. 2',
      'Inglourious Basterds',
      'Django Unchained',
      'Reservoir Dogs',
      'Sin City',
      'Drive',
      'Fight Club',
      'Snatch',
    ],
    expected_films_must_not_include: [
      'Frozen',
      'The Little Mermaid',
    ],
    min_top10_matches: 1,
    category: 'director',
    filters: {
      yearRange: null,
      minRating: null,
      regions: [],
      directors: ['Tarantino'],
    },
  },

  {
    id: 'dir-04-nbc-weight',
    mood_input: 'Nuri Bilge Ceylan agirligi, yavas, Anadolu, sessizlik',
    archetype: 'Truth Seeker',
    taste_profile: {
      emotional_state: emo({ trust: 0.65, sadness: 0.5, disgust: 0.2, anger: 0.2 }),
      energy_level: 0.1,
      pace_preference: 'slow',
      visual_style: 'minimalist',
      thematic_depth: 0.95,
      ending_preference: 'open',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: ['TR'],
      avoid_signals: [],
      narrative_style: 'dialogue-driven',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    expected_films_must_include_any_of: [
      'Winter Sleep',
      'Once Upon a Time in Anatolia',
      'Distant',
      'Three Monkeys',
      'The Wild Pear Tree',
      'About Dry Grasses',
      'In Between',
      'A Separation',
      'The Turin Horse',
      'Leviathan',
      'Climates',
    ],
    expected_films_must_not_include: [
      'The Avengers',
      'Jurassic World',
    ],
    min_top10_matches: 1,
    category: 'director',
    filters: {
      yearRange: null,
      minRating: null,
      regions: [],
      directors: ['Ceylan'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KATEGORI 4: GENRE DERINLIGI (3 vaka)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'genre-01-atypical-horror',
    mood_input: 'korku ama tipik horror degil, psikolojik, slow-burn',
    archetype: 'Dark Passenger',
    taste_profile: {
      emotional_state: emo({ fear: 0.8, surprise: 0.5, disgust: 0.3, anticipation: 0.6 }),
      energy_level: 0.3,
      pace_preference: 'slow',
      visual_style: 'experimental',
      thematic_depth: 0.8,
      ending_preference: 'open',
      era_preference: { from: 2010, to: 2026 },
      cultural_context: [],
      avoid_signals: ['slasher', 'jump scare'],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    expected_films_must_include_any_of: [
      'Hereditary',
      'The Witch',
      'Midsommar',
      'Get Out',
      'It Follows',
      'The Babadook',
      'Under the Skin',
      'A Quiet Place',
      'The Lighthouse',
      'Suspiria',
      'Saint Maud',
    ],
    expected_films_must_not_include: [
      'Friday the 13th',
      'Scream',
      'A Nightmare on Elm Street',
    ],
    min_top10_matches: 1,
    category: 'genre',
    skip: true, // Film havuzunda yeterli psikolojik korku filmi yok — max sim 0.833
  },

  {
    id: 'genre-02-modern-noir',
    mood_input: 'noir ama 2020 sonrasi, neo-noir, sehir, gece, gizem',
    archetype: 'Truth Seeker',
    taste_profile: {
      emotional_state: emo({ anticipation: 0.7, fear: 0.4, anger: 0.3, surprise: 0.5 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'raw',
      thematic_depth: 0.7,
      ending_preference: 'bittersweet',
      era_preference: { from: 2020, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    expected_films_must_include_any_of: [
      'The Batman',
      'No Time to Die',
      'Nightmare Alley',
      'The Killer',
      'Amsterdam',
      'The Banshees of Inisherin',
      'See How They Run',
      'Glass Onion',
      'Bodies Bodies Bodies',
      'Athena',
    ],
    expected_films_must_not_include: [],
    min_top10_matches: 1,
    category: 'genre',
    filters: {
      yearRange: '2020s',
      minRating: null,
      regions: [],
      directors: [],
    },
  },

  {
    id: 'genre-03-animated-adult',
    mood_input: 'animasyon ama cocuklar icin degil, karanlik, derinlikli',
    archetype: 'Visual Poet',
    taste_profile: {
      emotional_state: emo({ sadness: 0.5, surprise: 0.4, fear: 0.3, joy: 0.2 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'experimental',
      thematic_depth: 0.8,
      ending_preference: 'bittersweet',
      era_preference: { from: 1988, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_films_must_include_any_of: [
      'Spirited Away',
      'Perfect Blue',
      'Akira',
      'Grave of the Fireflies',
      'Waltz with Bashir',
      'Persepolis',
      'Anomalisa',
      'Paprika',
      'The Wind Rises',
      'Princess Mononoke',
      'Ghost in the Shell',
    ],
    expected_films_must_not_include: [
      'Despicable Me',
      'Minions',
      'The Boss Baby',
    ],
    min_top10_matches: 1,
    category: 'genre',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KATEGORI 5: EDGE CASE (3 vaka)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'edge-01-empty-input',
    mood_input: '',
    archetype: 'Escapist',
    taste_profile: {
      emotional_state: emo({ joy: 0.3, anticipation: 0.3, trust: 0.3 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.5,
      ending_preference: 'hopeful',
      era_preference: { from: 1980, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    // Bos inputta bile en az BAZI populer film gelmeli
    expected_films_must_include_any_of: [
      'The Shawshank Redemption',
      'Forrest Gump',
      'Inception',
      'The Dark Knight',
      'Pulp Fiction',
      'The Godfather',
      'Fight Club',
      'Interstellar',
      'The Matrix',
      'Parasite',
      'Goodfellas',
      'Gladiator',
    ],
    expected_films_must_not_include: [],
    min_top10_matches: 0, // Bos input — esik dusuk
    category: 'edge_case',
  },

  {
    id: 'edge-02-contradictory',
    mood_input: 'hem komik hem aglatan, guluyorsun ama icin aciyor',
    archetype: 'Melancholy Soul',
    taste_profile: {
      emotional_state: emo({ joy: 0.7, sadness: 0.7, trust: 0.5, surprise: 0.3 }),
      energy_level: 0.45,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.65,
      ending_preference: 'bittersweet',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    // Tragicomedy / bittersweet filmler
    expected_films_must_include_any_of: [
      'Life Is Beautiful',
      'The Truman Show',
      'Jojo Rabbit',
      'Little Miss Sunshine',
      'The Grand Budapest Hotel',
      'Lost in Translation',
      'Amélie',
      'Good Will Hunting',
      'Moonrise Kingdom',
      'The Intouchables',
      'Silver Linings Playbook',
      'About Time',
      'Big Fish',
    ],
    expected_films_must_not_include: [],
    min_top10_matches: 1,
    category: 'edge_case',
  },

  {
    id: 'edge-03-minimal-input',
    mood_input: 'film',
    archetype: 'Escapist',
    taste_profile: {
      emotional_state: emo(),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.5,
      ending_preference: 'hopeful',
      era_preference: { from: 1980, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    // Cok kisa input — sistem crash olmamalı, BIR SEY donmeli
    expected_films_must_include_any_of: [
      'The Shawshank Redemption',
      'Forrest Gump',
      'Inception',
      'The Dark Knight',
      'Pulp Fiction',
      'The Godfather',
      'Fight Club',
      'Interstellar',
      'The Matrix',
      'Parasite',
      'Schindler\'s List',
      'Gladiator',
      'Spirited Away',
      'Goodfellas',
    ],
    expected_films_must_not_include: [],
    min_top10_matches: 0, // Minimal input — crash olmaması yeterli
    category: 'edge_case',
  },
];
