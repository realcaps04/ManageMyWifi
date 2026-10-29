import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, setAuthToken } from "@/lib/api";

const STORAGE_KEY = "wifi-control.session";

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

function readStored(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.ssid) return null;
    return parsed;
  } catch {
    return null;
  }
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
        localStorage.removeItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setAuthToken(next.token);
      setSession(next);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
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
