import { Router } from "express";
import { memoryStore } from "../db/memory-store";
import { requireUser } from "../middleware/auth";

export const routerStatusRouter = Router();

routerStatusRouter.use(requireUser);

routerStatusRouter.get("/status", (_req, res) => {
  const status = memoryStore.getNetworkStatus();
  res.json({
    ...status.router,
    host: memoryStore.router.host,
    name: memoryStore.router.name,
    wifi_networks: status.wifi_networks,
  });
});

routerStatusRouter.get("/interfaces", (_req, res) => {
  const networks = memoryStore.wifiNetworks;
  res.json({
    data: networks,
    available: networks.length > 0,
    message:
      networks.length === 0
        ? "No WiFi interfaces reported yet. Start the local agent with a reachable router."
        : undefined,
  });
});

routerStatusRouter.get("/wifi", (_req, res) => {
  const networks = memoryStore.wifiNetworks;
  const devices = [...memoryStore.devices.values()].filter(
    (d) => d.connection_status === "online"
  );
  res.json({
    data: networks.map((n) => ({
      ...n,
      online_devices: devices.filter(
        (d) =>
          (n.ssid && d.ssid === n.ssid) ||
          (n.interface_name && d.interface_name === n.interface_name)
      ).length,
    })),
    available: networks.length > 0,
  });
});
