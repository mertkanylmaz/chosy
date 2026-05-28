/**
 * Founder Acceptance Test Cases
 *
 * Ground-truth data from founder's real device testing (Sprint 1 v5.0).
 * Each case = a mood the founder typed + films they considered good/bad.
 *
 * Run every sprint close to detect recommendation regressions.
 */

export interface FounderTestCase {
  id: string;
  mood: string;
  acceptableExamples: string[];
  unacceptableExamples: string[];
  expectedConcepts: string[];
  minAcceptable: number;
}

export const FOUNDER_CASES: FounderTestCase[] = [
  {
    id: 'mind_bending_neo_noir',
    mood: 'mind bending slow burn neo-noir',
    acceptableExamples: [
      'Blue Velvet', 'Mulholland Drive', 'Memento', 'Shutter Island',
      'Rashomon', 'Ghost in the Shell', 'Lady Vengeance', 'Oldboy',
      'The Sixth Sense', 'The Usual Suspects', 'Sunset Boulevard',
      'Blind Chance', 'Get Out', 'Dr. Mabuse the Gambler', 'Il Divo',
      'The Exterminating Angel', 'Psycho', 'The Matrix', 'Inception',
      'The Prestige', 'Fight Club', 'Pulp Fiction', 'Enemy',
      'JFK', 'The Butterfly Effect',
    ],
    unacceptableExamples: [
      'Schindler\'s List', 'The Green Mile', 'The Pianist',
      'Avicii: I\'m Tim', 'One Direction: This Is Us',
      'Project Hail Mary', 'Along with the Gods',
    ],
    expectedConcepts: ['nonlinear', 'noir', 'psychological'],
    minAcceptable: 5,
  },
  {
    id: 'happy_simple',
    mood: 'happy',
    acceptableExamples: [
      'Howl\'s Moving Castle', 'Kiki\'s Delivery Service', 'Ponyo',
      'My Neighbor Totoro', 'Princess Mononoke', 'Spirited Away',
      'Klaus', 'Kubo and the Two Strings', 'How to Train Your Dragon',
      'The Bad Guys', 'Midnight in Paris', 'Hercules',
      'The SpongeBob Movie', 'Monsters University', 'Up', 'Coco',
      'The Adventures of Pinocchio', 'The Wild Robot', 'Josee',
      'Ultraman Rising',
    ],
    unacceptableExamples: [
      'Schindler\'s List', 'Come and See', 'Manchester by the Sea',
      'The Legend of Hei 2', 'Gabriel\'s Inferno',
    ],
    expectedConcepts: ['joy', 'lighthearted', 'family'],
    minAcceptable: 5,
  },
  {
    id: 'sad_drama',
    mood: 'sad',
    acceptableExamples: [
      'Mary and Max', 'Manchester by the Sea', 'The Pianist',
      'Werckmeister Harmonies', 'A Prophet', 'The Book Thief',
      'Grave of the Fireflies', 'Land of Mine', 'The Florida Project',
      'Birdman of Alcatraz', 'Paper Lives', 'Richard Jewell',
      'Erin Brockovich', 'The Iron Claw', 'The Last King of Scotland',
      'A Few Good Men', 'Black Dog', 'Frank', 'Innocence',
      'Requiem for a Dream', 'Schindler\'s List',
    ],
    unacceptableExamples: [
      'The SpongeBob Movie', 'My Little Pony', 'The Avengers',
    ],
    expectedConcepts: ['sadness', 'melancholy', 'drama'],
    minAcceptable: 5,
  },
  {
    id: 'wong_kar_wai',
    mood: 'wong kar-wai tarzi, gorsel ve melankolik',
    acceptableExamples: [
      'In the Mood for Love', 'Chungking Express', 'Fallen Angels',
      'Happy Together', '2046', 'Days of Being Wild',
      'Past Lives', 'Drive My Car', 'Lost in Translation',
    ],
    unacceptableExamples: [
      'Kraken', 'Prometheus', 'Hunger Games', 'Batman Begins',
      'District 9', 'A Quiet Place Part 2',
    ],
    expectedConcepts: ['lush', 'melancholy', 'romantic', 'atmospheric'],
    minAcceptable: 4,
  },
  {
    id: 'no_marvel',
    mood: 'Marvel ve super kahraman filmi istemiyorum, alternatif sinema',
    acceptableExamples: [
      'City Lights', '12 Angry Men', 'The General',
      'Paris, Texas', 'Stalker', 'The Seventh Seal',
      'Persona', 'Tokyo Story', 'Wild Strawberries',
    ],
    unacceptableExamples: [
      'The Avengers', 'Batman Begins', 'Iron Man', 'Hunger Games',
      'Kraken', 'Prometheus', 'Thor', 'Captain America',
    ],
    expectedConcepts: ['arthouse', 'classic', 'non-mainstream'],
    minAcceptable: 3,
  },
];
