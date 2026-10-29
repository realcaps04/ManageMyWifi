/**
 * In-memory store for local agent ↔ API ↔ web development.
 * Data resets on process restart — suitable for local testing and Vercel warm invocations.
 */

import { randomUUID, createHash } from "crypto";
import type {
  ActivityLog,
  Agent,
  AgentStatus,
  CommandQueueItem,
  Device,
  DiscoveredDevice,
  Network,
  NetworkStatusResponse,
  NetworkUser,
  Router,
  RouterStatus,
  WifiNetworkInfo,
  WirelessStack,
} from "@wifi-control/shared-types";

function nowIso() {
  return new Date().toISOString();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class MemoryStore {
  readonly mode = "memory" as const;

  network: Network = {
    id: process.env.DEV_NETWORK_ID || "00000000-0000-4000-8000-000000000001",
    name: process.env.NETWORK_NAME || "ManageMyWifi",
    timezone: "UTC",
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  router: Router = {
    id: randomUUID(),
    network_id: "",
    name: "Router",
    model: null,
    routeros_version: null,
    host: process.env.ROUTER_HOST || process.env.MIKROTIK_HOST || "192.168.1.1",
    status: "unknown",
    last_seen_at: null,
    cpu_load: null,
    memory_used_percent: null,
    uptime_seconds: null,
    wireless_stack: "unknown",
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  agents = new Map<string, Agent & { token_hash: string }>();
  devices = new Map<string, Device & { bytes_download: number; bytes_upload: number }>();
  users = new Map<string, NetworkUser>();
  commands = new Map<string, CommandQueueItem>();
  activityLogs: ActivityLog[] = [];
  agentTokens = new Map<string, string>(); // token -> agentId
  wifiNetworks: WifiNetworkInfo[] = [];

  /** Router LAN credentials set from the website (agent pulls these). */
  routerConnection: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls_insecure: boolean;
    updated_at: string | null;
  } = {
    host:
      process.env.ROUTER_HOST ||
      process.env.MIKROTIK_HOST ||
      "192.168.1.1",
    port: Number(process.env.ROUTER_PORT || process.env.MIKROTIK_PORT || 443),
    user:
      process.env.ROUTER_USER ||
      process.env.MIKROTIK_USER ||
      "admin",
    password:
      process.env.ROUTER_PASSWORD ||
      process.env.MIKROTIK_PASSWORD ||
      "",
    tls_insecure:
      (process.env.ROUTER_TLS_INSECURE ||
        process.env.MIKROTIK_TLS_INSECURE ||
        "true") !== "false",
    updated_at: null,
  };

  /**
   * Per-network portal overrides (ssid lowercased → Wi‑Fi password).
   * Used when the agent cannot read the router passphrase, or for bootstrap.
   * Live router SSIDs + passphrases always take precedence when present.
   */
  portal: {
    /** @deprecated single-SSID mode — migrated into credentials */
    ssid: string | null;
    password: string | null;
    /** ssid (lower) → password override for that network */
    credentials: Record<string, string>;
  } = (() => {
    const ssid = process.env.WIFI_LOGIN_SSID || null;
    const password = process.env.WIFI_LOGIN_PASSWORD || null;
    const credentials: Record<string, string> = {};
    if (ssid && password) credentials[ssid.trim().toLowerCase()] = password;
    return { ssid, password, credentials };
  })();

  constructor() {
    this.router.network_id = this.network.id;
    this.router.host = this.routerConnection.host;
  }

  getRouterConnectionPublic() {
    const c = this.routerConnection;
    return {
      host: c.host,
      port: c.port,
      user: c.user,
      password_set: Boolean(c.password),
      tls_insecure: c.tls_insecure,
      updated_at: c.updated_at,
      configured: Boolean(c.host && c.user && c.password),
    };
  }

  getRouterConnectionForAgent() {
    const c = this.routerConnection;
    return {
      host: c.host,
      port: c.port,
      user: c.user,
      password: c.password,
      tls_insecure: c.tls_insecure,
      updated_at: c.updated_at,
      configured: Boolean(c.host && c.user && c.password),
    };
  }

  setRouterConnection(input: {
    host: string;
    port?: number;
    user: string;
    password?: string;
    tls_insecure?: boolean;
  }) {
    const host = input.host.trim();
    const user = input.user.trim();
    if (!host || !user) {
      throw new Error("Router host and username are required");
    }
    this.routerConnection.host = host;
    this.routerConnection.port = input.port ?? this.routerConnection.port;
    this.routerConnection.user = user;
    if (input.password !== undefined && input.password !== "") {
      this.routerConnection.password = input.password;
    }
    if (input.tls_insecure !== undefined) {
      this.routerConnection.tls_insecure = input.tls_insecure;
    }
    this.routerConnection.updated_at = nowIso();
    this.router.host = host;
    this.router.updated_at = nowIso();
    return this.getRouterConnectionPublic();
  }

  registerAgent(input: {
    name: string;
    network_id: string;
    hostname?: string;
    version?: string;
  }) {
    const token = `wc_agent_${randomUUID().replace(/-/g, "")}`;
    const id = randomUUID();
    const agent: Agent & { token_hash: string } = {
      id,
      network_id: input.network_id,
      name: input.name,
      status: "online",
      version: input.version ?? null,
      hostname: input.hostname ?? null,
      last_heartbeat_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
      token_hash: hashToken(token),
    };
    this.agents.set(id, agent);
    this.agentTokens.set(token, id);
    return { agent_id: id, agent_token: token };
  }

  authenticateAgent(token: string) {
    const id = this.agentTokens.get(token);
    if (!id) return null;
    return this.agents.get(id) ?? null;
  }

  heartbeat(
    agentId: string,
    data: {
      status: AgentStatus;
      version?: string;
      hostname?: string;
      router?: {
        model?: string | null;
        routeros_version?: string | null;
        status?: RouterStatus;
        cpu_load?: number | null;
        memory_used_percent?: number | null;
        uptime_seconds?: number | null;
        wireless_stack?: WirelessStack;
      };
    }
  ) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    agent.status = data.status;
    agent.last_heartbeat_at = nowIso();
    agent.updated_at = nowIso();
    if (data.version) agent.version = data.version;
    if (data.hostname) agent.hostname = data.hostname;

    if (data.router) {
      Object.assign(this.router, {
        ...data.router,
        last_seen_at: nowIso(),
        updated_at: nowIso(),
      });
    }
    return agent;
  }

  syncDevices(
    devices: DiscoveredDevice[],
    router?: Partial<Router>,
    wifiNetworks?: WifiNetworkInfo[]
  ) {
    const seen = new Set<string>();
    const ts = nowIso();

    if (wifiNetworks) {
      this.wifiNetworks = wifiNetworks.map((n) => ({
        interface_name: n.interface_name,
        ssid: n.ssid ?? null,
        band: n.band ?? null,
        channel: n.channel ?? null,
        frequency: n.frequency ?? null,
        running: Boolean(n.running),
        disabled: Boolean(n.disabled),
        mode: n.mode ?? null,
        clients: n.clients ?? 0,
        passphrase: n.passphrase ?? null,
      }));
    }

    for (const d of devices) {
      seen.add(d.identity_key);
      const existing = [...this.devices.values()].find(
        (x) => x.identity_key === d.identity_key
      );
      if (existing) {
        const changed =
          existing.ip_address !== (d.ip_address ?? null) ||
          existing.connection_status !== d.connection_status ||
          existing.signal_strength !== (d.signal_strength ?? null) ||
          existing.hostname !== (d.hostname ?? null) ||
          existing.ssid !== (d.ssid ?? null);

        if (changed || existing.connection_status === "online") {
          existing.mac_address = d.mac_address;
          existing.hostname = d.hostname ?? existing.hostname;
          existing.ip_address = d.ip_address ?? null;
          existing.ipv6_address = d.ipv6_address ?? null;
          existing.vendor = d.vendor ?? existing.vendor;
          existing.device_type = d.device_type ?? existing.device_type;
          existing.connection_type = d.connection_type ?? existing.connection_type;
          existing.ssid = d.ssid ?? null;
          existing.interface_name = d.interface_name ?? null;
          existing.signal_strength = d.signal_strength ?? null;
          existing.connection_status = d.connection_status;
          existing.last_seen_at = ts;
          existing.bytes_download = d.bytes_download ?? existing.bytes_download;
          existing.bytes_upload = d.bytes_upload ?? existing.bytes_upload;
          existing.updated_at = ts;
        }
      } else {
        const id = randomUUID();
        this.devices.set(id, {
          id,
          network_id: this.network.id,
          mac_address: d.mac_address,
          identity_key: d.identity_key,
          hostname: d.hostname ?? null,
          display_name: null,
          ip_address: d.ip_address ?? null,
          ipv6_address: d.ipv6_address ?? null,
          vendor: d.vendor ?? null,
          device_type: d.device_type ?? null,
          connection_type: d.connection_type ?? null,
          ssid: d.ssid ?? null,
          interface_name: d.interface_name ?? null,
          signal_strength: d.signal_strength ?? null,
          connection_status: d.connection_status,
          first_seen_at: ts,
          last_seen_at: ts,
          assigned_user_id: null,
          is_blocked: false,
          is_suspended: false,
          bytes_download: d.bytes_download ?? 0,
          bytes_upload: d.bytes_upload ?? 0,
          created_at: ts,
          updated_at: ts,
        });
      }
    }

    // Mark devices not seen in this sync as offline (WiFi clients only)
    for (const device of this.devices.values()) {
      if (!seen.has(device.identity_key) && device.connection_status === "online") {
        device.connection_status = "offline";
        device.updated_at = ts;
      }
    }

    if (router) {
      Object.assign(this.router, router, { last_seen_at: ts, updated_at: ts });
    }

    return { upserted: devices.length, total: this.devices.size };
  }

  listDevices(opts: {
    search?: string;
    status?: string;
    page: number;
    pageSize: number;
  }) {
    let items = [...this.devices.values()];
    if (opts.status && opts.status !== "all") {
      items = items.filter((d) => d.connection_status === opts.status);
    }
    if (opts.search) {
      const q = opts.search.toLowerCase();
      items = items.filter(
        (d) =>
          d.hostname?.toLowerCase().includes(q) ||
          d.display_name?.toLowerCase().includes(q) ||
          d.mac_address.toLowerCase().includes(q) ||
          d.ip_address?.toLowerCase().includes(q) ||
          d.vendor?.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
    const total = items.length;
    const start = (opts.page - 1) * opts.pageSize;
    const data = items.slice(start, start + opts.pageSize);
    return { data, total, page: opts.page, pageSize: opts.pageSize };
  }

  getDevice(id: string) {
    return this.devices.get(id) ?? null;
  }

  updateDevice(
    id: string,
    patch: Partial<Pick<Device, "display_name" | "assigned_user_id" | "device_type">>
  ) {
    const device = this.devices.get(id);
    if (!device) return null;
    Object.assign(device, patch, { updated_at: nowIso() });
    return device;
  }

  getNetworkStatus(): NetworkStatusResponse {
    const agents = [...this.agents.values()];
    const primary = agents.sort((a, b) =>
      (b.last_heartbeat_at || "").localeCompare(a.last_heartbeat_at || "")
    )[0];

    const staleMs = 90_000;
    const heartbeatFresh =
      primary?.last_heartbeat_at &&
      Date.now() - new Date(primary.last_heartbeat_at).getTime() < staleMs;

    const agentStatus: AgentStatus = !primary
      ? "offline"
      : heartbeatFresh
        ? primary.status
        : "offline";

    const devices = [...this.devices.values()];
    return {
      network: { id: this.network.id, name: this.network.name },
      agent: {
        status: agentStatus,
        last_heartbeat_at: primary?.last_heartbeat_at ?? null,
        name: primary?.name ?? null,
      },
      router: {
        status: this.router.status,
        model: this.router.model,
        routeros_version: this.router.routeros_version,
        cpu_load: this.router.cpu_load,
        memory_used_percent: this.router.memory_used_percent,
        uptime_seconds: this.router.uptime_seconds,
        wireless_stack: this.router.wireless_stack,
        last_seen_at: this.router.last_seen_at,
      },
      counts: {
        total_devices: devices.length,
        connected_devices: devices.filter((d) => d.connection_status === "online")
          .length,
        blocked_devices: devices.filter((d) => d.is_blocked).length,
        suspended_devices: devices.filter((d) => d.is_suspended).length,
      },
      metrics: {
        download_bps: null,
        upload_bps: null,
        daily_bandwidth_bytes: null,
      },
      // Never expose Wi‑Fi passphrases to the browser
      wifi_networks: this.wifiNetworks.map(
        ({ passphrase: _passphrase, ...rest }) => rest
      ),
    };
  }

  listPendingCommands(networkId: string, limit = 10) {
    return [...this.commands.values()]
      .filter((c) => c.network_id === networkId && c.status === "pending")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
  }

  completeCommand(
    id: string,
    result: {
      status: "succeeded" | "failed";
      result?: Record<string, unknown>;
      error_message?: string;
      verified?: boolean;
    }
  ) {
    const cmd = this.commands.get(id);
    if (!cmd) return null;
    cmd.status = result.status;
    cmd.result = result.result ?? null;
    cmd.error_message = result.error_message ?? null;
    cmd.completed_at = nowIso();
    cmd.updated_at = nowIso();

    if (result.status === "succeeded") {
      const deviceId =
        (result.result?.device_id as string | undefined) ||
        (cmd.payload.device_id as string | undefined);
      if (deviceId) {
        const device = this.devices.get(deviceId);
        if (device) {
          if (cmd.command_type === "suspend_device") device.is_suspended = true;
          if (cmd.command_type === "resume_device") device.is_suspended = false;
          if (cmd.command_type === "block_device") device.is_blocked = true;
          if (cmd.command_type === "unblock_device") device.is_blocked = false;
          device.updated_at = nowIso();
        }
      }
    }

    return cmd;
  }
}

/** Reuse one store across warm Vercel serverless invocations. */
const globalStore = globalThis as typeof globalThis & {
  __wifiControlStore?: MemoryStore;
};

export const memoryStore =
  globalStore.__wifiControlStore ??
  (globalStore.__wifiControlStore = new MemoryStore());

