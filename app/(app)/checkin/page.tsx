'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorBanner, FullScreenLoader } from '@/components/ui/loading';
import { useTodaysCheckin } from '@/hooks/use-checkins';
import { useUser } from '@/hooks/use-user';
import { useProfile } from '@/hooks/use-profile';
import { todayISO } from '@/lib/utils';
import {
  CHECKIN_CATEGORIES,
  CHECKIN_QUESTIONS,
  type CheckinCategory,
  type CheckinQuestion,
  pickDailyQuestions,
} from '@/lib/checkin-questions';
import { InkIcon } from '@/components/ui/ink-icon';
import type { DailyCheckin } from '@/lib/types';
import { getOrCreateDailyCheckinPromptSet, upsertCheckinPromptSet } from '@/lib/db/api';
import { RantTab } from './rant-tab';

const QUESTIONS_PER_CHECKIN = 12;
const MIN_ANSWERED = QUESTIONS_PER_CHECKIN;
const MAX_ANSWER_LENGTH = 800;
const CHECKIN_STT_URL = '/api/transcribe';
const RANT_DURATION_SECONDS = 5 * 60;
const DIET_QUESTION_IDS = {
  breakfast: 'diet.breakfast',
  lunch: 'diet.lunch',
  dinner: 'diet.dinner',
  snacks: 'diet.snacks',
} as const;

function timeOfDayGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 5)  return 'Still up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late night';
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function wordCount(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export default function CheckinPage() {
  const { user } = useUser();
  const { profile } = useProfile();
  const { checkin, loading, refresh } = useTodaysCheckin();

  // The Safe Space has two segments: the structured daily questions, and the
  // 5-minute rant. Rant lives here so the user doesn't have to navigate
  // away from Safe Space to do it.
  const [segment, setSegment] = useState<'questions' | 'rant'>('questions');

  // ONE source of truth for the question list shown on screen. Initialized
  // once with a deterministic daily pick loaded from storage. Swaps update
  // this directly and are saved back to the same daily record.
  const [displayed, setDisplayed] = useState<CheckinQuestion[]>([]);
  const [promptSetId, setPromptSetId] = useState<string | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  // The swap pool is always derived from the current displayed set.
  const swapPool = displayed.length === 0
    ? CHECKIN_QUESTIONS
    : CHECKIN_QUESTIONS.filter((q) => !displayed.some((d) => d.id === q.id));

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [swapSlot, setSwapSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingQuestionId, setRecordingQuestionId] = useState<string | null>(null);
  const [transcribingQuestionId, setTranscribingQuestionId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [interpretation, setInterpretation] = useState<{
    text: string;
    scores: DailyCheckin['interpretation_meta'];
  } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Web Speech API recognition instance (Chrome / Edge / Safari).
  // Typed loosely because the spec types aren't in lib.dom on all TS configs.
  const recognitionRef = useRef<any>(null);

  // Hydrate answers + interpretation from today's saved check-in.
  useEffect(() => {
    if (checkin) {
      setAnswers(checkin.responses ?? {});
      if (checkin.interpretation && checkin.interpretation_meta?.generated_at) {
        setInterpretation({
          text: checkin.interpretation,
          scores: checkin.interpretation_meta,
        });
      } else {
        setInterpretation(null);
      }
    } else {
      setAnswers({});
      setInterpretation(null);
    }
  }, [checkin]);

  useEffect(() => {
    let cancelled = false;

    async function loadDailyQuestions() {
      if (!user) {
        setDisplayed([]);
        setPromptSetId(null);
        setQuestionsLoading(false);
        return;
      }

      setQuestionsLoading(true);
      try {
        const date = todayISO();
        const promptSet = await getOrCreateDailyCheckinPromptSet(user.id, date, QUESTIONS_PER_CHECKIN);
        const nextDisplayed = promptSet.question_ids
          .map((id) => CHECKIN_QUESTIONS.find((question) => question.id === id))
          .filter((question): question is CheckinQuestion => Boolean(question));

        if (!cancelled) {
          setDisplayed(
            nextDisplayed.length === QUESTIONS_PER_CHECKIN
              ? nextDisplayed
              : pickDailyQuestions(`${user.id}-${date}`, QUESTIONS_PER_CHECKIN),
          );
          setPromptSetId(promptSet.id);
        }
      } catch {
        if (!cancelled) {
          setDisplayed(pickDailyQuestions(`${user.id}-${todayISO()}`, QUESTIONS_PER_CHECKIN));
          setPromptSetId(null);
        }
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    }

    void loadDailyQuestions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || displayed.length !== QUESTIONS_PER_CHECKIN) return;
    void upsertCheckinPromptSet({
      id: promptSetId ?? undefined,
      user_id: user.id,
      date: todayISO(),
      question_ids: displayed.map((question) => question.id),
    }).then((saved) => {
      if (saved.id !== promptSetId) setPromptSetId(saved.id);
    }).catch(() => {
      // Keep the UI usable even if persistence is temporarily unavailable.
    });
  }, [displayed, promptSetId, user]);

  // Stop any active dictation when the page unmounts so the browser
  // doesn't keep the microphone / recognition session running in the
  // background after the user navigates away.
  useEffect(() => {
    return () => {
      stopRecognition();
      stopAudioCapture();
    };
  }, []);

  if (loading || questionsLoading) return <FullScreenLoader />;

  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length;
  const canSubmit = answeredCount >= MIN_ANSWERED && !pending;

  function setAnswer(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value.slice(0, MAX_ANSWER_LENGTH) }));
  }

  function appendAnswer(qid: string, transcript: string) {
    setAnswers((prev) => {
      const existing = prev[qid]?.trim() ?? '';
      const merged = existing ? `${existing} ${transcript.trim()}` : transcript.trim();
      return { ...prev, [qid]: merged.slice(0, MAX_ANSWER_LENGTH) };
    });
  }

  function stopAudioCapture() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopRecognition() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore — recognition may already have stopped
    }
    recognitionRef.current = null;
  }

  async function toggleDictation(qid: string) {
    if (recordingQuestionId === qid) {
      stopRecognition();
      stopAudioCapture();
      return;
    }
    if (recordingQuestionId || transcribingQuestionId) return;
    setError(null);

    // ---- Path 1: Web Speech API (Chrome, Edge, Safari) ----
    // Real-time, no server roundtrip, no API key. This is the path that
    // "just works" in the user's browser. We append each finalised
    // transcript chunk to the answer so partial results don't clobber
    // what the user has already typed.
    const SR: any =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = navigator.language || 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0]?.transcript ?? '';
          }
        }
        const cleaned = finalTranscript.trim();
        if (cleaned) appendAnswer(qid, cleaned);
      };
      recognition.onerror = (event: any) => {
        const code = event?.error ?? 'unknown';
        // 'no-speech' and 'aborted' are normal end-of-utterance signals;
        // don't surface them as errors to the user.
        if (code !== 'no-speech' && code !== 'aborted') {
          setError(`Dictation: ${code}`);
        }
        // Clear the ref defensively: onend doesn't always fire promptly
        // after a non-fatal error on every browser, so we don't want a
        // stale instance blocking a new toggleDictation call.
        recognitionRef.current = null;
        // Mirror the onend reset so the UI can't get stuck showing the
        // question as still recording if onend never fires after the error.
        setRecordingQuestionId((current) => (current === qid ? null : current));
      };
      recognition.onend = () => {
        setRecordingQuestionId((current) => (current === qid ? null : current));
        recognitionRef.current = null;
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        setRecordingQuestionId(qid);
        return;
      } catch {
        // If start() throws (e.g. mic blocked), fall through to the
        // MediaRecorder path below.
        recognitionRef.current = null;
      }
    }

    // ---- Path 2: MediaRecorder + server STT fallback ----
    // Used by browsers that don't expose Web Speech API (e.g. Firefox).
    // Sends the recording to /api/transcribe, which forwards to whatever
    // NVIDIA NIM endpoint the operator has configured.
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Your browser does not support microphone dictation.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      chunksRef.current = chunks;
      streamRef.current = stream;
      recorderRef.current = recorder;
      setRecordingQuestionId(qid);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        setRecordingQuestionId(null);
        setTranscribingQuestionId(qid);
        stopAudioCapture();

        try {
          const formData = new FormData();
          formData.append('audio', audio, `checkin-${qid}.webm`);
          formData.append('question_id', qid);
          const response = await fetch(CHECKIN_STT_URL, { method: 'POST', body: formData });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(payload?.error ?? 'Dictation failed');
          }
          const transcript = String(payload?.text ?? '').trim();
          if (transcript) appendAnswer(qid, transcript);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Dictation failed');
        } finally {
          setTranscribingQuestionId(null);
        }
      };

      recorder.start();
    } catch (err) {
      setRecordingQuestionId(null);
      stopAudioCapture();
      setError(err instanceof Error ? err.message : 'Could not start dictation');
    }
  }

  function applySwap(slot: number, newQuestion: CheckinQuestion) {
    setDisplayed((prev) => {
      const replaced = prev[slot];
      if (!replaced || replaced.id === newQuestion.id) return prev;
      const next = [...prev];
      next[slot] = newQuestion;
      // Drop the answer for the swapped-out question so the count stays honest.
      setAnswers((aPrev) => {
        const aNext = { ...aPrev };
        delete aNext[replaced.id];
        return aNext;
      });
      return next;
    });
    setSwapSlot(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const trimmed: Record<string, string> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (v.trim().length > 0) trimmed[k] = v.trim();
    }
    if (Object.keys(trimmed).length < MIN_ANSWERED) {
      setError(`Please answer at least ${MIN_ANSWERED} questions.`);
      return;
    }
    // Extract numeric answers so the LLM doesn't have to infer them.
    // Only pass the fields we have — undefined fields fall through to
    // the LLM interpreter via `??` in submitCheckin.
    const sleepAnswer = parseFloat(trimmed['body.sleep_hours'] ?? '');
    const outdoorAnswer = parseFloat(trimmed['body.outdoor_minutes'] ?? '');
    const legacy = (Number.isFinite(sleepAnswer) || Number.isFinite(outdoorAnswer))
      ? {
          sleep_hours: Number.isFinite(sleepAnswer) ? sleepAnswer : undefined,
          outdoor_minutes: Number.isFinite(outdoorAnswer) ? outdoorAnswer : undefined,
        }
      : undefined;
    startTransition(async () => {
      try {
        const { submitCheckin } = await import('@/lib/db/api');
        const saved = await submitCheckin({
          id: checkin?.id,
          user_id: user.id,
          date: todayISO(),
          responses: trimmed,
          userName: profile?.name ?? user.email ?? '',
          legacy,
        });
        if (saved.interpretation) {
          setInterpretation({ text: saved.interpretation, scores: saved.interpretation_meta });
        }
        await refresh();
        setTimeout(() => {
          document.getElementById('checkin-reflection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save');
      }
    });
  }

  return (
    <div className="space-y-xl pt-md pb-24">
      {/* HERO ============================================================= */}
      <header className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low paper-texture px-lg py-xl">
        <div className="relative z-10 flex items-start justify-between gap-md">
          <div>
            <p className="font-label-md uppercase tracking-[0.3em] text-on-surface-variant">
              {formatLongDate(new Date())}
            </p>
            <h1 className="mt-xs font-logo text-[44px] leading-none tracking-[0.04em] text-primary">
              {timeOfDayGreeting(new Date())}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}.
            </h1>
            <p className="mt-sm font-body-md text-secondary max-w-md">
              Twelve short questions. Answer what lands, skip what doesn&apos;t, and add the reason behind each answer. Your reflection will appear at the end.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2 text-[20px] text-[#2C2C2C]">
              <InkIcon name="feather" size={22} className="text-[#C5D8C0]" />
              {answeredCount}/{displayed.length}
            </div>
            <span className="font-label-sm uppercase tracking-wider text-[#5C5850]">answered</span>
          </div>
        </div>
        {/* SEGMENT TOGGLE — Questions vs Daily Rant */}
        <div className="relative z-10 mt-md flex gap-1 p-1 rounded-full border border-[#D0C5AA] bg-[#F5DEB3]/80 w-fit">
          {(['questions', 'rant'] as const).map((s) => {
            const active = segment === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSegment(s)}
                className={'px-md py-xs rounded-full text-sm font-label-md transition-colors ' + (active ? 'bg-[#2C2C2C] text-[#F5DEB3]' : 'text-[#5C5850] hover:text-[#2C2C2C]')}
              >
                {s === 'questions' ? 'Questions' : '5-min Rant'}
              </button>
            );
          })}
        </div>
      </header>

      {error && <ErrorBanner message={error} />}

      {/* DIET LOGGING — quick breakfast/lunch/dinner/snacks capture ====== */}
      <DietSection
        values={answers}
        onChange={setAnswer}
        disabled={pending}
      />

      {segment === 'rant' ? (
        <RantTab onClose={() => setSegment('questions')} />
      ) : (
      <form onSubmit={onSubmit} className="space-y-md">
        {displayed.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i + 1}
            total={displayed.length}
            question={q}
            value={answers[q.id] ?? ''}
            onChange={(v) => setAnswer(q.id, v)}
            onSwap={() => setSwapSlot(i)}
            onDictate={() => toggleDictation(q.id)}
            recording={recordingQuestionId === q.id}
            transcribing={transcribingQuestionId === q.id}
            disabled={pending}
          />
        ))}

        <div className="sticky bottom-24 z-20 pt-md">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low paper-texture shadow-paper p-md">
            <div className="relative z-10 flex items-center gap-md">
              <div className="flex-1 min-w-0">
                <p className="font-label-md text-on-surface-variant uppercase tracking-wider">
                  Ready when you are
                </p>
                <p className="font-body-sm text-secondary truncate">
                  {answeredCount < MIN_ANSWERED
                    ? `Answer ${MIN_ANSWERED - answeredCount} more to unlock your reflection.`
                    : `${answeredCount} answered. Your reflection will appear below.`}
                </p>
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={pending}
                disabled={!canSubmit}
                rightIcon={<InkIcon name="sparkle" size={20} />}
              >
                {pending ? 'Reading\u2026' : checkin ? 'Update reflection' : 'Get your reflection'}
              </Button>
            </div>
          </div>
        </div>
      </form>
      )}

      {/* INTERPRETATION =================================================== */}
      {(interpretation || pending) && (
        <section id="checkin-reflection" className="scroll-mt-lg">
          <ReflectionCard
            pending={pending}
            interpretation={interpretation?.text ?? ''}
            scores={interpretation?.scores ?? null}
            name={profile?.name ?? user?.email ?? ''}
          />
        </section>
      )}

      {/* SWAP DRAWER ====================================================== */}
      {swapSlot !== null && (
        <SwapDrawer
          pool={swapPool}
          current={displayed[swapSlot]}
          onPick={(q) => applySwap(swapSlot, q)}
          onClose={() => setSwapSlot(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Diet section — quick breakfast/lunch/dinner/snacks capture         */
/* ------------------------------------------------------------------ */

function DietSection({
  values,
  onChange,
  disabled,
}: {
  values: Record<string, string>;
  onChange: (qid: string, v: string) => void;
  disabled: boolean;
}) {
  const meals: { id: string; label: string; placeholder: string }[] = [
    { id: DIET_QUESTION_IDS.breakfast, label: 'Breakfast', placeholder: 'eggs, toast, a banana…' },
    { id: DIET_QUESTION_IDS.lunch,     label: 'Lunch',     placeholder: 'grain bowl, salad, soup…' },
    { id: DIET_QUESTION_IDS.dinner,    label: 'Dinner',    placeholder: 'pasta, stir-fry, leftovers…' },
    { id: DIET_QUESTION_IDS.snacks,    label: 'Snacks',    placeholder: 'anything between meals…' },
  ];
  return (
    <article className="paper-card p-lg">
      <div className="flex items-start justify-between gap-md mb-md">
        <div>
          <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878]">Today on the table</p>
          <h3
            className="text-[22px] leading-tight text-[#2C2C2C] mt-1"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            What did you eat?
          </h3>
          <p className="font-hand text-[15px] text-[#5C5850] italic mt-1">
            A few words per meal is enough. Your reflection and mood will read it back.
          </p>
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#C5D8C0] border border-[#D0C5AA]"
          aria-hidden
        >
          <InkIcon name="utensils" size={20} className="text-[#2C2C2C]" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        {meals.map((m) => (
          <label key={m.id} className="flex flex-col gap-xs">
            <span className="font-label-sm uppercase tracking-wider text-[#5C5850] text-[11px]">
              {m.label}
            </span>
            <input
              type="text"
              value={values[m.id] ?? ''}
              onChange={(e) => onChange(m.id, e.target.value)}
              placeholder={m.placeholder}
              disabled={disabled}
              className="bg-[#F5DEB3] border border-[#E0D5BA] rounded-lg px-sm py-xs font-body-md text-[#2C2C2C] placeholder:text-[#8C8878]/60 focus:border-[#C5D8C0] focus:outline-none"
            />
          </label>
        ))}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Question card                                                     */
/* ------------------------------------------------------------------ */

function QuestionCard({
  index, total, question, value, onChange, onSwap, onDictate, recording, transcribing, disabled,
}: {
  index: number;
  total: number;
  question: CheckinQuestion;
  value: string;
  onChange: (v: string) => void;
  onSwap: () => void;
  onDictate: () => void;
  recording: boolean;
  transcribing: boolean;
  disabled: boolean;
}) {
  const cat = CHECKIN_CATEGORIES[question.category];
  const wc = wordCount(value);
  const isNumber = question.type === 'number';
  return (
    <article
      className="relative rounded-2xl border border-outline-variant bg-surface-container-low paper-texture shadow-paper overflow-hidden"
    >
      <div className="relative z-10 p-lg">
        <div className="flex items-start justify-between gap-md">
          <div className="flex items-center gap-md min-w-0">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full shrink-0"
              style={{ backgroundColor: cat.tint }}
              aria-hidden
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: cat.ink }}>
                {question.icon}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-label-sm uppercase tracking-[0.2em]" style={{ color: cat.ink }}>
                {cat.label} · {index}/{total}
              </p>
              <h2 className="font-h3 text-h3 text-primary mt-1 leading-snug">
                {question.text}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onSwap}
            disabled={disabled}
            className="shrink-0 inline-flex items-center gap-1 px-sm py-1 rounded-full border border-[#D0C5AA] font-label-sm uppercase tracking-wider text-[#5C5850] hover:bg-[#C5D8C0] transition-colors"
            aria-label="Swap this question"
          >
            <InkIcon name="swap" size={14} />
            Swap
          </button>
        </div>

        <div className="mt-md">
          {isNumber ? (
            <div className="flex items-center gap-sm">
              <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={question.placeholder}
                min={question.min ?? 0}
                max={question.max ?? undefined}
                step="any"
                disabled={disabled}
                className="w-32 bg-surface-bright border border-outline-variant rounded-xl px-md py-sm font-body-md text-primary placeholder:text-on-surface-variant/60 focus:border-primary text-center"
              />
              {question.unit && (
                <span className="font-body-md text-[#5C5850]">{question.unit}</span>
              )}
            </div>
          ) : (
            <>
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={question.placeholder}
                rows={3}
                disabled={disabled}
                className="w-full bg-surface-bright border border-outline-variant rounded-xl px-md py-sm font-body-md text-primary placeholder:text-on-surface-variant/60 resize-y min-h-[88px] focus:border-primary"
              />
              <div className="mt-sm flex flex-wrap items-center justify-between gap-xs font-label-sm text-on-surface-variant">
                <span>Answer in 2-3 sentences and include why it landed that way.</span>
                <div className="flex items-center gap-sm">
                  <Button
                    type="button"
                    variant={recording ? 'danger' : 'outline'}
                    size="sm"
                    onClick={onDictate}
                    loading={transcribing}
                    leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>{recording ? 'stop_circle' : 'mic'}</span>}
                    disabled={disabled}
                  >
                    {recording ? 'Stop' : transcribing ? 'Transcribing' : 'Dictate'}
                  </Button>
                  <span>{value.length}/{MAX_ANSWER_LENGTH}</span>
                  <span>{wc} {wc === 1 ? 'word' : 'words'}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Reflection card                                                   */
/* ------------------------------------------------------------------ */

function ReflectionCard({
  pending, interpretation, scores, name,
}: {
  pending: boolean;
  interpretation: string;
  scores: DailyCheckin['interpretation_meta'] | null;
  name: string;
}) {
  const firstName = (name || '').split(' ')[0] || name;
  return (
    <div
      className="relative rounded-2xl border border-outline-variant paper-texture shadow-paper overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F5DEB3 100%)' }}
    >
      <div className="relative z-10 p-lg space-y-md">          <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-full"
            style={{ backgroundColor: '#2C2C2C' }}
          >
            {pending ? (
              <InkIcon name="sparkle" size={22} className="text-[#F5DEB3] animate-spin" />
            ) : (
              <InkIcon name="sparkle" size={22} className="text-[#F5DEB3]" />
            )}
          </div>
          <div>
            <p className="font-label-md uppercase tracking-[0.2em] text-on-surface-variant">
              Your reflection
            </p>
            <h2 className="font-h2 text-h2 text-primary leading-tight">
              {pending
                ? `Reading your answers, ${firstName}\u2026`
                : `What today sounded like, in one read`}
            </h2>
          </div>
        </div>

        <p
          className="font-body-lg text-primary leading-relaxed"
          style={{ minHeight: pending ? 60 : undefined, opacity: pending ? 0.4 : 1 }}
        >
          {pending ? '\u00a0' : interpretation}
        </p>

        {scores && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-sm pt-sm border-t border-outline-variant">
            <ScoreChip label="Mood"        score={scores.mood}       icon="favorite" />
            <ScoreChip label="Energy"      score={scores.energy}     icon="bolt" />
            <ScoreChip label="Stress"      score={scores.stress}     icon="whatshot" reverse />
            <ScoreChip label="Connection"  score={scores.connection} icon="diversity_3" />
            <ScoreChip label="Rest"        score={scores.rest}       icon="bedtime" />
            <ScoreChip label="Purpose"     score={scores.purpose}    icon="flag" />
          </div>
        )}

        {scores?.themes && scores.themes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-xs">
            {scores.themes.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-outline-variant bg-surface-bright font-label-sm text-primary"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>tag</span>
                {t}
              </span>
            ))}
          </div>
        )}

        <p className="font-label-sm text-on-surface-variant pt-xs italic">
          This reflection is generated by an LLM reading your words. It is not clinical advice. Trust yourself first.
        </p>
      </div>
    </div>
  );
}

function ScoreChip({
  label, score, icon, reverse,
}: { label: string; score: number; icon: string; reverse?: boolean }) {
  const pct = Math.max(0, Math.min(10, score)) * 10;
  const positive = reverse ? score <= 5 : score >= 6;
  const color = positive ? '#3A6470' : '#D4786E';
  const tint  = positive ? '#E5EDE2' : '#F5E8E5';
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl border"
      style={{ backgroundColor: tint, borderColor: tint }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18, color }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-label-sm uppercase tracking-wider" style={{ color }}>{label}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <span className="font-metric text-sm" style={{ color }}>{score}/10</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Swap drawer                                                       */
/* ------------------------------------------------------------------ */

function SwapDrawer({
  pool, current, onPick, onClose,
}: {
  pool: CheckinQuestion[];
  current: CheckinQuestion;
  onPick: (q: CheckinQuestion) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<CheckinCategory | 'all'>('all');
  const visible = filter === 'all' ? pool : pool.filter((q) => q.category === filter);
  const categories: ('all' | CheckinCategory)[] = ['all', 'emotion', 'energy', 'connection', 'work', 'mind', 'body', 'tomorrow'];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div className="absolute inset-0 bg-[#2C2C2C]/40" />
      <div
        className="relative w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-outline-variant bg-surface-container-low paper-texture shadow-paper overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative z-10 p-lg border-b border-outline-variant">
          <div className="flex items-start justify-between gap-md">
            <div>
              <p className="font-label-sm uppercase tracking-[0.2em] text-on-surface-variant">Swap question</p>
              <h3 className="font-h2 text-h2 text-primary mt-1 leading-snug">
                Replace <em className="italic">&ldquo;{current.text}&rdquo;</em>?
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#D0C5AA] text-[#2C2C2C]"
              aria-label="Close"
            >
              <InkIcon name="close" size={18} />
            </button>
          </div>
          <div className="flex gap-1.5 mt-md overflow-x-auto no-scrollbar">
            {categories.map((c) => {
              const cat = c === 'all' ? null : CHECKIN_CATEGORIES[c];
              const active = filter === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-label-sm uppercase tracking-wider border transition-colors"
                  style={{
                    backgroundColor: active ? '#2C2C2C' : 'transparent',
                    color: active ? '#F5DEB3' : (cat?.ink ?? '#5C5850'),
                    borderColor: active ? '#2C2C2C' : '#D0C5AA',
                  }}
                >
                  {cat && (
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{cat.icon}</span>
                  )}
                  {cat?.label ?? 'All'}
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative z-10 flex-1 overflow-y-auto p-md space-y-sm custom-scrollbar">
          {visible.length === 0 ? (
            <p className="font-body-md text-on-surface-variant text-center py-lg">
              No more questions in that category.
            </p>
          ) : (
            visible.map((q) => {
              const cat = CHECKIN_CATEGORIES[q.category];
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onPick(q)}
                  className="w-full text-left p-md rounded-xl border border-outline-variant bg-surface-bright hover:bg-[#FFFFFF] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full"
                      style={{ backgroundColor: cat.tint }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: cat.ink }}>{q.icon}</span>
                    </span>
                    <p className="font-label-sm uppercase tracking-wider" style={{ color: cat.ink }}>
                      {cat.label}
                    </p>
                  </div>
                  <p className="mt-xs font-body-md text-primary leading-snug">{q.text}</p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
