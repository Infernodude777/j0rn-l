import type { DailyCheckin, JournalEntry, PatternSnapshot, WeeklyInsight } from '@/lib/types';
import { CHECKIN_CATEGORIES, CHECKIN_QUESTIONS, getQuestion } from '@/lib/checkin-questions';

const API_URL = process.env.BLACKBOX_API_URL ?? 'https://api.blackbox.ai';
const MODEL = process.env.BLACKBOX_MODEL ?? 'blackboxai/minimax/minimax-free';

let blackboxAvailability: Promise<boolean> | null = null;
let blackboxAvailabilityTs = 0;
const BLACKBOX_AVAILABILITY_TTL_MS = 5 * 60_000; // retry every 5 min

/** Internal helper: creates an AbortController that fires after `ms`. */
function createTimeout(ms: number): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

/** Shared fetch options for every Blackbox API call. */
const API_TIMEOUT_MS = 60_000; // 60s — enough for a thoughtful therapist reply

function blackboxFetch(path: string, body: unknown, timeoutMs: number = API_TIMEOUT_MS): Promise<Response> {
  const key = process.env.BLACKBOX_API_KEY ?? '';
  const { controller, clear } = createTimeout(timeoutMs);
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(clear);
}

export async function hasWorkingBlackboxKey(): Promise<boolean> {
  const expired = Date.now() - blackboxAvailabilityTs > BLACKBOX_AVAILABILITY_TTL_MS;
  if (!blackboxAvailability || expired) {
    blackboxAvailabilityTs = Date.now();
    blackboxAvailability = (async () => {
      try {
        const res = await blackboxFetch(
          '/chat/completions',
          {
            model: MODEL,
            messages: [{ role: 'user', content: 'ping' }],
            temperature: 0,
            max_tokens: 1,
          },
          15_000,
        );
        return res.ok;
      } catch {
        return false;
      }
    })();
  }
  return blackboxAvailability;
}

const SYSTEM_PROMPT = `You are a supportive wellness reflection assistant for an app called J0rn@l. You are NOT a therapist and MUST NOT diagnose. You help a user notice patterns in their own self-reported data so they can decide what to do next.

Style rules:
- Use second person, warm and plain language. No clinical jargon.
- Never claim certainty. Use phrases like "it looks like", "one pattern that shows up", "this week suggests".
- Never diagnose. Never name a disorder. Never recommend medication.
- If data is sparse, say so and encourage a few more check-ins.
- Keep each section short (1-3 sentences) and grounded in the data provided.
- Output MUST be valid JSON matching the requested schema. No markdown, no commentary.`;

export interface InsightContext {
  profile: { name: string; sleep_goal_hours: number | null };
  recentCheckins: DailyCheckin[];
  recentJournals: JournalEntry[];
  trendSnapshots: PatternSnapshot;
}

export async function generateWeeklyInsight(ctx: InsightContext): Promise<WeeklyInsight> {
  const prompt = buildPrompt(ctx);

  try {
    const res = await blackboxFetch('/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });
    if (!res.ok) throw new Error(`Blackbox API ${res.status}`);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      const parsed = safeParse(content);
      if (parsed) return toInsight(parsed, ctx);
    }
  } catch {
    // fall through to local generator
  }

  return localInsight(ctx);
}

function buildPrompt(ctx: InsightContext): string {
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const summary = {
    checkin_count: ctx.recentCheckins.length,
    averages: {
      sleep_hours: mean(ctx.recentCheckins.map((c) => c.sleep_hours)),
      stress: mean(ctx.recentCheckins.map((c) => c.stress)),
      mood: mean(ctx.recentCheckins.map((c) => c.mood)),
      energy: mean(ctx.recentCheckins.map((c) => c.energy)),
      focus: mean(ctx.recentCheckins.map((c) => c.focus)),
      outdoor_minutes: mean(ctx.recentCheckins.map((c) => c.outdoor_minutes)),
      social_connection: mean(ctx.recentCheckins.map((c) => c.social_connection)),
      work_pressure: mean(ctx.recentCheckins.map((c) => c.work_pressure)),
    },
    patterns: ctx.trendSnapshots,
    journal_excerpts: ctx.recentJournals.slice(0, 7).map((j) => ({
      date: j.created_at.slice(0, 10),
      title: j.title,
      excerpt: j.body.slice(0, 200),
    })),
  };

  return `Generate a JSON object for ${ctx.profile.name}'s weekly reflection. User's sleep goal is ${ctx.profile.sleep_goal_hours ?? 'unknown'} hours.

Return JSON with these keys:
{
  "summary": string,                      // 1 short paragraph
  "patterns": string[],                   // 2-3 short observations
  "contributing_factors": string[],       // 2-3 short possible drivers
  "reflection_questions": string[],       // 2-3 open questions
  "suggestions": string[]                 // 2-3 gentle, optional suggestions
}

Data:
${JSON.stringify(summary, null, 2)}`;
}

