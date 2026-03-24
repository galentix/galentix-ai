import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Optional title rendered in the card header. */
  title?: string;
  /** Optional icon rendered beside the title (a React element, e.g. a lucide-react icon). */
  icon?: ReactNode;
}

export default function Card({
  children,
  className = '',
  title,
  icon,
}: CardProps) {
  return (
    <div
      className={[
        'bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {title && (
        <div className="flex items-center gap-3 mb-4">
          {icon && (
            <span className="flex-shrink-0 text-galentix-500">{icon}</span>
          )}
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}

      {children}
    </div>
  );
}
