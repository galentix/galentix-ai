# Galentix AI - Architecture Documentation

## System Overview

Galentix AI is a privacy-focused local AI appliance that runs entirely on-device. This document describes the system architecture, component interactions, and data flows.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    React Frontend (Port 8080)                        │    │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │    │
│  │  │  Chat    │  │  Documents   │  │   Settings   │  │    API     │ │    │
│  │  │   Page   │  │    Page      │  │    Page      │  │   Client   │ │    │
│  │  └──────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTP/WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend Layer (FastAPI)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     API Routers                                        │  │
│  │  ┌─────────┐ ┌─────────────┐ ┌──────────┐ ┌─────────┐ ┌────────────┐ │  │
│  │  │  Chat   │ │Conversation │ │Documents │ │ Search  │ │  System    │ │  │
│  │  └────┬────┘ └──────┬──────┘ └────┬─────┘ └────┬────┘ └─────┬──────┘ │  │
│  └───────┼─────────────┼─────────────┼────────────┼────────────┼───────┘  │
│          │             │             │            │            │          │
│  ┌───────▼─────────────▼─────────────▼────────────▼────────────▼───────┐  │
│  │                        Service Layer                                  │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │  │
│  │  │  LLM Service    │  │  RAG Pipeline  │  │   Web Search        │   │  │
│  │  │  (Ollama/vLLM) │  │  (ChromaDB)    │  │   (SearXNG)         │   │  │
│  │  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘   │  │
│  └───────────┼────────────────────┼─────────────────────┼──────────────┘  │
└──────────────┼────────────────────┼─────────────────────┼──────────────────┘
               │                    │                      │
               ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                         │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐  ┌──────────┐ │
│  │   SQLite DB   │  │  Vector Store  │  │   File Storage  │  │ Ollama  │ │
│  │ (Conversations│  │   (ChromaDB)   │  │   (Documents)   │  │  API    │ │
│  │  & Messages)  │  │  (Embeddings)  │  │                 │  │11434    │ │
│  └────────────────┘  └─────────────────┘  └──────────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React + TypeScript)

The frontend is a Single Page Application (SPA) built with:
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **React Query** - Server state

**Key Components:**
```
frontend/src/
├── components/
│   ├── chat/           # Chat UI components
│   │   ├── ChatContainer.tsx
│   │   ├── ChatInput.tsx
│   │   ├── Message.tsx
│   │   ├── MessageList.tsx
│   │   └── SourcesPanel.tsx
│   └── layout/         # Layout components
│       ├── Header.tsx
│       ├── Layout.tsx
│       └── Sidebar.tsx
├── pages/
│   ├── ChatPage.tsx
│   ├── DocumentsPage.tsx
│   └── SettingsPage.tsx
├── services/
│   └── api.ts          # API client
├── stores/
│   ├── chatStore.ts    # Chat state
│   └── settingsStore.ts
└── types/
    └── index.ts        # TypeScript types
```

### Backend (FastAPI)

The backend provides a RESTful API with support for:
- Streaming responses (Server-Sent Events)
- Async operations
- Background task processing

**API Routers:**

| Router | Prefix | Description |
|--------|--------|-------------|
| chat | `/api/chat` | Chat with streaming |
| conversations | `/api/conversations` | Conversation management |
| documents | `/api/documents` | Document upload & RAG |
| search | `/api/search` | Web search |
| system | `/api/system` | Health, settings, models |

### LLM Service Layer

The LLM service provides an abstraction over different LLM backends:

```
┌─────────────────────────────────────────┐
│         LLM Factory (factory.py)        │
│     Returns appropriate service         │
└─────────────────┬───────────────────────┘
                  │
     ┌────────────┴────────────┐
     ▼                         ▼
┌─────────────┐          ┌─────────────┐
│   Ollama   │          │    vLLM    │
│  Service   │          │   Service  │
└──────┬──────┘          └──────┬──────┘
       │                        │
       ▼                        ▼
┌─────────────┐          ┌─────────────┐
│  Ollama    │          │  OpenAI    │
│  API       │          │  Compatible│
│  Port 11434│          │  Port 8000 │
└─────────────┘          └─────────────┘
```

**Ollama Service:**
- Runs locally on port 11434
- CPU-based inference
- Supports model hot-swapping
- Built-in model management

**vLLM Service:**
- GPU-accelerated inference
- OpenAI-compatible API
- Higher throughput
- Requires CUDA-compatible GPU

### RAG Pipeline

Retrieval-Augmented Generation (RAG) enables querying uploaded documents:

```
┌─────────────────────────────────────────────────────────────────┐
│                     RAG Pipeline                                  │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Document    │───▶│    Chunk     │───▶│  Embedding   │       │
│  │   Upload    │    │    (500c)    │    │   (nomic)   │       │
│  └──────────────┘    └──────────────┘    └──────┬───────┘       │
│                                                  │               │
│                                                  ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Query      │───▶│   Semantic   │───▶│    Top-K     │       │
│  │   Input     │    │   Search     │    │   Results    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                  │               │
│                                                  ▼               │
│                                    ┌──────────────────────────┐  │
│                                    │    Context Building      │  │
│                                    │  (chunk1 + chunk2 + ...) │  │
│                                    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Components:**
1. **Document Processing** (`documents.py`)
   - Extracts text from PDF, DOCX, TXT, MD, CSV, JSON
   - Handles PDF OCR fallback for scanned documents
   - Cleans garbled text from poor PDF extractions

2. **Text Chunker** (`rag/chunker.py`)
   - Splits text into overlapping chunks
   - Default: 500 characters, 50 overlap

3. **Embeddings** (`rag/embeddings.py`)
   - Generates vector embeddings using nomic-embed-text
   - Stores in ChromaDB vector database

4. **Retrieval** (`rag/pipeline.py`)
   - Semantic similarity search
   - Returns top-k relevant chunks
   - Builds context for LLM

### Web Search

Privacy-focused search using SearXNG:

```
User Query → Backend → SearXNG (Docker) → Results
                 │              │
                 └──────────────┴──▶ Summarization → LLM Context
