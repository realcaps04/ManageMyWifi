# MikroTik Router Setup

Hardware model is **not assumed**. The agent detects capabilities at runtime (`/interface/wifi` vs `/interface/wireless`) and reports `wireless_stack`.

## 1. Enable RouterOS REST API (v7)

In Winbox / WebFig / CLI:

1. Ensure the router has a reachable LAN IP (default often `192.168.88.1`).
2. Enable **www-ssl** (or www) service for REST:
   ```
   /ip service
   set www-ssl disabled=no
   ```
3. Prefer HTTPS on port 443. If using a self-signed cert, set `MIKROTIK_TLS_INSECURE=true` on the agent (LAN only).

REST paths look like: `https://<router>/rest/system/resource`

## 2. Create a least-privilege API user

Do **not** use the full admin account in production.

```
/user group add name=wifi-control policy=read,api,rest-api,!local,!telnet,!ssh,!ftp,!reboot,!write,!policy,!test,!winbox,!password,!web,!sniff,!sensitive,!romon
/user add name=wifi-control group=wifi-control password="<strong-password>" address=192.168.88.0/24
```

For milestone 1 (read-only discovery), `read` + `rest-api` is enough.  
Later (block / suspend / queues) you will need limited `write` on specific resources — still not full admin.

Adjust `address=` to the subnet of the machine running the agent.

## 3. Verify from the agent host

From the LAN machine that will run the agent:

```bash
curl -k -u wifi-control:<password> https://192.168.88.1/rest/system/resource
```

You should receive JSON with `version`, `board-name`, `cpu-load`, etc.

## 4. Wireless stacks

| Stack | Typical paths |
|-------|----------------|
| `wifi` (wifiwave2 / wifi package) | `/interface/wifi/registration-table` |
| `wireless` (legacy) | `/interface/wireless/registration-table` |

If neither exists (wired-only or CAPsMAN-only setups), the agent still syncs DHCP leases and reports `wireless_stack: unknown`.

## 5. Agent configuration

`apps/agent/.env`:

```
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=443
MIKROTIK_USER=wifi-control
MIKROTIK_PASSWORD=...
MIKROTIK_TLS_INSECURE=true
BACKEND_URL=http://<api-host>:4000/api/v1
AGENT_SHARED_SECRET=<same as API>
NETWORK_ID=00000000-0000-4000-8000-000000000001
```

## 6. Run as a service (later)

After milestone 1 verification, install the agent as a Windows service or systemd unit so it starts on boot. Keep credentials out of source control (`apps/agent/data/agent-credentials.json` is gitignored).

## 7. Recovery notes

- If the agent disconnects, the dashboard shows agent **offline**; existing router config is untouched.
- Admin self-lockout protections (never suspend the operator’s current MAC without confirmation) land with control features.
- Application-managed rules will use the `wifi-control:` namespace / comment prefix and must not delete unrelated firewall entries.
