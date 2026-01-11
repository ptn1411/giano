#!/bin/bash

# ===========================================
# Build & Deploy Script for Messages API
# Uses .env.prod configuration
# Auto deploys to /var/www/messages-api
# ===========================================

set -e

echo "=========================================="
echo "Messages API - Build & Deploy on VPS"
echo "Using .env.prod configuration"
echo "=========================================="

# Copy .env.prod to .env
if [ -f ".env.prod" ]; then
    cp .env.prod .env
    echo "✓ Copied .env.prod to .env"
else
    echo "Error: .env.prod not found!"
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Build release
echo ""
echo "Building release binary..."
cargo build --release

echo ""
echo "=========================================="
echo "Build completed! Deploying..."
echo "=========================================="

# Deploy to /var/www/messages-api
DEPLOY_DIR="/var/www/messages-api"

# Stop service before copying (avoid "Text file busy" error)
echo "Stopping messages-api service..."
sudo systemctl stop messages-api 2>/dev/null || true

# Create directory if not exists
sudo mkdir -p $DEPLOY_DIR
sudo mkdir -p $DEPLOY_DIR/uploads

# Copy binary (rename from chat-backend to messages-api)
sudo cp ./target/release/chat-backend $DEPLOY_DIR/messages-api
sudo chmod +x $DEPLOY_DIR/messages-api

# Copy .env.prod
sudo cp .env.prod $DEPLOY_DIR/.env

# Set permissions
sudo chown -R www-data:www-data $DEPLOY_DIR
sudo chmod 755 $DEPLOY_DIR/uploads

echo "✓ Deployed to $DEPLOY_DIR"

# Restart service
echo ""
echo "Restarting messages-api service..."
sudo systemctl daemon-reload
sudo systemctl restart messages-api

# Check status
sleep 2
if sudo systemctl is-active --quiet messages-api; then
    echo "✓ messages-api service is running"
else
    echo "✗ messages-api service failed to start"
    sudo systemctl status messages-api --no-pager
    exit 1
fi

echo ""
echo "=========================================="
echo "Deployment completed!"
echo "=========================================="
echo ""
echo "Service: messages-api"
echo "Binary: $DEPLOY_DIR/messages-api"
echo "Logs: sudo journalctl -u messages-api -f"
echo ""
