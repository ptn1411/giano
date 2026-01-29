$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Giano AI Bridge Integration..." -ForegroundColor Cyan

# 1. Setup giano-moltbot-channel
Write-Host "`n📦 Setting up giano-moltbot-channel (Plugin)..." -ForegroundColor Yellow
Push-Location "giano-moltbot-channel"
try {
    Write-Host "   Installing dependencies..."
    npm install
    Write-Host "   Building plugin..."
    npm run build
    Write-Host "   ✅ Plugin built successfully!" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ Failed to setup plugin" -ForegroundColor Red
    Write-Error $_
}
finally {
    Pop-Location
}

# 2. Setup mcp-giano-bridge
Write-Host "`n🌉 Setting up mcp-giano-bridge (MCP Server)..." -ForegroundColor Yellow
Push-Location "mcp-giano-bridge"
try {
    Write-Host "   Installing dependencies..."
    npm install
    Write-Host "   Building bridge..."
    npm run build
    Write-Host "   ✅ Bridge built successfully!" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ Failed to setup bridge" -ForegroundColor Red
    Write-Error $_
}
finally {
    Pop-Location
}

Write-Host "`n✨ Setup Complete!" -ForegroundColor Cyan
Write-Host "`nTo run the MCP Bridge:"
Write-Host "1. Set your environment variables (GIANO_BOT_TOKEN)"
Write-Host "2. Run: node mcp-giano-bridge/dist/index.js"
Write-Host "   OR use Docker: docker-compose -f docker-compose.ai.yml up --build"
Write-Host "`nTo use the Plugin:"
Write-Host "1. Configure your Moltbot instance to load './giano-moltbot-channel'"
Write-Host "2. Ensure Giano Backend is running at http://localhost:3000"
