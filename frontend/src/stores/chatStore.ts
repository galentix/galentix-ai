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
  
  // Chat options
  useRag: boolean;
  useWebSearch: boolean;
  
  // Actions
  setUseRag: (value: boolean) => void;
  setUseWebSearch: (value: boolean) => void;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string | null) => Promise<void>;
  createConversation: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
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
  
  sendMessage: async (content) => {
    const { currentConversation, useRag, useWebSearch, messages } = get();
    
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
      error: null
    }));
    
    try {
      let conversationId = currentConversation?.id;
      let fullContent = '';
      let sources: Source[] = [];
      let webResults: WebSearchResult[] = [];
      
      // Stream the response
      for await (const chunk of api.streamChat({
        message: content,
        conversation_id: conversationId,
        use_rag: useRag,
        use_web_search: useWebSearch,
        stream: true
      })) {
        if (chunk.type === 'meta') {
          sources = chunk.sources || [];
          webResults = chunk.web_results || [];
          set({ currentSources: sources, currentWebResults: webResults });
        } else if (chunk.type === 'token') {
          fullContent += chunk.content || '';
          set({ streamingContent: fullContent });
        } else if (chunk.type === 'done') {
          conversationId = chunk.conversation_id;
        } else if (chunk.type === 'error') {
          throw new Error(chunk.content || 'Stream error');
        }
      }
      
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
        streamingContent: ''
      }));
      
      // Update conversation if new
      if (!currentConversation && conversationId) {
        const conversations = await api.getConversations();
        const newConversation = conversations.find((c) => c.id === conversationId);
        set({ conversations, currentConversation: newConversation || null });
      }
      
    } catch (err) {
      set({
        error: (err as Error).message,
        isStreaming: false,
        streamingContent: ''
      });
    }
  },
  
  clearError: () => set({ error: null })
}));
