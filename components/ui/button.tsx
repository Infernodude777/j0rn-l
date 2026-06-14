import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'full';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// Backgrounds only — text color is applied via inline style below so it is
// guaranteed to be readable on every dark variant.
const variants: Record<Variant, string> = {
  primary:   'bg-[#FBF2E0] border border-[#D0C5AA] hover:bg-[#F0E6CC]',
  secondary: 'bg-[#5C5850] border border-[#5C5850] hover:opacity-90',
  outline:   'bg-[#F5DEB3] border border-[#D0C5AA] hover:bg-[#C5D8C0]',
  ghost:     'bg-transparent border border-transparent hover:bg-[#C5D8C0]/60',
  danger:    'bg-[#D4786E] border border-[#D4786E] hover:opacity-90',
};

const textColors: Record<Variant, string> = {
  primary:   '#2C2C2C',
  secondary: '#FFFFFF',
  outline:   '#2C2C2C',
  ghost:     '#2C2C2C',
  danger:    '#ffffff',
};

const sizes: Record<Size, string> = {
  sm:   'h-9  px-md text-sm    rounded-md',
  md:   'h-11 px-lg text-button rounded-md',
  lg:   'h-14 px-xl text-button rounded-lg',
  full: 'w-full h-14 px-xl text-button rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const textColor = textColors[variant];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-md font-button transition-all',
        'active:scale-[0.98] disabled:cursor-not-allowed',
        'disabled:bg-[#F0E6CC] disabled:text-[#8C8878] disabled:border-[#D0C5AA]',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 20, color: textColor }}>progress_activity</span>
      ) : leftIcon ? (
        <span style={{ color: textColor, display: 'inline-flex' }}>{leftIcon}</span>
      ) : null}
      <span style={{ color: textColor, fontWeight: 700 }}>{children}</span>
      {rightIcon ? (
        <span style={{ color: textColor, display: 'inline-flex' }}>{rightIcon}</span>
      ) : null}
    </button>
  );
}
