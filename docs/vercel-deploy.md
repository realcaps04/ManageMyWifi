# Deploy WiFi Control (web on Vercel)

Vercel hosts the **React dashboard only**. The API and local MikroTik agent must run elsewhere — Vercel serverless cannot keep the agent command channel + in-memory device inventory reliably.

```
Browser (anywhere)
   │ HTTPS
   ▼
Vercel (apps/web)
   │ HTTPS  VITE_API_URL
   ▼
API host (Railway / Render / VPS)  ← always-on Node
   │ agent outbound HTTPS
   ▼
Local agent (PC on router LAN)
   │
   ▼
MikroTik
```

## 1. Deploy the API (required before Vercel)

On a VPS / Railway / Render:

```bash
cd apps/api
# set env:
# PORT or API_PORT=4000
# CORS_ORIGINS=https://your-app.vercel.app
# AGENT_SHARED_SECRET=<long-random>
# DEV_AUTH_BYPASS=false   # use true only for temporary testing
npm install
npm run build -w @wifi-control/shared-types -w @wifi-control/validation -w @wifi-control/api
npm run start -w @wifi-control/api
```

Expose HTTPS (Caddy/nginx or platform TLS). Health check: `GET /health`.

## 2. Point the agent at the public API

On the LAN machine (`apps/agent/.env`):

```
BACKEND_URL=https://YOUR_API_HOST/api/v1
AGENT_SHARED_SECRET=<same as API>
MIKROTIK_HOST=<router-lan-ip>
MIKROTIK_USER=wifi-control
MIKROTIK_PASSWORD=<secret>
MIKROTIK_TLS_INSECURE=true
```

```bash
npm run dev:agent
# or install as a Windows/Linux service for always-on
```

## 3. Deploy the web app to Vercel

### Option A — CLI

```bash
cd E:\Wifi_manager
npx vercel
```

Root `vercel.json` builds the web workspace and publishes `apps/web/dist`.

### Option B — GitHub

1. Import `ManageMyWifi` into Vercel.
2. Framework: Vite (or Other).
3. Root directory: repository root (uses root `vercel.json`).
4. Environment variable:

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://YOUR_API_HOST/api/v1` |

5. Deploy.

## 4. CORS

API `.env`:

```
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
```

Preview deployments (`*.vercel.app`) are allowed when any configured origin ends with `.vercel.app`.

## 5. Manage from the web

With agent online and router reachable:

- **Connected Devices** — suspend / resume / block / unblock / disconnect / bandwidth limits
- **Blocked / Suspended** — filtered management lists
- **Users** — register people for later device assignment
- **Settings** — deployment + live agent/router status
- **Network** — router inventory

Actions are queued to the agent and only marked successful after router verification.

## Important

- Do **not** put MikroTik credentials in Vercel.
- Do **not** expose RouterOS REST to the internet.
- Memory store resets when the API process restarts — apply Supabase migrations for production persistence (`supabase/migrations`).
