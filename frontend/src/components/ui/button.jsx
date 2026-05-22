import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(109,94,245,0.35)] hover:shadow-[0_0_30px_rgba(109,94,245,0.55)] hover:bg-primary/90 active:scale-[0.97]',
        secondary:
          'bg-white/[0.06] text-foreground border border-white/[0.08] hover:bg-white/[0.10] hover:border-white/[0.14] active:scale-[0.97]',
        ghost:
          'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
        outline:
          'border border-white/[0.10] bg-transparent text-foreground hover:bg-white/[0.05] hover:border-white/[0.18] active:scale-[0.97]',
        destructive:
          'bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 hover:text-red-300 active:scale-[0.97]',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none',
        glass:
          'glass text-foreground hover:bg-white/[0.07] active:scale-[0.97]',
        cyan:
          'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/25 active:scale-[0.97]',
      },
      size: {
        xs:       'h-7 px-2.5 text-xs rounded-md gap-1',
        sm:       'h-8 px-3 text-sm',
        md:       'h-9 px-4',
        lg:       'h-10 px-5 text-base',
        xl:       'h-11 px-6 text-base',
        icon:     'h-9 w-9 p-0',
        'icon-sm':'h-7 w-7 p-0 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
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
