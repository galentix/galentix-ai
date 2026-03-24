import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type Language } from '../../stores/settingsStore';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const { language, setLanguage } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (code: Language) => {
    setLanguage(code);
    i18n.changeLanguage(code);
    setOpen(false);
  };

  const currentLabel = LANGUAGES.find((l) => l.code === language)?.label ?? 'English';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        className="flex items-center gap-1.5 px-2 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm"
        title="Change language"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline text-xs text-gray-600 dark:text-gray-300">
          {currentLabel}
        </span>
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg z-50 overflow-hidden">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full text-start px-4 py-2 text-sm transition-colors ${
                language === lang.code
                  ? 'bg-galentix-100 dark:bg-galentix-900/30 text-galentix-700 dark:text-galentix-400 font-medium'
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
