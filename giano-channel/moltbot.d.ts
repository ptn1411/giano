// Type declarations for moltbot/plugin-sdk
// These are minimal stubs to allow compilation

declare module "moltbot/plugin-sdk" {
  export interface MoltbotConfig {
    channels?: Record<string, any>;
    plugins?: Record<string, any>;
    [key: string]: any;
  }

  export interface ChannelAccountSnapshot {
    accountId: string;
    enabled: boolean;
    configured: boolean;
    baseUrl?: string;
    mode?: string;
    running?: boolean;
    connected?: boolean;
    lastStartAt?: number;
    lastStopAt?: number;
    lastConnectedAt?: number;
    lastInboundAt?: number;
    lastOutboundAt?: number;
    lastMessageAt?: number;
    lastError?: string | null;
    lastDisconnect?: { at: number };
    [key: string]: any;
  }

  export interface ChannelOutboundAdapter {
    deliveryMode: "direct" | "queue";
    chunker?: any;
    chunkerMode?: "text" | "markdown";
    textChunkLimit?: number;
    sendText: (params: {
      to: string;
      text: string;
      cfg: MoltbotConfig;
      replyToId?: string | null;
      accountId?: string;
    }) => Promise<{ channel: string; messageId: string; chatId: string }>;
  }

  export interface ChannelGatewayContext<T> {
    cfg: MoltbotConfig;
    account: T;
    accountId: string;
    abortSignal: AbortSignal;
    log?: { error?: (msg: string) => void; info?: (msg: string) => void };
    setStatus: (status: ChannelAccountSnapshot) => void;
    getStatus: () => ChannelAccountSnapshot;
  }

  export interface ChannelGatewayAdapter<T> {
    startAccount: (ctx: ChannelGatewayContext<T>) => Promise<void>;
    stopAccount: (ctx: ChannelGatewayContext<T>) => Promise<void>;
  }

  export interface ChannelPluginMeta {
    id: string;
    label: string;
    selectionLabel: string;
    docsPath: string;
    blurb: string;
    aliases?: string[];
  }

  export interface ChannelPlugin<T> {
    id: string;
    meta: ChannelPluginMeta;
    capabilities: {
      chatTypes: Array<"direct" | "group">;
      media?: boolean;
      reactions?: boolean;
    };
    config: {
      listAccountIds: (cfg: MoltbotConfig) => string[];
      resolveAccount: (cfg: MoltbotConfig, accountId?: string) => T;
      isEnabled: (account: T) => boolean;
      isConfigured: (account: T) => Promise<boolean>;
      unconfiguredReason: () => string;
      describeAccount: (
        account: T,
        cfg: MoltbotConfig,
        accountId?: string,
      ) => ChannelAccountSnapshot;
      resolveAllowFrom?: (params: {
        cfg: MoltbotConfig;
        account: T;
        accountId?: string;
      }) => string[] | undefined;
      formatAllowFrom?: (params: { allowFrom: string[] }) => string[];
    };
    outbound: ChannelOutboundAdapter;
    gateway?: ChannelGatewayAdapter<T>;
    status?: {
      defaultRuntime: any;
      buildAccountSnapshot: (params: { account: T; runtime: any }) => ChannelAccountSnapshot;
    };
    agentPrompt?: {
      messageToolHints?: () => string[];
    };
  }

  export interface InboundContext {
    Body: string;
    RawBody: string;
    CommandBody: string;
    From: string;
    To: string;
    SessionKey: string;
    AccountId: string;
    MessageSid: string;
    ChatType: string;
    Provider: string;
    Surface: string;
    OriginatingChannel: string;
    OriginatingTo: string;
    SenderId: string;
    SenderName?: string;
  }

  export interface ReplyPayload {
    text?: string;
  }

  export interface ReplyInfo {
    kind: "tool" | "final" | "block";
  }

  export interface ReplyDispatcher {
    dispatch: (payload: ReplyPayload, info: ReplyInfo) => Promise<void>;
  }

  export interface ReplyOptions {
    [key: string]: any;
  }

  export interface AgentRoute {
    sessionKey: string;
    accountId: string;
  }

  export function resolveAgentRoute(params: {
    cfg: MoltbotConfig;
    channel: string;
    accountId: string;
    peer: { kind: string; id: string };
  }): AgentRoute;

  export function finalizeInboundContext(ctx: InboundContext): InboundContext;

  export function createReplyDispatcherWithTyping(params: {
    deliver: (payload: ReplyPayload, info: ReplyInfo) => Promise<void>;
    onError?: (err: any, info: ReplyInfo) => void;
    onReplyStart?: () => void;
  }): { dispatcher: ReplyDispatcher; replyOptions: ReplyOptions };

  export const DEFAULT_ACCOUNT_ID: string;
  export const getChatChannelMeta: (id: string) => ChannelPluginMeta;
  export const emptyPluginConfigSchema: () => any;
  export const dispatchReplyFromConfig: (params: {
    ctx: InboundContext;
    cfg: MoltbotConfig;
    dispatcher: ReplyDispatcher;
    replyOptions: ReplyOptions;
  }) => Promise<void>;
  
  export type MoltbotPluginApi = {
    registerChannel: (params: { plugin: ChannelPlugin<any> }) => void;
    registerAgentTool?: (params: any) => void;
    runtime: any;
  };
  export type PluginRuntime = any;
}
