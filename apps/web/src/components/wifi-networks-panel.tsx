import { Radio, Wifi } from "lucide-react";
import type { WifiNetwork } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WifiNetworksPanel({
  networks,
  loading,
  emptyHint,
}: {
  networks: WifiNetwork[];
  loading?: boolean;
  emptyHint?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>WiFi networks</CardTitle>
        <p className="mt-0.5 text-sm text-muted">
          SSIDs and radios reported by your MikroTik via the local agent.
        </p>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted">Loading WiFi details…</p>}
        {!loading && networks.length === 0 && (
          <div className="rounded-md border border-dashed border-border py-10 text-center">
            <Radio className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-900">
              No WiFi details yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              {emptyHint ||
                "Start the agent with a valid MikroTik password so SSIDs, bands, and client counts can sync."}
            </p>
          </div>
        )}
        {!loading && networks.length > 0 && (
          <div className="space-y-3">
            {networks.map((n) => (
              <div
                key={`${n.interface_name}-${n.ssid || "ssid"}`}
                className="flex flex-col gap-2 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-brand-50 p-2 text-brand-700">
                    <Wifi className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {n.ssid || "(hidden / no SSID)"}
                      </span>
                      <Badge variant={n.running && !n.disabled ? "success" : "muted"}>
                        {n.disabled ? "disabled" : n.running ? "up" : "down"}
                      </Badge>
                      {n.mode && <Badge variant="info">{n.mode}</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Interface {n.interface_name}
                      {n.band ? ` · ${n.band}` : ""}
                      {n.channel ? ` · ch ${n.channel}` : ""}
                      {n.frequency ? ` · ${n.frequency}` : ""}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-slate-700 sm:text-right">
                  <div className="font-medium">
                    {n.online_devices ?? n.clients} client
                    {(n.online_devices ?? n.clients) === 1 ? "" : "s"}
                  </div>
                  <div className="text-xs text-muted">associated</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