function localInsight(ctx: InsightContext): WeeklyInsight {
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const a = {
    sleep: mean(ctx.recentCheckins.map((c) => c.sleep_hours)),
    stress: mean(ctx.recentCheckins.map((c) => c.stress)),
    mood: mean(ctx.recentCheckins.map((c) => c.mood)),
    social: mean(ctx.recentCheckins.map((c) => c.social_connection)),
    outdoor: mean(ctx.recentCheckins.map((c) => c.outdoor_minutes)),
  };

  const patterns: string[] = [];
  if (a.sleep < 6.5) patterns.push('Sleep has been below your usual range for several days.');
  if (a.stress > 6) patterns.push('Stress has been running higher than the first half of the period.');
  if (a.outdoor > 40) patterns.push('Outdoor time has been a consistent part of your week.');
  if (a.social > 6) patterns.push('You are reporting more social connection than usual.');
  if (patterns.length === 0) patterns.push('Your week looks steady across the dimensions you tracked.');

  const factors: string[] = [];
  if (a.sleep < 6.5) factors.push('Late-night screen time or inconsistent bedtime');
  if (a.stress > 6) factors.push('A few high-pressure work or school days');
  if (a.outdoor > 40) factors.push('Time outside seems to track with lower stress');
  if (factors.length === 0) factors.push('Daily rhythm looks consistent with prior weeks');

  const questions = [
    'What was one moment this week that felt lighter?',
    'Is there a small habit you could protect for next week?',
  ];

  const suggestions: string[] = [];
  if (a.outdoor < 30) suggestions.push('A 20-minute walk after lunch');
  if (a.sleep < 6.5) suggestions.push('A consistent lights-out time, even on weekends');
  if (a.stress > 6) suggestions.push('A short breathing break between meetings');
  if (suggestions.length === 0) suggestions.push('Keep doing what you are doing — it is working.');

  return {
    id: '',
    user_id: '',
    week_start: '',
    week_end: '',
    summary: `Across the last week, sleep averaged ${a.sleep.toFixed(1)}h, mood ${a.mood.toFixed(1)}/10, and stress ${a.stress.toFixed(1)}/10. Outdoor time averaged ${Math.round(a.outdoor)} minutes per day. ${patterns[0]}`,
    patterns,
    contributing_factors: factors,
    reflection_questions: questions,
    suggestions,
    metrics_snapshot: {
      sleep: round1(a.sleep),
      stress: round1(a.stress),
      mood: round1(a.mood),
      social: round1(a.social),
      outdoor: round1(a.outdoor),
    },
    created_at: new Date().toISOString(),
  };
}

