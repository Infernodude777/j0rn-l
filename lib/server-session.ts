/**
 * Server-side session resolution.
 *
 * The Discord pair route (and any future server actions) needs to know
 * who the current user is. `getCurrentUser` in `lib/db/api` reads from
 * client-side `localStorage`, which is empty on the server. This helper
 * resolves the user from a Next.js `NextRequest` instead.
 *
 * Two backends:
 *  - **Supabase mode**: reads the Supabase auth cookie and returns the
 *    user via `supabase.auth.getUser()`.
 *  - **Local mode** (no Supabase env vars): reads the `j0rn@l.local.session`
 *    cookie that the local auth layer writes on sign-in.
 *
 * Returns `null` if the user can't be resolved — never throws. Callers
 * should treat null as a 401.
 */

import { NextRequest } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/lib/db/api';

const SESSION_COOKIE = 'j0rn@l.local.session';

interface ParsedSessionCookie {
  userId: string;
  email: string;
}

function parseLocalSessionCookie(raw: string | undefined): ParsedSessionCookie | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(raw)) as ParsedSessionCookie;
    if (decoded?.userId && decoded?.email) return decoded;
  } catch {
    // fall through
  }
  return null;
}

export async function getServerUser(req: NextRequest): Promise<AuthUser | null> {
  // 1. Try Supabase (createClient is async in server context). Narrow the
  //    try to just the auth call so client-construction errors aren't
  //    silently swallowed.
  try {
    const sb = await createSupabaseServerClient();
    if (sb) {
      const { data } = await sb.auth.getUser();
      if (data.user) {
        return { id: data.user.id, email: data.user.email ?? '' };
      }
    }
  } catch {
    // Supabase auth call failed — fall through to local cookie.
  }

  // 2. Local mode: read the session cookie. The cookie was set on the
  //    response from the sign-in handler so subsequent requests can read it.
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const parsed = parseLocalSessionCookie(cookie);
  if (parsed) {
    return { id: parsed.userId, email: parsed.email };
  }

  return null;
}
