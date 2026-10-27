import type {
  AgentHeartbeatRequest,
  AgentRegisterResponse,
  AgentSyncRequest,
  CommandQueueItem,
} from "@wifi-control/shared-types";
import { AGENT_VERSION, env } from "../config/env";
import { logger } from "../utils/logger";
import { hostname } from "os";

export class BackendClient {
  constructor(
    private baseUrl: string,
    private token: string | null = null
  ) {}

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auth = true
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (auth && this.token) {
      headers["X-Agent-Token"] = this.token;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      logger.error({ status: res.status, data, path }, "Backend request failed");
      throw new Error(`Backend ${method} ${path} failed: ${res.status}`);
    }

    return data as T;
  }

  register() {
    return this.request<AgentRegisterResponse>(
      "POST",
      "/agent/register",
      {
        name: env.AGENT_NAME,
        network_id: env.NETWORK_ID,
        shared_secret: env.AGENT_SHARED_SECRET,
        hostname: hostname(),
        version: AGENT_VERSION,
      },
      false
    );
  }

  heartbeat(payload: AgentHeartbeatRequest) {
    return this.request("POST", "/agent/heartbeat", payload);
  }

  sync(payload: AgentSyncRequest) {
    return this.request("POST", "/agent/sync", payload);
  }

  getCommands() {
    return this.request<{ data: CommandQueueItem[] }>("GET", "/agent/commands");
  }

  reportCommandResult(
    id: string,
    result: {
      status: "succeeded" | "failed";
      result?: Record<string, unknown>;
      error_message?: string;
      verified?: boolean;
    }
  ) {
    return this.request("POST", `/agent/commands/${id}/result`, result);
  }
}
