# Giano Extension for OpenClaw

This is the Giano extension for OpenClaw.

## Installation

You can install this extension automatically using a single command.

### Automatic Installation

#### Linux / macOS / Git Bash

Run the following command in your terminal:

```bash
curl -fsSL https://your-domain.com/install.sh | bash
```

#### Windows (PowerShell)

Run the following command in PowerShell:

```powershell
irm https://your-domain.com/install.ps1 | iex
```

> **Note:** Replace `https://your-domain.com` with the actual URL where you are hosting the `install.sh` and `install.ps1` scripts (e.g., GitHub Raw URL).

### Manual Installation

1.  Clone this repository into your OpenClaw extensions directory:
    - **Linux/macOS:** `~/.openclaw/extensions/giano`
    - **Windows:** `$env:USERPROFILE\.openclaw\extensions\giano`
2.  Navigate to the directory: `cd ~/.openclaw/extensions/giano`
3.  Install dependencies: `npm install`
4.  Restart OpenClaw.
