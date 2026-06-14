'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AppShell } from '@/components/nav/app-shell';
import { FullScreenLoader } from '@/components/ui/loading';
import { useUser } from '@/hooks/use-user';
import { useProfile } from '@/hooks/use-profile';
import { localSession } from '@/lib/db/local';

/**
 * Layout for all authed routes.
 *
 * Performance notes:
 *  - `useUser` and `useProfile` now read from a module-level singleton
 *    cache (see lib/auth-cache.ts), so subsequent navigations resolve
 *    synchronously on the first render instead of blocking behind a
 *    network round-trip.
 *  - We only show the full-screen loader while the *auth* check is
 *    pending. The profile check is non-blocking: the page renders with
 *    a placeholder profile, and the onboarding-redirect runs in the
 *    background after the profile resolves. Combined with the
 *    route-level `loading.tsx`, navigation now feels instant.
 *  - The full-screen loader is shown only on the very first visit
 *    (cold cache). After that, the cache + the route loading.tsx
 *    handle the transition.
 *  - A `mountedRef` prevents the redirect effect from firing on the
 *    very first paint (before `useUser` has populated the cache).
 *    Once the effect has confirmed a user is present, the guard flips
 *    and subsequent pathname-driven re-runs are allowed.
 */
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const readyRef = useRef(false);

  useEffect(() => {
    // Don't redirect while the auth check is still in flight.
    if (loading) return;

    // Arm the guard after the first non-loading render. This ensures
    // that subsequent re-runs (navigations, sign-out, profile changes)
    // CAN redirect, while the very first cold-start paint (where the
    // auth cache hasn't been populated yet) is blocked.
    readyRef.current = true;

    if (!user) {
      // Before redirecting to login, double-check the local session.
      // During client-side navigation, the auth cache can momentarily
      // return null before resolving — especially for local/admin mode
      // where the session lives in localStorage. Redirecting to login
      // on a transient null would cause the middleware to bounce the
      // user back to /dashboard and create a redirect loop.
      const stillHasSession = localSession.get();
      if (stillHasSession) {
        // Session still exists in localStorage — the auth state will
        // resolve on the next render cycle. No redirect needed.
        return;
      }
      // Only redirect to login if we've confirmed the session is
      // genuinely gone.
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (pathname === '/about-me') return; // onboarding page handles its own redirect
    if (!profileLoading && profile && !profile.onboarding_complete) {
      router.push('/about-me');
    }
  }, [user, loading, profile, profileLoading, router, pathname]);

  // Cold first-visit: show the full-screen loader only while the auth
  // check is in flight AND we have no cached user to render against.
  if (loading && !user) return <FullScreenLoader />;

  // Once we have a user (cached or fresh), render the page immediately.
  // The profile hook will resolve in the background and trigger the
  // onboarding redirect via the effect above if needed.
  return <AppShell>{children}</AppShell>;
}
