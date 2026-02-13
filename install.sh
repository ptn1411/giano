#!/bin/bash

# Configuration
# RENAME THIS TO YOUR REPO URL
# Example: REPO_URL="https://github.com/your-username/giano.git"
REPO_URL="https://github.com/ptn1411/giano.git"
EXTENSION_NAME="giano"
INSTALL_DIR="$HOME/.openclaw/extensions/$EXTENSION_NAME"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Installing $EXTENSION_NAME extension...${NC}"

# Check dependencies
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi

# Check if installation exists
if [ -d "$INSTALL_DIR" ] && [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "Updating existing installation..."
    cd "$INSTALL_DIR" || exit
    git pull
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Update failed. Re-installing...${NC}"
        cd ..
        rm -rf "$INSTALL_DIR"
        git clone "$REPO_URL" "$INSTALL_DIR"
    else
        echo -e "${GREEN}Successfully updated source code.${NC}"
    fi
else
    # Clean install
    if [ -d "$INSTALL_DIR" ]; then
        echo "Removing existing directory..."
        rm -rf "$INSTALL_DIR"
    fi

    echo -e "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"

    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to clone repository.${NC}"
        exit 1
    fi
fi

# Install dependencies
echo -e "Installing dependencies..."
cd "$INSTALL_DIR" || exit
npm install --no-audit --no-fund --silent

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Installation complete!${NC}"
    echo -e "Please restart OpenClaw to load the extension."
else
    echo -e "${RED}Installation failed during npm install.${NC}"
    exit 1
fi
