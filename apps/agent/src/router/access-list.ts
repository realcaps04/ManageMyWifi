import type { WirelessStack } from "@wifi-control/shared-types";
import { RouterClient } from "./router-client";
import { RULE_NAMESPACE } from "../security/allowlist";
import { logger } from "../utils/logger";

function normMac(mac: string) {
  return mac.toUpperCase().replace(/-/g, ":");
}

async function listAccessEntries(
  client: RouterClient,
  stack: WirelessStack
): Promise<Record<string, string>[]> {
  const path =
    stack === "wireless"
      ? "/interface/wireless/access-list"
      : "/interface/wifi/access-list";
  try {
    const rows = await client.get<Record<string, string>[]>(path);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    // Fallback to the other stack if detection was wrong
    const alt =
      path.includes("/wifi/")
        ? "/interface/wireless/access-list"
        : "/interface/wifi/access-list";
    try {
      const rows = await client.get<Record<string, string>[]>(alt);
      return Array.isArray(rows) ? rows : [];
    } catch (err2) {
      logger.warn({ err, err2 }, "Unable to read wireless access-list");
      return [];
    }
  }
}

function accessPath(stack: WirelessStack) {
  return stack === "wireless"
    ? "/interface/wireless/access-list"
    : "/interface/wifi/access-list";
}

export async function denyWifiMac(
  client: RouterClient,
  stack: WirelessStack,
  mac: string,
  deviceId: string
) {
  const macN = normMac(mac);
  const comment = `${RULE_NAMESPACE}:deny:${deviceId}`;
  const path = accessPath(stack);
  const existing = await listAccessEntries(client, stack);
  const hit = existing.find(
    (r) =>
      normMac(r["mac-address"] || r.mac || "") === macN ||
      (r.comment || "").includes(comment)
  );
  if (!hit) {
    try {
      await client.put(path, {
        "mac-address": macN,
        action: "reject",
        comment,
        disabled: "false",
      });
    } catch {
      // Legacy wireless uses allow=false style on some versions
      await client.put(path, {
        "mac-address": macN,
        authentication: "no",
        forwarding: "no",
        comment,
      });
    }
  }

  const verified = (await listAccessEntries(client, stack)).some(
    (r) =>
      normMac(r["mac-address"] || r.mac || "") === macN ||
      (r.comment || "").includes(comment)
  );
  return { verified, mac: macN, comment };
}

export async function allowWifiMac(
  client: RouterClient,
  stack: WirelessStack,
  mac: string,
  deviceId: string
) {
  const macN = normMac(mac);
  const comment = `${RULE_NAMESPACE}:deny:${deviceId}`;
  const path = accessPath(stack);
  const existing = await listAccessEntries(client, stack);
  const matches = existing.filter(
    (r) =>
      normMac(r["mac-address"] || r.mac || "") === macN ||
      (r.comment || "").includes(comment)
  );
  for (const row of matches) {
    if (row[".id"]) await client.delete(`${path}/${row[".id"]}`);
  }
  const still = (await listAccessEntries(client, stack)).some(
    (r) =>
      normMac(r["mac-address"] || r.mac || "") === macN &&
      (r.comment || "").includes(RULE_NAMESPACE)
  );
  return { verified: !still, mac: macN };
}

export async function disconnectWifiClient(
  client: RouterClient,
  stack: WirelessStack,
  mac: string
) {
  const macN = normMac(mac);
  const regPath =
    stack === "wireless"
      ? "/interface/wireless/registration-table"
      : "/interface/wifi/registration-table";

  let rows: Record<string, string>[] = [];
  try {
    rows = (await client.get(regPath)) as Record<string, string>[];
  } catch {
    rows = (await client
      .get("/interface/wireless/registration-table")
      .catch(() => [])) as Record<string, string>[];
  }
  if (!Array.isArray(rows)) rows = [];

  const hit = rows.find(
    (r) => normMac(r["mac-address"] || r.mac || "") === macN
  );
  if (!hit?.[".id"]) {
    return { verified: true, disconnected: false, reason: "not_associated" };
  }

  await client.delete(`${regPath}/${hit[".id"]}`);
  const still = (
    (await client.get<Record<string, string>[]>(regPath).catch(() => [])) || []
  ).some((r) => normMac(r["mac-address"] || r.mac || "") === macN);

  return { verified: !still, disconnected: true, mac: macN };
}
