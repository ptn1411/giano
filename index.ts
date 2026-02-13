import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

import { gianoPlugin } from "./src/channel.js";
import { setGianoRuntime } from "./src/runtime.js";

/**
 * Giano Channel Plugin for OpenClaw
 * Enables communication with Giano messaging platform
 */
const plugin = {
  id: "giano",
  name: "Giano",
  description: "Giano messaging platform integration",

  register(api: OpenClawPluginApi) {
    setGianoRuntime(api.runtime);
    api.registerChannel({ plugin: gianoPlugin });
  },
};

export default plugin;