function toInsight(parsed: Record<string, unknown>, ctx: InsightContext): WeeklyInsight {
  return {
    id: '',
    user_id: '',
    week_start: '',
    week_end: '',
    summary: String(parsed.summary ?? ''),
    patterns: toStringArray(parsed.patterns),
    contributing_factors: toStringArray(parsed.contributing_factors),
    reflection_questions: toStringArray(parsed.reflection_questions),
    suggestions: toStringArray(parsed.suggestions),
    metrics_snapshot: ctx.trendSnapshots as unknown as Record<string, number>,
    created_at: new Date().toISOString(),
  };
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function round1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

/* ------------------------------ Action Plan ------------------------------ */

/** A single countermeasure generated from the user's data. */
export interface Countermeasure {
  /** What area of concern this addresses (e.g. "sleep", "stress", "mood", "energy", "connection", "outdoor", "work"). */
  area: string;
  /** A specific, concrete action the user can take. */
  action: string;
  /** Brief reason grounded in the user's own data. */
  reason: string;
}

export interface ActionPlan {
  /** 1-2 sentence overview. */
  summary: string;
  /** 3-5 specific countermeasures. */
  countermeasures: Countermeasure[];
  /** Areas doing well (1-2), with a short data-grounded note. */
  strengths: { area: string; note: string }[];
  /** Areas needing attention (1-2), with a short data-grounded note. */
  watchpoints: { area: string; note: string }[];
}

export interface ActionPlanContext {
  profile: { name: string; sleep_goal_hours: number | null };
  recentCheckins: DailyCheckin[];
  recentJournals: JournalEntry[];
  wellness: { score: number; components: Record<string, number> };
}

const ACTION_PLAN_SYSTEM = `You are a supportive wellness coach in an app called J0rn@l. You are NOT a therapist and MUST NOT diagnose.

You are given a week of a user's self-reported data: daily check-in scores (mood, energy, stress, connection, rest, purpose, sleep, outdoor), journal excerpts, and a wellness score with component breakdown.

Your job is to write a short action plan with concrete, specific countermeasures — not generic advice, but actions that fit THIS person's data.

Style rules:
- Use second person, warm and plain language. No clinical jargon.
- Never claim certainty. Use "it looks like", "your data suggests".
- Never diagnose. Never name a disorder. Never recommend medication.
- Each countermeasure must be a single concrete action (one sentence).
- Each reason must reference the user's actual data (e.g. "sleep averaged 6.2h").
- Keep summary to 1-2 sentences.
- Output MUST be valid JSON matching the requested schema. No markdown, no commentary.`;

/**
 * Ask the BlackBox AI to generate a personalized action plan with
 * concrete countermeasures based on a week of user data.
 * Falls back to a deterministic local generator when the API is unavailable.
 */
export async function generateActionPlan(ctx: ActionPlanContext): Promise<ActionPlan> {
  const prompt = buildActionPlanPrompt(ctx);

  try {
    const res = await blackboxFetch('/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: ACTION_PLAN_SYSTEM },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    if (!res.ok) throw new Error(`Blackbox API ${res.status}`);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      const parsed = safeParse(content);
      if (parsed) {
        return {
          summary: String(parsed.summary ?? ''),
          countermeasures: toCountermeasures(parsed.countermeasures),
          strengths: toAreaNotes(parsed.strengths),
          watchpoints: toAreaNotes(parsed.watchpoints),
        };
      }
    }
  } catch {
    // fall through to local generator
  }

  return localActionPlan(ctx);
}

function buildActionPlanPrompt(ctx: ActionPlanContext): string {
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

  const aiScores = {
    mood: mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.mood ?? c.mood)),
    energy: mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.energy ?? c.energy)),
    stress: mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.stress ?? c.stress)),
    connection: mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.connection ?? c.social_connection)),
    rest: mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.rest ?? (c.sleep_hours / 9 * 10))),
    purpose: mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.purpose ?? c.focus)),
  };

  const summary = {
    name: ctx.profile.name,
    sleep_goal_hours: ctx.profile.sleep_goal_hours ?? 8,
    checkin_count: ctx.recentCheckins.length,
    numeric_averages: {
      sleep_hours: mean(ctx.recentCheckins.map((c) => c.sleep_hours)),
      outdoor_minutes: mean(ctx.recentCheckins.map((c) => c.outdoor_minutes)),
      work_pressure: mean(ctx.recentCheckins.map((c) => c.work_pressure)),
    },
    ai_inferred_scores: aiScores,
    wellness_score: ctx.wellness.score,
    wellness_components: ctx.wellness.components,
    journal_excerpts: ctx.recentJournals.slice(0, 5).map((j) => ({
      date: j.created_at.slice(0, 10),
      title: j.title,
      excerpt: j.body.slice(0, 200),
    })),
  };

  return `Generate a JSON action plan for ${ctx.profile.name}. Use the data below to write concrete, specific countermeasures grounded in actual numbers.

Return JSON with these keys:
{
  "summary": string,                    // 1-2 sentences
  "countermeasures": [                  // 3-5 specific actions
    {
      "area": string,                   // "sleep", "stress", "mood", "energy", "connection", "outdoor", "work"
      "action": string,                 // one concrete, specific action sentence
      "reason": string                  // grounded in actual data (e.g. "sleep averaged 6.2h")
    }
  ],
  "strengths": [                        // 1-2 areas doing well
    { "area": string, "note": string }
  ],
  "watchpoints": [                      // 1-2 areas needing attention
    { "area": string, "note": string }
  ]
}

Data:
${JSON.stringify(summary, null, 2)}`;
}

function toCountermeasures(v: unknown): Countermeasure[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 5).map((c: any) => ({
    area: String(c?.area ?? ''),
    action: String(c?.action ?? ''),
    reason: String(c?.reason ?? ''),
  })).filter((c) => c.action.trim().length > 0);
}

function toAreaNotes(v: unknown): { area: string; note: string }[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 2).map((a: any) => ({
    area: String(a?.area ?? ''),
    note: String(a?.note ?? ''),
  })).filter((a) => a.note.trim().length > 0);
}

/* ------------------------------ Therapist Chat ------------------------------ */

/** A single message in the therapist conversation. */
export interface TherapistMessage {
  role: 'user' | 'therapist';
  content: string;
  timestamp: string;
}

export interface TherapistContext {
  profile: { name: string };
  recentCheckins: DailyCheckin[];
  recentJournals: JournalEntry[];
  /** Journals from ~30 days ago for writing-style comparison. */
  pastJournals: JournalEntry[];
  wellness: { score: number };
  actionPlan?: ActionPlan | null;
}

const THERAPIST_SYSTEM = `You are a warm, attentive conversational partner in an app called J0rn@l — a personal wellness journal. You are NOT a licensed therapist and MUST NOT diagnose, treat, or prescribe. You are a supportive listener who knows the user's self-reported data and uses it to have meaningful, reflective conversations.

Every message you receive includes USER CONTEXT — a snapshot of the user's recent check-ins, journal entries, wellness score, action plan, and a comparison of their current writing style vs a month ago. USE this context naturally in conversation. Do not list it back to them. Weave it in gently.

Style rules:
- Warm, conversational, second-person. Sound like a thoughtful friend, not a clinician.
- Never diagnose. Never name a disorder. Never recommend medication. Never moralize.
- Notice changes and patterns: "Your entries from last month were longer and more reflective — this week they're shorter. What's shifted?"
- Reference their own data casually: "Looking at your check-ins, stress has been running around 7/10 the last few days. How's that landing in your body?"
- Ask open questions. Validate feelings. Reflect back what you hear.
- Keep replies to 2-4 sentences. Don't lecture. Don't give lists of advice unless they ask.
- If they express concerning thoughts, gently encourage them to reach out to someone they trust — and remind them you're just a reflection of their own words, not a crisis resource.
- If they ask for practical ideas, draw from their action plan or wellness data to suggest small, concrete steps.
- NEVER reference "USER CONTEXT" as a heading. Never output JSON. Just talk.`;

