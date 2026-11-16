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
  | 'connection-monitor'
  | 'health-check'
  | 'bluetooth-scanner'
  | 'network-map'
  | 'wifi-survey';

/** Groups shown on the Tools tab, from everyday checks to expert tools. */
export type ToolCategory = 'check' | 'network' | 'lookup' | 'web';

/**
 * `planned`   – on the roadmap, not implemented; the UI shows it as disabled.
 * `available` – implemented and covered by tests.
 */
export type ToolStatus = 'planned' | 'available';

export interface ToolDefinition {
  id: ToolId;
  category: ToolCategory;
  icon: IconName;
  status: ToolStatus;
  /** Roadmap milestone in which the tool ships (see README → Roadmap). */
  milestone: number;
}

/** Display order of categories. Names and descriptions live in src/i18n. */
export const TOOL_CATEGORIES: readonly ToolCategory[] = ['check', 'network', 'lookup', 'web'];

export const TOOLS: readonly ToolDefinition[] = [
  { id: 'health-check', category: 'check', icon: 'heart', status: 'available', milestone: 8 },
  { id: 'wifi-survey', category: 'check', icon: 'wifi', status: 'available', milestone: 11 },
  { id: 'speed-test', category: 'check', icon: 'gauge', status: 'available', milestone: 7 },
  { id: 'reachability', category: 'check', icon: 'shield', status: 'available', milestone: 5 },
  { id: 'connection-monitor', category: 'check', icon: 'chart', status: 'available', milestone: 8 },
  { id: 'network-map', category: 'network', icon: 'map', status: 'available', milestone: 10 },
  { id: 'lan-scanner', category: 'network', icon: 'lan', status: 'available', milestone: 6 },
  {
    id: 'bluetooth-scanner',
    category: 'network',
    icon: 'bluetooth',
    status: 'available',
    milestone: 10,
  },
  { id: 'port-scanner', category: 'network', icon: 'plug', status: 'available', milestone: 6 },
  { id: 'ping', category: 'lookup', icon: 'pulse', status: 'available', milestone: 5 },
  { id: 'traceroute', category: 'lookup', icon: 'route', status: 'available', milestone: 5 },
  { id: 'dns-lookup', category: 'lookup', icon: 'search', status: 'available', milestone: 5 },
  { id: 'reverse-dns', category: 'lookup', icon: 'swap', status: 'available', milestone: 5 },
  { id: 'ip-info', category: 'lookup', icon: 'pin', status: 'available', milestone: 5 },
  { id: 'http-headers', category: 'web', icon: 'document', status: 'available', milestone: 5 },
  { id: 'tls-certificate', category: 'web', icon: 'lock', status: 'available', milestone: 5 },
];

export function toolsByCategory(
  tools: readonly ToolDefinition[] = TOOLS,
): { category: ToolCategory; tools: ToolDefinition[] }[] {
  return TOOL_CATEGORIES.map(category => ({
    category,
    tools: tools.filter(tool => tool.category === category),
  })).filter(group => group.tools.length > 0);
}
