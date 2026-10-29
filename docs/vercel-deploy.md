# Deploy ManageMyWifi (web + API on Vercel)

You do **not** need a separate API server. Vercel hosts both:

- Web UI → your `*.vercel.app` site  
- API → same site under `/api/v1/...`

```
Browser  →  Vercel (web + /api/v1)
                 ↑
Local agent (on your LAN) posts device sync / heartbeats
                 ↓
            Your WiFi router
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

On a PC on your WiFi LAN (`apps/agent/.env`):

```
BACKEND_URL=https://your-app.vercel.app/api/v1
AGENT_SHARED_SECRET=<same as Vercel>
NETWORK_ID=00000000-0000-4000-8000-000000000001
```

Then:

```bash
cd E:\Wifi_manager
npm run dev:agent
```

## 4. Sign in and connect the router in the UI

1. Open your Vercel URL → sign in with WiFi name / password.
2. Go to **Settings → Connect your router** and enter gateway IP + router login.
3. The LAN agent downloads those details and syncs devices.

## Notes

- Serverless memory resets on cold starts (in-memory store).
- Router passwords are entered in the website Settings and pulled by the agent — users do not edit `.env` for router credentials.
