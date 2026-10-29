import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { restoreCookiesToApi } from "@/lib/persist-client";

export function AuthGate() {
  const { session, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!session) return;
    void restoreCookiesToApi();
  }, [session]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
