/** Well-known TCP services (IANA registry and common practice). */
export const PORT_SERVICES: Record<number, string> = {
  20: 'FTP data',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  67: 'DHCP',
  80: 'HTTP',
  81: 'HTTP (alt)',
  88: 'Kerberos',
  110: 'POP3',
  111: 'RPC',
  119: 'NNTP',
  123: 'NTP',
  135: 'MS RPC',
  139: 'NetBIOS',
  143: 'IMAP',
  161: 'SNMP',
  179: 'BGP',
  389: 'LDAP',
  443: 'HTTPS',
  445: 'SMB',
  465: 'SMTPS',
  515: 'LPD (printer)',
  548: 'AFP',
  554: 'RTSP',
  587: 'SMTP submission',
  631: 'IPP (printer)',
  636: 'LDAPS',
  853: 'DNS over TLS',
  873: 'rsync',
  990: 'FTPS',
  993: 'IMAPS',
  995: 'POP3S',
  1080: 'SOCKS',
  1194: 'OpenVPN',
  1433: 'MS SQL',
  1521: 'Oracle DB',
  1723: 'PPTP',
  1883: 'MQTT',
  1900: 'UPnP',
  2049: 'NFS',
  2082: 'cPanel',
  2375: 'Docker',
  3000: 'Web app (dev)',
  3128: 'HTTP proxy',
  3306: 'MySQL',
  3389: 'RDP',
  3478: 'STUN',
  4443: 'HTTPS (alt)',
  5000: 'UPnP / Synology',
  5001: 'Synology HTTPS',
  5060: 'SIP',
  5353: 'mDNS',
  5432: 'PostgreSQL',
  5555: 'ADB',
  5900: 'VNC',
  6379: 'Redis',
  6443: 'Kubernetes API',
  7000: 'AirPlay',
  8000: 'HTTP (alt)',
  8008: 'Chromecast',
  8009: 'Chromecast',
  8080: 'HTTP proxy / alt',
  8123: 'Home Assistant',
  8291: 'MikroTik Winbox',
  8443: 'HTTPS (alt)',
  8728: 'MikroTik API',
  8883: 'MQTT over TLS',
  8888: 'HTTP (alt)',
  9000: 'Portainer / alt',
  9090: 'Web console',
  9100: 'Printer (raw)',
  9443: 'HTTPS (alt)',
  10000: 'Webmin',
  27017: 'MongoDB',
  32400: 'Plex',
  49152: 'UPnP',
  51820: 'WireGuard',
  62078: 'Apple lockdown (iPhone/iPad)',
};

export function serviceName(port: number): string | null {
  return PORT_SERVICES[port] ?? null;
}

/** Ports tried on every address during LAN discovery; a reply or a refusal proves a host is up. */
export const DISCOVERY_PORTS = [80, 443, 22, 445, 139, 62078, 8080, 554] as const;

/** The "Common" preset of the port scanner. */
export const COMMON_PORTS: readonly number[] = Object.keys(PORT_SERVICES)
  .map(Number)
  .sort((a, b) => a - b);

/** Parses `22`, `20-25`, `80,443,8000-8100` into a sorted, de-duplicated port list. */
export function parsePortList(input: string, max = 65_535): number[] | null {
  const ports = new Set<number>();
  const parts = input
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '');
  if (parts.length === 0) return null;
  for (const part of parts) {
    const match = part.match(/^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/);
    if (!match) return null;
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end > 65_535 || end < start) return null;
    for (let port = start; port <= end; port++) {
      ports.add(port);
      if (ports.size > max) return null;
    }
  }
  return [...ports].sort((a, b) => a - b);
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