/**
 * Chat with the AI therapist. Sends the full conversation history plus
 * user context so the AI can reference patterns, mood shifts, and
 * writing-style changes naturally.
 */
export async function generateTherapistReply(
  history: TherapistMessage[],
  ctx: TherapistContext,
): Promise<string> {
  const contextBlock = buildTherapistContextBlock(ctx);

  try {
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: THERAPIST_SYSTEM },
      { role: 'user', content: contextBlock },
    ];
    // Add conversation history
    for (const m of history) {
      messages.push({ role: m.role === 'therapist' ? 'assistant' : 'user', content: m.content });
    }

    const res = await blackboxFetch('/chat/completions', {
      model: MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 600,
    });
    if (!res.ok) throw new Error(`Blackbox API ${res.status}`);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim().length > 0) {
      return content.trim();
    }
  } catch {
    // fall through to local
  }

  return localTherapistReply(history, ctx);
}

function buildTherapistContextBlock(ctx: TherapistContext): string {
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

  const recentMood = mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.mood ?? c.mood));
  const recentStress = mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.stress ?? c.stress));
  const recentEnergy = mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.energy ?? c.energy));
  const recentConnection = mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.connection ?? c.social_connection));
  const recentSleep = mean(ctx.recentCheckins.map((c) => c.sleep_hours));

  let block = `USER CONTEXT (use this naturally — do not list it):\n`;
  block += `Name: ${ctx.profile.name}\n`;
  block += `Wellness score: ${Math.round(ctx.wellness.score)}/100\n`;
  block += `Recent averages (past 7 days): Mood ${recentMood.toFixed(1)}/10, Stress ${recentStress.toFixed(1)}/10, Energy ${recentEnergy.toFixed(1)}/10, Connection ${recentConnection.toFixed(1)}/10, Sleep ${recentSleep.toFixed(1)}h\n`;

  // Writing style comparison: recent vs a month ago
  const recentExcerpts = ctx.recentJournals.slice(0, 3).map((j) =>
    `${j.created_at.slice(0, 10)}: "${j.body.slice(0, 150)}"`).join('\n');
  const pastExcerpts = ctx.pastJournals.slice(0, 3).map((j) =>
    `${j.created_at.slice(0, 10)}: "${j.body.slice(0, 150)}"`).join('\n');

  if (recentExcerpts) block += `\nRecent journal excerpts:\n${recentExcerpts}\n`;
  if (pastExcerpts) {
    block += `\nJournal excerpts from ~1 month ago (compare writing style, tone, length, emotional content with recent ones):\n${pastExcerpts}\n`;
  }

  if (ctx.actionPlan?.countermeasures?.length) {
    const top = ctx.actionPlan.countermeasures.slice(0, 2).map((c) => `- ${c.area}: ${c.action}`).join('\n');
    block += `\nActive action plan countermeasures:\n${top}\n`;
  }

  block += `\nThe user has just sent you a message. Respond warmly, using the context above to understand where they might be coming from. If their writing style or emotional tone has shifted compared to a month ago, gently notice it.`;

  return block;
}

