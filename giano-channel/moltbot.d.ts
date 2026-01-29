// Type declarations for moltbot/plugin-sdk
// These are minimal stubs to allow compilation

declare module "moltbot/plugin-sdk" {
  export interface MoltbotConfig {
    channels?: Record<string, any>;
    plugins?: Record<string, any>;
    session?: { store?: string };
    commands?: { useAccessGroups?: boolean };
    [key: string]: any;
  }

  export interface ChannelAccountSnapshot {
    accountId: string;
    name?: string;
    enabled: boolean;
    configured: boolean;
    baseUrl?: string;
    mode?: string;
    tokenSource?: string;
    running?: boolean;
    connected?: boolean;
    lastStartAt?: number | null;
    lastStopAt?: number | null;
    lastConnectedAt?: number | null;
    lastInboundAt?: number | null;
    lastOutboundAt?: number | null;
    lastMessageAt?: number | null;
    lastError?: string | null;
    lastProbeAt?: number | null;
    probe?: any;
    dmPolicy?: string;
    bot?: any;
    lastDisconnect?: { at: number };
    [key: string]: any;
  }

  export interface ChannelOutboundAdapter {
    deliveryMode: "direct" | "queue";
    chunker?: ((text: string, limit: number) => string[]) | null;
    chunkerMode?: "text" | "markdown";
    textChunkLimit?: number;
    sendText: (params: {
      to: string;
      text: string;
      cfg: MoltbotConfig;
      replyToId?: string | null;
      accountId?: string;
    }) => Promise<{
      channel: string;
      messageId: string;
      chatId?: string;
      ok?: boolean;
      error?: Error;
    }>;
    sendMedia?: (params: {
      to: string;
      text: string;
      mediaUrl: string;
      cfg: MoltbotConfig;
      accountId?: string;
    }) => Promise<{
      channel: string;
      messageId: string;
      ok?: boolean;
      error?: Error;
    }>;
  }

  export interface ChannelGatewayContext<T> {
    cfg: MoltbotConfig;
    account: T;
    accountId: string;
    runtime: any;
    abortSignal: AbortSignal;
    log?: { error?: (msg: string) => void; info?: (msg: string) => void };
    setStatus: (status: Partial<ChannelAccountSnapshot>) => void;
    getStatus: () => ChannelAccountSnapshot;
  }

  export interface ChannelGatewayAdapter<T> {
    startAccount: (ctx: ChannelGatewayContext<T>) => Promise<any>;
    stopAccount?: (ctx: ChannelGatewayContext<T>) => Promise<void>;
  }

  export interface ChannelPluginMeta {
    id: string;
    label: string;
    selectionLabel: string;
    docsPath: string;
    docsLabel?: string;
    blurb: string;
    aliases?: string[];
    order?: number;
    quickstartAllowFrom?: boolean;
  }

  export interface ChannelDock {
    id: string;
    capabilities: {
      chatTypes: Array<"direct" | "group">;
      media?: boolean;
      blockStreaming?: boolean;
    };
    outbound?: { textChunkLimit?: number };
    config?: {
      resolveAllowFrom?: (params: {
        cfg: MoltbotConfig;
        accountId?: string;
      }) => string[];
      formatAllowFrom?: (params: { allowFrom: string[] }) => string[];
    };
    groups?: {
      resolveRequireMention?: () => boolean;
      resolveToolPolicy?: (params: any) => any;
    };
    threading?: {
      resolveReplyToMode?: () => "off" | "enabled";
    };
  }

