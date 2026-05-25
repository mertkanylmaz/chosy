/**
 * Curated list of auteur directors for deep filmography discovery.
 * Each entry maps a director name to their TMDb person ID.
 * TMDb person IDs sourced from https://www.themoviedb.org/person/{id}
 */

export interface AuteurDirector {
  /** Display name */
  name: string;
  /** TMDb person ID */
  tmdbPersonId: number;
}

/**
 * 40 directors — balanced mix of modern blockbuster auteurs,
 * international art-house masters, and golden-age classics.
 */
export const AUTEUR_DIRECTORS: AuteurDirector[] = [
  // Modern Hollywood / Anglo
  { name: 'Christopher Nolan', tmdbPersonId: 525 },
  { name: 'Quentin Tarantino', tmdbPersonId: 138 },
  { name: 'Wes Anderson', tmdbPersonId: 5655 },
  { name: 'Paul Thomas Anderson', tmdbPersonId: 4762 },
  { name: 'Joel Coen', tmdbPersonId: 1223 },
  { name: 'Ethan Coen', tmdbPersonId: 1224 },
  { name: 'Martin Scorsese', tmdbPersonId: 1032 },
  { name: 'David Lynch', tmdbPersonId: 5602 },
  { name: 'David Fincher', tmdbPersonId: 7467 },
  { name: 'Denis Villeneuve', tmdbPersonId: 137427 },
  { name: 'Greta Gerwig', tmdbPersonId: 45400 },
  { name: 'Charlie Kaufman', tmdbPersonId: 5281 },

  // East Asian
  { name: 'Bong Joon-ho', tmdbPersonId: 21684 },
  { name: 'Park Chan-wook', tmdbPersonId: 10099 },
  { name: 'Wong Kar-wai', tmdbPersonId: 12453 },
  { name: 'Hayao Miyazaki', tmdbPersonId: 608 },
  { name: 'Akira Kurosawa', tmdbPersonId: 5026 },
  { name: 'Yasujirō Ozu', tmdbPersonId: 43669 },
  { name: 'Hirokazu Kore-eda', tmdbPersonId: 84762 },

  // European — Nordic / Germanic / Slavic
  { name: 'Ingmar Bergman', tmdbPersonId: 6648 },
  { name: 'Andrei Tarkovsky', tmdbPersonId: 7554 },
  { name: 'Krzysztof Kieślowski', tmdbPersonId: 3830 },
  { name: 'Michael Haneke', tmdbPersonId: 5719 },
  { name: 'Lars von Trier', tmdbPersonId: 5765 },
  { name: 'Béla Tarr', tmdbPersonId: 59385 },

  // European — Romance languages
  { name: 'Federico Fellini', tmdbPersonId: 4415 },
  { name: 'Michelangelo Antonioni', tmdbPersonId: 11257 },
  { name: 'Pedro Almodóvar', tmdbPersonId: 1114 },
  { name: 'Céline Sciamma', tmdbPersonId: 136495 },

  // European — French New Wave & avant-garde
  { name: 'Agnès Varda', tmdbPersonId: 10759 },
  { name: 'Chantal Akerman', tmdbPersonId: 62889 },

  // Middle East / Turkey
  { name: 'Abbas Kiarostami', tmdbPersonId: 40847 },
  { name: 'Nuri Bilge Ceylan', tmdbPersonId: 53826 },

  // Greek
  { name: 'Yorgos Lanthimos', tmdbPersonId: 81880 },

  // Oceania
  { name: 'Jane Campion', tmdbPersonId: 4785 },

  // Classic Hollywood
  { name: 'Stanley Kubrick', tmdbPersonId: 240 },
  { name: 'Alfred Hitchcock', tmdbPersonId: 2636 },
  { name: 'Billy Wilder', tmdbPersonId: 4385 },
  { name: 'Orson Welles', tmdbPersonId: 6850 },
  { name: 'Stanley Donen', tmdbPersonId: 8689 },
  { name: 'Roman Polanski', tmdbPersonId: 3556 },
];
