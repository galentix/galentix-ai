import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import SourcesPanel from './SourcesPanel';

export default function ChatContainer() {
  const { 
    messages, 
    isStreaming, 
    streamingContent, 
    currentSources, 
    currentWebResults,
    error 
  } = useChatStore();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !isStreaming ? (
            <WelcomeScreen />
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

        {/* Error display */}
        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Input */}
        <ChatInput />
      </div>

      {/* Sources panel (when available) */}
      {(currentSources.length > 0 || currentWebResults.length > 0) && (
        <SourcesPanel sources={currentSources} webResults={currentWebResults} />
      )}
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-galentix-300 flex items-center justify-center mb-6">
        <svg viewBox="0 0 24 24" className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a9 9 0 0 1 9 9c0 3.6-2.4 6.6-5.5 8.1-.3.1-.5.4-.5.7V22h-6v-2.2c0-.3-.2-.6-.5-.7C5.4 17.6 3 14.6 3 11a9 9 0 0 1 9-9z" />
          <circle cx="12" cy="11" r="3" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold mb-2">Welcome to Galentix AI</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
        Your local AI assistant. Ask me anything - I run entirely on this device, 
        keeping your data private and secure.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
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
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-4 rounded-xl bg-gray-100 dark:bg-slate-800 text-left">
      <span className="text-2xl mb-2 block">{icon}</span>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}