/** Deterministic fallback therapist — keyword-based + context-aware. */
function localTherapistReply(history: TherapistMessage[], ctx: TherapistContext): string {
  const lastMsg = history.length > 0 ? history[history.length - 1]!.content.toLowerCase() : '';
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const stressAvg = mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.stress ?? c.stress));
  const moodAvg = mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.mood ?? c.mood));
  const sleepAvg = mean(ctx.recentCheckins.map((c) => c.sleep_hours));

  // Writing style change detection (local)
  const recentLen = ctx.recentJournals.slice(0, 3).reduce((s, j) => s + j.body.length, 0) / Math.max(1, ctx.recentJournals.length);
  const pastLen = ctx.pastJournals.slice(0, 3).reduce((s, j) => s + j.body.length, 0) / Math.max(1, ctx.pastJournals.length);
  const styleShift = pastLen > 0 && recentLen > 0 && Math.abs(recentLen - pastLen) / pastLen > 0.3;

  // Context-aware responses
  if (stressAvg >= 6.5 && (lastMsg.includes('stress') || lastMsg.includes('overwhelm') || lastMsg.includes('tired') || lastMsg.includes('anxious'))) {
    return `I can see why you'd say that — your check-ins this week have stress hovering around ${stressAvg.toFixed(0)}/10. That's a lot to carry. What's been the heaviest part of it for you?`;
  }
  if (styleShift && recentLen < pastLen) {
    return `I noticed something — your journal entries recently are shorter than they were a month ago. Not judging that at all, just noticing. Has writing felt harder lately, or has life just been busier?`;
  }
  if (sleepAvg < 6.5 && lastMsg.includes('sleep')) {
    return `Sleep's been running around ${sleepAvg.toFixed(1)}h — below what your body probably needs. Some nights are just like that. What's the hardest part of winding down right now?`;
  }
  if (moodAvg < 5) {
    return `Looking at your recent check-ins, mood's been lower than usual — around ${moodAvg.toFixed(0)}/10. I'm glad you're here talking. What's felt heaviest this week?`;
  }
  if (lastMsg.includes('sad') || lastMsg.includes('lonely') || lastMsg.includes('alone')) {
    return `That sounds really hard. Connection has been a little lower in your check-ins too — around ${mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.connection ?? c.social_connection)).toFixed(0)}/10. Who's someone you trust that you could reach out to, even just with a short text?`;
  }
  if (lastMsg.includes('angry') || lastMsg.includes('frustrated') || lastMsg.includes('mad')) {
    return `That frustration sounds real and valid. Sometimes when stress builds up, it shows up as anger before we even name the stress. What do you think is underneath it?`;
  }
  if (ctx.wellness.score >= 70 && (lastMsg.includes('good') || lastMsg.includes('great') || lastMsg.includes('better'))) {
    return `I'm really glad to hear that — your wellness score has been holding strong too, around ${Math.round(ctx.wellness.score)}. What do you think has been helping the most?`;
  }
  if (lastMsg.includes('help') || lastMsg.includes('what should') || lastMsg.includes('advice')) {
    const tips: string[] = [];
    if (sleepAvg < 6.5) tips.push('a 20-minute wind-down before bed might help — dim lights, no phone, just a book or music');
    if (stressAvg > 5.5) tips.push('a short breathing break between tasks has been shown to lower heart rate');
    if (tips.length > 0) return `Here are a couple of small things that might help, based on your data: ${tips.join('; and ')}. Want to try one of those?`;
    return 'I hear you. Sometimes the smallest step helps — what\'s one tiny thing you could try today that would feel manageable?';
  }
  if (history.length <= 1) {
    return `Hey ${ctx.profile.name || 'there'}. I've been reading your check-ins and journal — I can see the shape of your week. How are you feeling right now, honestly?`;
  }
  // ELIZA-style reflective fallback
  const reflections = [
    'Tell me more about that.',
    'What do you think is underneath that feeling?',
    'I hear you. How does that sit with you?',
    'That makes sense given everything you\'ve been carrying.',
    'What would feel like a small win today?',
  ];
  return reflections[history.length % reflections.length]!;
}

/** Deterministic fallback action plan (no AI required). */
function localActionPlan(ctx: ActionPlanContext): ActionPlan {
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const sleepAvg = mean(ctx.recentCheckins.map((c) => c.sleep_hours));
  const stressAvg = mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.stress ?? c.stress));
  const outdoorAvg = mean(ctx.recentCheckins.map((c) => c.outdoor_minutes));
  const moodAvg = mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.mood ?? c.mood));
  const connectionAvg = mean(ctx.recentCheckins.map((c) => c.interpretation_meta?.connection ?? c.social_connection));

  const countermeasures: Countermeasure[] = [];
  if (sleepAvg > 0 && sleepAvg < 6.5) {
    countermeasures.push({
      area: 'sleep',
      action: `Set a 30-minute wind-down routine tonight — dim lights, no phone, a book or calm music.`,
      reason: `Sleep averaged ${sleepAvg.toFixed(1)}h, below the ${ctx.profile.sleep_goal_hours ?? 8}h goal.`,
    });
  }
  if (stressAvg >= 5.5) {
    countermeasures.push({
      area: 'stress',
      action: 'Try a 4-7-8 breathing cycle (inhale 4s, hold 7s, exhale 8s) for two minutes between meetings.',
      reason: `Stress averaged ${stressAvg.toFixed(1)}/10. Small breathing pauses can drop heart rate visibly.`,
    });
  }
  if (outdoorAvg < 30) {
    countermeasures.push({
      area: 'outdoor',
      action: 'Take a 15-minute walk outside tomorrow — light + movement is the shortest stress reset.',
      reason: `Outdoor time averaged ${Math.round(outdoorAvg)} min/day. Even 15 minutes in daylight shifts your evening.`,
    });
  }
  if (moodAvg > 0 && moodAvg < 5) {
    countermeasures.push({
      area: 'mood',
      action: 'Write down one small thing that went right today. Naming it counts more than it sounds.',
      reason: `Mood averaged ${moodAvg.toFixed(1)}/10. Noticing a small positive rewires the pattern.`,
    });
  }
  if (connectionAvg > 0 && connectionAvg < 5) {
    countermeasures.push({
      area: 'connection',
      action: 'Text one person you trust a single sentence today. Connection doesn\u2019t need to be a whole event.',
      reason: `Connection averaged ${connectionAvg.toFixed(1)}/10. A short reach-out is enough.`,
    });
  }
  if (countermeasures.length === 0) {
    countermeasures.push({
      area: 'maintenance',
      action: 'Keep doing what you are doing — your rhythms are working right now.',
      reason: 'All metrics are within healthy ranges this week.',
    });
  }

  const strengths: { area: string; note: string }[] = [];
  if (sleepAvg >= 7) strengths.push({ area: 'sleep', note: `Steady at ${sleepAvg.toFixed(1)}h on average.` });
  if (moodAvg >= 6) strengths.push({ area: 'mood', note: `Holding at ${moodAvg.toFixed(1)}/10.` });
  if (outdoorAvg >= 40) strengths.push({ area: 'outdoor', note: `${Math.round(outdoorAvg)} min/day outside.` });
  if (strengths.length === 0) strengths.push({ area: 'check-in', note: 'Showing up every day is the first win.' });

  const watchpoints: { area: string; note: string }[] = [];
  if (sleepAvg > 0 && sleepAvg < 6.5) watchpoints.push({ area: 'sleep', note: `Below goal at ${sleepAvg.toFixed(1)}h.` });
  if (stressAvg >= 6) watchpoints.push({ area: 'stress', note: `Running at ${stressAvg.toFixed(1)}/10.` });
  if (moodAvg > 0 && moodAvg < 5) watchpoints.push({ area: 'mood', note: `Landed at ${moodAvg.toFixed(1)}/10.` });
  if (watchpoints.length === 0) watchpoints.push({ area: 'rhythm', note: 'Everything looks steady.' });

  return {
    summary: sleepAvg > 0
      ? `Based on ${ctx.recentCheckins.length} check-ins: sleep averaged ${sleepAvg.toFixed(1)}h, mood ${moodAvg.toFixed(1)}/10, stress ${stressAvg.toFixed(1)}/10.`
      : `Only ${ctx.recentCheckins.length} check-ins this week. A few more days of data will sharpen the picture.`,
    countermeasures,
    strengths: strengths.slice(0, 2),
    watchpoints: watchpoints.slice(0, 2),
  };
}

