# Manual test script for QUIC server (PowerShell version)
# This script temporarily enables QUIC and starts the server for manual testing

Write-Host "=== QUIC Server Manual Test ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will:"
Write-Host "1. Temporarily enable QUIC in .env"
Write-Host "2. Start the backend server"
Write-Host "3. You can test QUIC connections manually"
Write-Host "4. Press Ctrl+C to stop and restore original configuration"
Write-Host ""

# Backup original .env
Copy-Item .env .env.backup

# Enable QUIC
(Get-Content .env) -replace 'QUIC_ENABLED=false', 'QUIC_ENABLED=true' | Set-Content .env

Write-Host "✓ QUIC enabled in configuration" -ForegroundColor Green
Write-Host "✓ Starting server..." -ForegroundColor Green
Write-Host ""

try {
    # Start the server
    cargo run
}
finally {
    # Restore original configuration on exit
    Write-Host ""
    Write-Host "Restoring original configuration..." -ForegroundColor Yellow
    Move-Item -Force .env.backup .env
    Write-Host "✓ Configuration restored" -ForegroundColor Green
}
