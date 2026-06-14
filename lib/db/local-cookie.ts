/**
 * Server-side reading of the local-mode session from a cookie that the
 * client writes via lib/db/local.ts. This is the only piece of the "local
 * mode" data layer that is safe to import from a server route.
 *
 * The actual journal / check-in / insight data in local mode is still
 * stored in localStorage and is therefore not accessible from server
 * routes. In local mode the API route only returns whatever can be derived
 * from the cookie identity — for the full local-mode experience, use the
 * client hooks directly.
 */

import { cookies } from 'next/headers';

const COOKIE_NAME = 'j0rn@l.local.session';

export interface ServerLocalSession {
  userId: string;
  email: string;
}

export async function readLocalSessionFromCookie(): Promise<ServerLocalSession | null> {
  try {
    // In Next.js 15, cookies() returns a Promise that must be awaited.
    const store = await cookies();
    const raw = store.get(COOKIE_NAME)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ServerLocalSession>;
    if (typeof parsed.userId === 'string' && typeof parsed.email === 'string') {
      return { userId: parsed.userId, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}
