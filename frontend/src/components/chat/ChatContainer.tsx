import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../../stores/chatStore'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import SourcesPanel from './SourcesPanel'
import { ScrollButton, PromptSuggestionList } from '../prompt-kit'

export default function ChatContainer() {
  const { 
    messages, 
    isStreaming, 
    streamingContent, 
    currentSources, 
    currentWebResults,
    error 
  } = useChatStore()
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const suggestions = [
    "What can you help me with?",
    "Summarize the uploaded documents",
    "Search the web for recent news"
  ]

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <div 
          className="flex-1 overflow-y-auto p-4 md:p-6"
          ref={containerRef}
          onScroll={handleScroll}
        >
          {messages.length === 0 && !isStreaming ? (
            <WelcomeScreen suggestions={suggestions} />
          ) : (
            <>
              <MessageList 
                messages={messages} 
                streamingContent={isStreaming ? streamingContent : undefined}
              />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm animate-slide-up" role="alert">
            {error}
          </div>
        )}

        <ChatInput />

        <ScrollButton onClick={scrollToBottom} isVisible={showScrollButton} />
      </div>

      {(currentSources.length > 0 || currentWebResults.length > 0) && (
        <SourcesPanel sources={currentSources} webResults={currentWebResults} />
      )}
    </div>
  )
}

function WelcomeScreen({ suggestions }: { suggestions: string[] }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-galentix-300 to-galentix-500 flex items-center justify-center mb-6 shadow-xl shadow-galentix-300/30 animate-float">
        <svg viewBox="0 0 24 24" className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a9 9 0 0 1 9 9c0 3.6-2.4 6.6-5.5 8.1-.3.1-.5.4-.5.7V22h-6v-2.2c0-.3-.2-.6-.5-.7C5.4 17.6 3 14.6 3 11a9 9 0 0 1 9-9z" />
          <circle cx="12" cy="11" r="3" />
        </svg>
      </div>
      <h2 className="text-2xl md:text-3xl font-semibold mb-2 animate-slide-up">Welcome to Galentix AI</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8 animate-slide-up stagger-1">
        Your local AI assistant. Ask me anything - I run entirely on this device, 
        keeping your data private and secure.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl w-full mb-8">
        <FeatureCard
          icon="📄"
          title="Document Q&A"
          description="Upload documents and ask questions about them"
        />
        <FeatureCard
          icon="🔍"
          title="Web Search"
          description="Search the web for current information"
        />
        <FeatureCard
          icon="🔒"
          title="100% Private"
          description="Your data never leaves this device"
        />
      </div>

      <div className="animate-slide-up stagger-5">
        <p className="text-sm text-muted-foreground mb-3">Try asking:</p>
        <PromptSuggestionList 
          suggestions={suggestions}
          onSelect={(suggestion) => {
            const input = document.querySelector('textarea') as HTMLTextAreaElement
            if (input) {
              input.value = suggestion
              input.dispatchEvent(new Event('input', { bubbles: true }))
            }
          }}
        />
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-left hover:shadow-lg hover:shadow-galentix-300/10 transition-all duration-300 hover:-translate-y-1 animate-slide-up">
      <span className="text-2xl mb-2 block">{icon}</span>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  )
}
