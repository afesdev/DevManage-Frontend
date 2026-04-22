import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';

const STYLE = {
  ok: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  error: {
    box: 'border-red-200 bg-red-50 text-red-800',
    icon: AlertCircle,
  },
  info: {
    box: 'border-sky-200 bg-sky-50 text-sky-800',
    icon: Info,
  },
} as const;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        removeToast(toast.id);
      }, 3500),
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [toasts, removeToast]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = STYLE[toast.type].icon;
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 shadow-lg',
              STYLE[toast.type].box,
            )}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1 text-[12px] font-medium">{toast.message}</p>
            <button
              type="button"
              className="rounded p-0.5 opacity-70 transition hover:bg-black/5 hover:opacity-100"
              onClick={() => removeToast(toast.id)}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
