import type { WirelessStack } from "@wifi-control/shared-types";
import { MikroTikClient, MikroTikError } from "./mikrotik-client";
import { logger } from "../utils/logger";

export interface RouterCapabilities {
  wirelessStack: WirelessStack;
  model: string | null;
  version: string | null;
  cpuLoad: number | null;
  memoryUsedPercent: number | null;
  uptimeSeconds: number | null;
}

function parseUptime(uptime: string | undefined): number | null {
  if (!uptime) return null;
  // e.g. "1w2d3h4m5s" or "5h12m30s"
  const units: Record<string, number> = {
    w: 604800,
    d: 86400,
    h: 3600,
    m: 60,
    s: 1,
  };
  let total = 0;
  const re = /(\d+)([wdhms])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(uptime))) {
    total += Number(match[1]) * (units[match[2]] || 0);
  }
  return total || null;
}

export async function detectCapabilities(
  client: MikroTikClient
): Promise<RouterCapabilities> {
  const resource = await client.get<Record<string, string>>("/system/resource");
  const identity = await client
    .get<Record<string, string>>("/system/identity")
    .catch(() => null);

  const totalMem = Number(resource["total-memory"] || 0);
  const freeMem = Number(resource["free-memory"] || 0);
  const memoryUsedPercent =
    totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10 : null;

  let wirelessStack: WirelessStack = "unknown";

  // Prefer wifiwave2 /interface/wifi (ROS 7.13+ style), fall back to legacy wireless
  try {
    await client.get("/interface/wifi/registration-table");
    wirelessStack = "wifi";
  } catch (err) {
    if (err instanceof MikroTikError && err.status === 404) {
      try {
        await client.get("/interface/wireless/registration-table");
        wirelessStack = "wireless";
      } catch (err2) {
        logger.warn({ err2 }, "No wireless registration table found");
        wirelessStack = "unknown";
      }
    } else {
      // Some builds return empty array with 200; another path is /interface/wifi/station
      try {
        await client.get("/interface/wifi");
        wirelessStack = "wifi";
      } catch {
        try {
          await client.get("/interface/wireless");
          wirelessStack = "wireless";
        } catch {
          wirelessStack = "unknown";
        }
      }
    }
  }

  logger.info(
    {
      model: resource["board-name"] || identity?.name,
      version: resource.version,
      wirelessStack,
    },
    "Router capabilities detected"
  );

  return {
    wirelessStack,
    model: resource["board-name"] || null,
    version: resource.version || null,
    cpuLoad: resource["cpu-load"] != null ? Number(resource["cpu-load"]) : null,
    memoryUsedPercent,
    uptimeSeconds: parseUptime(resource.uptime),
  };
}
