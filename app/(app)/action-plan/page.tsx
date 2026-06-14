'use client';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner, FullScreenLoader, Spinner } from '@/components/ui/loading';
import { InkIcon } from '@/components/ui/ink-icon';
import { useActionPlan } from '@/hooks/use-action-plan';
import { useDashboardMetrics } from '@/hooks/use-trends';

const AREA_ICONS: Record<string, string> = {
  sleep: 'moon', stress: 'cloud', mood: 'heart', energy: 'bolt',
  connection: 'people', outdoor: 'tree', work: 'book', maintenance: 'check-double',
  rhythm: 'check-double',
};

const AREA_TINTS: Record<string, { bg: string; border: string; ink: string }> = {
  sleep:       { bg: '#E5DDC8', border: '#C4B896', ink: '#2C2C2C' },
  stress:      { bg: '#F5E8E5', border: '#D8A8A6', ink: '#D4786E' },
  mood:        { bg: '#C5D8C0', border: '#D8B080', ink: '#5A4620' },
  energy:      { bg: '#F8F2E0', border: '#E0D5BA', ink: '#5A4620' },
  connection:  { bg: '#E5EDE2', border: '#A8C8A8', ink: '#3A6470' },
  outdoor:     { bg: '#E5EDE2', border: '#B0C8D8', ink: '#3A6470' },
  work:        { bg: '#D8E8D0', border: '#B8BCC8', ink: '#3A3464' },
  maintenance: { bg: '#E5EDE2', border: '#A8C8A8', ink: '#3A6470' },
  rhythm:      { bg: '#E5EDE2', border: '#A8C8A8', ink: '#3A6470' },
};

