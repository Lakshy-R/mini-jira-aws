import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-foreground',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/40',
      'hover:border-white/[0.14] hover:bg-white/[0.06]',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'transition-all duration-200',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground',
      'placeholder:text-muted-foreground resize-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/40',
      'hover:border-white/[0.14] hover:bg-white/[0.06]',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'transition-all duration-200',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-lg border border-white/[0.08] bg-card px-3 py-1 text-sm text-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/40',
      'hover:border-white/[0.14]',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'transition-all duration-200 cursor-pointer',
      '[&>option]:bg-card [&>option]:text-foreground',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export function Label({ className, children, ...props }) {
  return (
    <label
      className={cn(
        'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5',
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function FormField({ label, required, children, className }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
      )}
      {children}
    </div>
  );
}
