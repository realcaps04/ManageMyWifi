# WiFi Control

Professional MikroTik WiFi Network Management Platform.

**Architecture:** Admin browser → React frontend → Node.js API (VPS) → Local network agent → MikroTik RouterOS REST API.

The backend never requires exposing MikroTik’s API to the public internet. The agent opens an outbound authenticated connection and executes allowlisted operations locally.

## Monorepo layout

```
apps/
  web/      React + Vite + Tailwind admin UI
  api/      Express TypeScript API
  agent/   Local MikroTik agent
packages/
  shared-types/
  validation/
supabase/
  migrations/
docs/
```

## Milestone 1 (current)

- Monorepo with web, API, and agent
- Supabase SQL migrations (RLS enabled)
- Agent discovers real WiFi clients + DHCP leases via RouterOS REST
- Devices sync to API and appear in the dashboard
- Agent heartbeat / health monitoring
- Block / suspend control is **queued but deferred** until discovery is verified

## Prerequisites

- Node.js 20+
- A MikroTik router with **RouterOS v7** and REST API enabled
- A PC on the same LAN as the router (for the agent)
- Optional: Supabase project (API works with an in-memory store for local milestone 1)

## Quick start

```bash
cd Wifi_manager
npm install
npm run build:shared

# Terminal 1 — API
cp apps/api/.env.example apps/api/.env
npm run dev:api

# Terminal 2 — Web
npm run dev:web

# Terminal 3 — Agent (on LAN with the router)
cp apps/agent/.env.example apps/agent/.env
# Edit MIKROTIK_* credentials
npm run dev:agent
```

- Web: http://localhost:5173  
- API health: http://localhost:4000/health  

## Environment

See root `.env.example` and per-app `.env.example` files.

| Variable | Where | Purpose |
|----------|-------|---------|
| `AGENT_SHARED_SECRET` | API + Agent | Shared secret for agent registration |
| `DEV_AUTH_BYPASS` | API | Skip JWT in local development |
| `MIKROTIK_HOST/USER/PASSWORD` | Agent | Local RouterOS REST credentials |
| `SUPABASE_*` | API / Web | Optional cloud DB + auth |

## Deploy web to Vercel

See [docs/vercel-deploy.md](docs/vercel-deploy.md).

Summary: host `apps/web` on Vercel with `VITE_API_URL` pointing at your always-on API; run the agent on the router LAN against that same API.

## Documentation

- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Router setup](docs/router-setup.md)
- [Vercel deploy](docs/vercel-deploy.md)

## Security notes

- Never expose RouterOS REST to the internet.
- Use a dedicated least-privilege RouterOS user for the agent.
- Do not put the Supabase service-role key in the frontend.
- Milestone 1 does not apply firewall / wireless deny rules yet.

# ManageMyWifi
