import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Info, X, Zap } from 'lucide-react';
import { useToastStore } from '../../store/toast.store';
import { cn } from '../../lib/utils';

const CONFIGS = {
  success: {
    icon: CheckCircle2,
    bar: 'bg-emerald-500',
    iconClass: 'text-emerald-400',
    glow: 'shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.12)]',
    ring: 'ring-emerald-500/15',
  },
  error: {
    icon: XCircle,
    bar: 'bg-red-500',
    iconClass: 'text-red-400',
    glow: 'shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(239,68,68,0.12)]',
    ring: 'ring-red-500/15',
  },
  info: {
    icon: Info,
    bar: 'bg-blue-500',
    iconClass: 'text-blue-400',
    glow: 'shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(59,130,246,0.12)]',
    ring: 'ring-blue-500/15',
  },
};

function ToastItem({ toast, onRemove }) {
  const config = CONFIGS[toast.type] || CONFIGS.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 glass-card rounded-xl px-4 py-3.5 w-[340px]',
        'ring-1 ring-inset animate-toast-enter',
        config.glow,
        config.ring
      )}
    >
      <div className={cn('w-0.5 self-stretch rounded-full shrink-0 mt-0.5', config.bar)} />
      <Icon size={15} className={cn('shrink-0 mt-0.5', config.iconClass)} />
      <p className="text-sm text-foreground flex-1 leading-snug font-medium">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5 p-0.5 rounded hover:bg-white/[0.06]"
        aria-label="Dismiss notification"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>,
    document.body
  );
}

export default Toaster;
