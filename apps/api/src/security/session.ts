import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { env } from "../config";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function secret() {
  return (
    process.env.SESSION_SECRET ||
    env.AGENT_SHARED_SECRET ||
    "wifi-control-dev-session-secret"
  );
}

export interface SessionPayload {
  sub: string;
  networkId: string;
  ssid: string;
  exp: number;
}

export function signSession(payload: Omit<SessionPayload, "exp">): string {
  const body: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", secret()).update(data).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // still run a compare to reduce timing leaks on length
    const filler = randomBytes(ba.length || 1);
    timingSafeEqual(filler, filler);
    return false;
  }
  return timingSafeEqual(ba, bb);
}
