'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/use-notifications';
import { InkIcon } from '@/components/ui/ink-icon';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';

export function NotificationsBell() {
  const { items, loading, unreadCount, markRead, markAllRead, generateAndStore } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // The bell is mounted in the app shell so it's always alive \u2014 it
  // owns nudge generation so there's a single source of truth for
  // notifications (the dashboard card reads the same hook instance).
  //
  // Throttled: only fires once per ~60s across the whole tab so quick
  // navigation between pages doesn't spam the DB with the same scan.
  const lastGenRef = useRef<number>(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastGenRef.current < 60_000) return;
    lastGenRef.current = now;
    generateAndStore().catch(() => {});
  }, [generateAndStore]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onClickItem = async (n: Notification) => {
    await markRead(n.id);
    setOpen(false);
    if (n.kind === 'checkin_reminder') router.push('/checkin');
    else if (n.kind === 'insight_ready') router.push('/insights');
    else if (n.kind === 'trusted_alert') router.push('/settings');
    else if (n.kind === 'system') router.push('/dashboard');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications (${unreadCount} unread)`}
        className={cn(
          'relative w-10 h-10 rounded-full flex items-center justify-center border border-[#E0D5BA] bg-[#F5DEB3] hover:bg-[#C5D8C0] transition-colors text-[#2C2C2C]',
        )}
      >
        <InkIcon name="bell" size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D4786E] text-[#FFFFFF] text-[10px] font-bold flex items-center justify-center border-2 border-[#F5DEB3]"
            aria-hidden
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed md:absolute top-14 md:top-12 left-2 right-2 md:left-auto md:right-0 md:w-[360px] z-50 rounded-2xl border border-outline-variant bg-surface-container-low shadow-paper overflow-hidden paper-texture"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant">
            <p className="font-label-md text-primary">Notifications</p>
            <div className="flex items-center gap-sm">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="font-label-sm text-[#C5D8C0] hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full border border-[#D0C5AA] text-[#2C2C2C] flex items-center justify-center hover:bg-[#C5D8C0]"
                aria-label="Close"
              >
                <InkIcon name="close" size={14} />
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {loading ? (
              <p className="px-md py-lg text-center font-body-sm text-on-surface-variant">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <div className="px-md py-xl text-center">
                <InkIcon name="bell" size={28} className="text-[#8C8878] mx-auto" />
                <p className="font-body-sm text-on-surface-variant mt-sm">
                  No notifications yet. Nudges will appear here as patterns emerge.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => onClickItem(n)}
                      className={cn(
                        'w-full text-left px-md py-sm flex items-start gap-sm hover:bg-[#C5D8C0]/40 transition-colors',
                        !n.read && 'bg-[#C5D8C0]/30',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-[6px] w-2 h-2 rounded-full shrink-0',
                          n.read ? 'bg-outline-variant' : 'bg-[#C5D8C0]',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-xs">
                          <span className="font-label-md text-primary truncate">{n.title}</span>
                          <span className="font-label-sm text-on-surface-variant shrink-0">
                            {timeAgo(n.created_at)}
                          </span>
                        </span>
                        <span className="block font-body-sm text-secondary mt-[2px] line-clamp-3">
                          {n.body}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
