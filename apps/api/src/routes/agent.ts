import { Router } from "express";
import {
  agentCommandResultSchema,
  agentHeartbeatSchema,
  agentRegisterSchema,
  agentSyncSchema,
} from "@wifi-control/validation";
import { env } from "../config";
import { memoryStore } from "../db/memory-store";
import { requireAgent, type AuthedRequest } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { logger } from "../logger";

export const agentRouter = Router();

agentRouter.post(
  "/register",
  validateBody(agentRegisterSchema),
  (req, res) => {
    const body = req.body as {
      name: string;
      network_id: string;
      shared_secret: string;
      hostname?: string;
      version?: string;
    };

    if (body.shared_secret !== env.AGENT_SHARED_SECRET) {
      return res.status(403).json({ error: "Invalid shared secret" });
    }

    if (
      body.network_id !== memoryStore.network.id &&
      env.NODE_ENV === "production"
    ) {
      // In production with Supabase, validate network exists — memory mode uses fixed id
    }

    // Re-register by name: revoke old token for same name
    for (const [id, agent] of memoryStore.agents) {
      if (agent.name === body.name && agent.network_id === body.network_id) {
        for (const [token, agentId] of memoryStore.agentTokens) {
          if (agentId === id) memoryStore.agentTokens.delete(token);
        }
        memoryStore.agents.delete(id);
      }
    }

    const result = memoryStore.registerAgent({
      name: body.name,
      network_id: body.network_id || memoryStore.network.id,
      hostname: body.hostname,
      version: body.version,
    });

    logger.info({ agentId: result.agent_id, name: body.name }, "Agent registered");
    res.status(201).json(result);
  }
);

agentRouter.post(
  "/heartbeat",
  requireAgent,
  validateBody(agentHeartbeatSchema),
  (req: AuthedRequest, res) => {
    const agent = memoryStore.heartbeat(req.agentId!, req.body);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json({
      ok: true,
      server_time: new Date().toISOString(),
      agent: {
        id: agent.id,
        status: agent.status,
        last_heartbeat_at: agent.last_heartbeat_at,
      },
    });
  }
);

agentRouter.get("/commands", requireAgent, (req: AuthedRequest, res) => {
  const commands = memoryStore.listPendingCommands(req.networkId!, 20);
  // Mark as running
  for (const cmd of commands) {
    cmd.status = "running";
    cmd.updated_at = new Date().toISOString();
  }
  res.json({ data: commands });
});

agentRouter.post(
  "/commands/:id/result",
  requireAgent,
  validateBody(agentCommandResultSchema),
  (req: AuthedRequest, res) => {
    const cmd = memoryStore.completeCommand(req.params.id, req.body);
    if (!cmd) return res.status(404).json({ error: "Command not found" });
    res.json({ ok: true, command: cmd });
  }
);

agentRouter.post(
  "/sync",
  requireAgent,
  validateBody(agentSyncSchema),
  (req: AuthedRequest, res) => {
    const body = req.body as {
      devices: Parameters<typeof memoryStore.syncDevices>[0];
      router?: Parameters<typeof memoryStore.syncDevices>[1];
      synced_at: string;
    };

    const result = memoryStore.syncDevices(body.devices, body.router as never);
    logger.debug(
      { agentId: req.agentId, ...result, synced_at: body.synced_at },
      "Device sync received"
    );
    res.json({ ok: true, ...result });
  }
);
