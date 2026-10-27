import { Router } from "express";
import { z } from "zod";
import { env } from "../config";
import { memoryStore } from "../db/memory-store";
import { requireUser, type AuthedRequest } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { safeEqualString, signSession } from "../security/session";
import { logger } from "../logger";

export const authRouter = Router();

const loginSchema = z.object({
  ssid: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(128),
});

function normalizeSsid(ssid: string) {
  return ssid.trim();
}

function knownSsids(): string[] {
  const fromRouter = memoryStore.wifiNetworks
    .map((n) => n.ssid)
    .filter((s): s is string => Boolean(s && s.trim()));
  const configured: string[] = [];
  if (memoryStore.portal.ssid) configured.push(memoryStore.portal.ssid);
  if (env.WIFI_LOGIN_SSID) configured.push(env.WIFI_LOGIN_SSID);
  return [...new Set([...fromRouter, ...configured].map(normalizeSsid))];
}

function expectedPassword(): string {
  return memoryStore.portal.password || env.WIFI_LOGIN_PASSWORD || "";
}

function ssidAllowed(ssid: string): boolean {
  const configured =
    normalizeSsid(memoryStore.portal.ssid || env.WIFI_LOGIN_SSID || "") || null;
  if (configured) {
    return configured === ssid;
  }
  const known = knownSsids();
  if (known.length === 0) {
    // No agent sync and no configured SSID yet — accept any name if password matches
    return true;
  }
  return known.includes(ssid);
}

authRouter.get("/status", (_req, res) => {
  const passwordConfigured = Boolean(expectedPassword());
  const ssids = knownSsids();
  res.json({
    login_required: !env.DEV_AUTH_BYPASS,
    password_configured: passwordConfigured,
    known_ssid_count: ssids.length,
    network_name: memoryStore.network.name,
    suggested_ssids: ssids.slice(0, 20),
  });
});

authRouter.post("/login", validateBody(loginSchema), (req, res) => {
  const ssid = normalizeSsid(req.body.ssid);
  const password = String(req.body.password);
  const expected = expectedPassword();

  if (!expected) {
    return res.status(503).json({
      error:
        "WiFi portal password is not configured. Set WIFI_LOGIN_PASSWORD on the API, or configure it in Settings after enabling DEV_AUTH_BYPASS once.",
    });
  }

  if (!ssidAllowed(ssid) || !safeEqualString(password, expected)) {
    logger.warn({ ssid }, "WiFi login failed");
    return res.status(401).json({ error: "Invalid WiFi name or password" });
  }

  const token = signSession({
    sub: `wifi:${ssid}`,
    networkId: memoryStore.network.id,
    ssid,
  });

  logger.info({ ssid }, "WiFi portal login succeeded");
  res.json({
    token,
    ssid,
    network: {
      id: memoryStore.network.id,
      name: memoryStore.network.name,
    },
    expires_in_hours: 12,
  });
});

authRouter.get("/me", requireUser, (req: AuthedRequest, res) => {
  res.json({
    userId: req.userId,
    networkId: req.networkId,
    ssid: req.ssid ?? null,
  });
});

const portalSchema = z.object({
  ssid: z.string().trim().min(1).max(32).optional(),
  password: z.string().min(4).max(128).optional(),
});

authRouter.get("/portal", requireUser, (_req, res) => {
  res.json({
    ssid: memoryStore.portal.ssid || env.WIFI_LOGIN_SSID || null,
    password_set: Boolean(expectedPassword()),
    suggested_ssids: knownSsids(),
  });
});

authRouter.put(
  "/portal",
  requireUser,
  validateBody(portalSchema),
  (req, res) => {
    if (req.body.ssid !== undefined) {
      memoryStore.portal.ssid = normalizeSsid(req.body.ssid);
    }
    if (req.body.password !== undefined) {
      memoryStore.portal.password = String(req.body.password);
    }
    res.json({
      ssid: memoryStore.portal.ssid || env.WIFI_LOGIN_SSID || null,
      password_set: Boolean(expectedPassword()),
    });
  }
);
