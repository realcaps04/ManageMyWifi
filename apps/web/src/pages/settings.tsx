import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiBaseUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatRelative } from "@/lib/utils";

export function SettingsPage() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["network-status"],
    queryFn: api.getNetworkStatus,
    refetchInterval: 10_000,
  });
  const portal = useQuery({
    queryKey: ["auth-portal"],
    queryFn: api.getPortal,
  });
  const routerConn = useQuery({
    queryKey: ["router-connection"],
    queryFn: api.getRouterConnection,
  });

  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [routerHost, setRouterHost] = useState("192.168.1.1");
  const [routerPort, setRouterPort] = useState("443");
  const [routerUser, setRouterUser] = useState("admin");
  const [routerPassword, setRouterPassword] = useState("");
  const [routerTlsInsecure, setRouterTlsInsecure] = useState(true);
  const [routerMessage, setRouterMessage] = useState<string | null>(null);

  useEffect(() => {
    if (portal.data?.ssid) setSsid(portal.data.ssid);
  }, [portal.data?.ssid]);

  useEffect(() => {
    if (!routerConn.data) return;
    setRouterHost(routerConn.data.host || "192.168.1.1");
    setRouterPort(String(routerConn.data.port || 443));
    setRouterUser(routerConn.data.user || "admin");
    setRouterTlsInsecure(routerConn.data.tls_insecure);
  }, [routerConn.data]);

  const savePortal = useMutation({
    mutationFn: () =>
      api.updatePortal({
        ssid: ssid.trim(),
        ...(password ? { password } : {}),
      }),
    onSuccess: () => {
      setPassword("");
      setMessage("Password saved for that network.");
      void qc.invalidateQueries({ queryKey: ["auth-portal"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const saveRouter = useMutation({
    mutationFn: () =>
      api.updateRouterConnection({
        host: routerHost.trim(),
        port: Number(routerPort) || 443,
        user: routerUser.trim(),
        ...(routerPassword ? { password: routerPassword } : {}),
        tls_insecure: routerTlsInsecure,
      }),
    onSuccess: (data) => {
      setRouterPassword("");
      setRouterMessage(
        data.message ||
          "Saved. The local agent will pick this up automatically."
      );
      void qc.invalidateQueries({ queryKey: ["router-connection"] });
      void qc.invalidateQueries({ queryKey: ["network-status"] });
    },
    onError: (err: Error) => setRouterMessage(err.message),
  });

  const s = status.data;
  const apiBase = getApiBaseUrl();
  const isRelative = apiBase.startsWith("/");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Connect your router</CardTitle>
          <p className="mt-0.5 text-sm text-muted">
            Enter your WiFi router’s LAN address and login here. You do not edit
            any .env files. Keep a small agent running on a PC on the same WiFi;
            it downloads these details securely and talks to the router locally.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">
                Router IP (gateway)
              </span>
              <Input
                value={routerHost}
                onChange={(e) => setRouterHost(e.target.value)}
                placeholder="192.168.1.1"
                autoComplete="off"
              />
              <span className="mt-1 block text-[11px] text-muted">
                Usually your Default Gateway from ipconfig / phone WiFi details.
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">
                Port
              </span>
              <Input
                value={routerPort}
                onChange={(e) => setRouterPort(e.target.value)}
                placeholder="443"
                inputMode="numeric"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">
                Router username
              </span>
              <Input
                value={routerUser}
                onChange={(e) => setRouterUser(e.target.value)}
                placeholder="admin"
                autoComplete="username"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">
                Router password
              </span>
              <PasswordInput
                value={routerPassword}
                onChange={(e) => setRouterPassword(e.target.value)}
                placeholder={
                  routerConn.data?.password_set
                    ? "Leave blank to keep current password"
                    : "Router admin password"
                }
                autoComplete="current-password"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={routerTlsInsecure}
              onChange={(e) => setRouterTlsInsecure(e.target.checked)}
            />
            Allow self-signed HTTPS certificate (common on home routers)
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={() => saveRouter.mutate()}
              disabled={
                saveRouter.isPending ||
                !routerHost.trim() ||
                !routerUser.trim() ||
                (!routerPassword.trim() && !routerConn.data?.password_set)
              }
            >
              {saveRouter.isPending ? "Saving…" : "Save router connection"}
            </Button>
            <Badge
              variant={routerConn.data?.configured ? "success" : "warning"}
            >
              {routerConn.data?.configured
                ? "Details saved for agent"
                : "Not configured yet"}
            </Badge>
          </div>
          {routerMessage && (
            <p className="text-xs text-muted">{routerMessage}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-network WiFi sign-in</CardTitle>
          <p className="mt-0.5 text-sm text-muted">
            Each network uses its own WiFi name and password. Keys synced from
            your router are used automatically. Add an override only if the agent
            cannot read that network’s security profile.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(portal.data?.networks?.length || 0) > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                Synced from router
              </div>
              {portal.data?.networks?.map((n) => (
                <div
                  key={`${n.interface_name}-${n.ssid || "none"}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-slate-800">
                      {n.ssid || n.interface_name}
                    </div>
                    <div className="text-xs text-muted">{n.interface_name}</div>
                  </div>
                  <Badge variant={n.has_passphrase ? "success" : "warning"}>
                    {n.has_passphrase ? "Key available" : "Key missing"}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">
              WiFi name (SSID)
            </span>
            <SearchableSelect
              value={ssid}
              onChange={setSsid}
              options={portal.data?.suggested_ssids || []}
              placeholder="Select or type a network SSID"
              emptyLabel="No networks yet — type the WiFi name"
              allowCreate
              createLabel={(q) => `Add network “${q}”`}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">
              WiFi password override
            </span>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current override"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => savePortal.mutate()}
              disabled={
                savePortal.isPending || !ssid.trim() || !password.trim()
              }
            >
              Save password for this network
            </Button>
            <Badge variant={portal.data?.password_set ? "success" : "warning"}>
              {portal.data?.password_set
                ? "At least one key ready"
                : "No keys yet"}
            </Badge>
          </div>
          {message && <p className="text-xs text-muted">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row
            label="Web host"
            value={typeof window !== "undefined" ? window.location.origin : "—"}
          />
          <Row
            label="API base URL"
            value={
              isRelative
                ? `${apiBase} (same site / Vite proxy)`
                : apiBase
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live connections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Network" value={s?.network.name || "—"} />
          <Row
            label="Agent"
            value={
              <Badge
                variant={
                  s?.agent.status === "online"
                    ? "success"
                    : s?.agent.status === "degraded"
                      ? "warning"
                      : "muted"
                }
              >
                {s?.agent.status || "offline"}
              </Badge>
            }
          />
          <Row
            label="Agent heartbeat"
            value={formatRelative(s?.agent.last_heartbeat_at)}
          />
          <Row
            label="Router"
            value={
              <Badge
                variant={
                  s?.router.status === "connected" ? "success" : "muted"
                }
              >
                {s?.router.status || "unknown"}
              </Badge>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2">
      <span className="text-muted">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-slate-800 break-all">
        {value}
      </span>
    </div>
  );
}
