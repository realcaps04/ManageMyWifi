import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { api } from "@/lib/api";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/devices": "Connected Devices",
  "/users": "Users",
  "/blocked": "Blocked Devices",
  "/suspended": "Suspended Devices",
  "/network": "Network Management",
  "/bandwidth": "Bandwidth Management",
  "/schedules": "Schedules",
  "/analytics": "Analytics & Reports",
  "/logs": "Activity Logs",
  "/settings": "Settings",
};

export function AppShell() {
  const location = useLocation();
  const { data: status } = useQuery({
    queryKey: ["network-status"],
    queryFn: api.getNetworkStatus,
    refetchInterval: 10_000,
  });

  const title = titles[location.pathname] || "ManageMyWifi";

  return (
    <div className="flex h-full min-h-0">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar status={status} title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
