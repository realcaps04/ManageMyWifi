import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { logger } from "../logger";

export interface PersistedStoreSlice {
  routerConnection?: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls_insecure: boolean;
    use_https: boolean;
    updated_at: string | null;
  };
  portal?: {
    ssid: string | null;
    password: string | null;
    credentials: Record<string, string>;
  };
  agents?: Array<Record<string, unknown>>;
  agentTokens?: Array<[string, string]>;
}

const persistPath = resolve(process.cwd(), "data", "persist.json");

export function loadPersistedStore(): PersistedStoreSlice | null {
  try {
    if (!existsSync(persistPath)) return null;
    const raw = readFileSync(persistPath, "utf8");
    return JSON.parse(raw) as PersistedStoreSlice;
  } catch (err) {
    logger.warn({ err }, "Could not load persist.json");
    return null;
  }
}

export function savePersistedStore(slice: PersistedStoreSlice) {
  try {
    const dir = dirname(persistPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(persistPath, JSON.stringify(slice, null, 2), "utf8");
  } catch (err) {
    logger.warn({ err }, "Could not write persist.json");
  }
}
