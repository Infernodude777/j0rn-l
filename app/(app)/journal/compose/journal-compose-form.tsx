'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea, FieldLabel } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ErrorBanner, FullScreenLoader } from '@/components/ui/loading';
import { useJournal } from '@/hooks/use-journal';
import { useUser } from '@/hooks/use-user';
import { getJournal } from '@/lib/db/api';
import { uid } from '@/lib/utils';

export function JournalComposeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editingId = params?.get('id') ?? undefined;
  const { user } = useUser();
  const { save, uploadPhoto } = useJournal();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<number>(6);
  const [tagsInput, setTagsInput] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState<boolean>(!!editingId);
  const [currentId, setCurrentId] = useState<string | undefined>(editingId);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingId) return;
    setLoading(true);
    getJournal(editingId)
      .then((e) => {
        if (e) {
          setTitle(e.title ?? '');
          setBody(e.body);
          setMood(e.mood ?? 6);
          setTagsInput(e.tags.join(', '));
          setPhotos(e.photo_urls);
          setVoiceNote(e.voice_note_url);
          setCurrentId(e.id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [editingId]);

  if (!user) return null;
  if (loading) return <FullScreenLoader />;

  function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    Promise.allSettled(files.map((f) => uploadPhoto(f)))
      .then((results) => {
        const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (ok.length) setPhotos((p) => [...p, ...ok]);
        if (failed) setError(`${failed} photo${failed > 1 ? 's' : ''} could not be uploaded.`);
      });
  }

  function startVoice() {
    setRecording(true);
    // Voice notes placeholder: in production this should request microphone
    // permission and upload the resulting blob to Supabase Storage.
    setTimeout(() => {
      setVoiceNote(`voice-${uid()}.webm`);
      setRecording(false);
    }, 1200);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
    startTransition(async () => {
      try {
        const saved = await save({
          id: currentId,
          title: title || null,
          body,
          mood,
          tags,
          photo_urls: photos,
          voice_note_url: voiceNote,
          sentiment: null,
          source: 'web',
          external_id: null,
          external_meta: {},
        });
        router.push(`/journal/${saved.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save entry');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-lg pt-lg">
      <header>
        <h1 className="font-h1-mobile text-h1-mobile text-primary">{editingId ? 'Edit entry' : 'New entry'}</h1>
        <p className="font-body-md text-secondary opacity-80">A few sentences is enough.</p>
      </header>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardBody className="space-y-md">
          <div>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A slow morning" />
          </div>
          <div>
            <FieldLabel htmlFor="body">Body</FieldLabel>
            <Textarea id="body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What stood out today?" required />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tags & mood</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <div>
            <FieldLabel hint="Comma separated">Tags</FieldLabel>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="morning, rest, work" />
          </div>
          <Slider value={mood} onChange={setMood} min={1} max={10} />
          <p className="font-label-sm text-secondary opacity-70">Mood from low (1) to high (10)</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Photos & voice</CardTitle></CardHeader>
        <CardBody className="space-y-md">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickPhotos} />
          <div className="flex flex-wrap gap-sm">
            <Button type="button" variant="outline" leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_photo_alternate</span>} onClick={() => fileRef.current?.click()}>
              Add photos
            </Button>
            <Button
              type="button"
              variant={recording ? 'danger' : 'outline'}
              leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>{recording ? 'stop_circle' : 'mic'}</span>}
              onClick={startVoice}
              loading={recording}
            >
              {voiceNote ? 'Re-record' : 'Voice note'}
            </Button>
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-sm">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-outline-variant">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#F5DEB3]/80 text-[#D4786E] flex items-center justify-center"
                    aria-label="Remove"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          {voiceNote && <p className="font-label-sm text-secondary">Voice note attached.</p>}
        </CardBody>
      </Card>

      <div className="flex gap-md">
        <Button type="button" variant="outline" size="full" onClick={() => router.push('/journal')}>Cancel</Button>
        <Button type="submit" variant="primary" size="full" loading={pending} disabled={!body.trim()}>
          {editingId ? 'Update' : 'Save entry'}
        </Button>
      </div>
    </form>
  );
}
