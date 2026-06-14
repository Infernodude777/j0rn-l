'use client';

/**
 * Lightweight local data layer that mimics the Supabase shape. Used when
 * Supabase env vars are not configured so the app can be demoed end-to-end
 * without external services. Data is persisted to localStorage on the client
 * and mirrored to a cookie so server routes can resolve the active user.
 */

import type {
  ConnectedAccount,
  DailyCheckin,
  JournalEntry,
  Notification,
  Profile,
  TrustedContact,
  UserSettings,
  WeeklyInsight,
  DailyCheckinPromptSet,
  WellnessScore,
} from '@/lib/types';
import { daysAgoISO, todayISO, uid } from '@/lib/utils';

const STORAGE_KEY = 'j0rn@l.local.v1';
const SESSION_KEY = 'j0rn@l.local.session';
const SESSION_COOKIE = 'j0rn@l.local.session';

interface DBShape {
  profiles: Record<string, Profile>;
  daily_checkins: DailyCheckin[];
  journal_entries: JournalEntry[];
  weekly_insights: WeeklyInsight[];
  checkin_prompt_sets: Record<string, DailyCheckinPromptSet>;
  connected_accounts: ConnectedAccount[];
  notifications: Notification[];
  user_settings: Record<string, UserSettings>;
  trusted_contacts: TrustedContact[];
  wellness_scores: WellnessScore[];
}

function emptyDB(): DBShape {
  return {
    profiles: {},
    daily_checkins: [],
    journal_entries: [],
    weekly_insights: [],
    checkin_prompt_sets: {},
    connected_accounts: [],
    notifications: [],
    user_settings: {},
    trusted_contacts: [],
    wellness_scores: [],
  };
}

let dbCache: DBShape | null = null;

function readDB(): DBShape {
  if (typeof window === 'undefined') return emptyDB();
  if (dbCache) return dbCache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      dbCache = emptyDB();
      return dbCache;
    }
    dbCache = JSON.parse(raw) as DBShape;
    return dbCache;
  } catch {
    dbCache = emptyDB();
    return dbCache;
  }
}

function writeDB(db: DBShape) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  dbCache = db;
}

