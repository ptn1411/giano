import { Bot } from "gianobot";
import type { MoltbotConfig } from "moltbot/plugin-sdk";

import { resolveGianoAccount } from "./accounts.js";

export type GianoSendOptions = {
  token?: string;
  accountId?: string;
  cfg?: MoltbotConfig;
  replyToId?: string;
};

export type GianoSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

function resolveSendContext(options: GianoSendOptions): {
  token: string;
  apiBaseUrl: string;
  wsUrl: string;
} {
  if (options.cfg) {
    const account = resolveGianoAccount({
      cfg: options.cfg,
      accountId: options.accountId,
    });
    return {
      token: options.token || account.token,
      apiBaseUrl: account.apiBaseUrl,
      wsUrl: account.wsUrl,
    };
  }

  return {
    token: options.token || "",
    apiBaseUrl: "http://127.0.0.1:3000",
    wsUrl: "ws://127.0.0.1:3000",
  };
}

export async function sendMessageGiano(
  chatId: string,
  text: string,
  options: GianoSendOptions = {},
): Promise<GianoSendResult> {
  const { token, apiBaseUrl, wsUrl } = resolveSendContext(options);

  if (!token) {
    return { ok: false, error: "No Giano bot token configured" };
  }

  if (!chatId?.trim()) {
    return { ok: false, error: "No chatId provided" };
  }

  try {
    const bot = new Bot(token, {
      mode: "websocket",
      apiBaseUrl,
      wsUrl,
    });

    const result = await bot.sendMessage(chatId.trim(), text.slice(0, 4000), {
      replyToId: options.replyToId ?? undefined,
    });

    return {
      ok: true,
      messageId: String(result.messageId),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
