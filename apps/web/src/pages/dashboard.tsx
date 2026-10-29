import { useQuery } from "@tanstack/react-query";
import {
  Wifi,
  Router,
  Bot,
  Ban,
  PauseCircle,
  Cpu,
  MemoryStick,
  Clock,
  Download,
  Upload,
  HardDrive,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, getApiBaseUrl } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { WifiNetworksPanel } from "@/components/wifi-networks-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { formatBytes, formatRelative, formatUptime } from "@/lib/utils";

export function DashboardPage() {
  const statusQuery = useQuery({
    queryKey: ["network-status"],
    queryFn: api.getNetworkStatus,
    refetchInterval: 10_000,
  });

  const devicesQuery = useQuery({
    queryKey: ["devices", { status: "online", pageSize: 10 }],
    queryFn: () => api.getDevices({ status: "online", pageSize: 10 }),
    refetchInterval: 12_000,
  });

  const status = statusQuery.data;
  const offline =
    statusQuery.isError ||
    (status && status.agent.status === "offline");

  if (statusQuery.isLoading) {
    return <div className="text-sm text-muted">Loading network status…</div>;
  }

  if (statusQuery.isError) {
    const apiBase = getApiBaseUrl();
    const onVercel = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            Unable to reach the API
          </p>
          <p className="mt-1 text-sm text-muted">
            {onVercel
              ? `Set Vercel env VITE_API_URL to your public API (currently ${apiBase}). Localhost APIs are not reachable from Vercel.`
              : "Start the backend (`npm run dev:api`) and refresh this page."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const wifiNetworks = status?.wifi_networks ?? [];
  const routerDisconnected =
    status?.router.status === "disconnected" ||
    status?.router.status === "unknown";

  return (
    <div className="space-y-6">
      {offline && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Local agent is offline or unreachable. Device data may be stale until
          the agent reconnects to the backend.
        </div>
      )}
      {!offline && routerDisconnected && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Agent is up, but the router is not connected. Open{" "}
          <Link to="/settings" className="font-medium underline">
            Settings → Connect your router
          </Link>{" "}
          and enter your gateway IP (often 192.168.1.1), username, and password.
          Keep the agent running on a PC on that WiFi.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Agent"
          value={status?.agent.status ?? "—"}
          hint={
            status?.agent.last_heartbeat_at
              ? `Heartbeat ${formatRelative(status.agent.last_heartbeat_at)}`
              : "No heartbeat yet"
          }
          icon={Bot}
        />
        <MetricCard
          label="Router"
          value={status?.router.status ?? "—"}
          hint={
            status?.router.model
              ? `${status.router.model}${status.router.routeros_version ? ` · ${status.router.routeros_version}` : ""}`
              : "Model unknown until agent connects"
          }
          icon={Router}
        />
        <MetricCard
          label="Connected devices"
          value={status?.counts.connected_devices ?? 0}
          hint={`${status?.counts.total_devices ?? 0} known total`}
          icon={Wifi}
        />
        <MetricCard
          label="Blocked / Suspended"
          value={`${status?.counts.blocked_devices ?? 0} / ${status?.counts.suspended_devices ?? 0}`}
          hint="Independent access states"
          icon={Ban}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Download speed"
          value="—"
          unavailable={status?.metrics.download_bps == null}
          hint="Live throughput"
          icon={Download}
        />
        <MetricCard
          label="Upload speed"
          value="—"
          unavailable={status?.metrics.upload_bps == null}
          hint="Live throughput"
          icon={Upload}
        />
        <MetricCard
          label="Daily bandwidth"
          value={
            status?.metrics.daily_bandwidth_bytes != null
              ? formatBytes(status.metrics.daily_bandwidth_bytes)
              : "—"
          }
          unavailable={status?.metrics.daily_bandwidth_bytes == null}
          hint="Since midnight"
          icon={HardDrive}
        />
        <MetricCard
          label="Router CPU"
          value={
            status?.router.cpu_load != null ? `${status.router.cpu_load}%` : "—"
          }
          unavailable={status?.router.cpu_load == null}
          hint={
            status?.router.memory_used_percent != null
              ? `Memory ${status.router.memory_used_percent}%`
              : "Memory unavailable"
          }
          icon={Cpu}
        />
      </div>

      <WifiNetworksPanel
        networks={wifiNetworks}
        emptyHint="Once the agent syncs with your router, SSIDs, bands, and client counts appear here."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Live connected devices</CardTitle>
            <Link
              to="/devices"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {devicesQuery.isLoading && (
              <p className="text-sm text-muted">Loading devices…</p>
            )}
            {devicesQuery.isError && (
              <p className="text-sm text-red-600">Failed to load devices.</p>
            )}
            {devicesQuery.data && devicesQuery.data.data.length === 0 && (
              <div className="rounded-md border border-dashed border-border py-10 text-center">
                <Wifi className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-900">
                  No connected devices reported
                </p>
                <p className="mt-1 text-sm text-muted">
                  Start the local agent on a machine inside the router LAN to
                  discover WiFi clients and DHCP leases.
                </p>
              </div>
            )}
            {devicesQuery.data && devicesQuery.data.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted">
                      <th className="pb-2 font-medium">Device</th>
                      <th className="pb-2 font-medium">IP</th>
                      <th className="pb-2 font-medium">Signal</th>
                      <th className="pb-2 font-medium">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devicesQuery.data.data.map((d) => (
                      <tr key={d.id} className="border-b border-border/70">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <StatusDot status={d.connection_status} />
                            <div>
                              <div className="font-medium text-slate-900">
                                {d.display_name || d.hostname || "Unknown device"}
                              </div>
                              <div className="text-xs text-muted">
                                {d.mac_address}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 text-slate-600">
                          {d.ip_address || "—"}
                        </td>
                        <td className="py-2.5 text-slate-600">
                          {d.signal_strength != null
                            ? `${d.signal_strength} dBm`
                            : "—"}
                        </td>
                        <td className="py-2.5 text-slate-600">
                          {formatRelative(d.last_seen_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <HealthRow
              icon={Bot}
              label="Local agent"
              value={
                <Badge
                  variant={
                    status?.agent.status === "online"
                      ? "success"
                      : status?.agent.status === "degraded"
                        ? "warning"
                        : "muted"
                  }
                >
                  {status?.agent.status}
                </Badge>
              }
            />
            <HealthRow
              icon={Router}
              label="Router link"
              value={
                <Badge
                  variant={
                    status?.router.status === "connected" ? "success" : "muted"
                  }
                >
                  {status?.router.status}
                </Badge>
              }
            />
            <HealthRow
              icon={MemoryStick}
              label="Memory"
              value={
                status?.router.memory_used_percent != null
                  ? `${status.router.memory_used_percent}%`
                  : "—"
              }
            />
            <HealthRow
              icon={Clock}
              label="Uptime"
              value={formatUptime(status?.router.uptime_seconds)}
            />
            <HealthRow
              icon={Wifi}
              label="Wireless stack"
              value={status?.router.wireless_stack ?? "—"}
            />
            <HealthRow
              icon={PauseCircle}
              label="Suspended"
              value={String(status?.counts.suspended_devices ?? 0)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HealthRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="font-medium text-slate-800">{value}</div>
    </div>
  );
}
