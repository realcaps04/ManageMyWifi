import type { AgentStatus } from "@wifi-control/shared-types";
import { AGENT_VERSION } from "../config/env";
import { BackendClient } from "../services/backend-client";
import type { SyncService } from "../services/sync";
import { MikroTikClient } from "../router/mikrotik-client";
import { logger } from "../utils/logger";
import { hostname } from "os";

export async function sendHeartbeat(
  backend: BackendClient,
  router: MikroTikClient,
  sync: SyncService
) {
  const reachable = await router.ping();
  const caps = sync.capabilities;
  const status: AgentStatus = reachable ? "online" : "degraded";

  await backend.heartbeat({
    status,
    version: AGENT_VERSION,
    hostname: hostname(),
    router: caps
      ? {
          model: caps.model,
          routeros_version: caps.version,
          status: reachable ? "connected" : "disconnected",
          cpu_load: caps.cpuLoad,
          memory_used_percent: caps.memoryUsedPercent,
          uptime_seconds: caps.uptimeSeconds,
          wireless_stack: caps.wirelessStack,
        }
      : { status: reachable ? "connected" : "disconnected" },
  });

  logger.debug({ status, reachable }, "Heartbeat sent");
}
