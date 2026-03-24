import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToastStore, type Toast as ToastData, type ToastType } from '../../stores/toastStore';

const iconMap: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success:
    'bg-white dark:bg-slate-800 border-green-400 dark:border-green-600 text-green-800 dark:text-green-200',
  error:
    'bg-white dark:bg-slate-800 border-red-400 dark:border-red-600 text-red-800 dark:text-red-200',
  info:
    'bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200',
};

const iconColorMap: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
};

function ToastItem({ toast }: { toast: ToastData }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [visible, setVisible] = useState(false);

  const Icon = iconMap[toast.type];

  useEffect(() => {
    // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    // Wait for exit animation before removing from store
    setTimeout(() => removeToast(toast.id), 200);
  };

  return (
    <div
      className={[
        'flex items-start gap-3 w-80 p-4 rounded-xl border shadow-lg transition-all duration-200',
        colorMap[toast.type],
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2',
      ].join(' ')}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColorMap[toast.type]}`} />
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 end-4 z-50 flex flex-col-reverse gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
