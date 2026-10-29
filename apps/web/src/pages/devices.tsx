import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Wifi, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { DeviceActions } from "@/components/device-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/status-dot";
import { formatBytes, formatRelative } from "@/lib/utils";

export function DevicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "online" | "offline">("all");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["devices", { search, status, page }],
    queryFn: () =>
      api.getDevices({
        search: search || undefined,
        status,
        page,
        pageSize: 25,
      }),
    refetchInterval: 12_000,
  });

  const totalPages = useMemo(() => {
    if (!query.data) return 1;
    return Math.max(1, Math.ceil(query.data.total / query.data.pageSize));
  }, [query.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Connected Devices</CardTitle>
            <p className="mt-0.5 text-sm text-muted">
              Live inventory from your local network agent (WiFi clients + DHCP
              leases).
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Search by name, MAC, IP, vendor…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            <div className="flex gap-1 rounded-md border border-border p-0.5">
              {(["all", "online", "offline"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setStatus(s);
                  }}
                  className={`rounded px-3 py-1.5 text-xs font-medium capitalize ${
                    status === s
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {query.isLoading && (
            <p className="py-8 text-center text-sm text-muted">
              Loading devices…
            </p>
          )}

          {query.isError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
              Failed to load devices from the API.
            </div>
          )}

          {query.data && query.data.data.length === 0 && (
            <div className="rounded-md border border-dashed border-border py-14 text-center">
              <Wifi className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium">No devices found</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                When the agent successfully syncs, real WiFi clients and DHCP
                leases from your router will appear here. No mock devices are
                shown.
              </p>
            </div>
          )}

          {query.data && query.data.data.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted">
                      <th className="pb-2 pr-3 font-medium">Device</th>
                      <th className="pb-2 pr-3 font-medium">IP</th>
                      <th className="pb-2 pr-3 font-medium">MAC</th>
                      <th className="pb-2 pr-3 font-medium">Type</th>
                      <th className="pb-2 pr-3 font-medium">SSID / IF</th>
                      <th className="pb-2 pr-3 font-medium">Signal</th>
                      <th className="pb-2 pr-3 font-medium">Usage</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 pr-3 font-medium">Last seen</th>
                      <th className="pb-2 font-medium">Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.data.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-border/60 hover:bg-slate-50/80"
                      >
                        <td className="py-3 pr-3">
                          <div className="font-medium text-slate-900">
                            {d.display_name || d.hostname || "Unknown"}
                          </div>
                          <div className="text-xs text-muted">
                            {d.vendor || "Vendor unknown"}
                          </div>
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs text-slate-700">
                          {d.ip_address || "—"}
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs text-slate-700">
                          {d.mac_address}
                        </td>
                        <td className="py-3 pr-3 capitalize text-slate-600">
                          {d.connection_type || "—"}
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          <div>{d.ssid || "—"}</div>
                          <div className="text-xs text-muted">
                            {d.interface_name || ""}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          {d.signal_strength != null
                            ? `${d.signal_strength} dBm`
                            : "—"}
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-600">
                          <div>↓ {formatBytes(d.bytes_download)}</div>
                          <div>↑ {formatBytes(d.bytes_upload)}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge
                              variant={
                                d.connection_status === "online"
                                  ? "success"
                                  : "muted"
                              }
                            >
                              <StatusDot status={d.connection_status} />
                              {d.connection_status}
                            </Badge>
                            {d.is_blocked && (
                              <Badge variant="danger">blocked</Badge>
                            )}
                            {d.is_suspended && (
                              <Badge variant="warning">suspended</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          {formatRelative(d.last_seen_at)}
                        </td>
                        <td className="py-3">
                          <DeviceActions device={d} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-muted">
                <span>
                  {query.data.total} device
                  {query.data.total === 1 ? "" : "s"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {page} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
