import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('material-symbols-outlined animate-spin text-primary', className)}
      style={{ fontSize: 20 }}
      aria-label="Loading"
    >
      progress_activity
    </span>
  );
}

export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-md bg-background">
      <Spinner className="text-primary" />
      <p className="font-label-sm text-secondary">{label}</p>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-error-container text-on-error-container border border-error/30 rounded-md px-md py-sm flex items-center justify-between gap-md">
      <div className="flex items-center gap-sm">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
        <span className="font-body-md">{message}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="font-label-md text-on-error-container underline">
          Retry
        </button>
      )}
    </div>
  );
}
