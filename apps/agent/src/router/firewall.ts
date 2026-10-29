import { RouterClient } from "./router-client";
import {
  ADDRESS_LIST_BLOCK,
  ADDRESS_LIST_SUSPEND,
  RULE_NAMESPACE,
} from "../security/allowlist";
import { logger } from "../utils/logger";

async function listEntries(client: RouterClient, list: string) {
  const rows = await client.get<Record<string, string>[]>(
    `/ip/firewall/address-list?list=${encodeURIComponent(list)}`
  );
  return Array.isArray(rows) ? rows : [];
}

async function ensureAddressListEntry(
  client: RouterClient,
  list: string,
  address: string,
  comment: string
) {
  const existing = await listEntries(client, list);
  const hit = existing.find(
    (r) =>
      (r.address || "").toLowerCase() === address.toLowerCase() ||
      (r.comment || "").includes(comment)
  );
  if (hit) return { id: hit[".id"], created: false };

  const created = await client.put<Record<string, string>>(
    "/ip/firewall/address-list",
    {
      list,
      address,
      comment,
    }
  );
  return { id: created?.[".id"], created: true };
}

async function removeAddressListEntry(
  client: RouterClient,
  list: string,
  address: string,
  commentMarker: string
) {
  const existing = await listEntries(client, list);
  const matches = existing.filter(
    (r) =>
      (r.address || "").toLowerCase() === address.toLowerCase() ||
      (r.comment || "").includes(commentMarker)
  );
  for (const row of matches) {
    if (row[".id"]) {
      await client.delete(`/ip/firewall/address-list/${row[".id"]}`);
    }
  }
  return matches.length;
}

/** Ensure drop rules for managed address lists exist (idempotent). */
export async function ensureManagedFirewallRules(client: RouterClient) {
  const rules = await client.get<Record<string, string>[]>(
    "/ip/firewall/filter"
  );
  const list = Array.isArray(rules) ? rules : [];

  async function ensureDrop(listName: string, comment: string) {
    const exists = list.some((r) => (r.comment || "") === comment);
    if (exists) return;
    await client.put("/ip/firewall/filter", {
      chain: "forward",
      action: "drop",
      "src-address-list": listName,
      comment,
    });
    logger.info({ listName }, "Created managed firewall drop rule");
  }

  await ensureDrop(
    ADDRESS_LIST_SUSPEND,
    `${RULE_NAMESPACE}:drop-suspend`
  );
  await ensureDrop(ADDRESS_LIST_BLOCK, `${RULE_NAMESPACE}:drop-block`);
}

export async function suspendAddress(
  client: RouterClient,
  address: string,
  deviceId: string
) {
  await ensureManagedFirewallRules(client);
  const comment = `${RULE_NAMESPACE}:suspend:${deviceId}`;
  await ensureAddressListEntry(client, ADDRESS_LIST_SUSPEND, address, comment);
  const verified = (await listEntries(client, ADDRESS_LIST_SUSPEND)).some(
    (r) =>
      (r.address || "").toLowerCase() === address.toLowerCase() ||
      (r.comment || "").includes(comment)
  );
  return { verified, address, list: ADDRESS_LIST_SUSPEND };
}

export async function resumeAddress(
  client: RouterClient,
  address: string,
  deviceId: string
) {
  const comment = `${RULE_NAMESPACE}:suspend:${deviceId}`;
  await removeAddressListEntry(client, ADDRESS_LIST_SUSPEND, address, comment);
  const stillThere = (await listEntries(client, ADDRESS_LIST_SUSPEND)).some(
    (r) =>
      (r.address || "").toLowerCase() === address.toLowerCase() ||
      (r.comment || "").includes(comment)
  );
  return { verified: !stillThere, address };
}

export async function blockAddressFirewall(
  client: RouterClient,
  address: string,
  deviceId: string
) {
  await ensureManagedFirewallRules(client);
  const comment = `${RULE_NAMESPACE}:block:${deviceId}`;
  await ensureAddressListEntry(client, ADDRESS_LIST_BLOCK, address, comment);
  const verified = (await listEntries(client, ADDRESS_LIST_BLOCK)).some(
    (r) =>
      (r.address || "").toLowerCase() === address.toLowerCase() ||
      (r.comment || "").includes(comment)
  );
  return { verified, address, list: ADDRESS_LIST_BLOCK };
}

export async function unblockAddressFirewall(
  client: RouterClient,
  address: string,
  deviceId: string
) {
  const comment = `${RULE_NAMESPACE}:block:${deviceId}`;
  await removeAddressListEntry(client, ADDRESS_LIST_BLOCK, address, comment);
  const stillThere = (await listEntries(client, ADDRESS_LIST_BLOCK)).some(
    (r) =>
      (r.address || "").toLowerCase() === address.toLowerCase() ||
      (r.comment || "").includes(comment)
  );
  return { verified: !stillThere, address };
}
