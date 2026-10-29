import { Router } from "express";
import { z } from "zod";
import { memoryStore } from "../db/memory-store";
import { requireUser } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const networkRouter = Router();

networkRouter.use(requireUser);

networkRouter.get("/status", (_req, res) => {
  res.json(memoryStore.getNetworkStatus());
});

/** Safe view for the website (never returns the router password). */
networkRouter.get("/router-connection", (_req, res) => {
  res.json(memoryStore.getRouterConnectionPublic());
});

const routerConnectionSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  user: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256).optional(),
  tls_insecure: z.boolean().optional(),
});

/**
 * Users enter router credentials in Settings (website).
 * The LAN agent pulls the full secret via /agent/router-connection.
 */
networkRouter.put(
  "/router-connection",
  validateBody(routerConnectionSchema),
  (req, res) => {
    try {
      const current = memoryStore.getRouterConnectionPublic();
      if (!req.body.password && !current.password_set) {
        return res
          .status(400)
          .json({ error: "Router password is required the first time" });
      }
      const saved = memoryStore.setRouterConnection(req.body);
      res.json({
        ...saved,
        message:
          "Saved. The local agent will use these details on its next refresh.",
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Invalid router settings",
      });
    }
  }
);
