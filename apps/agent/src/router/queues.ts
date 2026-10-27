import { MikroTikClient } from "./mikrotik-client";
import { QUEUE_PREFIX, RULE_NAMESPACE } from "../security/allowlist";

function queueName(deviceId: string) {
  return `${QUEUE_PREFIX}${deviceId.replace(/-/g, "").slice(0, 16)}`;
}

function rate(mbps: number) {
  // RouterOS prefers bits; use M suffix for Mbps
  return `${mbps}M`;
}

export async function setSimpleQueue(
  client: MikroTikClient,
  opts: {
    deviceId: string;
    target: string;
    downloadMbps: number;
    uploadMbps: number;
  }
) {
  const name = queueName(opts.deviceId);
  const comment = `${RULE_NAMESPACE}:queue:${opts.deviceId}`;
  const existing = await client.get<Record<string, string>[]>("/queue/simple");
  const rows = Array.isArray(existing) ? existing : [];
  const hit = rows.find((r) => r.name === name || (r.comment || "") === comment);

  const body = {
    name,
    target: opts.target,
    "max-limit": `${rate(opts.uploadMbps)}/${rate(opts.downloadMbps)}`,
    comment,
  };

  if (hit?.[".id"]) {
    await client.patch(`/queue/simple/${hit[".id"]}`, body);
  } else {
    await client.put("/queue/simple", body);
  }

  const after = await client.get<Record<string, string>[]>("/queue/simple");
  const verified = (Array.isArray(after) ? after : []).some(
    (r) => r.name === name || (r.comment || "") === comment
  );
  return { verified, queue: name, target: opts.target };
}

export async function removeSimpleQueue(
  client: MikroTikClient,
  deviceId: string
) {
  const name = queueName(deviceId);
  const comment = `${RULE_NAMESPACE}:queue:${deviceId}`;
  const existing = await client.get<Record<string, string>[]>("/queue/simple");
  const rows = Array.isArray(existing) ? existing : [];
  const matches = rows.filter(
    (r) => r.name === name || (r.comment || "") === comment
  );
  for (const row of matches) {
    if (row[".id"]) await client.delete(`/queue/simple/${row[".id"]}`);
  }
  const after = await client.get<Record<string, string>[]>("/queue/simple");
  const still = (Array.isArray(after) ? after : []).some(
    (r) => r.name === name || (r.comment || "") === comment
  );
  return { verified: !still, queue: name };
}
