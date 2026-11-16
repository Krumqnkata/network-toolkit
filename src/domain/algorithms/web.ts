import type { HttpHeader } from '../models/netTools';

/** Adds `https://` when the user typed a bare host such as `example.com/path`. */
export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (value === '') return value;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * Extracts host and port from `host`, `host:port`, `[v6]:port` or a full URL.
 * Returns null for input that has no host.
 */
export function parseHostPort(input: string): { host: string; port: number | null } | null {
  let value = input.trim();
  if (value === '') return null;
  const scheme = value.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  let defaultPort: number | null = null;
  if (scheme) {
    const name = (scheme[1] ?? '').toLowerCase();
    defaultPort = name === 'https' ? 443 : name === 'http' ? 80 : null;
    value = value.slice(scheme[0].length);
  }
  value = value.split(/[/?#]/)[0] ?? '';
  value = value.slice(value.lastIndexOf('@') + 1);
  const bracketed = value.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketed) {
    return { host: bracketed[1] ?? '', port: bracketed[2] ? Number(bracketed[2]) : defaultPort };
  }
  // More than one colon without brackets: a bare IPv6 address.
  if ((value.match(/:/g) ?? []).length > 1) return { host: value, port: defaultPort };
  const [host = '', port] = value.split(':');
  if (host === '') return null;
  return { host, port: port ? Number(port) : defaultPort };
}

export type StatusTone = 'success' | 'info' | 'warning' | 'danger';

export function httpStatusTone(status: number): StatusTone {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  return 'danger';
}

/** Response headers that harden a site, checked on the final response. */
export const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
] as const;

export type SecurityHeader = (typeof SECURITY_HEADERS)[number];

export function securityHeaders(
  headers: readonly HttpHeader[],
): { name: SecurityHeader; present: boolean }[] {
  const names = new Set(headers.map(header => header.name.toLowerCase()));
  return SECURITY_HEADERS.map(name => ({ name, present: names.has(name) }));
}

/** Splits a distinguished name on commas that are not escaped with a backslash. */
function splitDn(dn: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < dn.length; i++) {
    const char = dn[i] as string;
    if (char === '\\' && i + 1 < dn.length) {
      current += char + (dn[i + 1] as string);
      i++;
    } else if (char === ',') {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

/** Value of one attribute (e.g. `CN`) in an RFC 2253 distinguished name. */
export function dnAttribute(dn: string, attribute: string): string | null {
  for (const part of splitDn(dn)) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim().toUpperCase() === attribute.toUpperCase()) {
      return part
        .slice(index + 1)
        .trim()
        .replace(/\\(.)/g, '$1');
    }
  }
  return null;
}

/** A short display name for a certificate subject or issuer. */
export function dnDisplayName(dn: string): string {
  return dnAttribute(dn, 'CN') ?? dnAttribute(dn, 'O') ?? dn;
}

const DAY_MS = 86_400_000;

export function daysUntil(timestamp: number, now: number): number {
  return Math.floor((timestamp - now) / DAY_MS);
}

export type CertificateValidity = 'valid' | 'expiring' | 'expired' | 'not-yet-valid';

/** `expiring` = valid for fewer than 30 more days. */
export function certificateValidity(
  notBefore: number,
  notAfter: number,
  now: number,
): CertificateValidity {
  if (now < notBefore) return 'not-yet-valid';
  if (now > notAfter) return 'expired';
  return daysUntil(notAfter, now) < 30 ? 'expiring' : 'valid';
}
