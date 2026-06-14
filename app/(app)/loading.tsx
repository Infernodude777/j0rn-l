/**
 * Route-level loading state for the (app) route group. Next.js renders this
 * instantly during navigation (before the page's data hooks resolve), so the
 * user sees a skeleton immediately instead of a blank screen or the blocking
 * full-screen spinner that the layout used to show.
 */
export default function AppLoading() {
  return (
    <div className="space-y-md pt-md md:pt-lg" aria-busy aria-live="polite">
      {/* Hero skeleton */}
      <div className="paper-card p-lg animate-pulse">
        <div className="h-3 w-32 rounded bg-[#E0D5BA] mb-3" />
        <div className="h-8 w-64 rounded bg-[#E0D5BA]/80 mb-2" />
        <div className="h-4 w-80 max-w-full rounded bg-[#E0D5BA]/60" />
      </div>
      {/* Metric tile skeletons */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-md">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="paper-card p-md min-h-[130px] animate-pulse">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-[#E0D5BA]/70" />
              <div className="h-3 w-12 rounded bg-[#E0D5BA]/60" />
            </div>
            <div className="mt-3 h-6 w-20 rounded bg-[#E0D5BA]/80" />
            <div className="mt-2 h-3 w-28 rounded bg-[#E0D5BA]/50" />
            <div className="mt-3 flex gap-1">
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="h-[5px] flex-1 rounded-full bg-[#E0D5BA]/40" />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Narrative + whisper skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-md">
        <div className="paper-card p-lg min-h-[260px] animate-pulse">
          <div className="h-5 w-40 rounded bg-[#E0D5BA]/80 mb-3" />
          <div className="h-3 w-56 rounded bg-[#E0D5BA]/50 mb-2" />
          <div className="h-32 rounded bg-[#E0D5BA]/40 mt-md" />
        </div>
        <div className="paper-card-warm p-lg min-h-[260px] animate-pulse">
          <div className="h-5 w-36 rounded bg-[#E0D5BA]/80 mb-3" />
          <div className="h-3 w-48 rounded bg-[#E0D5BA]/50 mb-2" />
          <div className="h-3 w-40 rounded bg-[#E0D5BA]/50 mb-2" />
          <div className="h-3 w-32 rounded bg-[#E0D5BA]/50" />
        </div>
      </div>
    </div>
  );
}
