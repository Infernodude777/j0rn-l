import { cn } from '@/lib/utils';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

export function FieldLabel({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-xs">
      <label htmlFor={htmlFor} className="font-label-sm text-[#5C5850] block">
        {children}
      </label>
      {hint && <span className="font-label-sm text-[#8C8878] opacity-70">{hint}</span>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        'w-full bg-[#F0E6CC] border border-[#D0C5AA] rounded-[10px] px-md py-sm font-body-md text-[#2C2C2C] placeholder:text-[#8C8878]/60',
        className,
      )}
    />
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(
        'w-full bg-[#F0E6CC] border border-[#D0C5AA] rounded-[10px] px-md py-sm font-body-md text-[#2C2C2C] placeholder:text-[#8C8878]/60 resize-y min-h-[120px]',
        className,
      )}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={cn(
          'w-full bg-[#F0E6CC] border border-[#D0C5AA] rounded-[10px] px-md py-sm font-body-md text-[#2C2C2C] appearance-none pr-10',
          className,
        )}
      >
        {children}
      </select>
      <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-[#5C5850]" style={{ fontSize: 18 }}>expand_more</span>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="mt-xs font-label-sm text-error">{children}</p>;
}
