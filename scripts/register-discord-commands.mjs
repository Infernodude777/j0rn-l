#!/usr/bin/env node
/**
 * Register the j0rn@l Discord slash commands globally.
 *
 * Run once after first deploy (and any time the command list changes).
 * Discord caches commands for ~1 hour.
 *
 *   node scripts/register-discord-commands.mjs
 *
 * Required env vars (load from .env.local or pass inline):
 *   DISCORD_APPLICATION_ID
 *   DISCORD_BOT_TOKEN
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadDotEnv();

const applicationId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
if (!applicationId || !token) {
  console.error('Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN in env');
  process.exit(1);
}

const commands = [
  { name: 'link', description: 'Link your Discord account to j0rn@l. The bot will DM you a pair code.' },
  { name: 'reflect', description: "Open today's reflection in the web app." },
  { name: 'rant', description: 'Start a 5-minute rant in the web app.' },
];

const res = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: `Bot ${token}` },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error('Failed:', res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
console.log(`Registered ${Array.isArray(data) ? data.length : 0} slash commands:`);
for (const c of Array.isArray(data) ? data : []) {
  console.log(`  - /${c.name}  (id: ${c.id})`);
}
