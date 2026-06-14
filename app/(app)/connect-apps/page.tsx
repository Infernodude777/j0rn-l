'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { ErrorBanner, FullScreenLoader } from '@/components/ui/loading';
import { InkIcon } from '@/components/ui/ink-icon';
import { useUser } from '@/hooks/use-user';
import { useConnected } from '@/hooks/use-connected';
import { providerCatalog, type ProviderDef } from '@/lib/providers/catalog';
import { uid } from '@/lib/utils';
import type { ConnectedAccount } from '@/lib/types';

const ICON_MAP: Record<string, string> = {
  apple_health: 'heart',
  google_fit: 'sparkle',
  fitbit: 'bolt',
  oura: 'moon',
  garmin: 'tree',
  strava: 'people',
  google_calendar: 'calendar',
  apple_calendar: 'calendar',
  screen_time: 'devices',
  spotify: 'headphones',
  notion: 'book',
  todoist: 'check',
  discord: 'discord',
  instagram: 'instagram',
};

export default function ConnectAppsPage() {
  const { user } = useUser();
  const { data: accounts, loading, error: loadError, save } = useConnected();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (loading) return <FullScreenLoader />;

  function connect(p: ProviderDef) {
    if (!user) return;
    setError(null);
    startTransition(async () => {
      try {
        const next: ConnectedAccount = {
          id: uid(), user_id: user.id, provider: p.id, status: 'connected',
          connected_at: new Date().toISOString(), last_sync_at: new Date().toISOString(),
          metadata: { scope: p.scopes.join(' ') },
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        await save(next);
      } catch (err) { setError(err instanceof Error ? err.message : 'Failed to connect'); }
    });
  }

  function disconnect(p: ProviderDef) {
    if (!user) return;
    startTransition(async () => {
      try {
        const next: ConnectedAccount = {
          id: uid(), user_id: user.id, provider: p.id, status: 'disconnected',
          connected_at: null, last_sync_at: null, metadata: {},
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        await save(next);
      } catch (err) { setError(err instanceof Error ? err.message : 'Failed to disconnect'); }
    });
  }

  function statusFor(p: ProviderDef): ConnectedAccount['status'] {
    return accounts.find((a) => a.provider === p.id)?.status ?? 'disconnected';
  }

  return (
    <div className="space-y-lg pt-md">
      <header>
        <p className="font-hand text-[18px] text-[#8C8878] italic">sync sleep, activity, and vitals from your other tools</p>
        <h1
          className="text-[36px] leading-none text-[#2C2C2C]"
          style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
        >
          Connected Apps
        </h1>
      </header>

      {(error ?? loadError) && <ErrorBanner message={error ?? loadError ?? ''} />}

      <Card>
        <CardHeader><CardTitle>Health & activity</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          {providerCatalog.map((p) => {
            const status = statusFor(p);
            return (
              <div key={p.id} className="flex items-center justify-between gap-md py-sm border-b border-[#E0D5BA]/50 last:border-b-0">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-md bg-[#C5D8C0] flex items-center justify-center border border-[#D0C5AA]">
                    <InkIcon name={(ICON_MAP[p.id] ?? 'link') as any} size={20} className="text-[#2C2C2C]" />
                  </div>
                  <div>
                    <p className="font-label-md text-[#2C2C2C]">{p.name}</p>
                    <p className="font-label-sm text-[#5C5850]">{p.description}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-xs">
                  <StatusBadge tone={status === 'connected' ? 'connected' : status === 'pending' ? 'pending' : 'neutral'}>
                    {status === 'connected' ? 'Connected' : status === 'pending' ? 'Pending' : 'Disconnected'}
                  </StatusBadge>
                  {status === 'connected' ? (
                    <button onClick={() => disconnect(p)} className="font-hand text-[14px] text-[#5C5850] underline" disabled={pending}>
                      Disconnect
                    </button>
                  ) : (
                    <Button size="sm" onClick={() => connect(p)} disabled={pending}>Connect</Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <p className="font-hand text-[14px] text-[#8C8878] text-center italic">
        J0rn@l only connects to providers through official APIs. We do not scrape private data.
      </p>
    </div>
  );
}
