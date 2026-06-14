export type ID = string;

export interface Profile {
  id: ID;
  name: string;
  email: string;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  region: string | null;
  timezone: string | null;
  occupation: string | null;
  sleep_goal_hours: number | null;
  resting_hr: number | null;
  exercise_freq: '0-1' | '2-3' | '4-5' | '6+' | null;
  work_schedule: 'standard' | 'shift' | 'night' | 'flexible' | null;
  typical_stress: 'low' | 'moderate' | 'high' | null;
  outdoor_hours: number | null;
  onboarding_complete: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyCheckin {
  id: ID;
  user_id: ID;
  /** ISO date of the check-in (YYYY-MM-DD) — one per user per day */
  date: string;
  /** Legacy numeric fields — kept for the dashboard, trends, and chart
   *  rollups. Populated either by the LLM interpreter (when present) or
   *  by a sensible default if the user only answered text questions. */
  mood: number;        // 1-10
  stress: number;      // 1-10
  energy: number;      // 1-10
  focus: number;       // 1-10
  outdoor_minutes: number;
  social_connection: number; // 1-10
  rest_hours: number;
  work_pressure: number; // 1-10
  sleep_hours: number;
  notes: string | null;
  /** Free-text answers keyed by CheckinQuestion.id. */
  responses: Record<string, string>;
  /** LLM-generated 2-3 sentence reflection. */
  interpretation: string | null;
  /** Inferred numeric scores + themes from the LLM. */
  interpretation_meta: {
    mood: number;
    energy: number;
    stress: number;
    connection: number;
    rest: number;
    purpose: number;
    themes: string[];
    generated_at: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface DailyCheckinPromptSet {
  id: ID;
  user_id: ID;
  /** ISO date of the question set (YYYY-MM-DD) — one per user per day */
  date: string;
  /** Stable question IDs selected for the day. */
  question_ids: string[];
  created_at: string;
  updated_at: string;
}

export type JournalSource = 'web' | 'discord' | 'instagram' | 'ios_shortcut' | 'api';

export interface JournalEntry {
  id: ID;
  user_id: ID;
  title: string | null;
  body: string;
  mood: number | null;
  tags: string[];
  photo_urls: string[];
  voice_note_url: string | null;
  sentiment: number | null; // -1..1 from local analysis
  source: JournalSource;
  external_id: string | null;
  external_meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WeeklyInsight {
  id: ID;
  user_id: ID;
  week_start: string;
  week_end: string;
  summary: string;
  patterns: string[];
  contributing_factors: string[];
  reflection_questions: string[];
  suggestions: string[];
  metrics_snapshot: Record<string, number>;
  created_at: string;
}

export interface ConnectedAccount {
  id: ID;
  user_id: ID;
  // The DB CHECK constraint currently allows the six health providers +
  // 'manual'. The catalog has more (calendar, screen time, music, etc.)
  // which work fine in the local store; widen the type to accept them
  // and let the Supabase CHECK reject anything invalid if/when the
  // schema is extended.
  provider: string;
  status: 'connected' | 'disconnected' | 'pending' | 'error';
  connected_at: string | null;
  last_sync_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type SocialProvider = 'discord' | 'instagram' | 'chrome_extension' | 'ios_shortcut' | 'android_tasker';

export interface LinkedAccount {
  id: ID;
  user_id: ID;
  provider: SocialProvider;
  external_id: string;
  external_username: string | null;
  metadata: Record<string, unknown>;
  scopes: string[];
  linked_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SocialApp = 'instagram' | 'tiktok' | 'twitter' | 'youtube' | 'reddit' | 'facebook' | 'snapchat' | 'discord' | 'other';
export type UsageSource = 'chrome_extension' | 'ios_shortcut' | 'android_tasker' | 'manual' | 'discord';
export type UsageEvent = 'open' | 'close' | 'foreground' | 'background';

export interface SocialUsageEvent {
  id: ID;
  user_id: ID;
  source: UsageSource;
  app: SocialApp;
  event: UsageEvent;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SocialUsageDaily {
  id: ID;
  user_id: ID;
  date: string; // YYYY-MM-DD
  app: SocialApp;
  seconds: number;
  sessions: number;
  source_breakdown: Record<UsageSource, number>;
  created_at: string;
  updated_at: string;
}

export interface BotState {
  id: ID;
  user_id: ID;
  provider: SocialProvider;
  state: Record<string, unknown>;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ShareTokenPurpose = 'discord_link' | 'extension_pair' | 'ios_shortcut_pair';

export interface ShareToken {
  id: ID;
  user_id: ID;
  purpose: ShareTokenPurpose;
  token: string;
  expires_at: string;
  consumed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: ID;
  user_id: ID;
  kind: 'checkin_reminder' | 'insight_ready' | 'system' | 'trusted_alert';
  title: string;
  body: string;
  read: boolean;
  scheduled_for: string | null;
  created_at: string;
}

export interface UserSettings {
  id: ID;
  user_id: ID;
  checkin_reminder_time: string | null;
  checkin_reminder_enabled: boolean;
  notifications_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  units: 'metric' | 'imperial';
  ai_insights_enabled: boolean;
  private_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrustedContact {
  id: ID;
  user_id: ID;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  notes: string | null;
  created_at: string;
}

export interface WellnessScore {
  id: ID;
  user_id: ID;
  date: string;
  score: number;
  components: {
    sleep: number;
    stress: number;
    mood: number;
    energy: number;
    social: number;
    outdoor: number;
    journal: number;
  };
  created_at: string;
}

export type InsightPeriod = 'week' | 'month' | 'year';

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendSeries {
  metric: 'sleep' | 'stress' | 'mood' | 'outdoor' | 'social' | 'energy' | 'focus';
  points: TrendPoint[];
  baseline: number;
  movingAverage: number;
  weeklyChange: number;
  monthlyChange: number;
}

export interface PatternSnapshot {
  last_month_outdoor_average: number;
  current_month_outdoor_average: number;
  sleep_change_percentage: number;
  stress_change_percentage: number;
  journal_sentiment_average: number;
  social_change: number;
}

export interface AppTimeSummary {
  app: SocialApp;
  totalSeconds: number;
  sessions: number;
  byDay: { date: string; seconds: number; sessions: number }[];
  bySource: Record<UsageSource, number>;
}
