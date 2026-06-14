import { NextResponse } from 'next/server';
import { generateActionPlan, hasWorkingBlackboxKey } from '@/lib/ai/blackbox';
import { calculateWellnessScore } from '@/lib/patterns';
import { listCheckins, listJournal, getProfile } from '@/lib/db/api';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { readLocalSessionFromCookie } from '@/lib/db/local-cookie';
import { daysAgoISO } from '@/lib/utils';
import type { ActionPlan } from '@/lib/ai/blackbox';
import type { DailyCheckin, JournalEntry, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface ResolvedUser { id: string; email: string }

interface ClientActionPlanContext {
  profile?: Pick<Profile, 'id' | 'name' | 'sleep_goal_hours'> | null;
  checkins?: DailyCheckin[];
  journals?: JournalEntry[];
}

interface ActionPlanRequestBody {
  context?: ClientActionPlanContext;
}

function isValidCheckin(value: unknown): value is DailyCheckin {
  const row = value as DailyCheckin | null | undefined;
  return !!row && typeof row.id === 'string' && typeof row.user_id === 'string' && typeof row.date === 'string';
}

function isValidJournal(value: unknown): value is JournalEntry {
  const row = value as JournalEntry | null | undefined;
  return !!row && typeof row.id === 'string' && typeof row.user_id === 'string' && typeof row.created_at === 'string';
}

function sanitizeContext(context: ClientActionPlanContext | undefined, fallbackUser: ResolvedUser) {
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

let cachedPlan: { key: string; plan: ActionPlan; at: number } | null = null;
const PLAN_CACHE_TTL_MS = 4 * 60_000; // 4 min

export async function POST(req: Request) {
  const user = await resolveUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: ActionPlanRequestBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const clientContext = body.context ? sanitizeContext(body.context, user) : null;

  const [serverProfile, serverCheckins, serverJournals] = await Promise.all([
    getProfile(user.id),
    listCheckins(user.id, daysAgoISO(31)),
    listJournal(user.id),
  ]);

  const { profile, checkins, journals } = mergeContext(
    { profile: serverProfile, checkins: serverCheckins, journals: serverJournals },
    clientContext,
  );
  const wellness = calculateWellnessScore(checkins);
  const plan = await generateActionPlan({
    profile: { name: profile?.name || user.email.split('@')[0] || 'You', sleep_goal_hours: profile?.sleep_goal_hours ?? 8 },
    recentCheckins: checkins,
    recentJournals: journals.slice(0, 7),
    wellness: { score: wellness.score, components: wellness.components },
  });

  // Cache the plan so GET can serve it without re-generating
  cachedPlan = { key: user.id, plan, at: Date.now() };
  const aiPowered = await hasWorkingBlackboxKey();
  const aiReason = !aiPowered ? 'api_unreachable' : null;
  return NextResponse.json({ plan, ai_powered: aiPowered, ai_reason: aiReason });
}

export async function GET() {
  const user = await resolveUser();
  const aiPowered = await hasWorkingBlackboxKey();
  const aiReason = !aiPowered ? 'api_unreachable' : null;

  if (!user) return NextResponse.json({ plan: null, ai_powered: aiPowered, ai_reason: aiReason });

  // Serve cached plan if fresh
  if (cachedPlan && cachedPlan.key === user.id && Date.now() - cachedPlan.at < PLAN_CACHE_TTL_MS) {
    return NextResponse.json({ plan: cachedPlan.plan, ai_powered: aiPowered, ai_reason: aiReason });
  }

  // For GET, if no fresh cache, return null (client will call POST to generate)
  return NextResponse.json({ plan: null, ai_powered: aiPowered, ai_reason: aiReason });
}
