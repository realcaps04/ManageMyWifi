# Architecture

## Data flow

```
Any user's browser
    │ HTTPS
    ▼
ManageMyWifi Web (public site)
    │ HTTPS /api/v1
    ▼
API backend
    │ Authenticated agent channel (agent polls / heartbeats / syncs outbound)
    ▼
Local Network Agent (on the user's LAN)
    │ HTTPS router REST (private)
    ▼
User's WiFi router
```

Anyone can open the public website. To manage a specific WiFi network, that network needs a local agent running on its LAN (so the router never has to be exposed to the internet).

## Responsibilities

| Component | Owns |
|-----------|------|
| **web** | UI, TanStack Query, never talks to the router directly |
| **api** | Auth, validation, device inventory, command queue, audit (in-memory store) |
| **agent** | Router REST, discovery, verified execution of allowlisted commands |

## Storage mode

The API uses an **in-memory store** for local development and Vercel warm invocations. Labeled in `/health` as `"storage": "memory"`. Data resets when the process restarts.

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

- Prefer stable MAC when available
- Fall back to other stable identifiers from DHCP / wireless registration

## Security boundaries

- Browser never sends raw router commands.
- Agent only executes allowlisted operations.
- Router credentials stay on the LAN agent machine only.
