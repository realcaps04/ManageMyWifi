import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  CheckCircle2,
  Loader2,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { StatusDot } from "@/components/ui/status-dot";
import { StatusPopup } from "@/components/ui/status-popup";
import { readLastSsid, savePortalCookie } from "@/lib/persist-client";

type ConnectionResult = Awaited<ReturnType<typeof api.checkWifiConnection>>;

export function LoginPage() {
  const { session, loading, login } = useAuth();
  const [ssid, setSsid] = useState(() => readLastSsid() || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [networkName, setNetworkName] = useState("ManageMyWifi");
  const [passwordConfigured, setPasswordConfigured] = useState(true);
  const [deviceOnline, setDeviceOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [useConnectionLogin, setUseConnectionLogin] = useState(false);
  const [statusPopupOpen, setStatusPopupOpen] = useState(false);

  useEffect(() => {
    const on = () => setDeviceOnline(true);
    const off = () => setDeviceOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    void api
      .getAuthStatus()
      .then((s) => {
        setSuggested(s.suggested_ssids || []);
        setNetworkName(s.network_name || "ManageMyWifi");
        setPasswordConfigured(s.password_configured);
        if (s.suggested_ssids?.length === 1) {
          setSsid(s.suggested_ssids[0]);
        }
      })
      .catch(() => {
        /* API may be down — still show login form */
      });
  }, []);

  async function runConnectionCheck() {
    setChecking(true);
    setError(null);
    setUseConnectionLogin(false);
    try {
      const result = await api.checkWifiConnection();
      setConnection(result);
      setPasswordConfigured(result.password_configured);
      setNetworkName(result.network_name || "ManageMyWifi");
      if (result.network_live && result.detected_ssids.length > 0) {
        setSuggested(result.detected_ssids);
      }
      if (result.network_live && result.detected_ssid) {
        setSsid(result.detected_ssid);
      }
      if (result.can_quick_login && deviceOnline) {
        setUseConnectionLogin(true);
      }
      setStatusPopupOpen(true);
    } catch (err) {
      setConnection(null);
      setUseConnectionLogin(false);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not check WiFi connection. Is the API running?"
      );
      setStatusPopupOpen(true);
    } finally {
      setChecking(false);
    }
  }

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (useConnectionLogin) {
        await login(ssid.trim(), password, {
          use_connection_check: true,
          device_online: deviceOnline,
        });
      } else {
        await login(ssid.trim(), password);
      }
      savePortalCookie(ssid.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Sign-in failed. Check WiFi name and password."
      );
    } finally {
      setBusy(false);
    }
  }

  const connectionReady =
    useConnectionLogin &&
    deviceOnline &&
    Boolean(connection?.can_quick_login && connection.detected_ssid);

  const popupTone =
    error || (connection && !connection.network_live)
      ? connection?.agent_status === "degraded" ||
        connection?.router_status === "disconnected"
        ? "warning"
        : "error"
      : connection?.network_live
        ? "success"
        : "neutral";

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Radio className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {networkName}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Manage any WiFi network from the web. Sign in with your network’s
            WiFi name and password, or run a connection check to detect the name.
          </p>
        </div>

        <Card className="mb-4">
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  WiFi connection check
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  Verifies this device is online and the managed network agent
                  is live, then detects the WiFi name.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void runConnectionCheck()}
                disabled={checking}
              >
                {checking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {checking ? "Checking…" : "Check"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-muted">This device</div>
                <div className="mt-1 flex items-center gap-1.5 font-medium text-slate-800">
                  {deviceOnline ? (
                    <>
                      <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                      Online
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5 text-red-500" />
                      Offline
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-muted">Managed WiFi</div>
                <div className="mt-1 flex items-center gap-1.5 font-medium text-slate-800">
                  <StatusDot
                    status={
                      connection?.network_live
                        ? "online"
                        : connection
                          ? "offline"
                          : "unknown"
                    }
                  />
                  {connection
                    ? connection.network_live
                      ? "Linked"
                      : "Not linked"
                    : "Not checked"}
                </div>
              </div>
            </div>

            {connection?.can_quick_login && deviceOnline && (
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-800">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={useConnectionLogin}
                  onChange={(e) => setUseConnectionLogin(e.target.checked)}
                />
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Sign in using detected WiFi connection
              </label>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={onSubmit}>
              {!useConnectionLogin && (
                <label className="block text-sm">
                  <span className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-700">
                    <Wifi className="h-3.5 w-3.5" />
                    WiFi name (SSID)
                  </span>
                  <SearchableSelect
                    value={ssid}
                    onChange={setSsid}
                    options={suggested}
                    placeholder="Search or type this network’s WiFi name"
                    emptyLabel="No synced networks yet — type the WiFi name"
                    allowCreate
                    createLabel={(q) => `Use new network “${q}”`}
                    required={!useConnectionLogin}
                    name="ssid"
                  />
                </label>
              )}

              {useConnectionLogin && connection?.detected_ssid && (
                <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800">
                  Signing in to{" "}
                  <span className="font-semibold">{connection.detected_ssid}</span>{" "}
                  via connection check. Only the password is required.
                </div>
              )}

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">
                  WiFi password
                </span>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder="This network’s WiFi password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              {!passwordConfigured && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  No WiFi keys loaded yet. Start the agent with your router
                  password so network SSIDs and keys sync, or set a per-network
                  password in Settings after first access.
                </p>
              )}

              {error && !statusPopupOpen && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  busy ||
                  !password ||
                  (useConnectionLogin ? !connectionReady : !ssid.trim())
                }
              >
                {busy
                  ? "Verifying…"
                  : useConnectionLogin
                    ? "Sign in with WiFi connection"
                    : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted">
          After sign-in, open Settings → Connect your router to enter your
          gateway IP and password in the website (no .env editing). A small
          agent on your WiFi LAN uses those details automatically.
        </p>
      </div>

      <StatusPopup
        open={statusPopupOpen}
        title={
          error
            ? "Connection check failed"
            : connection?.network_live
              ? "WiFi linked"
              : "Connection status"
        }
        tone={popupTone}
        onClose={() => setStatusPopupOpen(false)}
      >
        {error ? (
          <p className="text-sm text-red-800">{error}</p>
        ) : connection ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  connection.agent_status === "online"
                    ? "success"
                    : connection.agent_status === "degraded"
                      ? "warning"
                      : "muted"
                }
              >
                Agent {connection.agent_status}
              </Badge>
              <Badge
                variant={
                  connection.router_status === "connected" ? "success" : "muted"
                }
              >
                Router {connection.router_status}
              </Badge>
              {connection.network_live && connection.detected_ssid ? (
                <Badge variant="info">{connection.detected_ssid}</Badge>
              ) : (
                <Badge variant="muted">No live SSID</Badge>
              )}
            </div>
            <p className="text-sm text-slate-700">{connection.hint}</p>
          </>
        ) : null}
      </StatusPopup>
    </div>
  );
}
