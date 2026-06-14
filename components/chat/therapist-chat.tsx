'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InkIcon } from '@/components/ui/ink-icon';
import { useJournal } from '@/hooks/use-journal';
import { useProfile } from '@/hooks/use-profile';
import { useCheckins } from '@/hooks/use-checkins';
import { daysAgoISO } from '@/lib/utils';
import type { TherapistMessage } from '@/lib/ai/blackbox';

const STORAGE_KEY = 'j0rn@l.chat.history';
const MAX_HISTORY = 40;

/* ------------------------------------------------------------------ */
/*  Speech Recognition helpers                                        */
/* ------------------------------------------------------------------ */

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionAlternative = {
  transcript: string;
  confidence: number;
};

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition | undefined;
    webkitSpeechRecognition: new () => SpeechRecognition | undefined;
  }
}

function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  if (!rec) return null;
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = 'en-US';
  return rec;
}

function loadHistory(): TherapistMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(msgs: TherapistMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = msgs.slice(-MAX_HISTORY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function TherapistChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TherapistMessage[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPowered, setAiPowered] = useState(true);
  const [listening, setListening] = useState(false);
  const [speechSupported] = useState(() => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const { profile } = useProfile();
  const { data: checkins } = useCheckins(daysAgoISO(31));
  const { data: journals } = useJournal();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dictationBaseRef = useRef(''); // stable text: manual input + finalized transcripts

  const chatContext = useMemo(() => ({
    profile: profile ? {
      id: profile.id,
      name: profile.name,
      sleep_goal_hours: profile.sleep_goal_hours,
    } : null,
    checkins,
    journals,
  }), [profile, checkins, journals]);

  // Days since last chat message (for FAB notification badge)
  const daysSinceLastChat = useMemo(() => {
    if (messages.length === 0) return Number.MAX_SAFE_INTEGER; // never chatted — irrelevant for stale badge but self-documenting
    const timestamps = messages.map((m) => new Date(m.timestamp).getTime());
    const latest = Math.max(...timestamps);
    return (Date.now() - latest) / (1000 * 60 * 60 * 24);
  }, [messages]);

  const showStaleBadge = !open && messages.length > 0 && daysSinceLastChat >= 2;

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Focus input when chat opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  // Stop recording when chat panel closes
  useEffect(() => {
    if (!open && listening) {
      recognitionRef.current?.abort();
      setListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    }
  }, [open, listening]);

  /* ---- Voice dictation ---- */
  const startListening = useCallback(() => {
    const rec = createSpeechRecognition();
    if (!rec) return;

    // Clear any pending silence timer from a previous session
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    recognitionRef.current = rec;
    dictationBaseRef.current = input; // snapshot current manual input as base

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }

      // Finalized transcripts append to the stable base
      if (final) {
        dictationBaseRef.current += final + ' ';
        setInput(dictationBaseRef.current);
      }
      // Interim text is the complete transcript so far — replace, don't append
      if (interim) {
        setInput(dictationBaseRef.current + interim);
      }

      // Auto-stop after 2.5s of silence (no new results)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        setListening(false);
        rec.stop();
        inputRef.current?.focus();
      }, 2500);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are normal — don't show as errors
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError('Microphone didn\u2019t pick that up. Try again.');
      }
      setListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    rec.onend = () => {
      setListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    try {
      setListening(true);
      setError(null);
      rec.start();
    } catch {
      setListening(false);
      setError('Could not access the microphone.');
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    setListening(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    inputRef.current?.focus();
  }, []);

  const toggleMic = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setError(null);

    const userMsg: TherapistMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: next.slice(-20), context: chatContext }),
      });
      if (!res.ok) throw new Error('Failed to get reply');
      const json = await res.json();
      if (typeof json.reply === 'string') {
        const reply: TherapistMessage = {
          role: 'therapist',
          content: json.reply,
          timestamp: new Date().toISOString(),
        };
        const final = [...next, reply];
        setMessages(final);
        saveHistory(final);
        setAiPowered(Boolean(json.ai_powered));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach therapist');
      // Remove the user message on error so they can retry
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, chatContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    saveHistory([]);
    setError(null);
  };

  return (
    <>
      {/* FAB Button — bottom-right, always visible */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close therapist chat' : 'Open therapist chat'}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-[#D4937A] text-[#2C2C2C] shadow-lg hover:bg-[#C9826A] active:scale-95 transition-all flex items-center justify-center group"
      >
        <InkIcon
          name={open ? 'close' : 'heart'}
          size={22}
          className="text-[#2C2C2C] group-hover:scale-110 transition-transform"
        />
        {!open && messages.length === 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D4937A] border-2 border-[#F5DEB3] animate-pulse" />
        )}

        {/* Stale chat badge — hasn't chatted in 2+ days */}
        {showStaleBadge && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#D4B872] border-2 border-[#F5DEB3] flex items-center justify-center"
            title={`It's been ${Math.floor(daysSinceLastChat)}d since your last chat — your companion is here`}
          >
            <InkIcon name="clock" size={10} className="text-[#2C2C2C]" />
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-36 md:bottom-24 right-2 md:right-4 z-40 w-[calc(100vw-1rem)] max-w-[380px] h-[520px] max-h-[calc(100vh-12rem)] bg-[#FBF2E0] border border-[#E0D5BA] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ boxShadow: '0 8px 40px rgba(44, 44, 44, 0.18)' }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-lg py-md border-b border-[#E0D5BA] bg-[#EDDFC0]">
            <div className="flex items-center gap-sm">
              <div className="w-9 h-9 rounded-full bg-[#2C2C2C] flex items-center justify-center">
                <InkIcon name="heart" size={16} className="text-[#F5DEB3]" />
              </div>
              <div>
                <p
                  className="text-[16px] leading-none text-[#2C2C2C]"
                  style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
                >
                  Your Companion
                </p>
                <p className="font-hand text-[13px] text-[#8C8878] italic">
                  {sending ? 'Typing…' : aiPowered ? 'AI-powered · listening' : 'Local mode · still here'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#8C8878] hover:text-[#D4786E] hover:bg-[#F5E8E5] transition-colors"
                  aria-label="Clear chat"
                  title="Clear chat history"
                >
                  <InkIcon name="trash" size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#8C8878] hover:text-[#5C5850] hover:bg-[#E0D5BA] transition-colors"
                aria-label="Close chat"
              >
                <InkIcon name="close" size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-md py-md space-y-md">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-md px-md">
                <div className="w-16 h-16 rounded-full bg-[#D8E8D0] flex items-center justify-center border border-[#E0D5BA]">
                  <InkIcon name="heart" size={28} className="text-[#9CAF92]" />
                </div>
                <p className="font-body-md text-[#5C5850] leading-relaxed">
                  Hi. I&apos;ve read your check-ins and journal — I can see the shape of your days.
                </p>
                <p className="font-hand text-[15px] text-[#8C8878] italic">
                  How are you, really? No small talk required.
                </p>
              </div>
            )}

            {messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-md py-sm rounded-2xl text-[15px] leading-relaxed ${
                      isUser
                        ? 'bg-[#2C2C2C] text-[#F5DEB3] rounded-br-md'
                        : 'bg-[#D8E8D0] text-[#2C2C2C] rounded-bl-md border border-[#E0D5BA]'
                    }`}
                  >
                    {m.content}
                    <p className={`text-[10px] mt-1 ${isUser ? 'text-[#F5DEB3]/50' : 'text-[#8C8878]'}`}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-md py-sm rounded-2xl bg-[#D8E8D0] text-[#2C2C2C] rounded-bl-md border border-[#E0D5BA]">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8C8878] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8C8878] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8C8878] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <p className="text-[12px] text-[#D4786E] bg-[#F5E8E5] px-md py-xs rounded-full">{error}</p>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 p-md border-t border-[#E0D5BA] bg-[#EDDFC0]">
            <div className="flex items-end gap-sm">
              {/* Mic button — only if speech is supported */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={sending}
                  aria-label={listening ? 'Stop recording' : 'Start voice dictation'}
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 ${
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

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listening ? 'Listening… speak now' : 'Write what\u2019s on your mind…'}
                rows={1}
                disabled={sending}
                className={`flex-1 resize-none bg-[#F0E6CC] border rounded-xl px-md py-sm font-body-md text-[#2C2C2C] placeholder:text-[#8C8878]/60 focus:border-[#C5D8C0] focus:outline-none max-h-32 transition-colors ${
                  listening ? 'border-[#C5D8C0] ring-2 ring-[#C5D8C0]/20' : 'border-[#E0D5BA]'
                }`}
                style={{ minHeight: 40 }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="shrink-0 w-10 h-10 rounded-full bg-[#2C2C2C] text-[#F5DEB3] flex items-center justify-center disabled:opacity-30 hover:bg-[#9CAF92] active:scale-95 transition-all"
                aria-label="Send message"
              >
                <InkIcon name="arrow-right" size={18} className="text-[#FFFFFF]" />
              </button>
            </div>

            {/* Listening indicator bar */}
            {listening && (
              <div className="flex items-center gap-xs mt-sm px-1">
                <span className="flex gap-[2px]">
                  {[10, 17, 11, 14].map((h, i) => (
                    <span
                      key={i}
                      className="w-[3px] rounded-full bg-[#9CAF92] animate-pulse"
                      style={{
                        height: `${h}px`,
                        animationDelay: `${i * 120}ms`,
                        animationDuration: '0.6s',
                      }}
                    />
                  ))}
                </span>
                <span className="font-hand text-[12px] text-[#9CAF92] italic">
                  {input ? 'Capturing your words…' : 'Speak now — I\u2019m listening'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
