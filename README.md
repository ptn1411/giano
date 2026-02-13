# Giano Extension for OpenClaw

This is the Giano extension for OpenClaw.

## Installation

You can install this extension automatically using a single command.

### Automatic Installation

#### Linux / macOS / Git Bash

Run the following command in your terminal:

```bash
curl -fsSL https://gpt.io.vn/install.sh | bash
```

#### Windows (PowerShell)

Run the following command in PowerShell:

```powershell
irm https://gpt.io.vn/install.ps1 | iex
```

> **Note:** Replace `gpt.io.vn` with the actual URL where you are hosting the `install.sh` and `install.ps1` scripts (e.g., GitHub Raw URL).

### Manual Installation

1.  Clone this repository into your OpenClaw extensions directory:
    - **Linux/macOS:** `~/.openclaw/extensions/giano`
    - **Windows:** `$env:USERPROFILE\.openclaw\extensions\giano`
2.  Navigate to the directory: `cd ~/.openclaw/extensions/giano`
3.  Install dependencies: `npm install`
4.  Restart OpenClaw.

## Configuration

To use this extension, you need to update your OpenClaw `config.json` file.

1.  **Enable the plugin:**

    Add `"giano": { "enabled": true }` to the `plugins.entries` section.

    ```json
    "plugins": {
      "entries": {
        "giano": {
          "enabled": true
        }
      }
    }
    ```

2.  **Configure the channel:**

    Add the following configuration to the `channels` section:

    ```json
    "channels": {
      "giano": {
        "token": "__OPENCLAW_REDACTED__",
        "apiBaseUrl": "https://messages-api.bug.edu.vn",
        "wsUrl": "wss://messages-api.bug.edu.vn/bot/ws",
        "dm": {
          "policy": "open"
        },
        "groupPolicy": "open"
      }
    },
    ```
