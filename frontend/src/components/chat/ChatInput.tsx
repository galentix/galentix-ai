import { useState, useRef, useEffect } from 'react';
import { Send, Search, FileText, Loader2 } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';

export default function ChatInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { 
    sendMessage, 
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {/* Options */}
      <div className="flex items-center gap-4 mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useRag}
            onChange={(e) => setUseRag(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-galentix-300 focus:ring-galentix-300"
          />
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Use Documents</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useWebSearch}
            onChange={(e) => setUseWebSearch(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-galentix-300 focus:ring-galentix-300"
          />
          <Search className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Web Search</span>
        </label>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={isStreaming}
            rows={1}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-galentix-300 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="p-3 rounded-xl bg-galentix-300 text-white hover:bg-galentix-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isStreaming ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>

      {/* Helper text */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
