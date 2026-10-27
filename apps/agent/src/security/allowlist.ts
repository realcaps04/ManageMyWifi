import type { CommandType } from "@wifi-control/shared-types";

export const COMMAND_ALLOWLIST: readonly CommandType[] = [
  "sync_devices",
  "suspend_device",
  "resume_device",
  "block_device",
  "unblock_device",
  "disconnect_device",
  "set_bandwidth_limit",
  "remove_bandwidth_limit",
  "get_router_status",
  "backup_config",
] as const;

export function isAllowedCommand(type: string): type is CommandType {
  return (COMMAND_ALLOWLIST as readonly string[]).includes(type);
}

/** RouterOS comment / list namespace for app-managed rules */
export const RULE_NAMESPACE = "wifi-control";
export const ADDRESS_LIST_SUSPEND = "wifi-control:suspend";
export const ADDRESS_LIST_BLOCK = "wifi-control:block";
export const QUEUE_PREFIX = "wc-";
