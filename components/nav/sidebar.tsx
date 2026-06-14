'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { InkIcon, type InkIconName } from '@/components/ui/ink-icon';
import { Avatar } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/use-profile';

const NAV_ITEMS: { href: string; label: string; icon: InkIconName; }[] = [
  { href: '/dashboard',     label: 'Home',           icon: 'edit'      },
  { href: '/trends',        label: 'Trends',         icon: 'wave'      },
  { href: '/insights',      label: 'Insights',       icon: 'leaf'      },
  { href: '/action-plan',   label: 'Plan',           icon: 'compass'   },
  { href: '/checkin',       label: 'Check-In',       icon: 'heart'     },
  { href: '/journal',       label: 'Journal',        icon: 'book'      },
  { href: '/connect-apps',  label: 'Connections',     icon: 'link'      },
  { href: '/settings',      label: 'Settings',        icon: 'gear'      },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useProfile();
  return (
    <aside className="hidden md:flex flex-col w-[240px] lg:w-[260px] shrink-0 h-screen sticky top-0 px-lg py-xl border-r border-[#C8D8BC] bg-[#E2EED8]">
      {/* LOGO ---------------------------------------------------------- */}
      <Link href="/dashboard" className="block mb-xl group" aria-label="J0rn@l home">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="J0RN@L logo"
            className="w-[36px] h-[36px] object-contain shrink-0"
          />
          <h1
            className="font-logo text-[34px] leading-none tracking-[0.18em] text-[#2C2C2C] hover-wobble"
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
          >
            J<span className="inline-block -mx-[2px] text-[#2C2C2C]">0</span>RN@L
          </h1>
        </div>
        <p className="font-hand text-[15px] text-[#8C8878] mt-[2px]">a small, soft place to land</p>
      </Link>

      {/* PROFILE ------------------------------------------------------- */}
      <div className="flex items-start gap-md mb-xl">
        <div className="relative shrink-0">
          <Avatar
            name={profile?.name ?? 'You'}
            src={profile?.avatar_url ?? null}
            size={44}
            className="border-[#C8D8BC] bg-[#B0C8A8]"
          />
          <span className="absolute -bottom-[2px] -right-[2px] w-3 h-3 rounded-full bg-[#2C2C2C] border-2 border-[#E2EED8]" aria-hidden />
        </div>
        <div className="min-w-0 pt-[2px]">
          <p className="font-label-md text-[#2C2C2C] leading-tight truncate">
            {profile?.name?.split(' ')[0] ? `Dear ${profile.name.split(' ')[0]}` : 'Dear Traveler'}
          </p>
          <Link
            href="/profile"
            className="font-hand text-[14px] text-[#8C8878] hover:text-[#2C2C2C] italic"
          >
            write your intro…
          </Link>
        </div>
      </div>

      {/* NAV ----------------------------------------------------------- */}
      <nav className="flex-1 min-h-0">
        <ul className="space-y-[2px]">
          {NAV_ITEMS.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + '/');
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    'group relative flex items-center gap-md pl-md pr-md py-sm rounded-md text-[15px] transition-all',
                    active
                      ? 'bg-[#C5D8C0] text-[#2C2C2C] font-semibold'
                      : 'text-[#5C5850] hover:bg-[#D0E0C8] hover:text-[#2C2C2C]',
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#2C2C2C]"
                    />
                  )}
                  <InkIcon
                    name={it.icon}
                    size={18}
                    className={cn(active ? 'text-[#2C2C2C]' : 'text-[#8C8878] group-hover:text-[#2C2C2C]')}
                  />
                  <span className="tracking-wide">{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* NEW ENTRY ----------------------------------------------------- */}
      <Link
        href="/journal/compose"
        className="mt-lg paper-card-ink flex items-center gap-md justify-center h-12 text-[15px] tracking-wide hover:opacity-95 active:scale-[0.98] transition-transform"
      >
        <InkIcon name="plus" size={18} className="text-[#FFFFFF]" />
        <span style={{ fontWeight: 700 }}>New Entry</span>
      </Link>
    </aside>
  );
}
