# ===========================================
# Cross-Compile Script: Windows -> Ubuntu
# Chat Backend API - Rust/Axum
# Uses .env.prod for production build
# ===========================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Chat Backend - Cross-Compile for Ubuntu" -ForegroundColor Cyan
Write-Host "Using .env.prod configuration" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

# Step 1: Check Rust installation
Write-Host "`n[1/5] Checking Rust installation..." -ForegroundColor Green
if (!(Get-Command rustc -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Rust is not installed. Please install from https://rustup.rs" -ForegroundColor Red
    exit 1
}
Write-Host "Rust version: $(rustc --version)"

# Step 2: Setup .env.prod
Write-Host "`n[2/5] Setting up .env.prod..." -ForegroundColor Green
if (!(Test-Path ".env.prod")) {
    Write-Host "Error: .env.prod not found!" -ForegroundColor Red
    exit 1
}

# Copy .env.prod to .env for build
Copy-Item -Path ".env.prod" -Destination ".env" -Force
Write-Host "Copied .env.prod to .env"

# Load environment variables from .env.prod
Get-Content ".env.prod" | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.*)$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
        Write-Host "  Set $name"
    }
}

# Step 3: Add Linux target
Write-Host "`n[3/7] Adding Linux target (x86_64-unknown-linux-gnu)..." -ForegroundColor Green
rustup target add x86_64-unknown-linux-gnu

# Step 4: Install cross (cross-compilation tool)
Write-Host "`n[4/7] Installing cross tool..." -ForegroundColor Green
cargo install cross --git https://github.com/cross-rs/cross

# Step 5: Check SQLx offline data
Write-Host "`n[5/7] Checking SQLx offline data..." -ForegroundColor Green
if (!(Test-Path ".sqlx")) {
    Write-Host "Warning: .sqlx folder not found!" -ForegroundColor Yellow
    Write-Host "You need to prepare SQLx offline data first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run these commands with database connection:" -ForegroundColor Cyan
    Write-Host "  cargo install sqlx-cli"
    Write-Host "  cargo sqlx prepare"
    Write-Host ""
    
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}
else {
    Write-Host "SQLx offline data found."
}

# Step 6: Check Docker
Write-Host "`n[6/7] Checking Docker..." -ForegroundColor Green
Write-Host "Cross-compilation requires Docker to be running!" -ForegroundColor Yellow

$dockerRunning = docker info 2>$null
if (!$dockerRunning) {
    Write-Host "Error: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    Write-Host "Cross-compilation requires Docker to emulate Linux environment." -ForegroundColor Yellow
    exit 1
}
Write-Host "Docker is running."

# Step 7: Build for Linux
Write-Host "`n[7/7] Building for Ubuntu Linux..." -ForegroundColor Green

# Set SQLX_OFFLINE mode to avoid database connection during build
$env:SQLX_OFFLINE = "true"

# Build using cross with env vars
cross build --release --target x86_64-unknown-linux-gnu

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Binary location: ./target/x86_64-unknown-linux-gnu/release/chat-backend"
Write-Host ""
Write-Host "To deploy to Ubuntu server:" -ForegroundColor Yellow
Write-Host "1. Copy binary to server:"
Write-Host "   scp ./target/x86_64-unknown-linux-gnu/release/chat-backend root@159.223.47.17:/var/www/messages-api/messages-api/"
Write-Host ""
Write-Host "2. Copy .env.prod to server:"
Write-Host "   scp .env.prod root@159.223.47.17:/var/www/messages-api/messages-api/.env"
Write-Host ""
Write-Host "3. On Ubuntu server, run:"
Write-Host "   chmod +x chat-backend"
Write-Host "   ./chat-backend"
Write-Host ""
