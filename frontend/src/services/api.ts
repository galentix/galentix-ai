// Galentix AI - API Service

import type {
  Conversation,
  Message,
  Document,
  HealthStatus,
  DeviceInfo,
  SystemStats,
  Settings,
  ChatRequest,
  StreamChunk,
  WebSearchResult,
  ModelListResponse
} from '../types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, error.detail || 'Request failed');
  }

  return response.json();
}

// ============================================
// Chat API
// ============================================

export async function sendMessage(request: ChatRequest): Promise<Response> {
  return fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function* streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
  const response = await sendMessage(request);
  
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

export async function getHealth(): Promise<HealthStatus> {
  return fetchJson(`${API_BASE}/system/health`);
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
