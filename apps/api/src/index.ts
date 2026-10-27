import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env, supabaseConfigured } from "./config";
import { logger } from "./logger";
import { memoryStore } from "./db/memory-store";
import { agentRouter } from "./routes/agent";
import { networkRouter } from "./routes/network";
import { routerStatusRouter } from "./routes/router";
import { devicesRouter } from "./routes/devices";
import { usersRouter } from "./routes/users";
import { analyticsRouter } from "./routes/analytics";

const app = express();

app.use(helmet());
const allowedOrigins = env.CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (agent) with no Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*")) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow Vercel preview URLs when a production Vercel origin is configured
      const vercelProd = allowedOrigins.find((o) => o.endsWith(".vercel.app"));
      if (
        vercelProd &&
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/health" },
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "wifi-control-api",
    storage: supabaseConfigured ? "supabase" : "memory",
    network_id: memoryStore.network.id,
  });
});

const v1 = express.Router();
v1.use("/agent", agentRouter);
v1.use("/network", networkRouter);
v1.use("/router", routerStatusRouter);
v1.use("/devices", devicesRouter);
v1.use("/users", usersRouter);
v1.use("/analytics", analyticsRouter);
app.use("/api/v1", v1);

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

app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(
    {
      host: env.API_HOST,
      port: env.API_PORT,
      storage: supabaseConfigured ? "supabase" : "memory (dev)",
      networkId: memoryStore.network.id,
    },
    "WiFi Control API listening"
  );
});
