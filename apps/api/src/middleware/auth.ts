import type { Request, Response, NextFunction } from "express";
import { env, supabaseConfigured } from "../config";
import { getSupabase } from "../db/supabase";
import { memoryStore } from "../db/memory-store";

export interface AuthedRequest extends Request {
  userId?: string;
  agentId?: string;
  networkId?: string;
}

/** Admin/API user auth via Supabase JWT, or DEV_AUTH_BYPASS in development. */
export async function requireUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (env.DEV_AUTH_BYPASS || (!supabaseConfigured && env.NODE_ENV !== "production")) {
    req.userId = "dev-user";
    req.networkId = memoryStore.network.id;
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = header.slice(7);
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Auth provider not configured" });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.userId = data.user.id;
  // Network scoping: prefer header, fall back to first membership (API layer)
  const networkHeader = req.headers["x-network-id"];
  if (typeof networkHeader === "string") {
    req.networkId = networkHeader;
  }
  next();
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
