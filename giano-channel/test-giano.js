// test-giano.js
import { gianoChannelPlugin } from './dist/src/channel.js';

// Mock context
const mockCtx = {
  account: {
    token: "aeabd319-f175-4b19-8477-e0b7a574fdb2:l5mPHcf5qbzvGKZbMafsa0u8snlZfF3w", // Token mẫu bạn cung cấp
    apiBaseUrl: "https://messages-api.bug.edu.vn",
    wsUrl: "wss://messages-api.bug.edu.vn/bot/ws",
  },
  accountId: "test-account",
  cfg: { channels: { giano: { accounts: { default: {} } } } },
  abortSignal: new AbortController().signal,
  log: {
    info: (msg) => console.log("INFO:", msg),
    error: (msg) => console.error("ERROR:", msg),
  },
  setStatus: (status) => console.log("STATUS:", status),
  getStatus: () => ({}),
};

console.log("Starting Giano test...");
gianoChannelPlugin.gateway.startAccount(mockCtx).catch(err => {
  console.error("Start failed:", err);
});

// Giữ process sống
setInterval(() => {}, 1000);
