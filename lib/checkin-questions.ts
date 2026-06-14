/**
 * Daily check-in question bank.
 *
 * Each question is a short free-text prompt that the user answers in 1-2
 * sentences. Questions are organized by category so the picker can rotate
 * them by time-of-day and so the LLM interpreter can group them.
 *
 * IDs are stable strings (never renumber) so past `responses` JSONB values
 * keep mapping to the same question across app versions.
 */

export type CheckinCategory =
  | 'emotion'
  | 'energy'
  | 'connection'
  | 'work'
  | 'mind'
  | 'body'
  | 'tomorrow';

export interface CheckinQuestion {
  /** Stable identifier — never rename. */
  id: string;
  category: CheckinCategory;
  /** 1-2 sentence prompt shown to the user. */
  text: string;
  /** Italic hint shown inside the textarea as a placeholder. */
  placeholder: string;
  /** Material Symbols icon name (rendered as <span>). */
  icon: string;
  /** If 'number', renders a numeric input (e.g. hours slept, minutes outside)
   *  instead of the default textarea. */
  type?: 'number';
  /** Only used when type='number'. Unit label shown after the input. */
  unit?: string;
  /** Only used when type='number'. Minimum allowed value. */
  min?: number;
  /** Only used when type='number'. Maximum allowed value. */
  max?: number;
}

export const CHECKIN_CATEGORIES: Record<
  CheckinCategory,
  { label: string; tint: string; ink: string; icon: string }
> = {
  emotion:    { label: 'Emotion',    tint: '#F5E8E5', ink: '#D4786E', icon: 'favorite'    },
  energy:     { label: 'Energy',     tint: '#F8F2E0', ink: '#5A4620', icon: 'bolt'        },
  connection: { label: 'Connection', tint: '#E5EDE2', ink: '#3A6470', icon: 'diversity_3' },
  work:       { label: 'Work',       tint: '#E8E4D8', ink: '#3A3464', icon: 'work'        },
  mind:       { label: 'Mind',       tint: '#D8E8D0', ink: '#4A2E5A', icon: 'psychology'  },
  body:       { label: 'Body',       tint: '#EADDC8', ink: '#3A3464', icon: 'spa'         },
  tomorrow:   { label: 'Tomorrow',   tint: '#E5EDE2', ink: '#3A6470', icon: 'wb_twilight' },
};

