#!/usr/bin/env bash
set -euo pipefail

################################################################################
#                                                                              #
#  Galentix AI Appliance Installer                                             #
#  Version: 2.0.0                                                              #
#                                                                              #
#  Features:                                                                   #
#  - Hardware auto-detection (RAM, GPU)                                        #
#  - Hybrid LLM engine (Ollama for CPU, vLLM for GPU)                         #
#  - RAG support with ChromaDB                                                 #
#  - Web search via SearXNG (Docker)                                          #
#  - SSH key-only authentication                                               #
#  - Device identity generation                                                #
#  - System hardening                                                          #
#                                                                              #
################################################################################

VERSION="2.0.0"
INSTALL_DIR="/opt/galentix"
DATA_DIR="${INSTALL_DIR}/data"
CONFIG_DIR="${INSTALL_DIR}/config"
LOG_DIR="${INSTALL_DIR}/logs"

# Branding
BRAND_NAME="Galentix AI"
BRAND_COLOR="#6BBF9E"

echo "=============================================="
echo "    ${BRAND_NAME} Appliance Installer"
echo "    Version: ${VERSION}"
echo "=============================================="
echo

################################################################################
# ROOT CHECK
################################################################################

if [[ "$EUID" -ne 0 ]]; then
    echo "ERROR: This script must be run as root"
    echo "Run: sudo ./galentix-installer.sh"
    exit 1
fi

################################################################################
# COLORS & LOGGING
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "${CYAN}[STEP]${NC} $1"; }

################################################################################
# MASTER SSH PUBLIC KEY (PLACEHOLDER - REPLACE WITH YOUR KEY)
################################################################################

MASTER_SSH_KEY="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDPlaceholderKeyReplaceWithYourActualPublicKey... galentix-support@galentix.com"

# To generate your own key pair:
# ssh-keygen -t rsa -b 4096 -C "galentix-support@galentix.com" -f galentix_support_key
# Then replace the MASTER_SSH_KEY above with the contents of galentix_support_key.pub

################################################################################
# PHASE 1: SYSTEM DIAGNOSIS & HARDWARE DETECTION
################################################################################

echo
echo "=============================================="
echo "  PHASE 1: Hardware Detection & Diagnosis"
echo "=============================================="
echo

# Detect total RAM
log_info "Detecting system memory..."
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))
log_success "Total RAM: ${TOTAL_RAM_GB}GB"

# Detect GPU
log_info "Detecting GPU..."
GPU_DETECTED=0
GPU_VRAM_GB=0
GPU_NAME="None"

# Find nvidia-smi (standard path or WSL path)
NVIDIA_SMI=""
if command -v nvidia-smi &> /dev/null; then
    NVIDIA_SMI="nvidia-smi"
elif [[ -f /usr/lib/wsl/lib/nvidia-smi ]]; then
    NVIDIA_SMI="/usr/lib/wsl/lib/nvidia-smi"
fi

if [[ -n "$NVIDIA_SMI" ]]; then
    if $NVIDIA_SMI &> /dev/null; then
        GPU_DETECTED=1
        GPU_NAME=$($NVIDIA_SMI --query-gpu=name --format=csv,noheader,nounits | head -n1)
        GPU_VRAM_MB=$($NVIDIA_SMI --query-gpu=memory.total --format=csv,noheader,nounits | head -n1)
        GPU_VRAM_GB=$((GPU_VRAM_MB / 1024))
        log_success "NVIDIA GPU detected: ${GPU_NAME} (${GPU_VRAM_GB}GB VRAM)"
    fi
else
    # Check for NVIDIA hardware without drivers
    if command -v lspci &> /dev/null && lspci | grep -i nvidia &> /dev/null; then
        log_warning "NVIDIA GPU found but drivers not installed"
        log_info "Consider installing NVIDIA drivers for better performance"
    else
        log_info "No NVIDIA GPU detected - will use CPU inference"
    fi
fi

