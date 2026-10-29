# Run ManageMyWifi locally

## First time

```powershell
cd E:\Wifi_manager
npm install
```

## API + Web

```powershell
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:4000/health  

## Connect a router (for end users — no .env editing)

1. Open the website and sign in.
2. Go to **Settings → Connect your router**.
3. Enter gateway IP (often `192.168.1.1`), router username, and password → Save.
4. On a PC connected to that WiFi, run the agent (below). It downloads those details from the API automatically.

## Agent (LAN PC only)

`apps/agent/.env` only needs the API URL + shared secret (not router password):

```env
BACKEND_URL=http://localhost:4000/api/v1
AGENT_SHARED_SECRET=dev-agent-shared-secret
NETWORK_ID=00000000-0000-4000-8000-000000000001
```

```powershell
npm run dev:agent
```

## All three together

```powershell
npm run dev:all
```

## Build

```powershell
npm run build
```
