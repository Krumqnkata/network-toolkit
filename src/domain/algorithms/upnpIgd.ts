/**
 * Reading a router's UPnP port forwards (Internet Gateway Device protocol):
 * find the WAN connection service in the device description, then ask for
 * mapping 0, 1, 2… until the router says there are no more. Read-only:
 * nothing is ever added or removed. Pure, unit-tested.
 */
import { decodeEntities } from './fingerprint';

export interface WanService {
  serviceType: string;
  /** Absolute URL of the SOAP control endpoint. */
  controlUrl: string;
}

export interface PortMapping {
  protocol: string;
  externalPort: number;
  internalClient: string;
  internalPort: number;
  description: string | null;
  enabled: boolean;
  /** Remote host restriction; empty = anyone on the internet. */
  remoteHost: string | null;
}

const tag = (xml: string, name: string) =>
  new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i')
    .exec(xml)?.[1]
    ?.trim() ?? null;

/** WANIPConnection / WANPPPConnection service from a device description. */
export function findWanService(xml: string, location: string): WanService | null {
  const base = tag(xml, 'URLBase') ?? location;
  for (const block of xml.match(/<service>[\s\S]*?<\/service>/gi) ?? []) {
    const serviceType = tag(block, 'serviceType');
    const control = tag(block, 'controlURL');
    if (!serviceType || !control) continue;
    if (!/WAN(IP|PPP)Connection/i.test(serviceType)) continue;
    const controlUrl = resolveUrl(decodeEntities(control), base);
    return controlUrl ? { serviceType, controlUrl } : null;
  }
  return null;
}

/**
 * Resolves a reference against an http(s) base URL. React Native's `URL`
 * only appends paths to the base, which breaks `/ctl/IPConn` style links.
 */
export function resolveUrl(ref: string, base: string): string | null {
  if (/^https?:\/\//i.test(ref)) return ref;
  const origin = /^(https?:\/\/[^/?#]+)/i.exec(base)?.[1];
  if (!origin) return null;
  if (ref.startsWith('/')) return origin + ref;
  const path = base.slice(origin.length).split(/[?#]/)[0] ?? '';
  const directory = path.slice(0, path.lastIndexOf('/') + 1) || '/';
  return origin + directory + ref;
}

/** `http://192.168.1.1:5000/ctl/IPConn` → host, port and path. */
export function splitUrl(url: string): { host: string; port: number; path: string } | null {
  const match = /^http:\/\/([^/:?#]+)(?::(\d+))?(\/[^#]*)?/i.exec(url);
  if (!match) return null;
  return { host: match[1]!, port: match[2] ? Number(match[2]) : 80, path: match[3] ?? '/' };
}

/** Raw HTTP request for GetGenericPortMappingEntry(index); fits the 1 KB banner payload. */
export function portMappingRequest(service: WanService, index: number): string {
  const target = splitUrl(service.controlUrl);
  const body =
    '<?xml version="1.0"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
    `<s:Body><u:GetGenericPortMappingEntry xmlns:u="${service.serviceType}">` +
    `<NewPortMappingIndex>${index}</NewPortMappingIndex>` +
    '</u:GetGenericPortMappingEntry></s:Body></s:Envelope>';
  return (
    `POST ${target?.path ?? '/'} HTTP/1.1\r\n` +
    `Host: ${target ? `${target.host}:${target.port}` : ''}\r\n` +
    'Content-Type: text/xml; charset="utf-8"\r\n' +
    `SOAPAction: "${service.serviceType}#GetGenericPortMappingEntry"\r\n` +
    `Content-Length: ${body.length}\r\n` +
    'Connection: close\r\n\r\n' +
    body
  );
}

/**
 * One mapping from the SOAP reply, or null when the list has ended (error
 * 713 SpecifiedArrayIndexInvalid, or any other fault).
 */
export function parsePortMapping(reply: string): PortMapping | null {
  if (/<(?:\w+:)?Fault\b/i.test(reply) || !/GetGenericPortMappingEntryResponse/i.test(reply)) {
    return null;
  }
  const externalPort = Number(tag(reply, 'NewExternalPort'));
  const internalPort = Number(tag(reply, 'NewInternalPort'));
  const internalClient = tag(reply, 'NewInternalClient') ?? '';
  if (!Number.isInteger(externalPort) || externalPort <= 0) return null;
  const description = tag(reply, 'NewPortMappingDescription');
  const remoteHost = tag(reply, 'NewRemoteHost');
  return {
    protocol: (tag(reply, 'NewProtocol') ?? 'TCP').toUpperCase(),
    externalPort,
    internalClient,
    internalPort: Number.isInteger(internalPort) ? internalPort : externalPort,
    description: description ? decodeEntities(description).slice(0, 60) : null,
    enabled: tag(reply, 'NewEnabled') !== '0',
    remoteHost: remoteHost || null,
  };
}
