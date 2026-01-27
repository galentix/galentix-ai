# Galentix AI - Complete Setup Guide

## Table of Contents
1. [Initial Setup](#initial-setup)
2. [Installation Steps](#installation-steps)
3. [Accessing the Application](#accessing-the-application)
4. [Troubleshooting](#troubleshooting)
5. [Management Commands](#management-commands)

---

## Initial Setup

### Option A: Using Multipass (Recommended for Development)

**1. Create a new Ubuntu instance:**
```bash
multipass launch --name galentix --cpus 4 --memory 8G --disk 40G 22.04
```

**2. Access the VM:**
```bash
multipass shell galentix
```

**3. Update system:**
```bash
sudo apt update
sudo apt upgrade -y
```

### Option B: Direct Ubuntu Server Installation

Boot Ubuntu Server 22.04 LTS and run these commands.

---

## Installation Steps

### Step 1: Clone the Repository

```bash
cd /tmp
git clone https://github.com/galentix/galentix-ai.git
cd galentix-ai
```

### Step 2: Fix Line Endings (Windows users)

```bash
sed -i 's/\r$//' galentix-installer.sh
chmod +x galentix-installer.sh
```

### Step 3: Run the Installer

```bash
sudo ./galentix-installer.sh
```

**What this does:**
- Detects hardware (RAM, CPU, GPU)
- Installs system packages
- Installs Docker & Docker Compose
- Creates service user `galentix`
- Installs Ollama (LLM engine)
- Downloads appropriate AI model based on hardware
- Installs SearXNG (web search, in Docker)
- Sets up Python virtual environment with all dependencies
- Configures SSH security
- Sets up firewall
- Creates systemd services

**Expected time:** 15-30 minutes (first time)

### Step 4: Deploy Application Code

**Copy backend code:**
```bash
sudo cp -r backend /opt/galentix/
sudo chown -R galentix:galentix /opt/galentix/backend
```

**Copy frontend code:**
```bash
sudo cp -r frontend /opt/galentix/
sudo chown -R galentix:galentix /opt/galentix/frontend
```

### Step 5: Build Frontend

```bash
# Build frontend React app
sudo -u galentix npm install --prefix /opt/galentix/frontend
sudo -u galentix npm run build --prefix /opt/galentix/frontend
```

**Expected time:** 2-5 minutes

### Step 6: Start the Services

**Start backend:**
```bash
sudo systemctl start galentix-backend
```

**Check status:**
```bash
sudo systemctl status galentix-backend
```

**View logs:**
```bash
sudo journalctl -u galentix-backend -f
```

---

## Accessing the Application

### Get the Server IP Address

```bash
hostname -I
```

Or if using Multipass:
```bash
multipass info galentix | grep IPv4
```

### Open in Browser

```
http://<server-ip>:8080
```

Example:
```
http://192.168.1.100:8080
```

### First Time Access

1. **Chat Page** (default)
   - Start typing to chat with AI
   - Toggle "Use Documents" to enable RAG
   - Toggle "Web Search" to enable search

2. **Documents Page** (/documents)
   - Drag & drop files to upload
   - Supported formats: PDF, DOCX, TXT, CSV, JSON, MD
   - Wait for processing to complete

3. **Settings Page** (/settings)
   - View system information
   - Check hardware detection
   - Monitor resource usage

---

## Troubleshooting

### Backend Won't Start

**Check for errors:**
```bash
sudo journalctl -u galentix-backend -n 50
```

**Restart service:**
```bash
sudo systemctl restart galentix-backend
```

**Check if port 8080 is in use:**
```bash
sudo lsof -i :8080
```

### LLM Not Responding

**Check Ollama status:**
```bash
sudo systemctl status ollama
```

**View Ollama logs:**
```bash
sudo journalctl -u ollama -n 50
```

**Test Ollama directly:**
```bash
curl http://localhost:11434/api/tags
```

### Web Search Not Working

**Check SearXNG container:**
```bash
sudo docker ps | grep searxng
```

**Restart SearXNG:**
```bash
cd /opt/galentix/searxng
sudo docker compose restart
```

**View logs:**
```bash
sudo docker logs galentix-searxng
```

### Frontend Not Showing

**Check if build completed:**
```bash
ls -la /opt/galentix/frontend/dist/
```

**Rebuild frontend:**
```bash
sudo -u galentix npm run build --prefix /opt/galentix/frontend
```

**Restart backend:**
```bash
sudo systemctl restart galentix-backend
```

### Database Issues

**Reset database (WARNING: deletes all data):**
```bash
sudo rm /opt/galentix/data/galentix.db
sudo systemctl restart galentix-backend
```

### SSH Connection Issues

**Check SSH service:**
```bash
sudo systemctl status ssh
```

**Allow SSH through firewall:**
```bash
sudo ufw allow ssh
sudo ufw allow 22/tcp
```

**Enable password authentication:**
```bash
sudo nano /etc/ssh/sshd_config
# Find: PasswordAuthentication no
# Change to: PasswordAuthentication yes
# Save: Ctrl+X, Y, Enter

sudo systemctl restart ssh
```

---

## Management Commands

### Service Management

```bash
# Start all services
sudo systemctl start galentix-backend
sudo systemctl start ollama
sudo docker compose up -d --prefix /opt/galentix/searxng

# Stop all services
sudo systemctl stop galentix-backend
sudo systemctl stop ollama
sudo docker compose down --prefix /opt/galentix/searxng

# Restart all services
sudo systemctl restart galentix-backend
sudo systemctl restart ollama

# Check all services
sudo systemctl status galentix-backend
sudo systemctl status ollama
sudo systemctl status ssh
sudo docker ps
```

### View Logs

```bash
# Backend logs (live)
sudo journalctl -u galentix-backend -f

# Backend logs (last 50 lines)
sudo journalctl -u galentix-backend -n 50

# Ollama logs
sudo journalctl -u ollama -f

# SSH logs
sudo journalctl -u ssh -f

# SearXNG container logs
sudo docker logs galentix-searxng -f

# All system logs
dmesg
```

### System Monitoring

```bash
# CPU and memory usage
top

# Disk usage
df -h

# Network status
netstat -i

# Open ports
sudo ss -tulpn

# Process information
ps aux | grep galentix
ps aux | grep ollama
ps aux | grep python
```

### Firewall Management

```bash
# Check firewall status
sudo ufw status

# Allow specific ports
sudo ufw allow 8080/tcp    # Web UI
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 11434/tcp   # Ollama (internal only)

# Deny specific ports
sudo ufw deny 8080/tcp

# Disable firewall (not recommended)
sudo ufw disable

# Enable firewall
sudo ufw enable
```

### Update Galentix AI

**Method 1: From Git**
```bash
cd /tmp/galentix-ai
git pull

# Deploy updates
sudo cp -r backend /opt/galentix/
sudo cp -r frontend /opt/galentix/
sudo chown -R galentix:galentix /opt/galentix

# Rebuild frontend
sudo -u galentix npm run build --prefix /opt/galentix/frontend

# Restart backend
sudo systemctl restart galentix-backend
```

**Method 2: Using Update Script**
```bash
sudo ./galentix-update.sh --from-url https://your-server.com/galentix-update.tar.gz
```

---

## Configuration Files

### Main Configuration
**Location:** `/opt/galentix/config/settings.json`

```json
{
    "llm": {
        "engine": "ollama",
        "model": "phi3:mini",
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

### Device Information
**Location:** `/opt/galentix/config/device.json`

Contains hardware detection, device ID, model selection.

### Backend Settings
**Location:** `/opt/galentix/backend/app/config.py`

Edit for advanced configuration options.

---

## Directory Structure

```
/opt/galentix/
├── backend/                  # FastAPI backend code
├── frontend/                 # React frontend code
│   └── dist/                # Built frontend
├── data/
│   ├── documents/           # Uploaded files
│   ├── chroma/              # Vector database
│   ├── conversations/       # Chat history
│   └── galentix.db          # SQLite database
├── config/
│   ├── device.json          # Device identity
│   ├── settings.json        # Application settings
│   └── ssh_config           # SSH configuration
├── logs/
│   ├── backend.log          # Backend logs
│   ├── backend-error.log    # Backend errors
│   └── web.log              # Web server logs
├── searxng/                 # SearXNG container config
└── .venv/                   # Python virtual environment
```

---

## Performance Tuning

### Increase Max Tokens (for longer responses)
Edit `/opt/galentix/config/settings.json`:
```json
"max_tokens": 4096
```

### Change Temperature (creativity vs accuracy)
- Lower (0.1-0.3): More accurate, less creative
- Medium (0.5-0.7): Balanced (default: 0.7)
- Higher (0.8-1.0): More creative, less accurate

### Adjust RAG Settings
```json
"chunk_size": 750,        # Larger chunks = more context, fewer chunks
"chunk_overlap": 100,     # More overlap = better continuity
"top_k": 10              # Return more results for better accuracy
```

---

## Security Hardening

### Enable SSH Key-Only Authentication

**Generate SSH key on your machine:**
```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

**Add public key to server:**
```bash
cat ~/.ssh/id_rsa.pub | ssh user@server "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

**Disable password authentication:**
```bash
sudo nano /etc/ssh/sshd_config
# Find: PasswordAuthentication yes
# Change to: PasswordAuthentication no
# Save: Ctrl+X, Y, Enter

sudo systemctl restart ssh
```

### Firewall Rules

```bash
# Restrict SSH to specific IP
sudo ufw allow from 192.168.1.0/24 to any port 22

# Restrict web UI to internal network
sudo ufw allow from 192.168.1.0/24 to any port 8080

# Allow all (not recommended)
sudo ufw allow 8080/tcp
```

---

## FAQ

**Q: How do I change the AI model?**
A: Edit `/opt/galentix/config/settings.json` and change the `model` field, then restart:
```bash
sudo systemctl restart galentix-backend
```

**Q: Can I access from outside my network?**
A: Yes, but use SSH tunneling for security:
```bash
ssh -L 8080:localhost:8080 user@server-ip
# Then access: http://localhost:8080
```

**Q: What AI models are available?**
A: Check installed models:
```bash
ollama list
```

**Q: How much storage do I need?**
A: 
- Base: 5GB
- Per model: 2-40GB
- Per 1000 documents: 1-5GB

**Q: Can I run multiple instances?**
A: Yes, but use different ports. Edit systemd service and settings.json.

---

## Support

For issues or questions:
- Check logs: `sudo journalctl -u galentix-backend -f`
- GitHub Issues: https://github.com/galentix/galentix-ai/issues
- Documentation: https://github.com/galentix/galentix-ai

---

**Last Updated:** 2026-01-27  
**Version:** 2.0.0  
**Status:** Production Ready