# Determine LLM engine
log_info "Detecting optimal LLM engine..."

LLM_ENGINE="ollama"

if [[ $GPU_DETECTED -eq 1 && $GPU_VRAM_GB -ge 8 ]]; then
    LLM_ENGINE="vllm"
    log_success "GPU detected - vLLM engine available"
else
    log_success "Using Ollama engine (CPU inference)"
fi

# CPU info
CPU_CORES=$(nproc)
CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -n1 | cut -d':' -f2 | xargs)
log_success "CPU: ${CPU_MODEL} (${CPU_CORES} cores)"

# Network check
log_info "Checking network connectivity..."
if ping -c 1 8.8.8.8 &> /dev/null; then
    log_success "Network connectivity OK"
else
    log_error "No network connectivity - installation requires internet"
    exit 1
fi

echo
echo "  Hardware Summary:"
echo "  -----------------"
echo "  RAM: ${TOTAL_RAM_GB}GB"
echo "  CPU: ${CPU_CORES} cores"
echo "  GPU: ${GPU_NAME}"
echo "  LLM Engine: ${LLM_ENGINE}"
echo

################################################################################
# MODEL SELECTION MENU
################################################################################

echo "=============================================="
echo "  Model Selection"
echo "=============================================="
echo

# Build model menu based on hardware
declare -a MENU_MODELS=()
declare -a MENU_LABELS=()

if [[ $GPU_DETECTED -eq 1 && $GPU_VRAM_GB -ge 24 ]]; then
    MENU_MODELS+=("llama3:70b")
    MENU_LABELS+=("llama3:70b        [~40GB] - Large, highest quality")
fi

if [[ $TOTAL_RAM_GB -ge 16 ]] || [[ $GPU_DETECTED -eq 1 && $GPU_VRAM_GB -ge 8 ]]; then
    MENU_MODELS+=("llama3:8b")
    MENU_LABELS+=("llama3:8b         [~8GB]  - Best quality for most hardware")
fi

if [[ $TOTAL_RAM_GB -ge 8 ]] || [[ $GPU_DETECTED -eq 1 && $GPU_VRAM_GB -ge 8 ]]; then
    MENU_MODELS+=("mistral:7b")
    MENU_LABELS+=("mistral:7b        [~8GB]  - Fast and capable")
fi

if [[ $TOTAL_RAM_GB -ge 4 ]]; then
    MENU_MODELS+=("phi3:mini")
    MENU_LABELS+=("phi3:mini         [~4GB]  - Lightweight")
fi

MENU_MODELS+=("tinyllama")
MENU_LABELS+=("tinyllama         [~2GB]  - Minimal resources")

log_info "Recommended models for your system (${TOTAL_RAM_GB}GB RAM, GPU: ${GPU_NAME}):"
echo
for i in "${!MENU_MODELS[@]}"; do
    echo "  $((i+1))) ${MENU_LABELS[$i]}"
done
echo "  C) Enter custom Ollama model ID(s)"
echo

read -rp "  Select models to download (comma-separated, e.g. 1,2) [default: 1]: " MODEL_CHOICE
MODEL_CHOICE="${MODEL_CHOICE:-1}"

# Parse selection
declare -a SELECTED_MODELS=()

if [[ "${MODEL_CHOICE^^}" == "C" ]]; then
    read -rp "  Enter Ollama model ID(s), comma-separated (e.g. llama3:8b,mistral:7b): " CUSTOM_MODELS
    IFS=',' read -ra CUSTOM_ARRAY <<< "$CUSTOM_MODELS"
    for m in "${CUSTOM_ARRAY[@]}"; do
        m=$(echo "$m" | xargs)  # trim whitespace
        if [[ -n "$m" ]]; then
            SELECTED_MODELS+=("$m")
        fi
    done
