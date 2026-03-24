type LogoSize = 'sm' | 'md' | 'lg';

interface GalentixLogoProps {
  /** Preset size of the logo container. */
  size?: LogoSize;
  className?: string;
}

const containerStyles: Record<LogoSize, string> = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-20 h-20 rounded-2xl',
};

const svgStyles: Record<LogoSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-12 h-12',
};

export default function GalentixLogo({
  size = 'md',
  className = '',
}: GalentixLogoProps) {
  return (
    <div
      className={[
        'bg-galentix-500 flex items-center justify-center',
        containerStyles[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className={`text-white ${svgStyles[size]}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2a9 9 0 0 1 9 9c0 3.6-2.4 6.6-5.5 8.1-.3.1-.5.4-.5.7V22h-6v-2.2c0-.3-.2-.6-.5-.7C5.4 17.6 3 14.6 3 11a9 9 0 0 1 9-9z" />
        <circle cx="12" cy="11" r="3" />
      </svg>
    </div>
  );
}
