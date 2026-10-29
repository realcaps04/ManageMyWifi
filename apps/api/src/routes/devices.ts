import { Router } from "express";
import {
  paginationSchema,
  updateDeviceSchema,
  suspendDeviceSchema,
  bandwidthLimitSchema,
} from "@wifi-control/validation";
import { memoryStore } from "../db/memory-store";
import { requireUser, type AuthedRequest } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { randomUUID } from "crypto";

export const devicesRouter = Router();

devicesRouter.use(requireUser);

devicesRouter.get(
  "/",
  validateQuery(paginationSchema),
  (req: AuthedRequest & { validatedQuery?: unknown }, res) => {
    const query = (req as typeof req & {
      validatedQuery: {
        page: number;
        pageSize: number;
        search?: string;
        status?: string;
      };
    }).validatedQuery;

    const result = memoryStore.listDevices({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
    });
    res.json(result);
  }
);

devicesRouter.get("/:id", (req, res) => {
  const device = memoryStore.getDevice(req.params.id);
  if (!device) return res.status(404).json({ error: "Device not found" });
  res.json(device);
});

devicesRouter.get("/:id/history", (req, res) => {
  const device = memoryStore.getDevice(req.params.id);
  if (!device) return res.status(404).json({ error: "Device not found" });
  // Session history not persisted in memory mode
  res.json({ data: [], available: false });
});

devicesRouter.patch(
  "/:id",
  validateBody(updateDeviceSchema),
  (req, res) => {
    const device = memoryStore.updateDevice(req.params.id, req.body);
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json(device);
  }
);

function enqueueControl(
  req: AuthedRequest,
  res: import("express").Response,
  commandType: string,
  payload: Record<string, unknown>
) {
  const device = memoryStore.getDevice(req.params.id);
  if (!device) return res.status(404).json({ error: "Device not found" });

  const id = randomUUID();
  const now = new Date().toISOString();
  const command = {
    id,
    network_id: memoryStore.network.id,
    agent_id: null,
    command_type: commandType as never,
    payload: {
      device_id: device.id,
      mac_address: device.mac_address,
      ip_address: device.ip_address,
      ...payload,
    },
    status: "pending" as const,
    result: null,
    error_message: null,
    created_by: req.userId ?? null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
  memoryStore.commands.set(id, command);

  res.status(202).json({
    queued: true,
    command_id: id,
    message:
      "Command queued for the local agent. Success is confirmed after the agent verifies router state.",
  });
}

devicesRouter.post(
  "/:id/suspend",
  validateBody(suspendDeviceSchema),
  (req: AuthedRequest, res) => enqueueControl(req, res, "suspend_device", req.body)
);

devicesRouter.post("/:id/resume", (req: AuthedRequest, res) =>
  enqueueControl(req, res, "resume_device", {})
);

devicesRouter.post("/:id/block", (req: AuthedRequest, res) =>
  enqueueControl(req, res, "block_device", req.body ?? {})
);

devicesRouter.post("/:id/unblock", (req: AuthedRequest, res) =>
  enqueueControl(req, res, "unblock_device", {})
);

devicesRouter.post("/:id/disconnect", (req: AuthedRequest, res) =>
  enqueueControl(req, res, "disconnect_device", {})
);

devicesRouter.put(
  "/:id/limits",
  validateBody(bandwidthLimitSchema),
  (req: AuthedRequest, res) =>
    enqueueControl(req, res, "set_bandwidth_limit", req.body)
);
