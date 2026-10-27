/** Shared domain types for WiFi Control monorepo */

export type Uuid = string;

export type AgentStatus = "online" | "offline" | "degraded";
export type RouterStatus = "connected" | "disconnected" | "unknown";
export type DeviceConnectionStatus = "online" | "offline" | "unknown";
export type AccessRuleType = "suspend" | "block";
export type AccessRuleStatus = "active" | "expired" | "removed";
export type CommandStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";
export type CommandType =
  | "sync_devices"
  | "suspend_device"
  | "resume_device"
  | "block_device"
  | "unblock_device"
  | "disconnect_device"
  | "set_bandwidth_limit"
  | "remove_bandwidth_limit"
  | "get_router_status"
  | "backup_config";

export type WirelessStack = "wifi" | "wireless" | "unknown";

export interface Profile {
  id: Uuid;
  email: string;
  full_name: string | null;
  role: "admin" | "operator" | "viewer";
  created_at: string;
  updated_at: string;
}

export interface Network {
  id: Uuid;
  name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Router {
  id: Uuid;
  network_id: Uuid;
  name: string;
  model: string | null;
  routeros_version: string | null;
  host: string;
  status: RouterStatus;
  last_seen_at: string | null;
  cpu_load: number | null;
  memory_used_percent: number | null;
  uptime_seconds: number | null;
  wireless_stack: WirelessStack;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: Uuid;
  network_id: Uuid;
  name: string;
  status: AgentStatus;
  version: string | null;
  last_heartbeat_at: string | null;
  hostname: string | null;
  created_at: string;
  updated_at: string;
}

export interface NetworkUser {
  id: Uuid;
  network_id: Uuid;
  full_name: string;
  email: string | null;
  phone: string | null;
  description: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: Uuid;
  network_id: Uuid;
  mac_address: string;
  /** Stable identity when available (DHCP reservation / client-id) */
  identity_key: string;
  hostname: string | null;
  display_name: string | null;
  ip_address: string | null;
  ipv6_address: string | null;
  vendor: string | null;
  device_type: string | null;
  connection_type: string | null;
  ssid: string | null;
  interface_name: string | null;
  signal_strength: number | null;
  connection_status: DeviceConnectionStatus;
  first_seen_at: string;
  last_seen_at: string;
  assigned_user_id: Uuid | null;
  is_blocked: boolean;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeviceSession {
  id: Uuid;
  device_id: Uuid;
  network_id: Uuid;
  started_at: string;
  ended_at: string | null;
  ip_address: string | null;
  ssid: string | null;
  interface_name: string | null;
}

export interface AccessRule {
  id: Uuid;
  network_id: Uuid;
  device_id: Uuid;
  rule_type: AccessRuleType;
  status: AccessRuleStatus;
  reason: string | null;
  expires_at: string | null;
  created_by: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface BandwidthLimit {
  id: Uuid;
  network_id: Uuid;
  device_id: Uuid;
  download_mbps: number;
  upload_mbps: number;
  created_at: string;
  updated_at: string;
}

export interface UsageStatistic {
  id: Uuid;
  network_id: Uuid;
  device_id: Uuid | null;
  user_id: Uuid | null;
  period_start: string;
  period_end: string;
  bytes_download: number;
  bytes_upload: number;
}

export interface CommandQueueItem {
  id: Uuid;
  network_id: Uuid;
  agent_id: Uuid | null;
  command_type: CommandType;
  payload: Record<string, unknown>;
  status: CommandStatus;
  result: Record<string, unknown> | null;
  error_message: string | null;
  created_by: Uuid | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ActivityLog {
  id: Uuid;
  network_id: Uuid;
  actor_id: Uuid | null;
  action: string;
  target_type: string | null;
  target_id: Uuid | null;
  previous_status: string | null;
  new_status: string | null;
  result: string | null;
  error_details: string | null;
  created_at: string;
}

export interface NetworkEvent {
  id: Uuid;
  network_id: Uuid;
  device_id: Uuid | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Agent ↔ API payloads */

export interface AgentRegisterRequest {
  name: string;
  network_id: string;
  shared_secret: string;
  hostname?: string;
  version?: string;
}

export interface AgentRegisterResponse {
  agent_id: string;
  agent_token: string;
}

export interface AgentHeartbeatRequest {
  status: AgentStatus;
  version?: string;
  hostname?: string;
  router?: Partial<
    Pick<
      Router,
      | "model"
      | "routeros_version"
      | "status"
      | "cpu_load"
      | "memory_used_percent"
      | "uptime_seconds"
      | "wireless_stack"
    >
  >;
}

export interface DiscoveredDevice {
  mac_address: string;
  identity_key: string;
  hostname?: string | null;
  ip_address?: string | null;
  ipv6_address?: string | null;
  vendor?: string | null;
  device_type?: string | null;
  connection_type?: string | null;
  ssid?: string | null;
  interface_name?: string | null;
  signal_strength?: number | null;
  connection_status: DeviceConnectionStatus;
  bytes_download?: number | null;
  bytes_upload?: number | null;
  connected_at?: string | null;
}

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

export interface AgentSyncRequest {
  devices: DiscoveredDevice[];
  wifi_networks?: WifiNetworkInfo[];
  router?: AgentHeartbeatRequest["router"];
  synced_at: string;
}

export interface NetworkStatusResponse {
  network: Pick<Network, "id" | "name">;
  agent: {
    status: AgentStatus;
    last_heartbeat_at: string | null;
    name: string | null;
  };
  router: {
    status: RouterStatus;
    model: string | null;
    routeros_version: string | null;
    cpu_load: number | null;
    memory_used_percent: number | null;
    uptime_seconds: number | null;
    wireless_stack: WirelessStack;
    last_seen_at: string | null;
  };
  counts: {
    total_devices: number;
    connected_devices: number;
    blocked_devices: number;
    suspended_devices: number;
  };
  metrics: {
    download_bps: number | null;
    upload_bps: number | null;
    daily_bandwidth_bytes: number | null;
  };
  wifi_networks: WifiNetworkInfo[];
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
