'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useJournal } from '@/hooks/use-journal';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { FullScreenLoader, ErrorBanner } from '@/components/ui/loading';
import { InkIcon } from '@/components/ui/ink-icon';
import { cn } from '@/lib/utils';

type SortKey = 'newest' | 'oldest' | 'mood_high' | 'mood_low';

export default function JournalListPage() {
  const { data, loading, error, remove } = useJournal();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => {
    const set = new Set<string>();
    data.forEach((e) => e.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data.slice();
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) => (r.title ?? '').toLowerCase().includes(needle) || r.body.toLowerCase().includes(needle));
    }
    if (tag) rows = rows.filter((r) => r.tags.includes(tag));
    rows.sort((a, b) => {
      if (sort === 'newest') return b.created_at.localeCompare(a.created_at);
      if (sort === 'oldest') return a.created_at.localeCompare(b.created_at);
      if (sort === 'mood_high') return (b.mood ?? 0) - (a.mood ?? 0);
      return (a.mood ?? 0) - (b.mood ?? 0);
    });
    return rows;
  }, [data, q, tag, sort]);

  if (loading) return <FullScreenLoader />;

  return (
    <div className="space-y-lg pt-md">
      <header className="flex items-end justify-between gap-md">
        <div>
          <p className="font-hand text-[18px] text-[#8C8878] italic">a small, private log</p>
          <h1
            className="text-[36px] leading-none text-[#2C2C2C]"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            Journal
          </h1>
        </div>
        <Link href="/journal/compose">
          <Button variant="primary" leftIcon={<InkIcon name="feather" size={18} />}>
            Write
          </Button>
        </Link>
      </header>

      {error && <ErrorBanner message={error} />}

      <div className="space-y-md">
        <Input
          placeholder="Search the pages…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-sm overflow-x-auto no-scrollbar pb-1">
          <TagChip active={!tag} onClick={() => setTag(null)}>All</TagChip>
          {tags.map((t) => (
            <TagChip key={t} active={tag === t} onClick={() => setTag(t)}>#{t}</TagChip>
          ))}
        </div>
        <div className="flex items-center gap-sm">
          <span className="font-label-sm text-[#5C5850]">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="bg-[#F5DEB3] border border-[#D0C5AA] rounded-md px-sm py-1 text-sm text-[#2C2C2C]">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="mood_high">Mood: high → low</option>
            <option value="mood_low">Mood: low → high</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="book"
              title="The pages are still blank"
              description="Write your first entry to start noticing patterns."
              action={
                <Link href="/journal/compose">
                  <Button variant="primary" leftIcon={<InkIcon name="feather" size={18} />}>
                    Write your first entry
                  </Button>
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-md">
          {filtered.map((e) => (
            <Card key={e.id} className="hover-wobble">
              <CardBody>
                <div className="flex items-start justify-between gap-md">
                  <Link href={`/journal/${e.id}`} className="flex-1">
                    <div className="flex items-center gap-sm mb-xs">
                      <span className="font-label-sm text-[#5C5850]">
                        {new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {e.mood != null && (
                        <span className="font-hand text-[15px] text-[#C5D8C0]">· mood {e.mood}/10</span>
                      )}
                    </div>
                    {e.title && (
                      <h3
                        className="text-[20px] leading-tight text-[#2C2C2C] mb-xs"
                        style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
                      >
                        {e.title}
                      </h3>
                    )}
                    <p className="font-body-md text-[#2C2C2C]/80 line-clamp-3">{e.body}</p>
                    {e.tags.length > 0 && (
                      <div className="flex flex-wrap gap-xs mt-sm">
                        {e.tags.map((t) => (
                          <span key={t} className="font-hand text-[14px] text-[#8C8878]">#{t}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                  <button
                    onClick={() => { if (confirm('Delete this entry?')) remove(e.id); }}
                    className="text-[#8C8878] hover:text-[#C5D8C0]"
                    aria-label="Delete entry"
                  >
                    <InkIcon name="trash" size={18} />
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TagChip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 px-md py-xs rounded-full font-label-sm border transition-colors',
        active
          ? 'bg-[#2C2C2C] text-[#F5DEB3] border-[#2C2C2C]'
          : 'bg-[#F5DEB3] text-[#5C5850] border-[#D0C5AA] hover:border-[#2C2C2C]',
      )}
    >
      {children}
    </button>
  );
}
