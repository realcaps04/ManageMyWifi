import { useQuery } from "@tanstack/react-query";
import { Ban, PauseCircle } from "lucide-react";
import { api } from "@/lib/api";
import { DeviceActions } from "@/components/device-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";

export function AccessListPage({ mode }: { mode: "blocked" | "suspended" }) {
  const query = useQuery({
    queryKey: ["devices", { pageSize: 100, status: "all" }],
    queryFn: () => api.getDevices({ pageSize: 100, status: "all" }),
    refetchInterval: 12_000,
  });

  const devices =
    query.data?.data.filter((d) =>
      mode === "blocked" ? d.is_blocked : d.is_suspended
    ) ?? [];

  const Icon = mode === "blocked" ? Ban : PauseCircle;
  const title = mode === "blocked" ? "Blocked Devices" : "Suspended Devices";
  const empty =
    mode === "blocked"
      ? "No devices are currently blocked from WiFi."
      : "No devices currently have internet suspended.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="mt-0.5 text-sm text-muted">
          {mode === "blocked"
            ? "WiFi association denied via managed access-list rules."
            : "Internet restricted via managed firewall rules; WiFi may still be associated."}
        </p>
      </CardHeader>
      <CardContent>
        {query.isLoading && (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        )}
        {!query.isLoading && devices.length === 0 && (
          <div className="rounded-md border border-dashed border-border py-14 text-center">
            <Icon className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium">{empty}</p>
          </div>
        )}
        {devices.length > 0 && (
          <div className="space-y-3">
            {devices.map((d) => (
              <div
                key={d.id}
                className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {d.display_name || d.hostname || "Unknown"}
                    </span>
                    {d.is_blocked && <Badge variant="danger">blocked</Badge>}
                    {d.is_suspended && (
                      <Badge variant="warning">suspended</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {d.mac_address}
                    {d.ip_address ? ` · ${d.ip_address}` : ""} · last seen{" "}
                    {formatRelative(d.last_seen_at)}
                  </div>
                </div>
                <DeviceActions device={d} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
