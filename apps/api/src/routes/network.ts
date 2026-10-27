import { Router } from "express";
import { memoryStore } from "../db/memory-store";
import { requireUser } from "../middleware/auth";

export const networkRouter = Router();

networkRouter.use(requireUser);

networkRouter.get("/status", (_req, res) => {
  res.json(memoryStore.getNetworkStatus());
});
