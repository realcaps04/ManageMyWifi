import { RouterClient } from "./router-client";

export interface DhcpLease {
  id?: string;
  address: string | null;
  macAddress: string | null;
  hostName: string | null;
  status: string | null;
  comment: string | null;
  clientId: string | null;
  activeAddress: string | null;
  activeMacAddress: string | null;
  dynamic: boolean;
}

function normMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  return mac.toUpperCase().replace(/-/g, ":");
}

export async function fetchDhcpLeases(
  client: RouterClient
): Promise<DhcpLease[]> {
  const rows = await client.get<Record<string, string>[]>(
    "/ip/dhcp-server/lease"
  );
  if (!Array.isArray(rows)) return [];

  return rows.map((r) => ({
    id: r[".id"],
    address: r.address || null,
    macAddress: normMac(r["mac-address"]),
    hostName: r["host-name"] || null,
    status: r.status || null,
    comment: r.comment || null,
    clientId: r["client-id"] || null,
    activeAddress: r["active-address"] || null,
    activeMacAddress: normMac(r["active-mac-address"]),
    dynamic: r.dynamic === "true",
  }));
}
