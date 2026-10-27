import type { WirelessStack } from "@wifi-control/shared-types";
import { MikroTikClient } from "../router/mikrotik-client";
import { detectCapabilities, type RouterCapabilities } from "../router/capability";
import { fetchDhcpLeases } from "../router/dhcp";
import { discoverWifiClients } from "../router/wifi-clients";
import { discoverWifiInterfaces } from "../router/wifi-interfaces";
import { BackendClient } from "./backend-client";
import { logger } from "../utils/logger";

export class SyncService {
  private lastCaps: RouterCapabilities | null = null;
  private wirelessStack: WirelessStack = "unknown";

  constructor(
    private router: MikroTikClient,
    private backend: BackendClient
  ) {}

  get capabilities() {
    return this.lastCaps;
  }

  get stack() {
    return this.wirelessStack;
  }

  async refreshCapabilities() {
    this.lastCaps = await detectCapabilities(this.router);
    this.wirelessStack = this.lastCaps.wirelessStack;
    return this.lastCaps;
  }

  async syncOnce() {
    if (!this.lastCaps) {
      await this.refreshCapabilities();
    } else {
      // Refresh resource metrics each sync
      try {
        this.lastCaps = await detectCapabilities(this.router);
        this.wirelessStack = this.lastCaps.wirelessStack;
      } catch (err) {
        logger.warn({ err }, "Capability refresh failed; using last known");
      }
    }

    const leases = await fetchDhcpLeases(this.router);
    const devices = await discoverWifiClients(
      this.router,
      this.wirelessStack,
      leases
    );
    const wifiNetworks = await discoverWifiInterfaces(
      this.router,
      this.wirelessStack
    );

    const caps = this.lastCaps!;
    const result = await this.backend.sync({
      devices,
      wifi_networks: wifiNetworks,
      synced_at: new Date().toISOString(),
      router: {
        model: caps.model,
        routeros_version: caps.version,
        status: "connected",
        cpu_load: caps.cpuLoad,
        memory_used_percent: caps.memoryUsedPercent,
        uptime_seconds: caps.uptimeSeconds,
        wireless_stack: caps.wirelessStack,
      },
    });

    logger.info(
      {
        deviceCount: devices.length,
        leaseCount: leases.length,
        wifiNetworks: wifiNetworks.length,
        result,
      },
      "Sync completed"
    );
    return { devices, leases, caps, wifiNetworks };
  }
}
