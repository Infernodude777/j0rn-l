'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, FieldLabel } from '@/components/ui/input';
import { ErrorBanner, FullScreenLoader } from '@/components/ui/loading';
import { InkIcon } from '@/components/ui/ink-icon';
import { useUser } from '@/hooks/use-user';
import { useSettings, useTrustedContacts } from '@/hooks/use-settings';
import { uid } from '@/lib/utils';
import type { TrustedContact, UserSettings } from '@/lib/types';

export default function SettingsPage() {
  const { user } = useUser();
  const { data: settings, loading: settingsLoading, error: settingsError, persist: persistSettings } = useSettings();
  const { data: contacts, error: contactsError, add: addContactRow, remove: removeContactRow } = useTrustedContacts();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  if (settingsLoading || !settings || !user) return <FullScreenLoader />;

  function update<K extends keyof UserSettings>(k: K, v: UserSettings[K]) {
    if (!settings) return;
    persistSettings({ ...settings, [k]: v, updated_at: new Date().toISOString() }).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not save'),
    );
  }

  function persist(next?: Partial<UserSettings>) {
    if (!settings) return;
    const merged = { ...settings, ...next, updated_at: new Date().toISOString() };
    startTransition(async () => {
      try { await persistSettings(merged); }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not save'); }
    });
  }

  function addContact() {
    if (!newName.trim() || !user) return;
    const c: TrustedContact = {
      id: uid(), user_id: user.id, name: newName.trim(),
      email: newEmail.trim() || null, phone: null,
      relationship: null, notes: null, created_at: new Date().toISOString(),
    };
    startTransition(async () => {
      try {
        await addContactRow(c);
        setNewName(''); setNewEmail('');
      } catch (err) { setError(err instanceof Error ? err.message : 'Failed to add contact'); }
    });
  }

  function removeContact(id: string) {
    startTransition(async () => {
      try { await removeContactRow(id); }
      catch (err) { setError(err instanceof Error ? err.message : 'Failed to remove contact'); }
    });
  }

  return (
    <div className="space-y-lg pt-md">
      <header>
        <p className="font-hand text-[18px] text-[#8C8878] italic">tune the way these pages listen</p>
        <h1
          className="text-[36px] leading-none text-[#2C2C2C]"
          style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
        >
          Settings
        </h1>
      </header>

      {(error ?? settingsError ?? contactsError) && <ErrorBanner message={error ?? settingsError ?? contactsError ?? ''} />}

      <Card>
        <CardHeader><CardTitle>Reminders</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <Toggle label="Daily check-in reminder" description="A gentle nudge to log your day."
            checked={settings.checkin_reminder_enabled}
            onChange={(v) => { update('checkin_reminder_enabled', v); persist({ checkin_reminder_enabled: v }); }} />
          {settings.checkin_reminder_enabled && (
            <div>
              <FieldLabel>Reminder time</FieldLabel>
              <Input type="time" value={settings.checkin_reminder_time ?? '20:00'} onChange={(e) => update('checkin_reminder_time', e.target.value)} onBlur={() => persist()} />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notifications & privacy</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <Toggle label="Push notifications" description="Insights and reminders."
            checked={settings.notifications_enabled}
            onChange={(v) => { update('notifications_enabled', v); persist({ notifications_enabled: v }); }} />
          <Toggle label="AI-generated insights" description="Weekly reflections powered by your data."
            checked={settings.ai_insights_enabled}
            onChange={(v) => { update('ai_insights_enabled', v); persist({ ai_insights_enabled: v }); }} />
          <Toggle label="Private mode" description="Hide content in the app switcher."
            checked={settings.private_mode}
            onChange={(v) => { update('private_mode', v); persist({ private_mode: v }); }} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <div>
            <FieldLabel>Theme</FieldLabel>
            <Select value={settings.theme} onChange={(e) => { update('theme', e.target.value as UserSettings['theme']); persist({ theme: e.target.value as UserSettings['theme'] }); }}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Units</FieldLabel>
            <Select value={settings.units} onChange={(e) => { update('units', e.target.value as UserSettings['units']); persist({ units: e.target.value as UserSettings['units'] }); }}>
              <option value="metric">Metric (kg, cm)</option>
              <option value="imperial">Imperial (lb, in)</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trusted contacts</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <p className="font-body-md text-[#5C5850] opacity-90">
            People you trust to reach out to if your patterns look concerning. They are not contacted automatically.
          </p>
          <div className="space-y-sm">
            {contacts.length === 0 && <p className="font-hand text-[15px] text-[#8C8878] italic">No contacts added yet.</p>}
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-sm border-b border-[#E0D5BA]/50 last:border-b-0">
                <div>
                  <p className="font-label-md text-[#2C2C2C]">{c.name}</p>
                  {c.email && <p className="font-label-sm text-[#5C5850]">{c.email}</p>}
                </div>
                <button onClick={() => removeContact(c.id)} className="text-[#8C8878] hover:text-[#C5D8C0]" aria-label="Remove contact">
                  <InkIcon name="trash" size={18} />
                </button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-md">
            <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <Button onClick={addContact} disabled={!newName.trim() || pending} variant="outline" size="full" leftIcon={<InkIcon name="plus" size={18} />}>
            Add contact
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-md">
      <div>
        <p className="font-label-md text-[#2C2C2C]">{label}</p>
        {description && <p className="font-label-sm text-[#5C5850]">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={'w-12 h-7 rounded-full transition-colors ' + (checked ? 'bg-[#2C2C2C]' : 'bg-[#D0C5AA]')}
      >
        <span className={'block w-5 h-5 rounded-full bg-[#F5DEB3] shadow-sm transform transition-transform ' + (checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}
