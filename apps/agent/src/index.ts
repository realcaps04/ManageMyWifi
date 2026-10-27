import {
  AGENT_VERSION,
  env,
  loadStoredCredentials,
  saveCredentials,
} from "./config/env";
import { MikroTikClient } from "./router/mikrotik-client";
import { BackendClient } from "./services/backend-client";
import { SyncService } from "./services/sync";
import { sendHeartbeat } from "./workers/heartbeat";
import { pollAndProcessCommands } from "./workers/commands";
import { logger } from "./utils/logger";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureRegistered(backend: BackendClient) {
  const stored = loadStoredCredentials();
  if (stored?.agent_token) {
    backend.setToken(stored.agent_token);
    logger.info({ agentId: stored.agent_id }, "Loaded stored agent credentials");
    return stored;
  }

  logger.info("Registering agent with backend…");
  const result = await backend.register();
  backend.setToken(result.agent_token);
  const creds = {
    agent_id: result.agent_id,
    agent_token: result.agent_token,
    network_id: env.NETWORK_ID,
  };
  saveCredentials(creds);
  logger.info({ agentId: result.agent_id }, "Agent registered");
  return creds;
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 5
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = Math.min(30_000, 1000 * 2 ** i);
      logger.warn({ err, label, attempt: i + 1, delay }, "Retrying after failure");
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function main() {
  logger.info(
    {
      version: AGENT_VERSION,
      backend: env.BACKEND_URL,
      mikrotik: `${env.MIKROTIK_HOST}:${env.MIKROTIK_PORT}`,
      user: env.MIKROTIK_USER,
    },
    "WiFi Control agent starting"
  );

  if (!env.MIKROTIK_PASSWORD) {
    logger.warn(
      "MIKROTIK_PASSWORD is empty — set it in apps/agent/.env before connecting to the router"
    );
  }

  const router = new MikroTikClient();
  const backend = new BackendClient(env.BACKEND_URL);

  await withRetry("agent-register", () => ensureRegistered(backend));

  const sync = new SyncService(router, backend);

  // Initial connectivity check
  const reachable = await router.ping();
  if (!reachable) {
    logger.error(
      {
        host: env.MIKROTIK_HOST,
        hint: "Verify REST API is enabled, credentials are correct, and this machine is on the router LAN",
      },
      "Cannot reach MikroTik REST API"
    );
  } else {
    await withRetry("initial-sync", () => sync.syncOnce());
  }

  let syncInFlight = false;
  const runSync = async () => {
    if (syncInFlight) return;
    syncInFlight = true;
    try {
      await sync.syncOnce();
    } catch (err) {
      logger.error({ err }, "Sync cycle failed");
    } finally {
      syncInFlight = false;
    }
  };

  setInterval(() => {
    void runSync();
  }, env.SYNC_INTERVAL_MS);

  setInterval(() => {
    void sendHeartbeat(backend, router, sync).catch((err) =>
      logger.error({ err }, "Heartbeat failed")
    );
  }, env.HEARTBEAT_INTERVAL_MS);

  setInterval(() => {
    void pollAndProcessCommands(backend, router, sync).catch((err) =>
      logger.error({ err }, "Command poll failed")
    );
  }, env.COMMAND_POLL_INTERVAL_MS);

  // Immediate heartbeat
  await sendHeartbeat(backend, router, sync).catch((err) =>
    logger.error({ err }, "Initial heartbeat failed")
  );

  logger.info("Agent loops running (sync / heartbeat / commands)");
}

main().catch((err) => {
  logger.fatal({ err }, "Agent crashed");
  process.exit(1);
});
