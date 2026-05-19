/**
 * Notification Content Templates — personalized push notification content
 * based on archetype, mood history, and user behavior.
 *
 * Templates support EN/TR localization.
 * A/B test variants included for key notification types.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationTemplate {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export type NotificationType =
  | 'daily_hook'
  | 'sunday_ritual'
  | 'streak_warning'
  | 'quota_refill'
  | 'streak_reward'
  | 'winback_14'
  | 'winback_21'
  | 'winback_30'
  | 'winback_60';

type Locale = 'en' | 'tr';

interface TemplateContext {
  locale: Locale;
  archetype_name?: string;
  streak_count?: number;
  last_mood?: string;
  bonus_searches?: number;
}

// ─── Template Pool ────────────────────────────────────────────────────────────

const DAILY_HOOK_TEMPLATES: Record<Locale, Array<{ title: string; body: string }>> = {
  en: [
    { title: 'What are you in the mood for? 🎬', body: 'Your morning film discovery awaits.' },
    { title: 'Morning coffee + cinema?', body: 'Discover a film that matches your mood today.' },
    { title: 'Today feels like a movie day', body: 'Tell us your mood, we will find the perfect film.' },
    { title: 'New day, new discoveries', body: 'What kind of story would lift you up today?' },
  ],
  tr: [
    { title: 'Bugün ne izlemek istersin? 🎬', body: 'Sabah film keşfin hazır.' },
    { title: 'Sabah kahvesi yanına bir film?', body: 'Bugünkü ruh haline uygun bir film keşfet.' },
    { title: 'Bugün film günü gibi hissettiriyor', body: 'Ruh halini söyle, mükemmel filmi bulalım.' },
    { title: 'Yeni gün, yeni keşifler', body: 'Bugün seni hangi hikaye heyecanlandırır?' },
  ],
};

const ARCHETYPE_DAILY_HOOKS: Record<Locale, Record<string, Array<{ title: string; body: string }>>> = {
  en: {
    'The Adrenaline Junkie': [
      { title: 'Need a rush today? 🔥', body: 'Your next adrenaline hit is one mood search away.' },
      { title: 'Action or thriller mood?', body: 'The edge-of-your-seat films are waiting.' },
    ],
    'The Hopeless Romantic': [
      { title: 'A love story awaits 💕', body: 'What is your romantic mood today?' },
      { title: 'Ready to feel something?', body: 'Discover a film that makes your heart skip.' },
    ],
    'The Mind-Bender': [
      { title: 'Time for a brain twist 🧠', body: 'Your next mind-bending discovery awaits.' },
      { title: 'Puzzle mood?', body: 'Find a film that will keep you thinking all day.' },
    ],
    'The Melancholy Soul': [
      { title: 'Feel something deep today', body: 'A cinematic journey into emotion awaits.' },
      { title: 'What moves you today?', body: 'Discover a film that resonates with your soul.' },
    ],
    'The Dark Passenger': [
      { title: 'Embrace the darkness 🌙', body: 'Your next suspenseful watch is waiting.' },
      { title: 'Ready for something eerie?', body: 'Discover a film that chills and thrills.' },
    ],
    'The Joy Seeker': [
      { title: 'Happiness incoming! ☀️', body: 'Start your day with a feel-good film pick.' },
      { title: 'Time for some good vibes', body: 'Find a film that brightens your day.' },
    ],
    'The Visual Poet': [
      { title: 'A visual feast awaits 🎨', body: 'Discover something beautiful to watch today.' },
      { title: 'Cinema as art', body: 'Find a visually stunning film for your mood.' },
    ],
    'The Nostalgia Keeper': [
      { title: 'A trip down memory lane', body: 'Discover a comforting classic for today.' },
      { title: 'Feeling nostalgic?', body: 'Find a film that wraps you in warmth.' },
    ],
    'The Zen Wanderer': [
      { title: 'A calm journey awaits 🌿', body: 'Find a meditative film for your mood today.' },
      { title: 'Peace through cinema', body: 'Discover a film that brings tranquility.' },
    ],
    'The Truth Seeker': [
      { title: 'Reality calls 📰', body: 'Discover a film that tells it like it is.' },
      { title: 'Hungry for truth?', body: 'Find a documentary or drama that exposes reality.' },
    ],
    'The Escapist': [
      { title: 'Ready to escape? 🚀', body: 'Your next adventure is a mood search away.' },
      { title: 'Another world awaits', body: 'Discover a fantastical film for today.' },
    ],
    'The Chaos Agent': [
      { title: 'Break the rules today 🔥', body: 'Find a film that defies expectations.' },
      { title: 'Anti-hero mood?', body: 'Discover a rebellious film that matches your energy.' },
    ],
  },
  tr: {
    'The Adrenaline Junkie': [
      { title: 'Bugün adrenalin lazım mı? 🔥', body: 'Bir sonraki heyecan dozun bir mood araması uzağında.' },
    ],
    'The Hopeless Romantic': [
      { title: 'Bir aşk hikayesi seni bekliyor 💕', body: 'Bugünkü romantik ruh halin ne?' },
    ],
    'The Mind-Bender': [
      { title: 'Beyin fırtınası zamanı 🧠', body: 'Bir sonraki zihin büken keşfin hazır.' },
    ],
    'The Melancholy Soul': [
      { title: 'Bugün derinden hisset', body: 'Duygusal bir sinema yolculuğu seni bekliyor.' },
    ],
    'The Dark Passenger': [
      { title: 'Karanlığı kucakla 🌙', body: 'Bir sonraki gerilim dolu filmin hazır.' },
    ],
    'The Joy Seeker': [
      { title: 'Mutluluk geliyor! ☀️', body: 'Güne güzel bir filmle başla.' },
    ],
    'The Visual Poet': [
      { title: 'Görsel bir şölen seni bekliyor 🎨', body: 'Bugün izleyecek güzel bir şey keşfet.' },
    ],
    'The Nostalgia Keeper': [
      { title: 'Geçmişe bir yolculuk', body: 'Bugün için rahatlatıcı bir klasik keşfet.' },
    ],
    'The Zen Wanderer': [
      { title: 'Sakin bir yolculuk seni bekliyor 🌿', body: 'Bugünkü ruh haline uygun meditasyon gibi bir film bul.' },
    ],
    'The Truth Seeker': [
      { title: 'Gerçeklik çağırıyor 📰', body: 'Olduğu gibi anlatan bir film keşfet.' },
    ],
    'The Escapist': [
      { title: 'Kaçmaya hazır mısın? 🚀', body: 'Bir sonraki maceran bir mood araması uzağında.' },
    ],
    'The Chaos Agent': [
      { title: 'Bugün kuralları yık 🔥', body: 'Beklentileri alt üst eden bir film bul.' },
    ],
  },
};

const SUNDAY_RITUAL_TEMPLATES: Record<Locale, Array<{ title: string; body: string }>> = {
  en: [
    { title: 'Sunday cinema ritual 🎬', body: '5 moods, 5 films. Which one is yours?' },
    { title: 'The week ends, the evening is yours', body: 'Set your mood and find tonight\'s film.' },
    { title: 'Sunday night film session', body: 'Perfect time to discover something special.' },
  ],
  tr: [
    { title: 'Pazar sinema ritüeli 🎬', body: '5 mood, 5 film. Hangisi senin?' },
    { title: 'Hafta bitiyor, akşam senin', body: 'Ruh halini ayarla ve bu akşamın filmini bul.' },
    { title: 'Pazar akşamı film seansı', body: 'Özel bir şey keşfetmek için mükemmel zaman.' },
  ],
};

const STREAK_WARNING_TEMPLATES: Record<Locale, Array<{ title: string; body: string }>> = {
  en: [
    { title: '%{streak}-day streak at risk! 🔥', body: 'One mood search keeps your streak alive.' },
    { title: 'Don\'t break the chain!', body: 'Your %{streak}-day streak needs you. Quick search?' },
  ],
  tr: [
    { title: '%{streak} günlük streak tehlikede! 🔥', body: '1 mood aramasıyla streak\'ini koru.' },
    { title: 'Zinciri kırma!', body: '%{streak} günlük streak\'in seni bekliyor. Hızlı bir arama?' },
  ],
};

const QUOTA_REFILL_TEMPLATES: Record<Locale, Array<{ title: string; body: string }>> = {
  en: [
    { title: 'Fresh searches ready! 🎬', body: 'New day, new discoveries. Your quota has been refilled.' },
    { title: 'Your searches are back', body: 'New day, new moods. Start discovering!' },
  ],
  tr: [
    { title: 'Yeni aramalar hazır! 🎬', body: 'Yeni gün, yeni keşifler. Kotan yenilendi.' },
    { title: 'Aramaların geri döndü', body: 'Yeni gün, yeni mood\'lar. Keşfetmeye başla!' },
  ],
};

const WINBACK_TEMPLATES: Record<Locale, Record<string, Array<{ title: string; body: string }>>> = {
  en: {
    winback_14: [
      { title: 'We miss you! 🎬', body: 'Here is 1 bonus search as a welcome-back gift.' },
      { title: 'Your film journey paused', body: 'Come back and discover something new — bonus search inside!' },
    ],
    winback_21: [
      { title: 'New films matching your taste!', body: '3 new films match your last mood. Come see!' },
    ],
    winback_30: [
      { title: 'Special offer: 50% off! 🎉', body: 'Welcome back with a limited-time discount. 48 hours only.' },
    ],
    winback_60: [
      { title: 'One tap to come back', body: 'Your watchlist is waiting. First search is on us.' },
    ],
  },
  tr: {
    winback_14: [
      { title: 'Seni özledik! 🎬', body: 'Hoş geldin hediyesi: 1 bonus arama hakkı.' },
      { title: 'Film yolculuğun durdu', body: 'Geri dön ve yeni şeyler keşfet — bonus arama seni bekliyor!' },
    ],
    winback_21: [
      { title: 'Zevkine uygun yeni filmler!', body: 'Son mood\'una uyan 3 yeni film eklendi. Gel gör!' },
    ],
    winback_30: [
      { title: 'Özel teklif: %50 indirim! 🎉', body: 'Sınırlı süreli indirimle geri dön. Sadece 48 saat.' },
    ],
    winback_60: [
      { title: 'Tek tıkla geri dön', body: 'Watchlist\'in bekliyor. İlk arama bizden.' },
    ],
  },
};

// ─── Template Generator ───────────────────────────────────────────────────────

/**
 * Pick a random template from an array.
 * Simple A/B: random selection ensures variety.
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Replace template variables: %{key} → value
 */
