'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, FieldLabel } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ErrorBanner, FullScreenLoader } from '@/components/ui/loading';
import { InkIcon } from '@/components/ui/ink-icon';
import { useProfile } from '@/hooks/use-profile';
import { useUser } from '@/hooks/use-user';
import { upsertProfile, signOut } from '@/lib/db/api';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/lib/types';

export default function ProfilePage() {
  const { user } = useUser();
  const { profile, loading, refetch } = useProfile();
  const router = useRouter();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [signingOut, setSigningOut] = useState<boolean>(false);

  useEffect(() => {
    if (profile) setDraft(profile);
  }, [profile]);

  if (loading || !draft || !user) return <FullScreenLoader />;

  const update = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    setSaved(false);
  };

  async function persist() {
    if (!draft || !user) return;
    setError(null);
    setSaved(false);
    startSaving(async () => {
      try {
        await upsertProfile({ ...draft, id: user.id, email: user.email, updated_at: new Date().toISOString() });
        setSaved(true);
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save');
      }
    });
  }

  return (
    <div className="space-y-lg pt-md">
      <header>
        <p className="font-hand text-[18px] text-[#8C8878] italic">who you are, on these pages</p>
        <h1
          className="text-[36px] leading-none text-[#2C2C2C]"
          style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
        >
          {draft.name || 'You'}
        </h1>
        <p className="font-body-md text-[#5C5850] mt-xs">{user.email}</p>
      </header>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader><CardTitle>Identity & context</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <div>
            <FieldLabel>Name</FieldLabel>
            <Input value={draft.name} onChange={(e) => update('name', e.target.value)} onBlur={persist} />
          </div>
          <div className="grid grid-cols-2 gap-md">
            <div><FieldLabel>Age</FieldLabel>
              <Input type="number" value={draft.age ?? ''} onChange={(e) => update('age', e.target.value ? Number(e.target.value) : null)} onBlur={persist} />
            </div>
            <div><FieldLabel>Region</FieldLabel>
              <Input value={draft.region ?? ''} onChange={(e) => update('region', e.target.value)} onBlur={persist} />
            </div>
          </div>
          <div>
            <FieldLabel>Timezone</FieldLabel>
            <Select value={draft.timezone ?? ''} onChange={(e) => { update('timezone', e.target.value); persist(); }}>
              <option value="">Select…</option>
              <option>GMT -8 (PST)</option><option>GMT -5 (EST)</option>
              <option>GMT +0 (UTC)</option><option>GMT +1 (CET)</option>
              <option>GMT +5:30 (IST)</option><option>GMT +9 (JST)</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Occupation</FieldLabel>
            <Input value={draft.occupation ?? ''} onChange={(e) => update('occupation', e.target.value)} onBlur={persist} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Physical baseline</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <div className="grid grid-cols-2 gap-md">
            <div><FieldLabel hint="cm">Height</FieldLabel>
              <Input type="number" value={draft.height_cm ?? ''} onChange={(e) => update('height_cm', e.target.value ? Number(e.target.value) : null)} onBlur={persist} />
            </div>
            <div><FieldLabel hint="kg">Weight</FieldLabel>
              <Input type="number" value={draft.weight_kg ?? ''} onChange={(e) => update('weight_kg', e.target.value ? Number(e.target.value) : null)} onBlur={persist} />
            </div>
          </div>
          <div>
            <FieldLabel hint="hrs">Sleep goal</FieldLabel>
            <Slider
              value={Math.round((draft.sleep_goal_hours ?? 8) * 2) / 2}
              onChange={(v) => { update('sleep_goal_hours', v); }}
              min={4} max={12} step={0.5}
            />
            <p className="font-hand text-[15px] text-[#5C5850] mt-1">
              {draft.sleep_goal_hours ?? 8} hours
            </p>
            <Button size="sm" variant="outline" onClick={persist} loading={saving}>Save sleep goal</Button>
          </div>
          <div>
            <FieldLabel hint="bpm">Resting heart rate</FieldLabel>
            <Input type="number" value={draft.resting_hr ?? ''} onChange={(e) => update('resting_hr', e.target.value ? Number(e.target.value) : null)} onBlur={persist} />
          </div>
          <div>
            <FieldLabel>Exercise frequency</FieldLabel>
            <Select value={draft.exercise_freq ?? ''} onChange={(e) => { update('exercise_freq', (e.target.value || null) as Profile['exercise_freq']); persist(); }}>
              <option value="">Select…</option>
              <option value="0-1">0-1 days / wk</option>
              <option value="2-3">2-3 days / wk</option>
              <option value="4-5">4-5 days / wk</option>
              <option value="6+">6+ days / wk</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardBody>
          <Button
            variant="outline"
            size="full"
            loading={signingOut}
            leftIcon={<InkIcon name="log-out" size={18} />}
            onClick={async () => {
              setSigningOut(true);
              try {
                await signOut();
                router.push('/login');
              } finally {
                setSigningOut(false);
              }
            }}
          >
            Sign out
          </Button>
        </CardBody>
      </Card>

      <p className="font-hand text-[14px] text-[#8C8878] text-center italic">
        {saving ? 'Saving…' : saved ? 'Saved.' : 'Changes save automatically when you tap away.'}
      </p>
    </div>
  );
}
