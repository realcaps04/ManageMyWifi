import type { WirelessStack } from "@wifi-control/shared-types";
import { MikroTikClient } from "./mikrotik-client";
import { logger } from "../utils/logger";

export interface WifiNetworkInfo {
  interface_name: string;
  ssid: string | null;
  band: string | null;
  channel: string | null;
  frequency: string | null;
  running: boolean;
  disabled: boolean;
  mode: string | null;
  clients: number;
}

export async function discoverWifiInterfaces(
  client: MikroTikClient,
  stack: WirelessStack
): Promise<WifiNetworkInfo[]> {
  const networks: WifiNetworkInfo[] = [];

  if (stack === "wifi" || stack === "unknown") {
    try {
      const ifaces = await client.get<Record<string, string>[]>("/interface/wifi");
      const regs = await client
        .get<Record<string, string>[]>("/interface/wifi/registration-table")
        .catch(() => [] as Record<string, string>[]);

      if (Array.isArray(ifaces)) {
        for (const iface of ifaces) {
          const name = iface.name || iface[".id"] || "wifi";
          const clientCount = Array.isArray(regs)
            ? regs.filter((r) => (r.interface || "") === name).length
            : 0;
          networks.push({
            interface_name: name,
            ssid: iface["configuration.ssid"] || iface.ssid || null,
            band: iface.band || iface["channel.band"] || null,
            channel: iface.channel || iface["channel.frequency"] || null,
            frequency: iface.frequency || null,
            running: iface.running === "true",
            disabled: iface.disabled === "true",
            mode: iface.mode || "ap",
            clients: clientCount,
          });
        }
      }

      // Also read configurations for SSID if missing on interface
      try {
        const configs = await client.get<Record<string, string>[]>(
          "/interface/wifi/configuration"
        );
        if (Array.isArray(configs)) {
          for (const cfg of configs) {
            const name = cfg.name;
            const ssid = cfg.ssid;
            if (!name || !ssid) continue;
            const hit = networks.find((n) => n.interface_name === name);
            if (hit && !hit.ssid) hit.ssid = ssid;
            if (!hit) {
              networks.push({
                interface_name: name,
                ssid,
                band: null,
                channel: null,
                frequency: null,
                running: false,
                disabled: cfg.disabled === "true",
                mode: "ap",
                clients: 0,
              });
            }
          }
        }
      } catch {
        /* optional */
      }
    } catch (err) {
      if (stack === "wifi") {
        logger.warn({ err }, "Failed to read /interface/wifi");
      }
    }
  }

  if (networks.length === 0 && (stack === "wireless" || stack === "unknown")) {
    try {
      const ifaces = await client.get<Record<string, string>[]>(
        "/interface/wireless"
      );
      const regs = await client
        .get<Record<string, string>[]>(
          "/interface/wireless/registration-table"
        )
        .catch(() => [] as Record<string, string>[]);

      if (Array.isArray(ifaces)) {
        for (const iface of ifaces) {
          const name = iface.name || "wlan";
          const clientCount = Array.isArray(regs)
            ? regs.filter((r) => (r.interface || "") === name).length
            : 0;
          networks.push({
            interface_name: name,
            ssid: iface.ssid || null,
            band: iface.band || null,
            channel: iface["channel"] || null,
            frequency: iface.frequency || null,
            running: iface.running === "true",
            disabled: iface.disabled === "true",
            mode: iface.mode || null,
            clients: clientCount,
          });
        }
      }
    } catch (err) {
      logger.warn({ err }, "Failed to read /interface/wireless");
    }
  }

  return networks;
}
