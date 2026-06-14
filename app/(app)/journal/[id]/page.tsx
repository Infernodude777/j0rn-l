'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FullScreenLoader, ErrorBanner } from '@/components/ui/loading';
import { getJournal } from '@/lib/db/api';
import { useJournal } from '@/hooks/use-journal';
import type { JournalEntry } from '@/lib/types';

export default function JournalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { remove } = useJournal();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    getJournal(params.id)
      .then(setEntry)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) return <FullScreenLoader />;
  if (!entry) return (
    <div className="pt-lg space-y-md">
      <ErrorBanner message="Entry not found" />
      <Button variant="outline" onClick={() => router.push('/journal')}>Back to journal</Button>
    </div>
  );

  return (
    <div className="space-y-lg pt-lg">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-label-sm text-secondary">{new Date(entry.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          <h1 className="font-h1-mobile text-h1-mobile text-primary">{entry.title || 'Untitled entry'}</h1>
        </div>
        <div className="flex gap-sm">
          <Button
            variant="outline"
            leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
            onClick={() => router.push(`/journal/compose?id=${entry.id}`)}
          >
            Edit
          </Button>
        </div>
      </header>

      <Card>
        <CardBody className="space-y-md">
          <p className="font-body-lg text-on-surface whitespace-pre-wrap leading-relaxed">{entry.body}</p>
          {entry.mood != null && (
            <p className="font-label-md text-secondary">Mood: {entry.mood}/10</p>
          )}
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-sm">
              {entry.tags.map((t) => (
                <span key={t} className="font-label-sm text-secondary">#{t}</span>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {entry.photo_urls.length > 0 && (
        <div className="grid grid-cols-2 gap-sm">
          {entry.photo_urls.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt="" className="w-full aspect-square object-cover rounded-md border border-outline-variant" />
          ))}
        </div>
      )}

      {entry.voice_note_url && (
        <Card>
          <CardBody className="flex items-center gap-md">
            <span className="material-symbols-outlined text-primary">mic</span>
            <p className="font-body-md text-on-surface">Voice note attached</p>
          </CardBody>
        </Card>
      )}

      <Button
        variant="outline"
        size="full"
        onClick={async () => {
          if (confirm('Delete this entry?')) {
            await remove(entry.id);
            router.push('/journal');
          }
        }}
      >
        Delete entry
      </Button>
    </div>
  );
}

