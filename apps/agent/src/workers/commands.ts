import type { CommandQueueItem, CommandType } from "@wifi-control/shared-types";
import { BackendClient } from "../services/backend-client";
import { RouterClient } from "../router/router-client";
import type { SyncService } from "../services/sync";
import {
  blockAddressFirewall,
  resumeAddress,
  suspendAddress,
  unblockAddressFirewall,
} from "../router/firewall";
import {
  allowWifiMac,
  denyWifiMac,
  disconnectWifiClient,
} from "../router/access-list";
import { setSimpleQueue } from "../router/queues";
import { logger } from "../utils/logger";

const ALLOWED: ReadonlySet<CommandType> = new Set([
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
]);

export async function pollAndProcessCommands(
  backend: BackendClient,
  router: RouterClient,
  sync: SyncService
) {
  const { data } = await backend.getCommands();
  for (const cmd of data) {
    await processCommand(backend, router, sync, cmd);
  }
}

async function processCommand(
  backend: BackendClient,
  router: RouterClient,
  sync: SyncService,
  cmd: CommandQueueItem
) {
  if (!ALLOWED.has(cmd.command_type)) {
    await backend.reportCommandResult(cmd.id, {
      status: "failed",
      error_message: `Command type not allowlisted: ${cmd.command_type}`,
      verified: false,
    });
    return;
  }

  try {
    if (cmd.command_type === "sync_devices" || cmd.command_type === "get_router_status") {
      await sync.syncOnce();
      await backend.reportCommandResult(cmd.id, {
        status: "succeeded",
        result: { ok: true },
        verified: true,
      });
      return;
    }

    const payload = cmd.payload || {};
    const mac = String(payload.mac_address || "");
    const deviceId = String(payload.device_id || "");
    const ip = payload.ip_address ? String(payload.ip_address) : null;
    const stack = sync.stack === "unknown" ? "wifi" : sync.stack;

    if (
      ["suspend_device", "resume_device", "block_device", "unblock_device", "set_bandwidth_limit"].includes(
        cmd.command_type
      ) &&
      !ip &&
      !mac
    ) {
      throw new Error("Command missing device identity (mac/ip)");
    }

    // Prefer IP for firewall/queues; fall back to MAC where the router accepts it
    const addressTarget = ip || mac;

    let verified = false;
    let result: Record<string, unknown> = {};

    switch (cmd.command_type) {
      case "suspend_device": {
        const r = await suspendAddress(router, addressTarget, deviceId);
        verified = r.verified;
        result = r;
        break;
      }
      case "resume_device": {
        const r = await resumeAddress(router, addressTarget, deviceId);
        verified = r.verified;
        result = r;
        break;
      }
      case "block_device": {
        const wifi = await denyWifiMac(router, stack, mac, deviceId);
        const fw = ip
          ? await blockAddressFirewall(router, ip, deviceId)
          : { verified: true };
        await disconnectWifiClient(router, stack, mac).catch(() => null);
        verified = wifi.verified && fw.verified;
        result = { wifi, fw };
        break;
      }
      case "unblock_device": {
        const wifi = await allowWifiMac(router, stack, mac, deviceId);
        const fw = ip
          ? await unblockAddressFirewall(router, ip, deviceId)
          : { verified: true };
        verified = wifi.verified && fw.verified;
        result = { wifi, fw };
        break;
      }
      case "disconnect_device": {
        const r = await disconnectWifiClient(router, stack, mac);
        verified = r.verified;
        result = r;
        break;
      }
      case "set_bandwidth_limit": {
        if (!addressTarget) throw new Error("Missing IP/MAC for queue target");
        const r = await setSimpleQueue(router, {
          deviceId,
          target: addressTarget,
          downloadMbps: Number(payload.download_mbps),
          uploadMbps: Number(payload.upload_mbps),
        });
        verified = r.verified;
        result = r;
        break;
      }
      default:
        throw new Error(`Unhandled command: ${cmd.command_type}`);
    }

    if (!verified) {
      await backend.reportCommandResult(cmd.id, {
        status: "failed",
        error_message: "Router state could not be verified after applying change",
        result,
        verified: false,
      });
      return;
    }

    await backend.reportCommandResult(cmd.id, {
      status: "succeeded",
      result: { ...result, command_type: cmd.command_type, device_id: deviceId },
      verified: true,
    });
    logger.info({ commandType: cmd.command_type, deviceId }, "Command verified");
  } catch (err) {
    logger.error({ err, commandType: cmd.command_type, id: cmd.id }, "Command failed");
    await backend.reportCommandResult(cmd.id, {
      status: "failed",
      error_message: err instanceof Error ? err.message : "Command failed",
      verified: false,
    });
  }
}
