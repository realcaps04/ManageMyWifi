import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiBaseUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (portal.data?.ssid) setSsid(portal.data.ssid);
  }, [portal.data?.ssid]);

  const savePortal = useMutation({
    mutationFn: () =>
      api.updatePortal({
        ...(ssid.trim() ? { ssid: ssid.trim() } : {}),
        ...(password ? { password } : {}),
      }),
    onSuccess: () => {
      setPassword("");
      setMessage("Portal sign-in settings saved.");
      void qc.invalidateQueries({ queryKey: ["auth-portal"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const s = status.data;
  const apiBase = getApiBaseUrl();
  const isRelative = apiBase.startsWith("/");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>WiFi sign-in verification</CardTitle>
          <p className="mt-0.5 text-sm text-muted">
            Users must enter this WiFi name and password before accessing the
            dashboard. Prefer matching your real SSID so verification stays clear.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">
              WiFi name (SSID)
            </span>
            <Input
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="Your network SSID"
              list="portal-ssid-suggestions"
            />
            <datalist id="portal-ssid-suggestions">
              {(portal.data?.suggested_ssids || []).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">
              Verification password
            </span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                portal.data?.password_set
                  ? "Leave blank to keep current password"
                  : "Set a portal password"
              }
            />
          </label>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => savePortal.mutate()}
              disabled={savePortal.isPending || (!ssid.trim() && !password)}
            >
              Save sign-in settings
            </Button>
            <Badge variant={portal.data?.password_set ? "success" : "warning"}>
              {portal.data?.password_set ? "Password set" : "Password missing"}
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
                ? `${apiBase} (Vite proxy — set VITE_API_URL for Vercel)`
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2">
      <span className="text-muted">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-slate-800 break-all">
        {value}
      </span>
    </div>
  );
}
