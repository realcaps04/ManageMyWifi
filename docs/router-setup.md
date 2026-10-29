# Router setup (local agent)

Hardware brand is **not assumed**. The agent detects capabilities at runtime and reports a `wireless_stack`.

## 1. Enable the router’s LAN management / REST API

On your WiFi router (admin UI or CLI):

1. Note the LAN gateway IP (often `192.168.1.1` or `192.168.88.1`).
2. Enable the HTTPS / REST management service on the LAN.
3. Prefer HTTPS. Self-signed certs are fine — turn on “Allow self-signed HTTPS” in website Settings.

## 2. Create a least-privilege API user (recommended)

Do **not** use the full admin account in production when you can avoid it. Create a dedicated user with read (and later limited write) access for discovery and control.

## 3. Enter details in the website (for end users)

Users only see the ManageMyWifi frontend. They should **not** edit `.env` files.

1. Sign in → **Settings → Connect your router**
2. Enter gateway IP, username, and password → Save
3. On a PC connected to that WiFi, run the agent with only the API URL + shared secret

The agent pulls router credentials from the API automatically.

## 4. Agent on the LAN PC

`apps/agent/.env` (developer / installer only):

```
BACKEND_URL=https://your-app.example/api/v1
AGENT_SHARED_SECRET=<same as server>
AGENT_NAME=local-agent
NETWORK_ID=00000000-0000-4000-8000-000000000001
```

```powershell
npm run dev:agent
```

## 5. Public website + home WiFi

1. Deploy web + API publicly.
2. Users configure the router in **Settings**.
3. Someone on the LAN runs the agent pointed at the public API.
