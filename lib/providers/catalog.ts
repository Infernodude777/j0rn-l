/**
 * Modular provider abstraction for health and activity integrations.
 *
 * Each provider declares:
 *  - id: stable key stored in connected_accounts.provider
 *  - name, description, icon: UI metadata
 *  - scopes: data categories we would request from the provider's official API
 *  - status: stub state until an OAuth flow is wired up
 *
 * This file intentionally avoids scraping logic. Real OAuth clients should be
 * added in lib/providers/clients/<id>.ts and only called from server actions.
 */

export type ProviderId =
  | 'apple_health'
  | 'google_fit'
  | 'fitbit'
  | 'oura'
  | 'garmin'
  | 'strava'
  | 'google_calendar'
  | 'apple_calendar'
  | 'screen_time'
  | 'spotify'
  | 'notion'
  | 'todoist'
  | 'discord'
  | 'instagram';

export interface ProviderDef {
  id: ProviderId;
  name: string;
  description: string;
  icon: string;
  scopes: string[];
  status: 'available' | 'soon';
  /** Coarse category for grouping on the Connect page. */
  category: 'health' | 'schedule' | 'lifestyle' | 'productivity';
}

export const providerCatalog: ProviderDef[] = [
  /* Health & activity */
  {
    id: 'apple_health',
    name: 'Apple Health',
    description: 'Steps, heart rate, sleep stages.',
    icon: 'heart',
    scopes: ['steps', 'heart_rate', 'sleep'],
    status: 'available',
    category: 'health',
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    description: 'Activity, heart points, sleep.',
    icon: 'bolt',
    scopes: ['activity', 'sleep'],
    status: 'available',
    category: 'health',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Sleep, heart rate, activity.',
    icon: 'sparkle',
    scopes: ['sleep', 'heart_rate', 'activity'],
    status: 'available',
    category: 'health',
  },
  {
    id: 'oura',
    name: 'Oura',
    description: 'Readiness, sleep, and HRV.',
    icon: 'moon',
    scopes: ['readiness', 'sleep', 'hrv'],
    status: 'soon',
    category: 'health',
  },
  {
    id: 'garmin',
    name: 'Garmin',
    description: 'Activity, stress, sleep.',
    icon: 'tree',
    scopes: ['activity', 'stress', 'sleep'],
    status: 'soon',
    category: 'health',
  },
  {
    id: 'strava',
    name: 'Strava',
    description: 'Outdoor activity and effort.',
    icon: 'people',
    scopes: ['activity'],
    status: 'soon',
    category: 'health',
  },

  /* Schedule */
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Today\u2019s meetings and free windows.',
    icon: 'calendar',
    scopes: ['events.readonly'],
    status: 'available',
    category: 'schedule',
  },
  {
    id: 'apple_calendar',
    name: 'Apple Calendar',
    description: 'iCloud events and reminders.',
    icon: 'calendar',
    scopes: ['events.readonly'],
    status: 'available',
    category: 'schedule',
  },

  /* Lifestyle */
  {
    id: 'screen_time',
    name: 'Screen Time',
    description: 'App usage and focus sessions.',
    icon: 'devices',
    scopes: ['usage.readonly'],
    status: 'available',
    category: 'lifestyle',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Mood signals from what you listen to.',
    icon: 'headphones',
    scopes: ['listening.readonly'],
    status: 'soon',
    category: 'lifestyle',
  },

  /* Productivity */
  {
    id: 'notion',
    name: 'Notion',
    description: 'Tasks, notes, and projects.',
    icon: 'book',
    scopes: ['pages.read', 'databases.read'],
    status: 'soon',
    category: 'productivity',
  },
  {
    id: 'todoist',
    name: 'Todoist',
    description: 'Open tasks and due dates.',
    icon: 'check',
    scopes: ['tasks.read'],
    status: 'soon',
    category: 'productivity',
  },

  /* Messaging — DMs for nudges, reminders, and concerning-level alerts */
  {
    id: 'discord',
    name: 'Discord',
    description: 'DM you at 7 PM with your daily reflection reminder and important nudges.',
    icon: 'discord',
    scopes: ['dm.send', 'user.read'],
    status: 'available',
    category: 'lifestyle',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'DM you at 7 PM for your daily reflection and mental-health nudges.',
    icon: 'instagram',
    scopes: ['dm.send', 'user.read'],
    status: 'available',
    category: 'lifestyle',
  },
];
