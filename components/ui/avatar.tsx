import { cn, initials } from '@/lib/utils';

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const dim = `${size}px`;
  return (
    <div
      className={cn(
        'rounded-full overflow-hidden border border-outline bg-surface-container-high flex items-center justify-center text-primary font-label-md shrink-0',
        className,
      )}
      style={{ width: dim, height: dim, fontSize: size * 0.4 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
