import { Bot } from "gianobot";
import type { ResolvedGianoAccount } from "./types.js";

export type GianoProbeResult = {
  ok: boolean;
  error?: string;
  bot?: {
    id?: string;
    name?: string;
  };
};

export async function probeGiano(
  account: ResolvedGianoAccount,
  timeoutMs: number = 5000,
): Promise<GianoProbeResult> {
  const token = account.token?.trim();
  if (!token) {
    return { ok: false, error: "No token configured" };
  }

  try {
    const bot = new Bot(token, {
      mode: "websocket",
      apiBaseUrl: account.apiBaseUrl,
      wsUrl: account.wsUrl,
    });

    // Try to get bot info via API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${account.apiBaseUrl}/api/v1/bots/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as {
          id?: string;
          name?: string;
          username?: string;
        };
        return {
          ok: true,
          bot: {
            id: data.id,
            name: data.name || data.username,
          },
        };
      }

      return { ok: false, error: `API returned ${response.status}` };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, error: "Connection timeout" };
      }
      throw err;
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
