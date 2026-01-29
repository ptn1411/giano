import type { MoltbotPluginApi } from "moltbot/plugin-sdk";
import { emptyPluginConfigSchema } from "moltbot/plugin-sdk";

import { gianoChannelPlugin, gianoDock } from "./src/channel.js";
import { setGianoRuntime } from "./src/runtime.js";

const plugin = {
  id: "giano-channel",
  name: "Giano Channel",
  description: "Giano channel plugin for Giano backend chat",
  configSchema: emptyPluginConfigSchema(),
  register(api: MoltbotPluginApi) {
    setGianoRuntime(api.runtime);
    api.registerChannel({ plugin: gianoChannelPlugin, dock: gianoDock });
  },
};

export default plugin;
