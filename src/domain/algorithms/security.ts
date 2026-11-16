/**
 * Home network security check: turns what the app can observe without
 * logging in anywhere into findings with plain advice. Pure, unit-tested.
 */
import type { WifiSecurity } from '../models/network';
import type { PortMapping } from './upnpIgd';

export type SecuritySeverity = 'fail' | 'warn' | 'info' | 'pass' | 'skip';

export type SecurityCheckId =
  | 'encryption'
  | 'wps'
  | 'router-admin'
  | 'router-telnet'
  | 'router-ftp'
  | 'upnp'
  | 'port-forwards'
  | 'devices-telnet'
  | 'devices-ftp'
  | 'devices-remote'
  | 'private-dns';

export interface SecurityFinding {
  id: SecurityCheckId;
  severity: SecuritySeverity;
  /** Text values for the message, e.g. `{ level: 'WPA2' }`. */
  values: Record<string, string | number>;
  /** Devices, ports or mappings the finding is about. */
  items: string[];
}

export type PortState = 'open' | 'closed';

export interface SecurityInput {
  /** Current Wi-Fi network; null on Ethernet. */
  wifi: {
    security: WifiSecurity | null;
    /** Scan capabilities of the connected access point, e.g. `[WPA2-PSK-CCMP][WPS]`. */
    capabilities: string | null;
  } | null;
  /** Any access point of this network advertises WPS; null = unknown. */
  wps: boolean | null;
  /** Router TCP ports checked; null = the router could not be checked. */
  routerPorts: Record<number, PortState> | null;
  /** UPnP gateway on the router: null = not checked, mappings null = could not be read. */
  upnp: { found: boolean; mappings: PortMapping[] | null } | null;
  /** Devices from the last LAN scan with the risky ports found open; null = no scan. */
  devices: { name: string; address: string; openPorts: number[] }[] | null;
  privateDns: boolean;
}

export type SecurityScore = 'good' | 'fair' | 'risky';

export interface SecurityReport {
  score: SecurityScore;
  findings: SecurityFinding[];
}

/** Router ports the check looks at. */
export const ROUTER_PORTS = [21, 22, 23, 80, 443, 8080, 8443] as const;
/** Device ports that are risky on a home network. */
export const DEVICE_PORTS = [21, 23, 3389, 5900] as const;

const finding = (
  id: SecurityCheckId,
  severity: SecuritySeverity,
  values: SecurityFinding['values'] = {},
  items: string[] = [],
): SecurityFinding => ({ id, severity, values, items });

/** Encryption level of the network from Android's security type and the scan capabilities. */
export function encryptionLevel(
  security: WifiSecurity | null,
  capabilities: string | null,
): { level: string; severity: SecuritySeverity } | null {
  const caps = (capabilities ?? '').toUpperCase();
  const fromCaps = (): string | null => {
    if (!caps) return null;
    if (caps.includes('EAP')) return 'Enterprise';
    if (caps.includes('SAE')) return caps.includes('PSK') ? 'WPA2/WPA3' : 'WPA3';
    if (caps.includes('OWE')) return 'OWE';
    if (caps.includes('PSK')) return caps.includes('RSN') || caps.includes('WPA2') ? 'WPA2' : 'WPA';
    if (caps.includes('WEP')) return 'WEP';
    return 'open';
  };
  let level: string | null;
  switch (security) {
    case 'open':
      level = 'open';
      break;
    case 'wep':
      level = 'WEP';
      break;
    case 'wpa3-personal':
      level = fromCaps() === 'WPA2/WPA3' ? 'WPA2/WPA3' : 'WPA3';
      break;
    case 'owe':
      level = 'OWE';
      break;
    case 'wpa-enterprise':
    case 'wpa3-enterprise':
    case 'wpa3-enterprise-192':
      level = 'Enterprise';
      break;
    default:
      level = fromCaps() ?? (security === 'wpa-personal' ? 'WPA2' : null);
  }
  if (!level) return null;
  // TKIP without CCMP (AES) is broken even on WPA2.
  const tkipOnly = caps.includes('TKIP') && !caps.includes('CCMP');
  if (level === 'open' || level === 'WEP' || level === 'WPA') return { level, severity: 'fail' };
  if (tkipOnly) return { level: `${level} (TKIP)`, severity: 'warn' };
  return { level, severity: 'pass' };
}

export function evaluateSecurity(input: SecurityInput): SecurityReport {
  const findings: SecurityFinding[] = [];

  if (input.wifi) {
    const encryption = encryptionLevel(input.wifi.security, input.wifi.capabilities);
    findings.push(
      encryption
        ? finding('encryption', encryption.severity, { level: encryption.level })
        : finding('encryption', 'skip'),
    );
    findings.push(finding('wps', input.wps === null ? 'skip' : input.wps ? 'warn' : 'pass'));
  }

  const ports = input.routerPorts;
  if (ports) {
    const web = ports[80] === 'open' || ports[8080] === 'open';
    const https = ports[443] === 'open' || ports[8443] === 'open';
    findings.push(finding('router-admin', https ? 'pass' : web ? 'warn' : 'info'));
    findings.push(finding('router-telnet', ports[23] === 'open' ? 'fail' : 'pass'));
    findings.push(finding('router-ftp', ports[21] === 'open' ? 'warn' : 'pass'));
  } else {
    findings.push(finding('router-admin', 'skip'), finding('router-telnet', 'skip'));
  }

  if (!input.upnp) {
    findings.push(finding('upnp', 'skip'));
  } else if (!input.upnp.found) {
    findings.push(finding('upnp', 'pass'));
  } else {
    findings.push(finding('upnp', 'warn'));
    const mappings = input.upnp.mappings;
    if (mappings === null) {
      findings.push(finding('port-forwards', 'skip'));
    } else {
      const active = mappings.filter(mapping => mapping.enabled);
      findings.push(
        finding(
          'port-forwards',
          active.length ? 'warn' : 'pass',
          { count: active.length },
          active.map(
            mapping =>
              `${mapping.protocol} ${mapping.externalPort} → ${mapping.internalClient}:${
                mapping.internalPort
              }${mapping.description ? ` (${mapping.description})` : ''}`,
          ),
        ),
      );
    }
  }

  if (input.devices === null) {
    findings.push(finding('devices-telnet', 'skip'));
  } else {
    const named = (port: number) =>
      input
        .devices!.filter(device => device.openPorts.includes(port))
        .map(device => `${device.name} (${device.address})`);
    const telnet = named(23);
    const ftp = named(21);
    const remote = [...new Set([...named(3389), ...named(5900)])];
    findings.push(
      finding('devices-telnet', telnet.length ? 'fail' : 'pass', { count: telnet.length }, telnet),
    );
    if (ftp.length) findings.push(finding('devices-ftp', 'warn', { count: ftp.length }, ftp));
    if (remote.length)
      findings.push(finding('devices-remote', 'info', { count: remote.length }, remote));
  }

  findings.push(finding('private-dns', input.privateDns ? 'pass' : 'info'));

  const order: SecuritySeverity[] = ['fail', 'warn', 'info', 'pass', 'skip'];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const score: SecurityScore = findings.some(item => item.severity === 'fail')
    ? 'risky'
    : findings.some(item => item.severity === 'warn')
    ? 'fair'
    : 'good';
  return { score, findings };
}
