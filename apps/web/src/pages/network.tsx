import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { WifiNetworksPanel } from "@/components/wifi-networks-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative, formatUptime } from "@/lib/utils";

export function NetworkPage() {
  const statusQuery = useQuery({
    queryKey: ["network-status"],
    queryFn: api.getNetworkStatus,
    refetchInterval: 10_000,
  });
  const routerQuery = useQuery({
    queryKey: ["router-status"],
    queryFn: api.getRouterStatus,
    refetchInterval: 10_000,
  });
  const wifiQuery = useQuery({
    queryKey: ["wifi-networks"],
    queryFn: api.getWifiNetworks,
    refetchInterval: 12_000,
  });

  const s = statusQuery.data;
  const r = routerQuery.data;
  const networks =
    wifiQuery.data?.data?.length
      ? wifiQuery.data.data
      : s?.wifi_networks ?? r?.wifi_networks ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Router</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Name" value={r?.name || "—"} />
            <Row label="Host" value={r?.host || "—"} />
            <Row
              label="Status"
              value={
                <Badge
                  variant={r?.status === "connected" ? "success" : "muted"}
                >
                  {r?.status || "unknown"}
                </Badge>
              }
            />
            <Row label="Model" value={r?.model || "—"} />
            <Row label="RouterOS" value={r?.routeros_version || "—"} />
            <Row label="Wireless stack" value={r?.wireless_stack || "—"} />
            <Row
              label="CPU"
              value={r?.cpu_load != null ? `${r.cpu_load}%` : "—"}
            />
            <Row
              label="Memory"
              value={
                r?.memory_used_percent != null
                  ? `${r.memory_used_percent}%`
                  : "—"
              }
            />
            <Row label="Uptime" value={formatUptime(r?.uptime_seconds)} />
            <Row label="Last seen" value={formatRelative(r?.last_seen_at)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Name" value={s?.agent.name || "—"} />
            <Row
              label="Status"
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
              label="Last heartbeat"
              value={formatRelative(s?.agent.last_heartbeat_at)}
            />
            <Row
              label="Connected devices"
              value={String(s?.counts.connected_devices ?? 0)}
            />
            <Row
              label="WiFi networks"
              value={String(networks.length)}
            />
            <p className="pt-2 text-xs text-muted">
              WiFi details (SSID, band, clients) are collected by the LAN agent
              and shown below. Management actions are available on Connected
              Devices.
            </p>
          </CardContent>
        </Card>
      </div>

      <WifiNetworksPanel
        networks={networks}
        loading={wifiQuery.isLoading && !networks.length}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
