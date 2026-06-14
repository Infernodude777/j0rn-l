import { cn } from '@/lib/utils';
import type { HTMLAttributes, ReactNode } from 'react';

export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn('paper-card relative', className)}
      {...rest}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-lg pt-lg pb-md', className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-lg pb-lg', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={cn('text-[20px] leading-tight text-[#2C2C2C]', className)}
      style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
    >
      {children}
    </h3>
  );
}