  export interface ChannelPlugin<T> {
    id: string;
    meta: ChannelPluginMeta;
    capabilities: {
      chatTypes: Array<"direct" | "group">;
      media?: boolean;
      reactions?: boolean;
      threads?: boolean;
      polls?: boolean;
      nativeCommands?: boolean;
      blockStreaming?: boolean;
    };
    reload?: { configPrefixes: string[] };
    configSchema?: any;
    config: {
      listAccountIds: (cfg: MoltbotConfig) => string[];
      resolveAccount: (cfg: MoltbotConfig, accountId?: string) => T;
      defaultAccountId?: (cfg: MoltbotConfig) => string;
      setAccountEnabled?: (params: {
        cfg: MoltbotConfig;
        accountId: string;
        enabled: boolean;
      }) => MoltbotConfig;
      deleteAccount?: (params: {
        cfg: MoltbotConfig;
        accountId: string;
      }) => MoltbotConfig;
      isEnabled?: (account: T) => boolean;
      isConfigured: (account: T) => Promise<boolean> | boolean;
      unconfiguredReason?: () => string;
      describeAccount: (
        account: T,
        cfg?: MoltbotConfig,
        accountId?: string,
      ) => ChannelAccountSnapshot;
      resolveAllowFrom?: (params: {
        cfg: MoltbotConfig;
        account?: T;
        accountId?: string;
      }) => string[];
      formatAllowFrom?: (params: { allowFrom: string[] }) => string[];
    };
    security?: {
      resolveDmPolicy?: (params: {
        cfg: MoltbotConfig;
        accountId?: string;
        account: T;
      }) => {
        policy: string;
        allowFrom: Array<string | number>;
        policyPath: string;
        allowFromPath: string;
        approveHint: string;
        normalizeEntry: (raw: string) => string;
      };
    };
    groups?: {
      resolveRequireMention?: () => boolean;
      resolveToolPolicy?: (params: any) => any;
    };
    threading?: {
      resolveReplyToMode?: () => "off" | "enabled";
    };
    messaging?: {
      normalizeTarget?: (raw: string) => string | undefined;
      targetResolver?: {
        looksLikeId: (raw: string) => boolean;
        hint: string;
      };
    };
    directory?: {
      self?: (params: {
        cfg: MoltbotConfig;
        accountId?: string;
        runtime: any;
      }) => Promise<any>;
      listPeers?: (params: {
        cfg: MoltbotConfig;
        accountId?: string;
        query?: string;
        limit?: number;
      }) => Promise<Array<{ kind: string; id: string; name?: string }>>;
      listGroups?: (params: {
        cfg: MoltbotConfig;
        accountId?: string;
        query?: string;
        limit?: number;
      }) => Promise<Array<{ kind: string; id: string; name?: string }>>;
    };
    setup?: {
      resolveAccountId?: (params: { accountId?: string }) => string;
      applyAccountName?: (params: {
        cfg: MoltbotConfig;
        accountId: string;
        name?: string;
      }) => MoltbotConfig;
      validateInput?: (params: {
        accountId: string;
        input: any;
      }) => string | null;
      applyAccountConfig?: (params: {
        cfg: MoltbotConfig;
        accountId: string;
        input: any;
      }) => MoltbotConfig;
    };
    pairing?: {
      idLabel: string;
      normalizeAllowEntry: (entry: string) => string;
      notifyApproval?: (params: {
        cfg: MoltbotConfig;
        id: string;
      }) => Promise<void>;
    };
    outbound: ChannelOutboundAdapter;
    gateway?: ChannelGatewayAdapter<T>;
    status?: {
      defaultRuntime: any;
      collectStatusIssues?: (params: {
        account: T;
        cfg: MoltbotConfig;
      }) => any[];
      buildChannelSummary?: (params: {
        snapshot: ChannelAccountSnapshot;
      }) => any;
      probeAccount?: (params: {
        account: T;
        timeoutMs?: number;
      }) => Promise<any>;
      buildAccountSnapshot: (params: {
        account: T;
        runtime: any;
      }) => ChannelAccountSnapshot | Promise<ChannelAccountSnapshot>;
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
    agentId?: string;
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
    registerChannel: (params: {
      plugin: ChannelPlugin<any>;
      dock?: ChannelDock;
    }) => void;
    registerAgentTool?: (params: any) => void;
    runtime: any;
  };
  export type PluginRuntime = any;
}
