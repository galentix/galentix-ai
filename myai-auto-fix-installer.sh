#!/usr/bin/env bash
set -euo pipefail

################################################################################
#                                                                              #
#  MyAI Appliance Auto-Fix Installer                                          #
#  Automatically diagnoses and fixes installation issues                      #
#                                                                              #
################################################################################

echo "=========================================="
echo "  MyAI Appliance Auto-Fix Installer"
echo "  Model: tinyllama"
echo "=========================================="
echo

# تأكد إننا root
if [[ "$EUID" -ne 0 ]]; then
  echo "❌ Error: This script must be run as root"
  echo "   Run: sudo ./myai-auto-fix-installer.sh"
  exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}▶${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

################################################################################
# PHASE 1: DIAGNOSIS
################################################################################

echo
echo "=========================================="
echo "  PHASE 1: System Diagnosis"
echo "=========================================="
echo

ISSUES_FOUND=0

# Check 1: Verify apt-get exists
log_info "Checking package manager..."
if [[ -f /usr/bin/apt-get ]]; then
  log_success "apt-get found at /usr/bin/apt-get"
else
  log_error "apt-get not found - cannot continue"
  exit 1
fi

# Check 2: Look for aliases
log_info "Checking for shell aliases..."
if alias apt-get 2>/dev/null | grep -q "curl"; then
  log_warning "Found problematic alias for apt-get"
  echo "   Alias: $(alias apt-get)"
  ((ISSUES_FOUND++))
  ALIAS_ISSUE=1
else
  log_success "No problematic aliases found"
  ALIAS_ISSUE=0
fi

# Check 3: Check for functions
log_info "Checking for shell functions..."
if declare -f apt-get >/dev/null 2>&1; then
  log_warning "Found function override for apt-get"
  ((ISSUES_FOUND++))
  FUNCTION_ISSUE=1
else
  log_success "No function overrides found"
  FUNCTION_ISSUE=0
fi

# Check 4: Test apt-get directly
log_info "Testing apt-get execution..."
if /usr/bin/apt-get --version >/dev/null 2>&1; then
  log_success "apt-get executes correctly"
else
  log_error "apt-get cannot execute"
  exit 1
fi

# Check 5: Network connectivity
log_info "Checking network connectivity..."
if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
  log_success "Network connectivity OK"
else
  log_warning "Network connectivity issues detected"
  ((ISSUES_FOUND++))
fi

echo
if [[ $ISSUES_FOUND -eq 0 ]]; then
  log_success "No issues detected - proceeding with standard installation"
else
  log_warning "Found $ISSUES_FOUND issue(s) - applying auto-fix"
fi

################################################################################
# PHASE 2: AUTO-FIX
################################################################################

echo
echo "=========================================="
echo "  PHASE 2: Auto-Fix & Cleanup"
echo "=========================================="
echo

# Fix 1: Clear all aliases
log_info "Clearing shell aliases..."
unalias -a 2>/dev/null || true
log_success "Aliases cleared"

# Fix 2: Unset any apt-get functions
if [[ $FUNCTION_ISSUE -eq 1 ]]; then
  log_info "Removing function overrides..."
  unset -f apt-get 2>/dev/null || true
  log_success "Functions cleared"
fi

# Fix 3: Set safe PATH
log_info "Setting secure PATH..."
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
log_success "PATH secured"

################################################################################
# PHASE 3: INSTALLATION
################################################################################

echo
echo "=========================================="
echo "  PHASE 3: MyAI Installation"
echo "=========================================="
echo

# Use absolute paths for all commands to avoid any shell trickery
APT="/usr/bin/apt-get"
CURL="/usr/bin/curl"

# ------------------------------------
# Step 1: Update system
# ------------------------------------
log_info "[1/8] Updating system and installing packages..."

$APT update -qq
$APT upgrade -y -qq

# Install packages one by one for better error tracking
PACKAGES="curl wget git htop unzip ca-certificates gnupg ufw python3 python3-venv python3-pip"

for pkg in $PACKAGES; do
  log_info "  Installing $pkg..."
  if $APT install -y -qq $pkg 2>&1 | grep -q "E:"; then
    log_error "Failed to install $pkg"
    exit 1
  fi
done

log_success "All packages installed successfully"

# Verify curl is now available
if ! command -v curl >/dev/null 2>&1; then
  log_error "curl installation failed"
  exit 1
fi

# Update CURL to use the newly installed one
CURL=$(which curl)

# ------------------------------------
# Step 2: Create AI user
# ------------------------------------
log_info "[2/8] Creating AI user and directories..."

if ! id ai >/dev/null 2>&1; then
  useradd -r -m -d /opt/myai -s /usr/sbin/nologin ai
  log_success "User 'ai' created"
else
  log_warning "User 'ai' already exists - skipping"
fi

mkdir -p /opt/myai/{bin,models,logs,config}
chown -R ai:ai /opt/myai
log_success "Directories created and permissions set"

# ------------------------------------
# Step 3: Install Ollama
# ------------------------------------
log_info "[3/8] Installing Ollama..."

if ! command -v ollama >/dev/null 2>&1; then
  $CURL -fsSL https://ollama.com/install.sh | sh
  log_success "Ollama installed"
else
  log_warning "Ollama already installed - skipping"
fi

systemctl enable ollama >/dev/null 2>&1 || true
systemctl start ollama >/dev/null 2>&1 || true

# Wait for Ollama to be ready
log_info "Waiting for Ollama to start..."
sleep 5

if systemctl is-active --quiet ollama; then
  log_success "Ollama service is running"
else
  log_warning "Ollama service status unknown - continuing anyway"
fi

# ------------------------------------
# Step 4: Download model
# ------------------------------------
log_info "[4/8] Downloading tinyllama model (this may take a few minutes)..."

if ollama pull tinyllama 2>&1; then
  log_success "Model downloaded successfully"
else
  log_warning "Model download had issues - may retry later"
fi

# ------------------------------------
# Step 5: Python environment
# ------------------------------------
log_info "[5/8] Setting up Python virtual environment..."

sudo -u ai bash <<'EOF'
set -e
cd /opt/myai
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install fastapi uvicorn requests --quiet
EOF

if [[ $? -eq 0 ]]; then
  log_success "Python environment configured"
else
  log_error "Python environment setup failed"
  exit 1
fi

# ------------------------------------
# Step 6: Create Web UI
# ------------------------------------
log_info "[6/8] Creating web interface..."

sudo -u ai tee /opt/myai/app.py >/dev/null <<'PYTHON_EOF'
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
import requests

app = FastAPI()
OLLAMA = "http://127.0.0.1:11434"
MODEL = "tinyllama"

HTML = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MyAI Appliance</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h2 {
      color: #333;
      margin-top: 0;
    }
    #q {
      width: 100%;
      padding: 12px;
      font-size: 16px;
      border: 2px solid #ddd;
      border-radius: 5px;
      box-sizing: border-box;
    }
    button {
      margin-top: 10px;
      padding: 12px 30px;
      font-size: 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    }
    button:hover {
      background: #0056b3;
    }
    #out {
      margin-top: 20px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 5px;
      white-space: pre-wrap;
      min-height: 100px;
      font-family: monospace;
    }
    .loading {
      color: #666;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>🤖 MyAI Appliance</h2>
    <p>Ask me anything - I'm running locally on this device!</p>
    <form id="f">
      <input id="q" placeholder="Type your question here..." autocomplete="off">
      <button type="submit">Ask AI</button>
    </form>
    <pre id="out"></pre>
  </div>
  <script>
    const form = document.getElementById('f');
    const input = document.getElementById('q');
    const output = document.getElementById('out');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const question = input.value.trim();
      if (!question) return;

      output.className = 'loading';
      output.innerText = 'Thinking...';

      try {
        const response = await fetch('/chat', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({prompt: question})
        });

        const answer = await response.text();
        output.className = '';
        output.innerText = answer || 'No response received';
      } catch (error) {
        output.className = '';
        output.innerText = 'Error: ' + error.message;
      }
    };
  </script>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
