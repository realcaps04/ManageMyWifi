import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env, supabaseConfigured } from "./config";
import { logger } from "./logger";
import { memoryStore } from "./db/memory-store";
import { agentRouter } from "./routes/agent";
import { authRouter } from "./routes/auth";
import { networkRouter } from "./routes/network";
import { routerStatusRouter } from "./routes/router";
import { devicesRouter } from "./routes/devices";
import { usersRouter } from "./routes/users";
import { analyticsRouter } from "./routes/analytics";

export function createApp() {
  const app = express();

  app.use(helmet());

  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes("*")) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (
          /\.vercel\.app$/i.test(origin) ||
          allowedOrigins.some((o) => o.endsWith(".vercel.app"))
        ) {
          return callback(null, true);
        }
        // Same-origin browser calls from the Vercel web app
        if (process.env.VERCEL) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/api/health" },
    })
  );

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: process.env.VERCEL ? 120 : 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  const health = (_req: express.Request, res: express.Response) => {
    res.json({
      ok: true,
      service: "wifi-control-api",
      storage: supabaseConfigured ? "supabase" : "memory",
      network_id: memoryStore.network.id,
      network_name: memoryStore.network.name,
    });
  };

  app.get("/health", health);
  app.get("/api/health", health);

  const v1 = express.Router();
  v1.use("/auth", authRouter);
  v1.use("/agent", agentRouter);
  v1.use("/network", networkRouter);
  v1.use("/router", routerStatusRouter);
  v1.use("/devices", devicesRouter);
  v1.use("/users", usersRouter);
  v1.use("/analytics", analyticsRouter);

  // Full paths (local + when Vercel preserves /api prefix)
  app.use("/api/v1", v1);
  // Fallback when the /api rewrite strips the prefix for the serverless entry
  app.use("/v1", v1);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      logger.error({ err }, "Unhandled error");
      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}
