import {
  AGENT_VERSION,
  clearStoredCredentials,
  env,
  loadStoredCredentials,
  saveCredentials,
} from "./config/env";
import { RouterClient } from "./router/router-client";
import { BackendClient } from "./services/backend-client";
import { SyncService } from "./services/sync";
import { sendHeartbeat } from "./workers/heartbeat";
import { pollAndProcessCommands } from "./workers/commands";
import { logger } from "./utils/logger";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function registerFresh(backend: BackendClient) {
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

async function ensureRegistered(backend: BackendClient) {
  const stored = loadStoredCredentials();
  if (stored?.agent_token) {
    backend.setToken(stored.agent_token);
    logger.info({ agentId: stored.agent_id }, "Loaded stored agent credentials");
    try {
      await backend.getCommands();
      return stored;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("401") || message.includes("403")) {
        logger.warn("Stored agent token rejected — re-registering");
        clearStoredCredentials();
        return registerFresh(backend);
      }
      throw err;
    }
  }

  return registerFresh(backend);
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

/** Prefer router details saved on the website; fall back to local .env. */
async function refreshRouterConfig(
  backend: BackendClient,
  router: RouterClient
) {
  try {
    const remote = await backend.getRouterConnection();
    if (remote.configured) {
      const changed = router.applyConfig({
        host: remote.host,
        port: remote.port,
        user: remote.user,
        password: remote.password,
        tls_insecure: remote.tls_insecure,
      });
      if (changed) {
        logger.info(
          { host: remote.host, user: remote.user },
          "Applied router connection from website Settings"
        );
      }
      return true;
    }
  } catch (err) {
    logger.warn({ err }, "Could not fetch router connection from API");
  }

  if (!router.hasCredentials()) {
    logger.warn(
      "No router credentials yet — enter them in ManageMyWifi → Settings → Connect your router"
    );
    return false;
  }
  return true;
}

async function main() {
  logger.info(
    {
      version: AGENT_VERSION,
      backend: env.BACKEND_URL,
    },
    "ManageMyWifi agent starting"
  );

  const router = new RouterClient();
  const backend = new BackendClient(env.BACKEND_URL);

  await withRetry("agent-register", () => ensureRegistered(backend));
  await refreshRouterConfig(backend, router);

  const sync = new SyncService(router, backend);

  if (router.hasCredentials()) {
    const reachable = await router.ping();
    if (!reachable) {
      logger.error(
        {
          host: router.snapshot.host,
          hint: "Confirm gateway IP/password in website Settings, and that this PC is on the same WiFi LAN",
        },
        "Cannot reach router REST API"
      );
    } else {
      await withRetry("initial-sync", () => sync.syncOnce());
    }
  }

  let syncInFlight = false;
  const runSync = async () => {
    if (syncInFlight) return;
    syncInFlight = true;
    try {
      await refreshRouterConfig(backend, router);
      if (!router.hasCredentials()) return;
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

  await sendHeartbeat(backend, router, sync).catch((err) =>
    logger.error({ err }, "Initial heartbeat failed")
  );

  logger.info(
    "Agent loops running (sync / heartbeat / commands). Enter router details in the website Settings if not connected yet."
  );
}

main().catch((err) => {
  logger.fatal({ err }, "Agent crashed");
  process.exit(1);
});
