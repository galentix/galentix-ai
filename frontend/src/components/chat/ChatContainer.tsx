import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { FileText, Search, Lock, X, Loader2, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chatStore';
import * as api from '../../services/api';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import SourcesPanel from './SourcesPanel';
import GalentixLogo from '../ui/GalentixLogo';

export default function ChatContainer() {
  const { t } = useTranslation();
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const currentSources = useChatStore((s) => s.currentSources);
  const currentWebResults = useChatStore((s) => s.currentWebResults);
  const error = useChatStore((s) => s.error);
  const clearError = useChatStore((s) => s.clearError);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [llmReady, setLlmReady] = useState(true); // optimistic until first check
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const healthAbortRef = useRef<AbortController | null>(null);

  // Poll LLM health on mount; stop once healthy
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const checkHealth = async () => {
      // Abort previous in-flight health check
      if (healthAbortRef.current) {
        healthAbortRef.current.abort();
      }
      const controller = new AbortController();
      healthAbortRef.current = controller;

      try {
        const health = await api.getHealth(controller.signal);
        const isHealthy = health.llm_status === 'healthy' || health.llm_status === 'online';
        if (!cancelled) {
          setLlmReady(isHealthy);
          if (isHealthy && interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch {
        if (!cancelled) setLlmReady(false);
      }
    };

    checkHealth();
    interval = setInterval(checkHealth, 5000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (healthAbortRef.current) healthAbortRef.current.abort();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleStarterPrompt = useCallback(
    (prompt: string) => {
      if (!isStreaming) sendMessage(prompt);
    },
    [isStreaming, sendMessage],
  );

  const hasSources = currentSources.length > 0 || currentWebResults.length > 0;

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* LLM readiness banner */}
        {!llmReady && (
          <div
            className="mx-4 mt-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2"
            role="status"
          >
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            <span>{t('system.modelLoading')}</span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !isStreaming ? (
            <WelcomeScreen onStarterPrompt={handleStarterPrompt} />
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
          <div className="mx-4 mb-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-center justify-between" role="alert">
            <span>{error}</span>
            <button
              onClick={clearError}
              aria-label="Dismiss error"
              className="p-1 hover:bg-red-200 dark:hover:bg-red-800/50 rounded transition-colors flex-shrink-0 ms-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Mobile: sources panel renders as bottom sheet within the column */}
        {hasSources && (
          <div className="md:hidden">
            <SourcesPanel sources={currentSources} webResults={currentWebResults} />
          </div>
        )}

        {/* Input */}
        <ChatInput disabled={!llmReady} />
      </div>

      {/* Desktop: sources panel renders as side panel */}
      {hasSources && (
        <div className="hidden md:flex">
          <SourcesPanel sources={currentSources} webResults={currentWebResults} />
        </div>
      )}
    </div>
  );
}

function WelcomeScreen({ onStarterPrompt }: { onStarterPrompt: (prompt: string) => void }) {
  const { t } = useTranslation();

  const starterPrompts = [
    t('welcome.starter1'),
    t('welcome.starter2'),
    t('welcome.starter3'),
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="mb-6">
        <GalentixLogo size="lg" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">{t('welcome.title')}</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
        {t('welcome.subtitle')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
        <FeatureCard
          icon={<FileText className="w-5 h-5" />}
          title={t('welcome.feature1Title')}
          description={t('welcome.feature1Desc')}
        />
        <FeatureCard
          icon={<Search className="w-5 h-5" />}
          title={t('welcome.feature2Title')}
          description={t('welcome.feature2Desc')}
        />
        <FeatureCard
          icon={<Lock className="w-5 h-5" />}
          title={t('welcome.feature3Title')}
          description={t('welcome.feature3Desc')}
        />
      </div>

      {/* Starter prompts */}
      <div className="mt-8 flex flex-wrap justify-center gap-3 max-w-2xl">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onStarterPrompt(prompt)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-700 dark:text-gray-200 hover:border-galentix-500 hover:text-galentix-600 dark:hover:text-galentix-400 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="p-4 rounded-xl bg-gray-100 dark:bg-slate-800 text-start">
      <div className="w-9 h-9 rounded-full bg-galentix-500/15 text-galentix-500 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}
