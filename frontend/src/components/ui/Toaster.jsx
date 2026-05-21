import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../../store/toast.store';
import { cn } from '../../lib/utils';

const CONFIGS = {
  success: {
    icon: CheckCircle,
    className: 'border-l-emerald-500',
    iconClass: 'text-emerald-500',
  },
  error: {
    icon: XCircle,
    className: 'border-l-red-500',
    iconClass: 'text-red-500',
  },
  info: {
    icon: Info,
    className: 'border-l-blue-500',
    iconClass: 'text-blue-500',
  },
};

function ToastItem({ toast, onRemove }) {
  const { icon: Icon, className, iconClass } = CONFIGS[toast.type] || CONFIGS.info;

  return (
    <div
      className={cn(
        'flex items-start gap-3 bg-card border border-border border-l-4 rounded-xl shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12)]',
        'px-4 py-3 w-80 animate-slide-in-right',
        className
      )}
    >
      <Icon size={16} className={cn('shrink-0 mt-0.5', iconClass)} />
      <p className="text-sm text-foreground flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5 p-0.5 rounded"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>,
    document.body
  );
}

export default Toaster;
