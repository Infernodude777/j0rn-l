import { Suspense } from 'react';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5DEB3]">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <header className="text-center mb-10">
          <img
            src="/logo.png"
            alt="J0RN@L logo"
            className="w-[44px] h-[44px] object-contain mx-auto mb-3"
          />
          <h1 className="font-logo text-[40px] tracking-[0.2em] leading-none text-[#2C2C2C]">J0RN@L</h1>
        </header>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
