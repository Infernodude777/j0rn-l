import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabaseConfig, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

const LOCAL_SESSION_COOKIE = 'j0rn@l.local.session';

function readLocalUser(request: NextRequest): { id: string; email: string } | null {
  try {
    const raw = request.cookies.get(LOCAL_SESSION_COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<{ userId: string; email: string }>;
    if (typeof parsed.userId === 'string' && typeof parsed.email === 'string') {
      return { id: parsed.userId, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseConfig()) {
    // Local mode — resolve user from the local session cookie
    const localUser = readLocalUser(request);
    return { response, user: localUser };
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Fallback: if Supabase has no session, check local session cookie
  if (!user) {
    const localUser = readLocalUser(request);
    return { response, user: localUser };
  }

  return { response, user };
}
