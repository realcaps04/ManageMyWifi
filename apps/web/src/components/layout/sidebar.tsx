import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wifi,
  Users,
  Ban,
  PauseCircle,
  Network,
  Gauge,
  CalendarClock,
  BarChart3,
  ScrollText,
  Settings,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/devices", label: "Connected Devices", icon: Wifi },
  { to: "/users", label: "Users", icon: Users },
  { to: "/blocked", label: "Blocked Devices", icon: Ban },
  { to: "/suspended", label: "Suspended Devices", icon: PauseCircle },
  { to: "/network", label: "Network Management", icon: Network },
  { to: "/bandwidth", label: "Bandwidth Management", icon: Gauge },
  { to: "/schedules", label: "Schedules", icon: CalendarClock },
  { to: "/analytics", label: "Analytics & Reports", icon: BarChart3 },
  { to: "/logs", label: "Activity Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-white">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white">
          <Radio className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">WiFi Control</div>
          <div className="text-[11px] text-muted">Network Manager</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {nav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    isActive && "bg-brand-50 text-brand-700 font-medium"
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