```

**Features:**
- Self-hosted (no data leaves network)
- Multiple search engines aggregated
- Content summarization via LLM

## Data Models

### Database Schema (SQLite)

```
┌─────────────────────┐       ┌─────────────────────┐
│    conversations    │       │      messages       │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │◀──────│ conversation_id (FK)│
│ title               │       │ id (PK)             │
│ created_at          │       │ role                │
│ updated_at          │       │ content             │
│ is_archived         │       │ created_at          │
│ is_deleted          │       │ sources (JSON)      │
└─────────────────────┘       │ skills_used (JSON)  │
                               └─────────────────────┘

┌─────────────────────┐
│     documents       │
├─────────────────────┤
│ id (PK)             │
│ filename            │
│ original_name       │
│ file_type           │
│ file_size           │
│ status              │
│ error_message       │
│ chunk_count         │
│ created_at          │
│ processed_at        │
└─────────────────────┘
```

### Vector Store (ChromaDB)

```
Collection: "galentix_documents"

Documents:
┌────────────┬─────────────────────────┬─────────────────────────────────┐
│ document_id│        chunk_text       │           metadata              │
├────────────┼─────────────────────────┼─────────────────────────────────┤
│ uuid-1     │ "The company was..."    │ {filename: "report.pdf",        │
│            │                         │  chunk_index: 0,                │
│            │                         │  file_type: "pdf"}              │
└────────────┴─────────────────────────┴─────────────────────────────────┘
```

## Security Architecture

### Service Isolation

```
┌─────────────────────────────────────────────┐
│            Systemd Service                   │
│  └─ Service: galentix-backend                │
│     └─ User: galentix (non-privileged)      │
│        └─ No login shell                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│            Firewall (UFW)                    │
│  ┌─────────────────────────────────────────┐ │
│  │  INBOUND                                  │ │
│  │    22/TCP (SSH)  - Restricted            │ │
│  │    8080/TCP (Web) - Allowed              │ │
│  │    All Other      - DENY                 │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### SSH Hardening

- Key-based authentication only
- Support user with embedded master key
- Password authentication disabled
- Fail2ban protection (optional)

## Deployment

### Service Management

```bash
# Backend service
systemctl status galentix-backend
systemctl restart galentix-backend

# Ollama service
systemctl status ollama
systemctl restart ollama

# SearXNG (Docker)
docker ps | grep searxng
docker logs -f galentix-searxng
```

### Directory Structure

```
/opt/galentix/
├── backend/                  # Python application
│   └── app/
│       ├── main.py           # FastAPI app
│       ├── config.py         # Configuration
│       ├── database.py       # SQLite
│       ├── models/           # DB models
│       ├── routers/          # API endpoints
│       └── services/         # Business logic
├── frontend/                 # React application
│   ├── src/                  # Source code
│   └── dist/                 # Built assets
├── data/
│   ├── galentix.db          # SQLite database
│   ├── chroma/               # Vector database
│   ├── documents/            # Uploaded files
│   └── conversations/        # Chat exports
├── config/
│   ├── settings.json         # App settings
│   └── device.json           # Device info
└── logs/
    └── backend.log           # Application logs
```

## Performance Considerations

### Model Selection Guidelines

| Hardware | Model | Tokens/sec (est.) |
|----------|-------|-------------------|
| 4GB RAM | TinyLlama 1.1B | ~15-20 |
| 8GB RAM | Phi-3 Mini 3.8B | ~8-12 |
| 16GB RAM | Mistral 7B | ~4-6 |
| 16GB VRAM | Llama 3 8B | ~30-40 |
| 24GB VRAM | Llama 3 70B | ~8-12 |

### Optimization Tips

1. **RAG Chunk Size**: Larger chunks (750-1000) for technical documents
2. **Top-K**: Higher values (8-10) for complex queries, lower for simple ones
3. **Concurrent Requests**: Limit to 2-3 for CPU, 5-10 for GPU
4. **Document Processing**: Process in background to avoid UI blocking

## Monitoring

### Health Checks

```bash
# Overall health
curl http://localhost:8080/api/system/health

# LLM status
curl http://localhost:8080/api/system/llm/status

# RAG stats
curl http://localhost:8080/api/system/rag/stats

# System resources
curl http://localhost:8080/api/system/stats
```

### Logs

```bash
# Backend logs
journalctl -u galentix-backend -f

# Ollama logs
journalctl -u ollama -f

# SearXNG logs
docker logs galentix-searxng -f
```

---

**Version:** 2.0.0  
**Last Updated:** 2026-03-25
