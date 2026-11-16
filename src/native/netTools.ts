import { z } from 'zod';

import type {
  AddressFamily,
  DnsQueryResult,
  HttpResult,
  PingProbe,
  TcpConnectResult,
  TlsResult,
} from '../domain/models/netTools';
import { AppError, toAppError } from '../utils/errors';
import NativeNetToolsModule from './specs/NativeNetToolsModule';

const familySchema = z.enum(['ipv4', 'ipv6']);

export const pingProbeSchema = z.object({
  address: z.string(),
  family: familySchema,
  method: z.enum(['icmp', 'tcp']),
  status: z.enum(['reply', 'timeout', 'ttl-exceeded', 'unreachable']),
  rttMs: z.number().nonnegative().nullable(),
  ttl: z.number().int().nullable(),
  from: z.string().nullable(),
}) satisfies z.ZodType<PingProbe>;

const dnsRecordSchema = z.object({
  name: z.string(),
  type: z.number().int(),
  ttl: z.number().nonnegative(),
  data: z.string(),
});

export const dnsQueryResultSchema = z.object({
  server: z.string(),
  durationMs: z.number().nonnegative(),
  rcode: z.number().int(),
  authoritative: z.boolean(),
  truncated: z.boolean(),
  answers: z.array(dnsRecordSchema),
  authority: z.array(dnsRecordSchema),
}) satisfies z.ZodType<DnsQueryResult>;

export const tcpConnectResultSchema = z.object({
  address: z.string(),
  family: familySchema,
  status: z.enum(['open', 'refused', 'timeout', 'unreachable']),
  connectMs: z.number().nonnegative().nullable(),
  message: z.string().nullable(),
}) satisfies z.ZodType<TcpConnectResult>;

export const httpResultSchema = z.object({
  hops: z.array(
    z.object({
      url: z.string(),
      status: z.number().int(),
      statusText: z.string(),
      protocol: z.string().nullable(),
      cipherSuite: z.string().nullable(),
      durationMs: z.number().nonnegative(),
      headers: z.array(z.object({ name: z.string(), value: z.string() })),
    }),
  ),
}) satisfies z.ZodType<HttpResult>;

export const tlsResultSchema = z.object({
  address: z.string(),
  protocol: z.string(),
  cipherSuite: z.string(),
  handshakeMs: z.number().nonnegative(),
  trusted: z.boolean(),
  trustError: z.string().nullable(),
  hostnameMatches: z.boolean(),
  chain: z.array(
    z.object({
      subject: z.string(),
      issuer: z.string(),
      serialNumber: z.string(),
      notBefore: z.number(),
      notAfter: z.number(),
      signatureAlgorithm: z.string(),
      publicKeyAlgorithm: z.string(),
      publicKeyBits: z.number().int().nullable(),
      subjectAltNames: z.array(z.string()),
      isCa: z.boolean(),
      sha256: z.string(),
    }),
  ),
}) satisfies z.ZodType<TlsResult>;

/** Validates untyped native data against a schema. */
export function parseNative<T>(schema: z.ZodType<T>, raw: unknown, what: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError(
      'invalid-native-data',
      `Unexpected ${what} result from native code: ${z.prettifyError(result.error)}`,
      result.error,
    );
  }
  return result.data;
}

async function call<T>(schema: z.ZodType<T>, what: string, fn: () => Promise<unknown>): Promise<T> {
  let raw: unknown;
  try {
    raw = await fn();
  } catch (error) {
    throw toAppError(error);
  }
  return parseNative(schema, raw, what);
}

export interface PingOptions {
  family?: AddressFamily;
  /** Hop limit; 0 = system default. Values > 0 are used by traceroute (IPv4 only). */
  ttl?: number;
  timeoutMs?: number;
}

export function ping(host: string, options: PingOptions = {}): Promise<PingProbe> {
  const { family = 'any', ttl = 0, timeoutMs = 2000 } = options;
  return call(pingProbeSchema, 'ping', () =>
    NativeNetToolsModule.ping(host, family, ttl, timeoutMs),
  );
}

/** `server` = IP address of a DNS server, or `null` for the system resolver. */
export function dnsQuery(
  name: string,
  recordType: number,
  server: string | null = null,
  timeoutMs = 5000,
): Promise<DnsQueryResult> {
  return call(dnsQueryResultSchema, 'DNS', () =>
    NativeNetToolsModule.dnsQuery(name, recordType, server ?? '', timeoutMs),
  );
}

export function tcpConnect(
  host: string,
  port: number,
  family: AddressFamily = 'any',
  timeoutMs = 3000,
): Promise<TcpConnectResult> {
  return call(tcpConnectResultSchema, 'TCP', () =>
    NativeNetToolsModule.tcpConnect(host, port, family, timeoutMs),
  );
}

export function httpRequest(
  url: string,
  method: 'HEAD' | 'GET' = 'HEAD',
  maxRedirects = 10,
  timeoutMs = 10_000,
): Promise<HttpResult> {
  return call(httpResultSchema, 'HTTP', () =>
    NativeNetToolsModule.httpRequest(url, method, maxRedirects, timeoutMs),
  );
}

export function tlsInspect(host: string, port = 443, timeoutMs = 10_000): Promise<TlsResult> {
  return call(tlsResultSchema, 'TLS', () => NativeNetToolsModule.tlsInspect(host, port, timeoutMs));
}
