import { useState } from 'react'
import { Search, FileText } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { PromptInput, PromptInputActions, PromptInputAction } from '../prompt-kit'

export default function ChatInput() {
  const [input, setInput] = useState('')
  const { 
    sendMessage, 
    isStreaming, 
    useRag, 
    useWebSearch, 
    setUseRag, 
    setUseWebSearch 
  } = useChatStore()

  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return
    const message = input.trim()
    setInput('')
    await sendMessage(message)
  }

  return (
    <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={useRag}
            onChange={(e) => setUseRag(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-galentix-300 focus:ring-galentix-300 focus:ring-offset-2"
            id="use-rag"
          />
          <FileText className="w-4 h-4 text-gray-400 group-hover:text-galentix-300 transition-colors" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Use Documents</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={useWebSearch}
            onChange={(e) => setUseWebSearch(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-galentix-300 focus:ring-galentix-300 focus:ring-offset-2"
            id="use-search"
          />
          <Search className="w-4 h-4 text-gray-400 group-hover:text-galentix-300 transition-colors" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Web Search</span>
        </label>
      </div>

      <PromptInput
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isStreaming}
        placeholder="Ask anything..."
        disabled={isStreaming}
      >
        <PromptInputActions>
          <PromptInputAction disabled={isStreaming}>
            <span className="text-xs text-muted-foreground">Enter to send, Shift+Enter for new line</span>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  )
}