export default function ActionPlanPage() {
  const { plan, loading, generating, error, generate, ai_powered, ai_reason } = useActionPlan();
  const m = useDashboardMetrics();

  if (loading) return <FullScreenLoader />;

  return (
    <div className="space-y-lg pt-md pb-24">
      <header className="flex items-end justify-between gap-md">
        <div>
          <p className="font-hand text-[18px] text-[#8C8878] italic">countermeasures grounded in your own pages</p>
          <h1
            className="text-[36px] leading-none text-[#2C2C2C]"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            Action Plan
          </h1>
        </div>
        <Button
          variant="primary"
          onClick={() => generate()}
          loading={generating}
          leftIcon={<InkIcon name="sparkle" size={18} />}
        >
          {plan ? 'Regenerate' : 'Generate plan'}
        </Button>
      </header>

      {!ai_powered && (
        <div className="text-xs font-label-sm text-[#5C5850] bg-[#C5D8C0]/60 border border-[#D0C5AA] rounded-md px-md py-sm">
          {ai_reason === 'no_key'
            ? (<span>No <code>BLACKBOX_API_KEY</code> configured. Add it to your <code>.env.local</code> for AI-powered countermeasures. Using local fallback for now.</span>)
            : (<span>Blackbox is not reachable. Using local countermeasures until the server can reach the AI.</span>)
          }
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* WELLNESS BREAKDOWN ============================================= */}
      <WellnessBreakdown wellness={m.wellness} />

      {generating && !plan ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center text-center py-xl px-lg gap-md">
              <div className="w-16 h-16 rounded-full bg-[#E5EDE2] flex items-center justify-center border border-[#C5D8C0]">
                <Spinner />
              </div>
              <div>
                <h3
                  className="text-[22px] text-[#2C2C2C] mb-xs"
                  style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
                >
                  Cooking up your plan…
                </h3>
                <p className="font-body-md text-[#5C5850] max-w-sm mx-auto">
                  Reading your check-ins, journal entries, and patterns to find countermeasures grounded in your data.
                </p>
              </div>
              <div className="flex items-center gap-1.5 mt-sm">
                <span className="w-2 h-2 rounded-full bg-[#C5D8C0] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#C5D8C0] animate-bounce" style={{ animationDelay: '200ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#C5D8C0] animate-bounce" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          </CardBody>
        </Card>
      ) : !plan ? (
        <Card>
          <CardBody>              <EmptyState
              icon="compass"
              title="No action plan yet"
              description="Generate your first plan to see concrete countermeasures based on your data."
              action={
                <Button variant="primary" onClick={() => generate()} loading={generating} leftIcon={<InkIcon name="sparkle" size={18} />}>
                  Generate plan
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* SUMMARY =================================================== */}
          <Card>
            <CardBody className="space-y-md">
              <div className="flex items-start gap-md">
                <div className="w-11 h-11 rounded-full bg-[#2C2C2C] flex items-center justify-center shrink-0 mt-1">
                  <InkIcon name="sparkle" size={20} className="text-[#F5DEB3]" />
                </div>
                <div>
                  <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878]">Your plan</p>
                  <p className="font-body-lg text-[#2C2C2C] leading-relaxed mt-1">{plan.summary}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* STRENGTHS + WATCHPOINTS ==================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {plan.strengths.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-sm">
                    <InkIcon name="check-double" size={18} className="text-[#9CAF92]" />
                    <CardTitle>Strengths</CardTitle>
                  </div>
                </CardHeader>
                <CardBody className="space-y-md">
                  {plan.strengths.map((s, i) => (
                    <AreaPill key={i} area={s.area} note={s.note} positive />
                  ))}
                </CardBody>
              </Card>
            )}
            {plan.watchpoints.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-sm">
                    <InkIcon name="search" size={18} className="text-[#C5D8C0]" />
                    <CardTitle>Watchpoints</CardTitle>
                  </div>
                </CardHeader>
                <CardBody className="space-y-md">
                  {plan.watchpoints.map((w, i) => (
                    <AreaPill key={i} area={w.area} note={w.note} />
                  ))}
                </CardBody>
              </Card>
            )}
          </div>

          {/* COUNTERMEASURES ============================================ */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-sm">
                <InkIcon name="compass" size={18} className="text-[#C5D8C0]" />
                <CardTitle>Countermeasures</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="space-y-md">
              <p className="font-body-md text-[#5C5850]">
                These actions are grounded in your data. Pick one to start — small is better than ambitious.
              </p>
              {plan.countermeasures.map((cm, i) => {
                const tint = AREA_TINTS[cm.area] ?? AREA_TINTS.rhythm!;
                const icon = AREA_ICONS[cm.area] ?? 'compass';
                return (
                  <div
                    key={i}
                    className="paper-card p-lg flex gap-md items-start hover-wobble"
                    style={{ borderColor: tint.border }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: tint.bg }}
                    >
                      <InkIcon name={icon as any} size={18} style={{ color: tint.ink }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878] text-[10px]">
                        {cm.area}
                      </p>
                      <p className="font-body-md text-[#2C2C2C] leading-relaxed mt-1">{cm.action}</p>
                      <p className="font-hand text-[14px] text-[#5C5850] italic mt-1">{cm.reason}</p>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </>
      )}

      <p className="font-hand text-[14px] text-[#8C8878] text-center italic">
        These countermeasures are not clinical advice. They are patterns from your own data. Trust yourself first.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wellness breakdown — component bars                                */
/* ------------------------------------------------------------------ */

function WellnessBreakdown({ wellness }: { wellness: { score: number; components: Record<string, number> } }) {
  if (wellness.score === 0) return null;
  const label = wellness.score >= 75 ? 'Flourishing' : wellness.score >= 55 ? 'Steady' : 'Tender';
  const color = wellness.score >= 75 ? '#9CAF92' : wellness.score >= 55 ? '#C5D8C0' : '#D4786E';
  const tint = wellness.score >= 75 ? '#E5EDE2' : wellness.score >= 55 ? '#C5D8C0' : '#F5E8E5';

  const components: { key: string; label: string; pct: number; icon: string }[] = [
    { key: 'sleep',   label: 'Sleep',   pct: wellness.components.sleep   ?? 0, icon: 'moon'    },
    { key: 'stress',  label: 'Stress',  pct: wellness.components.stress  ?? 0, icon: 'cloud'   },
    { key: 'mood',    label: 'Mood',    pct: wellness.components.mood    ?? 0, icon: 'sparkle' },
    { key: 'energy',  label: 'Energy',  pct: wellness.components.energy  ?? 0, icon: 'bolt'    },
    { key: 'social',  label: 'Social',  pct: wellness.components.social  ?? 0, icon: 'people'  },
    { key: 'outdoor', label: 'Outdoor', pct: wellness.components.outdoor ?? 0, icon: 'tree'    },
    { key: 'journal', label: 'Journal', pct: wellness.components.journal ?? 0, icon: 'book'    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-md">
          <div>
            <CardTitle>Wellness compass</CardTitle>
            <p className="font-hand text-[15px] text-[#5C5850] italic mt-1">
              A weighted snapshot of the last 7 days.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p
              className="text-[44px] leading-none"
              style={{ fontFamily: 'var(--font-changa-one), Changa One, serif', color }}
            >
              {Math.round(wellness.score)}
            </p>
            <p className="font-hand text-[16px]" style={{ color }}>{label}</p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-sm">
        {components.map((c) => (
          <div key={c.key} className="flex items-center gap-md">
            <div className="flex items-center gap-sm w-28 shrink-0">
              <InkIcon name={c.icon as any} size={16} className="text-[#8C8878]" />
              <span className="font-label-sm text-[#5C5850] uppercase tracking-wider text-[11px]">
                {c.label}
              </span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-[#C5D8C0] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(0, Math.min(100, c.pct))}%`, backgroundColor: color }}
              />
            </div>
            <span
              className="font-label-sm text-[#5C5850] w-10 text-right shrink-0"
              style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
            >
              {Math.round(c.pct)}%
            </span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Area pill — strength or watchpoint                                 */
/* ------------------------------------------------------------------ */

function AreaPill({ area, note, positive }: { area: string; note: string; positive?: boolean }) {
  const tint = AREA_TINTS[area] ?? AREA_TINTS.rhythm!;
  const icon = AREA_ICONS[area] ?? 'compass';
  return (
    <div
      className="flex items-start gap-md py-sm"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: tint.bg }}
      >
        <InkIcon name={icon as any} size={16} style={{ color: tint.ink }} />
      </div>
      <div>
        <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878] text-[10px]">{area}</p>
        <p className="font-body-md text-[#2C2C2C]">{note}</p>
      </div>
    </div>
  );
}
