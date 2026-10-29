import type { DiscoveredDevice, WirelessStack } from "@wifi-control/shared-types";
import { RouterClient } from "./router-client";
import type { DhcpLease } from "./dhcp";
import { logger } from "../utils/logger";

function normMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  return mac.toUpperCase().replace(/-/g, ":");
}

function identityKey(mac: string, clientId?: string | null): string {
  if (clientId) return `client:${clientId}`;
  return `mac:${mac}`;
}

function mapRegistration(
  row: Record<string, string>,
  stack: WirelessStack,
  leaseByMac: Map<string, DhcpLease>
): DiscoveredDevice | null {
  const mac =
    normMac(row["mac-address"]) ||
    normMac(row.mac) ||
    normMac(row["original-mac-address"]);
  if (!mac) return null;

  const lease = leaseByMac.get(mac);
  const signalRaw =
    row["signal"] ||
    row["signal-strength"] ||
    row["rx-signal"] ||
    row["last-signal"];
  const signal = signalRaw != null ? Number(String(signalRaw).split("@")[0]) : null;

  return {
    mac_address: mac,
    identity_key: identityKey(mac, lease?.clientId),
    hostname: lease?.hostName || row["host-name"] || null,
    ip_address:
      lease?.activeAddress ||
      lease?.address ||
      row.address ||
      row["last-ip"] ||
      null,
    vendor: null,
    device_type: null,
    connection_type: "wifi",
    ssid: row.ssid || row["ap"] || null,
    interface_name: row.interface || row[".id"] || null,
    signal_strength: Number.isFinite(signal) ? signal : null,
    connection_status: "online",
    bytes_download:
      row["bytes"] != null
        ? Number(String(row["bytes"]).split(",")[0]) || null
        : row["rx-bytes"] != null
          ? Number(row["rx-bytes"])
          : null,
    bytes_upload:
      row["bytes"] != null
        ? Number(String(row["bytes"]).split(",")[1]) || null
        : row["tx-bytes"] != null
          ? Number(row["tx-bytes"])
          : null,
    connected_at: null,
  };
}

export async function discoverWifiClients(
  client: RouterClient,
  stack: WirelessStack,
  leases: DhcpLease[]
): Promise<DiscoveredDevice[]> {
  const leaseByMac = new Map<string, DhcpLease>();
  for (const lease of leases) {
    const mac = lease.activeMacAddress || lease.macAddress;
    if (mac) leaseByMac.set(mac, lease);
  }

  let rows: Record<string, string>[] = [];

  if (stack === "wifi") {
    try {
      rows = await client.get("/interface/wifi/registration-table");
    } catch (err) {
      logger.warn({ err }, "wifi registration-table failed; trying alternate");
      try {
        rows = await client.get("/interface/wifi/station");
      } catch (err2) {
        logger.error({ err2 }, "Unable to read wifi clients");
        rows = [];
      }
    }
  } else if (stack === "wireless") {
    rows = await client.get("/interface/wireless/registration-table");
  } else {
    // Unknown stack: try both without assuming either works
    try {
      rows = await client.get("/interface/wifi/registration-table");
      stack = "wifi";
    } catch {
      try {
        rows = await client.get("/interface/wireless/registration-table");
        stack = "wireless";
      } catch (err) {
        logger.warn({ err }, "No wireless clients available on this router");
        rows = [];
      }
    }
  }

  if (!Array.isArray(rows)) rows = [];

  const devices: DiscoveredDevice[] = [];
  for (const row of rows) {
    const mapped = mapRegistration(row, stack, leaseByMac);
    if (mapped) devices.push(mapped);
  }

  // Also surface active DHCP leases that may be wired or not in registration table
  for (const lease of leases) {
    if (lease.status !== "bound") continue;
    const mac = lease.activeMacAddress || lease.macAddress;
    if (!mac) continue;
    if (devices.some((d) => d.mac_address === mac)) continue;
    devices.push({
      mac_address: mac,
      identity_key: identityKey(mac, lease.clientId),
      hostname: lease.hostName,
      ip_address: lease.activeAddress || lease.address,
      connection_type: "dhcp",
      connection_status: "online",
      signal_strength: null,
      ssid: null,
      interface_name: null,
    });
  }

  return devices;
}
