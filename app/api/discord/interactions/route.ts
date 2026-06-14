/**
 * Discord interaction webhook.
 *
 * Discord will POST every slash command + button click + modal submit
 * here. We verify the Ed25519 signature, then dispatch.
 *
 * Supported commands:
 *  - /link   → mint a pair code, DM it to the user
 *  - /reflect → reply with the web app link
 *  - /rant   → reply with the web app link
 *  - PING    → required handshake for Discord to mark the endpoint valid
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  attachDiscordUserToPairCode,
  isDiscordConfigured,
  mintPairCode,
  sendDiscordDm,
  verifyInteractionSignature,
} from '@/lib/discord/bot';

export const runtime = 'nodejs'; // Ed25519 verify needs Node crypto

interface DiscordInteraction {
  type: number; // 1 = PING, 2 = APPLICATION_COMMAND, 3 = MESSAGE_COMPONENT, 4 = APPLICATION_COMMAND_AUTOCOMPLETE, 5 = MODAL_SUBMIT
  id: string;
  application_id: string;
  token: string;
  data?: {
    id: string;
    name: string;
    options?: Array<{ name: string; value?: string | number }>;
  };
  user?: {
    id: string;
    username: string;
    discriminator?: string;
  };
  member?: { user?: { id: string; username: string } };
  channel_id?: string;
  guild_id?: string;
}

// Interaction response types
const RESPONSE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  // Deferred channel message (visible to user, async update later)
  DEFERRED_CHANNEL_MESSAGE: 5,
};

function getDiscordUser(interaction: DiscordInteraction): { id: string; username: string } | null {
  if (interaction.user) return { id: interaction.user.id, username: interaction.user.username };
  if (interaction.member?.user) return { id: interaction.member.user.id, username: interaction.member.user.username };
  return null;
}

function jsonResponse(type: number, data: Record<string, unknown>) {
  return NextResponse.json({ type, data });
}

export async function POST(req: NextRequest) {
  if (!isDiscordConfigured()) {
    return NextResponse.json(
      { error: 'Discord is not configured. Set DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY, DISCORD_APPLICATION_ID.' },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');

  if (!verifyInteractionSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Type 1 = PING — required by Discord to verify the endpoint
  if (interaction.type === 1) {
    return jsonResponse(RESPONSE.PONG, {});
  }

  // Type 2 = APPLICATION_COMMAND
  if (interaction.type === 2 && interaction.data) {
    const commandName = interaction.data.name;
    const webBase = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    if (commandName === 'link') {
      const user = getDiscordUser(interaction);
      if (!user) {
        return jsonResponse(RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE, {
          content: 'Could not identify the user. Try the command in a server or DM.',
          flags: 64, // ephemeral
        });
      }
      // We need a j0rn@l user id to mint a pair code, but the slash command
      // only knows the Discord user. So we mint an "open" code and ask the
      // user to sign in / sign up in the web app first, then run /link
      // again. The web app re-calls this endpoint to redeem the code.
      //
      // To make this work end-to-end without a separate sign-in step, the
      // web app will detect a `discord_link=true` query param on its
      // /settings page and call /api/discord/pair after sign-in.
      const code = mintPairCode();
      // Stash the Discord user id against the code so the redeem step
      // can bind it without a second interaction.
      attachDiscordUserToPairCode(code, user.id, user.username);

      // Best-effort DM with the code. If the user hasn't opened a DM
      // channel with the bot yet, this will fail silently and the
      // follow-up message below will tell them what to do.
      let dmError: string | null = null;
      try {
        await sendDiscordDm(user.id, `Your j0rn@l pair code is **${code}**. Open the web app, go to Settings, paste the code, and you're linked.`);
      } catch (e) {
        dmError = e instanceof Error ? e.message : 'unknown';
      }

      const reply = dmError
        ? `I couldn\u2019t DM you (${dmError}). Open a DM with me and run \`/link\` again, or go to **${webBase}/settings** to continue.`
        : `Check your DMs for your pair code. Then open **${webBase}/settings** to finish linking.`;

      return jsonResponse(RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE, {
        content: reply,
        flags: 64, // ephemeral — only the user sees this
      });
    }

    if (commandName === 'reflect') {
      return jsonResponse(RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE, {
        content: `Today\u2019s reflection is waiting for you. Open it: ${webBase}/checkin`,
        flags: 64,
      });
    }

    if (commandName === 'rant') {
      return jsonResponse(RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE, {
        content: `5 minutes. Whatever it is. Start your rant: ${webBase}/checkin (switch to the 5-min Rant tab).`,
        flags: 64,
      });
    }
  }

  // Unknown type — acknowledge so Discord doesn't retry
  return jsonResponse(RESPONSE.PONG, {});
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'This endpoint accepts Discord interaction webhooks (POST).',
  });
}
