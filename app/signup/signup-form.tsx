'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, FieldLabel } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/loading';
import { signUpWithEmail, signInWithOAuth } from '@/lib/db/api';

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/about-me';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [oauthPending, setOauthPending] = useState<'google' | 'apple' | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await signUpWithEmail(email, password, name);
        router.push(next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create account');
      }
    });
  }

  function onOAuth(provider: 'google' | 'apple') {
    setOauthPending(provider);
    startTransition(async () => {
      try {
        await signInWithOAuth(provider);
        router.push('/about-me');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'OAuth sign-up failed');
        setOauthPending(null);
      }
    });
  }

  return (
    <main className="w-full max-w-sm bg-brand-card paper-texture rounded-xl p-lg relative overflow-hidden border border-outline-variant shadow-paper">
      <div className="relative z-10 flex flex-col gap-md">
        {error && <ErrorBanner message={error} />}

        <Button
          variant="secondary"
          size="full"
          onClick={() => onOAuth('google')}
          loading={oauthPending === 'google'}
          disabled={pending || oauthPending !== null}
          leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>login</span>}
        >
          Sign up with Google
        </Button>
        <Button
          variant="secondary"
          size="full"
          onClick={() => onOAuth('apple')}
          loading={oauthPending === 'apple'}
          disabled={pending || oauthPending !== null}
          leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>brand_family</span>}
        >
          Sign up with Apple
        </Button>

        <form onSubmit={onSubmit} className="flex flex-col gap-md">
          <FieldLabel htmlFor="su-name">Name</FieldLabel>
          <Input id="su-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required minLength={1} />
          <FieldLabel htmlFor="su-email">Email</FieldLabel>
          <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          <FieldLabel htmlFor="su-password">Password</FieldLabel>
          <Input id="su-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required autoComplete="new-password" minLength={6} />
          <Button type="submit" variant="primary" size="full" loading={pending}>
            Create account
          </Button>
        </form>

        <div className="text-center mt-sm">
          <Link className="font-label-md text-label-md text-primary underline underline-offset-4 hover:opacity-80" href="/login">
            I already have an account
          </Link>
        </div>
      </div>
    </main>
  );
}
