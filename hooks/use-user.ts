'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ADMIN_USER_ID, localSession, seedAdminData, seedLocalData } from '@/lib/db/local';
import type { AuthUser } from '@/lib/db/api';
import {
  ensureSupabaseSubscription,
  getCachedUser,
  invalidateUser,
  onUserChange,
  peekCachedUser,
  setCachedUser,
} from '@/lib/auth-cache';

interface SessionState {
  user: AuthUser | null;
  loading: boolean;
}

/**
 * Resolves the current authenticated user. Uses Supabase auth when
 * configured; otherwise falls back to a local-only session.
 *
 * Backed by a module-level singleton cache so subsequent mounts (e.g.
 * navigating between pages) return synchronously instead of re-fetching.
 * The Supabase `onAuthStateChange` subscription is also started exactly
 * once (in module scope) — navigation between pages no longer re-subscribes
 * or re-calls `getUser()`.
 */
export function useUser(): SessionState {
  // Synchronous initial read from the cache so the very first render after
  // navigation can show the page UI instead of a blocking loader.
  const cached = peekCachedUser();
  const [state, setState] = useState<SessionState>({
    user: cached ?? null,
    loading: cached === undefined,
  });

  useEffect(() => {
    let cancelled = false;
    const local = localSession.get();

    if (local) {
      // Keep the local/demo session alive even when Supabase is configured.
      if (local.userId === ADMIN_USER_ID) {
        seedAdminData();
      } else {
        seedLocalData(local.userId, local.email.split('@')[0] ?? 'You', local.email);
      }
    }

    // Subscribe to the module-level user-change channel. This is the only
    // subscription per page mount — no per-mount Supabase round-trip.
    const off = onUserChange((u) => {
      if (!cancelled) setState({ user: u, loading: false });
    });

    (async () => {
      const sb = createClient();
      if (sb) {
        // Triggers the first getUser() (if cache is empty) and starts the
        // module-level auth-state subscription so future sign-in/out events
        // flow through the listener above.
        const remoteUser = await getCachedUser(async () => {
          const { data } = await sb.auth.getUser();
          return data.user
            ? { id: data.user.id, email: data.user.email ?? '' }
            : null;
        });
        const user = remoteUser ?? (local ? { id: local.userId, email: local.email } : null);
        if (!cancelled) {
          setState({ user, loading: false });
          if (user) setCachedUser(user);
        }
        if (remoteUser) {
          ensureSupabaseSubscription(sb);
        }
        return;
      }

      // Local session — resolved synchronously from localStorage.
      if (local) {
        // Admin accounts get the full 30-day dramatic-decline seed data.
        // seedAdminData checks if the profile already exists and skips
        // re-seeding, so it's safe to call on every mount.
        if (local.userId === ADMIN_USER_ID) {
          seedAdminData();
        } else {
          seedLocalData(local.userId, local.email.split('@')[0] ?? 'You', local.email);
        }
      }
      const user: AuthUser | null = local ? { id: local.userId, email: local.email } : null;
      if (!cancelled) {
        setState({ user, loading: false });
        // Populate the module-level cache so peekCachedUser() returns the
        // correct value on subsequent mounts (prevents redirect bounce).
        // Only cache non-null users — caching null would cause the same
        // bounce on next sign-in (loading=false + user=null → redirect).
        if (user) setCachedUser(user);
      }
    })();

    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return state;
}
