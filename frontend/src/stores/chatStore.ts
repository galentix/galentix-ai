// Galentix AI - Chat Store (Zustand)

import { create } from 'zustand';
import type { Conversation, Message, Source, WebSearchResult } from '../types';
import * as api from '../services/api';

interface ChatState {
  // State
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  streamingContent: string;
  currentSources: Source[];
  currentWebResults: WebSearchResult[];
  abortController: AbortController | null;

  // Chat options
  useRag: boolean;
  useWebSearch: boolean;

  // Actions
  setUseRag: (value: boolean) => void;
  setUseWebSearch: (value: boolean) => void;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string | null) => Promise<void>;
  startNewConversation: () => void;
  createConversation: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  streamingContent: '',
  currentSources: [],
  currentWebResults: [],
  abortController: null,
  useRag: true,
  useWebSearch: false,

  // Actions
  setUseRag: (value) => set({ useRag: value }),
  setUseWebSearch: (value) => set({ useWebSearch: value }),
  
  loadConversations: async () => {
    try {
      set({ isLoading: true, error: null });
      const conversations = await api.getConversations();
      set({ conversations, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  
  selectConversation: async (id) => {
    if (!id) {
      set({ currentConversation: null, messages: [] });
      return;
    }
    
    try {
      set({ isLoading: true, error: null });
      const conversation = await api.getConversation(id);
      const messages = await api.getMessages(id);
      set({ currentConversation: conversation, messages, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  
  startNewConversation: () => {
    set({
      currentConversation: null,
      messages: [],
      streamingContent: '',
      currentSources: [],
      currentWebResults: [],
      error: null
    });
  },

  createConversation: async () => {
    try {
      set({ isLoading: true, error: null });
      const conversation = await api.createConversation();
      set((state) => ({
        conversations: [conversation, ...state.conversations],
        currentConversation: conversation,
        messages: [],
        isLoading: false
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  
  deleteConversation: async (id) => {
    try {
      await api.deleteConversation(id);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        currentConversation: state.currentConversation?.id === id ? null : state.currentConversation,
        messages: state.currentConversation?.id === id ? [] : state.messages
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  renameConversation: async (id, title) => {
    try {
      const updated = await api.updateConversation(id, { title });
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title: updated.title } : c
        ),
        currentConversation:
          state.currentConversation?.id === id
            ? { ...state.currentConversation, title: updated.title }
            : state.currentConversation,
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  sendMessage: async (content) => {
    const { currentConversation, useRag, useWebSearch } = get();

    const controller = new AbortController();

    // Add user message immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: currentConversation?.id || '',
      role: 'user',
      content,
      created_at: new Date().toISOString()
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isStreaming: true,
      streamingContent: '',
      currentSources: [],
      currentWebResults: [],
      error: null,
      abortController: controller
    }));

    try {
      let conversationId = currentConversation?.id;
      let fullContent = '';
      let sources: Source[] = [];
      let webResults: WebSearchResult[] = [];

      // Throttle streaming updates to ~20fps (every 50ms)
      let lastUpdateTime = 0;

      // Stream the response
      for await (const chunk of api.streamChat({
        message: content,
        conversation_id: conversationId,
        use_rag: useRag,
        use_web_search: useWebSearch,
        stream: true
      }, controller.signal)) {
        if (chunk.type === 'meta') {
          sources = chunk.sources || [];
          webResults = chunk.web_results || [];
          set({ currentSources: sources, currentWebResults: webResults });
        } else if (chunk.type === 'token') {
          fullContent += chunk.content || '';
          const now = Date.now();
          if (now - lastUpdateTime >= 50) {
            set({ streamingContent: fullContent });
            lastUpdateTime = now;
          }
        } else if (chunk.type === 'done') {
          conversationId = chunk.conversation_id;
        } else if (chunk.type === 'error') {
          throw new Error(chunk.content || 'Stream error');
        }
      }

      // Flush any remaining content after stream ends
      set({ streamingContent: fullContent });

      // Add assistant message
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        conversation_id: conversationId || '',
        role: 'assistant',
        content: fullContent,
        created_at: new Date().toISOString(),
        sources,
        skills_used: []
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isStreaming: false,
        streamingContent: '',
        abortController: null
      }));

      // Update conversation if new
      if (!currentConversation && conversationId) {
        const conversations = await api.getConversations();
        const newConversation = conversations.find((c) => c.id === conversationId);
        set({ conversations, currentConversation: newConversation || null });
      }

    } catch (err) {
      // If aborted by user, finalize the partial content as the assistant message
      if (controller.signal.aborted) {
        const partialContent = get().streamingContent;
        if (partialContent) {
          const partialMessage: Message = {
            id: `msg-${Date.now()}`,
            conversation_id: currentConversation?.id || '',
            role: 'assistant',
            content: partialContent,
            created_at: new Date().toISOString(),
            sources: [],
            skills_used: []
          };
          set((state) => ({
            messages: [...state.messages, partialMessage],
            isStreaming: false,
            streamingContent: '',
            abortController: null
          }));
        } else {
          set({ isStreaming: false, streamingContent: '', abortController: null });
        }
      } else {
        set({
          error: (err as Error).message,
          isStreaming: false,
          streamingContent: '',
          abortController: null
        });
      }
    }
  },

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
  },

  clearError: () => set({ error: null })
}));
