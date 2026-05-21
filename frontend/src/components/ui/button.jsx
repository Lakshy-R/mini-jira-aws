import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        default:   'bg-primary text-primary-foreground hover:bg-indigo-700 shadow-sm active:scale-[0.98]',
        secondary: 'bg-muted text-foreground hover:bg-gray-200 border border-border active:scale-[0.98]',
        ghost:     'text-muted-foreground hover:bg-muted hover:text-foreground',
        outline:   'border border-border bg-card text-foreground hover:bg-muted active:scale-[0.98]',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-red-600 shadow-sm active:scale-[0.98]',
        link:      'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        xs:   'h-7 px-2.5 text-xs rounded-md gap-1',
        sm:   'h-8 px-3 text-sm',
        md:   'h-9 px-4',
        lg:   'h-10 px-5 text-base',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-7 w-7 p-0 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants };
