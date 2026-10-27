const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiBaseUrl() {
  return API_BASE;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }

  return data as T;
}

export interface NetworkStatus {
  network: { id: string; name: string };
  agent: {
    status: "online" | "offline" | "degraded";
    last_heartbeat_at: string | null;
    name: string | null;
  };
  router: {
    status: "connected" | "disconnected" | "unknown";
    model: string | null;
    routeros_version: string | null;
    cpu_load: number | null;
    memory_used_percent: number | null;
    uptime_seconds: number | null;
    wireless_stack: "wifi" | "wireless" | "unknown";
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
  wifi_networks: WifiNetwork[];
}

export interface WifiNetwork {
  interface_name: string;
  ssid: string | null;
  band: string | null;
  channel: string | null;
  frequency: string | null;
  running: boolean;
  disabled: boolean;
  mode: string | null;
  clients: number;
  online_devices?: number;
}

export interface Device {
  id: string;
  network_id: string;
  mac_address: string;
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
  connection_status: "online" | "offline" | "unknown";
  first_seen_at: string;
  last_seen_at: string;
  assigned_user_id: string | null;
  is_blocked: boolean;
  is_suspended: boolean;
  bytes_download?: number;
  bytes_upload?: number;
}

export interface DeviceListResponse {
  data: Device[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CommandQueuedResponse {
  queued: boolean;
  command_id: string;
  message?: string;
}

export interface NetworkUser {
  id: string;
  network_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  description: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export const api = {
  getAuthStatus: () =>
    request<{
      login_required: boolean;
      password_configured: boolean;
      known_ssid_count: number;
      network_name: string;
      suggested_ssids: string[];
    }>("/auth/status"),
  wifiLogin: (ssid: string, password: string) =>
    request<{
      token: string;
      ssid: string;
      network: { id: string; name: string };
      expires_in_hours: number;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ ssid, password }),
    }),
  authMe: () =>
    request<{ userId: string; networkId?: string; ssid: string | null }>(
      "/auth/me"
    ),
  getPortal: () =>
    request<{
      ssid: string | null;
      password_set: boolean;
      suggested_ssids: string[];
    }>("/auth/portal"),
  updatePortal: (body: { ssid?: string; password?: string }) =>
    request<{ ssid: string | null; password_set: boolean }>("/auth/portal", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getNetworkStatus: () => request<NetworkStatus>("/network/status"),
  getDevices: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.pageSize) q.set("pageSize", String(params.pageSize));
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return request<DeviceListResponse>(`/devices${qs ? `?${qs}` : ""}`);
  },
  getDevice: (id: string) => request<Device>(`/devices/${id}`),
  updateDevice: (
    id: string,
    body: {
      display_name?: string | null;
      assigned_user_id?: string | null;
      device_type?: string | null;
    }
  ) =>
    request<Device>(`/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getRouterStatus: () =>
    request<
      NetworkStatus["router"] & {
        host?: string;
        name?: string;
        wifi_networks?: WifiNetwork[];
      }
    >("/router/status"),
  getWifiNetworks: () =>
    request<{ data: WifiNetwork[]; available: boolean }>("/router/wifi"),
  getRouterInterfaces: () =>
    request<{ data: WifiNetwork[]; available: boolean; message?: string }>(
      "/router/interfaces"
    ),
  suspendDevice: (id: string, body?: { reason?: string; expires_at?: string }) =>
    request<CommandQueuedResponse>(`/devices/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  resumeDevice: (id: string) =>
    request<CommandQueuedResponse>(`/devices/${id}/resume`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  blockDevice: (id: string) =>
    request<CommandQueuedResponse>(`/devices/${id}/block`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  unblockDevice: (id: string) =>
    request<CommandQueuedResponse>(`/devices/${id}/unblock`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  disconnectDevice: (id: string) =>
    request<CommandQueuedResponse>(`/devices/${id}/disconnect`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  setBandwidthLimits: (
    id: string,
    body: { download_mbps: number; upload_mbps: number }
  ) =>
    request<CommandQueuedResponse>(`/devices/${id}/limits`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getUsers: () => request<{ data: NetworkUser[] }>("/users"),
  createUser: (body: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    description?: string | null;
  }) =>
    request<NetworkUser>("/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteUser: (id: string) =>
    request<void>(`/users/${id}`, { method: "DELETE" }),
};
