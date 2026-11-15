import type { IconName } from '../../components/icons/Icon';

export type ToolId =
  | 'ping'
  | 'traceroute'
  | 'dns-lookup'
  | 'reverse-dns'
  | 'port-scanner'
  | 'http-headers'
  | 'tls-certificate'
  | 'ip-info'
  | 'reachability'
  | 'lan-scanner'
  | 'speed-test'
  | 'connection-monitor';

export type ToolCategory = 'diagnostics' | 'discovery' | 'web' | 'performance';

/**
 * `planned`   – on the roadmap, not implemented; the UI shows it as disabled.
 * `available` – implemented and covered by tests.
 */
export type ToolStatus = 'planned' | 'available';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  category: ToolCategory;
  icon: IconName;
  status: ToolStatus;
  /** Roadmap milestone in which the tool ships (see README → Roadmap). */
  milestone: number;
}

export const TOOL_CATEGORIES: readonly { id: ToolCategory; title: string }[] = [
  { id: 'diagnostics', title: 'Diagnostics' },
  { id: 'discovery', title: 'Discovery' },
  { id: 'web', title: 'Web & TLS' },
  { id: 'performance', title: 'Performance' },
];

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'ping',
    name: 'Ping',
    description: 'Round-trip latency and packet loss to a host',
    category: 'diagnostics',
    icon: 'pulse',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'dns-lookup',
    name: 'DNS Lookup',
    description: 'Resolve A, AAAA, CNAME, MX, TXT and NS records',
    category: 'diagnostics',
    icon: 'globe',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'reverse-dns',
    name: 'Reverse DNS',
    description: 'Find the hostname behind an IP address',
    category: 'diagnostics',
    icon: 'globe',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'traceroute',
    name: 'Traceroute',
    description: 'Hop-by-hop path to a destination',
    category: 'diagnostics',
    icon: 'route',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'reachability',
    name: 'Internet Reachability',
    description: 'Check DNS, HTTP and captive-portal status',
    category: 'diagnostics',
    icon: 'info',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'ip-info',
    name: 'IP Information',
    description: 'Public IP, ASN and provider details',
    category: 'diagnostics',
    icon: 'info',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'lan-scanner',
    name: 'LAN Scanner',
    description: 'Discover devices on your local network',
    category: 'discovery',
    icon: 'lan',
    status: 'planned',
    milestone: 6,
  },
  {
    id: 'port-scanner',
    name: 'Port Scanner',
    description: 'Find open TCP ports on a host you manage',
    category: 'discovery',
    icon: 'plug',
    status: 'planned',
    milestone: 6,
  },
  {
    id: 'http-headers',
    name: 'HTTP Headers',
    description: 'Inspect status, redirects and response headers',
    category: 'web',
    icon: 'document',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'tls-certificate',
    name: 'TLS Certificate',
    description: 'Certificate chain, validity and protocol details',
    category: 'web',
    icon: 'lock',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'speed-test',
    name: 'Speed Test',
    description: 'Download, upload, latency and jitter',
    category: 'performance',
    icon: 'gauge',
    status: 'planned',
    milestone: 7,
  },
  {
    id: 'connection-monitor',
    name: 'Connection Monitor',
    description: 'Track latency, loss and outages over time',
    category: 'performance',
    icon: 'pulse',
    status: 'planned',
    milestone: 8,
  },
];

export function toolsByCategory(
  tools: readonly ToolDefinition[] = TOOLS,
): { category: (typeof TOOL_CATEGORIES)[number]; tools: ToolDefinition[] }[] {
  return TOOL_CATEGORIES.map(category => ({
    category,
    tools: tools.filter(tool => tool.category === category.id),
  })).filter(group => group.tools.length > 0);
}
