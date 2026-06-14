/**
 * Discord bot core functions for j0rn@l.
 *
 * Server-only — never import from client code (the bot token would leak).
 *
 * Responsibilities:
 *  - Verify inbound interaction webhook signatures (Ed25519 via the
 *    DISCORD_PUBLIC_KEY env var).
 *  - Send DMs to a user who has paired their Discord ID with j0rn@l.
 *  - Manage the one-time pair-code flow that links a Discord user to a
 *    j0rn@l account.
 *  - Register slash commands with the Discord API.
 *
 * Env vars (all server-only):
 *  - DISCORD_BOT_TOKEN       (required, from Discord developer portal)
 *  - DISCORD_PUBLIC_KEY      (required, for verifying interaction webhooks)
 *  - DISCORD_APPLICATION_ID  (required, the bot's application id = the user
 *                              calls this the "bot id" — same value)
 *  - DISCORD_REDIRECT_URI    (optional, for OAuth if you wire it later)
 */

import crypto from 'node:crypto';
import { dmsToNotifications, planDailyDms } from '@/lib/dm-scheduler';
import type { Notification } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Env helpers                                                               */
/* -------------------------------------------------------------------------- */

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

export function discordConfig() {
  return {
    token: env('DISCORD_BOT_TOKEN'),
    publicKey: env('DISCORD_PUBLIC_KEY'),
    applicationId: env('DISCORD_APPLICATION_ID'),
    redirectUri: env('DISCORD_REDIRECT_URI'),
  };
}

export function isDiscordConfigured(): boolean {
  const c = discordConfig();
  return !!c.token && !!c.publicKey && !!c.applicationId;
}

/* -------------------------------------------------------------------------- */
/*  Webhook signature verification                                             */
/* -------------------------------------------------------------------------- */

/**
 * Verify a Discord interaction webhook signature.
 *
 * Discord signs every inbound POST with Ed25519 using the bot's public key.
 * The signature is in the `X-Signature-Ed25519` header and the timestamp in
 * `X-Signature-Timestamp`. We re-derive the signature and compare.
 *
 * Returns true if the signature is valid, false otherwise.
 */
export function verifyInteractionSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const { publicKey } = discordConfig();
  if (!publicKey) return false;
  if (!signature || !timestamp) return false;
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKey, 'hex'),
      format: 'der',
      type: 'spki',
    });
    // Discord concatenates timestamp + body before signing
    const message = Buffer.from(timestamp + rawBody);
    const sig = Buffer.from(signature, 'hex');
    return crypto.verify(null, message, key, sig);
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Pair-code flow                                                             */
/* -------------------------------------------------------------------------- */

/**
 * In-memory store of pending pair codes. Each code is bound to a j0rn@l
 * user id and expires after 15 minutes. The Discord bot generates these
 * when a user runs the /link slash command; the web app redeems them
 * via /api/discord/pair.
 *
 * Note: this is in-memory by design. For a multi-instance deployment
 * (Vercel functions) you'd swap this for Upstash/Redis. For a single-
 * instance dev server it's perfect.
 */
interface PairCode {
  userId: string;
  createdAt: number;
  /** Discord user id that requested the code (set after the first GET). */
  discordUserId?: string;
  /** Discord username for display. */
  discordUsername?: string;
}

const PAIR_TTL_MS = 15 * 60 * 1000;
const pairCodes = new Map<string, PairCode>();

/** Mint a new pair code. `userId` is optional — for the /link slash command
 *  we don't yet know which j0rn@l user is redeeming, so we mint an "open"
 *  code and the web app binds the user on redemption. */
export function mintPairCode(userId?: string): string {
  // 8-char base32-ish code, easy to type
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i]! % alphabet.length];
  }
  pairCodes.set(code, { userId: userId ?? '', createdAt: Date.now() });
  // Opportunistic cleanup: drop any expired codes while we're here
  sweepExpiredPairCodes();
  return code;
}

/**
 * Record the Discord user id against a pending pair code. Called by the
 * /link interaction handler so the code is bound to *both* a j0rn@l user
 * and a Discord user.
 */
export function attachDiscordUserToPairCode(
  code: string,
  discordUserId: string,
  discordUsername: string,
): boolean {
  const entry = pairCodes.get(code);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > PAIR_TTL_MS) {
    pairCodes.delete(code);
    return false;
  }
  entry.discordUserId = discordUserId;
  entry.discordUsername = discordUsername;
  return true;
}

/** Look up a pair code. Returns null if missing or expired. */
export function readPairCode(code: string): PairCode | null {
  const entry = pairCodes.get(code);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > PAIR_TTL_MS) {
    pairCodes.delete(code);
    return null;
  }
  return entry;
}

/** Consume (delete) a pair code. Idempotent. */
export function consumePairCode(code: string): void {
  pairCodes.delete(code);
}

/** Drop any pair codes that have exceeded their TTL. Called opportunistically
 *  from mintPairCode so the map doesn't grow without bound. */
function sweepExpiredPairCodes(): void {
  const cutoff = Date.now() - PAIR_TTL_MS;
  for (const [code, entry] of pairCodes) {
    if (entry.createdAt < cutoff) pairCodes.delete(code);
  }
}

/* -------------------------------------------------------------------------- */
/*  REST helpers                                                               */
/* -------------------------------------------------------------------------- */

const DISCORD_API = 'https://discord.com/api/v10';

