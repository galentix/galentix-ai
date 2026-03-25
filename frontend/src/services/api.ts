// Galentix AI - API Service

import type {
  Conversation,
  Message,
  Document,
  HealthStatus,
  DeviceInfo,
  SystemStats,
  Settings,
  SettingsUpdate,
  ChatRequest,
  StreamChunk,
  WebSearchResult,
  ModelListResponse
} from '../types';
import { useAuthStore } from '../stores/authStore';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================
// Token Refresh Mutex
// ============================================

let refreshPromise: Promise<void> | null = null;

async function handleTokenRefresh(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = useAuthStore.getState().refreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  // On 401, attempt token refresh and retry once
  if (response.status === 401) {
    try {
      await handleTokenRefresh();

      // Retry the original request
      const retryResponse = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({ detail: 'Unknown error' }));
        throw new ApiError(retryResponse.status, error.detail || 'Request failed');
      }

      return retryResponse.json();
    } catch {
      // Refresh failed — redirect to login
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, error.detail || 'Request failed');
  }

  return response.json();
}

// ============================================
// Chat API
// ============================================

export async function sendMessage(request: ChatRequest, signal?: AbortSignal): Promise<Response> {
  return fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(request),
    signal,
  });
}

export async function* streamChat(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  const response = await sendMessage(request, signal);
  
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to start chat stream');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          yield data as StreamChunk;
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

// ============================================
// Conversations API
// ============================================

export async function getConversations(includeArchived = false): Promise<Conversation[]> {
  return fetchJson(`${API_BASE}/conversations/?include_archived=${includeArchived}`);
}

export async function getConversation(id: string): Promise<Conversation> {
  return fetchJson(`${API_BASE}/conversations/${id}`);
}

export async function createConversation(title?: string): Promise<Conversation> {
  return fetchJson(`${API_BASE}/conversations/`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
  return fetchJson(`${API_BASE}/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/conversations/${id}`, {
    method: 'DELETE',
  });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return fetchJson(`${API_BASE}/conversations/${conversationId}/messages`);
}

export async function exportConversation(id: string, format: string): Promise<void> {
  const response = await fetch(`${API_BASE}/conversations/${id}/export?format=${format}`, {
    credentials: 'include',
  });

  if (response.status === 401) {
    try {
      await handleTokenRefresh();
      const retryResponse = await fetch(`${API_BASE}/conversations/${id}/export?format=${format}`, {
        credentials: 'include',
      });
      if (!retryResponse.ok) {
        throw new ApiError(retryResponse.status, 'Export failed');
      }
      await triggerDownload(retryResponse, format);
      return;
    } catch {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Export failed' }));
    throw new ApiError(response.status, error.detail || 'Export failed');
  }

  await triggerDownload(response, format);
}

async function triggerDownload(response: globalThis.Response, format: string): Promise<void> {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const disposition = response.headers.get('Content-Disposition');
  a.download = disposition?.split('filename=')[1]?.replace(/"/g, '') ||
    `conversation.${format === 'markdown' ? 'md' : format === 'text' ? 'txt' : format}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// Documents API
// ============================================

export async function getDocuments(): Promise<{ documents: Document[]; total: number }> {
  return fetchJson(`${API_BASE}/documents/`);
}

export async function getDocument(id: string): Promise<Document> {
  return fetchJson(`${API_BASE}/documents/${id}`);
}

export async function uploadDocument(file: File): Promise<{ id: string; filename: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new ApiError(response.status, error.detail);
  }

  return response.json();
}

export async function deleteDocument(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/documents/${id}`, {
    method: 'DELETE',
  });
}

export async function reprocessDocument(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/documents/${id}/reprocess`, {
    method: 'POST',
  });
}

// ============================================
// Search API
// ============================================

export async function searchWeb(query: string, maxResults = 5): Promise<{ results: WebSearchResult[] }> {
  return fetchJson(`${API_BASE}/search/`, {
    method: 'POST',
    body: JSON.stringify({ query, max_results: maxResults }),
  });
}

export async function getSearchStatus(): Promise<{ enabled: boolean; available: boolean }> {
  return fetchJson(`${API_BASE}/search/status`);
}

// ============================================
// System API
// ============================================

export async function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE}/system/health`, {
      credentials: 'include',
      signal,
    });
    if (!response.ok) {
      // Return degraded status instead of triggering logout on 401
      return {
        status: 'degraded',
        version: '',
        llm_engine: '',
        llm_model: '',
        llm_status: 'offline',
        rag_status: 'offline',
        search_status: 'offline',
      };
    }
    return response.json();
  } catch {
    return {
      status: 'degraded',
      version: '',
      llm_engine: '',
      llm_model: '',
      llm_status: 'offline',
      rag_status: 'offline',
      search_status: 'offline',
    };
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  return fetchJson(`${API_BASE}/system/info`);
}

export async function getSystemStats(): Promise<SystemStats> {
  return fetchJson(`${API_BASE}/system/stats`);
}

export async function getSettings(): Promise<Settings> {
  return fetchJson(`${API_BASE}/system/settings`);
}

export async function updateSettings(updates: SettingsUpdate): Promise<Settings> {
  return fetchJson(`${API_BASE}/system/settings`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ============================================
// Model Management API
// ============================================

export async function getModels(): Promise<ModelListResponse> {
  return fetchJson(`${API_BASE}/system/models`);
}

export async function pullModel(modelName: string): Promise<{ success: boolean; message: string; model_name: string }> {
  return fetchJson(`${API_BASE}/system/models/pull`, {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName }),
  });
}

export async function pullModelStream(
  modelName: string,
  onProgress: (data: { status: string; percent?: number; completed?: number; total?: number }) => void
): Promise<boolean> {
  const response = await fetch(`${API_BASE}/system/models/pull/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ model_name: modelName }),
  });

  if (!response.ok) {
    throw new Error('Failed to start model download');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let success = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          onProgress(data);
          if (data.status === 'success') success = true;
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return success;
}

export async function switchModel(modelName: string): Promise<{ success: boolean; message: string; active_model: string }> {
  return fetchJson(`${API_BASE}/system/models/switch`, {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName }),
  });
}

export async function deleteModel(modelName: string): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${API_BASE}/system/models/${encodeURIComponent(modelName)}`, {
    method: 'DELETE',
  });
}

// ============================================
// Audit Logs API
// ============================================

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export async function fetchAuditLogs(skip = 0, limit = 20): Promise<AuditLogEntry[]> {
  return fetchJson(`${API_BASE}/system/audit-logs?skip=${skip}&limit=${limit}`);
}
