import type { PluginRuntime } from "moltbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setGianoRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getGianoRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Giano runtime not initialized");
  }
  return runtime;
}
