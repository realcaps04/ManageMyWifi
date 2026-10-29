import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, setAuthToken } from "@/lib/api";
import {
  COOKIE_KEYS,
  getJsonCookie,
  removeCookie,
  setCookie,
  setJsonCookie,
} from "@/lib/cookies";

interface Session {
  token: string;
  ssid: string;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  login: (
    ssid: string,
    password: string,
    opts?: { use_connection_check?: boolean; device_online?: boolean }
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const LEGACY_STORAGE_KEY = "wifi-control.session";

function readStored(): Session | null {
  const fromCookie = getJsonCookie<Session>(COOKIE_KEYS.session);
  if (fromCookie?.token && fromCookie?.ssid) return fromCookie;

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.ssid) return null;
    // Migrate legacy localStorage → cookie
    setJsonCookie(COOKIE_KEYS.session, parsed);
    setCookie(COOKIE_KEYS.lastSsid, parsed.ssid);
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(session: Session | null) {
  if (!session) {
    removeCookie(COOKIE_KEYS.session);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return;
  }
  setJsonCookie(COOKIE_KEYS.session, session);
  setCookie(COOKIE_KEYS.lastSsid, session.ssid);
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readStored());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthToken(session?.token ?? null);
    if (!session) {
      setLoading(false);
      return;
    }
    void api
      .authMe()
      .then(() => setLoading(false))
      .catch(() => {
        writeStored(null);
        setSession(null);
        setAuthToken(null);
        setLoading(false);
      });
  }, [session?.token]);

  const login = useCallback(
    async (
      ssid: string,
      password: string,
      opts?: { use_connection_check?: boolean; device_online?: boolean }
    ) => {
      const result = await api.wifiLogin(ssid, password, opts);
      const next = { token: result.token, ssid: result.ssid };
      writeStored(next);
      setAuthToken(next.token);
      setSession(next);
    },
    []
  );

  const logout = useCallback(() => {
    writeStored(null);
    setAuthToken(null);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, login, logout }),
    [session, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
