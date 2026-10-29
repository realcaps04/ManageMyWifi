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
  ssid: z.string().trim().min(1).max(32).optional(),
  password: z.string().min(1).max(128),
  /** When true, SSID may be omitted if the managed WiFi/agent connection is live */
  use_connection_check: z.boolean().optional(),
  device_online: z.boolean().optional(),
});

function normalizeSsid(ssid: string) {
  return ssid.trim();
}

/** SSIDs reported by a live router sync only — never env/portal fallbacks. */
function liveSyncedSsids(): string[] {
  return [
    ...new Set(
      memoryStore.wifiNetworks
        .map((n) => n.ssid)
        .filter((s): s is string => Boolean(s && s.trim()))
        .map(normalizeSsid)
    ),
  ];
}

function knownSsids(): string[] {
  const fromRouter = liveSyncedSsids();
  const overrideSsids = Object.keys(memoryStore.portal.credentials).map((key) => {
    const live = fromRouter.find((r) => r.toLowerCase() === key);
    if (live) return live;
    if (
      memoryStore.portal.ssid &&
      memoryStore.portal.ssid.toLowerCase() === key
    ) {
      return normalizeSsid(memoryStore.portal.ssid);
    }
    return key;
  });
  const portalSsid = memoryStore.portal.ssid
    ? [normalizeSsid(memoryStore.portal.ssid)]
    : [];
  return [...new Set([...fromRouter, ...portalSsid, ...overrideSsids])];
}

/**
 * Resolve the expected Wi‑Fi password for a given SSID.
 * Priority: live router passphrase → per-SSID override → legacy portal/env.
 */
function resolveCredential(ssid: string): {
  password: string | null;
  source: "router" | "override" | "none";
  ssidKnown: boolean;
} {
  const key = normalizeSsid(ssid).toLowerCase();
  const matches = memoryStore.wifiNetworks.filter(
    (n) => n.ssid && n.ssid.toLowerCase() === key
  );
  const ssidKnown =
    matches.length > 0 ||
    Boolean(memoryStore.portal.credentials[key]) ||
    (memoryStore.portal.ssid
      ? memoryStore.portal.ssid.toLowerCase() === key
      : false) ||
    (env.WIFI_LOGIN_SSID
      ? env.WIFI_LOGIN_SSID.toLowerCase() === key
      : false);

  for (const n of matches) {
    if (n.passphrase) {
      return { password: n.passphrase, source: "router", ssidKnown: true };
    }
  }

  if (memoryStore.portal.credentials[key]) {
    return {
      password: memoryStore.portal.credentials[key],
      source: "override",
      ssidKnown: true,
    };
  }

  if (
    memoryStore.portal.password &&
    memoryStore.portal.ssid &&
    memoryStore.portal.ssid.toLowerCase() === key
  ) {
    return {
      password: memoryStore.portal.password,
      source: "override",
      ssidKnown: true,
    };
  }

  if (
    env.WIFI_LOGIN_PASSWORD &&
    env.WIFI_LOGIN_SSID &&
    env.WIFI_LOGIN_SSID.toLowerCase() === key
  ) {
    return {
      password: env.WIFI_LOGIN_PASSWORD,
      source: "override",
      ssidKnown: true,
    };
  }

  return { password: null, source: "none", ssidKnown };
}

function anyPasswordAvailable(): boolean {
  if (memoryStore.wifiNetworks.some((n) => Boolean(n.passphrase))) return true;
  if (Object.keys(memoryStore.portal.credentials).length > 0) return true;
  if (memoryStore.portal.password) return true;
  if (env.WIFI_LOGIN_PASSWORD && env.WIFI_LOGIN_SSID) return true;
  return false;
}

function ssidHasPassword(ssid: string): boolean {
  return Boolean(resolveCredential(ssid).password);
}

