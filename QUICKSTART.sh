#!/usr/bin/env bash

################################################################################
#                                                                              #
#  Galentix AI - Quick Start Script                                            #
#  This script automates the complete installation in one command             #
#                                                                              #
################################################################################

set -e

RESET='\033[0m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'

echo -e "${BLUE}════════════════════════════════════════${RESET}"
echo -e "${BLUE}    Galentix AI - Quick Start${RESET}"
echo -e "${BLUE}════════════════════════════════════════${RESET}"
echo ""

# Check if running as root for installer
if [[ "$EUID" -ne 0 ]]; then
    echo -e "${YELLOW}This script will need sudo privileges${RESET}"
fi

# Step 1: Clone repository
echo -e "${GREEN}[1/6]${RESET} Cloning repository..."
cd /tmp
if [ -d "galentix-ai" ]; then
    cd galentix-ai
    git pull -q
else
    git clone -q https://github.com/galentix/galentix-ai.git
    cd galentix-ai
fi

# Step 2: Fix line endings
echo -e "${GREEN}[2/6]${RESET} Preparing installer..."
sed -i 's/\r$//' galentix-installer.sh
chmod +x galentix-installer.sh

# Step 3: Run installer
echo -e "${GREEN}[3/6]${RESET} Running system installer (this may take 15-30 minutes)..."
sudo ./galentix-installer.sh

# Step 4: Deploy backend
echo -e "${GREEN}[4/6]${RESET} Deploying backend..."
sudo cp -r backend /opt/galentix/
sudo chown -R galentix:galentix /opt/galentix/backend

# Step 5: Deploy and build frontend
echo -e "${GREEN}[5/6]${RESET} Deploying and building frontend..."
sudo cp -r frontend /opt/galentix/
sudo chown -R galentix:galentix /opt/galentix/frontend
sudo -u galentix npm install --prefix /opt/galentix/frontend -q
sudo -u galentix npm run build --prefix /opt/galentix/frontend

# Step 6: Start services
echo -e "${GREEN}[6/6]${RESET} Starting services..."
sudo systemctl start galentix-backend

# Get IP address
IP=$(hostname -I | awk '{print $1}')

# Print summary
echo ""
echo -e "${BLUE}════════════════════════════════════════${RESET}"
echo -e "${GREEN}✓ Installation Complete!${RESET}"
echo -e "${BLUE}════════════════════════════════════════${RESET}"
echo ""
echo -e "${YELLOW}Access Galentix AI:${RESET}"
echo -e "  ${BLUE}http://${IP}:8080${RESET}"
echo ""
echo -e "${YELLOW}Useful Commands:${RESET}"
echo -e "  View logs:     ${BLUE}sudo journalctl -u galentix-backend -f${RESET}"
echo -e "  Check status:  ${BLUE}sudo systemctl status galentix-backend${RESET}"
echo -e "  Restart:       ${BLUE}sudo systemctl restart galentix-backend${RESET}"
echo ""
echo -e "${YELLOW}SSH Access:${RESET}"
echo -e "  ${BLUE}ssh ubuntu@${IP}${RESET}"
echo ""
echo -e "${YELLOW}Next Steps:${RESET}"
echo "  1. Open http://${IP}:8080 in your browser"
echo "  2. Go to Documents page and upload a PDF"
echo "  3. Ask questions about your documents"
echo ""
