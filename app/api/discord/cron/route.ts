/**
 * Scheduled DM dispatcher for Discord (and Instagram, when wired).
 *
 * Hit this on a schedule (Vercel Cron recommended — see vercel.json) to
 * walk all j0rn@l users and send anything that's due:
 *  - 7 PM reflection reminder
 *  - Top nudge
 *  - Concerning-level mental health alert
 *
 * Security: this endpoint is intended to be called by a cron service.
 * Protect it with a `CRON_SECRET` env var (Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>` automatically).
 */

import { NextRequest, NextResponse } from 'next/server';
import { dispatchScheduledDms, isDiscordConfigured } from '@/lib/discord/bot';

export const runtime = 'nodejs';
// Allow up to 60s — the dispatcher iterates users sequentially
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // If no CRON_SECRET is set, refuse to run (prevents accidental public
  // triggering of DM sends in production).
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDiscordConfigured()) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: 'Discord not configured' },
      { status: 200 },
    );
  }
  // Optional: ?dryRun=1 to log without sending
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  const summary = await dispatchScheduledDms({ dryRun });
  return NextResponse.json({ ok: true, dryRun, ...summary });
}

export const GET = handle;
export const POST = handle;
