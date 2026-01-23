#!/usr/bin/env bash
set -euo pipefail

################################################################################
#                                                                              #
#  Galentix AI Update Script                                                   #
#  Version: 2.0.0                                                              #
#                                                                              #
#  Usage:                                                                      #
#    sudo ./galentix-update.sh                      # Interactive update       #
#    sudo ./galentix-update.sh --from-url <url>     # Update from URL          #
#    sudo ./galentix-update.sh --from-file <path>   # Update from local file   #
#                                                                              #
################################################################################

VERSION="2.0.0"
INSTALL_DIR="/opt/galentix"
BACKUP_DIR="/opt/galentix-backups"
CONFIG_DIR="${INSTALL_DIR}/config"
LOG_FILE="${INSTALL_DIR}/logs/update.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1" | tee -a "$LOG_FILE"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; }

################################################################################
# ROOT CHECK
################################################################################

if [[ "$EUID" -ne 0 ]]; then
    echo "ERROR: This script must be run as root"
    echo "Run: sudo ./galentix-update.sh"
    exit 1
fi

################################################################################
# PARSE ARGUMENTS
################################################################################

UPDATE_SOURCE=""
UPDATE_URL=""
UPDATE_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --from-url)
            UPDATE_SOURCE="url"
            UPDATE_URL="$2"
            shift 2
            ;;
        --from-file)
            UPDATE_SOURCE="file"
            UPDATE_FILE="$2"
            shift 2
            ;;
        --help|-h)
            echo "Galentix AI Update Script"
            echo ""
            echo "Usage:"
            echo "  sudo ./galentix-update.sh                      Interactive mode"
            echo "  sudo ./galentix-update.sh --from-url <url>     Update from URL"
            echo "  sudo ./galentix-update.sh --from-file <path>   Update from local file"
            echo ""
            echo "The update package should be a .tar.gz file containing:"
            echo "  - backend/     (Python FastAPI backend)"
            echo "  - frontend/    (Built React frontend)"
            echo "  - version.txt  (Version information)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

################################################################################
# HEADER
################################################################################

echo "=============================================="
echo "    Galentix AI Update Tool"
echo "    Version: ${VERSION}"
echo "=============================================="
echo

# Initialize log
mkdir -p "$(dirname "$LOG_FILE")"
echo "=== Update started at $(date) ===" >> "$LOG_FILE"

################################################################################
# INTERACTIVE MODE
################################################################################

if [[ -z "$UPDATE_SOURCE" ]]; then
    echo "Select update source:"
    echo "  1) Download from URL"
    echo "  2) Local file (USB or downloaded)"
    echo "  3) Cancel"
    echo
    read -p "Choice [1-3]: " choice
    
    case $choice in
        1)
            UPDATE_SOURCE="url"
            read -p "Enter update URL: " UPDATE_URL
            ;;
        2)
            UPDATE_SOURCE="file"
            read -p "Enter file path: " UPDATE_FILE
            ;;
        *)
            echo "Update cancelled."
            exit 0
            ;;
    esac
fi

################################################################################
# VALIDATION
################################################################################

log_info "Validating update source..."

TEMP_DIR=$(mktemp -d)
UPDATE_PACKAGE="${TEMP_DIR}/galentix-update.tar.gz"

if [[ "$UPDATE_SOURCE" == "url" ]]; then
    if [[ -z "$UPDATE_URL" ]]; then
        log_error "No URL provided"
        exit 1
    fi
    
    log_info "Downloading update from: ${UPDATE_URL}"
    if ! curl -fsSL "$UPDATE_URL" -o "$UPDATE_PACKAGE"; then
        log_error "Failed to download update package"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    log_success "Download complete"
    
elif [[ "$UPDATE_SOURCE" == "file" ]]; then
    if [[ ! -f "$UPDATE_FILE" ]]; then
        log_error "File not found: ${UPDATE_FILE}"
        exit 1
    fi
    
    log_info "Using local file: ${UPDATE_FILE}"
    cp "$UPDATE_FILE" "$UPDATE_PACKAGE"
fi

# Verify it's a valid tar.gz
if ! tar -tzf "$UPDATE_PACKAGE" &> /dev/null; then
    log_error "Invalid update package (not a valid tar.gz)"
    rm -rf "$TEMP_DIR"
    exit 1
fi

log_success "Update package validated"

################################################################################
# EXTRACT & VERIFY
################################################################################

log_info "Extracting update package..."

EXTRACT_DIR="${TEMP_DIR}/extracted"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$UPDATE_PACKAGE" -C "$EXTRACT_DIR"

# Check for required components
if [[ ! -d "${EXTRACT_DIR}/backend" ]]; then
    log_error "Update package missing 'backend' directory"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Read new version if available
NEW_VERSION="unknown"
if [[ -f "${EXTRACT_DIR}/version.txt" ]]; then
    NEW_VERSION=$(cat "${EXTRACT_DIR}/version.txt")
fi

log_success "Package extracted (version: ${NEW_VERSION})"

