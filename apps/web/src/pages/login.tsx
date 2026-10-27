import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Radio, Wifi } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function LoginPage() {
  const { session, loading, login } = useAuth();
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [networkName, setNetworkName] = useState("WiFi Control");
  const [passwordConfigured, setPasswordConfigured] = useState(true);

  useEffect(() => {
    void api
      .getAuthStatus()
      .then((s) => {
        setSuggested(s.suggested_ssids || []);
        setNetworkName(s.network_name || "WiFi Control");
        setPasswordConfigured(s.password_configured);
        if (s.suggested_ssids?.length === 1) {
          setSsid(s.suggested_ssids[0]);
        }
      })
      .catch(() => {
        /* API may be down — still show login form */
      });
  }, []);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(ssid.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Sign-in failed. Check WiFi name and password."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Radio className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {networkName}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Sign in with your WiFi network name and password to verify access.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm">
                <span className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-700">
                  <Wifi className="h-3.5 w-3.5" />
                  WiFi name (SSID)
                </span>
                <Input
                  autoComplete="username"
                  placeholder="e.g. HomeWifi"
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  list="ssid-suggestions"
                  required
                />
                {suggested.length > 0 && (
                  <datalist id="ssid-suggestions">
                    {suggested.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                )}
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">
                  WiFi password
                </span>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Network verification password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              {!passwordConfigured && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Portal password is not configured on the API yet. Set{" "}
                  <code>WIFI_LOGIN_PASSWORD</code> in{" "}
                  <code>apps/api/.env</code> and restart the API.
                </p>
              )}

              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={busy || !ssid.trim() || !password}
              >
                {busy ? "Verifying…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted">
          Access is verified against the managed WiFi identity for this network.
        </p>
      </div>
    </div>
  );
}
