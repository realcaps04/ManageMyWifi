import { env } from "../config/env";
import { logger } from "../utils/logger";

export type RouterConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  tls_insecure: boolean;
  /** When false, talk to the router over plain HTTP (common on home gateways). */
  use_https: boolean;
};

export class RouterError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "RouterError";
  }
}

function isTlsProtocolError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const cause =
    err instanceof Error && "cause" in err
      ? String((err as { cause?: unknown }).cause)
      : "";
  const text = `${msg} ${cause}`.toLowerCase();
  return (
    text.includes("unsupported protocol") ||
    text.includes("ssl routines") ||
    text.includes("eproto") ||
    text.includes("wrong version number")
  );
}

/**
 * Minimal router REST API client (LAN only).
 * Credentials come from the website Settings (via API) or local .env fallback.
 */
export class RouterClient {
  private config: RouterConnectionConfig;
  private baseUrl = "";
  private authHeader = "";

  constructor(config?: Partial<RouterConnectionConfig>) {
    this.config = {
      host: (config?.host || env.ROUTER_HOST).replace(/^https?:\/\//, ""),
      port: config?.port ?? env.ROUTER_PORT,
      user: config?.user || env.ROUTER_USER,
      password: config?.password ?? env.ROUTER_PASSWORD,
      tls_insecure: config?.tls_insecure ?? env.ROUTER_TLS_INSECURE,
      use_https: config?.use_https ?? true,
    };
    this.rebuild();
  }

  get snapshot(): RouterConnectionConfig {
    return { ...this.config };
  }

  fingerprint() {
    const c = this.config;
    return `${c.use_https ? "https" : "http"}|${c.host}|${c.port}|${c.user}|${c.password}|${c.tls_insecure}`;
  }

  hasCredentials() {
    return Boolean(this.config.host && this.config.user && this.config.password);
  }

  applyConfig(next: Partial<RouterConnectionConfig>) {
    const merged: RouterConnectionConfig = {
      host: (next.host || this.config.host).replace(/^https?:\/\//, ""),
      port: next.port ?? this.config.port,
      user: next.user || this.config.user,
      password:
        next.password !== undefined ? next.password : this.config.password,
      tls_insecure: next.tls_insecure ?? this.config.tls_insecure,
      use_https: next.use_https ?? this.config.use_https,
    };
    const before = this.fingerprint();
    this.config = merged;
    this.rebuild();
    return before !== this.fingerprint();
  }

  private rebuild() {
    const scheme = this.config.use_https ? "https" : "http";
    this.baseUrl = `${scheme}://${this.config.host}:${this.config.port}/rest`;
    this.authHeader =
      "Basic " +
      Buffer.from(`${this.config.user}:${this.config.password}`).toString(
        "base64"
      );
  }

  private switchToHttp() {
    if (!this.config.use_https) return;
    this.config.use_https = false;
    if (this.config.port === 443) this.config.port = 80;
    this.rebuild();
    logger.info(
      { host: this.config.host, port: this.config.port },
      "Router HTTPS unsupported — falling back to HTTP"
    );
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    if (!this.hasCredentials()) {
      throw new RouterError(
        "Router credentials not configured yet (set them in the website Settings)"
      );
    }

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    if (this.config.use_https && this.config.tls_insecure) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (this.config.use_https && isTlsProtocolError(err)) {
        this.switchToHttp();
        return this.request<T>(method, path, body);
      }
      throw err;
    }

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
      throw new RouterError(
        `Router ${method} ${path} failed: ${res.status}`,
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
      logger.warn({ err }, "Router ping failed");
      return false;
    }
  }
}
