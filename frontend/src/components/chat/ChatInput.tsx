import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Search, FileText, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chatStore';
import PromptTemplates from './PromptTemplates';

export default function ChatInput() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    sendMessage,
    stopStreaming,
    isStreaming,
    useRag,
    useWebSearch,
    setUseRag,
    setUseWebSearch
  } = useChatStore();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
    // Return focus to the textarea after sending
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSelectTemplate = useCallback(
    (prompt: string, options: { useRag?: boolean; useWebSearch?: boolean; fillOnly?: boolean }) => {
      if (options.useRag !== undefined) setUseRag(options.useRag);
      if (options.useWebSearch !== undefined) setUseWebSearch(options.useWebSearch);

      if (options.fillOnly) {
        // Prompt needs user completion -- fill input and focus
        setInput(prompt);
        setTimeout(() => textareaRef.current?.focus(), 0);
      } else {
        // Complete prompt -- send directly
        sendMessage(prompt);
      }
    },
    [setUseRag, setUseWebSearch, sendMessage],
  );

  return (
    <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {/* Options */}
      <div className="flex items-center gap-4 mb-3">
        <label className="flex items-center gap-2 cursor-pointer" title="Search your uploaded documents for relevant context">
          <input
            type="checkbox"
            checked={useRag}
            onChange={(e) => setUseRag(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-galentix-500 focus:ring-galentix-500"
          />
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">{t('chat.useDocuments')}</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer" title={t('chat.webSearchWarning')}>
          <input
            type="checkbox"
            checked={useWebSearch}
            onChange={(e) => setUseWebSearch(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-galentix-500 focus:ring-galentix-500"
          />
          <Search className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">{t('chat.webSearch')}</span>
        </label>

        <button
          type="button"
          onClick={() => setTemplatesOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm text-galentix-600 dark:text-galentix-400 hover:bg-galentix-50 dark:hover:bg-galentix-900/20 transition-colors ms-auto"
          title={t('templates.title')}
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">{t('templates.title')}</span>
        </button>
      </div>

      {/* Web Search privacy note */}
      {useWebSearch && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 ms-1">
          {t('chat.webSearchPrivacyNote')}
        </p>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            disabled={isStreaming}
            rows={1}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-galentix-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {isStreaming ? (
          <button
            type="button"
            onClick={stopStreaming}
            aria-label={t('chat.stop')}
            title={t('chat.stop')}
            className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            <Square className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label={t('chat.send')}
            className="p-3 rounded-xl bg-galentix-500 text-white hover:bg-galentix-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </form>

      {/* Helper text */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
        {t('chat.helperText')}
      </p>

      {/* Prompt templates modal */}
      <PromptTemplates
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
}
