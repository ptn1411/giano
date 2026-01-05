#!/bin/bash
# Manual test script for QUIC server
# This script temporarily enables QUIC and starts the server for manual testing

echo "=== QUIC Server Manual Test ==="
echo ""
echo "This script will:"
echo "1. Temporarily enable QUIC in .env"
echo "2. Start the backend server"
echo "3. You can test QUIC connections manually"
echo "4. Press Ctrl+C to stop and restore original configuration"
echo ""

# Backup original .env
cp .env .env.backup

# Enable QUIC
sed -i 's/QUIC_ENABLED=false/QUIC_ENABLED=true/' .env

echo "✓ QUIC enabled in configuration"
echo "✓ Starting server..."
echo ""

# Start the server
cargo run

# Restore original configuration on exit
echo ""
echo "Restoring original configuration..."
mv .env.backup .env
echo "✓ Configuration restored"
