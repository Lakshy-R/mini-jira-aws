import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogPortal({ children }) {
  return <RadixDialog.Portal>{children}</RadixDialog.Portal>;
}

export function DialogOverlay({ className, ...props }) {
  return (
    <RadixDialog.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
        'data-[state=open]:animate-fade-in',
        className
      )}
      {...props}
    />
  );
}

export function DialogContent({ className, children, onClose, hideClose = false, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-lg glass-card rounded-2xl',
          'shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.06)]',
          'focus:outline-none',
          'data-[state=open]:animate-scale-in',
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <RadixDialog.Close
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={15} />
            <span className="sr-only">Close</span>
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, children }) {
  return (
    <div className={cn('px-6 py-4 border-b border-white/[0.06]', className)}>
      {children}
    </div>
  );
}

export function DialogBody({ className, children }) {
  return (
    <div className={cn('px-6 py-5', className)}>
      {children}
    </div>
  );
}

export function DialogFooter({ className, children }) {
  return (
    <div className={cn('px-6 py-4 border-t border-white/[0.06] flex items-center gap-3', className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ className, children }) {
  return (
    <RadixDialog.Title
      className={cn('text-base font-semibold text-foreground', className)}
    >
      {children}
    </RadixDialog.Title>
  );
}

export function DialogDescription({ className, children }) {
  return (
    <RadixDialog.Description
      className={cn('text-sm text-muted-foreground mt-0.5', className)}
    >
      {children}
    </RadixDialog.Description>
  );
}
