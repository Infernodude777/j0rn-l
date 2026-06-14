'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/use-profile';
import { InkIcon } from '@/components/ui/ink-icon';
import { NotificationsBell } from './notifications-bell';
import { signOut } from '@/lib/db/api';

export function TopBar() {
  const { profile } = useProfile();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/login');
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 md:left-[240px] lg:left-[260px] z-30 bg-[#E2EED8] border-b border-[#C8D8BC] flex justify-between items-center px-margin-mobile md:px-margin-desktop py-md">
      <button className="w-10 h-10 flex items-center justify-center text-[#2C2C2C] md:hidden" aria-label="Menu">
        <InkIcon name="menu" size={22} />
      </button>
      <div className="flex items-center gap-2 md:hidden">
        <img
          src="/logo.png"
          alt="J0RN@L logo"
          className="w-[26px] h-[26px] object-contain shrink-0"
        />
        <h1
          className="font-logo text-[24px] text-[#2C2C2C] tracking-[0.18em]"
          style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
        >
          J<span className="text-[#2C2C2C]">0</span>RN@L
        </h1>
      </div>
      <div className="md:ml-auto flex items-center gap-sm">
        <NotificationsBell />
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Profile menu"
            aria-expanded={menuOpen}
            className="block rounded-full hover:ring-2 hover:ring-[#C8D8BC] transition-shadow"
          >
            <Avatar name={profile?.name ?? 'You'} src={profile?.avatar_url ?? null} size={40} className="border-[#C8D8BC] bg-[#B0C8A8]" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full mt-2 z-20 w-48 bg-[#E8F2E0] border border-[#C8D8BC] rounded-lg shadow-lg overflow-hidden">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-md px-md py-sm text-[15px] text-[#2C2C2C] hover:bg-[#D0E0C8] transition-colors"
                >
                  <InkIcon name="user" size={16} className="text-[#8C8878]" />
                  View profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-md px-md py-sm text-[15px] text-[#2C2C2C] hover:bg-[#D0E0C8] transition-colors"
                >
                  <InkIcon name="gear" size={16} className="text-[#8C8878]" />
                  Settings
                </Link>
                <hr className="border-[#C8D8BC]" />
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex items-center gap-md px-md py-sm text-[15px] text-[#D4786E] hover:bg-[#D0E0C8] transition-colors w-full text-left"
                >
                  <InkIcon name="log-out" size={16} className="text-[#D4786E]" />
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
