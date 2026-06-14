import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center py-xl px-lg gap-md', className)}>
      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center">
        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 28 }}>{icon}</span>
      </div>
      <div>
        <h3 className="font-h2 text-primary mb-xs">{title}</h3>
        {description && <p className="font-body-md text-on-surface-variant max-w-sm mx-auto">{description}</p>}
      </div>
      {action}
    </div>
  );
}
