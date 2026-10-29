import type { WirelessStack, WifiNetworkInfo } from "@wifi-control/shared-types";
import { RouterClient } from "./router-client";
import { logger } from "../utils/logger";

function pickPassphrase(row: Record<string, string> | undefined): string | null {
  if (!row) return null;
  const keys = [
    "passphrase",
    "wpa2-pre-shared-key",
    "wpa-pre-shared-key",
    "wpa3-pre-shared-key",
  ];
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

type PassphraseIndex = {
  bySecurity: Map<string, string>;
  byConfig: Map<string, string>;
  bySsid: Map<string, string>;
};

async function wifiwave2Index(client: RouterClient): Promise<PassphraseIndex> {
  const bySecurity = new Map<string, string>();
  const byConfig = new Map<string, string>();
  const bySsid = new Map<string, string>();

  try {
    const securities = await client.get<Record<string, string>[]>(
      "/interface/wifi/security"
    );
    if (Array.isArray(securities)) {
      for (const sec of securities) {
        const pass = pickPassphrase(sec);
        if (sec.name && pass) bySecurity.set(sec.name, pass);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to read /interface/wifi/security");
  }

  try {
    const configs = await client.get<Record<string, string>[]>(
      "/interface/wifi/configuration"
    );
    if (Array.isArray(configs)) {
      for (const cfg of configs) {
        const securityName = cfg.security;
        const pass =
          pickPassphrase(cfg) ||
          (securityName ? bySecurity.get(securityName) : undefined) ||
          null;
        if (!pass) continue;
        if (cfg.name) byConfig.set(cfg.name, pass);
        if (cfg.ssid) bySsid.set(cfg.ssid.toLowerCase(), pass);
      }
    }
  } catch {
    /* optional */
  }

  return { bySecurity, byConfig, bySsid };
}

async function legacyWirelessIndex(
  client: RouterClient
): Promise<PassphraseIndex> {
  const bySecurity = new Map<string, string>();
  const byConfig = new Map<string, string>();
  const bySsid = new Map<string, string>();

  try {
    const profiles = await client.get<Record<string, string>[]>(
      "/interface/wireless/security-profiles"
    );
    if (Array.isArray(profiles)) {
      for (const profile of profiles) {
        const pass = pickPassphrase(profile);
        if (profile.name && pass) bySecurity.set(profile.name, pass);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to read wireless security-profiles");
  }

  return { bySecurity, byConfig, bySsid };
}

function resolvePassphrase(
  index: PassphraseIndex,
  opts: {
    ssid: string | null;
    configName?: string | null;
    securityName?: string | null;
  }
): string | null {
  if (opts.securityName && index.bySecurity.has(opts.securityName)) {
    return index.bySecurity.get(opts.securityName) ?? null;
  }
  if (opts.configName && index.byConfig.has(opts.configName)) {
    return index.byConfig.get(opts.configName) ?? null;
  }
  if (opts.ssid) {
    return index.bySsid.get(opts.ssid.toLowerCase()) ?? null;
  }
  return null;
}

export async function discoverWifiInterfaces(
  client: RouterClient,
  stack: WirelessStack
): Promise<WifiNetworkInfo[]> {
  const networks: WifiNetworkInfo[] = [];

  if (stack === "wifi" || stack === "unknown") {
    try {
      const index = await wifiwave2Index(client);
      const ifaces = await client.get<Record<string, string>[]>("/interface/wifi");
      const regs = await client
        .get<Record<string, string>[]>("/interface/wifi/registration-table")
        .catch(() => [] as Record<string, string>[]);

      if (Array.isArray(ifaces)) {
        for (const iface of ifaces) {
          const name = iface.name || iface[".id"] || "wifi";
          const clientCount = Array.isArray(regs)
            ? regs.filter((r) => (r.interface || "") === name).length
            : 0;
          const ssid = iface["configuration.ssid"] || iface.ssid || null;
          const configName =
            iface.configuration || iface["configuration"] || name;
          const securityName =
            iface.security || iface["configuration.security"] || null;
          networks.push({
            interface_name: name,
            ssid,
            band: iface.band || iface["channel.band"] || null,
            channel: iface.channel || iface["channel.frequency"] || null,
            frequency: iface.frequency || null,
            running: iface.running === "true",
            disabled: iface.disabled === "true",
            mode: iface.mode || "ap",
            clients: clientCount,
            passphrase: resolvePassphrase(index, {
              ssid,
              configName,
              securityName,
            }),
          });
        }
      }

      try {
        const configs = await client.get<Record<string, string>[]>(
          "/interface/wifi/configuration"
        );
        if (Array.isArray(configs)) {
          for (const cfg of configs) {
            const name = cfg.name;
            const ssid = cfg.ssid;
            if (!name || !ssid) continue;
            const pass = resolvePassphrase(index, {
              ssid,
              configName: name,
              securityName: cfg.security || null,
            });
            const hit = networks.find((n) => n.interface_name === name);
            if (hit) {
              if (!hit.ssid) hit.ssid = ssid;
              if (!hit.passphrase && pass) hit.passphrase = pass;
            } else {
              networks.push({
                interface_name: name,
                ssid,
                band: null,
                channel: null,
                frequency: null,
                running: false,
                disabled: cfg.disabled === "true",
                mode: "ap",
                clients: 0,
                passphrase: pass,
              });
            }
          }
        }
      } catch {
        /* optional */
      }
    } catch (err) {
      if (stack === "wifi") {
        logger.warn({ err }, "Failed to read /interface/wifi");
      }
    }
  }

  if (networks.length === 0 && (stack === "wireless" || stack === "unknown")) {
    try {
      const index = await legacyWirelessIndex(client);
      const ifaces = await client.get<Record<string, string>[]>(
        "/interface/wireless"
      );
      const regs = await client
        .get<Record<string, string>[]>(
          "/interface/wireless/registration-table"
        )
        .catch(() => [] as Record<string, string>[]);

      if (Array.isArray(ifaces)) {
        for (const iface of ifaces) {
          const name = iface.name || "wlan";
          const clientCount = Array.isArray(regs)
            ? regs.filter((r) => (r.interface || "") === name).length
            : 0;
          const ssid = iface.ssid || null;
          const securityName = iface["security-profile"] || null;
          const pass = resolvePassphrase(index, {
            ssid,
            securityName,
          });
          if (ssid && pass) index.bySsid.set(ssid.toLowerCase(), pass);
          networks.push({
            interface_name: name,
            ssid,
            band: iface.band || null,
            channel: iface["channel"] || null,
            frequency: iface.frequency || null,
            running: iface.running === "true",
            disabled: iface.disabled === "true",
            mode: iface.mode || null,
            clients: clientCount,
            passphrase: pass,
          });
        }
      }
    } catch (err) {
      logger.warn({ err }, "Failed to read /interface/wireless");
    }
  }

  logger.info(
    {
      networks: networks.length,
      withPassphrase: networks.filter((n) => n.passphrase).length,
    },
    "Discovered WiFi interfaces"
  );

  return networks;
}
