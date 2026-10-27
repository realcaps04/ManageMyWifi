# Deploy ManageMyWifi (web + API on Vercel)

You do **not** need a separate API server. Vercel hosts both:

- Web UI → your `*.vercel.app` site  
- API → same site under `/api/v1/...`

```
Browser  →  Vercel (web + /api/v1)
                 ↑
Local agent (on your LAN) posts device sync / heartbeats
                 ↓
            MikroTik router
```

## 1. Vercel project settings

1. Import the GitHub repo `ManageMyWifi`.
2. **Root Directory:** leave empty (repository root).
3. Framework: Vite (or Other) — `vercel.json` already configures build/output.
4. Add these **Environment Variables** (Production + Preview):

| Name | Example | Required |
|------|---------|----------|
| `WIFI_LOGIN_SSID` | `YourWifiName` | Yes |
| `WIFI_LOGIN_PASSWORD` | strong password | Yes |
| `AGENT_SHARED_SECRET` | long random string | Yes |
| `SESSION_SECRET` | long random string | Yes |
| `DEV_AUTH_BYPASS` | `false` | Yes |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | Recommended |
| `NETWORK_NAME` | `ManageMyWifi` | Optional |

No `VITE_API_URL` needed — the web app calls `/api/v1` on the same domain.

## 2. Redeploy

Push to `main` or click **Redeploy** in Vercel.

Check API health: `https://your-app.vercel.app/api/health`

## 3. Point the local agent at Vercel

On the PC next to your MikroTik (`apps/agent/.env`):

```
BACKEND_URL=https://your-app.vercel.app/api/v1
AGENT_SHARED_SECRET=<same as Vercel>
NETWORK_ID=00000000-0000-4000-8000-000000000001
MIKROTIK_HOST=192.168.1.1
MIKROTIK_USER=wifi-control
MIKROTIK_PASSWORD=<router password>
MIKROTIK_TLS_INSECURE=true
```

Then:

```bash
cd E:\Wifi_manager
npm run dev:agent
```

## 4. Sign in on the website

Open your Vercel URL → enter the **WiFi name** and **password** you set in Vercel env vars.

## Notes

- Serverless memory resets on cold starts. For always-on durable storage later, add Supabase (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
- Never put MikroTik credentials in Vercel — only on the LAN agent machine.
