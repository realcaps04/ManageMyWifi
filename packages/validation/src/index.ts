import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const macAddressSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/-/g, ":"))
  .refine((v) => /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(v), {
    message: "Invalid MAC address",
  });

export const agentRegisterSchema = z.object({
  name: z.string().min(1).max(120),
  network_id: uuidSchema,
  shared_secret: z.string().min(8),
  hostname: z.string().max(255).optional(),
  version: z.string().max(64).optional(),
});

export const agentHeartbeatSchema = z.object({
  status: z.enum(["online", "offline", "degraded"]),
  version: z.string().max(64).optional(),
  hostname: z.string().max(255).optional(),
  router: z
    .object({
      model: z.string().nullable().optional(),
      routeros_version: z.string().nullable().optional(),
      status: z.enum(["connected", "disconnected", "unknown"]).optional(),
      cpu_load: z.number().min(0).max(100).nullable().optional(),
      memory_used_percent: z.number().min(0).max(100).nullable().optional(),
      uptime_seconds: z.number().int().nonnegative().nullable().optional(),
      wireless_stack: z.enum(["wifi", "wireless", "unknown"]).optional(),
    })
    .optional(),
});

export const discoveredDeviceSchema = z.object({
  mac_address: macAddressSchema,
  identity_key: z.string().min(1).max(255),
  hostname: z.string().nullable().optional(),
  ip_address: z.string().nullable().optional(),
  ipv6_address: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  device_type: z.string().nullable().optional(),
  connection_type: z.string().nullable().optional(),
  ssid: z.string().nullable().optional(),
  interface_name: z.string().nullable().optional(),
  signal_strength: z.number().nullable().optional(),
  connection_status: z.enum(["online", "offline", "unknown"]),
  bytes_download: z.number().int().nonnegative().nullable().optional(),
  bytes_upload: z.number().int().nonnegative().nullable().optional(),
  connected_at: z.string().datetime().nullable().optional(),
});

export const wifiNetworkSchema = z.object({
  interface_name: z.string().min(1).max(120),
  ssid: z.string().nullable().optional(),
  band: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
  running: z.boolean().optional(),
  disabled: z.boolean().optional(),
  mode: z.string().nullable().optional(),
  clients: z.number().int().nonnegative().optional(),
});

export const agentSyncSchema = z.object({
  devices: z.array(discoveredDeviceSchema).max(2000),
  wifi_networks: z.array(wifiNetworkSchema).max(100).optional(),
  router: agentHeartbeatSchema.shape.router,
  synced_at: z.string().datetime(),
});

export const agentCommandResultSchema = z.object({
  status: z.enum(["succeeded", "failed"]),
  result: z.record(z.unknown()).optional(),
  error_message: z.string().max(2000).optional(),
  verified: z.boolean().default(false),
});

export const createUserSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
});

export const updateUserSchema = createUserSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateDeviceSchema = z.object({
  display_name: z.string().max(200).nullable().optional(),
  assigned_user_id: uuidSchema.nullable().optional(),
  device_type: z.string().max(80).nullable().optional(),
});

export const suspendDeviceSchema = z.object({
  reason: z.string().max(500).optional(),
  expires_at: z.string().datetime().optional(),
});

export const bandwidthLimitSchema = z.object({
  download_mbps: z.number().positive().max(10000),
  upload_mbps: z.number().positive().max(10000),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().max(200).optional(),
  status: z.enum(["online", "offline", "unknown", "all"]).optional(),
});

export type AgentRegisterInput = z.infer<typeof agentRegisterSchema>;
export type AgentHeartbeatInput = z.infer<typeof agentHeartbeatSchema>;
export type AgentSyncInput = z.infer<typeof agentSyncSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
