import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default:    'bg-primary/15 text-primary ring-primary/25',
        secondary:  'bg-white/[0.06] text-muted-foreground ring-white/[0.08]',
        outline:    'bg-transparent text-foreground ring-white/[0.10]',
        success:    'bg-emerald-500/12 text-emerald-400 ring-emerald-500/20',
        warning:    'bg-amber-500/12 text-amber-400 ring-amber-500/20',
        destructive:'bg-red-500/12 text-red-400 ring-red-500/20',
        info:       'bg-blue-500/12 text-blue-400 ring-blue-500/20',
        purple:     'bg-violet-500/12 text-violet-400 ring-violet-500/20',
        cyan:       'bg-cyan-500/12 text-cyan-400 ring-cyan-500/20',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export function Badge({ className, variant, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}