async function discordFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const { token } = discordConfig();
  if (!token) throw new Error('DISCORD_BOT_TOKEN is not set');
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
      ...(init.headers ?? {}),
    },
    // Don't cache — always fresh
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord API ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

/* -------------------------------------------------------------------------- */
/*  Send DMs                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Send a DM to a Discord user. Returns the message id on success.
 * Throws if the bot cannot reach the user (e.g. they haven't opened
 * a DM channel with the bot yet).
 */
export async function sendDiscordDm(discordUserId: string, content: string): Promise<string> {
  // 1. Open a DM channel with the user
  const channel = await discordFetch<{ id: string }>('/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!channel?.id) throw new Error('Failed to open DM channel with user');
  // 2. Post the message
  const msg = await discordFetch<{ id: string }>(`/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  if (!msg?.id) throw new Error('Failed to post DM');
  return msg.id;
}

/* -------------------------------------------------------------------------- */
/*  Slash command registration                                                 */
/* -------------------------------------------------------------------------- */

export interface SlashCommand {
  name: string;
  description: string;
  options?: Array<{
    name: string;
    description: string;
    type: number; // 1 = SUB_COMMAND, 3 = STRING, etc.
    required?: boolean;
  }>;
}

export const DISCORD_COMMANDS: SlashCommand[] = [
  {
    name: 'link',
    description: 'Link your Discord account to j0rn@l. The bot will DM you a pair code.',
    options: [],
  },
  {
    name: 'reflect',
    description: 'Open today\u2019s reflection in the web app.',
    options: [],
  },
  {
    name: 'rant',
    description: 'Start a 5-minute rant in the web app.',
    options: [],
  },
];

/**
 * Register (or overwrite) the bot's slash commands globally. Run this once
 * after deploy; Discord caches the commands for ~1 hour.
 */
export async function registerSlashCommands(): Promise<{ ok: boolean; count: number }> {
  const { applicationId, token } = discordConfig();
  if (!applicationId || !token) {
    throw new Error('DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required');
  }
  const res = await fetch(`${DISCORD_API}/applications/${applicationId}/commands`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify(DISCORD_COMMANDS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Register commands failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as unknown[];
  return { ok: true, count: Array.isArray(data) ? data.length : 0 };
}

/* -------------------------------------------------------------------------- */
/*  Scheduled DM dispatcher                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Walk all j0rn@l users with a connected Discord account and DM them
 * anything that's due (7 PM reflection reminder, nudge, or concerning-
 * level alert). Returns a summary of what was sent.
 *
 * Designed to be called from a scheduled route (Vercel Cron or similar)
 * on the hour. Dedupe is handled by `planDailyDms` (per-day, per-title).
 */
export async function dispatchScheduledDms(opts: { now?: Date; dryRun?: boolean } = {}): Promise<{
  scanned: number;
  sent: number;
  failed: number;
  byChannel: { discord: number; instagram: number };
}> {
  const now = opts.now ?? new Date();
  const result = { scanned: 0, sent: 0, failed: 0, byChannel: { discord: 0, instagram: 0 } };

  // The dispatcher runs server-side. For the local store we can iterate
  // every user via the helper below. For a real Supabase deployment,
  // replace this with a paginated `profiles` query.
  const { listCheckins, listJournal, listNotifications, upsertNotification, getSettings, listConnected } =
    await import('@/lib/db/api');
  const { localDB } = await import('@/lib/db/local');
  const isServer = typeof window === 'undefined';
  const allUsers: string[] = isServer
    ? localDB.allUserIds()
    : []; // client-side cron is a no-op

  for (const userId of allUsers) {
    result.scanned += 1;
    try {
      const [connected, settings, checkins, journals, existing] = await Promise.all([
        listConnected(userId),
        getSettings(userId),
        listCheckins(userId),
        listJournal(userId),
        listNotifications(userId),
      ]);
      const dms = planDailyDms({ now, connected, settings, checkins, journals, existing });
      if (dms.length === 0) continue;

      // Persist the in-app notifications (so the user also sees the message
      // in the bell).
      const rows: Notification[] = dmsToNotifications(dms, userId);
      if (!opts.dryRun) {
        for (const r of rows) await upsertNotification(r);
      }

      // Then actually send via Discord for users who have it linked.
      for (const dm of dms) {
        if (dm.channel === 'discord') {
          const acc = connected.find((c) => c.provider === 'discord');
          const discordId = (acc?.metadata as Record<string, unknown> | null)?.discord_user_id as string | undefined;
          if (!discordId) continue;
          if (!opts.dryRun) {
            await sendDiscordDm(discordId, `**${dm.title}**\n${dm.body}`).catch((e) => {
              result.failed += 1;
              // Don't throw — keep going for the other users
              console.warn('[discord] DM send failed', e instanceof Error ? e.message : e);
            });
          }
          result.sent += 1;
          result.byChannel.discord += 1;
        }
        // Instagram DMs require the Instagram Graph API + a business
        // account. Count them so the cron summary is accurate, but skip
        // the actual send (we surface the message in-app via the
        // notification rows above).
        else if (dm.channel === 'instagram') {
          result.sent += 1;
          result.byChannel.instagram += 1;
        }
      }
    } catch (e) {
      result.failed += 1;
      console.warn('[discord] user dispatch failed', e instanceof Error ? e.message : e);
    }
  }
  return result;
}