function interpolate(text: string, vars: Record<string, string | number>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`%\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Generate a notification template for the given type and context.
 *
 * @param type - Notification type
 * @param ctx - Personalization context
 * @returns Template with title, body, and optional data
 */
export function generateTemplate(
  type: NotificationType,
  ctx: TemplateContext,
): NotificationTemplate {
  const locale = ctx.locale;

  switch (type) {
    case 'daily_hook': {
      // Try archetype-specific first
      if (ctx.archetype_name) {
        const archetypeTemplates = ARCHETYPE_DAILY_HOOKS[locale]?.[ctx.archetype_name];
        if (archetypeTemplates && archetypeTemplates.length > 0) {
          const t = pickRandom(archetypeTemplates);
          return { title: t.title, body: t.body, data: { screen: 'mood' } };
        }
      }
      // Fallback to generic
      const t = pickRandom(DAILY_HOOK_TEMPLATES[locale]);
      return { title: t.title, body: t.body, data: { screen: 'mood' } };
    }

    case 'sunday_ritual': {
      const t = pickRandom(SUNDAY_RITUAL_TEMPLATES[locale]);
      return { title: t.title, body: t.body, data: { screen: 'mood' } };
    }

    case 'streak_warning': {
      const t = pickRandom(STREAK_WARNING_TEMPLATES[locale]);
      const vars = { streak: ctx.streak_count ?? 0 };
      return {
        title: interpolate(t.title, vars),
        body: interpolate(t.body, vars),
        data: { screen: 'mood' },
      };
    }

    case 'quota_refill': {
      const t = pickRandom(QUOTA_REFILL_TEMPLATES[locale]);
      return { title: t.title, body: t.body, data: { screen: 'mood' } };
    }

    case 'streak_reward': {
      const searches = ctx.bonus_searches ?? 0;
      const streak = ctx.streak_count ?? 0;
      if (locale === 'tr') {
        return {
          title: `${streak} günlük streak ödülü! 🎉`,
          body: `+${searches} bonus arama hakkı kazandın!`,
          data: { screen: 'profile' },
        };
      }
      return {
        title: `${streak}-day streak reward! 🎉`,
        body: `You earned +${searches} bonus searches!`,
        data: { screen: 'profile' },
      };
    }

    case 'winback_14':
    case 'winback_21':
    case 'winback_30':
    case 'winback_60': {
      const templates = WINBACK_TEMPLATES[locale]?.[type];
      if (templates && templates.length > 0) {
        const t = pickRandom(templates);
        const screen = type === 'winback_30' ? 'paywall' : 'mood';
        return { title: t.title, body: t.body, data: { screen } };
      }
      // Fallback
      return {
        title: locale === 'tr' ? 'Seni özledik!' : 'We miss you!',
        body: locale === 'tr' ? 'Film keşfine devam et.' : 'Continue your film journey.',
        data: { screen: 'mood' },
      };
    }

    default:
      return {
        title: 'Chosy.ai',
        body: locale === 'tr' ? 'Film keşfetmeye devam et!' : 'Keep discovering films!',
        data: { screen: 'mood' },
      };
  }
}

// ─── Quiet Hours ──────────────────────────────────────────────────────────────

/**
 * Check if the given hour (0-23) is within quiet hours (22:00-08:00).
 * Streak warning at 22:00 is an exception — handled by caller.
 */
export function isQuietHour(hour: number): boolean {
  return hour >= 22 || hour < 8;
}

/**
 * Calculate the next valid send time for a user's timezone.
 * Respects quiet hours by pushing to 08:00 next day.
 *
 * @param preferredHour - User's preferred notification hour (0-23)
 * @param timezone - User's timezone string
 * @returns ISO timestamp for next send time
 */
export function getNextSendTime(
  preferredHour: number,
  timezone: string,
): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const currentHourInTZ = parseInt(formatter.format(now), 10);

  // If preferred hour hasn't passed yet today, schedule for today
  // Otherwise schedule for tomorrow
  const daysToAdd = currentHourInTZ < preferredHour ? 0 : 1;

  const target = new Date(now);
  target.setDate(target.getDate() + daysToAdd);

  // Set to preferred hour in user's timezone (approximate — Edge Function handles precise scheduling)
  const hourDiff = preferredHour - currentHourInTZ;
  target.setHours(target.getHours() + hourDiff + (daysToAdd * 24));
  target.setMinutes(0, 0, 0);

  return target.toISOString();
}