function publicWifiNetworks() {
  return memoryStore.wifiNetworks.map((n) => ({
    ssid: n.ssid,
    interface_name: n.interface_name,
    running: n.running,
    clients: n.clients,
    has_passphrase: Boolean(n.passphrase) ||
      (n.ssid
        ? Boolean(memoryStore.portal.credentials[n.ssid.toLowerCase()])
        : false),
  }));
}

function connectionSnapshot() {
  const status = memoryStore.getNetworkStatus();
  const agentOnline = status.agent.status === "online";
  const routerConnected = status.router.status === "connected";
  const networkLive = agentOnline && routerConnected;
  const liveSsids = networkLive ? liveSyncedSsids() : [];
  const detectedSsid = liveSsids[0] ?? null;

  return {
    agent_status: status.agent.status,
    agent_last_heartbeat_at: status.agent.last_heartbeat_at,
    router_status: status.router.status,
    detected_ssids: liveSsids.slice(0, 20),
    detected_ssid: detectedSsid,
    network_live: networkLive,
    can_quick_login: Boolean(
      networkLive && detectedSsid && ssidHasPassword(detectedSsid)
    ),
    connected_devices: networkLive ? status.counts.connected_devices : 0,
    wifi_networks: networkLive ? publicWifiNetworks() : [],
  };
}

authRouter.get("/status", (_req, res) => {
  const ssids = knownSsids();
  const live = liveSyncedSsids();
  const passwordConfigured = anyPasswordAvailable();
  res.json({
    login_required: !env.DEV_AUTH_BYPASS,
    password_configured: passwordConfigured,
    known_ssid_count: ssids.length,
    network_name: memoryStore.network.name,
    suggested_ssids: (live.length > 0 ? live : ssids).slice(0, 20),
    configured_ssid: null,
    auth_mode: "per_network",
    setup_hint: live.length
      ? "Sign in with this network’s real WiFi name and WiFi password (they differ per network)."
      : passwordConfigured
        ? "Enter the WiFi name and password for the network you manage. Start the agent to load live SSIDs from the router."
        : "Start the local agent (with your router password set) so SSIDs and keys sync, or set a per-network password in Settings.",
  });
});

/** Public WiFi/device connection probe for the login screen */
authRouter.get("/connection-check", (_req, res) => {
  const snap = connectionSnapshot();
  let hint: string;
  if (snap.agent_status === "offline") {
    hint =
      "Local agent is offline (no recent heartbeat). Start npm run dev:agent on a PC on your LAN.";
  } else if (snap.router_status !== "connected") {
    const cfg = memoryStore.getRouterConnectionPublic();
    hint = cfg.configured
      ? "Agent is reachable, but the router is not connected yet. Confirm the gateway IP and password in Settings → Connect your router, and keep the agent running on your WiFi LAN."
      : "Agent is reachable, but no router details are saved yet. Sign in, then open Settings → Connect your router and enter your gateway IP, username, and password.";
  } else if (!snap.detected_ssid) {
    hint =
      "Router is connected, but no SSID has been synced yet. Wait for the next agent sync, or sign in with the WiFi name manually.";
  } else if (!ssidHasPassword(snap.detected_ssid)) {
    hint = `Detected WiFi “${snap.detected_ssid}”, but its Wi‑Fi key is not available yet. Set that network’s password in Settings, or check router security profile permissions.`;
  } else {
    hint = `Live link confirmed. Detected WiFi: ${snap.detected_ssid}. Use that network’s WiFi password to sign in.`;
  }

  res.json({
    ...snap,
    network_name: memoryStore.network.name,
    password_configured: anyPasswordAvailable(),
    checked_at: new Date().toISOString(),
    hint,
  });
});