/* ------------------------------ Check-in interpretation ------------------------------ */

export interface CheckinInterpretInput {
  /** User display name for the prompt. */
  name: string;
  /** User's free-text answers keyed by question id. */
  responses: Record<string, string>;
}

export interface CheckinInterpretResult {
  /** 2-3 sentence warm, non-clinical reflection. */
  interpretation: string;
  /** Inferred scores 1-10 across six dimensions. */
  scores: {
    mood: number;
    energy: number;
    stress: number;
    connection: number;
    rest: number;
    purpose: number;
  };
  /** 1-3 short themes pulled from the answers (e.g. "work", "morning", "family"). */
  themes: string[];
}

const INTERPRET_SYSTEM = `You are the reflection voice of a personal journal app called J0rn@l. You are NOT a therapist and MUST NOT diagnose.

You are given a user's free-text answers to a small set of daily check-in questions. Your job is to read them, infer how today is actually landing, and return a JSON object.

Style rules:
- Be warm, plain, and second person. No clinical jargon.
- Never claim certainty. Use phrases like "it sounds like", "one thread that comes through", "today reads as".
- Never name a disorder. Never recommend medication. Never moralize.
- Keep the "interpretation" to 2-3 short sentences. No bullet lists, no headers.
- If the answers are too sparse to say anything meaningful, the interpretation should be one sentence acknowledging that and inviting a longer answer next time.

Output MUST be valid JSON exactly matching this schema:
{
  "interpretation": string,    // 2-3 sentences
  "mood":       number,        // 1-10, where 1 = very low, 10 = very high
  "energy":     number,        // 1-10
  "stress":     number,        // 1-10, where HIGHER = more stress
  "connection": number,        // 1-10
  "rest":       number,        // 1-10, how well-rested they feel
  "purpose":    number,        // 1-10, sense of meaning / momentum in their work
  "themes":     string[]       // 1-3 short nouns from the answers, lowercased
}

No markdown, no commentary, no trailing text. JSON only.`;

/**
 * Ask the BlackBox LLM to interpret a user's free-text check-in answers.
 * Falls back to a deterministic local interpreter if the API is unavailable.
 */
export async function interpretCheckinResponses(input: CheckinInterpretInput): Promise<CheckinInterpretResult> {
  const prompt = buildInterpretPrompt(input);

  try {
    const res = await blackboxFetch('/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: INTERPRET_SYSTEM },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    if (!res.ok) throw new Error(`Blackbox API ${res.status}`);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      const parsed = safeParse(content);
      if (parsed) {
        return {
          interpretation: String(parsed.interpretation ?? '').trim() || localInterpret(input).interpretation,
          scores: {
            mood:       clampScore(parsed.mood),
            energy:     clampScore(parsed.energy),
            stress:     clampScore(parsed.stress),
            connection: clampScore(parsed.connection),
            rest:       clampScore(parsed.rest),
            purpose:    clampScore(parsed.purpose),
          },
          themes: toStringArray(parsed.themes).slice(0, 3).map((s) => s.toLowerCase().trim()).filter(Boolean),
        };
      }
    }
  } catch {
    // fall through to local interpreter
  }

  return localInterpret(input);
}

