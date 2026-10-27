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
  });
});

routerStatusRouter.get("/interfaces", (_req, res) => {
  res.json({
    data: [],
    available: false,
    message:
      "Interface inventory will be populated by the local agent in a subsequent sync enhancement.",
  });
});
