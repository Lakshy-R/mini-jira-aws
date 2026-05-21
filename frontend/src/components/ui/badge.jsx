import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default:    'bg-primary/10 text-primary ring-primary/20',
        secondary:  'bg-muted text-muted-foreground ring-border',
        outline:    'bg-transparent text-foreground ring-border',
        success:    'bg-emerald-50 text-emerald-700 ring-emerald-200',
        warning:    'bg-amber-50 text-amber-700 ring-amber-200',
        destructive:'bg-red-50 text-red-700 ring-red-200',
        info:       'bg-blue-50 text-blue-700 ring-blue-200',
        purple:     'bg-purple-50 text-purple-700 ring-purple-200',
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
