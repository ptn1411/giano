import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setGianoRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getGianoRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Giano runtime not initialized");
  }
  return runtime;
}
