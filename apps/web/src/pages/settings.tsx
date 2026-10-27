import { useQuery } from "@tanstack/react-query";
import { api, getApiBaseUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";

export function SettingsPage() {
  const status = useQuery({
    queryKey: ["network-status"],
    queryFn: api.getNetworkStatus,
    refetchInterval: 10_000,
  });

  const s = status.data;
  const apiBase = getApiBaseUrl();
  const isRelative = apiBase.startsWith("/");

  return (
    <div className="space-y-4">
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
          <p className="text-xs text-muted">
            On Vercel, set <code className="rounded bg-slate-100 px-1">VITE_API_URL</code>{" "}
            to your public API (e.g. Railway/Render/VPS) ending in{" "}
            <code className="rounded bg-slate-100 px-1">/api/v1</code>. The local
            agent must use the same API URL via{" "}
            <code className="rounded bg-slate-100 px-1">BACKEND_URL</code>.
          </p>
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
          <Row
            label="Router model"
            value={
              s?.router.model
                ? `${s.router.model}${s.router.routeros_version ? ` · ${s.router.routeros_version}` : ""}`
                : "—"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Management from the web</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted space-y-2">
          <p>
            Suspend / block / disconnect / bandwidth actions are sent to the API
            command queue. The LAN agent applies them on MikroTik and reports
            verified results.
          </p>
          <p>
            If the agent is offline or cannot reach the router, actions stay
            queued or fail — the dashboard will not fake success.
          </p>
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
