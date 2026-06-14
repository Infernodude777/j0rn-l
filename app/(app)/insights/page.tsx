'use client';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner, Spinner } from '@/components/ui/loading';
import { InkIcon } from '@/components/ui/ink-icon';
import { useInsights } from '@/hooks/use-insights';

export default function InsightsPage() {
  const { data, loading, generating, error, generate, ai_powered, ai_reason } = useInsights();

  return (
    <div className="space-y-lg pt-md">
      <header className="flex items-end justify-between gap-md">
        <div>
          <p className="font-hand text-[18px] text-[#8C8878] italic">weekly reflections from your pages</p>
          <h1
            className="text-[36px] leading-none text-[#2C2C2C]"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            Insights
          </h1>
        </div>
        <Button
          variant="primary"
          onClick={() => generate()}
          loading={generating}
          leftIcon={<InkIcon name="sparkle" size={18} />}
        >
          Generate
        </Button>
      </header>

      {!ai_powered && (
        <div className="text-xs font-label-sm text-[#5C5850] bg-[#C5D8C0]/60 border border-[#D0C5AA] rounded-md px-md py-sm">
          {ai_reason === 'no_key'
            ? (<span>No <code>BLACKBOX_API_KEY</code> configured. Add it to your <code>.env.local</code> to enable AI-powered reflections. Reflections are falling back to the local generator for now.</span>)
            : (<span>Blackbox is not reachable from the server right now, so reflections are falling back to the local generator. The server will retry automatically in a few minutes.</span>)
          }
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {generating && data.length === 0 ? (
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
                  Sifting through your week…
                </h3>
                <p className="font-body-md text-[#5C5850] max-w-sm mx-auto">
                  Reviewing your check-ins, journal entries, and patterns to write a reflection that sounds like your week.
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
      ) : data.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="sparkle"
              title="No insights yet"
              description="Generate your first weekly reflection to see patterns in your data."
              action={
                <Button variant="primary" onClick={() => generate()} loading={generating} leftIcon={<InkIcon name="sparkle" size={18} />}>
                  Generate insight
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        data.map((insight) => (
          <Card key={insight.id}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Week of {new Date(insight.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</CardTitle>
                <span className="font-hand text-[15px] text-[#5C5850]">– {new Date(insight.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            </CardHeader>
            <CardBody className="space-y-lg">
              <p className="font-body-lg text-[#2C2C2C] leading-relaxed">{insight.summary}</p>

              {insight.patterns.length > 0 && <Section title="Patterns" items={insight.patterns} icon="wave" />}
              {insight.contributing_factors.length > 0 && <Section title="Possible contributing factors" items={insight.contributing_factors} icon="cloud" />}
              {insight.reflection_questions.length > 0 && <Section title="Reflection questions" items={insight.reflection_questions} icon="sparkle" />}
              {insight.suggestions.length > 0 && <Section title="Gentle suggestions" items={insight.suggestions} icon="leaf" />}

              <p className="font-hand text-[14px] text-[#8C8878] italic border-t border-[#D0C5AA]/40 pt-md">
                These reflections are not a diagnosis. They are patterns from your own data. If something feels off, talk to someone you trust.
              </p>
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}

function Section({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  return (
    <div>
      <div className="flex items-center gap-sm mb-xs">
        <InkIcon name={icon as any} size={18} className="text-[#C5D8C0]" />
        <h3
          className="font-label-md text-[#5C5850] uppercase tracking-wider text-[12px]"
        >
          {title}
        </h3>
      </div>
      <ul className="space-y-xs list-disc pl-lg marker:text-[#D0C5AA]">
        {items.map((item, i) => (
          <li key={i} className="font-body-md text-[#2C2C2C]">{item}</li>
        ))}
      </ul>
    </div>
  );
}
