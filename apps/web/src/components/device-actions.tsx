import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  PauseCircle,
  PlayCircle,
  ShieldOff,
  Unplug,
  Gauge,
} from "lucide-react";
import { api, type Device } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ActionKey = "suspend" | "resume" | "block" | "unblock" | "disconnect";

export function DeviceActions({
  device,
  compact,
}: {
  device: Device;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [down, setDown] = useState("10");
  const [up, setUp] = useState("5");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["devices"] });
    void qc.invalidateQueries({ queryKey: ["network-status"] });
  };

  const actionMutation = useMutation({
    mutationFn: async (action: ActionKey) => {
      switch (action) {
        case "suspend":
          return api.suspendDevice(device.id, {
            reason: "Suspended from web dashboard",
          });
        case "resume":
          return api.resumeDevice(device.id);
        case "block":
          return api.blockDevice(device.id);
        case "unblock":
          return api.unblockDevice(device.id);
        case "disconnect":
          return api.disconnectDevice(device.id);
      }
    },
    onSuccess: () => {
      setPending(null);
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const limitsMutation = useMutation({
    mutationFn: () =>
      api.setBandwidthLimits(device.id, {
        download_mbps: Number(down),
        upload_mbps: Number(up),
      }),
    onSuccess: () => {
      setLimitsOpen(false);
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const name = device.display_name || device.hostname || device.mac_address;

  const dialogs: Record<
    ActionKey,
    { title: string; description: string; confirmLabel: string; danger?: boolean }
  > = {
    suspend: {
      title: "Suspend internet?",
      description: `${name} stays on WiFi but loses internet until resumed.`,
      confirmLabel: "Suspend internet",
      danger: true,
    },
    resume: {
      title: "Resume internet?",
      description: `Restore internet access for ${name}.`,
      confirmLabel: "Resume",
    },
    block: {
      title: "Block WiFi access?",
      description: `${name} will be denied from the managed WiFi until unblocked.`,
      confirmLabel: "Block device",
      danger: true,
    },
    unblock: {
      title: "Unblock device?",
      description: `Allow ${name} to join WiFi again.`,
      confirmLabel: "Unblock",
    },
    disconnect: {
      title: "Disconnect session?",
      description: `Kick ${name} from the current WiFi session only — not a permanent block.`,
      confirmLabel: "Disconnect",
      danger: true,
    },
  };

  return (
    <div className={compact ? "flex flex-wrap gap-1" : "flex flex-wrap gap-2"}>
      {!device.is_suspended ? (
        <Button size="sm" variant="secondary" onClick={() => setPending("suspend")}>
          <PauseCircle className="h-3.5 w-3.5" />
          {!compact && "Suspend"}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setPending("resume")}>
          <PlayCircle className="h-3.5 w-3.5" />
          {!compact && "Resume"}
        </Button>
      )}

      {!device.is_blocked ? (
        <Button size="sm" variant="secondary" onClick={() => setPending("block")}>
          <Ban className="h-3.5 w-3.5" />
          {!compact && "Block"}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setPending("unblock")}>
          <ShieldOff className="h-3.5 w-3.5" />
          {!compact && "Unblock"}
        </Button>
      )}

      <Button
        size="sm"
        variant="secondary"
        onClick={() => setPending("disconnect")}
        disabled={device.connection_status !== "online"}
      >
        <Unplug className="h-3.5 w-3.5" />
        {!compact && "Disconnect"}
      </Button>

      <Button size="sm" variant="secondary" onClick={() => setLimitsOpen(true)}>
        <Gauge className="h-3.5 w-3.5" />
        {!compact && "Limits"}
      </Button>

      {error && <p className="basis-full text-xs text-red-600">{error}</p>}

      {pending && (
        <ConfirmDialog
          open
          title={dialogs[pending].title}
          description={dialogs[pending].description}
          confirmLabel={dialogs[pending].confirmLabel}
          danger={dialogs[pending].danger}
          busy={actionMutation.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => actionMutation.mutate(pending)}
        />
      )}

      {limitsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => setLimitsOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-lg">
            <h2 className="text-base font-semibold">Set bandwidth limits</h2>
            <p className="mt-2 text-sm text-muted">
              Mbps limits for {name} via app-managed Simple Queues.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-muted">
                Download
                <Input
                  className="mt-1"
                  value={down}
                  onChange={(e) => setDown(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label className="text-xs font-medium text-muted">
                Upload
                <Input
                  className="mt-1"
                  value={up}
                  onChange={(e) => setUp(e.target.value)}
                  inputMode="decimal"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLimitsOpen(false)}
                disabled={limitsMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => limitsMutation.mutate()}
                disabled={limitsMutation.isPending}
              >
                {limitsMutation.isPending ? "Working…" : "Apply limits"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
