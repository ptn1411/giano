#!/bin/bash

# ===========================================
# Deploy Script for Ubuntu VPS
# Creates systemd service for Messages API
# ===========================================

set -e

echo "=========================================="
echo "Messages API - Ubuntu Deploy Script"
echo "=========================================="

# Variables - CUSTOMIZE THESE
SERVICE_NAME="messages-api"
DEPLOY_DIR="/var/www/messages-api"
BINARY_NAME="messages-api"
USER="www-data"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Create deploy directory
echo -e "\n${GREEN}[1/5] Creating deploy directory...${NC}"
sudo mkdir -p ${DEPLOY_DIR}
sudo chown ${USER}:${USER} ${DEPLOY_DIR}

# Step 2: Copy binary
echo -e "\n${GREEN}[2/5] Copying binary...${NC}"
if [ -f "target/x86_64-unknown-linux-gnu/release/chat-backend" ]; then
    sudo cp target/x86_64-unknown-linux-gnu/release/chat-backend ${DEPLOY_DIR}/${BINARY_NAME}
elif [ -f "target/release/chat-backend" ]; then
    sudo cp target/release/chat-backend ${DEPLOY_DIR}/${BINARY_NAME}
elif [ -f "chat-backend" ]; then
    sudo cp chat-backend ${DEPLOY_DIR}/${BINARY_NAME}
else
    echo "Error: Binary not found!"
    exit 1
fi
sudo chmod +x ${DEPLOY_DIR}/${BINARY_NAME}
echo "Binary copied to ${DEPLOY_DIR}/${BINARY_NAME}"

# Step 3: Copy .env file
echo -e "\n${GREEN}[3/5] Copying environment file...${NC}"
if [ -f ".env.prod" ]; then
    sudo cp .env.prod ${DEPLOY_DIR}/.env
    echo "Copied .env.prod to ${DEPLOY_DIR}/.env"
elif [ -f ".env" ]; then
    sudo cp .env ${DEPLOY_DIR}/.env
    echo "Copied .env to ${DEPLOY_DIR}/.env"
fi
sudo chown ${USER}:${USER} ${DEPLOY_DIR}/.env

# Step 4: Create systemd service
echo -e "\n${GREEN}[4/5] Creating systemd service...${NC}"

sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=Messages API (Rust)
After=network.target postgresql.service redis-server.service

[Service]
User=${USER}
WorkingDirectory=${DEPLOY_DIR}
ExecStart=${DEPLOY_DIR}/${BINARY_NAME}
Restart=always
RestartSec=5
Environment=RUST_LOG=info

# Load environment from file
EnvironmentFile=${DEPLOY_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF

echo "Service file created at /etc/systemd/system/${SERVICE_NAME}.service"

# Step 5: Enable and start service
echo -e "\n${GREEN}[5/5] Starting service...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

# Show status
echo ""
echo "=========================================="
echo -e "${GREEN}Deployment completed!${NC}"
echo "=========================================="
sudo systemctl status ${SERVICE_NAME} --no-pager

echo ""
echo "Useful commands:"
echo "  sudo systemctl status ${SERVICE_NAME}    # Check status"
echo "  sudo systemctl restart ${SERVICE_NAME}   # Restart"
echo "  sudo systemctl stop ${SERVICE_NAME}      # Stop"
echo "  sudo journalctl -u ${SERVICE_NAME} -f    # View logs"
echo ""
echo "API running at: http://0.0.0.0:3000"
echo ""
