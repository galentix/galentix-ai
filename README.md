# Galentix AI

<p align="center">
  <img src="frontend/public/logo.svg" alt="Galentix AI Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Local AI Appliance Platform</strong><br>
  Privacy-focused AI assistant running entirely on your device
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#api-reference">API</a>
</p>

---

## Overview

Galentix AI is a complete local AI platform designed to run as a dedicated appliance. It provides ChatGPT-like capabilities while keeping all data on-device, ensuring complete privacy and data sovereignty.

**Key Principles:**
- 🔒 **100% Local** - Your data never leaves the device
- 🧠 **Smart Hardware Detection** - Automatically selects the best model for your hardware
- 📄 **RAG Support** - Upload documents and ask questions about them
- 🔍 **Web Search** - Privacy-focused web search via SearXNG
- 🎨 **Modern UI** - Beautiful React interface with dark/light themes

---

## Features

| Feature | Description |
|---------|-------------|
| **Hybrid LLM Engine** | Automatically uses Ollama (CPU) or vLLM (GPU) based on hardware |
| **RAG Pipeline** | Upload PDFs, DOCX, TXT files and query them with AI |
| **Web Search** | Self-hosted SearXNG integration for current information |
| **Streaming Responses** | Real-time streaming chat responses |
| **Conversation History** | Persistent chat history with SQLite |
| **Document Management** | Upload, process, and manage documents |
| **System Monitoring** | CPU, memory, disk usage monitoring |
| **SSH Hardening** | Key-only authentication with master support key |
| **Device Identity** | Hardware-bound UUID for licensing |

---

## Quick Start

### Prerequisites

- Ubuntu Server 22.04 LTS or later
- Minimum 4GB RAM (8GB+ recommended)
- 20GB free disk space
- Internet connection (for initial setup)

### Installation

```bash
# Clone the repository
git clone https://github.com/galentix/galentix-ai.git
cd galentix-ai

# Run the installer (as root)
sudo chmod +x galentix-installer.sh
sudo ./galentix-installer.sh

# Deploy application code
sudo cp -r backend /opt/galentix/
sudo cp -r frontend /opt/galentix/
sudo chown -R galentix:galentix /opt/galentix

# Build frontend
cd /opt/galentix/frontend
sudo -u galentix npm install
sudo -u galentix npm run build

# Start the service
sudo systemctl start galentix-backend
```

### Access

Open your browser and navigate to:
```
http://<your-server-ip>:8080
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Galentix AI Appliance                       │
├─────────────────────────────────────────────────────────────────┤
│  Ubuntu LTS (Hidden Base OS)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Ollama    │  │  ChromaDB   │  │      SearXNG            │  │
│  │ (LLM Engine)│  │ (Vector DB) │  │   (Web Search)          │  │
│  │  Port 11434 │  │  Embedded   │  │    Port 8888            │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                │
│  ┌──────▼────────────────▼─────────────────────▼──────────────┐ │
│  │              Galentix AI Backend (FastAPI)                 │ │
│  │                      Port 8080                             │ │
│  │  • LLM Service (Ollama/vLLM auto-selection)                │ │
│  │  • RAG Pipeline (chunking, embedding, retrieval)           │ │
│  │  • Web Search Integration                                  │ │
│  │  • Conversation Management                                 │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                    │
│  ┌─────────────────────────▼──────────────────────────────────┐ │
│  │           Galentix AI Frontend (React + Vite)              │ │
│  │  • Modern chat interface with streaming                    │ │
│  │  • Document upload and management                          │ │
│  │  • Settings and system monitoring                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
galentix-ai/
├── galentix-installer.sh    # System installer with hardening
├── galentix-update.sh       # Update mechanism
├── backend/
│   ├── requirements.txt     # Python dependencies
│   └── app/
│       ├── main.py          # FastAPI application
│       ├── config.py        # Configuration management
│       ├── database.py      # SQLite database
│       ├── models/          # Database models & schemas
│       ├── routers/         # API endpoints
│       │   ├── chat.py      # Chat with streaming
│       │   ├── conversations.py
│       │   ├── documents.py # RAG document management
│       │   ├── search.py    # Web search
│       │   └── system.py    # Health & settings
│       └── services/
│           ├── hardware.py  # Hardware detection
│           ├── websearch.py # SearXNG integration
│           ├── llm/         # LLM abstraction layer
│           │   ├── ollama.py
│           │   ├── vllm.py
│           │   └── factory.py
│           └── rag/         # RAG pipeline
│               ├── chunker.py
│               ├── embeddings.py
│               └── pipeline.py
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── chat/        # Chat UI components
        │   └── layout/      # Layout components
        ├── pages/           # Page components
        ├── services/        # API client
        ├── stores/          # Zustand state management
        └── types/           # TypeScript types
```

---

## Hardware Requirements

### Model Selection (Automatic)