export const CHECKIN_QUESTIONS: CheckinQuestion[] = [
  // EMOTION -----------------------------------------------------------
  { id: 'emotion.feel',         category: 'emotion', icon: 'favorite',
    text: "What's the strongest feeling sitting with you right now, and what brought it on?",
    placeholder: "A line is fine. The feeling, then what woke it up." },
  { id: 'emotion.color',        category: 'emotion', icon: 'palette',
    text: "If your mood today had a color and a shade, what would they be?",
    placeholder: "Something like: deep maroon, almost wine-dark." },
  { id: 'emotion.unsaid',       category: 'emotion', icon: 'chat_bubble',
    text: "What's something you felt today that you didn't say out loud?",
    placeholder: "One sentence is plenty." },
  { id: 'emotion.surprise',     category: 'emotion', icon: 'auto_awesome',
    text: "What surprised you about how you reacted to something today?",
    placeholder: "The reaction, then why it caught you off guard." },
  { id: 'emotion.recurring',    category: 'emotion', icon: 'loop',
    text: "What emotion keeps showing up this week, even when you don't want it to?",
    placeholder: "Name it, then say where you keep finding it." },
  { id: 'emotion.anxiety',      category: 'emotion', icon: 'tonality', type: 'number', unit: '/10', min: 1, max: 10,
    text: "On a scale of 1–10, how would you rate your anxiety level right now?",
    placeholder: "e.g. 6" },

  // ENERGY ------------------------------------------------------------
  { id: 'energy.location',      category: 'energy', icon: 'bolt',
    text: "Where in your body are you holding today's energy right now?",
    placeholder: "Chest, jaw, shoulders, gut — wherever you feel it." },
  { id: 'energy.drain_refill',  category: 'energy', icon: 'battery_2_bar',
    text: "What's the smallest thing that drained you today? And the smallest thing that refilled you?",
    placeholder: "Two sentences. One that took, one that gave back." },
  { id: 'energy.extra_hour',    category: 'energy', icon: 'hourglass_top',
    text: "If you had one extra hour of energy, what would you spend it on?",
    placeholder: "Be honest. Nobody's watching." },
  { id: 'energy.morning_vs_now',category: 'energy', icon: 'wb_sunny',
    text: "How does your body feel different right now than when you woke up?",
    placeholder: "Compare the two. Loose or tight, slow or buzzy." },

  // CONNECTION --------------------------------------------------------
  { id: 'connection.missed',    category: 'connection', icon: 'diversity_3',
    text: "Who crossed your mind today that you wish you'd reached out to?",
    placeholder: "Just the name is fine, or a line about why." },
  { id: 'connection.alive',     category: 'connection', icon: 'forum',
    text: "What's the most alive conversation you had today, and what made it alive?",
    placeholder: "The moment, and what you think sparked it." },
  { id: 'connection.seen',      category: 'connection', icon: 'visibility',
    text: "Where did you feel most seen today, and by whom?",
    placeholder: "One sentence, two if you want to be specific." },
  { id: 'connection.unthanked', category: 'connection', icon: 'volunteer_activism',
    text: "What did someone do for you today that you haven't thanked them for yet?",
    placeholder: "A small thing counts. Especially a small thing." },

  // WORK --------------------------------------------------------------
  { id: 'work.matter_vs_noise', category: 'work', icon: 'work',
    text: "What part of your work today felt like it actually mattered, and what felt like noise?",
    placeholder: "One line for each side of that scale." },
  { id: 'work.finished',        category: 'work', icon: 'check_circle',
    text: "What's one thing you finished today that you can be quietly proud of?",
    placeholder: "Quiet is the point. No announcement needed." },
  { id: 'work.avoiding',        category: 'work', icon: 'priority_high',
    text: "What's something you're avoiding right now that you already know is the right next step?",
    placeholder: "Name it. You don't have to do it today." },
  { id: 'work.schedule_feel',   category: 'work', icon: 'calendar_month',
    text: "How did your schedule feel today — packed, balanced, or too slow?",
    placeholder: "A word, then why. E.g. Packed — back-to-back with no gaps." },
  { id: 'work.breaks',          category: 'work', icon: 'free_breakfast',
    text: "Did you manage to take any real breaks today — away from screens and tasks?",
    placeholder: "What you did and for how long, or why you couldn't." },

  // MIND --------------------------------------------------------------
  { id: 'mind.remember',        category: 'mind', icon: 'bookmark',
    text: "What's a small moment from today that you'd like to remember a year from now?",
    placeholder: "A snapshot, a sound, a half-sentence someone said." },
  { id: 'mind.learned',         category: 'mind', icon: 'school',
    text: "What's something you learned about yourself today, even if it's uncomfortable?",
    placeholder: "Discomfort usually means it's real." },
  { id: 'mind.chapter',         category: 'mind', icon: 'menu_book',
    text: "If today had a chapter title, what would it be?",
    placeholder: "Two or three words, a colon, another line. Whatever lands." },
  { id: 'mind.clarity',         category: 'mind', icon: 'blur_on', type: 'number', unit: '/10', min: 1, max: 10,
    text: "How clear does your thinking feel right now — 1 being foggy, 10 being razor-sharp?",
    placeholder: "e.g. 6" },
  { id: 'mind.self_talk',       category: 'mind', icon: 'record_voice_over',
    text: "What was the tone of your inner voice today — kind, critical, neutral?",
    placeholder: "A word or two, then a line about what it was saying." },

  // BODY --------------------------------------------------------------
  { id: 'body.needs',           category: 'body', icon: 'spa',
    text: "How well did your body get what it needed today — sleep, food, water, movement?",
    placeholder: "A short grade, then the honest footnote." },
  { id: 'body.sleep_hours',     category: 'body', icon: 'bedtime', type: 'number', unit: 'hours', min: 0, max: 24,
    text: "How many hours of sleep did you get last night?",
    placeholder: "e.g. 7.5" },
  { id: 'body.sleep_quality',   category: 'body', icon: 'hotel', type: 'number', unit: '/10', min: 1, max: 10,
    text: "How restorative was your sleep last night — 1 being restless, 10 being deeply restorative?",
    placeholder: "e.g. 7" },
  { id: 'body.outdoor_minutes', category: 'body', icon: 'nature', type: 'number', unit: 'minutes', min: 0, max: 1440,
    text: "How many minutes did you spend outside today?",
    placeholder: "e.g. 45" },
  { id: 'body.exercise_minutes',category: 'body', icon: 'fitness_center', type: 'number', unit: 'minutes', min: 0, max: 300,
    text: "How many minutes of exercise or intentional movement did you get today?",
    placeholder: "e.g. 30" },
  { id: 'body.meals',           category: 'body', icon: 'restaurant', type: 'number', unit: 'meals', min: 0, max: 10,
    text: "How many proper meals or snacks did you eat today?",
    placeholder: "e.g. 3" },
  { id: 'body.sensation',       category: 'body', icon: 'self_improvement',
    text: "What physical sensation have you been ignoring that you'd like to listen to?",
    placeholder: "Tight chest, shallow breath, tired eyes, a knot somewhere." },
  { id: 'body.substances',      category: 'body', icon: 'science',
    text: "How much caffeine or alcohol did you have today — rough estimate is fine.",
    placeholder: "One or two cups of coffee, a glass of wine, none, etc." },

  // TOMORROW ----------------------------------------------------------
  { id: 'tomorrow.different',   category: 'tomorrow', icon: 'wb_twilight',
    text: "What's one small thing you'd like to be different about tomorrow?",
    placeholder: "Small is the goal. Specific is even better." },
  { id: 'tomorrow.good_enough', category: 'tomorrow', icon: 'bedtime',
    text: "What would 'good enough' look like for tomorrow, so you can stop aiming for perfect?",
    placeholder: "A line is enough. Pick the floor, not the ceiling." },
];

/** All questions in a category, in display order. */
export function questionsInCategory(c: CheckinCategory): CheckinQuestion[] {
  return CHECKIN_QUESTIONS.filter((q) => q.category === c);
}

/** Quick lookup by id. */
export function getQuestion(id: string): CheckinQuestion | undefined {
  return CHECKIN_QUESTIONS.find((q) => q.id === id);
}

/**
 * Deterministically pick N questions for a given user + date. Same user, same
 * day → same questions, so a refresh shows the same set. Different days
 * rotate through the bank.
 */
export function pickDailyQuestions(seed: string, count = 12): CheckinQuestion[] {
  const ordered = [...CHECKIN_QUESTIONS];
  // Seeded shuffle (mulberry32)
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h |= 0;
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  // Try to spread across categories so the user doesn't get 5 work questions.
  const picked: CheckinQuestion[] = [];
  const usedCategory = new Set<CheckinCategory>();
  for (const q of ordered) {
    if (picked.length >= count) break;
    if (!usedCategory.has(q.category)) {
      picked.push(q);
      usedCategory.add(q.category);
    }
  }
  // If we still have slots, fill from the remaining pool.
  for (const q of ordered) {
    if (picked.length >= count) break;
    if (!picked.includes(q)) picked.push(q);
  }
  return picked;
}
