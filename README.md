# ManageMyWifi

Public WiFi network management — manage devices, access, and network health from the browser.

**Architecture:** Browser → ManageMyWifi web app → API → Local network agent → Your WiFi router (LAN).

The cloud never needs your router opened to the internet. A small agent on your LAN talks to the router and syncs with the public site.

## Monorepo layout

```
apps/
  web/      React + Vite admin UI
  api/      Express TypeScript API
  agent/   Local network agent (runs on your LAN)
packages/
  shared-types/
  validation/
docs/
```

## Milestone 1 (current)

- Monorepo with web, API, and agent
- In-memory API store for local development (no external DB)
- Agent discovers WiFi clients + DHCP leases from your router
- Devices sync to the dashboard
- Agent heartbeat / health monitoring
- Block / suspend control is **queued but deferred** until discovery is verified

## Prerequisites

- Node.js 20+
- A WiFi router with a LAN REST API (agent host must be on the same network)
- A PC on the same LAN as the router (for the agent)

## Quick start

```bash
cd Wifi_manager
npm install
npm run build:shared

# Terminal 1 — API + Web
cp apps/api/.env.example apps/api/.env
npm run dev

# Terminal 2 — Agent (on LAN with the router)
cp apps/agent/.env.example apps/agent/.env
# Edit ROUTER_* credentials
npm run dev:agent
```

- Web: http://localhost:5173  
- API health: http://localhost:4000/health  

## Environment

See root `.env.example` and per-app `.env.example` files.

| Variable | Where | Purpose |
|----------|-------|---------|
| `AGENT_SHARED_SECRET` | API + Agent | Shared secret for agent registration |
| `DEV_AUTH_BYPASS` | API | Skip sign-in in local development |
| `ROUTER_HOST/USER/PASSWORD` | Agent | Local router REST credentials |

## Deploy to Vercel (web + API together)

See [docs/vercel-deploy.md](docs/vercel-deploy.md).

You do **not** need a separate API host. Vercel serves the dashboard and `/api/v1` on the same URL. Run only the **local agent** on your LAN and point `BACKEND_URL` at your public site.

## Documentation

- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Router setup](docs/router-setup.md)
- [Vercel deploy](docs/vercel-deploy.md)
- [Run commands](docs/run.md)

## Security notes

- Never expose your router management API to the internet.
- Use a dedicated least-privilege router user for the agent.
- Milestone 1 does not apply firewall / wireless deny rules yet.
