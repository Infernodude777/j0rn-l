import { NextResponse } from 'next/server';
import { generateTherapistReply, hasWorkingBlackboxKey } from '@/lib/ai/blackbox';
import { calculateWellnessScore } from '@/lib/patterns';
import { listCheckins, listJournal, getProfile } from '@/lib/db/api';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { readLocalSessionFromCookie } from '@/lib/db/local-cookie';
import { daysAgoISO } from '@/lib/utils';
import type { TherapistMessage } from '@/lib/ai/blackbox';
import type { DailyCheckin, JournalEntry, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ResolvedUser { id: string; email: string }

interface ClientChatContext {
  profile?: Pick<Profile, 'id' | 'name' | 'sleep_goal_hours'> | null;
  checkins?: DailyCheckin[];
  journals?: JournalEntry[];
}

interface ChatRequestBody {
  history?: TherapistMessage[];
  context?: ClientChatContext;
}

function isValidCheckin(value: unknown): value is DailyCheckin {
  const c = value as DailyCheckin | null | undefined;
  return !!c && typeof c.id === 'string' && typeof c.user_id === 'string' && typeof c.date === 'string';
}

function isValidJournal(value: unknown): value is JournalEntry {
  const j = value as JournalEntry | null | undefined;
  return !!j && typeof j.id === 'string' && typeof j.user_id === 'string' && typeof j.created_at === 'string';
}

function sanitizeContext(context: ClientChatContext | undefined, fallbackUser: ResolvedUser) {
  const profile = context?.profile && typeof context.profile.name === 'string'
    ? {
        name: context.profile.name,
        sleep_goal_hours: typeof context.profile.sleep_goal_hours === 'number' ? context.profile.sleep_goal_hours : null,
      }
    : { name: fallbackUser.email.split('@')[0] || 'You', sleep_goal_hours: 8 };
  const checkins = Array.isArray(context?.checkins) ? context.checkins.filter(isValidCheckin) : [];
  const journals = Array.isArray(context?.journals) ? context.journals.filter(isValidJournal) : [];
  return { profile, checkins, journals };
}

function mergeContext(
  serverContext: { profile: Awaited<ReturnType<typeof getProfile>>; checkins: Awaited<ReturnType<typeof listCheckins>>; journals: Awaited<ReturnType<typeof listJournal>> },
  clientContext: ReturnType<typeof sanitizeContext> | null,
) {
  if (!clientContext) return serverContext;
  return {
    profile: clientContext.profile?.name ? { ...serverContext.profile, name: clientContext.profile.name, sleep_goal_hours: clientContext.profile.sleep_goal_hours ?? serverContext.profile?.sleep_goal_hours ?? null } : serverContext.profile,
    checkins: clientContext.checkins.length > 0 ? clientContext.checkins : serverContext.checkins,
    journals: clientContext.journals.length > 0 ? clientContext.journals : serverContext.journals,
  };
}

async function resolveUser(): Promise<ResolvedUser | null> {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return { id: user.id, email: user.email ?? '' };
    }
  }
  const local = await readLocalSessionFromCookie();
  if (!local) return null;
  return { id: local.userId, email: local.email };
}

export async function POST(req: Request) {
  try {
    const user = await resolveUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: ChatRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const history: TherapistMessage[] = Array.isArray(body.history) ? body.history.slice(-20) : [];
    const clientContext = body.context ? sanitizeContext(body.context, user) : null;

    // Fetch user context in parallel.
    const [serverProfile, serverCheckins, serverJournals] = await Promise.all([
      getProfile(user.id),
      listCheckins(user.id, daysAgoISO(31)),
      listJournal(user.id),
    ]);

    const { profile, checkins, journals } = mergeContext(
      { profile: serverProfile, checkins: serverCheckins, journals: serverJournals },
      clientContext,
    );

    const recentCheckins = checkins.filter((c) => c.date >= daysAgoISO(7));
    const fullMonthCheckins = checkins.filter((c) => c.date >= daysAgoISO(31));
    const wellness = calculateWellnessScore(recentCheckins);

    // Past journals (~1 month ago) for writing-style comparison.
    const oneMonthAgo = daysAgoISO(31);
    const pastJournals = journals.filter(
      (j) => j.created_at.slice(0, 10) >= oneMonthAgo && j.created_at.slice(0, 10) <= daysAgoISO(22),
    );

    // Generate the therapist reply — the action plan is omitted from chat
    // context here to keep latency low. The therapist still has full access
    // to check-ins, journals, and wellness data.
    const [reply, aiPowered] = await Promise.all([
      generateTherapistReply(history, {
        profile: { name: profile?.name || user.email.split('@')[0] || 'You' },
        recentCheckins: fullMonthCheckins,
        recentJournals: journals.slice(0, 24),
        pastJournals,
        wellness: { score: wellness.score },
        actionPlan: null,
      }),
      hasWorkingBlackboxKey(),
    ]);
    const aiReason = !aiPowered ? 'api_unreachable' : null;

    return NextResponse.json({
      reply,
      ai_powered: aiPowered,
      ai_reason: aiReason,
    });
  } catch (error) {
    const fallback = await generateTherapistReply([], {
      profile: { name: 'You' },
      recentCheckins: [],
      recentJournals: [],
      pastJournals: [],
      wellness: { score: 0 },
      actionPlan: null,
    });
    return NextResponse.json(
      {
        reply: fallback,
        ai_powered: false,
        ai_reason: error instanceof Error ? error.message : 'chat_failed',
      },
      { status: 200 },
    );
  }
}
