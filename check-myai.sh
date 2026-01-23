#!/usr/bin/env bash

echo "=========================================="
echo "  MyAI Web Interface Checker"
echo "=========================================="
echo

# Get IP address
IP=$(hostname -I | awk '{print $1}')

echo "🌐 Your server IP: $IP"
echo

# Check service status
echo "📊 Service Status:"
if systemctl is-active --quiet myai-web; then
  echo "   ✅ myai-web service is RUNNING"
else
  echo "   ❌ myai-web service is NOT running"
  echo "   Try: sudo systemctl start myai-web"
fi
echo

# Check Ollama
echo "🤖 Ollama Status:"
if systemctl is-active --quiet ollama; then
  echo "   ✅ ollama service is RUNNING"
else
  echo "   ❌ ollama service is NOT running"
  echo "   Try: sudo systemctl start ollama"
fi
echo

# Check port
echo "🔌 Port Check:"
if sudo lsof -i :8080 >/dev/null 2>&1; then
  echo "   ✅ Port 8080 is OPEN and listening"
  echo "   Process: $(sudo lsof -i :8080 | grep LISTEN | awk '{print $1}')"
else
  echo "   ❌ Port 8080 is NOT listening"
fi
echo

# Test health endpoint
echo "🏥 Health Check:"
if curl -s http://localhost:8080/health >/dev/null 2>&1; then
  HEALTH=$(curl -s http://localhost:8080/health)
  echo "   ✅ Web interface is responding"
  echo "   Response: $HEALTH"
else
  echo "   ❌ Web interface is NOT responding"
fi
echo

# Test AI chat
echo "🧪 AI Test:"
RESPONSE=$(curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello"}' 2>/dev/null)

if [[ -n "$RESPONSE" ]]; then
  echo "   ✅ AI is responding"
  echo "   Sample response: ${RESPONSE:0:100}..."
else
  echo "   ❌ AI is NOT responding"
fi
echo

# Summary
echo "=========================================="
echo "  Access URLs"
echo "=========================================="
echo
echo "  From this server:"
echo "     http://localhost:8080"
echo
echo "  From your browser:"
echo "     http://$IP:8080"
echo
echo "  From other devices on your network:"
echo "     http://$IP:8080"
echo
echo "=========================================="
echo

# Show logs if there are errors
if ! systemctl is-active --quiet myai-web; then
  echo "⚠️  Service not running. Recent logs:"
  echo "---"
  sudo journalctl -u myai-web -n 20 --no-pager
fi
