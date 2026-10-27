import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { DashboardPage } from "@/pages/dashboard";
import { DevicesPage } from "@/pages/devices";
import { NetworkPage } from "@/pages/network";
import { AccessListPage } from "@/pages/access-list";
import { UsersPage } from "@/pages/users";
import { SettingsPage } from "@/pages/settings";
import { LoginPage } from "@/pages/login";
import { PlaceholderPage } from "@/pages/placeholder";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGate />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="blocked" element={<AccessListPage mode="blocked" />} />
          <Route
            path="suspended"
            element={<AccessListPage mode="suspended" />}
          />
          <Route path="network" element={<NetworkPage />} />
          <Route
            path="bandwidth"
            element={
              <PlaceholderPage
                title="Bandwidth Management"
                description="Use per-device Limits on Connected Devices. A dedicated bandwidth page with charts is next."
              />
            }
          />
          <Route
            path="schedules"
            element={
              <PlaceholderPage
                title="Schedules"
                description="Timed suspend/resume policies will appear here."
              />
            }
          />
          <Route
            path="analytics"
            element={
              <PlaceholderPage
                title="Analytics & Reports"
                description="Historical usage charts require agent counter rollups."
              />
            }
          />
          <Route
            path="logs"
            element={
              <PlaceholderPage
                title="Activity Logs"
                description="Immutable admin audit trail will be shown here."
              />
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
