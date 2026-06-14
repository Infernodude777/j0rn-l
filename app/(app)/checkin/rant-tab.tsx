'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { InkIcon } from '@/components/ui/ink-icon';
import { Slider } from '@/components/ui/slider';
import { useUser } from '@/hooks/use-user';
import { useJournal } from '@/hooks/use-journal';
import { todayISO } from '@/lib/utils';
import type { JournalEntry } from '@/lib/types';

const RANT_DURATION_SECONDS = 5 * 60;

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Inline 5-minute rant — lives inside the Safe Space (checkin) tab so the
 * user doesn't have to navigate to a separate page. Saves as a journal
 * entry tagged 'rant' and bumps a daily streak.
 */
export function RantTab({ onClose }: { onClose?: () => void }) {
  const { user } = useUser();
  const { data, refresh } = useJournal();
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(RANT_DURATION_SECONDS);
  const [running, setRunning] = useState(false);
  const [body, setBody] = useState('');
  const [mood, setMood] = useState(5);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const [listening, setListening] = useState(false);
  const [speechSupported] = useState(() => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition));

  // Compute streak of consecutive days (ending today) with a 'rant' tag.
  const streak = useMemo(() => {
    if (!data) return 0;
    const rantDays = new Set(
      data
        .filter((j) => (j.tags ?? []).includes('rant'))
        .map((j) => j.created_at.slice(0, 10)),
    );
    let count = 0;
    const cursor = new Date();
    while (rantDays.has(cursor.toISOString().slice(0, 10))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [data]);

  const todayRant = useMemo(
    () =>
      (data ?? []).find(
        (j) => j.created_at.slice(0, 10) === todayISO() && (j.tags ?? []).includes('rant'),
      ) ?? null,
    [data],
  );

  // ---- Dictation ----
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

  // Auto-start the timer when the user first lands on this tab.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running]);

  useEffect(() => {
    if (secondsLeft === 0 && running) {
      setRunning(false);
    }
  }, [secondsLeft, running]);

  async function save() {
    if (!user) return;
    if (body.trim().length === 0) {
      setError('Write a few words first — even a sentence counts.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { upsertJournal } = await import('@/lib/db/api');
        const entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'> = {
          user_id: user.id,
          title: `5-min rant — ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`,
          body: body.trim(),
          mood,
          tags: ['rant', 'daily-rant'],
          photo_urls: [],
          voice_note_url: null,
          sentiment: null,
          source: 'web',
          external_id: null,
          external_meta: { kind: 'daily_rant', duration_seconds: RANT_DURATION_SECONDS - secondsLeft },
        };
        await upsertJournal(entry);
        await refresh();
        setSaved(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save');
      }
    });
  }

  if (todayRant && !saved) {
    return (
      <div className="paper-card p-lg flex flex-col gap-md">
        <div className="flex items-center gap-md">
          <div className="w-12 h-12 rounded-full bg-[#E5EDE2] border border-[#9CAF92] flex items-center justify-center">
            <InkIcon name="check-double" size={22} className="text-[#3A6470]" />
          </div>
          <div>
            <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878]">Daily Rant</p>
            <h3 className="text-[20px] text-[#2C2C2C]" style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}>
              Today’s rant is in.
            </h3>
          </div>
        </div>
        <p className="font-hand text-[18px] text-[#5C5850] italic">
          {todayRant.body.slice(0, 240)}{todayRant.body.length > 240 ? '…' : ''}
        </p>
        <div className="flex items-center gap-md text-[#5C5850] text-sm">
          <InkIcon name="fire" size={16} className="text-[#C5D8C0]" />
          <span>{streak}-day streak</span>
        </div>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            Back to questions
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="paper-card p-lg flex flex-col gap-md">
      <div className="flex items-start justify-between gap-md">
        <div>
          <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878]">Daily Rant</p>
          <h3 className="text-[24px] text-[#2C2C2C]" style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}>
            5 minutes. Whatever it is.
          </h3>
          <p className="font-hand text-[16px] text-[#5C5850] italic mt-1">
            Small or big, name it and let the page hold it. The streak is {streak} {streak === 1 ? 'day' : 'days'}.
          </p>
        </div>
        <div
          className={'flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 ' + (secondsLeft === 0 ? 'border-[#9CAF92] bg-[#E5EDE2]' : 'border-[#D0C5AA] bg-[#C5D8C0]')}
          aria-label={`${formatTime(secondsLeft)} remaining`}
        >
          <span
            className="text-[18px] text-[#2C2C2C] leading-none"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            {formatTime(secondsLeft)}
          </span>
          <span className="font-label-sm uppercase text-[#5C5850] text-[9px] mt-1">
            {secondsLeft === 0 ? 'done' : running ? 'running' : 'paused'}
          </span>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Start typing. Don't edit. Don't perform. Just let it out."
          rows={8}
          className="w-full bg-[#F5DEB3] border border-[#E0D5BA] rounded-xl px-md py-sm font-body-md text-[#2C2C2C] placeholder:text-[#8C8878]/60 resize-y min-h-[180px] focus:border-[#C5D8C0]"
          disabled={pending || saved}
          style={listening ? { borderColor: '#C5D8C0', boxShadow: '0 0 0 2px rgba(156, 175, 146, 0.2)' } : undefined}
        />
        {speechSupported && (
          <button
            type="button"
            onClick={toggleDictation}
            disabled={pending || saved}
            aria-label={listening ? 'Stop dictation' : 'Start voice dictation'}
            className={`absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              listening
                ? 'bg-[#9CAF92] text-[#FFFFFF] shadow-lg shadow-[#9CAF92]/30'
                : 'bg-[#E0D5BA] text-[#8C8878] hover:bg-[#D0C5AA] hover:text-[#5C5850]'
            }`}
          >
            <InkIcon
              name={listening ? 'mic-filled' : 'mic'}
              size={16}
              className={listening ? 'animate-pulse' : ''}
            />
          </button>
        )}
        {listening && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#9CAF92]/20 border border-[#C5D8C0]">
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
      </div>

      <div className="flex items-center justify-between gap-md">
        <div className="flex-1 min-w-0">
          <p className="font-label-sm uppercase tracking-wider text-[#8C8878]">Mood after</p>
          <Slider value={mood} onChange={setMood} min={1} max={10} step={1} />
          <p className="font-hand text-[15px] text-[#5C5850] mt-1">{mood}/10</p>
        </div>
        <div className="flex items-center gap-sm">
          {running ? (
            <Button variant="outline" size="sm" onClick={() => setRunning(false)}>
              Pause
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setRunning(true)} disabled={secondsLeft === 0}>
              {secondsLeft === 0 ? 'Done' : 'Resume'}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="font-label-sm text-[#D4786E]">{error}</p>}
      {saved && <p className="font-label-sm text-[#3A6470]">Saved. Taking you back to the dashboard…</p>}

      <div className="flex items-center justify-end gap-sm pt-md border-t border-[#E0D5BA]/50">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={save}
          loading={pending}
          leftIcon={<InkIcon name="edit" size={16} />}
          disabled={pending || saved || body.trim().length === 0}
        >
          Save rant
        </Button>
      </div>
    </div>
  );
}
