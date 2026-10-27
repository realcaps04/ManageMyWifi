import type { Request, Response, NextFunction } from "express";
import { env, supabaseConfigured } from "../config";
import { getSupabase } from "../db/supabase";
import { memoryStore } from "../db/memory-store";
import { verifySession } from "../security/session";

export interface AuthedRequest extends Request {
  userId?: string;
  agentId?: string;
  networkId?: string;
  ssid?: string;
}

/** Admin/API user auth via WiFi portal session, Supabase JWT, or DEV_AUTH_BYPASS. */
export async function requireUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);

    const session = verifySession(token);
    if (session) {
      req.userId = session.sub;
      req.networkId = session.networkId;
      req.ssid = session.ssid;
      return next();
    }

    if (supabaseConfigured) {
      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data.user) {
          req.userId = data.user.id;
          const networkHeader = req.headers["x-network-id"];
          if (typeof networkHeader === "string") {
            req.networkId = networkHeader;
          } else {
            req.networkId = memoryStore.network.id;
          }
          return next();
        }
      }
    }
  }

  if (env.DEV_AUTH_BYPASS) {
    req.userId = "dev-user";
    req.networkId = memoryStore.network.id;
    return next();
  }

  return res.status(401).json({ error: "Sign in required" });
}

/** Agent auth via X-Agent-Token header. */
export function requireAgent(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.headers["x-agent-token"];
  if (typeof token !== "string" || !token) {
    return res.status(401).json({ error: "Missing X-Agent-Token" });
  }

  const agent = memoryStore.authenticateAgent(token);
  if (!agent) {
    return res.status(401).json({ error: "Invalid agent token" });
  }

  req.agentId = agent.id;
  req.networkId = agent.network_id;
  next();
}
