#!/bin/bash

# ===========================================
# Simple Build Script for Ubuntu VPS
# Uses .env.prod configuration
# ===========================================

set -e

echo "=========================================="
echo "Chat Backend - Build on VPS"
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
echo "Build completed!"
echo "=========================================="
echo ""
echo "Binary: ./target/release/chat-backend"
echo ""
echo "To run:"
echo "  ./target/release/chat-backend"
echo ""
