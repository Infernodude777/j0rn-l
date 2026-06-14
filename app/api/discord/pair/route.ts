/**
 * Discord pair-code redemption.
 *
 * The web app calls this after the user enters the 8-char code they got
 * from the /link DM. We look up the pending code (which already has the
 * Discord user id attached) and write it into the user's
 * `connected_accounts` row for the `discord` provider.
 *
 * Auth: resolves the user from the session via `getServerUser`, which
 * handles both Supabase (cookie-based) and local-mode sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listConnected, upsertConnected } from '@/lib/db/api';
import { readPairCode, consumePairCode, isDiscordConfigured } from '@/lib/discord/bot';
import { getServerUser } from '@/lib/server-session';
import { uid } from '@/lib/utils';
import type { ConnectedAccount } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isDiscordConfigured()) {
    return NextResponse.json({ error: 'Discord is not configured' }, { status: 503 });
  }

  const user = await getServerUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const code = (body.code ?? '').trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const entry = readPairCode(code);
  if (!entry) {
    return NextResponse.json({ error: 'Code is invalid or expired' }, { status: 400 });
  }
  if (!entry.discordUserId) {
    return NextResponse.json(
      { error: 'Code was never linked to a Discord user. Run /link again in Discord.' },
      { status: 400 },
    );
  }

  // The pair code was minted before the user signed in, so its `userId`
  // is the placeholder 'pending'. We bind it to the *current* j0rn@l user
  // here (the user is proving they own both the web session and the code).
  const existing = await listConnected(user.id);
  const prior = existing.find((a) => a.provider === 'discord');
  const now = new Date().toISOString();
  const next: ConnectedAccount = {
    id: prior?.id ?? uid(),
    user_id: user.id,
    provider: 'discord',
    status: 'connected',
    connected_at: now,
    last_sync_at: now,
    metadata: {
      ...(prior?.metadata ?? {}),
      discord_user_id: entry.discordUserId,
      discord_username: entry.discordUsername ?? null,
      paired_at: now,
    },
    created_at: prior?.created_at ?? now,
    updated_at: now,
  };
  await upsertConnected(next);
  consumePairCode(code);

  return NextResponse.json({
    ok: true,
    discord_user_id: entry.discordUserId,
    discord_username: entry.discordUsername ?? null,
  });
}
