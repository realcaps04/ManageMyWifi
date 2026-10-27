import { Bell, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { useAuth } from "@/lib/auth";
import type { NetworkStatus } from "@/lib/api";

export function Topbar({
  status,
  title,
}: {
  status?: NetworkStatus;
  title: string;
}) {
  const { session, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-white px-6">
      <div>
        <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
        {status && (
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status={status.agent.status} />
              Agent {status.agent.status}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status={status.router.status} />
              Router {status.router.status}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search devices…"
            className="w-56 pl-8"
            disabled
            title="Global search coming soon"
          />
        </div>
        <button
          type="button"
          className="relative rounded-md p-2 text-slate-500 hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        <div className="hidden text-right sm:block">
          <div className="text-xs font-medium text-slate-800">
            {session?.ssid || "Signed in"}
          </div>
          <div className="text-[11px] text-muted">Verified WiFi</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={logout}
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
