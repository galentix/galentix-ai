import { useCallback } from 'react';
import {
  X,
  FileText,
  Search,
  Mail,
  Calendar,
  Languages,
  GitCompare,
  Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { promptTemplates, templateCategories } from '../../data/promptTemplates';
import type { PromptTemplate } from '../../data/promptTemplates';

// Map icon name strings to actual lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Search,
  Mail,
  Calendar,
  Languages,
  GitCompare,
  Globe,
};

interface PromptTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (prompt: string, options: { useRag?: boolean; useWebSearch?: boolean; fillOnly?: boolean }) => void;
}

export default function PromptTemplates({ open, onClose, onSelectTemplate }: PromptTemplatesProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const handleSelect = useCallback(
    (template: PromptTemplate) => {
      const promptText = isArabic ? template.promptAr : template.prompt;
      const needsCompletion = promptText.endsWith(': ');

      onSelectTemplate(promptText, {
        useRag: template.useRag,
        useWebSearch: template.useWebSearch,
        fillOnly: needsCompletion,
      });
      onClose();
    },
    [isArabic, onSelectTemplate, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col mx-0 sm:mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">{t('templates.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-6">
          {templateCategories.map((category) => {
            const templates = promptTemplates.filter((tpl) => tpl.category === category);
            if (templates.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {t(`templates.category_${category}`)}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((template) => {
                    const IconComponent = iconMap[template.icon];
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleSelect(template)}
                        className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 hover:border-galentix-500 hover:bg-galentix-50 dark:hover:bg-galentix-900/20 transition-colors text-start"
                      >
                        <div className="w-9 h-9 rounded-full bg-galentix-500/15 text-galentix-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {IconComponent && <IconComponent className="w-4.5 h-4.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{t(template.titleKey)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {t(template.descriptionKey)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
