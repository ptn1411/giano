import type { MoltbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";
import { Bot } from "gianobot";

import {
  delegateToIdeTool,
  gianoChannelPlugin,
  sendTaskToIdeBridge,
  type GianoChannelAccount,
} from "./src/channel.js";
import { setGianoRuntime } from "./src/runtime.js";

const plugin = {
  id: "giano-channel",
  name: "Giano Channel",
  description: "Giano channel plugin with AI-to-AI task delegation",
  configSchema: emptyPluginConfigSchema(),
  register(api: MoltbotPluginApi) {
    setGianoRuntime(api.runtime);
    api.registerChannel({ plugin: gianoChannelPlugin });

    // Register delegate_to_ide agent tool
    api.registerAgentTool?.({
      tool: {
        ...delegateToIdeTool,
        execute: async (
          params: {
            goal: string;
            title?: string;
            steps?: string[];
            files?: string[];
            notes?: string;
          },
          context: {
            chatId: string;
            cfg: { channels?: Record<string, unknown> };
            accountId?: string;
          },
        ) => {
          // Get account config
          const channels = context.cfg.channels as
            | Record<string, unknown>
            | undefined;
          const channelCfg = (channels?.["giano-channel"] ?? {}) as {
            accounts?: Record<string, GianoChannelAccount>;
          };
          const account =
            channelCfg.accounts?.[context.accountId ?? "default"] ?? {};

          if (!account.token) {
            return {
              success: false,
              message: "❌ Missing bot token",
            };
          }

          // Create bot instance to send task
          const bot = new Bot(account.token, {
            mode: "websocket",
            apiBaseUrl: account.apiBaseUrl ?? "http://127.0.0.1:3000",
            wsUrl: account.wsUrl ?? "ws://127.0.0.1:3000",
          });

          try {
            const result = await sendTaskToIdeBridge({
              bot,
              chatId: context.chatId,
              task: params,
            });

            return {
              success: true,
              taskId: result.taskId,
              message: `✅ Task delegated to IDE agent (taskId=${result.taskId})`,
            };
          } catch (err) {
            return {
              success: false,
              message: `❌ Failed to delegate: ${String(err)}`,
            };
          }
        },
      },
      channels: ["giano-channel"],
    });
  },
};

export default plugin;
