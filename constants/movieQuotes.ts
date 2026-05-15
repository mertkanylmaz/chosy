/**
 * Curated Movie Quotes Database
 *
 * Her replik birebir orijinal filmden alinmistir.
 * tmdb_id ile Supabase films tablosuna eslestirilir.
 * Sadece temiz, ikonik replikler — content policy uyumlu.
 */

export interface MovieQuote {
  /** TMDb film ID — films tablosuyla eslesmeli */
  tmdbId: number;
  /** Birebir replik */
  quote: string;
  /** Repligi soyleyen karakter */
  character: string;
}

/**
 * Kurasyon kurallari:
 * - Sadece DB'deki filmler (tmdb_id eslesmeli)
 * - Ikonik, taninabilir replikler
 * - Temiz icerik (kufur/siddet yok)
 * - Ingilizce orijinal
 */
export const MOVIE_QUOTES: MovieQuote[] = [
  // ─── Klasik Ikonik ──────────────────────────────────────
  { tmdbId: 11, quote: "May the Force be with you.", character: "Han Solo" },
  { tmdbId: 11, quote: "I find your lack of faith disturbing.", character: "Darth Vader" },
  { tmdbId: 13, quote: "Life is like a box of chocolates. You never know what you're gonna get.", character: "Forrest Gump" },
  { tmdbId: 13, quote: "Run, Forrest, run!", character: "Jenny Curran" },
  { tmdbId: 13, quote: "Stupid is as stupid does.", character: "Forrest Gump" },
  { tmdbId: 238, quote: "I'm gonna make him an offer he can't refuse.", character: "Don Vito Corleone" },
  { tmdbId: 238, quote: "Leave the gun. Take the cannoli.", character: "Peter Clemenza" },
  { tmdbId: 240, quote: "Keep your friends close, but your enemies closer.", character: "Michael Corleone" },
  { tmdbId: 278, quote: "Get busy living, or get busy dying.", character: "Andy Dufresne" },
  { tmdbId: 278, quote: "Hope is a good thing, maybe the best of things, and no good thing ever dies.", character: "Andy Dufresne" },
  { tmdbId: 550, quote: "The first rule of Fight Club is: you do not talk about Fight Club.", character: "Tyler Durden" },
  { tmdbId: 550, quote: "It's only after we've lost everything that we're free to do anything.", character: "Tyler Durden" },

  // ─── Sci-Fi / Action ──────────────────────────────────────
  { tmdbId: 603, quote: "I know kung fu.", character: "Neo" },
  { tmdbId: 603, quote: "There is no spoon.", character: "Spoon Boy" },
  { tmdbId: 603, quote: "Welcome to the real world.", character: "Morpheus" },
  { tmdbId: 218, quote: "I'll be back.", character: "The Terminator" },
  { tmdbId: 280, quote: "Hasta la vista, baby.", character: "The Terminator" },
  { tmdbId: 280, quote: "Come with me if you want to live.", character: "The Terminator" },
  { tmdbId: 78, quote: "I've seen things you people wouldn't believe.", character: "Roy Batty" },
  { tmdbId: 78, quote: "All those moments will be lost in time, like tears in rain.", character: "Roy Batty" },
  { tmdbId: 62, quote: "Open the pod bay doors, HAL.", character: "Dave Bowman" },
  { tmdbId: 62, quote: "I'm sorry, Dave. I'm afraid I can't do that.", character: "HAL 9000" },
  { tmdbId: 348, quote: "In space, no one can hear you scream.", character: "Tagline" },
  { tmdbId: 601, quote: "E.T. phone home.", character: "E.T." },
  { tmdbId: 329, quote: "Life finds a way.", character: "Dr. Ian Malcolm" },
  { tmdbId: 329, quote: "Welcome to Jurassic Park.", character: "John Hammond" },
  { tmdbId: 620, quote: "Who you gonna call? Ghostbusters!", character: "Peter Venkman" },
  { tmdbId: 105, quote: "Where we're going, we don't need roads.", character: "Doc Brown" },
  { tmdbId: 105, quote: "Great Scott!", character: "Doc Brown" },
  { tmdbId: 602, quote: "Welcome to Earth.", character: "Captain Steven Hiller" },

  // ─── Drama / Thriller ──────────────────────────────────────
  { tmdbId: 274, quote: "A census taker once tried to test me. I ate his liver with some fava beans and a nice Chianti.", character: "Hannibal Lecter" },
  { tmdbId: 807, quote: "What's in the box?!", character: "Detective David Mills" },
  { tmdbId: 745, quote: "I see dead people.", character: "Cole Sear" },
  { tmdbId: 694, quote: "Here's Johnny!", character: "Jack Torrance" },
  { tmdbId: 694, quote: "All work and no play makes Jack a dull boy.", character: "Jack Torrance" },
  { tmdbId: 155, quote: "Why so serious?", character: "The Joker" },
  { tmdbId: 155, quote: "You either die a hero or you live long enough to see yourself become the villain.", character: "Harvey Dent" },
  { tmdbId: 272, quote: "It's not who I am underneath, but what I do that defines me.", character: "Batman" },
  { tmdbId: 629, quote: "The greatest trick the devil ever pulled was convincing the world he didn't exist.", character: "Verbal Kint" },
  { tmdbId: 77, quote: "I have to believe in a world outside my own mind.", character: "Leonard Shelby" },
  { tmdbId: 1124, quote: "Are you watching closely?", character: "Alfred Borden" },
  { tmdbId: 1124, quote: "Every great magic trick consists of three parts.", character: "John Cutter" },
  { tmdbId: 103, quote: "You talkin' to me?", character: "Travis Bickle" },
  { tmdbId: 769, quote: "As far back as I can remember, I always wanted to be a gangster.", character: "Henry Hill" },
  { tmdbId: 524, quote: "In this town, I'm the one who calls the shots.", character: "Ace Rothstein" },
  { tmdbId: 1422, quote: "When you decide to be something, you can be it.", character: "Frank Costello" },

  // ─── Romance / Drama ──────────────────────────────────────
  { tmdbId: 597, quote: "I'm the king of the world!", character: "Jack Dawson" },
  { tmdbId: 597, quote: "I'll never let go, Jack. I'll never let go.", character: "Rose DeWitt Bukater" },
  { tmdbId: 639, quote: "I'll have what she's having.", character: "Customer in Deli" },
  { tmdbId: 164, quote: "I'm also just a girl, standing in front of a boy, asking him to love her.", character: "Holly Golightly" },
  { tmdbId: 114, quote: "I could have been a contender.", character: "Jeff Lebowski" },
  { tmdbId: 453, quote: "You have no idea how good it feels to finally be able to do this.", character: "John Nash" },
  { tmdbId: 824, quote: "The greatest thing you'll ever learn is just to love and be loved in return.", character: "Christian" },
  { tmdbId: 489, quote: "How do you like them apples?", character: "Will Hunting" },
  { tmdbId: 489, quote: "It's not your fault.", character: "Sean Maguire" },
  { tmdbId: 207, quote: "Carpe diem. Seize the day, boys.", character: "John Keating" },
  { tmdbId: 207, quote: "O Captain! My Captain!", character: "Todd Anderson" },
  { tmdbId: 38, quote: "Blessed are the forgetful, for they get the better even of their blunders.", character: "Mary Svevo" },
  { tmdbId: 153, quote: "I just want to be seen.", character: "Charlotte" },
  { tmdbId: 1402, quote: "Don't ever let somebody tell you you can't do something.", character: "Chris Gardner" },

  // ─── Adventure / Fantasy ──────────────────────────────────────
  { tmdbId: 120, quote: "One ring to rule them all.", character: "Gandalf" },
  { tmdbId: 120, quote: "A wizard is never late. He arrives precisely when he means to.", character: "Gandalf" },
  { tmdbId: 120, quote: "You shall not pass!", character: "Gandalf" },
  { tmdbId: 122, quote: "My precious.", character: "Gollum" },
  { tmdbId: 85, quote: "It's not the years, honey. It's the mileage.", character: "Indiana Jones" },
  { tmdbId: 89, quote: "He chose... poorly.", character: "Grail Knight" },
  { tmdbId: 22, quote: "This is the day you will always remember as the day you almost caught Captain Jack Sparrow.", character: "Jack Sparrow" },
  { tmdbId: 197, quote: "Every man dies, not every man really lives.", character: "William Wallace" },
  { tmdbId: 98, quote: "Are you not entertained?", character: "Maximus" },
  { tmdbId: 98, quote: "What we do in life echoes in eternity.", character: "Maximus" },
  { tmdbId: 752, quote: "People should not be afraid of their governments. Governments should be afraid of their people.", character: "V" },
  { tmdbId: 752, quote: "Beneath this mask there is an idea, and ideas are bulletproof.", character: "V" },
  { tmdbId: 1271, quote: "This is Sparta!", character: "King Leonidas" },

  // ─── Comedy / Family ──────────────────────────────────────
  { tmdbId: 808, quote: "Ogres are like onions. They have layers.", character: "Shrek" },
  { tmdbId: 812, quote: "A whole new world!", character: "Aladdin" },
  { tmdbId: 862, quote: "To infinity and beyond!", character: "Buzz Lightyear" },
  { tmdbId: 862, quote: "You're my favorite deputy.", character: "Woody" },
  { tmdbId: 585, quote: "I'm watching you, Wazowski. Always watching.", character: "Roz" },
  { tmdbId: 12, quote: "Just keep swimming.", character: "Dory" },
  { tmdbId: 12, quote: "Fish are friends, not food.", character: "Bruce" },
  { tmdbId: 771, quote: "Keep the change, you filthy animal.", character: "Kevin McCallister" },
  { tmdbId: 762, quote: "We are the knights who say Ni!", character: "The Knights" },
  { tmdbId: 762, quote: "It's just a flesh wound.", character: "Black Knight" },
  { tmdbId: 583, quote: "He's not the Messiah. He's a very naughty boy!", character: "Mandy Cohen" },
  { tmdbId: 115, quote: "The Dude abides.", character: "The Dude" },
  { tmdbId: 115, quote: "That's just, like, your opinion, man.", character: "The Dude" },
  { tmdbId: 773, quote: "A real loser is someone who's so afraid of not winning, they don't even try.", character: "Grandpa" },
  { tmdbId: 350, quote: "That's all.", character: "Miranda Priestly" },

  // ─── War / Historical ──────────────────────────────────────
  { tmdbId: 857, quote: "Earn this.", character: "Captain Miller" },
  { tmdbId: 424, quote: "Whoever saves one life, saves the world entire.", character: "Itzhak Stern" },
  { tmdbId: 424, quote: "The list is life.", character: "Itzhak Stern" },
  { tmdbId: 600, quote: "This is my rifle. There are many like it, but this one is mine.", character: "Private Joker" },
  { tmdbId: 28, quote: "I love the smell of napalm in the morning.", character: "Lieutenant Kilgore" },
  { tmdbId: 947, quote: "Big things have small beginnings.", character: "T.E. Lawrence" },
  { tmdbId: 510, quote: "But I tried, didn't I?", character: "Randle McMurphy" },
  { tmdbId: 423, quote: "The pianist played on, even in ruins.", character: "Wladyslaw Szpilman" },

  // ─── Crime / Mystery ──────────────────────────────────────
  { tmdbId: 680, quote: "Zed's dead, baby. Zed's dead.", character: "Butch Coolidge" },
  { tmdbId: 500, quote: "Are you gonna bark all day, little doggy, or are you gonna bite?", character: "Mr. Blonde" },
  { tmdbId: 101, quote: "Is life always this hard, or is it just when you're a kid?", character: "Mathilda" },
  { tmdbId: 101, quote: "No women, no kids.", character: "Leon" },
  { tmdbId: 640, quote: "Two little mice fell in a bucket of cream.", character: "Frank Abagnale Sr." },
  { tmdbId: 275, quote: "There's no rule that says I have to be nice to you.", character: "Marge Gunderson" },
  { tmdbId: 319, quote: "You're so cool.", character: "Alabama Whitman" },
  { tmdbId: 829, quote: "Forget it, Jake. It's Chinatown.", character: "Lawrence Walsh" },

  // ─── Animated / Studio Ghibli ──────────────────────────────
  { tmdbId: 129, quote: "Once you meet someone, you never really forget them.", character: "Zeniba" },
  { tmdbId: 128, quote: "Life is suffering. It is hard. The world is cursed, but still you find reasons to keep living.", character: "Osa" },

  // ─── Cult / Indie ──────────────────────────────────────
  { tmdbId: 141, quote: "Why are you wearing that stupid man suit?", character: "Frank" },
  { tmdbId: 141, quote: "Every living creature on earth dies alone.", character: "Roberta Sparrow" },
  { tmdbId: 627, quote: "Choose life.", character: "Mark Renton" },
  { tmdbId: 194, quote: "Without you, today's emotions would be the scurf of yesterday's.", character: "Hipolito" },
  { tmdbId: 185, quote: "I was cured all right.", character: "Alex DeLarge" },
  { tmdbId: 637, quote: "Good morning, princess!", character: "Guido" },
  { tmdbId: 598, quote: "If you come, you'd better come armed.", character: "Narrator" },
  { tmdbId: 1359, quote: "I have to return some videotapes.", character: "Patrick Bateman" },
  { tmdbId: 406, quote: "So far so good. So far so good. So far so good.", character: "Hubert" },
  { tmdbId: 1018, quote: "It's strange to be calling yourself a stranger.", character: "Betty Elms" },

  // ─── Sports / Inspiration ──────────────────────────────────
  { tmdbId: 1366, quote: "It ain't about how hard you hit. It's about how hard you can get hit and keep moving forward.", character: "Rocky Balboa" },
  { tmdbId: 1366, quote: "Yo, Adrian!", character: "Rocky Balboa" },
  { tmdbId: 568, quote: "Houston, we have a problem.", character: "Jim Lovell" },

  // ─── Thriller / Suspense ──────────────────────────────────
  { tmdbId: 539, quote: "A boy's best friend is his mother.", character: "Norman Bates" },
  { tmdbId: 562, quote: "Yippee-ki-yay.", character: "John McClane" },
  { tmdbId: 578, quote: "You're gonna need a bigger boat.", character: "Chief Brody" },
  { tmdbId: 881, quote: "You can't handle the truth!", character: "Colonel Jessup" },
  { tmdbId: 497, quote: "I'm tired, boss. Tired of being on the road.", character: "John Coffey" },
  { tmdbId: 949, quote: "I will not hesitate. Not for a second.", character: "Vincent Hanna" },
  { tmdbId: 429, quote: "You see, in this world there's two kinds of people, my friend: those with loaded guns and those who dig.", character: "Blondie" },

  // ─── Musical / Period ──────────────────────────────────
  { tmdbId: 433, quote: "Supercalifragilisticexpialidocious!", character: "Mary Poppins" },
  { tmdbId: 433, quote: "In every job that must be done, there is an element of fun.", character: "Mary Poppins" },
  { tmdbId: 279, quote: "I am not mad. I am enraged.", character: "Antonio Salieri" },

  // ─── Modern Classics ──────────────────────────────────
  { tmdbId: 1417, quote: "I am a princess. Not the ugly kind. I'm the other kind.", character: "Ofelia" },
  { tmdbId: 670, quote: "Laugh, and the world laughs with you. Weep, and you weep alone.", character: "Oh Dae-su" },
  { tmdbId: 782, quote: "There is no gene for the human spirit.", character: "Vincent Freeman" },
  { tmdbId: 582, quote: "The whole power of the state is built on people's fear.", character: "Gerd Wiesler" },
  { tmdbId: 162, quote: "I am not complete.", character: "Edward Scissorhands" },
  { tmdbId: 587, quote: "A man tells his stories so many times that he becomes the stories.", character: "Will Bloom" },
  { tmdbId: 137, quote: "I got you, babe.", character: "Phil Connors" },
  { tmdbId: 744, quote: "I feel the need... the need for speed.", character: "Maverick" },
  { tmdbId: 380, quote: "Look in your heart!", character: "Bernie Bernbaum" },
  { tmdbId: 73, quote: "Has anything you've done made your life better?", character: "Bob Sweeney" },
  { tmdbId: 935, quote: "Gentlemen, you can't fight in here! This is the War Room!", character: "President Merkin Muffley" },
  { tmdbId: 497, quote: "Please boss, don't put that thing over my face. I'm afraid of the dark.", character: "John Coffey" },
  { tmdbId: 581, quote: "I'd never known that my own people had such a history.", character: "Lt. John Dunbar" },
  { tmdbId: 747, quote: "You've got red on you.", character: "Shaun" },
  { tmdbId: 176, quote: "The most feared creature in the sea.", character: "Jacques Mayol" },
];

/** Belirli bir film icin rastgele replik sec */
export function getQuoteForFilm(tmdbId: number, seed: number): MovieQuote | null {
  const filmQuotes = MOVIE_QUOTES.filter((q) => q.tmdbId === tmdbId);
  if (filmQuotes.length === 0) return null;
  return filmQuotes[seed % filmQuotes.length];
}

/** Replik bulunan tum benzersiz film ID'leri */
export function getQuotableFilmIds(): number[] {
  return [...new Set(MOVIE_QUOTES.map((q) => q.tmdbId))];
}
