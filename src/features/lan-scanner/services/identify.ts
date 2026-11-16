import type { LanDevice } from '../../../domain/algorithms/devices';
import {
  osFromTtl,
  parseHttpBanner,
  parseSshBanner,
  type Fingerprint,
  type HttpBanner,
  type SshBanner,
} from '../../../domain/algorithms/fingerprint';
import { macVendor } from '../../../domain/algorithms/vendor';
import { readBanner } from '../../../native/lan';
import { ping, tlsInspect } from '../../../native/netTools';

const TIMEOUT_MS = 2000;

/** A plain request that every web server answers, including tiny embedded ones. */
export function httpRequestText(host: string): string {
  return (
    `GET / HTTP/1.0\r\nHost: ${host}\r\n` +
    'User-Agent: NetworkToolkit (device identification)\r\n' +
    'Accept: text/html\r\nConnection: close\r\n\r\n'
  );
}

async function pingTtl(address: string): Promise<number | null> {
  try {
    const reply = await ping(address, { family: 'ipv4', timeoutMs: 1000 });
    return reply.status === 'reply' ? reply.ttl : null;
  } catch {
    return null;
  }
}

async function http(address: string, port: number): Promise<HttpBanner | null> {
  try {
    const banner = await readBanner(address, port, httpRequestText(address), {
      maxBytes: 8192,
      timeoutMs: TIMEOUT_MS,
    });
    return parseHttpBanner(banner.text);
  } catch {
    return null;
  }
}

async function ssh(address: string): Promise<SshBanner | null> {
  try {
    const banner = await readBanner(address, 22, '', { maxBytes: 256, timeoutMs: TIMEOUT_MS });
    return parseSshBanner(banner.text);
  } catch {
    return null;
  }
}

async function tls(address: string): Promise<{ subject: string; issuer: string } | null> {
  try {
    const result = await tlsInspect(address, 443, TIMEOUT_MS + 500);
    const leaf = result.chain[0];
    return leaf ? { subject: leaf.subject, issuer: leaf.issuer } : null;
  } catch {
    return null;
  }
}

/**
 * Asks one device about itself, using only the ports the scan found open.
 * Every probe is optional: a failure just leaves that part empty.
 */
export async function identifyDevice(device: LanDevice): Promise<Fingerprint> {
  const ports = new Set(device.openPorts);
  const webPort = ports.has(80) ? 80 : ports.has(8080) ? 8080 : null;
  const [ttl, httpBanner, sshBanner, certificate] = await Promise.all([
    pingTtl(device.address),
    webPort ? http(device.address, webPort) : Promise.resolve(null),
    ports.has(22) ? ssh(device.address) : Promise.resolve(null),
    ports.has(443) ? tls(device.address) : Promise.resolve(null),
  ]);
  return {
    ttl,
    os: osFromTtl(ttl),
    http: httpBanner,
    ssh: sshBanner,
    tlsSubject: certificate?.subject ?? null,
    tlsIssuer: certificate?.issuer ?? null,
    vendor: macVendor(device.mac),
  };
}