function buildInterpretPrompt(input: CheckinInterpretInput): string {
  const lines: string[] = [];
  lines.push(`User: ${input.name || 'a J0rn@l user'}.`);
  lines.push('');
  lines.push('Their answers to today\u2019s check-in:');
  lines.push('');
  for (const [qid, answer] of Object.entries(input.responses)) {
    const q = getQuestion(qid);
    const cat = q ? CHECKIN_CATEGORIES[q.category] : null;
    const label = q ? `[${cat?.label ?? q.category}] ${q.text}` : `[${qid}]`;
    lines.push(`- ${label}`);
    lines.push(`  Answer: ${answer.trim() || '(blank)'}`);
  }
  lines.push('');
  lines.push('Return JSON only.');
  return lines.join('\n');
}

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n)));
}

/**
 * Deterministic, rule-based interpreter. Used as the fallback when no
 * BlackBox key is configured or the API is unreachable. It reads the
 * surface tone of the answers with a small positive/negative lexicon
 * across six dimensions and writes a short paragraph.
 */
const POSITIVE = new Set([
  'good', 'great', 'calm', 'clear', 'steady', 'focused', 'energized', 'rested',
  'connected', 'proud', 'grateful', 'sharp', 'bright', 'warm', 'light', 'easy',
  'alive', 'seen', 'ready', 'hopeful', 'okay', 'fine', 'good enough', 'happy',
  'joy', 'loved', 'safe', 'open',
]);
const NEGATIVE = new Set([
  'tired', 'drained', 'anxious', 'overwhelm', 'overwhelmed', 'heavy', 'low',
  'exhausted', 'frustrated', 'frustrating', 'stuck', 'lonely', 'isolated',
  'tense', 'tight', 'hard', 'difficult', 'rough', 'awful', 'bad',
  'foggy', 'fog', 'guilty', 'guilt', 'worry', 'worried', 'sad', 'angry',
  'numb', 'burned', 'burnt', 'burned out', 'panic', 'stressed', 'pressure',
]);
const HIGH_STRESS = ['overwhelm', 'overwhelmed', 'pressure', 'deadline', 'anxious', 'panic', 'tense', 'stressed', 'hard', 'rough', 'drained'];
const LOW_CONNECTION = ['alone', 'isolated', 'lonely', 'no one', 'nobody', 'by myself'];
const HIGH_CONNECTION = ['together', 'conversation', 'lunch', 'dinner', 'friend', 'family', 'partner', 'team', 'call', 'caught up', 'reached out', 'talked', 'shared'];
const LOW_REST = ['tired', 'exhausted', 'slept badly', 'rough night', 'little sleep', 'no sleep', 'restless', 'insomnia', 'woke up tired'];
const HIGH_REST = ['rested', 'slept well', 'good sleep', 'woke up', 'good morning', 'recovery', 'nap'];
const PURPOSE_NOISE = ['meeting', 'meetings', 'email', 'emails', 'slack', 'admin', 'reactive', 'noise'];
const PURPOSE_MATTER = ['finished', 'shipped', 'wrote', 'designed', 'built', 'reviewed', 'figured out', 'solved', 'helped', 'made progress', 'learned'];

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
}