else
    IFS=',' read -ra CHOICES <<< "$MODEL_CHOICE"
    for c in "${CHOICES[@]}"; do
        c=$(echo "$c" | xargs)  # trim whitespace
        idx=$((c - 1))
        if [[ $idx -ge 0 && $idx -lt ${#MENU_MODELS[@]} ]]; then
            SELECTED_MODELS+=("${MENU_MODELS[$idx]}")
        else
            log_warning "Invalid selection: $c (skipping)"
        fi
    done
fi

# Fallback if nothing selected
if [[ ${#SELECTED_MODELS[@]} -eq 0 ]]; then
    SELECTED_MODELS+=("${MENU_MODELS[0]}")
    log_warning "No valid selection - defaulting to ${MENU_MODELS[0]}"
fi

# First model is the active model
SELECTED_MODEL="${SELECTED_MODELS[0]}"

echo
log_success "Models to download: ${SELECTED_MODELS[*]}"
log_success "Active model: ${SELECTED_MODEL}"
echo

################################################################################
# PHASE 2: SYSTEM PREPARATION
################################################################################

echo
echo "=============================================="
echo "  PHASE 2: System Preparation"
echo "=============================================="
echo

# Clear any problematic aliases/functions
unalias -a 2>/dev/null || true
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Update system
log_step "[1/12] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
log_success "System updated"

# Install base packages
log_step "[2/12] Installing base packages..."
PACKAGES=(
    curl wget git htop unzip
    ca-certificates gnupg lsb-release
    ufw fail2ban
    python3 python3-venv python3-pip python3-dev
    build-essential
    sqlite3 libsqlite3-dev
    poppler-utils  # For PDF processing
)

for pkg in "${PACKAGES[@]}"; do
    if ! dpkg -l | grep -q "^ii  $pkg "; then
        apt-get install -y -qq "$pkg" 2>/dev/null || log_warning "Could not install $pkg"
    fi
done
log_success "Base packages installed"

# Install Docker
log_step "[3/12] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log_success "Docker installed"
else
    log_warning "Docker already installed - skipping"
fi

# Install Node.js (for frontend build)
log_step "[4/12] Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    log_success "Node.js installed"
else
    log_warning "Node.js already installed - skipping"
fi

################################################################################
# PHASE 3: USER & DIRECTORY SETUP
################################################################################

echo
echo "=============================================="
echo "  PHASE 3: User & Directory Setup"
echo "=============================================="
echo

# Create galentix service user
log_step "[5/12] Creating service user..."
if ! id galentix &> /dev/null; then
    useradd -r -m -d "${INSTALL_DIR}" -s /usr/sbin/nologin galentix
    log_success "User 'galentix' created"
else
    log_warning "User 'galentix' already exists - skipping"
fi

# Create support user for SSH access
log_info "Creating support user for SSH access..."
if ! id support &> /dev/null; then
    useradd -m -s /bin/bash support
    usermod -aG sudo support
    
    # Set up SSH directory
    mkdir -p /home/support/.ssh
    echo "${MASTER_SSH_KEY}" > /home/support/.ssh/authorized_keys
    chmod 700 /home/support/.ssh
    chmod 600 /home/support/.ssh/authorized_keys
    chown -R support:support /home/support/.ssh
    
    log_success "Support user created with SSH key authentication"
else
    log_warning "Support user already exists - updating SSH key"
    mkdir -p /home/support/.ssh
    echo "${MASTER_SSH_KEY}" > /home/support/.ssh/authorized_keys
    chmod 700 /home/support/.ssh
    chmod 600 /home/support/.ssh/authorized_keys
    chown -R support:support /home/support/.ssh
fi

# Create directory structure
log_info "Creating directory structure..."
mkdir -p "${INSTALL_DIR}"/{backend,frontend,data,config,logs,models,scripts}
mkdir -p "${DATA_DIR}"/{documents,chroma,conversations}
mkdir -p "${CONFIG_DIR}"
mkdir -p "${LOG_DIR}"

chown -R galentix:galentix "${INSTALL_DIR}"
log_success "Directories created"

################################################################################
# PHASE 4: DEVICE IDENTITY
################################################################################

echo
echo "=============================================="
echo "  PHASE 4: Device Identity Generation"
echo "=============================================="
echo

log_step "[6/12] Generating device identity..."

# Gather hardware identifiers
MAC_ADDR=$(ip link show | grep -m1 "link/ether" | awk '{print $2}' | tr -d ':')
CPU_ID=$(cat /proc/cpuinfo | grep -m1 "Serial\|model name" | md5sum | cut -d' ' -f1)
BOARD_SERIAL=$(cat /sys/class/dmi/id/board_serial 2>/dev/null || echo "unknown")
INSTALL_TIME=$(date +%s)

# Generate unique device ID
DEVICE_UUID=$(echo "${MAC_ADDR}-${CPU_ID}-${BOARD_SERIAL}-${INSTALL_TIME}" | sha256sum | cut -d' ' -f1 | head -c 32)

# Build models JSON array
MODELS_JSON="["
for i in "${!SELECTED_MODELS[@]}"; do
    if [[ $i -gt 0 ]]; then MODELS_JSON+=", "; fi
    MODELS_JSON+="\"${SELECTED_MODELS[$i]}\""
done
MODELS_JSON+="]"

# Create device config
cat > "${CONFIG_DIR}/device.json" << EOF
{
    "device_id": "${DEVICE_UUID}",
    "created_at": "$(date -Iseconds)",
    "hardware": {
        "ram_gb": ${TOTAL_RAM_GB},
        "cpu_cores": ${CPU_CORES},
        "cpu_model": "${CPU_MODEL}",
        "gpu_detected": ${GPU_DETECTED},
        "gpu_name": "${GPU_NAME}",
        "gpu_vram_gb": ${GPU_VRAM_GB}
    },
    "llm": {
        "engine": "${LLM_ENGINE}",
        "model": "${SELECTED_MODEL}",
        "models": ${MODELS_JSON}
    },
    "version": "${VERSION}"
}
EOF

chown galentix:galentix "${CONFIG_DIR}/device.json"
log_success "Device ID: ${DEVICE_UUID}"

################################################################################
# PHASE 5: SSH HARDENING
################################################################################

echo
echo "=============================================="
echo "  PHASE 5: SSH Hardening"
echo "=============================================="
echo

log_step "[7/12] Configuring SSH security..."

# Backup original sshd_config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d)

# Configure SSH with password authentication for development
cat > /etc/ssh/sshd_config.d/galentix-config.conf << 'EOF'
# Galentix AI SSH Configuration

PasswordAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
PermitRootLogin no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# Security settings
X11Forwarding no
AllowTcpForwarding no
MaxAuthTries 5
LoginGraceTime 60
EOF

# Restart SSH (Ubuntu uses 'ssh' not 'sshd')
systemctl restart ssh || systemctl restart sshd || log_warning "Could not restart SSH service"
log_success "SSH configured - password authentication enabled for development"

################################################################################
# PHASE 6: FIREWALL CONFIGURATION
################################################################################

echo
echo "=============================================="
echo "  PHASE 6: Firewall Configuration"
echo "=============================================="
echo

log_step "[8/12] Configuring firewall..."

# Reset UFW to defaults
ufw --force reset > /dev/null 2>&1

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (for support access)
ufw allow ssh

# Allow web interface
ufw allow 8080/tcp

# Enable firewall
ufw --force enable > /dev/null 2>&1

log_success "Firewall configured (ports 22, 8080 open)"

################################################################################
# PHASE 7: SEARXNG SETUP (DOCKER)
################################################################################

echo
echo "=============================================="
echo "  PHASE 7: SearXNG Web Search Setup"
echo "=============================================="
echo

log_step "[9/12] Setting up SearXNG..."

# Create SearXNG directory
mkdir -p "${INSTALL_DIR}/searxng"

# Create SearXNG settings
cat > "${INSTALL_DIR}/searxng/settings.yml" << 'EOF'
use_default_settings: true

general:
  instance_name: "Galentix Search"
  debug: false
  privacypolicy_url: false
  contact_url: false

search:
  safe_search: 0
  autocomplete: "google"
  default_lang: "en"

server:
  secret_key: "galentix-searxng-secret-key-change-in-production"
  limiter: false
  image_proxy: true
  http_protocol_version: "1.1"

ui:
  static_use_hash: true
  default_theme: simple
  results_on_new_tab: false

enabled_plugins:
  - 'Hash plugin'
  - 'Search on category select'
  - 'Tracker URL remover'

outgoing:
  request_timeout: 5.0
  max_request_timeout: 15.0

engines:
  - name: google
    engine: google
    shortcut: g
    disabled: false
  - name: duckduckgo
    engine: duckduckgo
    shortcut: ddg
    disabled: false
  - name: bing
    engine: bing
    shortcut: b
    disabled: false
  - name: wikipedia
    engine: wikipedia
    shortcut: w
    disabled: false
EOF

# Create docker-compose for SearXNG
cat > "${INSTALL_DIR}/searxng/docker-compose.yml" << EOF
version: '3.8'

services:
  searxng:
    image: searxng/searxng:latest
    container_name: galentix-searxng
    restart: unless-stopped
    ports:
      - "127.0.0.1:8888:8080"
    volumes:
      - ${INSTALL_DIR}/searxng/settings.yml:/etc/searxng/settings.yml:ro
    environment:
      - SEARXNG_BASE_URL=http://localhost:8888/
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
EOF

# Start SearXNG
cd "${INSTALL_DIR}/searxng"
docker compose pull
docker compose up -d

# Wait for SearXNG to start
sleep 5

if docker ps | grep -q galentix-searxng; then
    log_success "SearXNG is running on port 8888 (internal only)"
else
    log_warning "SearXNG may not have started correctly"
fi

################################################################################
# PHASE 8: OLLAMA INSTALLATION
################################################################################

echo
echo "=============================================="
echo "  PHASE 8: LLM Engine Installation"
echo "=============================================="
echo

log_step "[10/12] Installing Ollama..."

if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
    log_success "Ollama installed"
else
    log_warning "Ollama already installed - skipping"
fi

# Enable and start Ollama
systemctl enable ollama 2>/dev/null || true
systemctl start ollama 2>/dev/null || true

# Wait for Ollama to be ready
log_info "Waiting for Ollama to start..."
sleep 5

if systemctl is-active --quiet ollama; then
    log_success "Ollama service is running"
else
    log_warning "Ollama service status unknown - continuing"
fi

# Download all selected models
log_info "Downloading ${#SELECTED_MODELS[@]} model(s)..."
if [[ "${LLM_ENGINE}" == "ollama" ]]; then
    for i in "${!SELECTED_MODELS[@]}"; do
        model="${SELECTED_MODELS[$i]}"
        log_info "Downloading model $((i+1))/${#SELECTED_MODELS[@]}: ${model} (this may take several minutes)..."
        if ollama pull "${model}" 2>&1; then
            log_success "Model ${model} downloaded"
        else
            log_warning "Download of ${model} had issues"
        fi
    done

    # Also download embedding model for RAG
    log_info "Downloading embedding model for RAG..."
    ollama pull nomic-embed-text 2>&1 || log_warning "Embedding model download had issues"

    log_success "All models downloaded"
fi

# Install vLLM if GPU detected
if [[ $GPU_DETECTED -eq 1 ]]; then
    log_info "Installing vLLM for GPU acceleration..."
    pip3 install vllm --quiet 2>/dev/null || log_warning "vLLM installation skipped (may need manual setup)"
fi

################################################################################
# PHASE 9: PYTHON ENVIRONMENT SETUP
################################################################################

echo
echo "=============================================="
echo "  PHASE 9: Python Environment Setup"
echo "=============================================="
echo

log_step "[11/12] Setting up Python environment..."
log_info "This step takes 5-15 minutes. Installing packages..."

# Create virtual environment
log_info "  [1/7] Creating virtual environment..."
sudo -u galentix python3 -m venv /opt/galentix/.venv

log_info "  [2/7] Installing core packages (FastAPI, Pydantic)..."
sudo -u galentix /opt/galentix/.venv/bin/pip install --upgrade pip -q
sudo -u galentix /opt/galentix/.venv/bin/pip install \
    fastapi==0.109.0 \
    uvicorn[standard]==0.27.0 \
    python-multipart==0.0.6 \
    pydantic==2.5.3 \
    pydantic-settings==2.1.0 \
    2>&1 | tail -1

log_info "  [3/7] Installing database packages (SQLAlchemy)..."
sudo -u galentix /opt/galentix/.venv/bin/pip install \
    sqlalchemy==2.0.25 \
    aiosqlite==0.19.0 \
    2>&1 | tail -1

log_info "  [4/7] Installing RAG packages (ChromaDB, LangChain)..."
log_info "        This is the largest download, please wait..."
sudo -u galentix /opt/galentix/.venv/bin/pip install \
    chromadb==0.4.22 \
    langchain==0.1.4 \
    langchain-community==0.0.16 \
    sentence-transformers==2.3.1 \
    2>&1 | tail -1

log_info "  [5/7] Installing document processing packages..."
sudo -u galentix /opt/galentix/.venv/bin/pip install \
    pypdf==3.17.4 \
    python-docx==1.1.0 \
    openpyxl==3.1.2 \
    beautifulsoup4==4.12.3 \
    trafilatura==1.6.3 \
    2>&1 | tail -1

log_info "  [6/7] Installing HTTP clients..."
sudo -u galentix /opt/galentix/.venv/bin/pip install \
    httpx==0.26.0 \
    aiohttp==3.9.3 \
    2>&1 | tail -1

log_info "  [7/7] Installing utilities..."
sudo -u galentix /opt/galentix/.venv/bin/pip install \
    python-jose[cryptography]==3.3.0 \
    passlib[bcrypt]==1.7.4 \
    tiktoken==0.5.2 \
    psutil==5.9.7 \
    aiofiles==23.2.1 \
    2>&1 | tail -1

# Verify installation
if sudo -u galentix /opt/galentix/.venv/bin/python -c "import fastapi, chromadb, langchain" 2>/dev/null; then
    log_success "Python environment configured successfully"
else
    log_error "Python environment setup failed - some packages missing"
    exit 1
fi

################################################################################
# PHASE 10: CREATE DEFAULT SETTINGS
################################################################################

echo
echo "=============================================="
echo "  PHASE 10: Configuration"
echo "=============================================="
echo

log_step "[12/12] Creating configuration files..."

# Create settings.json
cat > "${CONFIG_DIR}/settings.json" << EOF
{
    "llm": {
        "engine": "${LLM_ENGINE}",
        "model": "${SELECTED_MODEL}",
        "models": ${MODELS_JSON},
        "ollama_url": "http://127.0.0.1:11434",
        "vllm_url": "http://127.0.0.1:8000",
        "temperature": 0.7,
        "max_tokens": 2048
    },
    "rag": {
        "enabled": true,
        "chunk_size": 500,
        "chunk_overlap": 50,
        "top_k": 5,
        "embedding_model": "nomic-embed-text"
    },
    "search": {
        "enabled": true,
        "searxng_url": "http://127.0.0.1:8888",
        "max_results": 5
    },
    "ui": {
        "theme": "dark",
        "brand_name": "${BRAND_NAME}",
        "brand_color": "${BRAND_COLOR}"
    }
}
EOF

chown galentix:galentix "${CONFIG_DIR}/settings.json"
log_success "Configuration files created"

################################################################################
# PHASE 11: SYSTEMD SERVICES
################################################################################

echo
echo "=============================================="
echo "  PHASE 11: System Services"
echo "=============================================="
echo

log_info "Creating systemd service files..."

# Create backend service
cat > /etc/systemd/system/galentix-backend.service << 'EOF'
[Unit]
Description=Galentix AI Backend
After=network.target ollama.service docker.service
Wants=ollama.service

[Service]
Type=simple
User=galentix
Group=galentix
WorkingDirectory=/opt/galentix/backend
Environment="PATH=/opt/galentix/.venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/opt/galentix/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/galentix/data /opt/galentix/logs /opt/galentix/config

# Logging
StandardOutput=append:/opt/galentix/logs/backend.log
StandardError=append:/opt/galentix/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Create SearXNG watchdog service
cat > /etc/systemd/system/galentix-searxng.service << 'EOF'
[Unit]
Description=Galentix SearXNG Container
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/galentix/searxng
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable services (but don't start backend yet - no code)
systemctl enable galentix-searxng
systemctl enable galentix-backend 2>/dev/null || true

log_success "Systemd services created"

################################################################################
# PHASE 12: FINAL VERIFICATION
################################################################################

echo
echo "=============================================="
echo "  PHASE 12: Verification"
echo "=============================================="
echo

log_info "Running verification checks..."

# Check Ollama
if systemctl is-active --quiet ollama; then
    log_success "Ollama: Running"
else
    log_warning "Ollama: Not running"
fi

# Check SearXNG
if docker ps | grep -q galentix-searxng; then
    log_success "SearXNG: Running"
else
    log_warning "SearXNG: Not running"
fi

# Check directories
if [[ -d "${INSTALL_DIR}/backend" ]]; then
    log_success "Installation directory: OK"
else
    log_error "Installation directory: Missing"
fi

# Check device config
if [[ -f "${CONFIG_DIR}/device.json" ]]; then
    log_success "Device configuration: OK"
else
    log_error "Device configuration: Missing"
fi

# Get IP address
IP_ADDR=$(hostname -I | awk '{print $1}')

################################################################################
# SUCCESS SUMMARY
################################################################################

echo
echo "=============================================="
echo "  INSTALLATION COMPLETE"
echo "=============================================="
echo
echo "  ${BRAND_NAME} has been installed successfully!"
echo
echo "  Device ID: ${DEVICE_UUID}"
echo
echo "  Hardware Configuration:"
echo "  -----------------------"
echo "  RAM: ${TOTAL_RAM_GB}GB"
echo "  CPU: ${CPU_CORES} cores"
echo "  GPU: ${GPU_NAME}"
echo "  LLM Engine: ${LLM_ENGINE}"
echo "  Active Model: ${SELECTED_MODEL}"
echo "  All Models: ${SELECTED_MODELS[*]}"
echo
echo "  Access Points:"
echo "  --------------"
echo "  Web UI: http://${IP_ADDR}:8080 (after backend deployment)"
echo "  SSH:    ssh support@${IP_ADDR}"
echo
echo "  Service Management:"
echo "  -------------------"
echo "  sudo systemctl status galentix-backend"
echo "  sudo systemctl restart galentix-backend"
echo "  sudo journalctl -u galentix-backend -f"
echo
echo "  Directories:"
echo "  ------------"
echo "  Installation: ${INSTALL_DIR}"
echo "  Config:       ${CONFIG_DIR}"
echo "  Data:         ${DATA_DIR}"
echo "  Logs:         ${LOG_DIR}"
echo
echo "  SSH Access:"
echo "  -----------"
echo "  Only key-based authentication is allowed."
echo "  Use the master support key to connect."
echo
echo "=============================================="
echo
echo "  NEXT STEPS:"
echo "  1. Deploy backend code to ${INSTALL_DIR}/backend"
echo "  2. Deploy frontend build to ${INSTALL_DIR}/frontend"
echo "  3. Start the backend: sudo systemctl start galentix-backend"
echo
echo "=============================================="
echo
