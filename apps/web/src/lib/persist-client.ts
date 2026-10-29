import { api } from "@/lib/api";
import {
  COOKIE_KEYS,
  getCookie,
  getJsonCookie,
  setJsonCookie,
  type StoredPortal,
  type StoredRouterConnection,
} from "@/lib/cookies";

/** Save router form values into a cookie (survives browser refresh). */
export function saveRouterCookie(
  data: StoredRouterConnection,
  passwordForCookie?: string
) {
  const existing = getJsonCookie<StoredRouterConnection>(
    COOKIE_KEYS.routerConnection
  );
  setJsonCookie(COOKIE_KEYS.routerConnection, {
    ...data,
    password:
      passwordForCookie ||
      data.password ||
      existing?.password ||
      "",
  });
}

export function readRouterCookie(): StoredRouterConnection | null {
  return getJsonCookie<StoredRouterConnection>(COOKIE_KEYS.routerConnection);
}

export function savePortalCookie(ssid: string, password?: string) {
  const existing =
    getJsonCookie<StoredPortal>(COOKIE_KEYS.portal) || {
      ssid: null,
      credentials: {},
    };
  const credentials = { ...existing.credentials };
  if (password) {
    credentials[ssid.trim().toLowerCase()] = password;
  }
  setJsonCookie(COOKIE_KEYS.portal, {
    ssid: ssid.trim() || existing.ssid,
    credentials,
  });
}

export function readPortalCookie(): StoredPortal | null {
  return getJsonCookie<StoredPortal>(COOKIE_KEYS.portal);
}

export function readLastSsid(): string | null {
  return getCookie(COOKIE_KEYS.lastSsid);
}

/**
 * If the API lost in-memory config (restart) but the browser cookie still has
 * it, push the cookie back to the API so the agent can keep working.
 */
export async function restoreCookiesToApi() {
  const router = readRouterCookie();
  if (router?.host && router.user && router.password) {
    try {
      const remote = await api.getRouterConnection();
      if (!remote.configured) {
        await api.updateRouterConnection({
          host: router.host,
          port: router.port,
          user: router.user,
          password: router.password,
          tls_insecure: router.tls_insecure,
          use_https: router.use_https,
        });
      }
    } catch {
      /* not signed in yet — ignore */
    }
  }

  const portal = readPortalCookie();
  if (portal?.ssid && portal.credentials[portal.ssid.toLowerCase()]) {
    try {
      await api.updatePortal({
        ssid: portal.ssid,
        password: portal.credentials[portal.ssid.toLowerCase()],
      });
    } catch {
      /* ignore */
    }
  }
}