function writeSessionCookie(userId: string, email: string) {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(JSON.stringify({ userId, email }));
  document.cookie = `${SESSION_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export const localSession = {
  get(): { userId: string; email: string } | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(userId: string, email: string) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, email }));
    writeSessionCookie(userId, email);
  },
  clear() {
    window.localStorage.removeItem(SESSION_KEY);
    clearSessionCookie();
    dbCache = null;
  },
};

export const localDB = {
  reset() {
    dbCache = emptyDB();
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    localSession.clear();
  },
  allUserIds(): string[] {
    return Object.keys(readDB().profiles);
  },
  getProfile(userId: string): Profile | null {
    return readDB().profiles[userId] ?? null;
  },
  upsertProfile(p: Profile) {
    const db = readDB();
    db.profiles[p.id] = { ...p, updated_at: new Date().toISOString() };
    writeDB(db);
  },
  getSettings(userId: string): UserSettings {
    const db = readDB();
    return (
      db.user_settings[userId] ?? {
        id: uid(),
        user_id: userId,
        checkin_reminder_time: '20:00',
        checkin_reminder_enabled: true,
        notifications_enabled: true,
        theme: 'light',
        units: 'metric',
        ai_insights_enabled: true,
        private_mode: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );
  },
  saveSettings(s: UserSettings) {
    const db = readDB();
    db.user_settings[s.user_id] = { ...s, updated_at: new Date().toISOString() };
    writeDB(db);
  },
  listCheckins(userId: string, fromDate?: string): DailyCheckin[] {
    return readDB()
      .daily_checkins.filter((c) => c.user_id === userId && (!fromDate || c.date >= fromDate))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  getCheckin(userId: string, date: string): DailyCheckin | null {
    return readDB().daily_checkins.find((c) => c.user_id === userId && c.date === date) ?? null;
  },
  upsertCheckin(c: DailyCheckin) {
    const db = readDB();
    const idx = db.daily_checkins.findIndex(
      (x) => x.user_id === c.user_id && x.date === c.date,
    );
    if (idx >= 0) db.daily_checkins[idx] = { ...c, updated_at: new Date().toISOString() };
    else db.daily_checkins.push(c);
    writeDB(db);
  },
  listJournal(userId: string): JournalEntry[] {
    return readDB()
      .journal_entries.filter((j) => j.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  getJournal(id: string): JournalEntry | null {
    return readDB().journal_entries.find((j) => j.id === id) ?? null;
  },
  upsertJournal(j: JournalEntry) {
    const db = readDB();
    const idx = db.journal_entries.findIndex((x) => x.id === j.id);
    if (idx >= 0) db.journal_entries[idx] = { ...j, updated_at: new Date().toISOString() };
    else db.journal_entries.unshift(j);
    writeDB(db);
  },
  deleteJournal(id: string) {
    const db = readDB();
    db.journal_entries = db.journal_entries.filter((j) => j.id !== id);
    writeDB(db);
  },
  listInsights(userId: string): WeeklyInsight[] {
    return readDB()
      .weekly_insights.filter((i) => i.user_id === userId)
      .sort((a, b) => b.week_start.localeCompare(a.week_start));
  },
  getCheckinPromptSet(userId: string, date: string): DailyCheckinPromptSet | null {
    return readDB().checkin_prompt_sets[`${userId}:${date}`] ?? null;
  },
  upsertCheckinPromptSet(set: Omit<DailyCheckinPromptSet, 'created_at' | 'updated_at'> & Partial<Pick<DailyCheckinPromptSet, 'created_at' | 'updated_at'>>) {
    const db = readDB();
    const key = `${set.user_id}:${set.date}`;
    const existing = db.checkin_prompt_sets[key];
    db.checkin_prompt_sets[key] = {
      ...existing,
      ...set,
      created_at: existing?.created_at ?? set.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    writeDB(db);
  },
  saveInsight(i: WeeklyInsight) {
    const db = readDB();
    const idx = db.weekly_insights.findIndex((x) => x.user_id === i.user_id && x.week_start === i.week_start);
    if (idx >= 0) db.weekly_insights[idx] = i;
    else db.weekly_insights.unshift(i);
    writeDB(db);
  },
  listConnected(userId: string): ConnectedAccount[] {
    return readDB().connected_accounts.filter((a) => a.user_id === userId);
  },
  upsertConnected(a: ConnectedAccount) {
    const db = readDB();
    const idx = db.connected_accounts.findIndex(
      (x) => x.user_id === a.user_id && x.provider === a.provider,
    );
    if (idx >= 0) db.connected_accounts[idx] = { ...a, updated_at: new Date().toISOString() };
    else db.connected_accounts.push(a);
    writeDB(db);
  },
  listNotifications(userId: string): Notification[] {
    return readDB()
      .notifications.filter((n) => n.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  upsertNotification(n: Notification) {
    const db = readDB();
    const idx = db.notifications.findIndex((x) => x.id === n.id);
    if (idx >= 0) db.notifications[idx] = n;
    else db.notifications.unshift(n);
    writeDB(db);
  },
  listWellnessScores(userId: string, fromDate?: string): WellnessScore[] {
    return readDB()
      .wellness_scores.filter((s) => s.user_id === userId && (!fromDate || s.date >= fromDate))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  upsertWellnessScore(s: WellnessScore) {
    const db = readDB();
    const idx = db.wellness_scores.findIndex(
      (x) => x.user_id === s.user_id && x.date === s.date,
    );
    if (idx >= 0) db.wellness_scores[idx] = s;
    else db.wellness_scores.push(s);
    writeDB(db);
  },
  listTrustedContacts(userId: string): TrustedContact[] {
    return readDB().trusted_contacts.filter((c) => c.user_id === userId);
  },
  upsertTrustedContact(c: TrustedContact) {
    const db = readDB();
    const idx = db.trusted_contacts.findIndex((x) => x.id === c.id);
    if (idx >= 0) db.trusted_contacts[idx] = c;
    else db.trusted_contacts.push(c);
    writeDB(db);
  },
  deleteTrustedContact(id: string) {
    const db = readDB();
    db.trusted_contacts = db.trusted_contacts.filter((c) => c.id !== id);
    writeDB(db);
  },
};

/**
 * Seed a fresh local database with a small set of realistic entries so the
 * dashboard / trends / insights pages have something to render.
 */
export function seedLocalData(userId: string, name: string, email: string) {
  const db = readDB();
  if (db.profiles[userId]) return; // already seeded

  const now = new Date().toISOString();
  db.profiles[userId] = {
    id: userId,
    name,
    email,
    age: 28,
    height_cm: 178,
    weight_kg: 72,
    region: 'United States',
    timezone: 'GMT -5 (EST)',
    occupation: 'Product Designer',
    sleep_goal_hours: 8,
    resting_hr: 62,
    exercise_freq: '2-3',
    work_schedule: 'standard',
    typical_stress: 'moderate',
    outdoor_hours: 1.5,
    onboarding_complete: true,
    avatar_url: null,
    created_at: now,
    updated_at: now,
  };
  db.user_settings[userId] = {
    id: uid(),
    user_id: userId,
    checkin_reminder_time: '20:00',
    checkin_reminder_enabled: true,
    notifications_enabled: true,
    theme: 'light',
    units: 'metric',
    ai_insights_enabled: true,
    private_mode: false,
    created_at: now,
    updated_at: now,
  };

  // 21 days of check-ins
  const checkins: DailyCheckin[] = [];
  for (let i = 20; i >= 0; i--) {
    const date = daysAgoISO(i);
    const mood = 6 + Math.round(Math.sin(i / 3) * 2 + (i % 2 ? 0.5 : -0.5));
    const stress = 5 + Math.round(Math.cos(i / 4) * 2);
    const energy = 6 + Math.round(Math.sin(i / 2) * 1.5);
    const focus = 6 + Math.round(Math.cos(i / 3) * 1.5);
    const social = 6 + Math.round(Math.sin(i / 5) * 2);
    const outdoor = 30 + Math.round(Math.cos(i / 3) * 30);
    const sleep = 7 + Math.sin(i / 2) * 0.8;
    checkins.push({
      id: uid(),
      user_id: userId,
      date,
      mood: Math.max(1, Math.min(10, mood)),
      stress: Math.max(1, Math.min(10, stress)),
      energy: Math.max(1, Math.min(10, energy)),
      focus: Math.max(1, Math.min(10, focus)),
      outdoor_minutes: Math.max(0, outdoor),
      social_connection: Math.max(1, Math.min(10, social)),
      rest_hours: Math.max(4, sleep),
      work_pressure: Math.max(1, Math.min(10, 5 + Math.round(Math.sin(i / 3) * 2))),
      sleep_hours: Math.max(4, sleep),
      notes: i % 4 === 0 ? 'Felt focused and steady today.' : null,
      responses: i % 4 === 0
        ? {
            'emotion.feel': 'A quiet, steady feeling. Coffee by the window did most of the work.',
            'energy.drain_refill': 'Drained by a long email thread. Refilled by a 20-minute walk.',
            'connection.alive': 'Lunch with a friend. We laughed about something old.',
          }
        : {},
      interpretation: i % 4 === 0
        ? 'Today reads as a calm middle of the road day. You found a little connection and a little movement, and both showed up in the reflection.'
        : null,
      interpretation_meta: i % 4 === 0
        ? {
            mood: 6, energy: 6, stress: 5, connection: 7, rest: 6, purpose: 6,
            themes: ['connection', 'energy'],
            generated_at: now,
          }
        : { mood: 0, energy: 0, stress: 0, connection: 0, rest: 0, purpose: 0, themes: [], generated_at: null },
      created_at: now,
      updated_at: now,
    });
  }
  db.daily_checkins.push(...checkins);

  // 6 journal entries
  const journals: JournalEntry[] = [];
  for (let i = 0; i < 6; i++) {
    const date2 = new Date();
    date2.setDate(date2.getDate() - i * 2);
    journals.push({
      id: uid(),
      user_id: userId,
      title: ['A slow morning', 'Long walk after lunch', 'Hard focus block', 'Quiet evening', 'Reset day', 'Big meeting'][i],
      body: [
        'Slept better than I have in weeks. Coffee and a journal by the window.',
        'Got out for a 40-minute walk. Even bumped into a colleague and chatted about nothing in particular.',
        'Knocked out two design reviews in the morning. Felt sharp but drained by 4pm.',
        'Cooked dinner, no phone, finished a book. The kind of evening that resets the week.',
        'Hit a wall early. Cancelled evening plans and just rested. No guilt.',
        'High-stakes presentation. Nerves were up but the team pulled it together.',
      ][i]!,
      mood: 6 + (i % 3),
      tags: [['morning', 'rest'], ['outdoors'], ['work', 'focus'], ['evening'], ['rest', 'reset'], ['work']][i]!,
      photo_urls: [],
      voice_note_url: null,
      sentiment: [0.4, 0.5, 0.2, 0.6, 0.1, 0.3][i]!,
      source: 'web',
      external_id: null,
      external_meta: {},
      created_at: date2.toISOString(),
      updated_at: date2.toISOString(),
    });
  }
  db.journal_entries.push(...journals);

  (['apple_health', 'google_fit', 'fitbit', 'oura', 'garmin', 'strava'] as const).forEach((p) => {
    db.connected_accounts.push({
      id: uid(),
      user_id: userId,
      provider: p,
      status: 'disconnected',
      connected_at: null,
      last_sync_at: null,
      metadata: {},
      created_at: now,
      updated_at: now,
    });
  });

  db.weekly_insights.push({
    id: uid(),
    user_id: userId,
    week_start: daysAgoISO(6),
    week_end: todayISO(),
    summary: 'A steady week. Sleep averaged 7h 20m and outdoor time trended upward.',
    patterns: ['Outdoor time correlates with lower stress', 'Sleep dips slightly on work-heavy days'],
    contributing_factors: ['Two consecutive late meetings on Wednesday', 'A long walk on Thursday afternoon'],
    reflection_questions: ['What helped Thursday feel lighter?', 'Could you protect a 30-minute walk most days?'],
    suggestions: ['Block a 30-minute walk after lunch', 'Move the recurring sync out of the 4pm slot'],
    metrics_snapshot: { sleep: 7.3, stress: 4.6, mood: 6.8, outdoor: 42 },
    created_at: now,
  });

  writeDB(db);
}

// ============================================================
//  ADMIN ACCOUNT — dramatic 30-day decline demo data
// ============================================================

export const ADMIN_USER_ID = 'admin';
export const ADMIN_EMAIL = 'admin@local.test';
export const ADMIN_NAME = 'Admin';
export const ADMIN_PASSWORD = 'admin';

// --- Calm, reflective responses (days 30–15) ---------------------------
const ADMIN_CALM_RESPONSES: { qid: string; text: string }[] = [
  { qid: 'emotion.feel',         text: 'A quiet, steady warmth. Morning coffee by the window, sun coming through the leaves. Everything feels in its right place.' },
  { qid: 'emotion.feel',         text: 'Genuinely content. Nothing dramatic — just a sense that things are where they belong. Grateful for the small rhythms.' },
  { qid: 'emotion.feel',         text: 'Light. Almost buoyant. Had a good conversation with a friend and it carried me through the afternoon.' },
  { qid: 'emotion.color',        text: 'Soft butter yellow. Warm, easy, no sharp edges. The color of a slow Saturday morning.' },
  { qid: 'emotion.color',        text: 'Gentle sage green. Calm and grounded, like sitting under a tree with a book.' },
  { qid: 'emotion.unsaid',       text: 'I wanted to tell my partner how much I appreciate them making coffee every morning. I should say it out loud tomorrow.' },
  { qid: 'emotion.surprise',     text: 'I laughed out loud at a small thing my coworker said. It surprised me how easily the joy came today.' },
  { qid: 'emotion.recurring',    text: 'A quiet gratitude keeps showing up. Even on busy days, I notice the small things — sunlight, a good song, a warm meal.' },
  { qid: 'emotion.anxiety',      text: '3' },
  { qid: 'emotion.anxiety',      text: '2' },
  { qid: 'emotion.anxiety',      text: '4' },
  { qid: 'energy.location',      text: 'My chest, in a good way. Like something opened up mid-afternoon and the whole body relaxed into it.' },
  { qid: 'energy.drain_refill',  text: 'Drained by a long meeting. Refilled by a 20-minute walk around the block with music on.' },
  { qid: 'energy.extra_hour',    text: 'I would sit on the floor and read a novel, uninterrupted. Maybe with tea. Maybe with the cat.' },
  { qid: 'connection.alive',     text: 'Lunch with a friend. We laughed about something from years ago and it felt like no time had passed at all.' },
  { qid: 'connection.seen',      text: 'My partner asked how I was really doing — not the surface version. I didn\'t even have to answer. Just being asked was enough.' },
  { qid: 'work.matter_vs_noise', text: 'Mattered: sketching a new idea on paper and watching it click. Noise: the two status meetings that could have been emails.' },
  { qid: 'work.finished',        text: 'Finally submitted the proposal I\'d been polishing for weeks. Quietly proud. Treated myself to a pastry.' },
  { qid: 'work.schedule_feel',   text: 'Balanced — had space between meetings to breathe.' },
  { qid: 'work.schedule_feel',   text: 'Felt productive but not rushed. A good pace.' },
  { qid: 'work.breaks',          text: 'Took a 15-minute walk after lunch. It helped reset.' },
  { qid: 'work.breaks',          text: 'Yes — stepped away for tea and sat by the window.' },
  { qid: 'mind.remember',        text: 'The way the light hit the kitchen table this morning. Golden and slow. I stopped for a full minute just to watch it.' },
  { qid: 'mind.chapter',         text: 'Chapter: The week everything felt lighter. Or: When I remembered to pause before reacting.' },
  { qid: 'mind.clarity',         text: '7' },
  { qid: 'mind.clarity',         text: '8' },
  { qid: 'mind.self_talk',       text: 'Kind. I noticed when my inner critic started and chose a gentler tone.' },
  { qid: 'mind.self_talk',       text: 'Supportive. I told myself "you\'re doing okay" and it helped.' },
  { qid: 'body.needs',           text: 'Sleep A-, food B+, water B, movement A. A strong week for the body. The morning walks are really paying off.' },
  { qid: 'body.sleep_quality',   text: '8' },
  { qid: 'body.sleep_quality',   text: '7' },
  { qid: 'body.exercise_minutes',text: '30' },
  { qid: 'body.exercise_minutes',text: '45' },
  { qid: 'body.meals',           text: '3' },
  { qid: 'body.meals',           text: '4' },
  { qid: 'body.substances',      text: 'One cup of coffee in the morning, none after noon.' },
  { qid: 'body.substances',      text: 'Just a morning coffee. No alcohol.' },
  { qid: 'tomorrow.different',   text: 'One more walk. One more moment of pausing before checking my phone. Small, specific, doable.' },
];

// --- Aggressive, upset, ranting responses (days 14–0) --------------------
const ADMIN_AGGRESSIVE_RESPONSES: { qid: string; text: string }[] = [
  { qid: 'emotion.feel',         text: 'Furious. For no good reason. Everything is irritating — the email, the noise, the way people talk. I want to scream.' },
  { qid: 'emotion.feel',         text: 'Empty and angry at the same time. How is that possible? Nothing happened but everything feels wrong.' },
  { qid: 'emotion.feel',         text: 'Just over it. Over the meetings, the small talk, the pretending. What is even the point of any of this.' },
  { qid: 'emotion.color',        text: 'Muddy brown. Not even a dramatic angry red — just dull, heavy, like wet dirt that won\'t wash off.' },
  { qid: 'emotion.color',        text: 'Dark gray. The color of a screen at 3am when you can\'t sleep and you don\'t know why you\'re still awake.' },
  { qid: 'emotion.unsaid',       text: 'I wanted to tell my boss that the project is a mess and nobody is listening. But what\'s the point. Nobody cares.' },
  { qid: 'emotion.recurring',    text: 'Irritation. Constant low-level irritation at everyone and everything. The coffee was too hot. The email was too long. Just leave me alone.' },
  { qid: 'emotion.recurring',    text: 'This heavy, flat nothing. Not sadness exactly. Just... nothing matters. Haven\'t felt excited about anything in weeks.' },
  { qid: 'emotion.anxiety',      text: '8' },
  { qid: 'emotion.anxiety',      text: '9' },
  { qid: 'emotion.anxiety',      text: '7' },
  { qid: 'energy.location',      text: 'Shoulders and jaw. Clenched all day. Even when I notice it, I can\'t unclench. My whole body is a fist.' },
  { qid: 'energy.drain_refill',  text: 'Drained by literally everything. Refilled by nothing. There is no refill. Just more drain.' },
  { qid: 'energy.morning_vs_now',text: 'Woke up tired. Still tired. The same knot in my chest from yesterday is still there. Nothing changed.' },
  { qid: 'connection.missed',    text: 'Nobody. I don\'t want to talk to anyone. Everyone feels far away and I don\'t have the energy to bridge it.' },
  { qid: 'connection.alive',     text: 'Can\'t remember the last alive conversation. Everything feels transactional. "How are you" "Fine" — nobody means it.' },
  { qid: 'work.matter_vs_noise', text: 'Mattered: zero. Noise: everything. Four hours of meetings about nothing. What am I even doing here.' },
  { qid: 'work.avoiding',        text: 'Everything. There is a mountain of things I should do and I can\'t start any of them. Just staring at the screen.' },
  { qid: 'work.schedule_feel',   text: 'Packed and suffocating. No gaps, no air, no mercy.' },
  { qid: 'work.schedule_feel',   text: 'Endless. One meeting bled into the next into the next.' },
  { qid: 'work.breaks',          text: 'Break? What break. Didn\'t even eat lunch.' },
  { qid: 'work.breaks',          text: 'No. Couldn\'t justify stopping when everything is behind.' },
  { qid: 'mind.remember',        text: 'Can\'t think of anything worth remembering. Today was a blur of irritation and exhaustion. No highlights.' },
  { qid: 'mind.chapter',         text: 'Chapter: The part where I stopped caring. Or: When the colors all turned to gray.' },
  { qid: 'mind.clarity',         text: '3' },
  { qid: 'mind.clarity',         text: '2' },
  { qid: 'mind.self_talk',       text: 'Critical. Everything I did today wasn\'t enough.' },
  { qid: 'mind.self_talk',       text: 'Harsh. My inner voice is exhausted and taking it out on me.' },
  { qid: 'body.needs',           text: 'Sleep D, food C (forgot lunch again), water D, movement F. My body is running on fumes and I don\'t care enough to fix it.' },
  { qid: 'body.sleep_quality',   text: '2' },
  { qid: 'body.sleep_quality',   text: '3' },
  { qid: 'body.exercise_minutes',text: '0' },
  { qid: 'body.exercise_minutes',text: '0' },
  { qid: 'body.meals',           text: '1' },
  { qid: 'body.meals',           text: '2' },
  { qid: 'body.substances',      text: 'Three cups of coffee and a glass of wine. Or was it two glasses.' },
  { qid: 'body.substances',      text: 'Too much caffeine. Can\'t sleep. So I drink more coffee. Vicious cycle.' },
  { qid: 'tomorrow.different',   text: 'I don\'t know. Everything. Nothing. I want to wake up and not feel this heavy. But I don\'t know how to make that happen.' },
];

// --- 19 journal entries spanning 32 days with clear emotional decline ----
const ADMIN_JOURNALS: { title: string; body: string; mood: number; tags: string[]; sentiment: number; daysAgo: number }[] = [
  // EARLY MONTH — calm, reflective, grateful (days 31–18)
  { daysAgo: 31, title: 'Reset morning',            body: 'A quiet coffee and a long look at the window. I am trying to keep the mornings slower so the rest of the day does not rush me. It felt good to write a full page before checking anything else.', mood: 8, tags: ['morning', 'reflection', 'calm'], sentiment: 0.78 },
  { daysAgo: 30, title: 'Sunday stillness',          body: 'Woke up without an alarm. Made coffee, sat by the window, watched the light move across the floor for what felt like an hour. The cat curled up next to me. I wrote three pages in my notebook — nothing important, just thoughts about the garden, a book I\'m reading, a recipe I want to try. This is the kind of morning I want to protect. The world feels soft and manageable right now.', mood: 9, tags: ['morning', 'gratitude', 'reflection'], sentiment: 0.85 },
  { daysAgo: 29, title: 'Sunday stillness',          body: 'Woke up without an alarm. Made coffee, sat by the window, watched the light move across the floor for what felt like an hour. The cat curled up next to me. I wrote three pages in my notebook — nothing important, just thoughts about the garden, a book I\'m reading, a recipe I want to try. This is the kind of morning I want to protect. The world feels soft and manageable right now.', mood: 9, tags: ['morning', 'gratitude', 'reflection'], sentiment: 0.85 },
  { daysAgo: 27, title: 'The long walk',              body: 'Took the long way home through the park. The trees are starting to turn — golds and deep oranges. I stopped to watch a dog chase a frisbee and realized I was smiling without meaning to. Called my sister on the walk back. We talked for 40 minutes about nothing and everything. She said I sounded lighter than last month. I think she was right.', mood: 8, tags: ['outdoors', 'connection', 'gratitude', 'nature'], sentiment: 0.75 },
  { daysAgo: 25, title: 'A good day at work',         body: 'Presented the research findings to the team and it actually landed. People asked good questions. Someone said "this changes how I think about the problem" and I quietly filed that away. Came home, cooked a real dinner — pasta with lemon and herbs — and ate it at the table instead of in front of my laptop. These are the days that remind me why I do this work.', mood: 8, tags: ['work', 'accomplishment', 'food'], sentiment: 0.7 },
  { daysAgo: 23, title: 'Evening with friends',       body: 'Had Sam and Jordan over for dinner. Made too much food. Nobody cared. We sat on the porch until midnight talking about childhood stories and terrible movies and the kind of future we want to build. Jordan said "this is the most myself I\'ve felt all week" and I knew exactly what they meant. Grateful for these people. Grateful for this life.', mood: 9, tags: ['social', 'connection', 'gratitude', 'food'], sentiment: 0.9 },
  { daysAgo: 21, title: 'Morning pages',              body: 'Started the day with journaling before checking my phone. Wrote about the dream I had — something about flying over a city made of glass. Wrote about what I\'m looking forward to this week. Wrote about how proud I am of the last project. The practice feels like a small anchor. I want to keep this habit. It makes the whole day feel more intentional.', mood: 8, tags: ['morning', 'reflection', 'habit'], sentiment: 0.7 },
  { daysAgo: 19, title: 'Quiet gratitude',            body: 'Not a remarkable day by any measure. But I noticed the small things: the way the barista remembered my order, the text from my mom, the sunset that caught me off guard on the drive home. I think this is what people mean when they say happiness is a practice. It\'s not about big moments — it\'s about noticing the small ones before they pass.', mood: 8, tags: ['gratitude', 'reflection', 'ordinary'], sentiment: 0.75 },
  { daysAgo: 17, title: 'A creative spark',           body: 'Had an idea for a side project during my morning walk — something small, just for fun. Spent an hour sketching it out after work. No pressure, no deadline, just the joy of making something. Why don\'t I do this more often? It felt like remembering a part of myself I\'d forgotten. Going to protect one hour a week for this.', mood: 8, tags: ['creativity', 'inspiration', 'reflection'], sentiment: 0.8 },

  // MID MONTH — things start to fray (days 16–10)
  { daysAgo: 15, title: 'The first crack',            body: 'Something felt off today. Nothing specific happened — work was fine, nobody was difficult — but there was this low hum of tension I couldn\'t shake. Snapped at Sam over something stupid (whose turn it was to take out the trash, of all things). Apologized immediately but the sting lingered. Maybe I\'m more tired than I realize.', mood: 6, tags: ['tension', 'relationships', 'reflection'], sentiment: 0.2 },
  { daysAgo: 13, title: 'Couldn\'t sleep',             body: 'Lay awake until 2am staring at the ceiling. My brain wouldn\'t shut off — replaying conversations, worrying about deadlines, cycling through everything I should have said or done differently. Got up and made tea. Sat in the dark living room. The silence felt less like peace and more like isolation. This is the third night this week.', mood: 5, tags: ['sleep', 'anxiety', 'insomnia'], sentiment: -0.15 },
  { daysAgo: 11, title: 'Running on empty',           body: 'Skipped lunch again. Third time this week. Woke up late, rushed through the morning, sat in back-to-back meetings, and looked up at 4pm realizing I hadn\'t eaten. Made a sandwich mechanically. Didn\'t taste it. Called my sister but hung up before she answered — didn\'t have the energy to explain how I\'m feeling. Not even sure I know.', mood: 4, tags: ['exhaustion', 'isolation', 'burnout'], sentiment: -0.3 },

  // RECENT — anger, isolation, despair (days 9–0)
  { daysAgo: 9,  title: 'What is even the point',     body: 'Another pointless meeting. Another email asking for something I already sent. Another day of going through the motions. I sat in my car in the garage for 20 minutes before coming inside because I couldn\'t face another conversation about how my day was. It was fine. It\'s always "fine." Nothing is fine.', mood: 3, tags: ['anger', 'burnout', 'rant'], sentiment: -0.55 },
  { daysAgo: 7,  title: 'I don\'t want to talk to anyone', body: 'Sam asked what was wrong and I said "nothing" and walked away. I know that\'s not fair. I know they\'re trying. But I don\'t have words for what\'s happening inside me right now. Everything feels too loud and too quiet at the same time. I just want to be left alone. But I also want someone to notice. Contradiction.', mood: 3, tags: ['anger', 'isolation', 'relationships', 'rant'], sentiment: -0.6 },
  { daysAgo: 5,  title: 'Can\'t do this anymore',     body: 'Woke up exhausted. Dragged myself through the day. Snapped at a coworker in a meeting and didn\'t even care. Came home, ordered takeout I didn\'t want, stared at the TV I wasn\'t watching. The journal has been sitting on my desk for a week untouched. What would I even write? Same story. Different day. Nothing changes.', mood: 2, tags: ['anger', 'exhaustion', 'rant', 'burnout'], sentiment: -0.7 },
  { daysAgo: 3,  title: 'Rant — ignore this',         body: 'I hate this. I hate the meetings and the emails and the way everyone pretends everything is fine. I hate that I can\'t sleep and when I do sleep it\'s not restful. I hate that Sam looks at me with this worried expression like I\'m a bomb about to go off. Maybe I am. Maybe I\'ve been holding it together for so long that I don\'t know how to stop. Maybe I don\'t want to stop. Maybe I want to burn it all down.', mood: 1, tags: ['rant', 'anger', 'isolation', 'despair'], sentiment: -0.85 },
  { daysAgo: 1,  title: 'Blank page',                 body: 'I sat down to write and just stared at the page for 30 minutes. Nothing came. No words, no feelings, no energy to even try. I used to love writing. The words used to flow. Now it\'s just... blank. Everything is blank. I don\'t know who I am anymore. I don\'t recognize the person who wrote those entries from a month ago. That person feels like a stranger.', mood: 2, tags: ['despair', 'identity', 'reflection'], sentiment: -0.75 },
];

export function isAdminCredentials(email: string, password: string): boolean {
  const e = email.trim().toLowerCase();
  const p = password;
  // Accept both the shorthand 'admin' and the full admin email.
  return (e === 'admin' || e === ADMIN_EMAIL) && p === ADMIN_PASSWORD;
}

export function seedAdminData() {
  const userId = ADMIN_USER_ID;
  const db = readDB();
  const targetStart = daysAgoISO(31);
  const targetEnd = todayISO();
  const adminCheckins = db.daily_checkins.filter((c) => c.user_id === userId);
  const adminEarliest = adminCheckins.reduce<string | null>((earliest, row) => {
    if (!earliest || row.date < earliest) return row.date;
    return earliest;
  }, null);
  const adminLatest = adminCheckins.reduce<string | null>((latest, row) => {
    if (!latest || row.date > latest) return row.date;
    return latest;
  }, null);

  // Don't re-seed if the admin already has data — preserves user edits
  // made through the dashboard or check-in flows.
  if (
    db.profiles[userId] &&
    adminCheckins.length >= 32 &&
    adminEarliest !== null &&
    adminLatest !== null &&
    adminEarliest <= targetStart &&
    adminLatest >= targetEnd
  ) {
    return;
  }

  // Clear any partial/stale admin data before seeding fresh.
  db.daily_checkins = db.daily_checkins.filter((c) => c.user_id !== userId);
  db.journal_entries = db.journal_entries.filter((j) => j.user_id !== userId);
  db.weekly_insights = db.weekly_insights.filter((i) => i.user_id !== userId);
  db.notifications = db.notifications.filter((n) => n.user_id !== userId);
  db.connected_accounts = db.connected_accounts.filter((a) => a.user_id !== userId);
  db.trusted_contacts = db.trusted_contacts.filter((t) => t.user_id !== userId);
  db.wellness_scores = db.wellness_scores.filter((w) => w.user_id !== userId);
  delete db.profiles[userId];
  delete db.user_settings[userId];

  const now = new Date().toISOString();

  db.profiles[userId] = {
    id: userId,
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    age: 32,
    height_cm: 175,
    weight_kg: 70,
    region: 'United States',
    timezone: 'GMT -5 (EST)',
    occupation: 'Researcher',
    sleep_goal_hours: 8,
    resting_hr: 72,
    exercise_freq: '2-3',
    work_schedule: 'standard',
    typical_stress: 'high',
    outdoor_hours: 1,
    onboarding_complete: true,
    avatar_url: null,
    created_at: now,
    updated_at: now,
  };
  db.user_settings[userId] = {
    id: uid(),
    user_id: userId,
    checkin_reminder_time: '20:00',
    checkin_reminder_enabled: true,
    notifications_enabled: true,
    theme: 'light',
    units: 'metric',
    ai_insights_enabled: true,
    private_mode: false,
    created_at: now,
    updated_at: now,
  };

  // 32 days of check-ins with DRAMATIC downward trend:
  // Days 31–16: calm, happy, rested, low stress, connected
  // Days 15–0:  aggressive, upset, high stress, isolated, poor sleep
  const ADMIN_DAYS = 32;
  const checkins: DailyCheckin[] = [];
  for (let i = ADMIN_DAYS - 1; i >= 0; i--) {
    const date = daysAgoISO(i);
    const t = (ADMIN_DAYS - 1 - i) / (ADMIN_DAYS - 1); // 0=calm, 1=aggressive
    const sharp = Math.pow(t, 2.5);

    const mood    = clamp(Math.round(8.5 - sharp * 6 + (Math.sin(i / 3) * 0.8)));
    const stress  = clamp(Math.round(2.0 + sharp * 7 + (Math.cos(i / 2.5) * 0.8)));
    const energy  = clamp(Math.round(8.0 - sharp * 6 + (Math.sin(i / 2) * 0.7)));
    const focus   = clamp(Math.round(8.0 - sharp * 6.5 + (Math.cos(i / 3) * 0.7)));
    const social  = clamp(Math.round(8.0 - sharp * 6.5 + (Math.sin(i / 4) * 0.8)));
    const outdoor = Math.max(0, Math.round(55 - sharp * 45 + (Math.sin(i / 4) * 10)));
    const sleep   = clampF(8.2 - sharp * 3 + (Math.sin(i / 2.5) * 0.5), 4, 10);
    const work    = clamp(Math.round(2.0 + sharp * 7.5 + (Math.cos(i / 3) * 0.6)));

    const isEarly = t < 0.5;
    const responses: Record<string, string> = {};

    if (isEarly) {
      const bank = ADMIN_CALM_RESPONSES;
      for (let r = 0; r < 3; r++) {
        const idx = (i * 3 + r * 7) % bank.length;
        const entry = bank[idx]!;
        if (!responses[entry.qid]) responses[entry.qid] = entry.text;
      }
    } else {
      const bank = ADMIN_AGGRESSIVE_RESPONSES;
      for (let r = 0; r < 3; r++) {
        // JavaScript % produces negative remainders for negative dividends,
        // so ((i - 15) * 3) can yield invalid negative indices. Normalise.
        const rawIdx = (i - 15) * 3 + r * 5;
        const idx = ((rawIdx % bank.length) + bank.length) % bank.length;
        const entry = bank[idx]!;
        if (!responses[entry.qid]) responses[entry.qid] = entry.text;
      }
    }

    const interpMeta = isEarly
      ? { mood, energy, stress, connection: social, rest: Math.round(sleep / 9 * 10), purpose: focus }
      : {
          mood: Math.max(1, mood - 1), energy: Math.max(1, energy - 1),
          stress: Math.min(10, stress + 1), connection: Math.max(1, social - 2),
          rest: Math.max(1, Math.round(sleep / 9 * 10) - 2), purpose: Math.max(1, focus - 2),
        };

    const interpretation = isEarly
      ? 'Today reads as a calm, grounded day. There is a steadiness in your words — a sense that you are moving through things with ease. Connection and rest both show up as quiet assets.'
      : 'Today lands heavy. Your words are shorter, sharper — there is a rawness underneath that was not there a few weeks ago. Stress is running the show and connection has pulled back.';

    checkins.push({
      id: uid(), user_id: userId, date,
      mood, stress, energy, focus,
      outdoor_minutes: outdoor,
      social_connection: social,
      rest_hours: Number(sleep.toFixed(1)),
      work_pressure: work,
      sleep_hours: Number(sleep.toFixed(1)),
      notes: i % 3 === 0 ? (isEarly ? 'Felt steady and grateful today.' : 'Everything feels heavy and pointless.') : null,
      responses,
      interpretation,
      interpretation_meta: {
        ...interpMeta,
        themes: isEarly ? ['calm', 'connection', 'gratitude'] : ['anger', 'isolation', 'exhaustion'],
        generated_at: now,
      },
      created_at: now,
      updated_at: now,
    });
  }
  db.daily_checkins.push(...checkins);

  // 20 journal entries spanning the same 32-day window
  const journals: JournalEntry[] = ADMIN_JOURNALS.map((j) => {
    const created = new Date();
    created.setDate(created.getDate() - j.daysAgo);
    return {
      id: uid(), user_id: userId,
      title: j.title, body: j.body, mood: j.mood, tags: j.tags,
      photo_urls: [], voice_note_url: null, sentiment: j.sentiment,
      source: 'web', external_id: null, external_meta: {},
      created_at: created.toISOString(), updated_at: created.toISOString(),
    };
  });
  db.journal_entries.push(...journals);

  // Connected account stubs
  (['apple_health', 'google_fit', 'fitbit', 'oura', 'garmin', 'strava'] as const).forEach((p) => {
    db.connected_accounts.push({
      id: uid(), user_id: userId, provider: p, status: 'disconnected',
      connected_at: null, last_sync_at: null, metadata: {},
      created_at: now, updated_at: now,
    });
  });

  // Trusted contact
  db.trusted_contacts.push({
    id: uid(), user_id: userId,
    name: 'Sam Lee', email: 'sam.lee@example.com', phone: null,
    relationship: 'partner', notes: 'Knows the rhythms of my week.',
    created_at: now,
  });

  // Four weekly insights reflecting the decline
  for (let w = 0; w < 4; w++) {
    const end   = daysAgoISO(w === 0 ? 0 : Math.max(0, w * 7 - 1));
    const start = daysAgoISO(Math.min(ADMIN_DAYS - 1, w === 0 ? 6 : w * 7 + 6));
    const slice = checkins.filter((c) => c.date >= end && c.date <= start);
    const avg = (k: keyof DailyCheckin) => slice.reduce((a, c) => a + (c[k] as number), 0) / Math.max(1, slice.length);

    // w=0,1 are most recent (decline); w=2,3 are older (calm)
    const isOlderCalm = w >= 2;
    const weekPatterns = isOlderCalm
      ? ['Mood was steady and bright', 'Sleep was restorative and consistent']
      : ['Mood dropped sharply below baseline', 'Stress spiked and sleep deteriorated'];
    const weekFactors = isOlderCalm
      ? ['Consistent morning routine', 'Regular social connection']
      : ['Withdrawal from social contact', 'Mounting work pressure and sleep debt'];
    const weekQuestions = isOlderCalm
      ? ['What helped this week feel so light?']
      : ['What changed around the middle of the month?', 'What is one thing that might help right now?'];
    const weekSuggestions = isOlderCalm
      ? ['Keep the morning walk ritual', 'Protect one evening this week for yourself']
      : ['Reach out to one person you trust', 'A single walk tomorrow — just 15 minutes'];

    db.weekly_insights.push({
      id: uid(), user_id: userId, week_start: end, week_end: start,
      summary: `Week ${w + 1}: sleep averaged ${avg('sleep_hours').toFixed(1)}h, mood ${avg('mood').toFixed(1)}/10, stress ${avg('stress').toFixed(1)}/10.`,
      patterns: weekPatterns,
      contributing_factors: weekFactors,
      reflection_questions: weekQuestions,
      suggestions: weekSuggestions,
      metrics_snapshot: {
        sleep: Number(avg('sleep_hours').toFixed(1)),
        stress: Number(avg('stress').toFixed(1)),
        mood: Number(avg('mood').toFixed(1)),
        outdoor: Math.round(avg('outdoor_minutes')),
      },
      created_at: now,
    });
  }

  writeDB(db);
}

function clamp(n: number): number {
  return Math.max(1, Math.min(10, n));
}
function clampF(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
