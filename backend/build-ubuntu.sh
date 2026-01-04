#!/bin/bash

# ===========================================
# Build Script for Ubuntu 24.04.3 LTS
# Chat Backend API - Rust/Axum
# ===========================================

set -e

echo "=========================================="
echo "Chat Backend - Ubuntu 24.04 Build Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}Warning: Running as root. Consider using a non-root user.${NC}"
fi

# Step 1: Install system dependencies
echo -e "\n${GREEN}[1/7] Installing system dependencies...${NC}"
sudo apt update
sudo apt install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    libpq-dev \
    curl \
    git

# Step 2: Install Rust (if not installed)
echo -e "\n${GREEN}[2/7] Checking Rust installation...${NC}"
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "Rust is already installed: $(rustc --version)"
fi

# Ensure cargo is in PATH
source "$HOME/.cargo/env" 2>/dev/null || true

# Step 3: Install PostgreSQL (if not installed)
echo -e "\n${GREEN}[3/7] Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
else
    echo "PostgreSQL is already installed: $(psql --version)"
fi

# Step 4: Install Redis (optional)
echo -e "\n${GREEN}[4/7] Checking Redis...${NC}"
if ! command -v redis-server &> /dev/null; then
    echo "Installing Redis..."
    sudo apt install -y redis-server
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
else
    echo "Redis is already installed: $(redis-server --version)"
fi

# Step 5: Setup environment
echo -e "\n${GREEN}[5/7] Setting up environment...${NC}"
if [ -f ".env.prod" ]; then
    cp .env.prod .env
    echo "Copied .env.prod to .env"
else
    echo -e "${RED}Error: .env.prod not found!${NC}"
    exit 1
fi

# Step 6: Install sqlx-cli and run migrations
echo -e "\n${GREEN}[6/7] Setting up database...${NC}"
cargo install sqlx-cli --no-default-features --features postgres

# Check if database exists, create if not
echo "Checking database connection..."
export $(grep -v '^#' .env | xargs)

# Create database user and database if needed
echo "Setting up PostgreSQL user and database..."
sudo -u postgres psql -c "CREATE USER messages_user WITH PASSWORD 'Ptn141122@';" 2>/dev/null || echo "User may already exist"
sudo -u postgres psql -c "CREATE DATABASE messages_db OWNER messages_user;" 2>/dev/null || echo "Database may already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE messages_db TO messages_user;"

# Run migrations
echo "Running database migrations..."
sqlx migrate run

# Step 7: Build release binary
echo -e "\n${GREEN}[7/7] Building release binary...${NC}"
cargo build --release

echo ""
echo "=========================================="
echo -e "${GREEN}Build completed successfully!${NC}"
echo "=========================================="
echo ""
echo "Binary location: ./target/release/chat-backend"
echo ""
echo "To run the server:"
echo "  ./target/release/chat-backend"
echo ""
echo "Or with environment file:"
echo "  source .env && ./target/release/chat-backend"
echo ""
