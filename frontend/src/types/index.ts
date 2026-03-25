// Galentix AI - TypeScript Types

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  sources?: Source[];
  skills_used?: string[];
}

export interface Source {
  type: 'document' | 'web';
  filename?: string;
  url?: string;
  title?: string;
  chunk?: number;
  similarity?: number;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  message_count: number;
}

export interface Document {
  id: string;
  filename: string;
  original_name: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message?: string;
  chunk_count: number;
  created_at: string;
  processed_at?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface HealthStatus {
  status: string;
  version: string;
  llm_engine: string;
  llm_model: string;
  llm_status: string;
  rag_status: string;
  search_status: string;
}

export interface DeviceInfo {
  device_id: string;
  version: string;
  hardware: {
    ram_gb: number;
    cpu_cores: number;
    cpu_model: string;
    gpu_detected: boolean;
    gpu_name: string;
    gpu_vram_gb: number;
  };
  llm: {
    engine: string;
    model: string;
  };
  uptime?: string;
}

export interface SystemStats {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  conversations_count: number;
  documents_count: number;
  messages_count: number;
}

export interface Settings {
  llm: {
    engine: string;
    model: string;
    temperature: number;
    max_tokens: number;
  };
  rag: {
    enabled: boolean;
    chunk_size: number;
    chunk_overlap: number;
    top_k: number;
  };
  search: {
    enabled: boolean;
    max_results: number;
  };
  ui: {
    brand_name: string;
    brand_color: string;
    theme: string;
  };
  paths?: {
    data_dir: string;
    chroma_dir: string;
  };
}

export interface SettingsUpdate {
  temperature?: number;
  max_tokens?: number;
  rag_enabled?: boolean;
  rag_top_k?: number;
  chunk_size?: number;
  chunk_overlap?: number;
  search_enabled?: boolean;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  use_rag?: boolean;
  use_web_search?: boolean;
  stream?: boolean;
}

export interface ModelInfo {
  name: string;
  size: string;
  is_active: boolean;
}

export interface ModelListResponse {
  models: ModelInfo[];
  active_model: string;
}

export interface StreamChunk {
  type: 'meta' | 'token' | 'done' | 'error';
  content?: string;
  sources?: Source[];
  web_results?: WebSearchResult[];
  conversation_id?: string;
}
