import { env } from "../config/env";
import { logger } from "../utils/logger";

export class MikroTikError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "MikroTikError";
  }
}

/**
 * Minimal RouterOS REST API client (RouterOS v7+).
 * Uses Basic auth against https://router/rest/...
 */
export class MikroTikClient {
  private baseUrl: string;
  private authHeader: string;

  constructor() {
    const host = env.MIKROTIK_HOST.replace(/^https?:\/\//, "");
    this.baseUrl = `https://${host}:${env.MIKROTIK_PORT}/rest`;
    this.authHeader =
      "Basic " +
      Buffer.from(`${env.MIKROTIK_USER}:${env.MIKROTIK_PASSWORD}`).toString(
        "base64"
      );
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    // RouterOS often uses self-signed certs on LAN. Only disable verification when explicitly configured.
    if (env.MIKROTIK_TLS_INSECURE) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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
      throw new MikroTikError(
        `RouterOS ${method} ${path} failed: ${res.status}`,
        res.status,
        data
      );
    }

    return data as T;
  }

  get<T = unknown>(path: string) {
    return this.request<T>("GET", path);
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }

  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }

  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }

  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }

  async ping(): Promise<boolean> {
    try {
      await this.get("/system/resource");
      return true;
    } catch (err) {
      logger.warn({ err }, "MikroTik ping failed");
      return false;
    }
  }
}
