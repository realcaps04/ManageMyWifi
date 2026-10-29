const MAX_AGE_DAYS = 30;

function encode(value: string) {
  return encodeURIComponent(value);
}

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function setCookie(name: string, value: string, days = MAX_AGE_DAYS) {
  const maxAge = days * 24 * 60 * 60;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${encode(name)}=${encode(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${encode(name)}=`;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    if (part.startsWith(target)) {
      return decode(part.slice(target.length));
    }
  }
  // Also try unencoded name (older writes)
  const rawTarget = `${name}=`;
  for (const part of parts) {
    if (part.startsWith(rawTarget)) {
      return decode(part.slice(rawTarget.length));
    }
  }
  return null;
}

export function removeCookie(name: string) {
  document.cookie = `${encode(name)}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setJsonCookie<T>(name: string, value: T, days = MAX_AGE_DAYS) {
  setCookie(name, JSON.stringify(value), days);
}

export function getJsonCookie<T>(name: string): T | null {
  const raw = getCookie(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const COOKIE_KEYS = {
  session: "mmw.session",
  routerConnection: "mmw.router",
  portal: "mmw.portal",
  lastSsid: "mmw.last_ssid",
} as const;

export type StoredRouterConnection = {
  host: string;
  port: number;
  user: string;
  password: string;
  tls_insecure: boolean;
  use_https: boolean;
};

export type StoredPortal = {
  ssid: string | null;
  credentials: Record<string, string>;
};
