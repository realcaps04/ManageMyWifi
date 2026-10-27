import { Router } from "express";
import { memoryStore } from "../db/memory-store";
import { requireUser } from "../middleware/auth";

export const analyticsRouter = Router();

analyticsRouter.use(requireUser);

analyticsRouter.get("/usage", (_req, res) => {
  res.json({
    data: [],
    available: false,
    message: "Usage analytics require agent traffic counters and historical rollups.",
  });
});

analyticsRouter.get("/devices", (_req, res) => {
  const devices = [...memoryStore.devices.values()]
    .map((d) => ({
      id: d.id,
      name: d.display_name || d.hostname || d.mac_address,
      bytes_download: d.bytes_download,
      bytes_upload: d.bytes_upload,
      connection_status: d.connection_status,
    }))
    .sort(
      (a, b) =>
        b.bytes_download + b.bytes_upload - (a.bytes_download + a.bytes_upload)
    )
    .slice(0, 20);

  res.json({ data: devices });
});
