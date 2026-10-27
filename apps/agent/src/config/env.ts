import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  BACKEND_URL: z.string().url().default("http://localhost:4000/api/v1"),
  AGENT_SHARED_SECRET: z.string().min(8).default("dev-agent-shared-secret"),
  AGENT_NAME: z.string().default("local-agent"),
  NETWORK_ID: z
    .string()
    .uuid()
    .default("00000000-0000-4000-8000-000000000001"),
  AGENT_ID: z.string().optional(),
  AGENT_TOKEN: z.string().optional(),
  MIKROTIK_HOST: z.string().default("192.168.88.1"),
  MIKROTIK_PORT: z.coerce.number().default(443),
  MIKROTIK_USER: z.string().default("wifi-control"),
  MIKROTIK_PASSWORD: z.string().default(""),
  MIKROTIK_TLS_INSECURE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  SYNC_INTERVAL_MS: z.coerce.number().default(12_000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().default(30_000),
  COMMAND_POLL_INTERVAL_MS: z.coerce.number().default(5_000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid agent environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  MIKROTIK_TLS_INSECURE: parsed.data.MIKROTIK_TLS_INSECURE ?? true,
};

const dataDir = resolve(process.cwd(), "data");
const credPath = resolve(dataDir, "agent-credentials.json");

export interface StoredCredentials {
  agent_id: string;
  agent_token: string;
  network_id: string;
}

export function loadStoredCredentials(): StoredCredentials | null {
  if (env.AGENT_ID && env.AGENT_TOKEN) {
    return {
      agent_id: env.AGENT_ID,
      agent_token: env.AGENT_TOKEN,
      network_id: env.NETWORK_ID,
    };
  }
  if (!existsSync(credPath)) return null;
  try {
    return JSON.parse(readFileSync(credPath, "utf8")) as StoredCredentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: StoredCredentials) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(credPath, JSON.stringify(creds, null, 2), "utf8");
}

export const AGENT_VERSION = "0.1.0";
