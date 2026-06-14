'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, FieldLabel } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ErrorBanner } from '@/components/ui/loading';
import { InkIcon } from '@/components/ui/ink-icon';
import { useUser } from '@/hooks/use-user';
import { useProfile } from '@/hooks/use-profile';
import { upsertProfile } from '@/lib/db/api';
import type { Profile } from '@/lib/types';

export default function AboutMePage() {
  const { user } = useUser();
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();
  const [draft, setDraft] = useState<Profile>(() => emptyProfile(user?.id ?? '', user?.email ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [stress, setStress] = useState<Profile['typical_stress']>('moderate');

  useEffect(() => {
    if (!profileLoading && profile?.onboarding_complete) {
      router.replace('/dashboard');
    }
  }, [profileLoading, profile, router]);

  useEffect(() => {
    if (profile) {
      setDraft(profile);
      if (profile.typical_stress) setStress(profile.typical_stress);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    setDraft((d) => {
      if (d.id === user.id && d.email === user.email) return d;
      return { ...d, id: user.id, email: user.email };
    });
  }, [user]);

  const update = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertProfile({
          ...draft, id: user.id, email: user.email,
          typical_stress: stress, onboarding_complete: true,
          updated_at: new Date().toISOString(),
        });
        router.push('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-lg pt-md">
      <header>
        <p className="font-hand text-[18px] text-[#8C8878] italic">a small portrait, before we begin</p>
        <h1
          className="text-[36px] leading-none text-[#2C2C2C]"
          style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
        >
          Tell us about yourself
        </h1>
        <p className="font-body-md text-[#5C5850] mt-xs">We build your personal baseline from here.</p>
      </header>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader><CardTitle>Identity & context</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <div><FieldLabel>Name</FieldLabel>
            <Input value={draft.name} onChange={(e) => update('name', e.target.value)} placeholder="Your name" required />
          </div>
          <div className="grid grid-cols-2 gap-md">
            <div><FieldLabel>Age</FieldLabel>
              <Input type="number" value={draft.age ?? ''} onChange={(e) => update('age', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div><FieldLabel>Region</FieldLabel>
              <Input value={draft.region ?? ''} onChange={(e) => update('region', e.target.value)} placeholder="Country" />
            </div>
          </div>
          <div><FieldLabel>Timezone</FieldLabel>
            <Select value={draft.timezone ?? ''} onChange={(e) => update('timezone', e.target.value)}>
              <option value="">Select…</option>
              <option>GMT -8 (PST)</option><option>GMT -5 (EST)</option>
              <option>GMT +0 (UTC)</option><option>GMT +1 (CET)</option>
              <option>GMT +5:30 (IST)</option><option>GMT +9 (JST)</option>
            </Select>
          </div>
          <div><FieldLabel>Occupation</FieldLabel>
            <Input value={draft.occupation ?? ''} onChange={(e) => update('occupation', e.target.value)} placeholder="Role" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Physical baseline</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <div className="grid grid-cols-2 gap-md">
            <div><FieldLabel hint="cm">Height</FieldLabel>
              <Input type="number" value={draft.height_cm ?? ''} onChange={(e) => update('height_cm', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div><FieldLabel hint="kg">Weight</FieldLabel>
              <Input type="number" value={draft.weight_kg ?? ''} onChange={(e) => update('weight_kg', e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>
          <div>
            <FieldLabel hint="hrs">Daily sleep goal</FieldLabel>
            <Slider value={Math.round(draft.sleep_goal_hours ?? 8)} onChange={(v) => update('sleep_goal_hours', v)} min={4} max={12} step={0.5} />
          </div>
          <div className="grid grid-cols-2 gap-md">
            <div><FieldLabel hint="bpm">Resting HR</FieldLabel>
              <Input type="number" value={draft.resting_hr ?? ''} onChange={(e) => update('resting_hr', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div><FieldLabel>Exercise freq</FieldLabel>
              <Select value={draft.exercise_freq ?? ''} onChange={(e) => update('exercise_freq', (e.target.value || null) as Profile['exercise_freq'])}>
                <option value="">Select…</option>
                <option value="0-1">0-1 days / wk</option>
                <option value="2-3">2-3 days / wk</option>
                <option value="4-5">4-5 days / wk</option>
                <option value="6+">6+ days / wk</option>
              </Select>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lifestyle & load</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <div><FieldLabel>Schedule</FieldLabel>
            <Select value={draft.work_schedule ?? ''} onChange={(e) => update('work_schedule', (e.target.value || null) as Profile['work_schedule'])}>
              <option value="">Select…</option>
              <option value="standard">Standard (9-5)</option>
              <option value="shift">Shift (rotational)</option>
              <option value="night">Night shift</option>
              <option value="flexible">Flexible / freelance</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Typical stress level</FieldLabel>
            <div className="flex items-center gap-sm mt-sm">
              {(['low', 'moderate', 'high'] as const).map((s) => (
                <button type="button" key={s} onClick={() => setStress(s)}
                  className={
                    'flex-1 py-sm px-xs border rounded-sm font-label-sm capitalize ' +
                    (stress === s
                      ? 'border-[#2C2C2C] text-[#2C2C2C] bg-[#C5D8C0] ring-1 ring-[#2C2C2C]'
                      : 'border-[#D0C5AA] text-[#5C5850] bg-[#F5DEB3] hover:bg-[#C5D8C0]/60')
                  }>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div><FieldLabel hint="hrs">Avg. outdoor time</FieldLabel>
            <Input type="number" step="0.5" value={draft.outdoor_hours ?? ''} onChange={(e) => update('outdoor_hours', e.target.value ? Number(e.target.value) : null)} />
          </div>
        </CardBody>
      </Card>

      <Button type="submit" variant="primary" size="full" loading={pending} rightIcon={<InkIcon name="arrow-right" size={18} />}>
        Begin the pages
      </Button>
    </form>
  );
}

function emptyProfile(id: string, email: string): Profile {
  return {
    id, email, name: '',
    age: null, height_cm: null, weight_kg: null,
    region: null, timezone: null, occupation: null,
    sleep_goal_hours: 8, resting_hr: null,
    exercise_freq: null, work_schedule: null,
    typical_stress: 'moderate', outdoor_hours: null,
    onboarding_complete: false, avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
