'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { ErrorBanner } from '@/components/ui/loading';
import { InkIcon } from '@/components/ui/ink-icon';
import { useJournal } from '@/hooks/use-journal';
import { useUser } from '@/hooks/use-user';
import { upsertNotification, getJournal } from '@/lib/db/api';
import { makeSystemNotification } from '@/lib/nudges';
import { todayISO, cn } from '@/lib/utils';

const FIVE_MINUTES = 5 * 60;

export function RantForm() {
  const router = useRouter();
  const { user } = useUser();
  const { save, data } = useJournal();
  const [body, setBody] = useState('');
  const [mood, setMood] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(FIVE_MINUTES);
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  // ---- Dictation ----
  const [listening, setListening] = useState(false);
  const [speechSupported] = useState(() => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startListening = useCallback(() => {
    const SR: any = typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
    if (!SR) return;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognitionRef.current = recognition;

    // Snapshot the current body text via ref so dictation always appends
    // to whatever the user typed or previously dictated.
    let baseText = bodyRef.current;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      if (final) {
        baseText += final + ' ';
        setBody(baseText);
        bodyRef.current = baseText;
      }
      if (interim) {
        setBody(baseText + interim);
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        setListening(false);
        try { recognition.stop(); } catch { /* ignore */ }
      }, 2500);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Dictation: ${event.error}`);
      }
      setListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    recognition.onend = () => {
      setListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    try {
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setError('Could not access the microphone.');
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.abort();
    } catch { /* ignore */ }
    recognitionRef.current = null;
    setListening(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  const toggleDictation = () => {
    if (listening) stopListening();
    else startListening();
  };

  // Clean up dictation on unmount
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort(); } catch { /* ignore */ }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  // Countdown
  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, secondsLeft]);

  // Compute consecutive-day rant streak on mount
  useEffect(() => {
    if (!data || data.length === 0) {
      setStreak(0);
      return;
    }
    const rants = data
      .filter((j) => (j.tags ?? []).includes('rant'))
      .map((j) => j.created_at.slice(0, 10))
      .sort((a, b) => b.localeCompare(a));
    if (rants.length === 0) {
      setStreak(0);
      return;
    }
    let count = 0;
    const today = new Date(todayISO());
    for (let i = 0; i < rants.length; i++) {
      const d = new Date(rants[i]!);
      const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
      if (diff === count) count++;
      else break;
    }
    setStreak(count);
  }, [data]);

  // Auto-focus the textarea
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerColor =
    secondsLeft <= 0
      ? 'text-[#C5D8C0]'
      : secondsLeft <= 60
      ? 'text-[#C5D8C0]'
      : 'text-[#5C5850]';
  const timerExpired = secondsLeft <= 0;
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;

  function onSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user) return;
    if (!body.trim()) {
      setError('A rant needs at least a few words.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await save({
          title: null,
          body: body.trim(),
          mood,
          tags: ['rant'],
          photo_urls: [],
          voice_note_url: null,
          sentiment: null,
          source: 'web',
          external_id: null,
          external_meta: { kind: 'daily_rant', duration_seconds: FIVE_MINUTES - secondsLeft },
        });
        // Lightweight confirmation notification
        await upsertNotification(
          makeSystemNotification(
            user.id,
            'Rant saved',
            `Today's 5-minute rant is in the journal. Streak: ${streak + 1} day${streak + 1 === 1 ? '' : 's'}.`,
          ),
        );
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save rant');
      }
    });
  }

  if (saved) {
    return (
      <div className="pt-lg pb-24 space-y-lg">
        <Card>
          <CardBody className="text-center py-xl space-y-md">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-[#E5EDE2] border border-[#9CAF92]">
              <InkIcon name="check-double" size={32} className="text-[#3A6470]" />
            </div>
            <h1
              className="text-[32px] leading-tight text-[#2C2C2C]"
              style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
            >
              Rant saved.
            </h1>
            <p className="font-body-md text-[#5C5850] max-w-md mx-auto">
              {wordCount} words. {streak + 1}-day streak. The pages are better for it.
            </p>
            <div className="flex flex-wrap gap-sm justify-center pt-sm">
              <Button variant="outline" onClick={() => router.push('/journal')}>
                See all entries
              </Button>
              <Button variant="primary" onClick={() => router.push('/dashboard')}>
                Back to dashboard
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="pt-lg pb-24 space-y-lg">
      {/* HERO */}
      <header className="flex items-start justify-between gap-md">
        <div>
          <p className="font-hand text-[18px] text-[#8C8878] italic">
            a daily 5-minute practice
          </p>
          <h1
            className="text-[36px] leading-none text-[#2C2C2C]"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            Daily Rant
          </h1>
          <p className="font-body-md text-[#5C5850] mt-xs max-w-md">
            Write about anything. Big or small. The point is to put it on the page.
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center border-2',
              timerExpired ? 'border-[#C5D8C0] bg-[#C5D8C0]' : 'border-[#D0C5AA] bg-[#F5DEB3]',
            )}
          >
            <div className="text-center leading-none">
              <p
                className={cn('text-[22px] font-mono', timerColor)}
                style={{ fontFamily: 'var(--font-nanum), Nanum Gothic, sans-serif', fontWeight: 700 }}
              >
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </p>
              <p className="font-label-sm text-[#8C8878] mt-1">
                {timerExpired ? 'time\u2019s up' : running ? 'writing\u2026' : 'ready'}
              </p>
            </div>
          </div>
          {streak > 0 && (
            <p className="font-hand text-[14px] text-[#C5D8C0] flex items-center gap-1">
              <InkIcon name="fire" size={14} />
              {streak}-day streak
            </p>
          )}
        </div>
      </header>

      {error && <ErrorBanner message={error} />}

      {/* WRITING SURFACE */}
      <Card>
        <CardBody className="p-0 relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setRunning(true)}
            rows={14}
            placeholder={timerExpired ? 'Keep going. The timer is just a guide.' : 'What\u2019s on your mind? Start anywhere\u2026'}
            className="w-full bg-[#F5DEB3] px-lg py-lg font-body-lg text-[#2C2C2C] placeholder:text-[#8C8878]/70 resize-none focus:outline-none min-h-[300px] leading-relaxed"
            style={{
              fontFamily: 'var(--font-lexend), Lexend, sans-serif',
              ...(listening ? { borderColor: '#C5D8C0', boxShadow: '0 0 0 2px rgba(156, 175, 146, 0.2)' } : {}),
            }}
            disabled={pending}
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleDictation}
              disabled={pending}
              aria-label={listening ? 'Stop dictation' : 'Start voice dictation'}
              className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                listening
                  ? 'bg-[#9CAF92] text-[#FFFFFF] shadow-lg shadow-[#9CAF92]/30'
                  : 'bg-[#E0D5BA] text-[#8C8878] hover:bg-[#D0C5AA] hover:text-[#5C5850]'
              }`}
            >
              <InkIcon
                name={listening ? 'mic-filled' : 'mic'}
                size={18}
                className={listening ? 'animate-pulse' : ''}
              />
            </button>
          )}
          {listening && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#9CAF92]/20 border border-[#C5D8C0]">
              <span className="flex gap-[2px]">
                {[10, 16, 12, 14].map((h, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-[#9CAF92] animate-pulse"
                    style={{ height: `${h}px`, animationDelay: `${i * 120}ms`, animationDuration: '0.6s' }}
                  />
                ))}
              </span>
              <span className="font-hand text-[11px] text-[#5C5850] italic">Listening…</span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* MOOD */}
      <Card>
        <CardBody className="space-y-sm">
          <div className="flex items-center justify-between">
            <p className="font-label-md text-[#2C2C2C] uppercase tracking-wider">
              Mood right now
            </p>
            <p
              className="text-[18px] text-[#C5D8C0]"
              style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
            >
              {mood}/10
            </p>
          </div>
          <Slider value={mood} onChange={setMood} min={1} max={10} />
          <div className="flex justify-between font-label-sm text-[#8C8878]">
            <span>heavy</span>
            <span>neutral</span>
            <span>bright</span>
          </div>
        </CardBody>
      </Card>

      {/* META + ACTIONS */}
      <div className="sticky bottom-24 z-20 pt-md">
        <div className="rounded-2xl border border-[#E0D5BA] bg-[#F5DEB3] paper-texture shadow-paper p-md">
          <div className="relative z-10 flex items-center gap-md">
            <div className="flex-1 min-w-0">
              <p className="font-label-md text-[#5C5850] uppercase tracking-wider">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </p>
              <p className="font-body-sm text-[#8C8878] truncate">
                {timerExpired
                  ? 'You\u2019re past 5 minutes. Save when you\u2019re ready.'
                  : running
                  ? `Keep writing \u2014 ${secondsLeft}s left in the window.`
                  : 'Tap the box to start the timer.'}
              </p>
            </div>
            <div className="flex items-center gap-sm">
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
                Later
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={pending}
                disabled={!body.trim()}
                leftIcon={<InkIcon name="check-double" size={16} />}
              >
                Save rant
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
