'use client';

import { BottomNav } from './bottom-nav';
import { TopBar } from './top-bar';
import { Sidebar } from './sidebar';
import { TherapistChat } from '@/components/chat/therapist-chat';
import type { ReactNode } from 'react';

/**
 * The app shell. On mobile we render a top bar + bottom nav. On desktop we
 * render a persistent left sidebar instead. The page contents get the same
 * horizontal padding either way so individual pages don't have to think
 * about it.
 *
 * The therapist chat FAB lives at the bottom-right of every page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-on-background md:flex">
      <Sidebar />
      <div className="flex-1 min-w-0 md:pb-0 pb-24">
        <TopBar />
        <main className="pt-xxl md:pt-xl px-margin-mobile md:px-margin-desktop max-w-md md:max-w-none md:mx-0">
          {children}
        </main>
      </div>
      <BottomNav />
      <TherapistChat />
    </div>
  );
}
