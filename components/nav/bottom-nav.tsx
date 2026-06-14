'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { InkIcon, type InkIconName } from '@/components/ui/ink-icon';

const items: { href: string; label: string; icon: InkIconName; }[] = [
  { href: '/dashboard',     label: 'Home',     icon: 'home'    },
  { href: '/checkin',       label: 'Check-In', icon: 'sparkle' },
  { href: '/trends',        label: 'Trends',   icon: 'wave'    },
  { href: '/insights',      label: 'Insights',    icon: 'leaf'    },
  { href: '/action-plan',   label: 'Plan',       icon: 'compass'  },
  { href: '/settings',      label: 'Settings', icon: 'gear'    },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F5DEB3] border-t border-[#E0D5BA] shadow-[0_-2px_8px_rgba(44,44,44,0.06)]">
      <ul className="grid grid-cols-6">
        {items.map((it) => {
          const active = pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-[2px] py-sm transition-colors',
                  active ? 'text-[#9CAF92]' : 'text-[#5C5850] hover:text-[#2C2C2C]',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <InkIcon name={it.icon} size={20} />
                <span className="font-label-sm text-[10px] uppercase tracking-wider">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
