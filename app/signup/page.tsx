import { Suspense } from 'react';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-warm overflow-x-hidden">
      <div className="flex-1 flex flex-col items-center justify-center px-margin-mobile pt-xxl">
        <header className="text-center mb-xl">
          <img
            src="/logo.png"
            alt="J0RN@L logo"
            className="w-[52px] h-[52px] object-contain mx-auto mb-3"
          />
          <h1 className="font-logo text-[48px] tracking-[0.2em] leading-none mb-sm text-primary">J0RN@L</h1>
          <p className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
            Create your account.
          </p>
        </header>

        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
