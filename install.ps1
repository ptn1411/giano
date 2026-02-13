# Configuration
# RENAME THIS TO YOUR REPO URL
# Example: $RepoUrl = "https://github.com/your-username/giano.git"
$RepoUrl = "YOUR_GIT_REPO_URL_HERE"
$ExtensionName = "giano"
$InstallDir = "$env:USERPROFILE\.openclaw\extensions\$ExtensionName"

Write-Host "Installing $ExtensionName extension..." -ForegroundColor Green

# Check dependencies
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "git is not installed."
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed."
    exit 1
}

# Remove existing installation
if (Test-Path $InstallDir) {
    Write-Host "Removing existing installation at $InstallDir..."
    Remove-Item -Path $InstallDir -Recurse -Force
}

# Clone repository
Write-Host "Cloning repository..."
try {
    git clone $RepoUrl $InstallDir
    if ($LASTEXITCODE -ne 0) { throw "Git clone failed" }
}
catch {
    Write-Error "Failed to clone repository. Please check these URL and your internet connection."
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..."
Set-Location $InstallDir
try {
    npm install --no-audit --no-fund --silent
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    Write-Host "Installation complete!" -ForegroundColor Green
    Write-Host "Please restart OpenClaw to load the extension."
}
catch {
    Write-Error "Installation failed during npm install."
    exit 1
}