authRouter.post("/login", validateBody(loginSchema), (req, res) => {
  const password = String(req.body.password);
  const useConnection = Boolean(req.body.use_connection_check);
  const deviceOnline = req.body.device_online !== false;

  const snap = connectionSnapshot();
  let ssid = req.body.ssid ? normalizeSsid(req.body.ssid) : "";

  if (useConnection) {
    if (!deviceOnline) {
      return res.status(401).json({
        error: "This device appears offline. Connect to WiFi and try again.",
      });
    }
    if (!snap.network_live || !snap.detected_ssid) {
      return res.status(401).json({
        error:
          "Could not verify WiFi connection. Start the local agent or enter the WiFi name manually.",
      });
    }
    ssid = snap.detected_ssid;
  }

  if (!ssid) {
    return res.status(400).json({ error: "WiFi name is required" });
  }

  const cred = resolveCredential(ssid);
  const live = liveSyncedSsids();

  if (!cred.password) {
    // Bootstrap: nothing configured yet → first sign-in registers that network’s credentials
    if (!anyPasswordAvailable()) {
      if (live.length > 0 && !live.some((s) => s.toLowerCase() === ssid.toLowerCase())) {
        return res.status(401).json({
          error: `Unknown WiFi name “${ssid}”. Choose a SSID synced from your router.`,
        });
      }
      memoryStore.portal.ssid = ssid;
      memoryStore.portal.password = password;
      memoryStore.portal.credentials[ssid.toLowerCase()] = password;
      logger.info({ ssid }, "Bootstrapped network WiFi credentials");
    } else if (!cred.ssidKnown && live.length > 0) {
      logger.warn({ ssid }, "WiFi login failed: unknown SSID");
      return res.status(401).json({
        error: `Unknown WiFi name “${ssid}”. Use one of the networks on this router, or wait for the agent to sync.`,
      });
    } else {
      return res.status(503).json({
        error: `WiFi key for “${ssid}” is not available yet. Start the agent so keys sync from your router, or set this network’s password in Settings.`,
      });
    }
  } else if (!safeEqualString(password, cred.password)) {
    logger.warn(
      { ssid, useConnection, source: cred.source },
      "WiFi login failed: bad password"
    );
    return res.status(401).json({
      error: `Incorrect WiFi password for “${ssid}”.`,
    });
  }

  // Remember successful SSID casing for suggestions
  memoryStore.portal.ssid = ssid;

  const token = signSession({
    sub: useConnection ? `wifi-check:${ssid}` : `wifi:${ssid}`,
    networkId: memoryStore.network.id,
    ssid,
  });

  logger.info(
    { ssid, useConnection, source: cred.source },
    "WiFi portal login succeeded"
  );
  res.json({
    token,
    ssid,
    login_mode: useConnection ? "connection_check" : "manual",
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
  ssid: z.string().trim().min(1).max(32),
  password: z.string().min(4).max(128).optional(),
});

authRouter.get("/portal", requireUser, (_req, res) => {
  const networks = publicWifiNetworks();
  const overrides = Object.keys(memoryStore.portal.credentials);
  res.json({
    ssid: memoryStore.portal.ssid || null,
    password_set: anyPasswordAvailable(),
    suggested_ssids: knownSsids(),
    auth_mode: "per_network",
    networks,
    overrides: overrides.map((ssidKey) => {
      const live = memoryStore.wifiNetworks.find(
        (n) => n.ssid && n.ssid.toLowerCase() === ssidKey
      );
      return {
        ssid: live?.ssid || ssidKey,
        password_set: true,
        source: live?.passphrase ? "router+override" : "override",
      };
    }),
  });
});

authRouter.put(
  "/portal",
  requireUser,
  validateBody(portalSchema),
  (req, res) => {
    const ssid = normalizeSsid(req.body.ssid);
    memoryStore.portal.ssid = ssid;
    if (req.body.password !== undefined) {
      const password = String(req.body.password);
      memoryStore.portal.password = password;
      memoryStore.portal.credentials[ssid.toLowerCase()] = password;
    }
    res.json({
      ssid,
      password_set: anyPasswordAvailable(),
      auth_mode: "per_network",
    });
  }
);
