# Architecture

## Data flow

```
Admin Browser
    │ HTTPS
    ▼
React Frontend (Vercel)
    │ HTTPS /api/v1
    ▼
Node.js Backend (VPS)
    │ Authenticated agent channel (agent polls / heartbeats / syncs outbound)
    ▼
Local Network Agent (LAN)
    │ HTTPS RouterOS REST (private)
    ▼
MikroTik Router
```

## Responsibilities

| Component | Owns |
|-----------|------|
| **web** | UI, TanStack Query, never talks to MikroTik directly |
| **api** | Auth, validation, device inventory, command queue, audit |
| **agent** | RouterOS REST, discovery, verified execution of allowlisted commands |
| **Supabase** | Durable storage, Auth, Realtime, RLS |

## Milestone 1 storage mode

If `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset, the API uses an **in-memory store** so local development works without cloud credentials. This is development-only and labeled in `/health` as `"storage": "memory"`.

Apply `supabase/migrations/001_initial_schema.sql` when moving to Supabase.

## Synchronization

| Loop | Default interval |
|------|------------------|
| Device sync | 12s |
| Agent heartbeat | 30s |
| Command poll | 5s |
| Dashboard refetch | 10–12s |

Change detection avoids rewriting unchanged device fields. Devices missing from a sync are marked offline.

## Identity

Devices are keyed by `identity_key`:

1. DHCP `client-id` when present → `client:<id>`
2. Otherwise → `mac:<MAC>`

MAC alone is not treated as a permanent identity for future firewall rules; DHCP reservation / mapping will back suspension enforcement.

## Command safety

- Browser never sends raw RouterOS commands.
- API enqueues allowlisted `command_type` values.
- Agent rejects unknown types and, until control is enabled, refuses block/suspend/limit mutations.
- Success is only reported after verified router state (control phase).