################################################################################
# BACKUP CURRENT INSTALLATION
################################################################################

log_info "Creating backup of current installation..."

mkdir -p "$BACKUP_DIR"
BACKUP_NAME="galentix-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Backup backend and frontend (not data)
tar -czf "$BACKUP_PATH" \
    -C "$INSTALL_DIR" \
    backend frontend config/settings.json 2>/dev/null || true

if [[ -f "$BACKUP_PATH" ]]; then
    log_success "Backup created: ${BACKUP_PATH}"
else
    log_warning "Backup may be incomplete (this might be first install)"
fi

################################################################################
# STOP SERVICES
################################################################################

log_info "Stopping services..."

systemctl stop galentix-backend 2>/dev/null || true
sleep 2

log_success "Services stopped"

################################################################################
# APPLY UPDATE
################################################################################

log_info "Applying update..."

# Update backend
if [[ -d "${EXTRACT_DIR}/backend" ]]; then
    log_info "Updating backend..."
    rm -rf "${INSTALL_DIR}/backend.old"
    mv "${INSTALL_DIR}/backend" "${INSTALL_DIR}/backend.old" 2>/dev/null || true
    cp -r "${EXTRACT_DIR}/backend" "${INSTALL_DIR}/backend"
    chown -R galentix:galentix "${INSTALL_DIR}/backend"
    log_success "Backend updated"
fi

# Update frontend
if [[ -d "${EXTRACT_DIR}/frontend" ]]; then
    log_info "Updating frontend..."
    rm -rf "${INSTALL_DIR}/frontend.old"
    mv "${INSTALL_DIR}/frontend" "${INSTALL_DIR}/frontend.old" 2>/dev/null || true
    cp -r "${EXTRACT_DIR}/frontend" "${INSTALL_DIR}/frontend"
    chown -R galentix:galentix "${INSTALL_DIR}/frontend"
    log_success "Frontend updated"
fi

# Update Python dependencies if requirements.txt changed
if [[ -f "${EXTRACT_DIR}/backend/requirements.txt" ]]; then
    log_info "Updating Python dependencies..."
    sudo -u galentix bash -c "
        source ${INSTALL_DIR}/.venv/bin/activate
        pip install -r ${INSTALL_DIR}/backend/requirements.txt --quiet
    " 2>/dev/null || log_warning "Some dependencies may not have updated"
    log_success "Dependencies updated"
fi

################################################################################
# DATABASE MIGRATIONS
################################################################################

if [[ -f "${INSTALL_DIR}/backend/migrate.py" ]]; then
    log_info "Running database migrations..."
    sudo -u galentix bash -c "
        source ${INSTALL_DIR}/.venv/bin/activate
        cd ${INSTALL_DIR}/backend
        python migrate.py
    " 2>/dev/null || log_warning "Migrations may need manual attention"
    log_success "Migrations complete"
fi

################################################################################
# START SERVICES
################################################################################

log_info "Starting services..."

systemctl start galentix-backend

# Wait for service to start
sleep 3

if systemctl is-active --quiet galentix-backend; then
    log_success "Backend service started"
else
    log_error "Backend service failed to start"
    log_info "Check logs: journalctl -u galentix-backend -n 50"
    
    # Attempt rollback
    log_warning "Attempting rollback..."
    if [[ -d "${INSTALL_DIR}/backend.old" ]]; then
        rm -rf "${INSTALL_DIR}/backend"
        mv "${INSTALL_DIR}/backend.old" "${INSTALL_DIR}/backend"
        systemctl start galentix-backend
        log_info "Rollback complete - please check system status"
    fi
fi

################################################################################
# CLEANUP
################################################################################

log_info "Cleaning up..."

rm -rf "$TEMP_DIR"
rm -rf "${INSTALL_DIR}/backend.old" 2>/dev/null || true
rm -rf "${INSTALL_DIR}/frontend.old" 2>/dev/null || true

# Keep only last 5 backups
cd "$BACKUP_DIR"
ls -t galentix-backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f

log_success "Cleanup complete"

################################################################################
# HEALTH CHECK
################################################################################

log_info "Running health check..."

sleep 2

IP_ADDR=$(hostname -I | awk '{print $1}')

if curl -s "http://localhost:8080/api/health" &> /dev/null; then
    log_success "Health check passed"
else
    log_warning "Health check inconclusive - service may still be starting"
fi

################################################################################
# COMPLETE
################################################################################

echo
echo "=============================================="
echo "  UPDATE COMPLETE"
echo "=============================================="
echo
echo "  New Version: ${NEW_VERSION}"
echo "  Backup:      ${BACKUP_PATH}"
echo
echo "  Web UI: http://${IP_ADDR}:8080"
echo
echo "  Check status: sudo systemctl status galentix-backend"
echo "  View logs:    sudo journalctl -u galentix-backend -f"
echo
echo "=============================================="
echo

echo "=== Update completed at $(date) ===" >> "$LOG_FILE"
