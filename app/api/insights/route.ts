import { NextResponse, type NextRequest } from 'next/server';
import { generateWeeklyInsight, hasWorkingBlackboxKey } from '@/lib/ai/blackbox';
import { calculatePatternSnapshot, calculateWellnessScore } from '@/lib/patterns';
import { listCheckins, listJournal, listInsights, saveInsight, getProfile } from '@/lib/db/api';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { readLocalSessionFromCookie } from '@/lib/db/local-cookie';
import { daysAgoISO, todayISO, uid } from '@/lib/utils';
import type { WeeklyInsight } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface ResolvedUser { id: string; email: string }

async function resolveUser(): Promise<ResolvedUser | null> {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return { id: user.id, email: user.email ?? '' };
    }
  }
  // Local fallback: read from the cookie the client store writes.
  const local = await readLocalSessionFromCookie();
  if (!local) return null;
  return { id: local.userId, email: local.email };
}

export async function POST(_request: NextRequest) {
  const user = await resolveUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [profile, checkins, journals] = await Promise.all([
    getProfile(user.id),
    listCheckins(user.id, daysAgoISO(31)),
    listJournal(user.id),
  ]);
  const pattern = calculatePatternSnapshot({ checkins, journals });
  const insight = await generateWeeklyInsight({
    profile: { name: profile?.name || user.email.split('@')[0] || 'You', sleep_goal_hours: profile?.sleep_goal_hours ?? 8 },
    recentCheckins: checkins.slice(-7),
    recentJournals: journals.slice(0, 7),
    trendSnapshots: pattern,
  });
  const wellness = calculateWellnessScore(checkins);
  const stored: WeeklyInsight = {
    ...insight,
    id: uid(),
    user_id: user.id,
    week_start: daysAgoISO(6),
    week_end: todayISO(),
    metrics_snapshot: { ...insight.metrics_snapshot, wellness_score: wellness.score },
  };
  await saveInsight(stored);
  const aiPowered = await hasWorkingBlackboxKey();
  const aiReason = !aiPowered ? 'api_unreachable' : null;
  return NextResponse.json({ insight: stored, ai_powered: aiPowered, ai_reason: aiReason });
}

export async function GET() {
  const user = await resolveUser();
  const aiPowered = await hasWorkingBlackboxKey();
  const aiReason = !aiPowered ? 'api_unreachable' : null;
  if (!user) return NextResponse.json({ insights: [], ai_powered: aiPowered, ai_reason: aiReason });
  const insights = await listInsights(user.id);
  return NextResponse.json({ insights, ai_powered: aiPowered, ai_reason: aiReason });
}
