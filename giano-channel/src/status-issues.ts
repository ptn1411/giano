import type { MoltbotConfig } from "moltbot/plugin-sdk";
import type { ResolvedGianoAccount } from "./types.js";

export type GianoStatusIssue = {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
};

export function collectGianoStatusIssues(params: {
  account: ResolvedGianoAccount;
  cfg: MoltbotConfig;
}): GianoStatusIssue[] {
  const { account } = params;
  const issues: GianoStatusIssue[] = [];

  // Check token
  if (!account.token?.trim()) {
    issues.push({
      level: "error",
      code: "NO_TOKEN",
      message:
        "No Giano bot token configured. Set channels.giano-channel.token or GIANO_BOT_TOKEN env var.",
    });
  }

  // Check API base URL
  if (!account.apiBaseUrl) {
    issues.push({
      level: "warning",
      code: "DEFAULT_API_URL",
      message:
        "Using default API URL (http://127.0.0.1:3000). Set channels.giano-channel.apiBaseUrl for custom server.",
    });
  }

  // Check if account is disabled
  if (!account.enabled) {
    issues.push({
      level: "info",
      code: "DISABLED",
      message: "This Giano account is disabled.",
    });
  }

  // Check DM policy with no allowFrom
  const dmPolicy = account.config.dmPolicy;
  if (
    dmPolicy === "allowlist" &&
    (!account.config.allowFrom || account.config.allowFrom.length === 0)
  ) {
    issues.push({
      level: "warning",
      code: "EMPTY_ALLOWLIST",
      message:
        "DM policy is 'allowlist' but no allowFrom entries configured. No DMs will be accepted.",
    });
  }

  return issues;
}