def home():
    return HTML

@app.post("/chat")
def chat(body: dict):
    try:
        r = requests.post(
            f"{OLLAMA}/api/generate",
            json={
                "model": MODEL,
                "prompt": body.get("prompt", ""),
                "stream": False
            },
            timeout=120
        )
        return r.json().get("response", "No response from AI")
    except Exception as e:
        return f"Error: {str(e)}"

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL}
PYTHON_EOF

chown ai:ai /opt/myai/app.py
log_success "Web interface created"

# ------------------------------------
# Step 7: Systemd service
# ------------------------------------
log_info "[7/8] Creating systemd service..."

tee /etc/systemd/system/myai-web.service >/dev/null <<'SERVICE_EOF'
[Unit]
Description=MyAI Web UI
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=ai
WorkingDirectory=/opt/myai
ExecStart=/opt/myai/.venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=5
StandardOutput=append:/opt/myai/logs/web.log
StandardError=append:/opt/myai/logs/web-error.log

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable myai-web >/dev/null 2>&1
systemctl start myai-web

# Wait for service to start
sleep 3

if systemctl is-active --quiet myai-web; then
  log_success "Web service is running"
else
  log_error "Web service failed to start"
  echo "   Check logs: journalctl -u myai-web -n 50"
  exit 1
fi

# ------------------------------------
# Step 8: Firewall
# ------------------------------------
log_info "[8/8] Configuring firewall..."

ufw allow ssh >/dev/null 2>&1 || log_warning "UFW SSH rule not added"
ufw allow 8080/tcp >/dev/null 2>&1 || log_warning "UFW not available or already configured"
ufw --force enable >/dev/null 2>&1 || log_warning "UFW not enabled"

log_success "Firewall configured"

################################################################################
# PHASE 4: VERIFICATION
################################################################################

echo
echo "=========================================="
echo "  PHASE 4: Verification"
echo "=========================================="
echo

# Check if service is responding
log_info "Testing web service..."
sleep 2

if curl -s http://localhost:8080/health >/dev/null 2>&1; then
  log_success "Web service is responding"
else
  log_warning "Web service not responding yet - may need more time"
fi

# Get IP address
IP=$(hostname -I | awk '{print $1}')

################################################################################
# SUCCESS
################################################################################

echo
echo "=========================================="
echo "  ✅ Installation Complete!"
echo "=========================================="
echo
echo "  🌐 Access your AI appliance at:"
echo "     http://${IP}:8080"
echo
echo "  📊 Service Management:"
echo "     sudo systemctl status myai-web"
echo "     sudo systemctl restart myai-web"
echo "     sudo journalctl -u myai-web -f"
echo
echo "  📁 Installation Directory:"
echo "     /opt/myai"
echo
echo "  🔍 Logs:"
echo "     /opt/myai/logs/web.log"
echo "     /opt/myai/logs/web-error.log"
echo
echo "=========================================="
echo

# Show diagnostic summary
if [[ $ISSUES_FOUND -gt 0 ]]; then
  echo "📋 Diagnostic Summary:"
  echo "   Issues detected and fixed: $ISSUES_FOUND"
  [[ $ALIAS_ISSUE -eq 1 ]] && echo "   - Shell alias interference (fixed)"
  [[ $FUNCTION_ISSUE -eq 1 ]] && echo "   - Function override (fixed)"
  echo
fi

echo "🎉 Your local AI appliance is ready!"
echo
