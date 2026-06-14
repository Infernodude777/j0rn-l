'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, FieldLabel } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/loading';
import { signInWithEmail, signInWithOAuth } from '@/lib/db/api';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [oauthPending, setOauthPending] = useState<'google' | 'apple' | null>(null);

  // The built-in admin login ('admin' / 'admin' or 'admin@local.test' / 'admin')
  // bypasses standard email/password format requirements. When the user is
  // attempting that shortcut, the HTML5 validation (type=email, minLength=6)
  // is relaxed so the browser doesn't block the submit.
  const isAdminAttempt =
    (email.trim().toLowerCase() === 'admin' || email.trim().toLowerCase() === 'admin@local.test') && password === 'admin';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await signInWithEmail(email, password);
        router.push(next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not sign in');
      }
    });
  }

  function onOAuth(provider: 'google' | 'apple') {
    setOauthPending(provider);
    setError(null);
    startTransition(async () => {
      try {
        await signInWithOAuth(provider);
        router.push(next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'OAuth sign-in failed');
        setOauthPending(null);
      }
    });
  }

  return (
    <main className="w-full max-w-sm">
      <div className="flex flex-col gap-4">

        {error && <ErrorBanner message={error} />}

        <Button
          variant="primary"
          size="full"
          onClick={() => onOAuth('google')}
          loading={oauthPending === 'google'}
          disabled={pending || oauthPending !== null}
          leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>login</span>}
        >
          Continue with Google
        </Button>

        <Button
          variant="primary"
          size="full"
          onClick={() => onOAuth('apple')}
          loading={oauthPending === 'apple'}
          disabled={pending || oauthPending !== null}
          leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>brand_family</span>}
        >
          Continue with Apple
        </Button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-[#D0C5AA]" />
          <span className="text-xs text-[#5C5850] uppercase tracking-wider font-semibold">or</span>
          <div className="flex-1 h-px bg-[#D0C5AA]" />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={isAdminAttempt}>
          <FieldLabel>Email</FieldLabel>
          <Input
            type={isAdminAttempt ? 'text' : 'email'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
          <FieldLabel>Password</FieldLabel>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            minLength={isAdminAttempt ? undefined : 6}
          />
          <Button type="submit" variant="primary" size="full" loading={pending}>
            Sign in with email
          </Button>
        </form>

        <div className="text-center mt-2">
          <Link className="text-sm text-[#2C2C2C] underline underline-offset-4" href={`/signup?next=${encodeURIComponent(next)}`}>
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
