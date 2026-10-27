# API (`/api/v1`)

Base URL (dev): `http://localhost:4000/api/v1`

## Health

- `GET /health` — process health, storage mode, default network id

## Network / router

- `GET /network/status` — agent + router + counts + metrics
- `GET /router/status` — router detail
- `GET /router/interfaces` — reserved (empty until agent interface sync)

## Devices

- `GET /devices?page&pageSize&search&status`
- `GET /devices/:id`
- `GET /devices/:id/history`
- `PATCH /devices/:id`
- `POST /devices/:id/suspend|resume|block|unblock|disconnect`
- `PUT /devices/:id/limits`

Control POSTs return `202` with a queued command id. Execution is deferred until post–milestone 1.

## Users

- `GET|POST /users`
- `PATCH|DELETE /users/:id`

## Analytics

- `GET /analytics/usage`
- `GET /analytics/devices`

## Agent

Authenticated with header `X-Agent-Token` (except register).

- `POST /agent/register` — body: `{ name, network_id, shared_secret, hostname?, version? }`
- `POST /agent/heartbeat`
- `GET /agent/commands`
- `POST /agent/commands/:id/result`
- `POST /agent/sync` — body: `{ devices[], router?, synced_at }`

## Auth (dev)

With `DEV_AUTH_BYPASS=true` (default in `.env.example`), user routes skip JWT. Production must use Supabase Auth bearer tokens.