| RAM | GPU | Selected Model | Engine |
|-----|-----|----------------|--------|
| < 4GB | None | TinyLlama 1.1B | Ollama |
| 4-7GB | None | Phi-3 Mini 3.8B | Ollama |
| 8-15GB | None | Mistral 7B | Ollama |
| 16GB+ | None | Llama 3 8B | Ollama |
| Any | 8GB+ VRAM | Mistral 7B | vLLM |
| Any | 16GB+ VRAM | Llama 3 8B | vLLM |
| Any | 24GB+ VRAM | Llama 3 70B | vLLM |

---

## Configuration

### Settings File

Located at `/opt/galentix/config/settings.json`:

```json
{
    "llm": {
        "engine": "ollama",
        "model": "llama3:8b",
        "temperature": 0.7,
        "max_tokens": 2048
    },
    "rag": {
        "enabled": true,
        "chunk_size": 500,
        "chunk_overlap": 50,
        "top_k": 5
    },
    "search": {
        "enabled": true,
        "max_results": 5
    },
    "ui": {
        "brand_name": "Galentix AI",
        "brand_color": "#6BBF9E",
        "theme": "dark"
    }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GALENTIX_HOST` | Server host | 0.0.0.0 |
| `GALENTIX_PORT` | Server port | 8080 |
| `GALENTIX_DEBUG` | Debug mode | false |
| `GALENTIX_LLM_ENGINE` | LLM engine | ollama |
| `GALENTIX_LLM_MODEL` | Model name | (auto-detected) |

---

## API Reference

### Chat

**Stream Chat**
```http
POST /api/chat/stream
Content-Type: application/json

{
    "message": "What is the capital of France?",
    "conversation_id": null,
    "use_rag": true,
    "use_web_search": false
}
```

### Conversations

```http
GET    /api/conversations/           # List conversations
POST   /api/conversations/           # Create conversation
GET    /api/conversations/{id}       # Get conversation
PATCH  /api/conversations/{id}       # Update conversation
DELETE /api/conversations/{id}       # Delete conversation
GET    /api/conversations/{id}/messages  # Get messages
```

### Documents

```http
GET    /api/documents/               # List documents
POST   /api/documents/upload         # Upload document
GET    /api/documents/{id}           # Get document
DELETE /api/documents/{id}           # Delete document
POST   /api/documents/{id}/reprocess # Reprocess document
```

### Search

```http
POST   /api/search/                  # Web search
GET    /api/search/status            # Search service status
```

### System

```http
GET    /api/system/health            # Health check
GET    /api/system/info              # Device information
GET    /api/system/stats             # System statistics
GET    /api/system/settings          # Current settings
```

---

## Security

### SSH Access

- Password authentication is **disabled**
- Only key-based authentication is allowed
- Only the `support` user can SSH
- Master support key is embedded during installation

**To replace the master SSH key**, edit `galentix-installer.sh` line 39 before installation.

### Firewall

Only two ports are open:
- **22** - SSH (support access only)
- **8080** - Web UI

### Service Isolation

- Services run under dedicated `galentix` user
- No login shell for service user
- Systemd security hardening enabled
- Protected system directories

---

## Updates

### Manual Update

```bash
# Download update package
wget https://your-server.com/galentix-update.tar.gz

# Run update script
sudo ./galentix-update.sh --from-file galentix-update.tar.gz
```

### From Git

```bash
cd /path/to/galentix-ai
git pull

# Copy updated files
sudo cp -r backend /opt/galentix/
sudo cp -r frontend /opt/galentix/
sudo chown -R galentix:galentix /opt/galentix

# Rebuild frontend
cd /opt/galentix/frontend
sudo -u galentix npm install
sudo -u galentix npm run build

# Restart service
sudo systemctl restart galentix-backend
```

---

## Service Management

```bash
# Check status
sudo systemctl status galentix-backend

# Start/Stop/Restart
sudo systemctl start galentix-backend
sudo systemctl stop galentix-backend
sudo systemctl restart galentix-backend

# View logs
sudo journalctl -u galentix-backend -f

# Check SearXNG
sudo docker ps | grep searxng
```

---

## Troubleshooting

### LLM Not Responding

```bash
# Check Ollama status
sudo systemctl status ollama
sudo journalctl -u ollama -n 50

# Test Ollama
curl http://localhost:11434/api/tags
```

### Web Search Not Working

```bash
# Check SearXNG container
sudo docker logs galentix-searxng

# Restart SearXNG
cd /opt/galentix/searxng
sudo docker compose restart
```

### Frontend Not Loading

```bash
# Check if frontend is built
ls -la /opt/galentix/frontend/dist/

# Rebuild
cd /opt/galentix/frontend
sudo -u galentix npm run build
```

### Database Issues

```bash
# Check database file
ls -la /opt/galentix/data/galentix.db

# Reset database (WARNING: deletes all data)
sudo rm /opt/galentix/data/galentix.db
sudo systemctl restart galentix-backend
```

---

## Development

### Local Development

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8080

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Building for Production

```bash
# Frontend
cd frontend
npm run build

# Create update package
tar -czvf galentix-update.tar.gz backend frontend version.txt
```

---

## License

Proprietary - Galentix Technologies

---

## Support

For support, contact: support@galentix.com

---

<p align="center">
  <strong>Galentix AI</strong> - Your Data, Your Device, Your AI
</p>