export function localInterpret(input: CheckinInterpretInput): CheckinInterpretResult {
  const allText = Object.values(input.responses).join(' \u2022 ');
  const tokens = tokenize(allText);
  let pos = 0, neg = 0;
  for (const t of tokens) {
    if (POSITIVE.has(t)) pos++;
    if (NEGATIVE.has(t)) neg++;
  }
  // Bigram checks
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = `${tokens[i]} ${tokens[i + 1]}`;
    if (POSITIVE.has(bg)) pos++;
    if (NEGATIVE.has(bg)) neg++;
  }
  const total = pos + neg || 1;
  const valence = (pos - neg) / total; // -1..1

  // ---- Numeric answer extraction ----
  // These are parsed from type='number' question answers and override
  // or adjust the keyword-based inference with direct user data.
  const resp = input.responses;
  const sleepHours   = parseFloat(resp['body.sleep_hours'] ?? '');
  const sleepQuality = parseFloat(resp['body.sleep_quality'] ?? '');
  const outdoorMin   = parseFloat(resp['body.outdoor_minutes'] ?? '');
  const exerciseMin  = parseFloat(resp['body.exercise_minutes'] ?? '');
  const meals        = parseFloat(resp['body.meals'] ?? '');
  const anxietyLevel = parseFloat(resp['emotion.anxiety'] ?? '');
  const clarityLevel = parseFloat(resp['mind.clarity'] ?? '');

  const hasSleepHours   = Number.isFinite(sleepHours);
  const hasSleepQuality = Number.isFinite(sleepQuality);
  const hasOutdoor      = Number.isFinite(outdoorMin);
  const hasExercise     = Number.isFinite(exerciseMin);
  const hasMeals        = Number.isFinite(meals);
  const hasAnxiety      = Number.isFinite(anxietyLevel);
  const hasClarity      = Number.isFinite(clarityLevel);

  // ---- Stress ----
  let stress = 5 - valence * 4;
  if (HIGH_STRESS.some((w) => allText.toLowerCase().includes(w))) stress += 1.5;
  if (LOW_REST.some((w) => allText.toLowerCase().includes(w))) stress += 1;
  if (hasAnxiety) {
    // Direct anxiety rating strongly influences stress
    stress = stress * 0.4 + anxietyLevel * 0.6;
  }

  // ---- Connection ----
  let connection = 5 + valence * 3;
  if (HIGH_CONNECTION.some((w) => allText.toLowerCase().includes(w))) connection += 1.5;
  if (LOW_CONNECTION.some((w) => allText.toLowerCase().includes(w))) connection -= 2;

  // ---- Rest ----
  let rest = 5 + valence * 3;
  if (HIGH_REST.some((w) => allText.toLowerCase().includes(w))) rest += 1.5;
  if (LOW_REST.some((w) => allText.toLowerCase().includes(w))) rest -= 2;
  if (hasSleepHours) {
    // Sleep hours: <6 is poor, 7-9 is optimal
    if (sleepHours < 5) rest = rest * 0.3 + 2 * 0.7;
    else if (sleepHours < 6) rest = rest * 0.4 + 4 * 0.6;
    else if (sleepHours < 7) rest = rest * 0.5 + 5.5 * 0.5;
    else if (sleepHours <= 9) rest = rest * 0.4 + 8 * 0.6;
    else rest = rest * 0.5 + 6 * 0.5; // too much sleep can also feel groggy
  }
  if (hasSleepQuality) {
    // Direct quality rating overrides with more weight
    rest = rest * 0.3 + sleepQuality * 0.7;
  }

  // ---- Purpose ----
  let purpose = 5 + valence * 2;
  if (PURPOSE_MATTER.some((w) => allText.toLowerCase().includes(w))) purpose += 1.5;
  if (PURPOSE_NOISE.filter((w) => allText.toLowerCase().includes(w)).length >= 2) purpose -= 1.5;
  if (hasClarity) {
    // Mental clarity directly maps to purpose/focus
    purpose = purpose * 0.4 + clarityLevel * 0.6;
  }

  // ---- Mood ----
  let mood = 5 + valence * 4;
  if (hasAnxiety) {
    // High anxiety drags mood down
    mood -= (anxietyLevel - 5) * 0.5;
  }
  if (hasSleepHours && sleepHours < 6) {
    mood -= (6 - sleepHours) * 0.5;
  }

  // ---- Energy ----
  let energy = 5 + valence * 3 + (LOW_REST.some((w) => allText.toLowerCase().includes(w)) ? -1.5 : 0);
  if (hasSleepHours && sleepHours < 6) {
    energy -= (6 - sleepHours) * 0.8;
  }
  if (hasSleepHours && sleepHours >= 7 && sleepHours <= 9) {
    energy += 1;
  }
  if (hasOutdoor && outdoorMin > 30) {
    energy += Math.min(1.5, outdoorMin / 60);
  }
  if (hasExercise && exerciseMin > 0) {
    energy += Math.min(1.5, exerciseMin / 60);
  }
  if (hasMeals && meals < 2) {
    energy -= 1.5;
  }
  if (hasMeals && meals >= 3) {
    energy += 1;
  }

  const scores = {
    mood:       clampScore(mood),
    energy:     clampScore(energy),
    stress:     clampScore(stress),
    connection: clampScore(connection),
    rest:       clampScore(rest),
    purpose:    clampScore(purpose),
  };

  // Theme extraction
  const themeCounts = new Map<string, number>();
  for (const qid of Object.keys(input.responses)) {
    const q = getQuestion(qid);
    if (q) themeCounts.set(q.category, (themeCounts.get(q.category) ?? 0) + 1);
  }
  const themes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);

  // Paragraph
  const slices: string[] = [];
  const open = (() => {
    if (valence > 0.3) return 'There\u2019s a steady brightness to what you wrote today.';
    if (valence < -0.3) return 'Today reads as a heavier one \u2014 the kind that asks a lot of you.';
    return 'Today lands somewhere in the middle \u2014 not a high, not a crash.';
  })();
  slices.push(open);

  if (stress >= 7) slices.push('Stress is clearly running the show, and that probably explains the low energy and the tightness in the body.');
  else if (stress >= 6) slices.push('There\u2019s a current of pressure underneath the day, even if you\u2019re moving through it.');

  if (connection >= 7) slices.push('Connection is a real asset right now \u2014 someone saw you, and that matters more than it sounds.');
  else if (connection <= 4) slices.push('You\u2019re running a little short on connection, and it shows up in the rest of the picture.');

  if (rest <= 4) slices.push('Your body is asking for a longer runway tomorrow \u2014 sleep, food, a slow morning.');

  if (purpose >= 7) slices.push('You finished something that mattered today, even if it was small.');
  else if (purpose <= 4) slices.push('Most of today felt like noise \u2014 one small thing you can call \u201cdone\u201d tomorrow would help.');

  if (slices.length === 1) {
    slices.push('A short answer would already help tomorrow\u2019s reflection land better.');
  }

  return {
    interpretation: slices.slice(0, 3).join(' '),
    scores,
    themes: themes.length ? themes : ['reflection'],
  };
}
