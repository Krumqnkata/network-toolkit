import { z } from 'zod';

import { toAppError } from '../utils/errors';
import { parseNative } from './netTools';
import { ensureLocalNetworkFor } from '../services/permissions/localNetworkPermission';
import NativeLanModule from './specs/NativeLanModule';

const hostProbeSchema = z.object({
  address: z.string(),
  alive: z.boolean(),
  method: z.enum(['tcp', 'icmp']).nullable(),
  rttMs: z.number().nonnegative().nullable(),
  openPorts: z.array(z.number().int()),
});

export type HostProbe = z.infer<typeof hostProbeSchema>;

const netbiosSchema = z.object({
  address: z.string(),
  name: z.string().nullable(),
  workgroup: z.string().nullable(),
  mac: z.string().nullable(),
});

export type NetbiosInfo = z.infer<typeof netbiosSchema>;

const mdnsRecordSchema = z.object({
  name: z.string(),
  type: z.number().int(),
  ttl: z.number().nonnegative(),
  data: z.string(),
});

const mdnsReplySchema = z.object({ from: z.string(), records: z.array(mdnsRecordSchema) });

export type MdnsReply = z.infer<typeof mdnsReplySchema>;

const ssdpReplySchema = z.object({
  from: z.string(),
  server: z.string().nullable(),
  location: z.string().nullable(),
  st: z.string().nullable(),
  usn: z.string().nullable(),
});

export type SsdpReply = z.infer<typeof ssdpReplySchema>;

const portResultSchema = z.object({
  port: z.number().int(),
  status: z.enum(['open', 'refused', 'timeout', 'unreachable']),
  connectMs: z.number().nonnegative().nullable(),
});

export type PortResult = z.infer<typeof portResultSchema>;

async function call<T>(schema: z.ZodType<T>, what: string, fn: () => Promise<unknown>): Promise<T> {
  let raw: unknown;
  try {
    raw = await fn();
  } catch (error) {
    throw toAppError(error);
  }
  return parseNative(schema, raw, what);
}

export async function probeHosts(
  hosts: string[],
  ports: number[],
  timeoutMs: number,
  icmp: boolean,
): Promise<HostProbe[]> {
  const result = await call(z.object({ hosts: z.array(hostProbeSchema) }), 'host probe', () =>
    NativeLanModule.probeHosts(hosts, ports, timeoutMs, icmp),
  );
  return result.hosts;
}

export async function netbiosQuery(hosts: string[], timeoutMs = 1500): Promise<NetbiosInfo[]> {
  const result = await call(z.object({ hosts: z.array(netbiosSchema) }), 'NetBIOS', () =>
    NativeLanModule.netbiosQuery(hosts, timeoutMs),
  );
  return result.hosts;
}

export async function mdnsQuery(
  localAddress: string,
  questions: readonly { name: string; type: number }[],
  durationMs = 1500,
): Promise<MdnsReply[]> {
  const result = await call(z.object({ replies: z.array(mdnsReplySchema) }), 'mDNS', () =>
    NativeLanModule.mdnsQuery(
      localAddress,
      questions.map(question => question.name),
      questions.map(question => question.type),
      durationMs,
    ),
  );
  return result.replies;
}

export async function ssdpSearch(localAddress: string, durationMs = 2500): Promise<SsdpReply[]> {
  const result = await call(z.object({ replies: z.array(ssdpReplySchema) }), 'SSDP', () =>
    NativeLanModule.ssdpSearch(localAddress, durationMs),
  );
  return result.replies;
}

export async function scanPorts(
  host: string,
  ports: number[],
  timeoutMs: number,
): Promise<{ address: string; ports: PortResult[] }> {
  await ensureLocalNetworkFor(host);
  return call(
    z.object({ address: z.string(), ports: z.array(portResultSchema) }),
    'port scan',
    () => NativeLanModule.scanPorts(host, ports, timeoutMs),
  );
}

const bannerSchema = z.object({
  address: z.string(),
  port: z.number().int(),
  text: z.string(),
  bytes: z.number().int().nonnegative(),
  connectMs: z.number().nonnegative(),
});

export type Banner = z.infer<typeof bannerSchema>;

/** Greeting or reply of a service on a local device (SSH, HTTP…). Private addresses only. */
export function readBanner(
  host: string,
  port: number,
  payload = '',
  options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<Banner> {
  const { maxBytes = 4096, timeoutMs = 2000 } = options;
  return call(bannerSchema, 'banner', () =>
    NativeLanModule.readBanner(host, port, payload, maxBytes, timeoutMs),
  );
}
